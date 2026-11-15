import asyncio, sys, json, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from playwright.async_api import async_playwright
from run import route, ROOT
from race import ARGS
TR=int(sys.argv[1]) if len(sys.argv)>1 else 0; CAR=int(sys.argv[2]) if len(sys.argv)>2 else 0; TY=int(sys.argv[3]) if len(sys.argv)>3 else 1
SKILL=float(os.environ.get('SKILL','0.86')); SHOT=os.environ.get('SHOT'); NOPIT=os.environ.get('NOPIT')
AUTO_E = r'''
window.__apex.gfxLock && window.__apex.gfxLock();
window.__driveE = (n, dt, opts={}) => {
  const A = window.__apex, inp = A.input, wrap = (a)=>{while(a>Math.PI)a-=2*Math.PI;while(a<-Math.PI)a+=2*Math.PI;return a;};
  for (let i=0;i<n;i++) {
    const r = A.race; if (!r) break; const p = r.player, td = r.td, E = r.end; const v = Math.abs(p.speed);
    if (E.over) { A.step(dt,1); continue; }
    const ahead = Math.max(14, v*0.55), sa = td.wrap(p.s + ahead);
    let tl = td.idealAt(p.s + 30);
    const wantPit = !opts.nopit && (E.cond < 0.25 || (E.wx > 0 && E.wet > 0.35 && E.tyre !== 3) || (E.tyre === 3 && E.wx === 0 && E.wet < 0.15));
    const ws = td.wrap(p.s); let maxv = 0;
    if (wantPit && (ws > td.L - 260 || ws < 200)) { tl = (sa > 34 && sa < 220) ? 27 : 13.5; if (ws > td.L - 120 || ws < 60) maxv = 46; }
    else for (const o of td.obstacles) { if (o.active===false) continue; let d=o.s-p.s; if(d<-td.L/2)d+=td.L; if (d>0 && d<Math.max(90,v*2.6) && Math.abs(o.lat-tl)<4.6) tl = o.lat + (o.lat>tl?-6:6); }
    const q = td.at(p.s + ahead, tl);
    const des = Math.atan2(q.x - p.x, q.z - p.z); const err = wrap(des - p.heading);
    inp.left = err > 0.015; inp.right = err < -0.015;
    let tv = p.phys.vmax * 1.2; const g = p.phys.grip * (opts.skill||0.86) * r.gripMul;
    for (let d=0; d<=260; d+=10) { const k=Math.abs(td.K[td.idx(p.s+d)]); if (k>1e-4){ const vc=Math.sqrt(g/k); const al=Math.sqrt(vc*vc+2*24*r.gripMul*d); if (al<tv) tv=al; } }
    if (maxv) tv = Math.min(tv, maxv);
    inp.gas = v < tv; inp.brake = v > tv + 4;
    inp.nitro = tv > p.phys.vmax && p.nitro > 20 && E.wet < 0.3;
    if (E.pit.phase === 'choose' && E.pit.t > 1.4) { const rainSoon = E.fc && E.fc.to > E.fc.from && E.fc.prob > 0.6; A.pitChoose((E.wx > 0 && !(E.fc && E.fc.to === 0 && E.fc.prob > 0.7)) || rainSoon ? 3 : (opts.dry ?? 1)); }
    A.step(dt, 1);
  }
  const r = A.race; if (!r) return null; const p = r.player, E = r.end;
  return { t:+E.time.toFixed(0), left:+E.left.toFixed(1), dist:Math.floor(p.progress), cps:E.cps, lap:p.lapsDone, wx:E.wx, wet:+E.wet.toFixed(2), tyre:E.tyre, cond:+E.cond.toFixed(2), stops:E.pit.stops, hp:+p.health.toFixed(0), v:+(p.speed*3.6).toFixed(0), over:E.over, place:p.place, passes:E.passes, pit:E.pit.phase, fc: E.fc ? [E.fc.to, +E.fc.prob.toFixed(2), E.fc.happens] : null, obs: r.td.obstacles.filter(o=>o.active!==false).length };
};
'''
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path=os.environ.get('CHROME','/usr/bin/google-chrome'), args=ARGS)
        pg=await b.new_page(screen={'width':1920,'height':1080}, viewport={'width':960,'height':540} if SHOT else {'width':480,'height':270}); errs=[]
        pg.on('pageerror', lambda e: errs.append(f'PAGEERROR: {e}'))
        pg.on('console', lambda m: errs.append(f'{m.type}: {m.text}') if m.type=='error' else None)
        await pg.route('**/*', route)
        await pg.goto('file://'+ROOT+'/dist/index.html')
        await pg.wait_for_function('window.__apex && window.__apex.mode==="intro"', timeout=90000)
        await pg.evaluate(AUTO_E)
        await pg.evaluate(f'() => {{ __apex.endIntro(); __apex.selCar={CAR}; __apex.selTrack={TR}; __apex.selMode="endless"; __apex.selTyre={TY}; __apex.beginRace(); }}')
        await pg.wait_for_function('window.__apex.mode==="race" && window.__apex.race', timeout=90000)
        await pg.evaluate('() => __apex.setMode("test")')
        opts = json.dumps({'skill':SKILL, 'nopit': bool(NOPIT)})
        shots = [int(x) for x in SHOT.split(',')] if SHOT else []
        got=set()
        async def snap(name):
            await pg.evaluate('() => { __apex.step(0.001,1); __apex.render(); }'); await pg.wait_for_timeout(350)
            await pg.screenshot(path=f'{ROOT}/test/shots/{name}.png'); got.add(name)
        for k in range(1500):
            r = await pg.evaluate(f'() => __driveE(60, 1/60, {opts})')
            if k % 15 == 0 or r['over']: print({a:r[a] for a in ['t','left','dist','cps','lap','wx','wet','tyre','cond','stops','hp','place','passes','obs']})
            if SHOT:
                if r['pit']=='choose' and 'end_pit' not in got: await snap('end_pit')
                if r['wx']>0 and r['wet']>0.4 and r['pit']=='idle' and 'end_rain' not in got: await snap('end_rain')
                if r['t']>20 and r['fc'] and 'end_dry' not in got and r['wx']==0: await snap('end_dry')
            if r['over']: break
        if SHOT:
            await pg.wait_for_timeout(3200); await pg.screenshot(path=f'{ROOT}/test/shots/end_res.png')
        print('\n'.join(errs[:10]) or 'no errors')
        await b.close()
if __name__ == "__main__": asyncio.run(main())
