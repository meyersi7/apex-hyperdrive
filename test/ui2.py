import os
import asyncio, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from playwright.async_api import async_playwright
from run import route, ROOT
from race import AUTO, ARGS
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path=os.environ.get('CHROME','/usr/bin/google-chrome'), args=ARGS)
        pg=await b.new_page(screen={'width':1920,'height':1080}, viewport={'width':1100,'height':620})
        errs=[]
        pg.on('pageerror', lambda e: errs.append(f'PAGEERROR: {e}'))
        pg.on('console', lambda m: errs.append(f'{m.type}: {m.text}') if m.type=='error' else None)
        await pg.route('**/*', route)
        await pg.goto('file://'+ROOT+'/dist/index.html')
        await pg.wait_for_function('window.__apex && window.__apex.mode==="intro"', timeout=60000)
        await pg.evaluate(AUTO)
        await pg.evaluate('() => { __apex.endIntro(); }')
        await pg.wait_for_timeout(4000)
        await pg.evaluate('() => { __apex.selDiff = 2; document.querySelectorAll("#diffSeg button")[2].click(); }')
        await pg.wait_for_timeout(1500)
        await pg.screenshot(path=f'{ROOT}/test/shots/menu.png')
        await pg.evaluate('() => { __apex.selCar=1; __apex.selTrack=0; __apex.beginRace(); }')
        await pg.wait_for_function('window.__apex.mode==="race" && window.__apex.race', timeout=60000)
        await pg.evaluate('() => __apex.setMode("test")')
        await pg.evaluate('() => __drive(140, 1/30)')
        # air shot with new camera
        for _ in range(400):
            r = await pg.evaluate('() => __drive(8, 1/30, {lat:0})')
            if r['air']: break
        await pg.evaluate('() => __drive(6, 1/30, {lat:0})')
        await pg.evaluate('() => { __apex.step(0.001,1); __apex.render(); }')
        await pg.screenshot(path=f'{ROOT}/test/shots/air2.png')
        await pg.evaluate('() => { const r=__apex.race; r.player.progress = r.laps*r.td.L - 120; r.player.lapsDone = r.laps-1; r.player.bestLap = 54.3; }')
        await pg.evaluate('() => __drive(150, 1/30)')
        await pg.wait_for_timeout(3500)
        await pg.screenshot(path=f'{ROOT}/test/shots/results.png')
        await pg.fill('#nameIn', 'Silvio')
        await pg.click('#saveBtn')
        await pg.wait_for_timeout(800)
        await pg.screenshot(path=f'{ROOT}/test/shots/lb.png')
        print('\n'.join(errs) or 'no errors')
        await b.close()
        # mobile
        ctx = await b.new_context(viewport={'width':844,'height':390}, is_mobile=True, has_touch=True, device_scale_factor=1) if False else None
asyncio.run(main())
