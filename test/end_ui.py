import asyncio, sys, json, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from playwright.async_api import async_playwright
from run import route, ROOT
from race import ARGS
from endless import AUTO_E
async def run(b, name, ctxargs, mobile):
    ctx = await b.new_context(**ctxargs); pg = await ctx.new_page(); errs=[]
    pg.on('pageerror', lambda e: errs.append(f'PAGEERROR: {e}'))
    pg.on('console', lambda m: errs.append(f'{m.type}: {m.text}') if m.type=='error' else None)
    await pg.route('**/*', route)
    await pg.goto('file://'+ROOT+'/dist/index.html')
    await pg.wait_for_function('window.__apex && window.__apex.mode==="intro"', timeout=90000)
    await pg.evaluate(AUTO_E)
    await pg.evaluate('() => { localStorage.setItem("apex_end_best_alps","1500"); __apex.endIntro(); }')
    await pg.wait_for_timeout(1500)
    await pg.evaluate('() => { document.querySelectorAll("#modeSeg button")[1].click(); }')
    await pg.wait_for_timeout(1200)
    await pg.screenshot(path=f'{ROOT}/test/shots/{name}_menu.png')
    await pg.evaluate('() => { __apex.selCar=2; __apex.selTrack=0; __apex.beginRace(); }')
    await pg.wait_for_function('window.__apex.mode==="race" && window.__apex.race', timeout=90000)
    await pg.evaluate('() => __apex.setMode("test")')
    for k in range(300):
        r = await pg.evaluate('() => __driveE(20, 1/60, {})')
        if r['dist'] > 1385: break
    await pg.evaluate('() => { __apex.step(0.001,1); __apex.render(); }'); await pg.wait_for_timeout(350)
    await pg.screenshot(path=f'{ROOT}/test/shots/{name}_rec.png')
    if mobile:
        await pg.evaluate('() => { const E=__apex.race.end; E.pit.phase="choose"; E.pit.t=0.4; E.pit.pick=-1; document.getElementById("pitUI").classList.add("on"); }')
        await pg.wait_for_timeout(300); await pg.screenshot(path=f'{ROOT}/test/shots/{name}_pit.png')
    print(name, r['dist'], errs[:5] or 'no errors'); await ctx.close()
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path=os.environ.get('CHROME','/usr/bin/google-chrome'), args=ARGS)
        await run(b, 'ed', dict(screen={'width':1920,'height':1080}, viewport={'width':1100,'height':620}), False)
        await run(b, 'em', dict(viewport={'width':844,'height':390}, is_mobile=True, has_touch=True), True)
        await b.close()
if __name__ == '__main__': asyncio.run(main())
