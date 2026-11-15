// ============================================================
//  SHOWROOM (intro + menu)
// ============================================================
const show = { scene: null, cars: [], table: null, parts: null, spots: [], strips: [], ring: null, angle: 0.75, tAngle: 0.75, pitch: 0.16, dist: 9.6, drag: null, spin: 0 };
let selCar = 0, selTrack = 0, mode = 'loading';
try { selCar = +(localStorage.getItem('apex_car') || 0) % 4; selTrack = +(localStorage.getItem('apex_track') || 0) % 3; } catch (_) {}

function buildShowroom() {
  const s = new THREE.Scene(); show.scene = s;
  s.background = new THREE.Color(0x040508); s.fog = new THREE.Fog(0x040508, 22, 60); s.environment = ENV_TEX;
  s.add(new THREE.HemisphereLight(0x8899cc, 0x101014, 0.35));
  const floor = new THREE.Mesh(new THREE.CircleGeometry(70, 64).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x0b0d12, metalness: 0.75, roughness: 0.22 }));
  floor.receiveShadow = true; s.add(floor);
  const table = new THREE.Group(); show.table = table; s.add(table);
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(4.5, 4.7, 0.3, 72), new THREE.MeshStandardMaterial({ color: 0x15171d, metalness: 0.85, roughness: 0.25 }));
  disc.position.y = 0.15; disc.receiveShadow = true; disc.castShadow = true; table.add(disc);
  const ringMat = new THREE.MeshBasicMaterial({ color: 0xffc04a });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(4.62, 0.045, 8, 96).rotateX(Math.PI / 2), ringMat); ring.position.y = 0.3; s.add(ring); show.ring = ring;
  const ring2 = new THREE.Mesh(new THREE.TorusGeometry(5.6, 0.03, 8, 96).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x3be8ff })); ring2.position.y = 0.02; s.add(ring2); show.ring2 = ring2;
  for (let i = 0; i < 28; i++) {
    const a = (i / 28) * Math.PI * 2, m = new THREE.Mesh(new THREE.BoxGeometry(0.25, 9, 0.25), new THREE.MeshBasicMaterial({ color: i % 2 ? 0x8fd8ff : 0xffd79a }));
    m.position.set(Math.cos(a) * 19, 4.5, Math.sin(a) * 19); s.add(m); show.strips.push(m);
  }
  const wall = new THREE.Mesh(new THREE.CylinderGeometry(20, 20, 14, 64, 1, true), new THREE.MeshStandardMaterial({ color: 0x0a0b10, roughness: 0.8, side: THREE.BackSide })); wall.position.y = 7; s.add(wall);
  for (let i = 0; i < 3; i++) {
    const sp = new THREE.SpotLight(0xffffff, 0, 0, 0.42, 0.6, 2);
    const a = (i / 3) * Math.PI * 2 + 0.4; sp.position.set(Math.cos(a) * 5, 9.5, Math.sin(a) * 5); sp.target.position.set(0, 0.6, 0);
    if (i === 0) { sp.castShadow = true; sp.shadow.mapSize.set(1024, 1024); sp.shadow.bias = -0.0005; }
    s.add(sp, sp.target); show.spots.push(sp);
  }
  const rim = new THREE.PointLight(0x3b8bff, 40, 30, 2); rim.position.set(0, 3, -7); s.add(rim);
  const rim2 = new THREE.PointLight(0xffa040, 30, 30, 2); rim2.position.set(0, 3, 7); s.add(rim2);
  CARS.forEach((c, i) => { const car = buildCar(c, { glow: 0.8 }); car.position.y = 0.3; car.visible = i === selCar; car.traverse(o => { if (o.isMesh && !o.userData.noShadow && !o.material.transparent) o.castShadow = true; }); table.add(car); show.cars.push(car); });
  show.parts = new Particles(500, true); s.add(show.parts.points);
  buildNamePlates(s);
  for (let i = 0; i < 260; i++) emitGold(rand(0, 6));
}
// ---------- 3D producer name plates orbiting the car in the intro
const PRODUCERS = [['SIMON', '#ffcf5a', 0xffb52e]];
const _v3 = new THREE.Vector3();
const easeOutBack = (x) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); };
function buildNamePlates(s) {
  const ring = new THREE.Group(); ring.visible = false; s.add(ring); show.names = ring; show.plates = [];
  const texCache = {};
  PRODUCERS.forEach(([name, css, hex], i) => {
    const tex = texCache[name] || (texCache[name] = canvasTex(1024, 380, (g, w, h) => {
      g.beginPath(); if (g.roundRect) g.roundRect(10, 10, w - 20, h - 20, 46); else g.rect(10, 10, w - 20, h - 20);
      const bg = g.createLinearGradient(0, 0, 0, h); bg.addColorStop(0, 'rgba(20,24,42,.95)'); bg.addColorStop(1, 'rgba(6,8,16,.95)'); g.fillStyle = bg; g.fill();
      const bd = g.createLinearGradient(0, 0, w, 0); bd.addColorStop(0, css); bd.addColorStop(0.5, '#fff6dc'); bd.addColorStop(1, css);
      g.lineWidth = 12; g.strokeStyle = bd; g.shadowColor = css; g.shadowBlur = 34; g.stroke(); g.shadowBlur = 0;
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.font = '700 44px Orbitron, Rajdhani, sans-serif'; g.fillStyle = css; g.fillText('P R O D U Z E N T', w / 2, 92);
      g.font = '900 156px Orbitron, Rajdhani, sans-serif';
      const tg = g.createLinearGradient(0, 160, 0, 320); tg.addColorStop(0, '#ffffff'); tg.addColorStop(1, css);
      g.fillStyle = tg; g.shadowColor = css; g.shadowBlur = 44; g.fillText(name, w / 2, 240); g.shadowBlur = 0; g.fillText(name, w / 2, 240);
    }));
    const plate = new THREE.Group();
    const fMat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, color: new THREE.Color(1.5, 1.5, 1.5) });
    const face = new THREE.Mesh(new THREE.PlaneGeometry(5.2, 1.93), fMat); face.position.z = 0.01; plate.add(face);
    const back = new THREE.Mesh(new THREE.PlaneGeometry(5.2, 1.93), fMat); back.rotation.y = Math.PI; back.position.z = -0.01; plate.add(back);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: TEX.glow, color: hex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.5 }));
    glow.scale.set(9.5, 4.4, 1); glow.position.z = -0.25; plate.add(glow);
    const a = Math.PI - 0.42 + (i / PRODUCERS.length) * Math.PI * 2; plate.position.set(Math.sin(a) * 5, 0, Math.cos(a) * 5); plate.scale.setScalar(0.001);
    ring.add(plate); show.plates.push({ plate, glow, delay: 0.5 + i * 0.3 });
  });
}
function updateNamePlates(dt, t) {
  show.names.visible = true; show.names.rotation.y = (intro.camA || 0) + 0.42 + 0.3 * Math.sin(t * 0.9);   // the sign always floats behind the car, never in front of the camera
  show.names.position.y = 2.7;
  show.plates.forEach((p, i) => {
    const k = clamp((t - 0.25 - i * 0.2) / 0.8, 0, 1), out = clamp((t - (INTRO_T - 0.45)) / 0.4, 0, 1);
    p.plate.scale.setScalar(Math.max(0.001, 1.0 * easeOutBack(k) * (1 - smooth(out))));
    p.plate.position.y = Math.sin(t * 1.8 + i * 2) * 0.18;
    p.plate.getWorldPosition(_v3);
    p.plate.lookAt(camera.position.x, _v3.y, camera.position.z);
    p.plate.rotateY((1 - smooth(k)) * Math.PI * 2 + Math.sin(t * 1.3 + i) * 0.22);
    p.glow.material.opacity = 0.42 + 0.22 * Math.sin(t * 4 + i * 2);
  });
}
function emitGold(age = 0) {
  const a = rand(0, 6.28), r = rand(1.5, 15);
  const life = rand(6, 11);
  show.parts.emit({ x: Math.cos(a) * r, y: rand(-0.5, 7), z: Math.sin(a) * r, vx: rand(-0.15, 0.15), vy: rand(0.12, 0.45), vz: rand(-0.15, 0.15), life, size: rand(0.05, 0.12), r: 1, g: rand(0.7, 0.85), b: 0.3, a: rand(0.5, 1) });
  const q = show.parts.p[show.parts.p.length - 1]; q.t = Math.min(age, life * 0.8);
}
function setSpots(k) { show.spots.forEach(s => s.intensity = 170 * k); show.strips.forEach(m => m.material.color.setScalar((0.12 + 0.88 * k) * 1.7).multiply(new THREE.Color(m.position.x > 0 ? 0x8fd8ff : 0xffd79a))); }

