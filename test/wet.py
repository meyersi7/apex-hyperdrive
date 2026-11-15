import asyncio, sys, json, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from playwright.async_api import async_playwright
from run import route, ROOT
from race import ARGS
from endless import AUTO_E
async def one(b, wet, tyre, skill, rp=None):
    pg=await b.new_page(screen={'width':1920,'height':1080}, viewport={'width':480,'height':270}); errs=[]
    pg.on('pageerror', lambda e: errs.append(f'PAGEERROR: {e}'))
    await pg.route('**/*', route)
    await pg.goto('file://'+ROOT+'/dist/index.html')
    await pg.wait_for_function('window.__apex && window.__apex.mode==="intro"', timeout=90000)
    await pg.evaluate(AUTO_E)
    await pg.evaluate('() => { __apex.endIntro(); __apex.selCar=0; __apex.selTrack=0; __apex.selMode="endless"; __apex.selTyre=1; __apex.beginRace(); }')
    await pg.wait_for_function('window.__apex.mode==="race" && window.__apex.race', timeout=90000)
    await pg.evaluate('() => __apex.setMode("test")')
    if rp: await pg.evaluate(f'() => Object.assign(__apex.RAINP, {json.dumps(rp)})')
    r = await pg.evaluate(f'''() => {{ const A=__apex, r=A.race, E=r.end, p=r.player; let maxB=0, tSlide=0, hits=0, hp=100, n=0;
      for (let i=0;i<60*130;i++) {{ E.events=[]; E.wx={2 if wet else 0}; E.rain={wet}; E.wet={wet}; E.tyre={tyre}; E.cond=0.9; E.left=60; p.health=Math.max(p.health,50);
        __driveE(1,1/60,{{nopit:true, skill:{skill}}}); const b=Math.abs(p.beta||0)*57.3; if (b>maxB) maxB=b; if (b>8) tSlide+=1/60; if (hp-p.health>1.5) hits++; hp=p.health; n++; if (p.lapsDone>=1) break; }}
      return {{rp: JSON.stringify(A.RAINP), wet:{wet}, tyre:{tyre}, lap:p.lapTimes[0], maxBeta:+maxB.toFixed(0), slideSec:+tSlide.toFixed(1), hits, slick:+r.slick.toFixed(2), grip:+r.gripMul.toFixed(2), secs:+(n/60).toFixed(0), dist:Math.floor(p.progress)}}; }}''')
    print(r, errs or ''); await pg.close()
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path=os.environ.get('CHROME','/usr/bin/google-chrome'), args=ARGS)
        sets=[dict(cs=0,csGain=0,rear=0,fall=0,esp=0), dict(cs=0.03,csGain=0.1,rear=0.03,fall=0.08,esp=0.3), dict(cs=0.05,csGain=0.1,rear=0.02,fall=0.05,esp=0.3), dict(cs=0.03,csGain=0,rear=0,fall=0.1,esp=0.5)]
        await asyncio.gather(*[one(b,1,1,0.86,rp) for rp in sets])
        await b.close()
asyncio.run(main())
