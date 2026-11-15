import asyncio, sys, json, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from playwright.async_api import async_playwright
from run import route, ROOT
from race import AUTO, ARGS
TR=int(sys.argv[1]) if len(sys.argv)>1 else 0; CAR=int(sys.argv[2]) if len(sys.argv)>2 else 0; DIFF=os.environ.get('DIFF','1'); MODE=sys.argv[3] if len(sys.argv)>3 else 'lap'
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path=os.environ.get('CHROME','/usr/bin/google-chrome'), args=ARGS)
        pg=await b.new_page(screen={'width':1920,'height':1080}, viewport={'width':480,'height':270}); errs=[]
        pg.on('pageerror', lambda e: errs.append(f'PAGEERROR: {e}'))
        pg.on('console', lambda m: errs.append(f'{m.type}: {m.text}') if m.type=='error' else None)
        await pg.route('**/*', route)
        await pg.goto('file://'+ROOT+'/dist/index.html')
        await pg.wait_for_function('window.__apex && window.__apex.mode==="intro"', timeout=90000)
        await pg.evaluate(AUTO)
        await pg.evaluate(f'() => {{ __apex.endIntro(); __apex.selCar={CAR}; __apex.selTrack={TR}; __apex.selDiff={DIFF}; __apex.beginRace(); }}')
        await pg.wait_for_function('window.__apex.mode==="race" && window.__apex.race', timeout=90000)
        await pg.evaluate('() => __apex.setMode("test")')
        if MODE=='step':
            res = await pg.evaluate('''() => { const A=__apex, out=[]; __drive(150,1/60);
              for (const target of [30, 60, 90]) {
                const r=A.race, p=r.player; 
                for (let i=0;i<3000 && p.speed<target;i++) __drive(1,1/60,{lat:0});
                A.input.gas=true; A.input.brake=false; A.input.left=false; A.input.right=true;
                let maxB=0,maxR=0; for (let i=0;i<30;i++){ A.step(1/60,1); maxB=Math.max(maxB,Math.abs(Math.atan2(p.vlat,p.speed))); maxR=Math.max(maxR,Math.abs(p.yawRate)); }
                const ay = p.ay, lat1=p.lat; A.input.right=false;
                for (let i=0;i<60;i++){ A.step(1/60,1); }
                out.push({target, v:+p.speed.toFixed(1), maxBeta:+maxB.toFixed(3), maxYaw:+maxR.toFixed(2), ay:+ay.toFixed(1), grip:+p.phys.grip.toFixed(1), betaAfter:+Math.atan2(p.vlat,p.speed).toFixed(3), yawAfter:+p.yawRate.toFixed(3), lat1:+lat1.toFixed(1), lat2:+p.lat.toFixed(1)});
                for (let i=0;i<240;i++) __drive(1,1/60,{lat:0, maxv:20});
              }
              // acceleration run
              const r=A.race,p=r.player; for (let i=0;i<600;i++) __drive(1,1/60,{lat:0,maxv:1}); 
              const acc=[]; let t=0; const marks=[27.8,55.6,83.3]; let mi=0; A.input.left=A.input.right=false;
              for (let i=0;i<1500 && mi<3;i++){ A.input.gas=true; A.input.brake=false; A.step(1/60,1); t+=1/60; if (p.speed>=marks[mi]) { acc.push(+t.toFixed(2)); mi++; } }
              return {out, acc, s:+p.s.toFixed(0)}; }''')
            print(json.dumps(res))
        else:
            log=[]
            for k in range(140):
                r = await pg.evaluate('() => { const o=__drive(120, 1/60, {nitro:true}); const p=__apex.race.player; o.slip=+p.slipR.toFixed(2); o.vl=+p.vlat.toFixed(1); return o; }')
                if k<12 or r['laps']>=1 and len(log)<1: pass
                log.append((r['t'], r['s'], r['v'], r['lat'], r['slip'], r['hp'], r['laps']))
                if r['laps']>=(4 if TR==1 else 3) or r['wrecked'] or r['state'] not in ('race','countdown'): break
            for x in log[::6]: print(x)
            print('END', {k:r[k] for k in ['state','t','place','laps','best','hp','coins','wrecked']}, [(a['n'],a['prog'],a['fin']) for a in r['ais']], 'L', r['L'])
        print('\n'.join(errs[:10]) or 'no errors')
        await b.close()
asyncio.run(main())