function updateShowroom(dt) {
  show.parts.update(dt);
  if (show.parts.p.length < 260) emitGold();
  show.ring.material.color.setHSL(0.11, 1, 0.55 + Math.sin(performance.now() / 400) * 0.1);
  const car = show.cars[selCar];
  if (mode === 'intro') { updateIntro(dt); return; }
  if (!show.drag) show.tAngle += dt * 0.12;
  show.angle = damp(show.angle, show.tAngle, 6, dt);
  show.table.rotation.y += dt * 0.25 + show.spin * dt; show.spin = damp(show.spin, 0, 3, dt);
  const narrow = innerWidth < 820;
  const d = show.dist * (narrow ? 1.25 : 1), cy = 0.9;
  _v.set(Math.sin(show.angle) * d * Math.cos(show.pitch), cy + Math.sin(show.pitch) * d + 0.6, Math.cos(show.angle) * d * Math.cos(show.pitch));
  camera.position.lerp(_v, 1 - Math.exp(-4 * dt));
  camera.lookAt(0, narrow ? 0.4 : 0.75, 0);
  if (camera.fov !== 46) { camera.fov = 46; camera.updateProjectionMatrix(); show.parts.setScale(innerHeight, 46); }
  animateCar(car, 0, 0, dt, 0, false);
}

// ---------- intro timeline
const intro = { t: 0, cut: 0 };
function startIntro() {
  mode = 'intro'; showScreen('intro'); intro.t = 0; intro.cut = 0;
  const el = $('intro'); el.classList.remove('letter'); void el.offsetWidth; el.classList.add('letter');
  $('introTitle').classList.remove('show'); $('introLogo').classList.remove('show'); document.querySelectorAll('.badge').forEach(b => b.classList.remove('show'));
  show.cars.forEach((c, i) => c.visible = i === selCar); show.table.rotation.y = 0; setSpots(0.18);
  show.names.rotation.y = 0; show.names.visible = true; intro.ringY = null; show.plates.forEach(p => p.plate.scale.setScalar(0.001));
  setIntroFov();
}
function setIntroFov() { const asp = innerWidth / innerHeight; camera.fov = Math.min(82, asp >= 1.6 ? 50 : 50 * Math.pow(1.6 / asp, 0.7)); camera.updateProjectionMatrix(); show.parts.setScale(innerHeight, camera.fov); }
function flash(op = 0.85) { const f = $('flash'); f.style.transition = 'none'; f.style.opacity = op; requestAnimationFrame(() => { f.style.transition = 'opacity .35s'; f.style.opacity = 0; }); }
const INTRO_T = 4.8;
function updateIntro(dt) {   // one continuous camera sweep: front -> side -> rear (flames) -> rear three-quarter hero shot
  intro.t += Math.min(dt, 0.034); const t = intro.t, car = show.cars[selCar];
  const k = smooth(clamp(t / INTRO_T, 0, 1)), a = lerp(-0.55, Math.PI + 1.35, k);
  const asp = innerWidth / innerHeight, dm = asp >= 1 ? 1 : Math.min(1.5, Math.pow(1 / asp, 0.57)), rad = lerp(11.5, 13, k) * dm;
  intro.camA = a; camera.position.set(Math.sin(a) * rad, lerp(1.0, 2.3, k), Math.cos(a) * rad); camera.lookAt(0, lerp(1.85, 2.0, k), 0);
  setSpots(lerp(0.18, 1, smooth(clamp((t - 0.4) / 2.2, 0, 1))));
  updateNamePlates(dt, t);
  const fl = Math.abs(wrapAng(a - Math.PI)) < 0.75;
  animateCar(car, 0, 0, dt, t, fl);
  if (fl) for (const sx of [-0.2, 0.2]) { const q = worldPoint(car, sx, 0.5, -2.9); show.parts.emit({ x: q.x, y: q.y, z: q.z, vx: rand(-0.4, 0.4), vy: rand(-0.2, 0.4), vz: rand(-3, -1.5), life: 0.35, size: 0.12, size1: 0.02, r: 0.4, g: 0.75, b: 1 }); }
  show.table.rotation.y += dt * 0.2;
  if (t > 0.2) $('introTitle').classList.add('show');
  document.querySelectorAll('.badge').forEach((b, i) => { if (t > 0.5 + i * 0.2) b.classList.add('show'); });
  if (t > 2.9) $('introTitle').classList.remove('show');
  if (t > 3.2) $('introLogo').classList.add('show');
  if (t > INTRO_T) endIntro();
}
function endIntro() {
  if (mode !== 'intro') return;
  setTimeout(() => { for (const t of TRACKS) if (!TD_CACHE[t.id]) TD_CACHE[t.id] = makeTrackData(t); }, 600);   // heavy pre-computation waits until the intro is over
  animateCar(show.cars[selCar], 0, 0, 0, 0, false);
  $('intro').classList.remove('letter'); setSpots(1); show.names.visible = false;
  show.tAngle = show.angle = Math.atan2(camera.position.x, camera.position.z);
  toMenu(true);
}

