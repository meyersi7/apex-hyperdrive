const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const L=2.87,Aa=1.55,Bb=1.32,K2=1.6,TB=18,TC=1.4;
const tire=(a,D)=>D*Math.sin(TC*Math.atan(TB*a));
function sim({u, gm, slick, RP, V, inp, T=6, grip=33.5, vmax=101}){
  let v=0,r=0,steer=0; const h=1/240, out=[]; let bmax=0;
  for(let t=0;t<T;t+=h){
    const st=inp(t); steer += (st-steer)*(1-Math.exp(-(st===0?9:5.5)*h));
    const f=Math.min(1,u/vmax), A=grip*(1+0.25*f*f)*gm;
    const beta=Math.atan2(v,u), lock=(1.25-0.15*f*f)*Math.max(A,8)*L/Math.max(u*u,1);
    const th=(0.07-0.04*f)+RP.cs*slick, ab=Math.abs(beta);
    let cs;
    if (V.soft) { const x=Math.max(0,ab-th+V.soft); cs = x<2*V.soft ? x*x/(4*V.soft) : x-V.soft; cs=Math.min(cs,0.35); } else cs=clamp(ab-th,0,0.35);
    const delta=steer*Math.min(0.5,lock+0.01*(1-f)) + Math.sign(beta)*cs*(1-RP.csGain*slick);
    const DF=A*(Bb/L), DR=A*(Aa/L)*1.06*(1-0.1*(1-f))*(1-RP.rear*slick);
    const af=Math.atan2(v+Aa*r,u)-delta, ar=Math.atan2(v-Bb*r,u);
    const fall=(al)=>1-RP.fall*slick*clamp((Math.abs(al)-0.12)/0.15,0,1);
    const Fyf=-tire(af,DF)*fall(af), Fyr=-tire(ar,DR)*fall(ar), cd=Math.cos(delta);
    let dv=Fyf*cd+Fyr-u*r, dr=(Aa*Fyf*cd-Bb*Fyr)/K2;
    const over=clamp((Math.abs(ar)-0.11)/0.1,0,1); dr-=r*3.5*over*(1-RP.esp*slick);
    if (V.damp) { const rss = -(Fyf*cd+Fyr)/Math.max(u,5); dr -= V.damp*slick*(dv/Math.max(u,5)) *0 ; dr -= V.damp*(r - (V.rref?V.rref(r):r))*0; }
    if (V.bd) dr += V.bd * (dv/Math.max(u,8)); // beta-rate damping: yaw follows slip-rate
    v+=dv*h; r+=dr*h; bmax=Math.max(bmax,ab);
    if (t>T-3) out.push([r, beta]);
  }
  const rs=out.map(o=>o[0]), bs=out.map(o=>o[1]); const mean=a=>a.reduce((x,y)=>x+y,0)/a.length; const sd=a=>{const m=mean(a);return Math.sqrt(mean(a.map(x=>(x-m)**2)));};
  return `r ${mean(rs).toFixed(2)}±${sd(rs).toFixed(3)} β ${(mean(bs)*57.3).toFixed(1)}±${(sd(bs)*57.3).toFixed(2)}° max ${(bmax*57.3).toFixed(1)}`;
}
const RP={cs:0.05,csGain:0.1,rear:0.02,fall:0.05,esp:0.3};
const variants={base:{}, soft03:{soft:0.03}, soft05:{soft:0.05}, bd2:{bd:2}, bd4:{bd:4}, soft03bd3:{soft:0.03,bd:3}, soft04bd4:{soft:0.04,bd:4}};
for (const [vn,V] of Object.entries(variants)) { console.log('=====',vn);
for (const [name,gm,slick] of [['dry',1,0],['wetS',0.52,1],['wetR',0.93,0.2],['halfwet',0.76,0.5]]) { for (const u of [20,30,40,50,75]) console.log(' ',name,'u'+u, sim({u,gm,slick,RP,V,inp:t=>1})); } }
