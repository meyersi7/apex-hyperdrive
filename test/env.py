import asyncio, sys, json, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from playwright.async_api import async_playwright
from run import route, ROOT
from race import AUTO, ARGS
TR=int(sys.argv[1]); CAR=int(sys.argv[2]); STEPS=[int(x) for x in sys.argv[3].split(',')]
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path=os.environ.get('CHROME','/usr/bin/google-chrome'), args=ARGS)
        pg=await b.new_page(screen={'width':1920,'height':1080}, viewport={'width':960,'height':540}); errs=[]
        pg.on('pageerror', lambda e: errs.append(f'PAGEERROR: {e}'))
        pg.on('console', lambda m: errs.append(f'{m.type}: {m.text}') if m.type in('error',) else None)
        await pg.route('**/*', route)
        await pg.goto('file://'+ROOT+'/dist/index.html')
        await pg.wait_for_function('window.__apex && window.__apex.mode==="intro"', timeout=90000)
        await pg.evaluate(AUTO)
        t0 = await pg.evaluate(f'() => {{ __apex.endIntro(); __apex.selCar={CAR}; __apex.selTrack={TR}; __apex.selDiff=1; const t=performance.now(); __apex.startRace({CAR},{TR}); return performance.now()-t; }}')
        print('build ms', round(t0))
        await pg.evaluate('() => { __apex.setMode("test"); document.getElementById("menu").classList.remove("on"); document.getElementById("hud").classList.add("on"); }')
        done=0
        for i,n in enumerate(STEPS):
            await pg.evaluate(f'() => __drive({n-done}, 1/60, {{nitro:false}})'); done=n
            await pg.evaluate('() => { __apex.step(0.001,1); __apex.render(); }')
            await pg.wait_for_timeout(300)
            await pg.screenshot(path=f'{ROOT}/test/shots/env{TR}_{i}.png')
        print('gfx', await pg.evaluate('() => JSON.stringify(__apex.gfx)'))
        print('\n'.join(errs[:8]) or 'no errors')
        await b.close()
asyncio.run(main())
