import os
import asyncio, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from playwright.async_api import async_playwright
from run import route, ROOT
from race import ARGS
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path=os.environ.get('CHROME','/usr/bin/google-chrome'), args=ARGS)
        pg=await b.new_page(screen={'width':1920,'height':1080}, viewport={'width':1280,'height':720}); errs=[]
        pg.on('pageerror', lambda e: errs.append(f'PAGEERROR: {e}'))
        pg.on('console', lambda m: errs.append(f'{m.type}: {m.text}') if m.type=='error' else None)
        await pg.route('**/*', route)
        await pg.goto('file://'+ROOT+'/dist/index.html')
        await pg.wait_for_function('window.__apex && window.__apex.mode==="intro"', timeout=90000)
        await pg.evaluate('() => { __apex.gfxLock(); __apex.endIntro(); __apex.selCar=1; __apex.selTrack=0; __apex.selMode="race"; __apex.beginRace(); }')
        await pg.wait_for_function('window.__apex.mode==="race" && window.__apex.race', timeout=90000)
        await pg.wait_for_timeout(4000)
        st = lambda: pg.evaluate('() => ({on: __apex.LINE.on, vis: __apex.race.line.mesh.visible, btn: document.getElementById("lineBtn").textContent, ls: localStorage.getItem("apex_line"), state: __apex.race.state})')
        print('start', await st())
        await pg.keyboard.press('KeyL'); await pg.wait_for_timeout(2500); print('after L', await st())
        await pg.keyboard.press('KeyP'); await pg.wait_for_timeout(1500)
        await pg.screenshot(path=ROOT+'/test/shots/line_pause.png')
        await pg.click('#lineBtn'); await pg.wait_for_timeout(500); print('after btn', await st())
        await pg.keyboard.press('KeyP'); await pg.wait_for_timeout(2500); print('resumed', await st())
        await pg.evaluate('() => { __apex.toMenu(); }'); await pg.wait_for_timeout(1500)
        await pg.click('#keysBtn') if await pg.query_selector('#keysBtn') else None
        await pg.wait_for_timeout(800); await pg.screenshot(path=ROOT+'/test/shots/line_keys.png')
        print(errs[:5] or 'no errors'); await b.close()
asyncio.run(main())
