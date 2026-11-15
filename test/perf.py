import asyncio, sys, json, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from playwright.async_api import async_playwright
from run import route, ROOT
from race import ARGS
from line import DRV
async def one(b, name, wet, extra=''):
    pg=await b.new_page(screen={'width':1920,'height':1080}, viewport={'width':1280,'height':720}); errs=[]
    pg.on('pageerror', lambda e: errs.append(f'PAGEERROR: {e}'))
    await pg.route('**/*', route)
    await pg.goto('file://'+ROOT+'/dist/index.html')
    await pg.wait_for_function('window.__apex && window.__apex.mode==="intro"', timeout=90000)
    await pg.evaluate(DRV)
    await pg.evaluate('() => { __apex.endIntro(); __apex.selCar=0; __apex.selTrack=0; __apex.selMode="endless"; __apex.selTyre=3; __apex.beginRace(); }')
    await pg.wait_for_function('window.__apex.mode==="race" && window.__apex.race', timeout=90000)
    await pg.evaluate('() => __apex.setMode("test")')
    r = await pg.evaluate(f'''() => {{ const A=__apex, r=A.race, E=r.end, p=r.player; {extra}
      const hold = () => {{ E.events=[]; E.wx={2 if wet else 0}; E.rain={wet}; E.wet={wet}; E.tyre=3; E.cond=0.9; E.left=60; p.health=Math.max(p.health,60); E.pit.phase='idle'; }};
      for (let i=0;i<60*14;i++) {{ hold(); __driveL(1,1/60); }}
      A.render(); A.render();
      const js=[], rd=[]; const cv=[...document.querySelectorAll('canvas')].sort((a,b)=>b.width*b.height-a.width*a.height)[0], GL=cv.getContext('webgl2')||cv.getContext('webgl'), PX=new Uint8Array(4); A.render(); GL.readPixels(0,0,1,1,GL.RGBA,GL.UNSIGNED_BYTE,PX);
      for (let i=0;i<40;i++) {{ hold(); const t0=performance.now(); __driveL(1,1/60); const t1=performance.now(); A.render(); GL.readPixels(0,0,1,1,GL.RGBA,GL.UNSIGNED_BYTE,PX); const t2=performance.now(); js.push(t1-t0); rd.push(t2-t1); }}
      const st = (a) => {{ const s=[...a].sort((x,y)=>x-y); return {{med:+s[s.length>>1].toFixed(2), max:+s[s.length-1].toFixed(2), avg:+(a.reduce((x,y)=>x+y,0)/a.length).toFixed(2)}}; }};
      return {{js: st(js), render: st(rd), spray: E.spray.p.length, splash: E.splash.p.length, v: Math.round(p.speed*3.6), level: A.gfx.level}}; }}''')
    print(name, r, errs or ''); await pg.close()
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path=os.environ.get('CHROME','/usr/bin/google-chrome'), args=ARGS)
        sets = json.loads(sys.argv[1]) if len(sys.argv)>1 else [['dry',0,''],['rain',1,'']]
        await one(b,*sets[int(os.environ.get('I','0'))])
        await b.close()
if __name__ == "__main__": asyncio.run(main())
