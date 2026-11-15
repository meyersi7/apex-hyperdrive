// standalone copy of the lateral dynamics for tuning
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)), lerp=(a,b,t)=>a+(b-a)*t;
const L=2.87,Aa=1.55,Bb=1.32,K2=1.6;
function run({u0, B, C, lockK, lockC, gripK=[0.88,0.3], rearK=1.06, thr=0, grip=33.5, vmax=101, steerIn=1, T=4, espOn=0.13, espW=0.12, release=null}){
  let v=0,r=0,steer=0; const h=1/240; let u=u0; const tire=(a,D)=>D*Math.sin(C*Math.atan(B*a));
  let ayS=0,n=0,maxB=0,maxAr=0, log=[];
  for(let t=0;t<T;t+=h){
    const st = (release!=null && t>release)?0:steerIn; steer += (st-steer)*(1-Math.exp(-(st===0?9:5.5)*h));
    const f=Math.min(1,u/vmax), A=grip*(gripK[0]+gripK[1]*f*f);
    const delta=steer*Math.min(0.5,lockK*A*L/Math.max(u*u,1)+lockC);
    const DF=A*(Bb/L), DR=A*(Aa/L)*rearK*(1-0.1*thr*(1-f));
    const af=Math.atan2(v+Aa*r,u)-delta, ar=Math.atan2(v-Bb*r,u);
    const Fyf=-tire(af,DF), Fyr=-tire(ar,DR), cd=Math.cos(delta);
    let dv=Fyf*cd+Fyr-u*r, dr=(Aa*Fyf*cd-Bb*Fyr)/K2;
    const over=clamp((Math.abs(ar)-espOn)/espW,0,1); dr-=r*3.5*over;
    v+=dv*h; r+=dr*h;
    if(t>T-1 && release==null){ayS+=Fyf*cd+Fyr;n++;}
    maxB=Math.max(maxB,Math.abs(Math.atan2(v,u))); maxAr=Math.max(maxAr,Math.abs(ar));
    if (release!=null && Math.abs(t-(release+0.8))<h/2) log.push('r@+0.8s='+r.toFixed(3)+' beta='+Math.atan2(v,u).toFixed(3));
  }
  const f=Math.min(1,u/vmax), A=grip*(gripK[0]+gripK[1]*f*f);
  return {u0, ay:(ayS/n).toFixed(1), A:A.toFixed(1), ratio:(ayS/n/grip).toFixed(2), maxBetaDeg:(maxB*57.3).toFixed(1), maxArDeg:(maxAr*57.3).toFixed(1), log};
}
const P = JSON.parse(process.argv[2]||'{}');
for (const u0 of [20,35,50,70,95]) console.log(JSON.stringify(run({u0, B:13,C:1.35,lockK:1.15,lockC:0.012, ...P})));
if (P.rel) for (const u0 of [35,70,95]) console.log('release', JSON.stringify(run({u0, B:13,C:1.35,lockK:1.15,lockC:0.012, ...P, T:3, release:0.6})));
