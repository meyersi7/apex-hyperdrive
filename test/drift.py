import asyncio, sys, json, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from playwright.async_api import async_playwright
from run import route, ROOT
from race import AUTO, ARGS
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path=os.environ.get('CHROME','/usr/bin/google-chrome'), args=ARGS)
        pg=await b.new_page(screen={'width':1920,'height':1080}, viewport={'width':480,'height':270}); errs=[]
        pg.on('pageerror', lambda e: errs.append(f'PAGEERROR: {e}'))
        await pg.route('**/*', route)
        await pg.goto('file://'+ROOT+'/dist/index.html')
        await pg.wait_for_function('window.__apex && window.__apex.mode==="intro"', timeout=90000)
        await pg.evaluate(AUTO)
        await pg.evaluate('() => { __apex.endIntro(); __apex.selCar=3; __apex.selTrack=2; __apex.selDiff=0; __apex.beginRace(); }')
        await pg.wait_for_function('window.__apex.mode==="race" && window.__apex.race', timeout=90000)
        await pg.evaluate('() => __apex.setMode("test")')
        res = await pg.evaluate('''() => { const A=__apex, I=A.input, out=[]; const p=()=>A.race.player; const st=(tag)=>{const q=p(); out.push(tag+': v='+(q.speed*3.6).toFixed(0)+' vlat='+q.vlat.toFixed(2)+' yaw='+q.yawRate.toFixed(2)+' hdg='+(q.heading*57.3).toFixed(0)+' lat='+q.lat.toFixed(1)+' s='+q.s.toFixed(0)+' gear='+q.gear+' slip='+q.slipR.toFixed(2)+' hp='+q.health.toFixed(0));};
          const set=(o)=>{ for (const k in I) I[k]=false; Object.assign(I,o); }; const run=(n)=>A.step(1/60,n);
          set({}); run(260); st('after countdown');
          const q=p(); const log=(tag)=>out.push(tag+': v='+(Math.hypot(q.speed,q.vlat)*3.6).toFixed(0)+' beta='+((q.beta||0)*57.3).toFixed(0)+' yaw='+q.yawRate.toFixed(2)+' lat='+q.lat.toFixed(1)+' s='+q.s.toFixed(0)+' drifting='+q.drifting+' acc='+q.driftAcc.toFixed(0)+' pts='+q.pts.drift+' hp='+q.health.toFixed(0)+' skid='+q.skid.toFixed(2));
          __drive(60*5, 1/60, {lat:-8, maxv:42}); log('cruise 150');
          set({gas:true,right:true,drift:true}); for (let k=0;k<6;k++){ run(15); log('drift R '+((k+1)*0.25).toFixed(2)+'s'); }
          set({gas:true,left:true,drift:true}); for (let k=0;k<4;k++){ run(15); log('transition L '+((k+1)*0.25).toFixed(2)+'s'); }
          set({gas:true}); for (let k=0;k<4;k++){ run(15); log('release '+((k+1)*0.25).toFixed(2)+'s'); }
          run(60); log('after 1s more');
          return out; }''')
        print('\n'.join(res)); print(errs or 'no errors')
        await b.close()
asyncio.run(main())
