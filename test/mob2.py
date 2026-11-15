import os
import asyncio, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from playwright.async_api import async_playwright
from run import route, ROOT
from race import ARGS
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path=os.environ.get('CHROME','/usr/bin/google-chrome'), args=ARGS)
        for name, vp, mob in [('m_menu2', {'width':844,'height':390}, True), ('d_menu2', {'width':1100,'height':620}, False)]:
            ctx = await b.new_context(viewport=vp, is_mobile=mob, has_touch=mob)
            pg = await ctx.new_page(); errs=[]
            pg.on('pageerror', lambda e: errs.append(f'PAGEERROR: {e}'))
            await pg.route('**/*', route)
            await pg.goto('file://'+ROOT+'/dist/index.html')
            await pg.wait_for_function('window.__apex && window.__apex.mode==="intro"', timeout=60000)
            await pg.click('#skipBtn')
            await pg.wait_for_timeout(3000)
            await pg.screenshot(path=f'{ROOT}/test/shots/{name}.png')
            if not mob:
                await pg.click('#lbBtn'); await pg.wait_for_timeout(500)
                await pg.screenshot(path=f'{ROOT}/test/shots/lb2.png')
            print(name, errs or 'no errors')
            await ctx.close()
        await b.close()
asyncio.run(main())
