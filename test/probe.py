import os
import asyncio, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from playwright.async_api import async_playwright
from run import route, ROOT
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path=os.environ.get('CHROME','/usr/bin/google-chrome'), args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'])
        pg=await b.new_page(screen={'width':1920,'height':1080}, viewport={'width':1280,'height':720})
        errs=[]
        pg.on('console', lambda m: errs.append(f'{m.type}: {m.text}') if m.type in ('error','warning') else None)
        pg.on('pageerror', lambda e: errs.append(f'PAGEERROR: {e}'))
        await pg.route('**/*', route)
        await pg.goto('file://'+ROOT+'/dist/index.html')
        await pg.wait_for_function('window.__apex && window.__apex.mode==="intro"', timeout=60000)
        await pg.evaluate('''() => { window.__fc=0; const f=()=>{window.__fc++; requestAnimationFrame(f)}; requestAnimationFrame(f); }''')
        await pg.wait_for_timeout(5000)
        print('frames in 5s', await pg.evaluate('window.__fc'))
        print('\n'.join(errs[:30]) or 'no errors')
        await b.close()
asyncio.run(main())
