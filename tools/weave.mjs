const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const L=2.87,Aa=1.55,Bb=1.32,K2=1.6,B=18,C=1.4;
function sim({u, grip=33.5, vmax=101, inp, T=4, P}){
  let v=0,r=0,steer=0,hd=0,x=0; const h=1/240; const tire=(a,D)=>D*Math.sin(C*Math.atan(B*a));
  let maxB=0, maxX=0, sat=0;
  for(let t=0;t<T;t+=h){
    const st=inp(t); steer += (st-steer)*(1-Math.exp(-(st===0?9:5.5)*h));
    const f=Math.min(1.25,u/vmax), A=grip*(1+0.25*Math.min(f,1.25)**2);
    const ff=Math.min(1,f);
    const lockK = P.k0 + (P.k1-P.k0)*ff*ff;
    const beta0=Math.atan2(v,u); const delta=steer*Math.min(0.5,lockK*A*L/Math.max(u*u,1)+P.c*(1-ff)) + Math.sign(beta0)*clamp(Math.abs(beta0)-(P.csT||0),0,0.35)*(P.kcs||0);
    const brk = P.brake && t<1.2 ? 1:0; const tr=-brk*(P.tr??0.04); const DF=A*(Bb/L-tr), DR=A*(Aa/L+tr)*1.06*(1-0.1*(1-ff)*(brk?0:1));
    const af=Math.atan2(v+Aa*r,u)-delta, ar=Math.atan2(v-Bb*r,u);
    const Fyf=-tire(af,DF), Fyr=-tire(ar,DR), cd=Math.cos(delta);
    let dv=Fyf*cd+Fyr-u*r, dr=(Aa*Fyf*cd-Bb*Fyr)/K2;
    const over=clamp((Math.abs(ar)-0.11)/0.1,0,1); dr-=r*3.5*over;
    // assists
    const rT = clamp(u*delta/L, -A/u, A/u);
    dr += (rT - r) * P.ky * ff*ff;
    const beta=Math.atan2(v,u); dr += beta * P.kb * ff * (Math.abs(beta)>0.02?1:0);
    v+=dv*h; r+=dr*h; hd-=r*h; 
    x += (-Math.cos(hd)*v + Math.sin(hd)*u)*h*(-1);   // lateral world displacement (right positive)
    maxB=Math.max(maxB,Math.abs(beta)); maxX=Math.max(maxX,Math.abs(x));
  }
  return {u, maxBetaDeg:+(maxB*57.3).toFixed(1), maxX:+maxX.toFixed(1), endX:+x.toFixed(1), endHdDeg:+(hd*57.3).toFixed(1), endR:+r.toFixed(3)};
}
const tests = {
  tap: t => t<0.4?-1:0,                         // 0.4 s full left then release
  flick: t => t<0.4?-1: t<0.8?1:0,             // left-right
  weave: t => (Math.floor(t/0.3)%2?1:-1)*(t<2.4?1:0),
  hold: t => t<1.5?-1:0,
};
const sets = { brake_T05:{k0:1.25,k1:1.25,c:0.01,ky:0,kb:0,brake:1,kcs:1,csT:0.05,tr:0.02}, brake_T035:{k0:1.25,k1:1.1,c:0.01,ky:0,kb:0,brake:1,kcs:1,csT:0.035,tr:0.02}, noBrake_T035:{k0:1.25,k1:1.1,c:0.01,ky:0,kb:0,kcs:1,csT:0.035} };
for (const [n,P] of Object.entries(sets)) { console.log('==',n); for (const u of [30,50,80,105,125]) { const o=[]; for (const [tn,fn] of Object.entries(tests)) { const r=sim({u,inp:fn,P}); o.push(`${tn}: b${r.maxBetaDeg} x${r.maxX} hd${r.endHdDeg} r${r.endR}`); } console.log(u, o.join(' | ')); } }
