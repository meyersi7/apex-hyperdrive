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
        await pg.evaluate('() => { __apex.endIntro(); __apex.selCar=3; __apex.selTrack=0; __apex.selDiff=0; __apex.beginRace(); }')
        await pg.wait_for_function('window.__apex.mode==="race" && window.__apex.race', timeout=90000)
        await pg.evaluate('() => __apex.setMode("test")')
        res = await pg.evaluate('''() => { const A=__apex, I=A.input, out=[]; const p=()=>A.race.player; const st=(tag)=>{const q=p(); out.push(tag+': v='+(q.speed*3.6).toFixed(0)+' vlat='+q.vlat.toFixed(2)+' yaw='+q.yawRate.toFixed(2)+' hdg='+(q.heading*57.3).toFixed(0)+' lat='+q.lat.toFixed(1)+' s='+q.s.toFixed(0)+' gear='+q.gear+' slip='+q.slipR.toFixed(2)+' hp='+q.health.toFixed(0));};
          const set=(o)=>{ for (const k in I) I[k]=false; Object.assign(I,o); }; const run=(n)=>A.step(1/60,n);
          set({}); run(260); st('after countdown');
          set({brake:true}); run(120); st('reverse 2s');
          set({brake:true,left:true}); run(90); st('reverse+left 1.5s');
          set({gas:true}); run(60); st('gas 1s');
          set({gas:true,left:true}); run(150); st('gas+left 2.5s (donut)');
          set({gas:true,right:true}); run(60); st('gas+right 1s');
          set({}); run(240); st('coast 4s');
          set({gas:true}); run(60*6); st('gas 6s');
          set({gas:true,nitro:true}); run(60*3); st('nitro 3s');
          set({brake:true}); run(60*2); st('brake 2s');
          set({brake:true,left:true}); run(40); st('brake+left');
          set({}); run(120); st('release 2s');
          return out; }''')
        print('\n'.join(res)); print(errs or 'no errors')
        await b.close()
asyncio.run(main())
