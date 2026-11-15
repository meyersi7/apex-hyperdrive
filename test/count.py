import os
import asyncio, sys, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from playwright.async_api import async_playwright
from run import route, ROOT
from race import ARGS
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path=os.environ.get('CHROME','/usr/bin/google-chrome'), args=ARGS)
        pg=await b.new_page(screen={'width':1920,'height':1080}, viewport={'width':640,'height':360})
        await pg.route('**/*', route)
        await pg.goto('file://'+ROOT+'/dist/index.html')
        await pg.wait_for_function('window.__apex && window.__apex.mode==="intro"', timeout=90000)
        await pg.evaluate('() => { __apex.gfxLock(); __apex.endIntro(); __apex.selCar=1; __apex.selTrack=0; __apex.selMode="endless"; __apex.beginRace(); }')
        await pg.wait_for_function('window.__apex.mode==="race" && window.__apex.race', timeout=90000)
        await pg.evaluate('() => __apex.setMode("test")')
        print(await pg.evaluate('''() => { const r=__apex.race; const cnt=(root)=>{ let m=0,t=0,cs=0; const mats=new Set(); root.traverse(o=>{ if(o.isMesh||o.isSprite){ m++; if(o.geometry){const g=o.geometry; t+=(g.index?g.index.count:g.attributes.position.count)/3;} if(o.castShadow) cs++; mats.add(o.material.uuid);} }); return {m,t:Math.round(t),cs,mats:mats.size}; };
          const out={scene:cnt(r.scene), player:cnt(r.player.car), ai:cnt(r.ais[0].car)}; const names={}; r.ais[0].car.traverse(o=>{ if(o.isMesh){ const k=(o.material.type+':'+(o.material.color?o.material.color.getHexString():'')); names[k]=(names[k]||0)+1; } }); out.aiMats=names; return out; }'''))
        await b.close()
asyncio.run(main())
