import asyncio, sys, json, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from playwright.async_api import async_playwright
from run import route, ROOT
from race import ARGS
from line import DRV
async def one(b, track, car, wet, tyre, cond, rp=None):
    rp = rp or {}
    pg=await b.new_page(screen={'width':1920,'height':1080}, viewport={'width':480,'height':270}); errs=[]
    pg.on('pageerror', lambda e: errs.append(f'PAGEERROR: {e}'))
    await pg.route('**/*', route)
    await pg.goto('file://'+ROOT+'/dist/index.html')
    await pg.wait_for_function('window.__apex && window.__apex.mode==="intro"', timeout=90000)
    await pg.evaluate(DRV)
    await pg.evaluate(f'() => {{ __apex.endIntro(); __apex.selCar={car}; __apex.selTrack={track}; __apex.selMode="endless"; __apex.selTyre=1; __apex.beginRace(); }}')
    await pg.wait_for_function('window.__apex.mode==="race" && window.__apex.race', timeout=90000)
    await pg.evaluate('() => __apex.setMode("test")')
    r = await pg.evaluate(f'''() => {{ const A=__apex, r=A.race, E=r.end, p=r.player, td=r.td; window.__aggr = {json.dumps(rp)}.aggr || 0; Object.assign(A.RAINP, {json.dumps(rp)}); let hp=100; const ev=[], tr=[];
      r.line.always = true;
      for (let i=0;i<60*150;i++) {{ E.events=[]; E.wx={2 if wet else 0}; E.rain={wet}; E.wet={wet}; E.tyre={tyre}; E.cond={cond}; E.left=60; p.health=Math.max(p.health,50); E.pit.phase='idle';
        __driveL(1,1/60); const row=[Math.round(td.wrap(p.s)), Math.round(p.speed*3.6), Math.round(r.line.lim*3.6), +p.lat.toFixed(1), +(p.lat-td.idealAt(p.s)).toFixed(1), +(p.beta*57.3).toFixed(0), A.input.brake?'B':A.input.gas?'G':'-', p.offroad?'OFF':''];
        if (hp-p.health>1.5) ev.push(['HIT', (hp-p.health).toFixed(0), ...row]); hp=p.health; if (i%20===0) tr.push(row.join(' '));
        if (p.lapsDone>=1) break; }}
      return {{ev, tr, lap:p.lapTimes[0]}}; }}''')
    print(r['lap']); print('\n'.join(str(e) for e in r['ev']));
    if os.environ.get('TR'): print('\n'.join(r['tr']))
    await pg.close()
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path=os.environ.get('CHROME','/usr/bin/google-chrome'), args=ARGS)
        await one(b,*json.loads(sys.argv[1]))
        await b.close()
if __name__ == "__main__": asyncio.run(main())
