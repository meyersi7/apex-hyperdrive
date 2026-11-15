// ============================================================
//  COUNTDOWN-ENDLOS: Zeitlimit, Checkpoints, Wetter, Reifen, Boxenstopp
// ============================================================
const TYRES = [
  { id: 'soft', name: 'Soft', color: '#ff4d4d', dry: 1.10, wet: 0.50, life: 70, hint: 'am schnellsten · hält kurz' },
  { id: 'medium', name: 'Medium', color: '#ffd23b', dry: 1.0, wet: 0.52, life: 135, hint: 'ausgewogen' },
  { id: 'hard', name: 'Hard', color: '#f2f2f2', dry: 0.90, wet: 0.50, life: 230, hint: 'langsamer · hält lang' },
  { id: 'rain', name: 'Regen', color: '#3b8bff', dry: 0.76, wet: 0.93, life: 170, hint: 'nur bei Nässe gut' },
];
const END_CFG = { start: 30, cpBase: 10.5, cpStep: 0.3, cpMin: 4, coin: 0.3, hit: 2, pass: 2, wreck: 10, drift: 150, driftMax: 4, air: 2, airMax: 4, near: 1, quickPit: 2 };
const WX = [{ name: 'Trocken', icon: '☀️', rain: 0 }, { name: 'Leichter Regen', icon: '🌦️', rain: 0.45 }, { name: 'Starker Regen', icon: '🌧️', rain: 1 }];
let selMode = 'race', selTyre = 1;
try { selMode = localStorage.getItem('apex_mode') === 'endless' ? 'endless' : 'race'; const t = localStorage.getItem('apex_tyre'); if (t != null) selTyre = clamp(+t || 0, 0, 2); } catch (_) {}
const loadEndBest = (id) => { try { const v = +localStorage.getItem('apex_end_best_' + id); return v > 0 ? v : 0; } catch (_) { return 0; } };
const saveEndBest = (id, m) => { try { localStorage.setItem('apex_end_best_' + id, String(m)); } catch (_) {} };
const fmtM = (m) => fmtNum(Math.max(0, Math.floor(m))) + ' m';
const fmtS = (s) => s.toFixed(1).replace('.', ',');

// opponents get quicker every lap; in the wet everybody is slower
function raceDiff() {
  if (race.mode !== 'endless') return DIFFS[race.diff];
  const lap = race.player.lapsDone, wet = race.end.wet;
  // rubFar: beyond 400 m the pull back to the player grows, so pit stops and mistakes mix the field without scattering it around the lap
  return { skill: -0.03 + 0.012 * lap, corner: Math.min(0.95, 0.79 + 0.015 * lap) * (1 - 0.3 * wet), rubLo: 0.85, rubHi: 1.15, rubFar: 0.0001, nitro: lap >= 4 ? 0.12 : 0 };
}
// weather script: every change is announced ahead of time with an honest probability
function genWeather() {
  const ev = []; let t = 38 + Math.random() * 30, cur = 0;
  while (t < 2400) {
    if (cur === 0) {
      const prob = 0.3 + Math.random() * 0.6, happens = Math.random() < prob, to = Math.random() < 0.55 ? 1 : 2;
      ev.push({ t, lead: 40, from: 0, to, prob, happens }); if (happens) cur = to;
      t += happens ? 45 + Math.random() * 40 : 55 + Math.random() * 35;
    } else {
      const to = Math.random() < 0.6 ? 0 : (cur === 1 ? 2 : 1), prob = 0.75 + Math.random() * 0.2, happens = Math.random() < prob;
      ev.push({ t, lead: 30, from: cur, to, prob, happens }); if (happens) cur = to;
      t += happens ? (to === 0 ? 55 + Math.random() * 40 : 40 + Math.random() * 30) : 45 + Math.random() * 20;
    }
  }
  return ev;
}
function tyreGripOf(tyre, c, wet) {
  const T = TYRES[tyre];
  return lerp(T.dry, T.wet, wet) * (1 - 0.36 * (1 - c) * (1 - c) - (c < 0.15 ? 0.15 * (1 - c / 0.15) : 0));
}
const tyreGrip = (E) => tyreGripOf(E.tyre, E.cond, E.wet);
const tyreWear = (tyre, wet) => TYRES[tyre].id === 'rain' ? 1 + 3.2 * Math.max(0, 1 - wet / 0.4) : 1 - 0.3 * wet;   // rain tyres overheat on a dry track

