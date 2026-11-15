import os
import asyncio, sys, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from playwright.async_api import async_playwright
from run import route, ROOT
from race import AUTO, ARGS
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path=os.environ.get('CHROME','/usr/bin/google-chrome'), args=ARGS)
        pg=await b.new_page(screen={'width':1920,'height':1080}, viewport={'width':1100,'height':620}); errs=[]
        pg.on('pageerror', lambda e: errs.append(f'PAGEERROR: {e}'))
        pg.on('console', lambda m: errs.append(f'{m.type}: {m.text}') if m.type=='error' else None)
        await pg.route('**/*', route)
        await pg.goto('file://'+ROOT+'/dist/index.html')
        await pg.wait_for_function('window.__apex && window.__apex.mode==="intro"', timeout=60000)
        await pg.evaluate(AUTO)
        await pg.evaluate('() => { try{localStorage.setItem("apex_pb_alps","57400")}catch(e){}; __apex.endIntro(); __apex.selCar=0; __apex.selTrack=0; __apex.beginRace(); }')
        await pg.wait_for_function('window.__apex.mode==="race" && window.__apex.race', timeout=60000)
        await pg.evaluate('() => __apex.setMode("test")')
        for target in (1, 2):
            for _ in range(200):
                r = await pg.evaluate('() => __drive(30, 1/30, {nitro: true})')
                if r['laps'] >= target: break
            await pg.evaluate('() => __drive(8, 1/30)')
            await pg.evaluate('() => { __apex.step(0.001,1); __apex.render(); }')
            await pg.wait_for_timeout(500)
            await pg.screenshot(path=f'{ROOT}/test/shots/lap{target}.png')
            print('lap', target, await pg.evaluate('() => ({ times: __apex.race.player.lapTimes, best: __apex.race.player.bestLap, pb: __apex.race.pb })'))
        for _ in range(200):
            r = await pg.evaluate('() => __drive(60, 1/30, {nitro: true})')
            if r['laps'] >= 3: break
        await pg.wait_for_timeout(3500)
        await pg.screenshot(path=f'{ROOT}/test/shots/lapres.png')
        print('stored pb', await pg.evaluate('() => localStorage.getItem("apex_pb_alps")'))
        print('\n'.join(errs) or 'no errors')
        await b.close()
asyncio.run(main())
