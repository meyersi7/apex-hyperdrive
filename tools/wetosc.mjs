const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const L=2.87,Aa=1.55,Bb=1.32,K2=1.6,TB=18,TC=1.4;
const tire=(a,D)=>D*Math.sin(TC*Math.atan(TB*a));
function sim({u, gm, slick, RP, inp, T=5, grip=33.5, vmax=101}){
  let v=0,r=0,steer=0; const h=1/240, out=[];
  for(let t=0;t<T;t+=h){
    const st=inp(t); steer += (st-steer)*(1-Math.exp(-(st===0?9:5.5)*h));
    const f=Math.min(1,u/vmax), A=grip*(1+0.25*f*f)*gm;
    const beta=Math.atan2(v,u), lock=(1.25-0.15*f*f)*Math.max(A,8)*L/Math.max(u*u,1);
    const delta=steer*Math.min(0.5,lock+0.01*(1-f)) + Math.sign(beta)*clamp(Math.abs(beta)-(0.07-0.04*f)-RP.cs*slick,0,0.35)*(1-RP.csGain*slick);
    const DF=A*(Bb/L), DR=A*(Aa/L)*1.06*(1-0.1*(1-f))*(1-RP.rear*slick);
    const af=Math.atan2(v+Aa*r,u)-delta, ar=Math.atan2(v-Bb*r,u);
    const fall=(al)=>1-RP.fall*slick*clamp((Math.abs(al)-0.12)/0.15,0,1);
    const Fyf=-tire(af,DF)*fall(af), Fyr=-tire(ar,DR)*fall(ar), cd=Math.cos(delta);
    let dv=Fyf*cd+Fyr-u*r, dr=(Aa*Fyf*cd-Bb*Fyr)/K2;
    const over=clamp((Math.abs(ar)-0.11)/0.1,0,1); dr-=r*3.5*over*(1-RP.esp*slick);
    v+=dv*h; r+=dr*h;
    if (t>T-2) out.push([r, beta]);
  }
  const rs=out.map(o=>o[0]), bs=out.map(o=>o[1]); const mean=a=>a.reduce((x,y)=>x+y,0)/a.length; const sd=a=>{const m=mean(a);return Math.sqrt(mean(a.map(x=>(x-m)**2)));};
  let flips=0; const mr=mean(rs); for(let i=1;i<rs.length;i++) if ((rs[i]-mr)*(rs[i-1]-mr)<0) flips++;
  return `u${u}: r mean ${mr.toFixed(2)} sd ${sd(rs).toFixed(3)} | beta mean ${(mean(bs)*57.3).toFixed(1)}° sd ${(sd(bs)*57.3).toFixed(2)}° | osc ${(flips/4).toFixed(1)} Hz`;
}
const RP={cs:0.05,csGain:0.1,rear:0.02,fall:0.05,esp:0.3};
for (const [name,gm,slick] of [['dry',1,0],['wet slicks',0.52,1],['wet rain tyre',0.93,0.2]]) { console.log('==',name); for (const u of [30,50,75]) { console.log(' hold  ', sim({u,gm,slick,RP,inp:t=>1})); console.log(' tap   ', sim({u,gm,slick,RP,inp:t=>t<0.5?1:0})); } }
