import os
import asyncio, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from playwright.async_api import async_playwright
from run import route, ROOT
from race import ARGS
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path=os.environ.get('CHROME','/usr/bin/google-chrome'), args=ARGS)
        pg=await b.new_page(screen={'width':1920,'height':1080}, viewport={'width':1100,'height':620}); errs=[]
        pg.on('pageerror', lambda e: errs.append(f'PAGEERROR: {e}'))
        await pg.route('**/*', route)
        await pg.goto('file://'+ROOT+'/dist/index.html')
        await pg.wait_for_function('window.__apex && window.__apex.mode==="intro"', timeout=90000)
        await pg.evaluate('() => __apex.gfxLock()')
        await pg.evaluate('() => __apex.setMode("test")')
        for i,t in enumerate([1.6, 3.8, 5.6, 6.9]):
            await pg.evaluate(f'() => __apex.introSim({t})')
            await pg.wait_for_timeout(1000)
            await pg.screenshot(path=f'{ROOT}/test/shots/intro_c{i+1}.png')
        print(errs or 'no errors')
        await b.close()
asyncio.run(main())