// ============================================================
//  SCREENS & MENU
// ============================================================
function showScreen(name) {
  for (const id of ['intro', 'menu', 'hud']) $(id).classList.toggle('on', id === name);
  $('touch').classList.toggle('on', name === 'hud' && IS_TOUCH);
}
function openModal(id) { $(id).classList.add('on'); }
function closeModal(id) { $(id).classList.remove('on'); }
function closeAllModals() { document.querySelectorAll('.modal').forEach(m => m.classList.remove('on')); }
function toMenu(fromIntro = false) {
  closeAllModals();
  disposeRace();
  Sfx.engineStop();
  for (const k in input) input[k] = false;
  mode = 'menu'; showScreen('menu'); renderMenu();
  if (!fromIntro) { setSpots(1); camera.position.set(Math.sin(show.angle) * 12, 3, Math.cos(show.angle) * 12); }
}
function renderMenu() {
  const c = CARS[selCar];
  $('carName').textContent = c.name; $('carIdx').textContent = `${selCar + 1} / ${CARS.length}`;
  $('carLivery').textContent = c.livery;
  $('stTop').style.width = (c.top / 400 * 100) + '%'; $('stTopV').textContent = c.top + ' km/h';
  $('stAcc').style.width = c.acc + '%'; $('stAccV').textContent = c.acc + ' %';
  $('stHan').style.width = c.hand + '%'; $('stHanV').textContent = c.hand + ' %';
  $('carSpecial').textContent = '★ ' + c.special;
  show.cars.forEach((m, i) => m.visible = i === selCar);
  document.querySelectorAll('.tcard').forEach((el, i) => el.classList.toggle('sel', i === selTrack));
  try { localStorage.setItem('apex_car', selCar); localStorage.setItem('apex_track', selTrack); } catch (_) {}
  if ($('modeSeg').children.length) renderDiff();
}
function buildTrackCards() {
  const tp = $('trackPanel');
  TRACKS.forEach((t, i) => {
    const d = document.createElement('div'); d.className = 'tcard';
    d.innerHTML = `<div class="sw" style="background:${t.color}"></div><h3></h3><div class="meta"><span>${t.laps} RUNDEN</span><span>${t.ramps} RAMPEN</span><span>VERSCHLEISS ${String(t.wear).replace('.', ',')}×</span></div><p></p>`;
    d.querySelector('h3').textContent = t.name; d.querySelector('p').textContent = t.desc;
    d.onclick = () => { selTrack = i; renderMenu(); Sfx.blip(660, 0.06, 'square', 0.08, 1); };
    tp.appendChild(d);
  });
}
function buildDiffSel() {
  const seg3 = (el, items, color, onPick) => items.forEach(([label, col], i) => { const b = document.createElement('button'); b.textContent = label; b.style.setProperty('--dc', col || color); b.onclick = () => { onPick(i); renderDiff(); Sfx.blip(520 + i * 160, 0.07, 'square', 0.08, 1); }; el.appendChild(b); });
  seg3($('modeSeg'), [['RENNEN'], ['COUNTDOWN-ENDLOS']], '#ffcf5a', (i) => { selMode = i ? 'endless' : 'race'; });
  seg3($('diffSeg'), DIFFS.map(d => [d.name.toUpperCase(), d.color]), '', (i) => { selDiff = i; });
  seg3($('tyreSeg'), TYRES.slice(0, 3).map(t => [t.name.toUpperCase(), t.color]), '', (i) => { selTyre = i; });
  renderDiff();
}
function renderDiff() {
  const end = selMode === 'endless', best = loadEndBest(TRACKS[selTrack].id);
  [...$('modeSeg').children].forEach((b, i) => b.classList.toggle('sel', (i === 1) === end));
  [...$('diffSeg').children].forEach((b, i) => b.classList.toggle('sel', i === selDiff));
  [...$('tyreSeg').children].forEach((b, i) => b.classList.toggle('sel', i === selTyre));
  $('diffSeg').style.display = end ? 'none' : 'flex'; $('tyreSeg').style.display = end ? 'flex' : 'none';
  $('diffLbl').textContent = end ? 'REIFEN' : 'STUFE';
  $('diffInfo').textContent = end ? `Die Uhr läuft ab, Checkpoints geben immer weniger Zeit. Wetter und Reifen entscheiden. ${best > 30 ? 'Dein Rekord hier: ' + fmtM(best) : 'Noch kein Rekord auf dieser Strecke.'}` : DIFFS[selDiff].info;
  $('startBtn').textContent = end ? 'COUNTDOWN STARTEN ▶' : 'RENNEN STARTEN ▶';
  try { localStorage.setItem('apex_diff', selDiff); localStorage.setItem('apex_mode', selMode); localStorage.setItem('apex_tyre', selTyre); } catch (_) {}
}
function changeCar(dir) { selCar = (selCar + dir + CARS.length) % CARS.length; show.spin = 6 * dir; renderMenu(); Sfx.blip(dir > 0 ? 880 : 740, 0.08, 'square', 0.08, 1); }
function beginRace() {
  Sfx.init(); closeAllModals();
  $('loadTxt').textContent = 'STRECKE WIRD GEBAUT …'; $('loading').style.display = 'flex';
  setTimeout(() => {
    try { startRace(selCar, selTrack); mode = 'race'; showScreen('hud'); }
    catch (e) { console.error(e); toMenu(); }
    $('loading').style.display = 'none';
  }, 30);
}
function pauseRace() { if (!race || mode !== 'race' || !['race', 'countdown'].includes(race.state) || race.player.finished) return; race.prevState = race.state; race.state = 'paused'; openModal('pause'); Sfx.engineUpdate(1400, 0, false, false); }
function resumeRace() { if (!race || race.state !== 'paused') return; race.state = race.prevState || 'race'; closeModal('pause'); Sfx.init(); }

