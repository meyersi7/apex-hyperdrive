import asyncio, sys, json, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from playwright.async_api import async_playwright
from run import route, ROOT
from race import ARGS
from line import DRV
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path=os.environ.get('CHROME','/usr/bin/google-chrome'), args=ARGS)
        pg=await b.new_page(screen={'width':1920,'height':1080}, viewport={'width':1366,'height':768}); errs=[]
        pg.on('pageerror', lambda e: errs.append(f'PAGEERROR: {e}'))
        pg.on('console', lambda m: errs.append(f'{m.type}: {m.text}') if m.type=='error' else None)
        await pg.route('**/*', route)
        await pg.goto('file://'+ROOT+'/dist/index.html')
        await pg.wait_for_function('window.__apex && window.__apex.mode==="intro"', timeout=90000)
        await pg.evaluate(DRV)
        await pg.evaluate('() => { __apex.endIntro(); __apex.selCar=1; __apex.selTrack=0; __apex.selMode="endless"; __apex.selTyre=1; __apex.beginRace(); }')
        await pg.wait_for_function('window.__apex.mode==="race" && window.__apex.race', timeout=90000)
        await pg.evaluate('() => __apex.setMode("test")')
        async def shot(name, js):
            info = await pg.evaluate(js); await pg.evaluate('() => __apex.render()'); await pg.screenshot(path=f'{ROOT}/test/shots/v12_{name}.png'); print(name, info)
        base = 'const A=__apex, r=A.race, E=r.end, p=r.player; const keep=()=>{ E.left=60; p.health=Math.max(p.health,60); E.pit.phase="idle"; };'
        await shot('grid', '() => { '+base+' A.step(1/60, 150); let m=0, tris=0; r.scene.traverse(o => { if (o.isMesh && o.visible) { m++; const g=o.geometry; tris += (g.index ? g.index.count : g.attributes.position.count)/3; } }); return {cars:r.cars.length, meshes:m, tris:Math.round(tris), names:r.ais.map(a=>a.name).join(",")}; }')
        await shot('fc', '() => { '+base+' for (let i=0;i<60*80 && !E.fc;i++){ keep(); __driveL(1,1/60); } for (let i=0;i<60*6;i++){ keep(); __driveL(1,1/60); } return {t:+E.time.toFixed(0), fc:E.fc && {to:E.fc.to, prob:E.fc.prob, in:+(E.fc.t-E.time).toFixed(0)}, place:p.place, sec:p.sec.col.join("")}; }')
        for name, secs in [('rain06', 6), ('rain20', 14), ('rain45', 25), ('rain90', 45)]:
            await shot(name, '() => { '+base+f' E.events=[]; E.fc=null; E.wx=2; for (let i=0;i<60*{secs};i++){{ keep(); __driveL(1,1/60); }} return {{rain:+E.rain.toFixed(2), wet:+E.wet.toFixed(2), pud:+E.pud.toFixed(2), fxQ:E.fxQ, grip:+r.gripMul.toFixed(2), wag:+(p.visYaw*57.3).toFixed(1), place:p.place, spray:E.spray.p.length, splash:E.splash.p.length, sec:p.sec.col.join("")}}; }}')
        await shot('dry', '() => { '+base+' E.wx=0; for (let i=0;i<60*70;i++){ keep(); __driveL(1,1/60); } return {rain:+E.rain.toFixed(2), wet:+E.wet.toFixed(2), pud:+E.pud.toFixed(2), sec:p.sec.col.join(""), laps:p.lapsDone}; }')
        print(errs[:6] or 'no errors'); await b.close()
if __name__ == "__main__": asyncio.run(main())
