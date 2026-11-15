import asyncio, sys, json, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from playwright.async_api import async_playwright
from run import route, ROOT
from race import ARGS
from line import DRV
async def one(b, name, wet):
    pg=await b.new_page(screen={'width':1920,'height':1080}, viewport={'width':1280,'height':720}); errs=[]
    pg.on('pageerror', lambda e: errs.append(f'PAGEERROR: {e}'))
    await pg.route('**/*', route)
    await pg.goto('file://'+ROOT+'/dist/index.html')
    await pg.wait_for_function('window.__apex && window.__apex.mode==="intro"', timeout=90000)
    await pg.evaluate(DRV)
    await pg.evaluate('() => { __apex.endIntro(); __apex.selCar=0; __apex.selTrack=0; __apex.selMode="endless"; __apex.selTyre=3; __apex.beginRace(); }')
    await pg.wait_for_function('window.__apex.mode==="race" && window.__apex.race', timeout=90000)
    await pg.evaluate('() => __apex.setMode("test")')
    r = await pg.evaluate(f'''() => {{ const A=__apex, r=A.race, E=r.end, p=r.player;
      const hold = () => {{ E.events=[]; E.wx={2 if wet else 0}; E.rain={wet}; E.wet={wet}; E.tyre=3; E.cond=0.9; E.left=60; p.health=Math.max(p.health,60); E.pit.phase='idle'; }};
      for (let i=0;i<60*8;i++) {{ hold(); __driveL(1,1/60); }}
      const js=[], sp=[]; 
      for (let i=0;i<3600;i++) {{ hold(); const fl0=E.flash, lt0=E.ltT, m0=document.getElementById('msgs').children.length; const t0=performance.now(); __driveL(1,1/60); const d=performance.now()-t0; js.push(d); if (d>3) sp.push([i, +d.toFixed(1), 'flash', +fl0.toFixed(2), +E.flash.toFixed(2), 'lt', +lt0.toFixed(2), 'msgs', m0, document.getElementById('msgs').children.length, 'lap', p.lapsDone, 's', Math.round(r.td.wrap(p.s))]); }}
      const s=[...js].sort((x,y)=>x-y);
      return {{med:+s[s.length>>1].toFixed(2), p99:+s[Math.floor(s.length*0.99)].toFixed(2), max:+s[s.length-1].toFixed(2), sum:+js.reduce((x,y)=>x+y,0).toFixed(0), spikes: sp.length, sp: sp.slice(0,25)}}; }}''')
    print(name, json.dumps(r)[:2500], errs or ''); await pg.close()
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path=os.environ.get('CHROME','/usr/bin/google-chrome'), args=ARGS)
        await one(b, *([['dry',0],['rain',1]][int(os.environ.get('I','0'))]))
        await b.close()
if __name__ == "__main__": asyncio.run(main())