// ============================================================
//  HUD
// ============================================================
const hudC = {};
const setT = (id, v) => { if (hudC[id] !== v) { hudC[id] = v; $(id).textContent = v; } };
const setH = (id, v) => { if (hudC[id] !== v) { hudC[id] = v; $(id).innerHTML = v; } };
let rpmSegs = [];
function resetHud() {
  for (const k in hudC) delete hudC[k];
  const r = $('rpm'); r.innerHTML = ''; rpmSegs = [];
  for (let i = 0; i < 26; i++) { const s = document.createElement('i'); r.appendChild(s); rpmSegs.push(s); }
  $('msgs').innerHTML = ''; $('countdown').textContent = '';
  $('dmgBanner').style.display = 'none'; $('pitBanner').style.display = 'none'; $('lapSplit').classList.remove('on'); clearTimeout(splitTimer);
}
function showMsg(text, color = '#fff') {
  const m = $('msgs'); while (m.children.length > 3) m.firstChild.remove();
  const d = document.createElement('div'); d.className = 'msg'; d.style.color = color; d.textContent = text; m.appendChild(d);
  setTimeout(() => d.remove(), 1700);
}
// ---------- lap splits & personal record
function loadPB(id) { try { const v = +localStorage.getItem('apex_pb2_' + id); return v > 0 ? v : null; } catch (_) { return null; } }
function savePB(id, ms) { try { localStorage.setItem('apex_pb2_' + id, String(ms)); } catch (_) {} }
function fmtDelta(sec) { const a = Math.abs(sec); return (sec < 0 ? '−' : '+') + a.toFixed(2).replace('.', ',') + ' s'; }
let splitTimer = null;
function showLapSplit(lapNo, lt, prevLap, prevBest, isBest, isPB, pbBefore) {
  const el = $('lapSplit'); el.innerHTML = '';
  const line = (cls, txt) => { const d = document.createElement('div'); d.className = cls; d.textContent = txt; el.appendChild(d); return d; };
  line('t1', race.mode === 'endless' ? `RUNDE ${lapNo}` : `RUNDE ${lapNo} / ${race.laps}`);
  line('t2', fmtTime(lt * 1000));
  if (prevLap != null) {
    const d = lt - prevLap, t3 = line('t3 ' + (d < 0 ? 'dFast' : 'dSlow'), fmtDelta(d));
    const sm = document.createElement('small'); sm.textContent = `vs. Runde ${lapNo - 1}`; t3.appendChild(sm);
  } else if (pbBefore != null) {
    const d = lt - pbBefore / 1000, t3 = line('t3 ' + (d < 0 ? 'dFast' : 'dSlow'), fmtDelta(d));
    const sm = document.createElement('small'); sm.textContent = 'vs. Rekord'; t3.appendChild(sm);
  }
  if (isBest) line('t4', '⚡ NEUE BESTE RUNDE');
  else if (prevBest != null) line('t4', `Beste Runde: ${fmtTime(prevBest * 1000)} (${fmtDelta(lt - prevBest)})`);
  if (isPB) line('t5', '🏆 NEUER STRECKENREKORD!');
  el.classList.remove('on'); void el.offsetWidth; el.classList.add('on');
  clearTimeout(splitTimer); splitTimer = setTimeout(() => el.classList.remove('on'), 4200);
}
let lastRpmLit = -1;
function updateHud() {
  const p = race.player;
  const end = race.mode === 'endless';
  setH('hPos', `${p.place}<small>/${race.cars.length}</small>`);
  setT('hLap', end ? String(p.lapsDone + 1) : `${clamp(p.lapsDone + 1, 1, race.laps)}/${race.laps}`);
  setT('hTime', fmtTime(race.raceTime * 1000));
  setT('hBest', fmtTime(p.bestLap == null ? null : p.bestLap * 1000));
  setT('hLast', fmtTime(p.lastLap == null ? null : p.lastLap * 1000));
  setT('hPB', fmtTime(race.pb));
  const lt = p.lapTimes, ld = lt.length > 1 ? lt[lt.length - 1] - lt[lt.length - 2] : null;
  const ldTxt = ld == null ? '' : fmtDelta(ld);
  if (hudC.ld !== ldTxt) { hudC.ld = ldTxt; const e = $('hLastD'); e.textContent = ldTxt; e.className = ld == null ? '' : ld < 0 ? 'dFast' : 'dSlow'; }
  setT('hScore', end ? fmtM(p.progress) : fmtNum(totalScore(p)));
  setT('hCoins', String(p.coins));
  const hp = Math.max(0, Math.ceil(p.health));
  setT('hHealth', hp + ' %'); const hbg = hp < 30 ? 'linear-gradient(90deg,#c01616,#ff5a5a)' : hp < 60 ? 'linear-gradient(90deg,#d0a016,#ffd84d)' : 'linear-gradient(90deg,#16c060,#5dff9d)';
  if (hudC.hpW !== hp) { hudC.hpW = hp; $('hHealthBar').style.width = hp + '%'; }
  if (hudC.hpB !== hbg) { hudC.hpB = hbg; $('hHealthBar').style.background = hbg; }
  const nit = Math.round(p.nitro); setT('hNitro', nit + ' %'); if (hudC.nitW !== nit) { hudC.nitW = nit; $('hNitroBar').style.width = nit + '%'; }
  setH('hSpeed', `${Math.round(Math.hypot(p.speed, p.vlat) * 3.6)}<small>km/h</small>`);
  setH('hGear', `${hudGear(p)}<small>GANG</small>`);
  const rpm = hudRpm(p), lit = Math.round((rpm - 1400) / 7600 * rpmSegs.length);
  if (lit !== lastRpmLit) { lastRpmLit = lit; rpmSegs.forEach((s, i) => { s.style.background = i < lit ? (i > rpmSegs.length - 5 ? '#ff3b3b' : i > rpmSegs.length - 10 ? '#ffcf5a' : '#38ff8b') : 'rgba(255,255,255,.08)'; }); }
  setT('rpmTxt', fmtNum(Math.round(rpm / 50) * 50) + ' RPM');
  const showDmg = p.health < 30 && !p.wrecked && !p.finished && !p.inPit;
  if (hudC.dmg !== showDmg) { hudC.dmg = showDmg; $('dmgBanner').style.display = showDmg ? 'block' : 'none'; }
  const pitTxt = p.inPit && !p.wrecked ? (p.health < 99.5 ? '🔧 BOXENGASSE · REPARATUR ' + Math.floor(p.health) + ' %' : '✅ BOXENGASSE · PIT-LIMITER 180 km/h') : '';
  if (hudC.pit !== pitTxt) { hudC.pit = pitTxt; $('pitBanner').style.display = pitTxt ? 'block' : 'none'; $('pitBanner').textContent = pitTxt; }
  if (hudC.vig !== p.nitroOn) { hudC.vig = p.nitroOn; $('vignette').style.opacity = p.nitroOn ? 1 : 0; }
  // sector pills: colour of the last result per sector, white frame = the sector you are in
  const S = p.sec, sk = S.col.join('') + S.i + '.' + S.n;
  if (hudC.sec !== sk) { hudC.sec = sk; for (let i = 0; i < 3; i++) $('sec' + i).className = 'sec' + (S.col[i] ? ' c' + S.col[i] : '') + (i === S.i && !p.finished ? ' cur' : '') + (S.pop === i ? ' pop' : ''); }
  if (race.t - (mm.t || -1) > 0.045) { mm.t = race.t; drawMinimap(); }   // 20 pictures a second are plenty for the map
}
// minimap
const mm = { base: null, sc: 1, ox: 0, oz: 0 };
function setupMinimap() {
  const td = race.td, c = document.createElement('canvas'); c.width = c.height = 360; const g = c.getContext('2d');
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const p of td.P) { minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x); minZ = Math.min(minZ, p.z); maxZ = Math.max(maxZ, p.z); }
  const pad = 26, sc = (360 - 2 * pad) / Math.max(maxX - minX, maxZ - minZ);
  mm.sc = sc; mm.cx = (minX + maxX) / 2; mm.cz = (minZ + maxZ) / 2;
  const P = (x, z) => [180 - (x - mm.cx) * sc, 180 - (z - mm.cz) * sc];
  g.lineJoin = g.lineCap = 'round';
  const path = (lat, s0 = 0, s1 = td.L) => { g.beginPath(); for (let s = s0; s <= s1; s += 8) { const q = td.at(s, lat), [x, y] = P(q.x, q.z); s === s0 ? g.moveTo(x, y) : g.lineTo(x, y); } };
  path(0); g.closePath(); g.strokeStyle = 'rgba(0,0,0,.6)'; g.lineWidth = 14; g.stroke(); g.strokeStyle = '#59606e'; g.lineWidth = 9; g.stroke(); g.strokeStyle = '#d9dee8'; g.lineWidth = 3; g.stroke();
  path(28, PIT_S0 + 15, PIT_S1 - 15); g.strokeStyle = '#38ff8b'; g.lineWidth = 5; g.stroke();
  for (const r of td.ramps) { const q = td.at(r.s, r.lat), [x, y] = P(q.x, q.z); g.fillStyle = '#3bd5ff'; g.fillRect(x - 3, y - 3, 6, 6); }
  const a = td.at(0, -20), b = td.at(0, 20), [ax, ay] = P(a.x, a.z), [bx, by] = P(b.x, b.z); g.strokeStyle = '#fff'; g.lineWidth = 4; g.beginPath(); g.moveTo(ax, ay); g.lineTo(bx, by); g.stroke();
  for (const k of [1, 2]) { const s = td.L * k / 3, a2 = td.at(s, -16), b2 = td.at(s, 16), [x1, y1] = P(a2.x, a2.z), [x2, y2] = P(b2.x, b2.z); g.strokeStyle = '#ff9f1c'; g.lineWidth = 3; g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke(); }   // sector borders
  mm.base = c; mm.P = P; mm.t = -1;
}
function drawMinimap() {
  const cv = $('minimap'), g = cv.getContext('2d'); g.clearRect(0, 0, 360, 360); g.drawImage(mm.base, 0, 0);
  for (const a of race.ais) { const [x, y] = mm.P(a.x, a.z); g.fillStyle = '#ffd400'; g.strokeStyle = '#000'; g.lineWidth = 2; g.beginPath(); g.arc(x, y, race.ais.length > 3 ? 5.5 : 7, 0, 7); g.fill(); g.stroke(); }
  const p = race.player, [x, y] = mm.P(p.x, p.z);
  g.save(); g.translate(x, y); g.rotate(-p.heading + Math.PI);
  g.fillStyle = '#2e8bff'; g.strokeStyle = '#fff'; g.lineWidth = 2.5; g.beginPath(); g.arc(0, 0, 9, 0, 7); g.fill(); g.stroke();
  g.fillStyle = '#fff'; g.beginPath(); g.moveTo(0, 14); g.lineTo(-5, 7); g.lineTo(5, 7); g.fill(); g.restore();
}

