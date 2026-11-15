import os
import asyncio, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from playwright.async_api import async_playwright
from run import route, ROOT
from race import ARGS
async def one(b, name, vw, vh, touch=False):
    ctx = await b.new_context(screen={'width':1920,'height':1080}, viewport={'width':vw,'height':vh}, has_touch=touch, is_mobile=touch)
    pg=await ctx.new_page(); errs=[]
    pg.on('pageerror', lambda e: errs.append(f'PAGEERROR: {e}'))
    await pg.route('**/*', route)
    await pg.goto('file://'+ROOT+'/dist/index.html')
    await pg.wait_for_function('window.__apex && window.__apex.mode==="intro"', timeout=90000)
    await pg.evaluate('() => { __apex.gfxLock(); __apex.endIntro(); __apex.selCar=0; __apex.selTrack=1; __apex.selMode="endless"; __apex.beginRace(); }')
    await pg.wait_for_function('window.__apex.mode==="race" && window.__apex.race', timeout=90000)
    await pg.evaluate('() => { __apex.setMode("test"); const r=__apex.race, E=r.end; __apex.step(1/60, 200); E.fc={t:E.time+8, lead:40, from:0, to:2, prob:0.85, happens:true}; r.player.sec.col=[3,2,1]; r.player.sec.i=1; r.player.sec.n=5; __apex.step(1/60, 2); __apex.render(); }')
    await pg.screenshot(path=f'{ROOT}/test/shots/v12_ui_{name}.png')
    print(name, await pg.evaluate('() => ({wx:getComputedStyle(document.getElementById("wxBox")).display, row:getComputedStyle(document.getElementById("eWxRow")).display, touch:document.body.classList.contains("touchmode"), ai0:+(__apex.race.ais[4].heading-__apex.race.td.heading(__apex.race.ais[4].s)).toFixed(2)})'), errs or '')
    await ctx.close()
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path=os.environ.get('CHROME','/usr/bin/google-chrome'), args=ARGS)
        await asyncio.gather(one(b,'laptop',1280,640), one(b,'small',900,500), one(b,'phone',844,390,True))
        await b.close()
asyncio.run(main())
