import asyncio, sys, json, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from playwright.async_api import async_playwright
from run import route, ROOT
ARGS=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']
AUTO = r'''
window.__apex.gfxLock && window.__apex.gfxLock();
window.__drive = (n, dt, opts={}) => {
  const A = window.__apex, inp = A.input, wrap = (a)=>{while(a>Math.PI)a-=2*Math.PI;while(a<-Math.PI)a+=2*Math.PI;return a;};
  for (let i=0;i<n;i++) {
    const r = A.race; if (!r) break; const p = r.player, td = r.td; const v = Math.abs(p.speed);
    let tl = td.idealAt(p.s + 30); if (opts.lat !== undefined) tl = opts.lat;
    for (const o of td.obstacles) { if (o.active===false) continue; let d=o.s-p.s; if(d<-td.L/2)d+=td.L; if (d>0 && d<Math.max(90,v*2.6) && Math.abs(o.lat-tl)<4.6) tl = o.lat + (o.lat>tl?-6:6); }
    const ahead = Math.max(14, v*0.55); const q = td.at(p.s + ahead, tl);
    const des = Math.atan2(q.x - p.x, q.z - p.z); const err = wrap(des - p.heading);
    inp.left = err > 0.015; inp.right = err < -0.015;
    let tv = p.phys.vmax * 1.2;
    for (let d=0; d<=260; d+=10) { const k=Math.abs(td.K[td.idx(p.s+d)]); if (k>1e-4){ const vc=Math.sqrt(p.phys.grip*0.86/k); const al=Math.sqrt(vc*vc+2*24*d); if (al<tv) tv=al; } }
    if (opts.maxv) tv = Math.min(tv, opts.maxv);
    inp.gas = v < tv; inp.brake = v > tv + 4;
    inp.nitro = !!opts.nitro && tv > p.phys.vmax && p.nitro > 20;
    A.step(dt, 1);
  }
  const r = A.race; if (!r) return null; const p = r.player;
  return { state: r.state, t: +r.raceTime.toFixed(2), s: +p.s.toFixed(1), lat: +p.lat.toFixed(2), prog: +p.progress.toFixed(0), L: +r.td.L.toFixed(0), v: +(p.speed*3.6).toFixed(0), hp: +p.health.toFixed(1), nitro: +p.nitro.toFixed(0), place: p.place, laps: p.lapsDone, best: p.bestLap, coins: p.coins, pts: p.pts, y: +p.y.toFixed(2), air: p.airborne, wrecked: p.wrecked,
    ais: r.ais.map(a => ({ n: a.name, prog: +a.progress.toFixed(0), v: +(a.speed*3.6).toFixed(0), lat: +a.lat.toFixed(1), fin: a.finished ? +a.finishTime.toFixed(1) : null })) , ramps: r.td.ramps.map(x=>+x.s.toFixed(0)), coinsN: r.td.coins.length, obs: r.td.obstacles.length };
};
'''
async def main(track, car, shots):
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path=os.environ.get('CHROME','/usr/bin/google-chrome'), args=ARGS)
        pg=await b.new_page(screen={'width':1920,'height':1080}, viewport={'width':960,'height':540})
        errs=[]
        pg.on('pageerror', lambda e: errs.append(f'PAGEERROR: {e}'))
        pg.on('console', lambda m: errs.append(f'{m.type}: {m.text}') if m.type=='error' else None)
        await pg.route('**/*', route)
        await pg.goto('file://'+ROOT+'/dist/index.html')
        await pg.wait_for_function('window.__apex && window.__apex.mode==="intro"', timeout=60000)
        await pg.evaluate(AUTO)
        await pg.evaluate(f'() => {{ __apex.endIntro(); __apex.selCar={car}; __apex.selTrack={track}; __apex.selDiff={os.environ.get('DIFF','1')}; __apex.beginRace(); }}')
        await pg.wait_for_function('window.__apex.mode==="race" && window.__apex.race', timeout=60000)
        await pg.evaluate('() => __apex.setMode("test")')
        out = {}
        async def snap(name):
            await pg.evaluate('() => { const A=__apex; A.step(0.001,1); A.render(); }')
            await pg.screenshot(path=f'{ROOT}/test/shots/{name}.png')
        if shots: await snap(f't{track}_grid')
        r = await pg.evaluate('() => __drive(150, 1/30)')   # countdown + start
        out['start']=r
        if shots: await snap(f't{track}_start')
        if shots and len(sys.argv)>4:
            await pg.evaluate('() => { __apex.race.player.health = 40; }')
            for _ in range(30):
                r = await pg.evaluate('() => __drive(5, 1/30, {lat: 27, maxv: 48})')
                if r['s'] > 120 and r['s'] < 400: break
            await snap(f't{track}_pit'); print('pit', r['s'], r['lat'], r['hp'])
            await pg.evaluate('() => __apex.explode()')
            await pg.evaluate('() => __drive(12, 1/30)')
            await snap(f't{track}_boom')
            await pg.evaluate('() => __drive(50, 1/30)')
            await snap(f't{track}_wreck')
            print('wreck state', await pg.evaluate('() => __apex.race.state'))
            await b.close(); print('\n'.join(errs) or 'no errors'); return
        # drive until first ramp approach and capture airborne
        ramp0 = r['ramps'][0] if r['ramps'] else None
        if shots and ramp0:
            for _ in range(400):
                r = await pg.evaluate(f'() => __drive(10, 1/30, {{lat:{0}}})')
                if r['air']: break
            await snap(f't{track}_air')
        # full race (big chunks)
        for k in range(60):
            r = await pg.evaluate('() => __drive(600, 1/30, {nitro:true})')
            if r['state']!='race' or r['laps']>=99: break
            if r['wrecked']: break
            if any(a['fin'] for a in r['ais']) and r['laps']>=0 and r['prog'] >= r['L']* (4 if track==1 else 3): break
            if r['t']>600: break
        out['end']=r
        print(json.dumps(out, indent=0)[:3000])
        print('\n'.join(errs[:20]) or 'no errors')
        await b.close()
if __name__=='__main__':
    asyncio.run(main(int(sys.argv[1]), int(sys.argv[2]), len(sys.argv)>3))
