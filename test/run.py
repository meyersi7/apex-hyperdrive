import asyncio, sys, json, os
from playwright.async_api import async_playwright
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__))).replace(os.sep,'/')
NM=f'{ROOT}/vendor/node_modules/three'
async def route(r):
    u=r.request.url
    if 'cdn.jsdelivr.net/npm/three@0.160.0/' in u:
        rel=u.split('three@0.160.0/')[1]
        await r.fulfill(path=f'{NM}/{rel}', content_type='application/javascript'); return
    if 'fonts.googleapis' in u or 'fonts.gstatic' in u:
        await r.fulfill(body='', content_type='text/css'); return
    await r.continue_()
async def main(mode):
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path=os.environ.get('CHROME','/usr/bin/google-chrome'), args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'])
        pg=await b.new_page(screen={'width':1920,'height':1080}, viewport={'width':1280,'height':720})
        errs=[]
        pg.on('console', lambda m: errs.append(f'{m.type}: {m.text}') if m.type in ('error','warning') else None)
        pg.on('pageerror', lambda e: errs.append(f'PAGEERROR: {e}'))
        await pg.route('**/*', route)
        await pg.goto('file://'+ROOT+'/dist/index.html')
        await pg.wait_for_function('window.__apex && window.__apex.mode==="intro"', timeout=60000)
        os.makedirs(f'{ROOT}/test/shots', exist_ok=True)
        if mode=='intro':
            for t in [1.2, 3.9, 6.2]:
                await pg.evaluate(f'''() => {{ }}''')
                # wait until intro time >= t
                await pg.wait_for_timeout(100)
                for _ in range(200):
                    cur = await pg.evaluate('() => document.querySelector("#introTitle") ? 1 : 0')
                    break
            # use real time
            for i,t in enumerate([1.3, 3.9, 6.3]):
                await pg.wait_for_timeout(int(1000*(t - (0 if i==0 else [1.3,3.9,6.3][i-1]))))
                await pg.screenshot(path=f'{ROOT}/test/shots/intro{i+1}.png')
            await pg.wait_for_function('window.__apex.mode==="menu"', timeout=20000)
            await pg.wait_for_timeout(1500)
            await pg.screenshot(path=f'{ROOT}/test/shots/menu.png')
        print('\n'.join(errs[:30]) or 'no errors')
        await b.close()
if __name__=="__main__": asyncio.run(main(sys.argv[1] if len(sys.argv)>1 else 'intro'))