function initEndless() {
  const r = race, td = r.td, W = r.world, scene = r.scene;
  const n = Math.max(4, Math.round(td.L / 520));
  const E = r.end = {
    left: END_CFG.start, time: 0, cpN: n, cpLen: td.L / n, cpIdx: 1, cps: 0, best: loadEndBest(td.def.id), newRec: false,
    tyre: selTyre, cond: 1, wx: 0, rain: 0, wet: 0, pud: 0, fxQ: 1, gloom: 0, events: genWeather(), evI: 0, fc: null,
    pit: { phase: 'idle', t: 0, served: false, stops: 0, total: 0 }, coins: 0, laps: 0, passes: 0, over: false, lastTick: 99,
    base: { sun: W.sun.intensity, hemi: W.hemi.intensity, sky: W.skyMesh ? W.skyMesh.material.uniforms.skyGain.value : 1, fogC: scene.fog.color.clone(), near: scene.fog.near, far: scene.fog.far, rough: W.roadMat.roughness, roadC: W.roadMat.color.clone(), cloudC: W.clouds.length ? W.clouds[0].color.clone() : null },
  };
  r.gripMul = tyreGrip(E);
  initEndAi(r);
  // checkpoint gates
  const gMat = new THREE.MeshStandardMaterial({ color: 0x2a2408, emissive: 0xffc21a, emissiveIntensity: 1.7, metalness: 0.3, roughness: 0.5 });
  for (let k = 1; k < n; k++) {
    const s = k * E.cpLen, g = new THREE.Group(); g.position.copy(td.at(s, 0)); g.rotation.y = td.heading(s);
    for (const sx of [-1, 1]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.5, 8, 0.5), gMat); p.position.set(sx * 21.6, 4, 0); g.add(p); }
    const beam = new THREE.Mesh(new THREE.BoxGeometry(43.7, 0.6, 0.6), gMat); beam.position.y = 8; g.add(beam);
    const sp = textSprite('CHECKPOINT', { color: '#1a1200', bg: '#ffc21a', border: '#fff1b0', scale: 0.016 }); sp.position.set(0, 9.4, 0); g.add(sp);
    scene.add(g);
  }
  // record line
  E.recLine = new THREE.Group(); E.recLine.visible = false; scene.add(E.recLine);
  if (E.best > 30) {
    const sb = td.wrap(E.best);
    E.recLine.add(new THREE.Mesh(stripGeo(td, sb - 0.8, sb + 0.8, -ROAD_HW, ROAD_HW, 0.035, 2), new THREE.MeshBasicMaterial({ color: new THREE.Color(0xff4fd8).multiplyScalar(2.2), transparent: true, opacity: 0.9, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 })));
    const sp = textSprite('🏆 REKORD ' + fmtM(E.best), { color: '#fff', bg: 'rgba(60,0,50,.85)', border: '#ff4fd8', w: 700, scale: 0.02 }); const q = td.at(sb, 0); sp.position.set(q.x, 6, q.z); E.recLine.add(sp);
  }
  // rain streaks around the camera
  const N = LOW ? 550 : 1500, rp = new Float32Array(N * 6); E.rainN = N; E.rainY = new Float32Array(N); E.rainXZ = new Float32Array(N * 2);
  for (let i = 0; i < N; i++) { E.rainXZ[i * 2] = rand(-24, 24); E.rainXZ[i * 2 + 1] = rand(-24, 24); E.rainY[i] = rand(0, 18); }
  const rg = new THREE.BufferGeometry(); rg.setAttribute('position', new THREE.BufferAttribute(rp, 3).setUsage(THREE.DynamicDrawUsage));
  E.rainMesh = new THREE.LineSegments(rg, new THREE.LineBasicMaterial({ color: 0xc4d4e6, transparent: true, opacity: 0, depthWrite: false, fog: false }));
  E.rainMesh.frustumCulled = false; E.rainMesh.visible = false; scene.add(E.rainMesh);
  E.spray = new Particles(LOW ? 700 : 1900, false); E.splash = new Particles(LOW ? 300 : 800, false); scene.add(E.spray.points, E.splash.points); E.spray.points.renderOrder = E.splash.points.renderOrder = 2; E.ltT = 6; E.flash = 0;
  E.spray.mat.uniforms.uMax.value = LOW ? 140 : 230;   // spray right in front of the camera may not fill half the screen: that is what costs frames
  // wet road: one shader for dry and wet (no switch mid-race). The puddle map is a depth map: the deepest spots fill first, then the puddles grow.
  E.pudU = { value: new THREE.Vector2(2, 2.15) };
  const rm = W.roadMat; rm.roughnessMap = TEX.puddle;
  rm.onBeforeCompile = (sh) => {
    sh.uniforms.uPud = E.pudU;
    sh.fragmentShader = 'uniform vec2 uPud;\n' + sh.fragmentShader.replace('#include <roughnessmap_fragment>', `float roughnessFactor = roughness;
#ifdef USE_ROUGHNESSMAP
  vec4 texelRoughness = texture2D( roughnessMap, vRoughnessMapUv );
  float pud = smoothstep( uPud.x, uPud.y, 1.0 - texelRoughness.g );
  roughnessFactor *= mix( 1.0, 0.07, pud );
  diffuseColor.rgb *= 1.0 - 0.3 * pud;
#endif`);
  };
  rm.customProgramCacheKey = () => 'wetroad'; rm.needsUpdate = true;
  document.body.classList.add('endless');
  renderPitUI(); $('pitUI').classList.remove('on');
  updateEndlessHud(true);
}
function endlessCleanup() { document.body.classList.remove('endless'); const p = $('pitUI'); if (p) p.classList.remove('on'); const f = $('rainFx'); if (f) f.style.opacity = 0; }
function endAdd(sec, label, color) {
  const E = race.end; if (!E || E.over) return;
  E.left = Math.max(0, E.left + sec);
  if (label) showMsg(`${label}  ${sec > 0 ? '+' : '−'}${fmtS(Math.abs(sec))} s`, color || (sec > 0 ? '#38ff8b' : '#ff5a5a'));
}
function endRadio(text) { showMsg('📻 ' + text, '#9fd8ff'); Sfx.blip(1200, 0.07, 'square', 0.07, 1); setTimeout(() => Sfx.blip(900, 0.07, 'square', 0.07, 1), 90); }

