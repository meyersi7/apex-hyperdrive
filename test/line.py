import asyncio, sys, json, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from playwright.async_api import async_playwright
from run import route, ROOT
from race import ARGS
DRV = r'''
window.__apex.gfxLock && window.__apex.gfxLock();
window.__driveL = (n, dt, mode) => {
  const A = window.__apex, inp = A.input, wrap = (a)=>{while(a>Math.PI)a-=2*Math.PI;while(a<-Math.PI)a+=2*Math.PI;return a;};
  for (let i=0;i<n;i++) {
    const r = A.race, p = r.player, td = r.td, v = Math.abs(p.speed);
    let tl = td.idealAt(p.s + 30);
    for (const o of td.obstacles) { if (o.active===false) continue; let d=o.s-p.s; if(d<-td.L/2)d+=td.L; if (d>0 && d<Math.max(90,v*2.6) && Math.abs(o.lat-tl)<4.6) tl = o.lat + (o.lat>tl?-6:6); }
    const ahead = Math.max(14, v*0.55), q = td.at(p.s + ahead, tl), err = wrap(Math.atan2(q.x - p.x, q.z - p.z) - p.heading);
    inp.left = err > 0.015; inp.right = err < -0.015;
    const L = r.line;
    const ag = window.__aggr || 0; inp.brake = ag ? v > L.lim * (1 + ag) : L.need > 0.4; inp.gas = !inp.brake && (ag ? v < L.lim * (1 + ag) : L.m < 0.75); inp.nitro = false;
    A.step(dt, 1);
  }
};
'''
async def one(b, track, car, wet, tyre, cond, rp=None):
    rp = rp or {}
    pg=await b.new_page(screen={'width':1920,'height':1080}, viewport={'width':480,'height':270}); errs=[]
    pg.on('pageerror', lambda e: errs.append(f'PAGEERROR: {e}'))
    await pg.route('**/*', route)
    await pg.goto('file://'+ROOT+'/dist/index.html')
    await pg.wait_for_function('window.__apex && window.__apex.mode==="intro"', timeout=90000)
    await pg.evaluate(DRV)
    await pg.evaluate(f'() => {{ __apex.endIntro(); __apex.selCar={car}; __apex.selTrack={track}; __apex.selMode="endless"; __apex.selTyre=1; __apex.beginRace(); }}')
    await pg.wait_for_function('window.__apex.mode==="race" && window.__apex.race', timeout=90000)
    await pg.evaluate('() => __apex.setMode("test")')
    r = await pg.evaluate(f'''() => {{ const A=__apex, r=A.race, E=r.end, p=r.player; window.__aggr = {json.dumps(rp)}.aggr || 0; Object.assign(A.RAINP, {json.dumps(rp)}); let maxB=0, hits=0, hp=100, n=0, off=0, ema=0, js=0, jn=0, vs=0, dev=0;
      r.line.always = true;
      for (let i=0;i<60*150;i++) {{ E.events=[]; E.wx={2 if wet else 0}; E.rain={wet}; E.wet={wet}; E.tyre={tyre}; E.cond={cond}; E.left=60; p.health=Math.max(p.health,50); E.pit.phase='idle';
        __driveL(1,1/60); const b=Math.abs(p.beta||0)*57.3; if (b>maxB) maxB=b; if (hp-p.health>1.5) hits++; hp=p.health; n++; if (p.offroad) off++;
        ema += (p.yawRate-ema)*(1-Math.exp(-1/60/0.6)); if (r.state==='race') {{ js += (p.yawRate-ema)**2; jn++; vs+=p.speed; dev += (p.lat-r.td.idealAt(p.s))**2; }}
        if (p.lapsDone>=1) break; }}
      return {{track:{track}, car:{car}, wet:{wet}, tyre:{tyre}, cond:{cond}, rp:'{json.dumps(rp)}', dev:+Math.sqrt(dev/jn).toFixed(1), lap:p.lapTimes[0] && +p.lapTimes[0].toFixed(1), vAvg:Math.round(vs/jn*3.6), maxBeta:+maxB.toFixed(0), hits, offSec:+(off/60).toFixed(1), yawJit:+Math.sqrt(js/jn).toFixed(3), grip:+r.gripMul.toFixed(2)}}; }}''')
    print(r, errs or ''); await pg.close()
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path=os.environ.get('CHROME','/usr/bin/google-chrome'), args=ARGS)
        sets = json.loads(sys.argv[1])
        await asyncio.gather(*[one(b,*s) for s in sets])
        await b.close()
if __name__ == "__main__": asyncio.run(main())