// ============================================================
//  RESULTS & LEADERBOARD
// ============================================================
const PRESET = [
  { id: 'pre-a', name: 'Adrian', score: 28450, car: 'Vortex V12', track: 'Alpenpass Grand Tour', trackId: 'alps', diff: 'Schwer', bestLap: 56200, preset: true },
  { id: 'pre-k', name: 'Konsti', score: 34900, car: 'Inferno GT-R', track: 'Grand Prix Endurance', trackId: 'gp', diff: 'Profi', bestLap: 52400, preset: true },
  { id: 'pre-j', name: 'Julien', score: 31260, car: 'Polaris R', track: 'Tokyo Bay Highway', trackId: 'tokyo', diff: 'Schwer', bestLap: 49800, preset: true },
];
const LB = { shared: null, local: [], eShared: null, eLocal: [], mode: 'race', db: null, lastId: null, tab: 'all', note: '' };
try { LB.local = JSON.parse(localStorage.getItem('apex_hd3d_lb') || '[]').map(cleanEntry).filter(Boolean); } catch (_) { LB.local = []; }
try { LB.eLocal = JSON.parse(localStorage.getItem('apex_hd3d_lb_end') || '[]').map(cleanEntry).filter(Boolean); } catch (_) { LB.eLocal = []; }
function cleanEntry(e) {
  if (!e || typeof e.name !== 'string' || !isFinite(+e.score)) return null;
  return { id: String(e.id || ''), name: e.name.slice(0, 16), score: Math.max(0, Math.round(+e.score)), car: String(e.car || '').slice(0, 24), track: String(e.track || '').slice(0, 32), trackId: String(e.trackId || ''), diff: DIFFS.some(d => d.name === e.diff) ? e.diff : '', bestLap: isFinite(+e.bestLap) && e.bestLap != null ? +e.bestLap : null, stops: Math.max(0, Math.round(+e.stops || 0)), date: String(e.date || '') };
}
async function lbInitShared() {
  for (let i = 0; i < 40 && !(window.claude && typeof window.claude.use === 'function'); i++) await new Promise(r => setTimeout(r, 100));
  if (!(window.claude && typeof window.claude.use === 'function')) return;
  let db = null; try { db = await window.claude.use('db'); } catch (_) { db = null; }
  if (!db) return;
  LB.db = db;
  const timer = setTimeout(() => { if (LB.shared === null) { LB.note = 'Online-Bestenliste gerade nicht erreichbar – Einträge werden lokal gespeichert.'; renderLB(); } }, 10000);
  try {
    db.collection('scores').orderBy('score', 'desc').limit(200).onSnapshot(snap => {
      clearTimeout(timer); LB.note = '';
      LB.shared = snap.docs.map(d => cleanEntry({ ...d.data(), id: d.id })).filter(Boolean); renderLB();
    }, () => { clearTimeout(timer); LB.db = null; renderLB(); });
    db.collection('endless').orderBy('score', 'desc').limit(200).onSnapshot(snap => { LB.eShared = snap.docs.map(d => cleanEntry({ ...d.data(), id: d.id })).filter(Boolean); renderLB(); }, () => {});
  } catch (_) { LB.db = null; }
}
async function lbSave(entry, end) {
  if (LB.db) { try { const ref = await LB.db.collection(end ? 'endless' : 'scores').add(entry); LB.lastId = ref.id; return 'shared'; } catch (_) { /* fall back */ } }
  entry.id = 'local-' + Date.now(); (end ? LB.eLocal : LB.local).push(entry); LB.lastId = entry.id;
  try { localStorage.setItem(end ? 'apex_hd3d_lb_end' : 'apex_hd3d_lb', JSON.stringify((end ? LB.eLocal : LB.local).slice(-150))); } catch (_) {}
  return 'local';
}
function renderLB() {
  const end = LB.mode === 'endless', tabs = $('lbTabs'); tabs.innerHTML = '';
  const tab = (label, sel, fn, cls) => { const b = document.createElement('button'); b.textContent = label; b.className = (sel ? 'sel ' : '') + (cls || ''); b.onclick = () => { fn(); renderLB(); }; tabs.appendChild(b); };
  tab('🏁 RENNEN', !end, () => { LB.mode = 'race'; }, 'modeTab'); tab('⏱ COUNTDOWN-ENDLOS', end, () => { LB.mode = 'endless'; }, 'modeTab');
  const br = document.createElement('i'); br.className = 'tabBreak'; tabs.appendChild(br);
  [['all', 'ALLE STRECKEN'], ...TRACKS.map(t => [t.id, t.name.toUpperCase()])].forEach(([id, label]) => tab(label, LB.tab === id, () => { LB.tab = id; }));
  $('lbH2').textContent = end ? 'DISTANZ' : 'SCORE'; $('lbH5').textContent = end ? 'STOPPS' : 'STUFE'; $('lbH6').textContent = end ? 'ÜBERLEBT' : 'BESTZEIT';
  const seen = new Set(), list = [], src = end ? [...(LB.eShared || []), ...LB.eLocal] : [...PRESET, ...(LB.shared || []), ...LB.local];
  for (const e of src) { if (!e.id || seen.has(e.id)) continue; seen.add(e.id); if (LB.tab === 'all' || e.trackId === LB.tab) list.push(e); }
  list.sort((a, b) => b.score - a.score);
  const body = $('lbBody'); body.innerHTML = '';
  list.slice(0, 30).forEach((e, i) => {
    const tr = document.createElement('tr'); if (e.id === LB.lastId) tr.className = 'me'; if (e.preset) tr.className += ' pre';
    const cells = [String(i + 1), e.name, end ? fmtM(e.score) : fmtNum(e.score), e.car, e.track, end ? String(e.stops) : (e.diff || '–'), fmtTime(e.bestLap)];
    cells.forEach((c, k) => { const td = document.createElement('td'); td.textContent = c; if (k === 2 || k === 6) td.className = 'num'; if (k === 5 && !end && e.diff) { const d = DIFFS.find(x => x.name === e.diff); if (d) { td.style.color = d.color; td.style.fontWeight = '700'; } } tr.appendChild(td); });
    body.appendChild(tr);
  });
  if (!list.length) { const tr = document.createElement('tr'), td = document.createElement('td'); td.colSpan = 7; td.textContent = 'Noch keine Einträge – hol dir den ersten Rekord!'; td.style.color = '#9aa6c2'; tr.appendChild(td); body.appendChild(tr); }
  const online = LB.db && (end ? LB.eShared : LB.shared);
  $('lbNote').textContent = (LB.note ? LB.note + ' ' : '') + (online ? '🌐 Geteilte Bestenliste – alle mit Zugriff auf das Spiel sehen dieselben Rekorde.' : '💾 Lokale Bestenliste (in diesem Browser gespeichert).') + (end ? '' : ' ★ = voreingestellter Rekord.');
}
function showEndResults() {
  const p = race.player, t = TRACKS[race.trackIdx], E = race.end, rec = E.dist > E.prevBest;
  $('placeBig').textContent = '⏱'; $('resTitle').textContent = rec && E.prevBest > 30 ? '🏆 NEUER REKORD!' : 'ZEIT ABGELAUFEN';
  $('resSub').textContent = `${p.spec.name} · ${t.name} · Countdown-Endlos`;
  const rows = [
    ['Bisheriger Rekord', E.prevBest > 30 ? fmtM(E.prevBest) : '–'], ['Überlebt', fmtTime(E.time * 1000)], ['Checkpoints', String(E.cps)], ['Runden', String(p.lapsDone)],
    ['Boxenstopps', E.pit.stops ? `${E.pit.stops} (${fmtS(E.pit.total)} s Standzeit)` : '0'], ['Überholmanöver', String(E.passes)], ['Boost Coins', String(p.coins)], ['Letzter Reifen', `${TYRES[E.tyre].name} · ${Math.round(E.cond * 100)} %`],
  ];
  const kv = $('resKv'); kv.innerHTML = '';
  for (const [k, v] of rows) { const a = document.createElement('span'), b = document.createElement('span'); a.textContent = k; b.textContent = v; kv.append(a, b); }
  const a = document.createElement('span'), b = document.createElement('span'); a.textContent = 'DISTANZ'; a.className = 'tot';
  b.textContent = fmtM(E.dist) + (E.prevBest > 30 ? `  (${rec ? '+' : '−'}${fmtM(Math.abs(E.dist - E.prevBest))})` : ''); b.className = 'tot'; kv.append(a, b);
  let nm = ''; try { nm = localStorage.getItem('apex_name') || ''; } catch (_) {}
  $('nameIn').value = nm; $('saveNote').textContent = 'Taste R: sofort nochmal fahren'; $('saveBtn').disabled = false; $('saveBtn').style.opacity = 1;
  openModal('results');
}
function showResults() {
  if (!race || race.resultsShown) return; race.resultsShown = true;
  if (race.mode === 'endless') return showEndResults();
  const p = race.player, t = TRACKS[race.trackIdx];
  $('placeBig').textContent = p.place + '.'; $('resTitle').textContent = 'ZIELFLAGGE 🏁';
  $('resSub').textContent = `${p.spec.name} · ${t.name} · Gegner: ${DIFFS[race.diff].name}`;
  const rows = [
    ['Rennzeit', fmtTime(p.finishTime * 1000)], ['Beste Runde', fmtTime(p.bestLap * 1000)],
    [`Boost Coins (${p.coins} × 250)`, '+' + fmtNum(p.pts.coins)], ['Nitro-Einsatz', '+' + fmtNum(p.pts.nitro)],
    ['Airtime-Stunts', '+' + fmtNum(p.pts.air)], ['Drift-Bonus', '+' + fmtNum(p.pts.drift)], [`Runden-Bonus (${race.laps} × 1.500)`, '+' + fmtNum(p.pts.laps)],
    [`Platzierung (${p.place}. Platz)`, '+' + fmtNum(p.pts.place)],
  ];
  const lapRows = p.lapTimes.map((t, i) => [`  Runde ${i + 1}${t === p.bestLap ? ' ⚡' : ''}`, fmtTime(t * 1000) + (i > 0 ? `  (${fmtDelta(t - p.lapTimes[i - 1])})` : '')]);
  rows.splice(2, 0, ...lapRows);
  if (p.repairs) rows.push([`Notfall-Reparaturen (${p.repairs}×)`, fmtNum(p.pts.repair)]);
  const kv = $('resKv'); kv.innerHTML = '';
  for (const [k, v] of rows) { const a = document.createElement('span'), b = document.createElement('span'); a.textContent = k; b.textContent = v; kv.append(a, b); }
  const a = document.createElement('span'), b = document.createElement('span'); a.textContent = 'GESAMT-SCORE'; a.className = 'tot'; b.textContent = fmtNum(totalScore(p)); b.className = 'tot'; kv.append(a, b);
  let nm = ''; try { nm = localStorage.getItem('apex_name') || ''; } catch (_) {}
  $('nameIn').value = nm; $('saveNote').textContent = ''; $('saveBtn').disabled = false; $('saveBtn').style.opacity = 1;
  openModal('results');
}
async function saveScore() {
  if (!race) return;
  const p = race.player, t = TRACKS[race.trackIdx];
  const name = $('nameIn').value.trim().slice(0, 16);
  if (!name) { $('saveNote').textContent = 'Bitte gib zuerst deinen Fahrernamen ein.'; $('nameIn').focus(); return; }
  try { localStorage.setItem('apex_name', name); } catch (_) {}
  $('saveBtn').disabled = true; $('saveBtn').style.opacity = 0.5; $('saveNote').textContent = 'Speichere …';
  const end = race.mode === 'endless', E = race.end;
  const entry = end ? { name, score: E.dist, car: p.spec.name, track: t.name, trackId: t.id, stops: E.pit.stops, bestLap: Math.round(E.time * 1000), date: new Date().toISOString() }
    : { name, score: totalScore(p), car: p.spec.name, track: t.name, trackId: t.id, diff: DIFFS[race.diff].name, bestLap: Math.round(p.bestLap * 1000), place: p.place, date: new Date().toISOString() };
  const where = await lbSave(entry, end); LB.mode = end ? 'endless' : 'race';
  $('saveNote').textContent = where === 'shared' ? '✅ In der geteilten Bestenliste gespeichert!' : '✅ In der Bestenliste gespeichert (lokal in diesem Browser).';
  LB.tab = t.id; renderLB(); openModal('lb');
}

