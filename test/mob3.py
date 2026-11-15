import os
import asyncio, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from playwright.async_api import async_playwright
from run import route, ROOT
from race import AUTO, ARGS
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path=os.environ.get('CHROME','/usr/bin/google-chrome'), args=ARGS)
        ctx = await b.new_context(viewport={'width':844,'height':390}, is_mobile=True, has_touch=True)
        pg = await ctx.new_page(); errs=[]
        pg.on('pageerror', lambda e: errs.append(f'PAGEERROR: {e}'))
        pg.on('console', lambda m: errs.append(f'{m.type}: {m.text}') if m.type=='error' else None)
        await pg.route('**/*', route)
        await pg.goto('file://'+ROOT+'/dist/index.html')
        await pg.wait_for_function('window.__apex && window.__apex.mode==="intro"', timeout=90000)
        await pg.evaluate(AUTO)
        await pg.evaluate('() => { __apex.endIntro(); __apex.selCar=2; __apex.selTrack=0; __apex.beginRace(); }')
        await pg.wait_for_function('window.__apex.mode==="race" && window.__apex.race', timeout=90000)
        await pg.evaluate('() => __apex.setMode("test")')
        await pg.evaluate('() => __drive(900, 1/60)')
        await pg.evaluate('() => { __apex.step(0.001,1); __apex.render(); }')
        await pg.wait_for_timeout(300)
        await pg.screenshot(path=f'{ROOT}/test/shots/m_race3.png')
        print('gfx', await pg.evaluate('() => JSON.stringify(__apex.gfx)'), errs or 'no errors')
        await b.close()
asyncio.run(main())
