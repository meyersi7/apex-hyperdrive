import os
import asyncio, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from playwright.async_api import async_playwright
from run import route, ROOT
from race import AUTO, ARGS
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path=os.environ.get('CHROME','/usr/bin/google-chrome'), args=ARGS)
        pg=await b.new_page(screen={'width':1920,'height':1080}, viewport={'width':640,'height':360}); errs=[]
        pg.on('pageerror', lambda e: errs.append(f'PAGEERROR: {e}'))
        pg.on('console', lambda m: errs.append(f'{m.type}: {m.text}') if m.type=='error' else None)
        await pg.route('**/*', route)
        await pg.goto('file://'+ROOT+'/dist/index.html')
        await pg.wait_for_function('window.__apex && window.__apex.mode==="intro"', timeout=60000)
        await pg.evaluate(AUTO)
        await pg.click('#skipBtn')
        await pg.wait_for_function('window.__apex.mode==="menu"', timeout=20000)
        for tr in range(3):
            for car in range(4):
                await pg.evaluate(f'() => {{ __apex.selCar={car}; __apex.selTrack={tr}; __apex.beginRace(); }}')
                await pg.wait_for_function('window.__apex.mode==="race" && window.__apex.race && window.__apex.race.trackIdx==%d && window.__apex.race.carIdx==%d' % (tr, car), timeout=60000)
                await pg.evaluate('() => __apex.setMode("test")')
                r = await pg.evaluate('() => __drive(500, 1/30, {nitro:true})')
                bad = [k for k,v in r.items() if isinstance(v,(int,float)) and v!=v]
                print(tr, car, r['state'], 't', r['t'], 'v', r['v'], 'hp', r['hp'], 'place', r['place'], 'coins', r['coins'], 'NaN' if bad else '')
                await pg.evaluate('() => { __apex.toMenu(); }')
        # pause / resume / menu flows via real clicks
        await pg.evaluate('() => { __apex.selCar=0; __apex.selTrack=0; }')
        await pg.click('#startBtn')
        await pg.wait_for_function('window.__apex.mode==="race" && window.__apex.race', timeout=60000)
        await pg.click('#pauseBtn'); st1 = await pg.evaluate('__apex.race.state')
        await pg.click('#resumeBtn'); st2 = await pg.evaluate('__apex.race.state')
        await pg.click('#pauseBtn'); await pg.click('#menuBtn'); st3 = await pg.evaluate('__apex.mode')
        await pg.click('#lbBtn'); lb = await pg.evaluate('document.querySelectorAll("#lbBody tr").length')
        print('flows', st1, st2, st3, 'lb rows', lb)
        print('\n'.join(errs) or 'no errors')
        await b.close()
asyncio.run(main())
