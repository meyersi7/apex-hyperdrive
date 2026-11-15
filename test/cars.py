import os
import asyncio, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from playwright.async_api import async_playwright
from run import route, ROOT
ARGS=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path=os.environ.get('CHROME','/usr/bin/google-chrome'), args=ARGS)
        pg=await b.new_page(screen={'width':1920,'height':1080}, viewport={'width':800,'height':450})
        errs=[]
        pg.on('pageerror', lambda e: errs.append(f'PAGEERROR: {e}'))
        pg.on('console', lambda m: errs.append(f'{m.type}: {m.text}') if m.type=='error' else None)
        await pg.route('**/*', route)
        await pg.goto('file://'+ROOT+'/dist/index.html')
        await pg.wait_for_function('window.__apex && window.__apex.mode==="intro"', timeout=90000)
        await pg.evaluate('() => __apex.gfxLock()')
        await pg.evaluate('() => { __apex.endIntro(); __apex.setMode("test"); document.getElementById("menu").classList.remove("on"); }')
        views = {'q':(3.6,1.5,4.2,0,0.6,0.3), 'r':(-3.4,1.6,-4.3,0,0.7,-0.3), 's':(6.5,0.8,0.01,0,0.65,0)}
        for ci in range(4):
            await pg.evaluate(f'() => {{ const s=__apex.show; s.cars.forEach((c,i)=>c.visible=i==={ci}); s.table.rotation.y=0; }}')
            for k,v in views.items():
                await pg.evaluate(f'() => __apex.shot({",".join(map(str,v))})')
                await pg.screenshot(path=f'{ROOT}/test/shots/car{ci}{k}.png')
        print('\n'.join(errs) or 'no errors')
        await b.close()
asyncio.run(main())
