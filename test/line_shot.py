import asyncio, sys, json, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from playwright.async_api import async_playwright
from run import route, ROOT
from race import ARGS
from line import DRV
async def one(b, name, track, car, wet, tyre, stops):
    pg=await b.new_page(screen={'width':1920,'height':1080}, viewport={'width':1280,'height':720}); errs=[]
    pg.on('pageerror', lambda e: errs.append(f'PAGEERROR: {e}'))
    pg.on('console', lambda m: errs.append(f'{m.type}: {m.text}') if m.type=='error' else None)
    await pg.route('**/*', route)
    await pg.goto('file://'+ROOT+'/dist/index.html')
    await pg.wait_for_function('window.__apex && window.__apex.mode==="intro"', timeout=90000)
    await pg.evaluate(DRV)
    await pg.evaluate(f'() => {{ __apex.endIntro(); __apex.selCar={car}; __apex.selTrack={track}; __apex.selMode="endless"; __apex.selTyre=1; __apex.beginRace(); }}')
    await pg.wait_for_function('window.__apex.mode==="race" && window.__apex.race', timeout=90000)
    await pg.evaluate('() => __apex.setMode("test")')
    for k,(mode,val) in enumerate(stops):
        info = await pg.evaluate(f'''() => {{ const A=__apex, r=A.race, E=r.end, p=r.player; let n=0;
          const cond = () => '{mode}'==='s' ? r.td.wrap(p.s) >= {val} && r.td.wrap(p.s) < {val}+60 : '{mode}'==='brake' ? r.line.need > 0.8 && p.speed > 50 && n > {val} : n >= {val};
          for (let i=0;i<60*120;i++) {{ E.events=[]; E.wx={2 if wet else 0}; E.rain={wet}; E.wet={wet}; E.tyre={tyre}; E.cond=0.9; E.left=60; p.health=Math.max(p.health,60); E.pit.phase='idle'; __driveL(1,1/60); n++; if (cond()) break; }}
          A.render(); return {{s:Math.round(r.td.wrap(p.s)), v:Math.round(p.speed*3.6), lim:Math.round(r.line.lim*3.6), need:+r.line.need.toFixed(2), vis:r.line.mesh.visible}}; }}''')
        await pg.screenshot(path=f'{ROOT}/test/shots/line_{name}_{k}.png'); print(name, k, info)
    print(errs[:5] or 'no errors'); await pg.close()
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path=os.environ.get('CHROME','/usr/bin/google-chrome'), args=ARGS)
        await asyncio.gather(one(b,'dry',1,0,0,1,[('n',420),('brake',60)]), one(b,'wet',0,2,1,1,[('n',600),('brake',60)]), one(b,'night',2,3,0,1,[('brake',300)]))
        await b.close()
if __name__ == "__main__": asyncio.run(main())
