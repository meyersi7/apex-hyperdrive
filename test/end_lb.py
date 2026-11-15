import os
import asyncio, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from playwright.async_api import async_playwright
from run import route, ROOT
from race import ARGS
from endless import AUTO_E
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path=os.environ.get('CHROME','/usr/bin/google-chrome'), args=ARGS)
        pg=await b.new_page(screen={'width':1920,'height':1080}, viewport={'width':1100,'height':700}); errs=[]
        pg.on('pageerror', lambda e: errs.append(f'PAGEERROR: {e}'))
        pg.on('console', lambda m: errs.append(f'{m.type}: {m.text}') if m.type=='error' else None)
        await pg.route('**/*', route)
        await pg.goto('file://'+ROOT+'/dist/index.html')
        await pg.wait_for_function('window.__apex && window.__apex.mode==="intro"', timeout=90000)
        await pg.evaluate(AUTO_E)
        await pg.evaluate('() => { __apex.endIntro(); __apex.selCar=1; __apex.selTrack=2; __apex.selMode="endless"; __apex.selTyre=0; __apex.beginRace(); }')
        await pg.wait_for_function('window.__apex.mode==="race" && window.__apex.race', timeout=90000)
        await pg.evaluate('() => __apex.setMode("test")')
        r = await pg.evaluate('() => { __driveE(60*14, 1/60, {}); __apex.race.end.left = 0.5; return __driveE(60, 1/60, {}); }')
        print('over', r['over'], r['dist'])
        await pg.wait_for_timeout(3000)
        await pg.fill('#nameIn', 'Simon'); await pg.click('#saveBtn'); await pg.wait_for_timeout(700)
        await pg.screenshot(path=f'{ROOT}/test/shots/end_lb.png')
        print('rows', await pg.evaluate('document.querySelectorAll("#lbBody tr").length'), 'best', await pg.evaluate('localStorage.getItem("apex_end_best_tokyo")'))
        await pg.evaluate('() => document.getElementById("lbClose").click()')
        await pg.evaluate('() => __apex.setMode("race")'); print('pre', await pg.evaluate('() => [document.activeElement.tagName, document.activeElement.id, __apex.mode, __apex.race.resultsShown, __apex.race.t]')); await pg.keyboard.press('r'); await pg.wait_for_timeout(4000); print('post', await pg.evaluate('() => [__apex.mode, __apex.race.t, __apex.race.state, __apex.race.resultsShown, document.getElementById("loading").style.display]'))
        print('restart ok:', await pg.evaluate('() => __apex.race && __apex.race.mode + " " + __apex.race.state + " " + __apex.race.end.best'))
        print(errs[:6] or 'no errors')
        await b.close()
asyncio.run(main())