function updateEndless(dt) {
  const r = race, E = r.end, p = r.player, td = r.td;
  if (!E.over) { E.time += dt; E.left -= dt; }
  // ---------- weather
  const ev = E.events[E.evI];
  if (ev) {
    if (!ev.said && E.time >= ev.t - ev.lead) {
      ev.said = true; E.fc = ev; const pc = Math.round(ev.prob * 100 / 5) * 5;
      endRadio(ev.to > ev.from ? `${ev.to === 2 ? 'Starker Regen' : (ev.from ? 'Mehr Regen' : 'Regen')}: Risiko ${pc} % in ${ev.lead} s` : (ev.to === 0 ? `Regen lässt nach: ${pc} % in ${ev.lead} s` : `Regen wird schwächer: ${pc} % in ${ev.lead} s`));
    }
    if (E.time >= ev.t) {
      if (ev.happens) { E.wx = ev.to; endRadio(ev.to === 0 ? 'Regen hört auf – Strecke trocknet ab' : ev.to > ev.from ? `${WX[ev.to].name} setzt ein!` : 'Regen wird schwächer'); }
      else endRadio(ev.to > ev.from ? 'Entwarnung – der Schauer zieht vorbei' : 'Der Regen hält doch an');
      E.fc = null; E.evI++;
    }
  }
  E.rain = damp(E.rain, WX[E.wx].rain, 0.22, dt);
  E.wet = E.rain > E.wet ? Math.min(E.rain, E.wet + (E.rain - E.wet) * dt / 5 + dt * 0.01) : Math.max(E.rain, E.wet - dt / 38);
  let gT = E.rain > 0.03 || E.wx > 0 ? 0.45 + 0.5 * WX[E.wx].rain : 0;
  if (E.fc) { const k = clamp(1 - (E.fc.t - E.time) / E.fc.lead, 0, 1); if (E.fc.to > E.fc.from) gT = Math.max(gT, (E.fc.happens ? 0.62 : 0.3) * k); else if (E.fc.happens) gT *= lerp(1, 0.65, k); }
  E.gloom = damp(E.gloom, gT, 0.35, dt);
  applyWeather(dt);
  // ---------- tyres
  const v = Math.hypot(p.speed, p.vlat), T = TYRES[E.tyre];
  if (!E.over && r.state === 'race' && !r.pitCtl) {
    E.cond = Math.max(0, E.cond - dt / T.life * (0.3 + 0.7 * Math.min(1, v / p.phys.vmax)) * (1 + Math.min(p.slipR, 0.4) * 4) * tyreWear(E.tyre, E.wet));
  }
  for (const a of r.ais) endAiTick(a, E, dt);
  r.gripMul = tyreGrip(E);
  r.slick = clamp(E.wet * (T.id === 'rain' ? 0.2 : 1) * (1 + (1 - E.cond) * 0.3), 0, 1);
  if (E.cond < 0.2 && !E.warned) { E.warned = true; endRadio('Reifen am Ende – Box!'); }
  if (E.over) { updateEndlessHud(); return; }
  // ---------- checkpoints
  while (p.progress >= E.cpIdx * E.cpLen) {
    const bonus = Math.max(END_CFG.cpMin, END_CFG.cpBase - END_CFG.cpStep * E.cps);
    E.cps++; E.cpIdx++; endAdd(bonus, '🚩 CHECKPOINT ' + E.cps, '#ffcf5a'); Sfx.beep(true);
  }
  // ---------- coins, laps (more obstacles each lap), overtakes
  if (p.coins > E.coins) { endAdd(END_CFG.coin * (p.coins - E.coins), '🪙 COIN', '#ffcf5a'); E.coins = p.coins; }
  if (p.lapsDone > E.laps) {
    E.laps = p.lapsDone; let add = 2;
    for (const o of td.obstacles) if (o.active === false && add > 0 && Math.abs(((o.s - p.s) % td.L + td.L) % td.L - td.L / 2) < td.L / 2 - 250) { o.active = true; o.mesh.visible = true; add--; }
    showMsg(`RUNDE ${E.laps + 1} – Gegner schneller, mehr Hindernisse`, '#ff8a1a');
  }
  for (const a of r.ais) {
    const ahead = a.progress > p.progress;
    // a car on its way to the box is no overtake
    if (a.wasAhead && !ahead && !r.pitCtl && !a.pit && r.t - (a.passT || -99) > 15) { a.passT = r.t; E.passes++; endAdd(END_CFG.pass, '🏁 ÜBERHOLT ' + a.name, '#38ff8b'); }
    a.wasAhead = ahead;
  }
  // ---------- near miss: squeeze past an obstacle at speed
  if (v > 40 && !p.airborne) for (const o of td.obstacles) {
    if (o.active === false) continue; let d = o.s - p.s; if (d < -td.L / 2) d += td.L; if (d > td.L / 2) d -= td.L;
    if (d < -1 && d > -5 && Math.abs(p.lat - o.lat) < 4.4 && r.t - (o.nmT || -99) > 8 && r.t - (o.hit || -99) > 2) { o.nmT = r.t; endAdd(END_CFG.near, '😮 KNAPP VORBEI', '#38ff8b'); }
  }
  // ---------- pit stop
  const pit = E.pit, ws = td.wrap(p.s);
  if (pit.phase === 'idle') {
    if (!p.inPit) pit.served = false;
    else if (!pit.served && !p.wrecked) { pit.phase = 'in'; r.pitCtl = { lat: 27, brake: false }; showMsg('🔧 BOXENSTOPP', '#38ff8b'); }
  } else if (pit.phase === 'in') {
    if (ws > 95 || !p.inPit) r.pitCtl.brake = true;
    if (r.pitCtl.brake && p.speed < 0.8) { pit.phase = 'choose'; pit.t = 0; pit.pick = -1; renderPitUI(); $('pitUI').classList.add('on'); }
  } else if (pit.phase === 'choose') {
    pit.t += dt; $('pitClock').textContent = fmtS(pit.t) + ' s';
    if (pit.t > 9) pitChoose(E.tyre);
  } else if (pit.phase === 'service') {
    pit.t2 -= dt; $('pitFill').style.width = clamp(1 - pit.t2 / pit.dur, 0, 1) * 100 + '%';
    if (pit.t2 <= 0) {
      E.tyre = pit.pick; E.cond = 1; E.warned = false; p.health = 100; pit.stops++; pit.total += pit.t + pit.dur;
      if (pit.t < 1) endAdd(END_CFG.quickPit, '⚡ BLITZ-STOPP');
      pit.phase = 'idle'; pit.served = true; r.pitCtl = null; $('pitUI').classList.remove('on'); Sfx.beep(true);
      showMsg(`✅ ${TYRES[E.tyre].name.toUpperCase()} MONTIERT – Standzeit ${fmtS(pit.t + pit.dur)} s`, '#38ff8b');
    }
  }
  // ---------- record & end
  const dist = Math.max(0, p.progress);
  if (E.best > 30) {
    E.recLine.visible = !E.newRec && Math.floor(dist / td.L) === Math.floor(E.best / td.L);
    if (!E.newRec && dist > E.best) { E.newRec = true; showMsg('🏆 NEUER REKORD!', '#ff4fd8'); Sfx.beep(true); setTimeout(() => Sfx.beep(true), 200); }
  }
  const tick = Math.ceil(E.left);
  if (tick !== E.lastTick && tick <= 5 && tick > 0) Sfx.beep(false);
  E.lastTick = tick;
  if (E.left <= 0) endRun();
  updateEndlessHud();
}
function pitChoose(i) {
  const E = race && race.end; if (!E || E.pit.phase !== 'choose' || i < 0 || i > 3) return;
  const pit = E.pit; pit.pick = i; pit.dur = clamp(0.8 + 0.5 * pit.t, 1, 3); pit.t2 = pit.dur; pit.phase = 'service';
  Sfx.repair(); renderPitUI();
}
function renderPitUI() {
  const E = race.end, box = $('pitOpts'); box.innerHTML = '';
  TYRES.forEach((T, i) => {
    const b = document.createElement('button'); b.className = 'pitOpt' + (E.pit.pick === i ? ' sel' : '') + (E.tyre === i ? ' cur' : ''); b.style.setProperty('--tc', T.color);
    const k = document.createElement('kbd'); k.textContent = String(i + 1); const n = document.createElement('b'); n.textContent = T.name.toUpperCase(); const h = document.createElement('span'); h.textContent = T.hint + (E.tyre === i ? ' · montiert' : '');
    b.append(k, n, h); b.onclick = () => pitChoose(i); box.appendChild(b);
  });
  const serving = E.pit.phase === 'service';
  $('pitTitle').textContent = serving ? `${TYRES[E.pit.pick].name.toUpperCase()} WIRD MONTIERT …` : 'REIFEN WÄHLEN – JE SCHNELLER, DESTO KÜRZER DER STOPP';
  $('pitBar').style.display = serving ? 'block' : 'none'; $('pitFill').style.width = '0%';
  $('pitWx').textContent = `${WX[E.wx].icon} ${WX[E.wx].name}` + (E.fc ? `  ·  Prognose: ${endFcText(E)}` : '');
}
function endFcText(E) {
  const f = E.fc, s = Math.max(0, Math.ceil(f.t - E.time)), pc = Math.round(f.prob * 100 / 5) * 5;
  return `${f.to > f.from ? WX[f.to].icon + ' ' + (f.to === 2 ? 'Starkregen' : 'Regen') : (f.to === 0 ? '☀️ trocken' : '🌦️ schwächer')} ${pc} % in ${s} s`;
}
const _wxGrey = new THREE.Color(0x8b949e), _wxCloud = new THREE.Color(0x6f7780);
function applyWeather(dt) {
  const r = race, E = r.end, W = r.world, B = E.base, g = E.gloom, wet = E.wet, sc = r.scene;
  W.sun.intensity = B.sun * (1 - 0.8 * g); W.hemi.intensity = B.hemi * (1 - 0.3 * g);
  if (W.skyMesh) W.skyMesh.material.uniforms.skyGain.value = B.sky * (1 - 0.62 * g);
  sc.fog.color.copy(B.fogC).lerp(_wxGrey, W.night ? 0 : g * 0.85); sc.fog.near = lerp(B.near, 120, g * 0.75); sc.fog.far = lerp(B.far, 1300, g * 0.8);
  if (B.cloudC) for (const m of W.clouds) m.color.copy(B.cloudC).lerp(_wxCloud, g);
  // wet road: darker, mirror-like puddles, lightning in heavy rain
  // puddles need time: they start in the deepest spots after some seconds of rain and grow from there; they also dry up slowly
  E.pud += clamp(clamp((wet - 0.12) / 0.6, 0, 1) - E.pud, -dt / 40, dt / 24);
  const pth = lerp(0.98, 0.3, smooth(E.pud)); E.pudU.value.set(pth, pth + 0.15);
  // rain effects give way before the frame rate does
  if (E.rain > 0.1) { if (GFX.ft > 1 / 48) E.fxQ = Math.max(0.25, E.fxQ - dt * 0.3); else if (GFX.ft < 1 / 56) E.fxQ = Math.min(1, E.fxQ + dt * 0.03); }
  const fxQ = E.fxQ;
  W.roadMat.roughness = lerp(B.rough, 0.42, Math.min(1, wet * 1.6)); W.roadMat.color.copy(B.roadC).multiplyScalar(1 - 0.55 * wet); W.roadMat.envMapIntensity = (1 + 0.5 * wet) * (1 - 0.45 * g);   // puddles mirror the grey rain sky, not a bright one
  if (E.wx === 2 && E.rain > 0.8 && (E.ltT -= dt) <= 0) { E.ltT = 7 + Math.random() * 12; E.flash = 1; setTimeout(() => Sfx.noise(2.2, 0.55, 200, 0.4), 500 + Math.random() * 1200); }
  if (E.flash > 0) { E.flash = Math.max(0, E.flash - dt * 3.5); W.hemi.intensity += 3.2 * E.flash * (E.flash > 0.55 && E.flash < 0.75 ? 0.2 : 1); }
  // rain streaks
  const R = E.rainMesh, on = E.rain > 0.02; R.visible = on;
  if (on) {
    const a = R.geometry.attributes.position.array, fall = 36 * dt, cx = camera.position.x, cz = camera.position.z;
    for (let i = 0; i < E.rainN; i++) {
      let y = E.rainY[i] - fall; if (y < 0) y += 18; E.rainY[i] = y;
      const x = cx + E.rainXZ[i * 2], z = cz + E.rainXZ[i * 2 + 1], o = i * 6;
      a[o] = x; a[o + 1] = y; a[o + 2] = z; a[o + 3] = x + 0.2; a[o + 4] = y + 1.5; a[o + 5] = z;
    }
    R.geometry.attributes.position.needsUpdate = true; R.geometry.setDrawRange(0, Math.floor(E.rainN * clamp(E.rain * 1.2, 0.15, 1) * (0.4 + 0.6 * fxQ)) * 2); R.material.opacity = 0.25 + 0.3 * E.rain;
  }
  const rfo = Math.round(clamp(E.rain * 0.9, 0, 0.8) * 20) / 20; if (E.rfo !== rfo) { E.rfo = rfo; $('rainFx').style.opacity = rfo; }
  // spray: rooster tails behind every car, wheel splashes, rain drops bursting on the road
  E.spray.setScale(innerHeight, camera.fov); E.splash.setScale(innerHeight, camera.fov);
  const sprayRate = (LOW || GFX.level > 1 ? 110 : GFX.level === 1 ? 170 : 240) * fxQ, pl = r.player;   // per second, not per frame: the same amount on a 60 Hz and a 144 Hz screen
  if (wet > 0.1) for (const c of r.cars) {
    const sp = Math.abs(c.speed); if (sp < 8 || c.airborne) continue;
    if (!c.isPlayer && (c.x - pl.x) ** 2 + (c.z - pl.z) ** 2 > 150 * 150) continue;
    const sh = Math.sin(c.heading), ch = Math.cos(c.heading), k = wet * Math.min(1, sp / 45), n = Math.floor(k * sprayRate * (c.isPlayer ? 0.6 : 1) * dt + Math.random());
    for (let i = 0; i < n; i++) {
      const side = rand(-0.95, 0.95), back = rand(2.0, 3.2);
      E.spray.emit({ x: c.x - sh * back - ch * side, y: c.y + 0.25, z: c.z - ch * back + sh * side, vx: sh * sp * 0.32 + rand(-1.6, 1.6), vy: rand(1.5, 4.5) * (0.5 + k), vz: ch * sp * 0.32 + rand(-1.6, 1.6), life: rand(0.6, 1.2), size: 0.8, size1: c.isPlayer ? rand(2.4, 4.2) : rand(3, 5.5), r: 0.78, g: 0.82, b: 0.88, a: (c.isPlayer ? 0.075 : 0.12) * wet, drag: 1.5, grav: 3 });
    }
    if (Math.random() < k * dt * 60) for (const sx of [-1, 1]) E.spray.emit({ x: c.x + sh * 1.4 - ch * sx * 0.9, y: c.y + 0.2, z: c.z + ch * 1.4 + sh * sx * 0.9, vx: sh * sp * 0.5 - ch * sx * rand(3, 7), vy: rand(1.5, 3.5), vz: ch * sp * 0.5 + sh * sx * rand(3, 7), life: rand(0.35, 0.6), size: 0.5, size1: 2.4, r: 0.85, g: 0.88, b: 0.93, a: 0.2 * wet, drag: 2, grav: 9 });
  }
  if (E.rain > 0.05) { const p = r.player, fx = Math.sin(p.heading), fz = Math.cos(p.heading), n = Math.floor(E.rain * (LOW || GFX.level > 1 ? 360 : 1000) * fxQ * dt + Math.random());
    for (let i = 0; i < n; i++) { const a = rand(8, 60), b = rand(-17, 17); E.splash.emit({ x: p.x + fx * a - fz * b, y: 0.07, z: p.z + fz * a + fx * b, vx: 0, vy: 0.8, vz: 0, life: 0.22, size: 0.1, size1: 0.5, r: 0.86, g: 0.9, b: 0.96, a: 0.3 }); } }
  E.spray.update(dt); E.splash.update(dt);
}
function updateEndlessHud(force) {
  const r = race, E = r.end, p = r.player, dist = Math.max(0, p.progress);
  setT('eTimer', fmtS(Math.max(0, E.left))); const low = E.left < 10; if (hudC.eLow !== low) { hudC.eLow = low; $('eTimer').className = low ? 'low' : ''; }
  setT('eDistV', fmtM(dist));
  setT('eRec', E.best > 30 ? (dist > E.best ? `🏆 Rekord +${fmtM(dist - E.best)}` : `noch ${fmtM(E.best - dist + 1)} bis Rekord`) : 'erster Versuch – setz den Rekord');
  setT('eWxNow', `${WX[E.wx].icon} ${WX[E.wx].name}` + (E.wet > 0.12 && E.wx === 0 ? ' · Strecke nass' : ''));
  setT('eWxFc', E.fc ? '📻 ' + endFcText(E) : '');
  const T = TYRES[E.tyre], pc = Math.round(E.cond * 100);
  setT('eTyreName', T.name.toUpperCase()); setT('eTyrePct', `${pc} % · Grip ${Math.round(r.gripMul * 100)} %`);
  if (hudC.tyreC !== T.color) { hudC.tyreC = T.color; $('eTyreDot').style.background = T.color; }
  const bc = pc < 25 ? '#ff4d4d' : pc < 50 ? '#ffd23b' : T.color;
  if (hudC.tyreW !== pc) { hudC.tyreW = pc; $('eTyreBar').style.width = pc + '%'; }
  if (hudC.tyreB !== bc) { hudC.tyreB = bc; $('eTyreBar').style.background = bc; }
  // nearest rival ahead and behind, with their tyres; gap in seconds at the average pace of the run
  let ra = null, rb = null, ga = Infinity, gb = -Infinity;
  for (const a of r.ais) { const g = a.progress - p.progress; if (g >= 0) { if (g < ga) { ga = g; ra = a; } } else if (g > gb) { gb = g; rb = a; } }
  const vAvg = Math.max(25, E.time > 5 ? dist / E.time : 45);
  setH('eRivA', ra ? rivTxt('▲', ra, ga / vAvg) : '');
  setH('eRivB', rb ? rivTxt('▼', rb, gb / vAvg) : '');
  // weather box, top left
  setT('wxIcon', WX[E.wx].icon); setT('wxName', WX[E.wx].name);
  setT('wxSub', E.wet > 0.6 ? 'Strecke nass' : E.wet > 0.12 ? 'Strecke feucht' : 'Strecke trocken');
  const f = E.fc, left = f ? Math.max(0, f.t - E.time) : 0, cls = !f ? 'none' : left <= 10 ? 'soon' : '';
  if (hudC.wxCls !== cls) { hudC.wxCls = cls; $('wxFc').className = cls; }
  if (f) {
    setT('wxFcIcon', f.to > f.from ? WX[f.to].icon : (f.to === 0 ? '☀️' : '🌦️'));
    setT('wxFcTxt', `${f.to > f.from ? (f.to === 2 ? 'Starkregen' : (f.from ? 'Mehr Regen' : 'Regen')) : (f.to === 0 ? 'Regen hört auf' : 'Regen wird schwächer')} · ${Math.round(f.prob * 100 / 5) * 5} %`);
    setH('wxFcSec', `${Math.ceil(left)}<small>s</small>`);
  } else { setT('wxFcIcon', ''); setT('wxFcTxt', 'keine Änderung in Sicht'); setH('wxFcSec', ''); }
  const bw = f ? Math.round(clamp(1 - left / f.lead, 0, 1) * 50) * 2 : 0; if (hudC.wxBar !== bw) { hudC.wxBar = bw; $('wxBarFill').style.width = bw + '%'; }
}
function endRun() {
  const r = race, E = r.end, p = r.player; if (E.over) return;
  E.over = true; E.left = 0; E.dist = Math.max(0, Math.floor(p.progress)); E.prevBest = E.best;
  if (E.dist > E.best) saveEndBest(r.td.def.id, E.dist);
  p.finished = true; p.finishTime = r.raceTime; r.pitCtl = null; $('pitUI').classList.remove('on'); E.pit.phase = 'idle';
  showMsg('⏱ ZEIT ABGELAUFEN!', '#ff5a5a'); Sfx.beep(true); setTimeout(() => Sfx.beep(false), 250);
  setTimeout(() => { if (race === r) showResults(); }, 2200);
}