// ============================================================
//  INPUT
// ============================================================
const KEYMAP = { KeyX: 'drift', Enter: 'drift', KeyW: 'gas', ArrowUp: 'gas', KeyS: 'brake', ArrowDown: 'brake', KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right', Space: 'nitro', ShiftLeft: 'nitro', ShiftRight: 'nitro' };
addEventListener('keydown', (e) => {
  if (e.target && e.target.tagName === 'INPUT') { if (e.key === 'Enter') saveScore(); return; }
  Sfx.init();
  if (mode === 'intro') { if (['Enter', 'Space', 'Escape'].includes(e.code)) endIntro(); return; }
  if (mode === 'menu') {
    if (document.querySelector('.modal.on')) { if (e.code === 'Escape') closeAllModals(); return; }
    if (e.code === 'ArrowLeft' || e.code === 'KeyA') changeCar(-1);
    if (e.code === 'ArrowRight' || e.code === 'KeyD') changeCar(1);
    if (e.code === 'ArrowUp' || e.code === 'KeyW') { selTrack = (selTrack + 2) % 3; renderMenu(); }
    if (e.code === 'ArrowDown' || e.code === 'KeyS') { selTrack = (selTrack + 1) % 3; renderMenu(); }
    if (e.code === 'Enter') beginRace();
    return;
  }
  if (mode === 'race') {
    const k = KEYMAP[e.code]; if (k) { input[k] = true; e.preventDefault(); }
    if (e.code === 'KeyP' || e.code === 'Escape') { if (race?.state === 'paused') resumeRace(); else pauseRace(); }
    if (race && race.mode === 'endless') { const m = /^(?:Digit|Numpad)([1-4])$/.exec(e.code); if (m) pitChoose(+m[1] - 1); }
    if (e.code === 'KeyR' && race && race.resultsShown) { closeAllModals(); beginRace(); return; }
    if (e.code === 'KeyC' && race) race.camMode = (race.camMode + 1) % 3;
    if (e.code === 'KeyM') Sfx.setMuted(!Sfx.muted);
    if (e.code === 'KeyL') toggleLine();
  }
});
addEventListener('keyup', (e) => { const k = KEYMAP[e.code]; if (k) input[k] = false; });
addEventListener('blur', () => { for (const k in input) input[k] = false; });
document.addEventListener('visibilitychange', () => { if (document.hidden) pauseRace(); });
document.querySelectorAll('.tb').forEach(el => {
  const k = el.dataset.k;
  const on = (e) => { e.preventDefault(); Sfx.init(); input[k] = true; el.classList.add('act'); try { el.setPointerCapture(e.pointerId); } catch (_) {} };
  const off = (e) => { e.preventDefault(); input[k] = false; el.classList.remove('act'); };
  el.addEventListener('pointerdown', on); el.addEventListener('pointerup', off); el.addEventListener('pointercancel', off); el.addEventListener('lostpointercapture', off);
});
// showroom drag
canvas.addEventListener('pointerdown', (e) => { if (mode !== 'menu') return; show.drag = { x: e.clientX, a: show.tAngle }; });
addEventListener('pointermove', (e) => { if (show.drag) show.tAngle = show.drag.a - (e.clientX - show.drag.x) * 0.008; });
addEventListener('pointerup', () => { show.drag = null; });

// buttons
$('skipBtn').onclick = endIntro;
$('carPrev').onclick = () => changeCar(-1); $('carNext').onclick = () => changeCar(1);
$('startBtn').onclick = beginRace;
$('introBtn').onclick = () => { closeAllModals(); startIntro(); };
$('lbBtn').onclick = () => { LB.tab = 'all'; LB.mode = selMode; renderLB(); openModal('lb'); };
$('keysBtn').onclick = () => openModal('keys');
$('keysClose').onclick = () => closeModal('keys');
$('lbClose').onclick = () => closeModal('lb');
$('pauseBtn').onclick = () => pauseRace();
$('muteBtn').onclick = () => { Sfx.init(); Sfx.setMuted(!Sfx.muted); };
$('camBtn').onclick = () => { if (race) race.camMode = (race.camMode + 1) % 3; };
$('resumeBtn').onclick = resumeRace;
$('lineBtn').onclick = toggleLine; $('lineBtn').textContent = 'IDEALLINIE: ' + (LINE.on ? 'AN' : 'AUS');
$('restartBtn').onclick = () => { closeAllModals(); beginRace(); };
$('menuBtn').onclick = () => toMenu();
$('repairBtn').onclick = () => { if (race) emergencyRepair(); };
$('wreckRestart').onclick = () => { closeAllModals(); beginRace(); };
$('wreckMenu').onclick = () => toMenu();
$('saveBtn').onclick = saveScore;
$('againBtn').onclick = () => { closeAllModals(); beginRace(); };
$('resMenuBtn').onclick = () => toMenu();
document.addEventListener('pointerdown', () => Sfx.init(), { once: true });
document.addEventListener('click', (e) => { const b = e.target.closest && e.target.closest('button'); if (b) b.blur(); });

addEventListener('resize', () => {
  resizeGfx(); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  if (mode === 'intro') setIntroFov();
  if (show.parts) show.parts.setScale(innerHeight, camera.fov);
  if (race) { race.fx.setScale(innerHeight, camera.fov); race.smoke.setScale(innerHeight, camera.fov); }
});

// ============================================================
//  MAIN LOOP
// ============================================================
let lastT = performance.now();
let dtAvg = 1 / 60;
function frame(now) {
  requestAnimationFrame(frame);
  const raw = Math.max(0, (now - lastT) / 1000); lastT = now;
  if (raw < 0.25) GFX.ft = lerp(GFX.ft || 1 / 60, raw, 0.06);   // smoothed frame time: rain effects scale with it
  dtAvg = raw > 0.2 ? dtAvg : lerp(dtAvg, Math.min(0.05, raw), 0.2);   // evened-out frame time: uneven frames no longer make the picture judder
  const dt = clamp(Math.min(0.05, raw), dtAvg * 0.8, dtAvg * 1.25);
  try {
    if (mode === 'intro' || mode === 'menu') { updateShowroom(dt); renderScene(show.scene); adaptQuality(raw); }
    else if (mode === 'race' && race) { updateRace(dt); renderScene(race.scene); if (race.state !== 'paused') adaptQuality(raw); }
  } catch (e) { console.error(e); }
}
async function boot() {
  if (IS_TOUCH) document.body.classList.add('touchmode');
  try { await Promise.race([Promise.all([document.fonts.load('900 60px Orbitron'), document.fonts.load('700 20px Orbitron')]), new Promise(r => setTimeout(r, 2500))]); } catch (_) {}
  buildTextures();
  buildShowroom();
  buildTrackCards(); buildDiffSel(); renderMenu(); renderLB();
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  $('loading').style.display = 'none';
  startIntro();
  requestAnimationFrame(frame);
  lbInitShared();

}
window.__apex = { gfx: GFX, gfxLock: () => { GFX.lock = true; if (!LOW && GFX.level !== 0) { GFX.level = 0; renderer.setPixelRatio(GFX.baseDpr); resizeGfx(); } }, introSim: (t) => { startIntro(); for (let x = 0; x < t; x += 0.02) updateIntro(0.02); renderScene(show.scene); mode = 'test'; }, introAt: (t) => { mode = 'intro'; intro.t = t - 0.016; intro.cut = t < 2.6 ? 1 : t < 4.8 ? 2 : 3; updateIntro(0.016); renderScene(show.scene); mode = 'test'; }, camera, get show() { return show; }, setMode: (m) => { mode = m; }, shot: (x, y, z, lx, ly, lz, fov = 40) => { camera.position.set(x, y, z); camera.lookAt(lx, ly, lz); camera.fov = fov; camera.updateProjectionMatrix(); renderScene(race ? race.scene : show.scene); }, step: (dt, n) => { for (let i = 0; i < n; i++) updateRace(dt); }, render: () => renderScene(race ? race.scene : show.scene), get race() { return race; }, get mode() { return mode; }, input, startRace, beginRace, toMenu, TRACKS, CARS, set selCar(v) { selCar = v; }, set selDiff(v) { selDiff = v; }, set selMode(v) { selMode = v; }, set selTyre(v) { selTyre = v; }, pitChoose, TYRES, END_CFG, RAINP, LINE, toggleLine, set selTrack(v) { selTrack = v; }, endIntro, explode: () => race && explode(), LB };
boot();
