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
        await pg.route('**/*', route)
        await pg.goto('file://'+ROOT+'/dist/index.html')
        await pg.wait_for_function('window.__apex && window.__apex.mode==="intro"', timeout=60000)
        await pg.evaluate(AUTO)
        await pg.evaluate('() => { __apex.endIntro(); __apex.selCar=3; __apex.selTrack=1; __apex.beginRace(); }')
        await pg.wait_for_function('window.__apex.mode==="race" && window.__apex.race', timeout=60000)
        await pg.evaluate('() => __apex.setMode("test")')
        print(await pg.evaluate('''() => { const gl = document.getElementById('gl').getContext('webgl2'); return { depth: gl.getParameter(gl.DEPTH_BITS), hp: gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER, gl.HIGH_FLOAT).precision, dpr: devicePixelRatio }; }'''))
        await pg.evaluate('() => __drive(400, 1/30)')
        await pg.evaluate('() => { __apex.step(0.001,1); __apex.render(); }')
        await pg.screenshot(path=f'{ROOT}/test/shots/m_dbg1.png')
        print(await pg.evaluate('() => { const r=__apex.race,p=r.player; return [p.s,p.lat,p.x,p.z,p.y, __apex.camera.position.toArray(), __apex.camera.near, __apex.camera.far]; }'))
        print(errs)
        await b.close()
asyncio.run(main())