// ---------- opponents: own tyres, own pit calls, the odd mistake. Every driver has a character (risk, gamble) rolled per run.
function initEndAi(r) {
  r.ais.forEach((a, i) => {
    const w = Math.random();
    a.tyre = w < 0.35 ? 0 : w < 0.82 ? 1 : 2; a.cond = 1; a.gripF = 1; a.stops = 0;
    a.pitAt = rand(0.12, 0.32);          // how far down they run a set of tyres
    a.risk = Math.random();              // high: stays out longer on the wrong tyre
    a.gamble = Math.random();            // high: acts on the forecast before the rain is there
    a.wearK = rand(0.9, 1.2);            // driving style: how hard they are on their tyres
    a.box = PIT_S0 + 75 + i * 16;        // own box along the pit lane, behind the spot where the player stops
    a.pit = null; a.dec = false; a.err = null; a.errT = rand(12, 35);
    a.form = 0; a.lap = 0; a.biasBase = a.bias; a.tagKey = -1; drawAiTag(a);
  });
}
// name tag in the countdown mode: tyre badge and wear bar. Redrawn on the same canvas only when the tyre or a 10 % step changes.
function drawAiTag(a) {
  const T = TYRES[a.tyre], step = Math.ceil(a.cond * 10), key = a.tyre * 100 + step;
  if (a.tagKey === key || !a.tag) return; a.tagKey = key;
  const tex = a.tag.material.map, c = tex.image, g = c.getContext('2d'), w = c.width, h = c.height, bx = 52, x0 = 100, x1 = w - 24;
  g.clearRect(0, 0, w, h);
  g.fillStyle = 'rgba(0,0,0,.55)'; g.beginPath(); g.roundRect ? g.roundRect(4, 4, w - 8, h - 8, 22) : g.rect(4, 4, w - 8, h - 8); g.fill();
  g.lineWidth = 5; g.strokeStyle = a.tagColor; g.stroke();
  // tyre badge: dark tyre with the compound colour on the sidewall
  g.beginPath(); g.arc(bx, h / 2, 29, 0, 7); g.fillStyle = '#15171c'; g.fill(); g.lineWidth = 8; g.strokeStyle = T.color; g.stroke();
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = 'bold 30px Orbitron, sans-serif'; g.fillStyle = T.color; g.fillText(T.name[0], bx, h / 2 + 2);
  // name, shrunk if it does not fit
  let fs = 40; g.font = `bold ${fs}px Orbitron, sans-serif`;
  const tw = g.measureText(a.name).width; if (tw > x1 - x0) { fs = Math.floor(fs * (x1 - x0) / tw); g.font = `bold ${fs}px Orbitron, sans-serif`; }
  g.fillStyle = '#fff'; g.fillText(a.name, (x0 + x1) / 2, 40);
  // wear bar
  g.fillStyle = 'rgba(255,255,255,.18)'; g.fillRect(x0, 66, x1 - x0, 10);
  g.fillStyle = step <= 2 ? '#ff4d4d' : step <= 5 ? '#ffd23b' : T.color; g.fillRect(x0, 66, (x1 - x0) * step / 10, 10);
  tex.needsUpdate = true;
}
const rivTxt = (ar, a, s) => `${ar} <i class="tdot" style="background:${TYRES[a.tyre].color}"></i><b style="color:${a.tagColor}">${a.name}</b> ${a.pit ? '🔧 Box' : Math.round(a.cond * 10) * 10 + ' %'} <em>${s >= 0 ? '+' : '−'}${fmtS(Math.abs(s))} s</em>`;
function endAiTick(a, E, dt) {
  const td = race.td, T = TYRES[a.tyre];
  if (!a.pit || a.pit.ph !== 'stop') a.cond = Math.max(0, a.cond - dt / T.life * (0.3 + 0.7 * Math.min(1, a.speed / a.phys.vmax)) * a.wearK * tyreWear(a.tyre, E.wet));
  drawAiTag(a);
  // grip relative to the best tyre for the conditions: 1 = what the opponents had before they got their own tyres
  a.gripF = clamp(tyreGripOf(a.tyre, a.cond, E.wet) / (0.95 * Math.max(lerp(1, 0.52, E.wet), lerp(0.76, 0.93, E.wet))), 0.3, 1.12);
  // every lap: a new form and a slightly different line, so the field does not run as one train
  const lap = Math.floor(a.progress / td.L);
  if (lap !== a.lap) { a.lap = lap; a.form = rand(-0.008, 0.006); a.bias = clamp(a.biasBase + rand(-1.8, 1.8), -6.5, 6.5); }
  // pit call, once per lap, a few hundred metres before the pit entry
  const dIn = td.wrap(PIT_S0 - a.s);
  if (dIn > 420) a.dec = false;
  else if (dIn > 250 && !a.dec && !a.pit) {
    a.dec = true;
    const t = aiPitCall(a, E);
    if (t >= 0) a.pit = { ph: 'in', tyre: t, dur: rand(2.2, 4.2), t: 0 };
  }
  // mistakes: now and then a driver runs wide in a corner, more often in the wet, on worn tyres and when they push
  if (a.err) { if ((a.err.t -= dt) <= 0) a.err = null; }
  else if ((a.errT -= dt) <= 0 && !a.pit && a.speed > 30) {
    const k = td.K[td.idx(a.s + 40)];
    if (Math.abs(k) > 0.005) {
      a.errT = rand(15, 40);
      const chance = 0.15 + 0.45 * E.wet * (T.id === 'rain' ? 0.3 : 1) + 0.4 * (1 - a.cond) + 0.15 * a.risk;
      if (Math.random() < chance) {
        const big = Math.random() < 0.15, dur = big ? rand(2.4, 3.2) : rand(1.2, 2.2);
        a.err = { t: dur, dur, side: Math.sign(k), wide: big ? rand(9, 12) : rand(4, 7), slow: big ? rand(0.4, 0.5) : rand(0.12, 0.25) };   // K > 0: outside of the corner is on the right
      }
    }
  }
}
// returns the tyre they go in for, or -1 to stay out
function aiPitCall(a, E) {
  const rainT = TYRES[a.tyre].id === 'rain', f = E.fc;
  const fcRain = f && f.to > f.from ? f.prob : 0, fcDry = f && f.to === 0 ? f.prob : 0;
  const slick = () => { const w = Math.random(); return w < 0.25 + 0.25 * a.risk ? 0 : w < 0.8 ? 1 : 2; };
  const wetNow = E.wet > 0.3 || (E.wx > 0 && (E.wet > 0.12 || E.wx === 2));
  const fit = () => wetNow ? (fcDry > 0.7 && Math.random() < a.gamble * 0.6 ? slick() : 3) : (fcRain > 0.6 && Math.random() < a.gamble * fcRain ? 3 : slick());
  // condition at the next pit call: wear per second at a typical pace times an estimated lap time
  const lapT = race.td.L / (0.75 * a.phys.vmax), next = a.cond - lapT * (0.3 + 0.7 * 0.75) / TYRES[a.tyre].life * a.wearK * tyreWear(a.tyre, E.wet);
  if (a.cond < a.pitAt || next < a.pitAt * 0.4) return fit();                                       // worn, or would not last another lap
  if (!rainT && E.wx > 0 && Math.max(E.wet, WX[E.wx].rain) > 0.22 + 0.4 * a.risk) return 3;        // slicks in the rain: careful drivers come in first
  if (!rainT && E.wx === 0 && fcRain && a.cond < 0.85 && Math.random() < fcRain * a.gamble * 0.5) return 3;   // betting on the forecast
  if (rainT && E.wx === 0 && fcRain < 0.5 && (E.wet < 0.5 || Math.random() < 0.9 - 0.3 * a.risk)) return slick();   // rain stopped: the track is dry within the lap, rain tyres would burn up
  if (rainT && fcDry && (E.wet < 0.5 || E.wx === 1) && Math.random() < fcDry * (0.3 + 0.5 * a.gamble)) return slick();   // forecast says dry: slicks before the rain tyres burn up
  if (a.cond < a.pitAt + 0.2 && Math.random() < 0.18) return fit();                                 // the odd early stop
  return -1;
}
// called from updateAI: bends target speed and line for a mistake or a pit stop
function endAiDrive(a, tv, tl, ll, dt) {
  const e = a.err;
  if (e) {
    const env = Math.sin(Math.PI * clamp(1 - e.t / e.dur, 0, 1));
    tl = clamp(tl + e.side * e.wide * env, -ROAD_HW - 4, ROAD_HW + 4); tv *= 1 - e.slow * env;
    if (Math.abs(a.lat) > ROAD_HW + CURB_W && race.end.wet < 0.3 && Math.random() < 0.3) dust(a.x, a.z, 2);
  }
  const P = a.pit; if (!P) return [tv, tl, ll];
  const td = race.td, ws = a.s, V = PIT_LIMIT * 0.92;
  if (P.ph === 'in') {
    if (ws < PIT_S0 + 6 || ws > PIT_S1 + 10) {   // approach on the right, slow down to the limiter
      const d = ws < PIT_S1 ? Math.max(0, PIT_S0 - ws) : td.L - ws + PIT_S0;
      tl = 13.5; tv = Math.min(tv, Math.sqrt(V * V + 2 * 16 * d));
    } else {
      const dB = a.box - ws;
      tl = dB < 24 ? 31 : 24; ll = Math.max(ll, Math.min(4, a.speed)); tv = Math.min(tv, V, Math.sqrt(2 * 9 * Math.max(0, dB)));
      if (dB < 0.6 && a.speed < 2.5) {
        P.ph = 'stop'; P.t = P.dur; a.speed = 0;
        // the weather may have turned since the call: the crew swaps the set they had ready
        const E = race.end, rainNow = E.wx === 2 || (E.wx === 1 && E.wet > 0.3);
        if (P.tyre !== 3 && rainNow) P.tyre = 3; else if (P.tyre === 3 && E.wx === 0 && E.wet < 0.3 && !(E.fc && E.fc.to > 0)) P.tyre = 1;
        if (Math.abs(a.progress - race.player.progress) < 1500) showMsg(`🔧 ${a.name} an der Box → ${TYRES[P.tyre].name}`, a.tagColor);
      }
    }
  } else if (P.ph === 'stop') {
    a.speed = 0; tv = 0; tl = a.lat;
    if ((P.t -= dt) <= 0) { a.tyre = P.tyre; a.cond = 1; a.stops++; P.ph = 'out'; }
  } else {
    tl = ws < a.box + 12 ? 25 : 12; tv = Math.min(tv, V); if (ws > PIT_S1 - 50) ll = 7;
    if (ws > PIT_S1 + 5 && ws < td.L / 2) a.pit = null;
  }
  return [tv, tl, ll];
}
