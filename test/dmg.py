import asyncio, sys, json, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from playwright.async_api import async_playwright
from run import route, ROOT
from race import AUTO, ARGS
TR=int(sys.argv[1]); CAR=int(sys.argv[2]); LAP=int(os.environ.get('LAP','0'))
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path=os.environ.get('CHROME','/usr/bin/google-chrome'), args=ARGS)
        pg=await b.new_page(screen={'width':1920,'height':1080}, viewport={'width':480,'height':270})
        await pg.route('**/*', route)
        await pg.goto('file://'+ROOT+'/dist/index.html')
        await pg.wait_for_function('window.__apex && window.__apex.mode==="intro"', timeout=90000)
        await pg.evaluate(AUTO)
        await pg.evaluate(f'() => {{ __apex.endIntro(); __apex.selCar={CAR}; __apex.selTrack={TR}; __apex.selDiff=1; __apex.beginRace(); }}')
        await pg.wait_for_function('window.__apex.mode==="race" && window.__apex.race', timeout=90000)
        await pg.evaluate('() => __apex.setMode("test")')
        res = await pg.evaluate('''() => { const A=__apex, ev=[]; let hp=100; const r=A.race, p=r.player, td=r.td; const trace=[];
          for (let i=0;i<60*140;i++){ const s0=p.s, l0=p.lat, v0=p.speed; __drive(1,1/60,{nitro:true}); 
            if (i%6===0) trace.push([p.lapsDone, +p.s.toFixed(0), +(p.speed*3.6).toFixed(0), +p.lat.toFixed(1), +p.slipR.toFixed(2), +(p.ay||0).toFixed(0), A.input.brake?1:0, A.input.left?-1:A.input.right?1:0, +p.yawRate.toFixed(2), +p.vlat.toFixed(1), p.airborne?1:0, p.nitroOn?1:0]);
            if (hp - p.health > 1.5) { ev.push({i, s:+s0.toFixed(0), lat:+l0.toFixed(1), v:+(v0*3.6).toFixed(0), d:+(hp-p.health).toFixed(1), K:+(1/Math.max(1e-4,Math.abs(td.K[td.idx(s0)]))).toFixed(0), obs: td.obstacles.filter(o=>Math.abs(o.s-s0)<12).map(o=>o.lat.toFixed(1))}); }
            hp=p.health; if (p.lapsDone>=2) break; }
          return {ev, lap:p.lapTimes, ramps: td.ramps.map(x=>[+x.s.toFixed(0),x.lat]), trace}; }''')
        print('events', json.dumps(res['ev'])); print('lap', res['lap'], 'ramps', res['ramps'])
        if len(sys.argv)>3:
            a,bb=map(int,sys.argv[3].split('-'))
            for t in res['trace']:
                if t[0]==LAP and a<=t[1]<=bb: print(t)
        await b.close()
asyncio.run(main())
