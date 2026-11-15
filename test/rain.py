import asyncio, sys, json, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from playwright.async_api import async_playwright
from run import route, ROOT
from race import ARGS
from endless import AUTO_E
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path=os.environ.get('CHROME','/usr/bin/google-chrome'), args=ARGS)
        pg=await b.new_page(screen={'width':1920,'height':1080}, viewport={'width':960,'height':540}); errs=[]
        pg.on('pageerror', lambda e: errs.append(f'PAGEERROR: {e}'))
        pg.on('console', lambda m: errs.append(f'{m.type}: {m.text}') if m.type=='error' else None)
        await pg.route('**/*', route)
        await pg.goto('file://'+ROOT+'/dist/index.html')
        await pg.wait_for_function('window.__apex && window.__apex.mode==="intro"', timeout=90000)
        await pg.evaluate(AUTO_E)
        for i,t in enumerate([1.2, 2.6, 4.2]):
            await pg.evaluate(f'() => __apex.introSim({t})'); await pg.wait_for_timeout(700)
            await pg.screenshot(path=f'{ROOT}/test/shots/in{i}.png')
        await pg.evaluate('() => { __apex.setMode("intro"); __apex.endIntro(); __apex.selCar=0; __apex.selTrack=int_tr; __apex.selMode="endless"; __apex.selTyre=1; __apex.beginRace(); }'.replace('int_tr', sys.argv[1] if len(sys.argv)>1 else '0'))
        await pg.wait_for_function('window.__apex.mode==="race" && window.__apex.race', timeout=90000)
        await pg.evaluate('() => __apex.setMode("test")')
        r = await pg.evaluate('''() => { const A=__apex, r=A.race, E=r.end; for (let i=0;i<60*16;i++) { E.events=[]; E.wx=2; E.rain=1; E.wet=1; E.tyre=3; E.cond=0.9; E.left=60; __driveE(1,1/60,{nopit:true}); } A.step(0.001,1); A.render(); return {v:r.player.speed*3.6, spray:E.spray.p.length, splash:E.splash.p.length, eng: !!A.sfx}; }''')
        await pg.wait_for_timeout(400); await pg.screenshot(path=f'{ROOT}/test/shots/rain_a.png')
        await pg.evaluate('''() => { const A=__apex, r=A.race, E=r.end; r.camMode=0; for (let i=0;i<60*5;i++) { E.wx=2; E.rain=1; E.wet=1; E.left=60; __driveE(1,1/60,{nopit:true}); } A.step(0.001,1); A.render(); }''')
        await pg.wait_for_timeout(400); await pg.screenshot(path=f'{ROOT}/test/shots/rain_b.png')
        print(r, errs[:6] or 'no errors')
        await b.close()
asyncio.run(main())
