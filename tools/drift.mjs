const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const L=2.87,Aa=1.55,Bb=1.32,K2=1.6,TB=18,TC=1.4;
const tire=(a,D)=>D*Math.sin(TC*Math.atan(TB*a));
function sim({u0, grip=33.5, vmax=101, pm=622, a0=12.9, inp, T=6, P}){
  let u=u0,v=0,r=0,steer=0,hd=0; const h=1/240; const cdr=(pm/vmax-0.35)/(vmax*vmax);
  const log=[]; let maxB=0;
  for(let t=0;t<T;t+=h){
    const I=inp(t), st=I.st||0, thr=I.thr??1, drift=!!I.drift && u>8;
    steer += (st-steer)*(1-Math.exp(-(st===0?9:5.5)*h));
    const f=Math.min(1,u/vmax), A=grip*(1+0.25*f*f);
    let ax = thr*Math.min(a0, pm/Math.max(u,1)) - (0.35+cdr*u*u) - (thr?0:1.1);
    const beta=u>4?Math.atan2(v,u):0;
    let delta;
    if (drift) delta = steer*Math.min(0.5,(1.25-0.15*f*f)*A*L/Math.max(u*u,1)+P.lockAdd) + beta*P.kb;
    else delta = steer*Math.min(0.5,(1.25-0.15*f*f)*A*L/Math.max(u*u,1)+0.01*(1-f)) + Math.sign(beta)*clamp(Math.abs(beta)-(0.07-0.04*f),0,0.35);
    const tr=clamp(ax/30,-1,1)*0.02, DF=A*(Bb/L-tr), DR=A*(Aa/L+tr)*1.06*(1-0.1*thr*(1-f))*(drift?P.kR:1);
    const af=Math.atan2(v+Aa*r,u)-delta, ar=Math.atan2(v-Bb*r,u);
    const Fyf=-tire(af,DF), Fyr=-tire(ar,DR), cd=Math.cos(delta);
    let dv=Fyf*cd+Fyr-u*r, dr=(Aa*Fyf*cd-Bb*Fyr)/K2;
    if (!drift) { const over=clamp((Math.abs(ar)-0.11)/0.1,0,1); dr-=r*3.5*over; if(over>0&&ax>0) ax*=1-0.7*over; }
    else { const sp=Math.hypot(u,v), rPath=(Fyf*cd+Fyr)/Math.max(sp,5), bT=-steer*P.bMax; dr += -P.kp*(bT-beta) - P.kd*(r-rPath); }
    u += (ax + v*r - Fyf*Math.sin(delta))*h; v+=dv*h; r+=dr*h; hd-=r*h;
    maxB=Math.max(maxB,Math.abs(beta));
    if (Math.abs((t*4)%1) < h*4) log.push(`${t.toFixed(2)}:b${(beta*57.3).toFixed(0)} r${r.toFixed(2)} v${(Math.hypot(u,v)*3.6).toFixed(0)}`);
  }
  return {maxB:(maxB*57.3).toFixed(0), log:log.filter((_,i)=>i%2==0).join(' ')};
}
const sc = {
  holdLeft: t => ({st: t<0.3?0:-1, drift: t>0.3&&t<3.3, thr:1}),                       // turn in + drift, keep steering in
  counter:  t => ({st: t<0.3?0: t<1.0?-1: t<3.3? 0.4 : 0, drift: t>0.3&&t<3.3, thr:1}),  // turn in, then countersteer a bit, release at 3.3
  flickRelease: t => ({st: t<0.3?0: t<1.2?-1:0, drift: t>0.3&&t<1.2, thr:1}),
};
const sets = JSON.parse(process.argv[2]);
for (const [n,P] of Object.entries(sets)) { console.log('=====',n, JSON.stringify(P)); for (const u0 of [25,45,70]) for (const [sn,fn] of Object.entries(sc)) { const r=sim({u0,inp:fn,P}); console.log(u0, sn, 'maxB', r.maxB, '|', r.log); } }
