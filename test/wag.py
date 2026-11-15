import asyncio, sys, json, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from playwright.async_api import async_playwright
from run import route, ROOT
from race import ARGS
from line import DRV
async def one(b, wag, wet, tyre, cond):
    pg=await b.new_page(screen={'width':1920,'height':1080}, viewport={'width':480,'height':270}); errs=[]
    pg.on('pageerror', lambda e: errs.append(f'PAGEERROR: {e}'))
    await pg.route('**/*', route)
    await pg.goto('file://'+ROOT+'/dist/index.html')
    await pg.wait_for_function('window.__apex && window.__apex.mode==="intro"', timeout=90000)
    await pg.evaluate(DRV)
    await pg.evaluate('() => { __apex.endIntro(); __apex.selCar=0; __apex.selTrack=1; __apex.selMode="endless"; __apex.selTyre=1; __apex.beginRace(); }')
    await pg.wait_for_function('window.__apex.mode==="race" && window.__apex.race', timeout=90000)
    await pg.evaluate('() => __apex.setMode("test")')
    r = await pg.evaluate(f'''() => {{ const A=__apex, r=A.race, E=r.end, p=r.player; A.RAINP.wag={wag}; const set=()=>{{ E.events=[]; E.wx={2 if wet else 0}; E.rain={wet}; E.wet={wet}; E.tyre={tyre}; E.cond={cond}; E.left=60; p.health=Math.max(p.health,60); E.pit.phase='idle'; }};
      // a) hands off the wheel, full throttle
      let n=0, sb=0, mb=0, lat0=null, latMax=0; const series=[];
      for (let i=0;i<60*14;i++) {{ set(); A.input.gas=true; A.input.brake=false; A.input.left=A.input.right=false; A.step(1/60,1); if (r.state!=='race') continue; if (lat0==null) lat0=p.lat; n++; const b=(p.visYaw||0)*57.3; sb+=b*b; mb=Math.max(mb,Math.abs(b)); latMax=Math.max(latMax,Math.abs(p.lat-lat0)); if (n%30===0) series.push(b.toFixed(1)+'/'+(p.lat-lat0).toFixed(1)+'/'+Math.round(p.speed*3.6)); if (n>60*8) break; }}
      const a = {{betaRms:+Math.sqrt(sb/n).toFixed(1), betaMax:+mb.toFixed(1), latDrift:+latMax.toFixed(1), series:series.join(' ')}};
      // b) a lap following the line
      let hits=0, hp=p.health, off=0, mb2=0, sb2=0, n2=0; const l0=p.lapsDone;
      for (let i=0;i<60*170;i++) {{ set(); __driveL(1,1/60); const b=Math.abs(p.beta||0)*57.3; mb2=Math.max(mb2,b); sb2+=b*b; n2++; if (hp-p.health>1.5) hits++; hp=p.health; if (p.offroad) off++; if (p.lapsDone>=l0+2) break; }}
      return {{wag:{wag}, wet:{wet}, tyre:{tyre}, grip:+r.gripMul.toFixed(2), a, lap:p.lapTimes[1] && +p.lapTimes[1].toFixed(1), betaRms:+Math.sqrt(sb2/n2).toFixed(1), betaMax:+mb2.toFixed(0), hits, offSec:+(off/60).toFixed(1), place:p.place, sec:JSON.stringify(p.sec.col)}}; }}''')
    print(r, errs or ''); await pg.close()
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path=os.environ.get('CHROME','/usr/bin/google-chrome'), args=ARGS)
        await asyncio.gather(*[one(b,*s) for s in json.loads(sys.argv[1])])
        await b.close()
if __name__ == "__main__": asyncio.run(main())
