import os
import asyncio, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from playwright.async_api import async_playwright
from run import route, ROOT
from race import ARGS
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path=os.environ.get('CHROME','/usr/bin/google-chrome'), args=ARGS)
        for name, vp in [('im_land', {'width':844,'height':390})]:
            ctx = await b.new_context(viewport=vp, is_mobile=True, has_touch=True)
            pg = await ctx.new_page(); errs=[]
            pg.on('pageerror', lambda e: errs.append(f'PAGEERROR: {e}'))
            await pg.route('**/*', route)
            await pg.goto('file://'+ROOT+'/dist/index.html')
            await pg.wait_for_function('window.__apex && window.__apex.mode==="intro"', timeout=90000)
            await pg.evaluate('() => __apex.gfxLock()')
            await pg.evaluate('() => __apex.setMode("test")')
            await pg.evaluate('() => __apex.introSim(3.5)')
            await pg.wait_for_timeout(1200)
            await pg.screenshot(path=f'{ROOT}/test/shots/{name}.png')
            print(name, errs or 'no errors'); await ctx.close()
        await b.close()
asyncio.run(main())
