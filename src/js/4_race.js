// ============================================================
//  RACE
// ============================================================
const AI_DEF = [
  { name: 'Adrian_V12', car: 0, skill: 0.942, bias: -2.5, color: '#52e01c' },
  { name: 'Konsti_GT', car: 3, skill: 0.936, bias: 2.5, color: '#ff7410' },
  { name: 'Julien_RS', car: 2, skill: 0.939, bias: 0, color: '#ffffff' },
];
// countdown mode: a full field of seven, so there is always somebody to chase, to pass and to slipstream
const AI_END = [
  { name: 'Mika_77', car: 1, skill: 0.953, bias: -5, color: '#b56bff', paint: 0x6a1fd0, accent: 0x111214 },
  { name: 'Adrian_V12', car: 0, skill: 0.948, bias: -2.5, color: '#52e01c', alt: 0x0c7a52 },
  { name: 'Julien_RS', car: 2, skill: 0.944, bias: 0, color: '#ffffff', alt: 0x9aa3ad },
  { name: 'Konsti_GT', car: 3, skill: 0.94, bias: 2.5, color: '#ff7410', alt: 0x7a1010 },
  { name: 'Timo_Drift', car: 2, skill: 0.936, bias: 4.2, color: '#ff5fa8', paint: 0xd81e6a, accent: 0x111214 },
  { name: 'Leo_Turbo', car: 0, skill: 0.932, bias: 5.5, color: '#ffe23b', paint: 0xf2c400, accent: 0x111214 },
  { name: 'Nico_Apex', car: 3, skill: 0.928, bias: -1.2, color: '#3bd5ff', paint: 0x0aa6c8, accent: 0xf2f4f7 },
];
const DIFFS = [
  { name: 'Leicht', color: '#38ff8b', info: 'Entspannt fahren – die Gegner lassen dir Platz.', skill: -0.05, corner: 0.8, rubLo: 0.86, rubHi: 1.0, nitro: 0 },
  { name: 'Normal', color: '#ffcf5a', info: 'Faire Duelle – ausgeglichene KI-Gegner.', skill: 0, corner: 0.86, rubLo: 0.9, rubHi: 1.05, nitro: 0 },
  { name: 'Schwer', color: '#ff8a1a', info: 'Schnellere Gegner, spätes Bremsen, Nitro auf Geraden.', skill: 0.035, corner: 0.9, rubLo: 0.95, rubHi: 1.08, nitro: 0.12 },
  { name: 'Profi', color: '#ff3b3b', info: 'Gnadenlos: Ideallinie am Limit, volles Nitro, kaum Fehler.', skill: 0.06, corner: 0.94, rubLo: 0.98, rubHi: 1.12, nitro: 0.2 },
];
let selDiff = 1;
try { const d = localStorage.getItem('apex_diff'); if (d != null) selDiff = clamp(+d || 0, 0, 3); } catch (_) {}
const GEARS = [0, 0.11, 0.21, 0.32, 0.44, 0.56, 0.69, 0.83, 1.0];
const input = { gas: false, brake: false, left: false, right: false, nitro: false, drift: false };
const NO_INPUT = { gas: false, brake: false, left: false, right: false, nitro: false, drift: false };
let race = null;
const TD_CACHE = {};
const _v = new THREE.Vector3(), _v2 = new THREE.Vector3();

function disposeScene(scene) {
  scene.traverse(o => {
    if (o.geometry && !o.geometry.userData.keep) o.geometry.dispose();
    if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => m.dispose());
  });
}

function disposeRace() { endlessCleanup(); if (!race) return; disposeScene(race.scene); if (race.world.envRT) race.world.envRT.dispose(); race = null; }
function startRace(carIdx, trackIdx) {
  disposeRace();
  GFX.hold = Math.max(GFX.hold, 1); GFX.n = GFX.late = 0; GFX.winT = 0;   // new scene: shaders compile in the first seconds, those hitches do not count
  for (const k in GEO_CACHE) GEO_CACHE[k].userData.keep = true;
  const def = TRACKS[trackIdx];
  const td = TD_CACHE[def.id] || (TD_CACHE[def.id] = makeTrackData(def));
  for (const c of td.coins) { c.taken = 0; c.mesh = null; }
  for (const o of td.obstacles) { o.hit = 0; o.mesh = null; o.active = !o.extra; }
  const world = buildTrackScene(td);
  const scene = world.scene;
  for (const k in GEO_CACHE) GEO_CACHE[k].userData.keep = true;
  const fx = new Particles(1800, true), smoke = new Particles(1000, false), skids = new SkidMarks();
  scene.add(fx.points, smoke.points, skids.mesh); fx.points.renderOrder = smoke.points.renderOrder = 2;
  const line = buildLine(scene);
  const glow = world.night ? 0.6 : 0.3;

  const spec = CARS[carIdx];
  const pcar = buildCar(spec, { glow }); scene.add(pcar);
  const player = {
    isPlayer: true, name: 'DU', spec, phys: carPhys(spec), car: pcar,
    x: 0, z: 0, y: 0, vy: 0, heading: 0, speed: 0, vlat: 0, yawRate: 0, gear: 1, shiftT: 0, slipR: 0, skid: 0, draft: false, steer: 0, airborne: false, airStart: 0, pitch: 0,
    s: 0, lat: 0, idx: -1, progress: 0, lapsDone: 0, lapStart: 0, bestLap: null, lastLap: null,
    lapTimes: [], health: 100, nitro: 50, nitroOn: false, invuln: 0, coins: 0, wrecked: false, wreckT: 0, finished: false, place: 4,
    pts: { coins: 0, nitro: 0, air: 0, drift: 0, laps: 0, place: 0, repair: 0 }, driftAcc: 0, driftT: 0, drifting: false, repairs: 0, inPit: false, offroad: false, contact: 0,
    sec: { i: 0, t0: 0, best: [null, null, null], last: [null, null, null], col: [0, 0, 0], pop: -1, n: 0 },
  };
  // headlights for night track
  if (world.night) {
    const hl = new THREE.SpotLight(0xdfeeff, 260, 140, 0.48, 0.55, 1.4); hl.position.set(0, 0.8, 1.8);
    const tgt = new THREE.Object3D(); tgt.position.set(0, -0.6, 20); pcar.userData.body.add(hl, tgt); hl.target = tgt;
  }
  const used = new Set([carIdx]);
  const ais = (selMode === 'endless' ? AI_END : AI_DEF).map((d, i) => {
    let ci = d.car, sp;
    if (selMode === 'endless') {   // four body shapes for seven cars: own paint tells them apart
      sp = CARS[ci]; const paint = d.paint ?? (ci === carIdx ? d.alt : null);
      if (paint != null) sp = { ...sp, color: paint, accent: d.accent ?? sp.accent, metal: 0.5 };
    } else { if (used.has(ci)) ci = [0, 1, 2, 3].find(k => !used.has(k)); used.add(ci); sp = CARS[ci]; }
    const car = buildCar(sp, { glow, lite: true }); scene.add(car);
    const tag = textSprite(d.name, { color: '#fff', border: d.color, scale: 0.0075 }); tag.position.set(0, 2.9, 0); car.add(tag);
    return { isPlayer: false, name: d.name, spec: sp, phys: carPhys(sp), car, tag, skill: d.skill, bias: d.bias, tagColor: d.color,
      s: 0, lat: 0, latV: 0, speed: 0, y: 0, vy: 0, airborne: false, progress: 0, finished: false, rubber: 1, x: 0, z: 0, heading: 0, steer: 0, nitro: 100, nitroOn: false };
  });
  // grid: rows of two, player starts last
  const grid = [[-12, -6], [-12, 6], [-27, -6], [-27, 6], [-42, -6], [-42, 6], [-57, -6], [-57, 6]];
  const order = [...ais, player];
  order.forEach((c, i) => {
    const [s, l] = grid[i]; c.s = td.wrap(s); c.lat = l; c.progress = s;
    const p = td.at(s, l); c.x = p.x; c.z = p.z; c.heading = td.heading(s);
  });
  player.idx = td.idx(player.s);

  race = { mode: selMode, gripMul: 1, pitCtl: null, diff: selDiff, td, world, scene, fx, smoke, skids, line, player, ais, cars: [player, ...ais], state: 'countdown', t: 0, cd: 4.2, cdShown: -1,
    raceTime: 0, clock: 0, pb: loadPB(def.id), laps: selMode === 'endless' ? Infinity : def.laps, finishOrder: [], shake: 0, camMode: race?.camMode ?? 0, carIdx, trackIdx, resultsShown: false,
    camPos: new THREE.Vector3(), camLook: new THREE.Vector3(), fov: 66, msgQueue: [] };
  for (const c of race.cars) placeCar(c);
  // intro swoop camera
  const p0 = td.at(player.s + 40, 0); race.camPos.set(p0.x, 22, p0.z); race.camLook.set(player.x, 1, player.z);
  camera.position.copy(race.camPos);
  setupMinimap();
  resetHud();
  if (race.mode === 'endless') initEndless();
  Sfx.engineStart(spec.id, ais.map(a => a.spec.id));
}

function placeCar(c) {
  const car = c.car, u = car.userData;
  car.position.set(c.x, c.y, c.z); car.rotation.y = c.heading + (c.visYaw || 0);
  u.body.rotation.x = -(c.pitch || 0) + (c.airborne ? 0 : clamp(-(c.accelVis || 0) * 0.0016, -0.03, 0.04));
  u.body.rotation.z = c.rollVis || 0;
  const hgt = Math.max(0, c.y - race.td.groundH(c.s, c.lat));
  u.shadow.position.y = 0.05 - hgt; u.shadow.material.opacity = 0.75 / (1 + hgt * 0.7);
}

// ---------- vertical (ramps / airtime) – shared by all cars
function vertical(c, dt) {
  const gh = race.td.groundH(c.s, c.lat);
  if (!c.airborne) {
    if (gh < c.y - 0.3) { c.airborne = true; c.airStart = race.t; }
    else { c.vy = Math.min((gh - c.y) / Math.max(dt, 1e-3), 14); c.y = gh; c.pitch = gh > 0.02 ? Math.atan(2.3 / 18) : damp(c.pitch || 0, 0, 10, dt); }
  }
  if (c.airborne) {
    c.vy -= 26 * dt; c.y += c.vy * dt;
    c.pitch = clamp(Math.atan2(c.vy, Math.max(Math.abs(c.speed), 10)) * 0.9, -0.35, 0.3);
    if (c.y <= gh) {
      const air = race.t - c.airStart; c.y = gh; c.airborne = false; const impact = -c.vy; c.vy = 0;
      if (c.isPlayer) onLanding(air, impact);
    }
  }
}
function onLanding(air, impact) {
  const p = race.player;
  race.shake = Math.max(race.shake, Math.min(1, impact / 18));
  Sfx.noise(0.25, 0.35, 500);
  dust(p.x, p.z, 26);
  if (air > 0.25 && !p.wrecked) {
    const pts = Math.round(air * 480); p.pts.air += pts;
    if (race.mode === 'endless') endAdd(Math.min(END_CFG.airMax, air * END_CFG.air), '🚀 AIRTIME', '#3be8ff'); else showMsg(`🚀 AIRTIME ${air.toFixed(2).replace('.', ',')} s  +${fmtNum(pts)}`, '#3be8ff');
  }
}

// ---------- particles helpers
function sparks(x, y, z, n = 14, sp = 9) {
  for (let i = 0; i < n; i++) race.fx.emit({ x, y, z, vx: rand(-sp, sp), vy: rand(1, sp), vz: rand(-sp, sp), life: rand(0.25, 0.6), size: rand(0.12, 0.25), size1: 0.02, r: 1, g: 0.85, b: 0.4, r1: 1, g1: 0.3, b1: 0.05, grav: 18, drag: 1.5 });
}
function dust(x, z, n = 6, col = [0.62, 0.55, 0.45]) {
  for (let i = 0; i < n; i++) race.smoke.emit({ x: x + rand(-1.5, 1.5), y: 0.4, z: z + rand(-1.5, 1.5), vx: rand(-2, 2), vy: rand(0.5, 2.5), vz: rand(-2, 2), life: rand(0.8, 1.6), size: 1.2, size1: 4.2, r: col[0], g: col[1], b: col[2], a: 0.45, drag: 1.2 });
}
function worldPoint(car, lx, ly, lz) { return _v2.set(lx, ly, lz).applyMatrix4(car.userData.body.matrixWorld); }

// ---------- damage
function damage(amount, x, y, z) {
  const p = race.player;
  if (p.invuln > 0 || p.wrecked || p.finished) return false;
  p.health -= amount * p.spec.dmgMul; p.invuln = 0.6;
  race.shake = Math.max(race.shake, clamp(amount / 14, 0.25, 1));
  Sfx.hit(clamp(amount / 15, 0, 1)); sparks(x, y, z, 22, 10);
  const h = $('hitFx'); h.style.opacity = 1; setTimeout(() => h.style.opacity = 0, 160);
  if (p.health <= 0) explode();
  return true;
}
function explode() {
  const p = race.player; if (p.wrecked) return;
  p.health = 0; p.wrecked = true; p.wreckT = 0; p.nitroOn = false;
  setCharred(p.car, true); Sfx.boom(); race.shake = 1.4;
  const { x, z } = p, y = p.y + 1;
  for (let i = 0; i < 160; i++) { const a = rand(0, 6.28), e = rand(-0.2, 1.3), s = rand(4, 16); race.fx.emit({ x, y, z, vx: Math.cos(a) * Math.cos(e) * s, vy: Math.sin(e) * s + 3, vz: Math.sin(a) * Math.cos(e) * s, life: rand(0.5, 1.3), size: rand(1.5, 3.5), size1: rand(4, 7), r: 1, g: rand(0.75, 0.95), b: 0.35, r1: 0.9, g1: 0.18, b1: 0.02, drag: 2.4, grav: -2 }); }
  sparks(x, y, z, 70, 22);
  for (let i = 0; i < 70; i++) race.smoke.emit({ x: x + rand(-2, 2), y: y + rand(0, 2), z: z + rand(-2, 2), vx: rand(-3, 3), vy: rand(2, 7), vz: rand(-3, 3), life: rand(2.5, 4.5), size: rand(2.5, 4), size1: rand(9, 14), r: 0.12, g: 0.11, b: 0.1, a: 0.85, drag: 0.8 });
  const fl = new THREE.PointLight(0xff8a2a, 4000, 90, 2); fl.position.set(x, y + 2, z); race.scene.add(fl); race.flash = fl;
  p.vy = 7; p.airborne = true; p.airStart = race.t; p.speed *= 0.35; p.vlat *= 0.35; p.yawRate = rand(-2, 2);
  showMsg('💥 TOTALSCHADEN!', '#ff3b3b');
}
function emergencyRepair(quiet) {
  const p = race.player, td = race.td;
  p.health = 60; p.wrecked = false; if (!quiet) p.pts.repair -= 500; p.repairs++; setCharred(p.car, false);
  p.lat = clamp(p.lat, -ROAD_HW + 3, ROAD_HW - 3); const q = td.at(p.s, p.lat); p.x = q.x; p.z = q.z; p.y = 0; p.vy = 0; p.airborne = false;
  p.heading = td.heading(p.s); p.speed = 0; p.vlat = 0; p.yawRate = 0; p.invuln = 2.5; p.nitro = Math.max(p.nitro, 25);
  race.state = 'race'; closeModal('wreck'); Sfx.repair(); if (!quiet) showMsg('🔧 NOTFALL-REPARATUR  −500', '#38ff8b');
}

// ---------- player physics: bicycle model with tyre slip angles, load transfer, downforce
const CAR_L = 2.87, CAR_A = 1.55, CAR_B = 1.32, CAR_K2 = 1.6, TIRE_B = 18, TIRE_C = 1.4;
const tireF = (alpha, D) => D * Math.sin(TIRE_C * Math.atan(TIRE_B * alpha));
function gripAccel(ph, u) { const f = Math.min(1.25, Math.abs(u) / ph.vmax); return ph.grip * (1.0 + 0.25 * f * f); }   // downforce adds grip with speed

const RAINP = { cs: 0.05, csGain: 0.1, rear: -0.02, fall: 0.12, esp: 0.3, yaw: 3, wag: 2, wagVis: 0.07 };   // how much a wet track on slicks loosens the car
class SkidMarks {
  constructor(max = 900) {
    this.max = max; this.i = 0; this.n = 0; this.last = [null, null];
    this.pos = new Float32Array(max * 18);
    this.geo = new THREE.BufferGeometry(); this.geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage)); this.geo.setDrawRange(0, 0);
    this.mesh = new THREE.Mesh(this.geo, new THREE.MeshBasicMaterial({ color: 0x050505, transparent: true, opacity: 0.5, depthWrite: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 }));
    this.mesh.frustumCulled = false;
  }
  update(p, on) {
    if (!on) { this.last[0] = this.last[1] = null; return; }
    const sh = Math.sin(p.heading), ch = Math.cos(p.heading), y = p.y + 0.04;
    for (let w = 0; w < 2; w++) {
      const sx = w ? 0.83 : -0.83, cx = p.x - sh * 1.42 - ch * sx, cz = p.z - ch * 1.42 + sh * sx;
      const cur = [cx + ch * 0.14, cz - sh * 0.14, cx - ch * 0.14, cz + sh * 0.14], l = this.last[w];
      if (!l) { this.last[w] = cur; continue; }
      if (Math.hypot(cur[0] - l[0], cur[1] - l[1]) < 0.3) continue;
      const o = this.i * 18, P = this.pos;
      P.set([l[0], y, l[1], l[2], y, l[3], cur[2], y, cur[3], l[0], y, l[1], cur[2], y, cur[3], cur[0], y, cur[1]], o);
      this.i = (this.i + 1) % this.max; this.n = Math.min(this.max, this.n + 1); this.last[w] = cur;
      this.geo.setDrawRange(0, this.n * 6); this.geo.attributes.position.needsUpdate = true;
    }
  }
}
function tireSmoke(p) {
  const sh = Math.sin(p.heading), ch = Math.cos(p.heading);
  for (const sx of [-0.83, 0.83]) race.smoke.emit({ x: p.x - sh * 1.5 - ch * sx, y: p.y + 0.25, z: p.z - ch * 1.5 + sh * sx, vx: rand(-1, 1), vy: rand(0.6, 1.8), vz: rand(-1, 1), life: rand(0.6, 1.1), size: 0.6, size1: 2.4, r: 0.8, g: 0.8, b: 0.82, a: 0.16, drag: 1.4 });
}

function updatePlayer(dt) {
  const p = race.player, td = race.td, ph = p.phys, spec = p.spec;
  const live = race.state === 'race' && !p.wrecked && !p.finished && !race.pitCtl;
  const inp = live ? input : NO_INPUT;
  let thr = inp.gas ? 1 : 0, brk = inp.brake ? 1 : 0, st = (inp.right ? 1 : 0) - (inp.left ? 1 : 0);
  if (race.pitCtl && !p.wrecked) { // pit crew takes over: roll to the box and stop
    const e = wrapAng(td.heading(p.s) - p.heading), c = race.pitCtl;
    st = clamp(-e * 2.5 - (p.lat - c.lat) * 0.06, -1, 1); thr = c.brake ? 0 : (p.speed < 38 ? 1 : 0); brk = c.brake && p.speed > 0.8 ? 1 : 0;
  }
  if (p.finished && !p.wrecked) { // autopilot cool-down lap
    const e = wrapAng(td.heading(p.s) - p.heading);
    st = clamp(-e * 2.5 - (p.lat - td.idealAt(p.s + 20)) * 0.04, -1, 1); thr = p.speed < 45 ? 0.5 : 0; brk = p.speed > 60 ? 0.5 : 0;
  }
  p.nitroOn = live && inp.nitro && p.nitro > 0.5;
  if (p.nitroOn) { thr = 1; brk = 0; p.nitro = Math.max(0, p.nitro - 16 * dt); p.pts.nitro += 50 * dt; }
  const ws = td.wrap(p.s);
  p.inPit = td.inPitZone(ws, p.lat);
  const onPitSurface = ws >= PIT_S0 && ws <= PIT_S1 && p.lat > 0;
  p.offroad = Math.abs(p.lat) > ROAD_HW + CURB_W && !onPitSurface;
  const powerMul = (p.health < 25 ? 0.5 : 1) * (p.nitroOn ? 1.95 * spec.boostMul : 1), a0Mul = (p.nitroOn ? 1.3 * spec.boostMul : 1) * Math.min(1.1, race.gripMul);   // tyres also set the traction out of corners
  // slipstream behind an opponent
  let draft = false;
  if (live && p.speed > 40) for (const a of race.ais) { let d = a.s - p.s; if (d < -td.L / 2) d += td.L; if (d > td.L / 2) d -= td.L; if (d > 4 && d < 45 && Math.abs(a.lat - p.lat) < 2.6 && Math.abs(a.y - p.y) < 1) draft = true; }
  if (draft && !p.draft && race.t - (p.draftMsg || -9) > 8) { p.draftMsg = race.t; showMsg('💨 WINDSCHATTEN', '#9fd8ff'); }
  p.draft = draft;
  const dragK = draft ? 0.6 : 1;
  // gearbox: short torque cut on every upshift
  if (p.speed < -0.5) p.gear = 'R';
  else {
    if (p.gear === 'R') p.gear = 1;
    const fg = Math.hypot(p.speed, p.vlat) / ph.vmax;
    while (p.gear < 8 && fg > GEARS[p.gear]) { p.gear++; if (thr > 0 && !p.nitroOn) p.shiftT = 0.07; }
    while (p.gear > 1 && fg < GEARS[p.gear - 1] - 0.025) p.gear--;
  }
  p.shiftT = Math.max(0, p.shiftT - dt);
  p.steer = damp(p.steer, p.wrecked ? 0 : st, st === 0 ? 9 : 5.5, dt);
  // drift: the button starts it; it then carries on by itself while you stay on the throttle and the car is still sideways
  p.driftHold = live && (inp.drift || (p.driftHold && Math.abs(p.beta || 0) > 0.14 && thr > 0));
  const driftOn = p.driftHold, slick = race.slick || 0;   // slick: wet track on the wrong tyres -> the assists let go
  const surf = p.offroad ? 0.55 : 1;
  // little grip (wet track on slicks, tyres worn out): the car squirms left and right, most of all under full throttle.
  // It slides sideways as a whole and the tail steps out with it; in a hard corner the squirm fades, there the tyre model does the sliding.
  const loose = live && !p.airborne && !p.offroad ? clamp((0.86 - race.gripMul) / 0.34, 0, 1) : 0, v0 = Math.abs(p.speed);
  p.wagT = (p.wagT || 0) + dt * (0.75 + 0.45 * thr);
  const wagN = Math.sin(p.wagT * 2.3) + 0.6 * Math.sin(p.wagT * 3.9 + 1.3) + 0.35 * Math.sin(p.wagT * 6.1 + 4);
  const wagK = loose * (0.3 + 0.7 * thr) * clamp((v0 - 5) / 10, 0, 1) * (1 + 0.8 * Math.max(0, 1 - v0 / 30)) * (1 - 0.75 * Math.min(1, Math.abs(p.ay || 0) / Math.max(8, ph.grip * race.gripMul)));
  p.wag = damp(p.wag || 0, wagK * wagN, 8, dt);
  const slideV = RAINP.wag * p.wag;
  const n = Math.max(1, Math.ceil(dt * 240 - 1e-6)), h = dt / n;
  let axS = 0, ayS = 0, slip = 0;
  for (let i = 0; i < n; i++) {
    const u = p.speed, au = Math.abs(u), A = gripAccel(ph, u) * (p.airborne ? 0.5 : surf) * race.gripMul, f = Math.min(1, au / ph.vmax);
    let ax = 0;
    if (race.state === 'countdown') ax = 0;
    else if (p.airborne) ax = -ph.cd * u * au;
    else if (p.wrecked) ax = -18 * Math.sign(u);
    else {
      if (brk > 0 && u > 0.5) ax = -Math.min(0.92 * A, 38) * brk;          // brakes bite harder with downforce
      else if (brk > 0) ax = u > -9 ? -6 : 0;                               // reverse gear
      else if (thr > 0) ax = u < -0.5 ? 22 : (p.shiftT > 0 ? 0 : driveAccel(ph, u, powerMul, a0Mul) * thr);
      else ax = -1.1 * Math.sign(u);                                        // engine braking
      if (au > 0.2) ax -= dragAccel(ph, au, dragK) * Math.sign(u);
      if (p.offroad) ax -= (3 + 0.1 * au) * Math.sign(u);
      if (p.inPit && u > PIT_LIMIT) ax = Math.min(ax, -14);
    }
    // steering lock shrinks with speed so that full input asks for roughly the grip limit
    // + automatic counter-steer once the car slides more than a few degrees, so a slide can always be caught
    const beta = u > 4 ? Math.atan2(p.vlat, u) : 0;
    const drift = driftOn && u > 8 && !p.airborne, lock = (1.25 - 0.15 * f * f) * Math.max(A, 8) * CAR_L / Math.max(u * u, 1);
    const delta = drift ? p.steer * Math.min(0.5, lock + 0.05) + beta * 0.7       // drift: front wheels point into the slide
      : p.steer * Math.min(0.5, lock + 0.01 * (1 - f)) + Math.sign(beta) * clamp(Math.abs(beta) - (0.07 - 0.04 * f) - RAINP.cs * slick, 0, 0.35) * (1 - RAINP.csGain * slick);
    // axle loads (longitudinal transfer) and tyre forces
    const tr = clamp(ax / 30, -1, 1) * 0.02, DF = A * (CAR_B / CAR_L - tr), DR = A * (CAR_A / CAR_L + tr) * 1.06 * (1 - 0.1 * thr * (1 - f)) * (drift ? 0.65 : 1) * (1 - RAINP.rear * slick);
    const w = u > 0 ? clamp((u - 4) / 6, 0, 1) : 0, ud = Math.max(au, 4);
    const af = Math.atan2(p.vlat + CAR_A * p.yawRate, ud) - delta, ar = Math.atan2(p.vlat - CAR_B * p.yawRate, ud);
    const fall = (al) => 1 - RAINP.fall * slick * clamp((Math.abs(al) - 0.12) / 0.15, 0, 1);   // on a wet track grip drops off once the tyre slides
    const Fyf = -tireF(af, DF) * fall(af), Fyr = -tireF(ar, DR) * fall(ar), cd = Math.cos(delta);
    let dv = Fyf * cd + Fyr - u * p.yawRate, dr = (CAR_A * Fyf * cd - CAR_B * Fyr) / CAR_K2;
    // stability assist: catches the car when the rear lets go
    if (drift) {   // drift button: rear grip drops, the steering input sets the drift angle
      const rPath = (Fyf * cd + Fyr) / Math.max(Math.hypot(u, p.vlat), 5);
      dr += -20 * (-p.steer * 0.62 - beta) - 7 * (p.yawRate - rPath);
    } else {
      const over = clamp((Math.abs(ar) - 0.11) / 0.1, 0, 1);
      dr -= p.yawRate * 3.5 * over * (1 - RAINP.esp * slick); if (over > 0 && ax > 0) ax *= 1 - 0.7 * over * (1 - RAINP.esp * slick);
      dr += RAINP.yaw * dv / ud;   // damps the slip angle: without it the car weaves at the limit, worst on a wet track
    }
    const before = p.speed;
    p.speed += (ax + (p.vlat * p.yawRate - Fyf * Math.sin(delta)) * w * (drift ? 0.8 : 1)) * h;   // power slide: keeps most of its speed
    if (race.state === 'countdown') p.speed = 0;
    else if ((p.wrecked || (!thr && !brk)) && before * p.speed < 0) p.speed = 0;
    p.vlat += dv * w * h; p.yawRate += dr * h;
    // below walking pace the tyre model is stiff: blend into simple kinematic steering
    p.yawRate = lerp(clamp(p.speed * Math.tan(delta) / CAR_L, -2.2, 2.2), p.yawRate, w); p.vlat *= Math.exp(-(1 - w) * 14 * h);
    p.heading -= p.yawRate * h;
    const sh = Math.sin(p.heading), ch = Math.cos(p.heading);
    p.x += (sh * p.speed - ch * (p.vlat + slideV)) * h; p.z += (ch * p.speed + sh * (p.vlat + slideV)) * h;
    axS += ax; ayS += Fyf * cd + Fyr; slip = Math.max(slip, Math.abs(ar) * w, Math.abs(af) * w * 0.8);
  }
  if (race.pitCtl && race.pitCtl.brake && p.speed < 0.8) { p.speed = 0; p.vlat = 0; p.yawRate = 0; }
  p.ax = axS / n; p.ay = ayS / n; p.slipR = slip;
  // drift angle, drift bonus
  const spd = Math.hypot(p.speed, p.vlat), ang = p.speed > 4 ? Math.abs(Math.atan2(p.vlat, p.speed)) : 0;
  p.beta = p.speed > 4 ? Math.atan2(p.vlat, p.speed) : 0;
  p.visYaw = RAINP.wagVis * p.wag;   // tail out against the slide
  p.drifting = live && ang > 0.2 && spd > 12 && !p.airborne && !p.offroad;
  if (p.drifting) { p.driftAcc += dt * (60 + 250 * ang) * clamp(spd / 40, 0.4, 1.6); p.driftT = 0.4; }
  else if (p.driftAcc > 0 && (p.driftT -= dt) <= 0) {
    if (p.driftAcc >= 60 && live) { const pts = Math.round(p.driftAcc); p.pts.drift += pts; if (race.mode === 'endless') endAdd(Math.min(END_CFG.driftMax, pts / END_CFG.drift), '🌀 DRIFT', '#ff8ad8'); else showMsg(`🌀 DRIFT  +${fmtNum(pts)}`, '#ff8ad8'); }
    p.driftAcc = 0;
  }
  p.accelVis = damp(p.accelVis || 0, p.ax, 7, dt);
  p.rollVis = damp(p.rollVis || 0, clamp(-p.ay * 0.0021, -0.075, 0.075), 7, dt);
  const v = Math.abs(p.speed);
  const pr = td.project(p.x, p.z, p.idx);
  let dS = pr.s - p.s; if (dS < -td.L / 2) dS += td.L; if (dS > td.L / 2) dS -= td.L;
  p.idx = pr.i; p.s = pr.s; p.lat = pr.lat;
  if (race.state !== 'countdown') p.progress += dS;
  // walls
  const lw = -WALL + 1.05, rw = td.rightWall(p.s) - 1.05;
  p.contact = Math.max(0, p.contact - dt);
  if (p.lat < lw || p.lat > rw) {
    const side = p.lat < lw ? -1 : 1, target = side < 0 ? lw : rw, Rv = td.R[p.idx];
    const push = target - p.lat; p.x += Rv.x * push; p.z += Rv.z * push; p.lat = target;
    const sh = Math.sin(p.heading), ch = Math.cos(p.heading);
    let vx = sh * p.speed - ch * p.vlat, vz = ch * p.speed + sh * p.vlat;
    const vn = vx * Rv.x + vz * Rv.z;
    if (vn * side > 0) {
      const impact = Math.abs(vn), fr = 1 - Math.min(0.5, impact / 60);
      vx = (vx - Rv.x * vn * 1.15) * fr; vz = (vz - Rv.z * vn * 1.15) * fr;
      let th = td.H[p.idx], rel = wrapAng(p.heading - th);
      if (Math.abs(rel) > Math.PI / 2) { th += Math.PI; rel = wrapAng(p.heading - th); }
      p.heading = th + rel * 0.45; p.yawRate *= 0.2;
      const s2 = Math.sin(p.heading), c2 = Math.cos(p.heading);
      p.speed = vx * s2 + vz * c2; p.vlat = (-vx * c2 + vz * s2) * 0.5;
      const cp = td.at(p.s, p.lat + side * 1.0);
      if (impact > 2.5) { if (damage(3 + impact * 0.45, cp.x, p.y + 0.6, cp.z) && race.mode === 'endless') endAdd(-END_CFG.hit, '💥 MAUER'); p.driftAcc = 0; }
      if (v > 8 && Math.random() < 0.7) sparks(cp.x, p.y + 0.5, cp.z, 3, 5);
      p.contact = 0.15;
    }
  }
  // obstacles
  for (const o of td.obstacles) {
    if (o.active === false) continue;
    let d = o.s - p.s; if (d < -td.L / 2) d += td.L; if (d > td.L / 2) d -= td.L;
    const dl = p.lat - o.lat;
    if (Math.abs(d) < 3.4 && Math.abs(dl) < 2.3 && p.y < 1.3) {
      const ovS = 3.4 - Math.abs(d), ovL = 2.3 - Math.abs(dl);
      if (ovL < ovS) { const Rv = td.R[p.idx], push = Math.sign(dl || 1) * ovL; p.x += Rv.x * push; p.z += Rv.z * push; p.lat += push; }
      else { const T = td.T[p.idx], push = -Math.sign(d) * ovS; p.x += T.x * push; p.z += T.z * push; p.s = td.wrap(p.s + push); p.progress += push; }
      if (!o.hit || race.t - o.hit > 0.5) {
        o.hit = race.t; const op = o.mesh.position;
        const k = damage(9, op.x, 0.8, op.z) ? 0.4 : 0.7; if (k < 0.5) { if (race.mode === 'endless') endAdd(-END_CFG.hit, '⚠ HINDERNIS'); else showMsg('⚠ HINDERNIS!', '#ff3b3b'); }
        p.speed *= k; p.vlat *= k; p.yawRate *= 0.5;
      }
    }
  }
  vertical(p, dt);
  // coins
  for (const c of td.coins) {
    if (c.taken > 0) continue;
    let d = c.s - p.s; if (d < -td.L / 2) d += td.L; if (d > td.L / 2) d -= td.L;
    if (Math.abs(d) > 5) continue;
    const m = c.mesh.position, dx = m.x - p.x, dz = m.z - p.z, dy = c.y - (p.y + 0.7);
    if (dx * dx + dz * dz + dy * dy < 3.5 * 3.5 && !p.wrecked) {
      c.taken = 15; c.mesh.visible = false; p.coins++; p.pts.coins += 250; p.nitro = Math.min(100, p.nitro + 25);
      Sfx.coin(); if (race.mode !== 'endless') showMsg('🪙 BOOST COIN  +250', '#ffcf5a');
      for (let i = 0; i < 18; i++) race.fx.emit({ x: m.x, y: m.y, z: m.z, vx: rand(-5, 5), vy: rand(-2, 6), vz: rand(-5, 5), life: rand(0.4, 0.8), size: 0.35, size1: 0.05, r: 1, g: 0.85, b: 0.3, drag: 2 });
    }
  }
  // wear & pit
  if (race.state === 'race' && !p.wrecked && !p.finished) {
    if (race.mode !== 'endless') p.health -= dt * 0.29 * td.def.wear * Math.pow(v / ph.vmax, 1.5) * (p.nitroOn ? 1.4 : 1) * (0.5 + 0.5 * spec.dmgMul) * (1 + Math.min(p.slipR, 0.3) * 2);
    if (p.inPit && p.health < 100 && race.mode !== 'endless') {
      if (!p.repairing) { p.repairing = true; Sfx.repair(); }
      p.health = Math.min(100, p.health + 70 * dt);
      if (Math.random() < 0.5) { const q = worldPoint(p.car, rand(-1, 1), 1.2, rand(-2, 2)); race.fx.emit({ x: q.x, y: q.y, z: q.z, vx: rand(-1, 1), vy: rand(1, 3), vz: rand(-1, 1), life: 0.7, size: 0.4, size1: 0.05, r: 0.3, g: 1, b: 0.55, drag: 1 }); }
      if (p.health >= 100) { showMsg('✅ REPARIERT – 100 %', '#38ff8b'); }
    } else p.repairing = false;
    if (p.health <= 0) explode();
  }
  p.invuln = Math.max(0, p.invuln - dt);
  // laps
  if (race.state === 'race' && !p.finished) {
    const done = Math.floor(p.progress / td.L);
    if (done > p.lapsDone) {
      p.lapsDone = done; const lt = race.raceTime - p.lapStart; p.lapStart = race.raceTime;
      const prevLap = p.lastLap, prevBest = p.bestLap, pbBefore = race.pb;
      p.lastLap = lt; p.lapTimes.push(lt);
      const isBest = prevBest != null && lt < prevBest;
      if (prevBest == null || lt < prevBest) p.bestLap = lt;
      const isPB = pbBefore == null || lt * 1000 < pbBefore;
      if (isPB) { race.pb = Math.round(lt * 1000); savePB(race.td.def.id, race.pb); }
      p.pts.laps += 1500;
      showLapSplit(done, lt, prevLap, prevBest, isBest, isPB && pbBefore != null, pbBefore);
      if (p.sec.i === 2) sectorDone(p, 2); p.sec.i = 0; p.sec.t0 = race.raceTime;
      if (done >= race.laps) finishRace();
      else { showMsg(`🏁 RUNDEN-BONUS  +1.500`, '#ffffff'); if (done === race.laps - 1) showMsg('LETZTE RUNDE!', '#ffcf5a'); Sfx.beep(true); }
    }
    // the lap in three sectors
    const k = clamp(Math.floor((p.progress - p.lapsDone * td.L) / (td.L / 3)), 0, 2);
    while (k > p.sec.i) { sectorDone(p, p.sec.i); p.sec.i++; }
  }
  // visuals: tyre marks & smoke, damage smoke, nitro
  const launch = live && thr > 0 && v < 7 && !p.airborne ? 0.4 : 0;
  p.skid = !p.airborne && !p.wrecked && (v > 6 || launch) ? Math.max(launch, clamp((p.slipR - 0.085) / 0.1, 0, 1), brk && v > 25 && p.offroad ? 0.6 : 0) : 0;
  race.skids.update(p, p.skid > 0.3 && !p.offroad);
  if (p.skid > 0.3 && Math.random() < p.skid * 0.7) tireSmoke(p);
  if (p.drifting && Math.abs(p.beta) > 0.3) { tireSmoke(p); tireSmoke(p); }
  if (p.wrecked) { p.wreckT += dt; if (Math.random() < 0.8) emitSmoke(p, 1.2, true); }
  else if (p.health < 35) { if (Math.random() < (35 - p.health) / 35 * 0.9 + 0.1) emitSmoke(p, p.health < 15 ? 1 : 0.6, p.health < 12); }
  if (p.nitroOn) for (const sx of [-0.2, 0.2]) { const q = worldPoint(p.car, sx, 0.5, -2.9); race.fx.emit({ x: q.x, y: q.y, z: q.z, vx: rand(-1, 1), vy: rand(-0.5, 1), vz: rand(-1, 1), life: 0.25, size: 0.55, size1: 0.1, r: 0.55, g: 0.85, b: 1, r1: 0.25, g1: 0.35, b1: 1, drag: 3 }); }
  if (p.offroad && v > 10 && Math.random() < 0.6) dust(p.x, p.z, 1);
  if (Math.abs(p.lat) > ROAD_HW && Math.abs(p.lat) < ROAD_HW + CURB_W && v > 20) race.shake = Math.max(race.shake, 0.12);
  placeCar(p);
  const wing = p.car.userData.wing; if (wing && p.spec.style === 'delta') wing.rotation.x = damp(wing.rotation.x, brk && v > 20 ? -0.55 : (v > 60 ? -0.12 : 0), 6, dt);
  animateCar(p.car, p.speed, clamp(p.steer * 0.6 + (p.beta || 0) * 1.5, -1, 1), dt, race.t, p.nitroOn, brk && v > 1 ? 1 : 0);
}
// sector finished: 3 = fastest of the race so far, 2 = quicker than on the lap before, 1 = slower
function sectorDone(p, i) {
  const S = p.sec, t = race.raceTime - S.t0; S.t0 = race.raceTime;
  S.col[i] = S.best[i] == null || t < S.best[i] ? 3 : (S.last[i] != null && t < S.last[i] ? 2 : 1);
  if (S.best[i] == null || t < S.best[i]) S.best[i] = t;
  S.last[i] = t; S.pop = i; S.n++;
}
function emitSmoke(p, k, fire) {
  const q = worldPoint(p.car, rand(-0.4, 0.4), 1.0, -1.5);
  race.smoke.emit({ x: q.x, y: q.y, z: q.z, vx: rand(-0.8, 0.8), vy: rand(2, 4), vz: rand(-0.8, 0.8), life: rand(1.2, 2.2) * k + 0.4, size: 0.8, size1: 3.6 * k + 1, r: 0.16, g: 0.15, b: 0.15, a: 0.7, drag: 0.6 });
  if (fire) race.fx.emit({ x: q.x, y: q.y, z: q.z, vx: rand(-0.5, 0.5), vy: rand(1, 3), vz: rand(-0.5, 0.5), life: 0.5, size: 1.1, size1: 0.2, r: 1, g: 0.6, b: 0.15, r1: 0.9, g1: 0.15, b1: 0.02, drag: 1 });
}

// ---------- AI
function updateAI(a, dt) {
  const td = race.td, ph = a.phys, p = race.player;
  const go = race.state !== 'countdown';
  const gap = a.progress - p.progress;
  const D = raceDiff();
  // pull: only far away from the player (countdown mode), also in the corners, so a car more than a few hundred metres off finds its way back
  a.pull = D.rubFar ? -Math.sign(gap) * Math.min(0.12, Math.max(0, Math.abs(gap) - 400) * D.rubFar) : 0;
  a.rubber = clamp(1 - (D.rubFar ? clamp(gap * 0.00022, -0.03, 0.03) - a.pull : gap * 0.00022), D.rubLo, D.rubHi);
  let tv = ph.vmax * (a.skill + D.skill + (a.form || 0)) * (a.finished ? 0.55 : a.rubber);
  const tvFree = tv;
  const brake = 22, cg = ph.grip * D.corner * (a.gripF || 1) * (1 + a.pull);   // gripF: own tyres in the countdown mode
  for (let d = 0; d <= 240; d += 12) {
    const k = Math.abs(td.K[td.idx(a.s + d)]);
    if (k > 1e-4) { const vc = Math.sqrt(cg / k); const allowed = Math.sqrt(vc * vc + 2 * brake * d); if (allowed < tv) tv = allowed; }
  }
  let tl = td.idealAt(a.s + 25) + a.bias;
  for (const o of td.obstacles) { if (o.active === false) continue; let d = o.s - a.s; if (d < -td.L / 2) d += td.L; if (d > 0 && d < 95 && Math.abs(o.lat - tl) < 4.6) tl = o.lat + (o.lat > tl ? -5.8 : 5.8); }
  for (const b of race.cars) {
    if (b === a) continue; let d = (b.s - a.s); if (d < -td.L / 2) d += td.L; if (d > td.L / 2) d -= td.L;
    if (d > 0 && d < 24 && Math.abs(b.lat - a.lat) < 3.3 && a.speed > (b.speed || 0) - 1) tl = b.lat + (b.lat > a.lat ? -5.2 : 5.2);
  }
  tl = clamp(tl, -ROAD_HW + 2, ROAD_HW - 2);
  let latLim = go ? Math.min(7, 0.3 * a.speed) : 0;   // a car can only move sideways while it rolls: no cars standing across the grid
  if (go && race.end) [tv, tl, latLim] = endAiDrive(a, tv, tl, latLim, dt);   // countdown mode: pit stops and mistakes
  a.latV = damp(a.latV, clamp((tl - a.lat) * 1.1, -latLim, latLim), 4, dt);
  if (go) {
    a.nitroOn = D.nitro > 0 && !a.finished && tv >= tvFree * 0.99 && a.nitro > 4 && (a.nitroOn || a.nitro > 35);
    if (a.nitroOn) { a.nitro -= 16 * dt; tv *= 1 + D.nitro; } else a.nitro = Math.min(100, a.nitro + 6 * dt);
    if (!a.airborne) {
      if (a.speed < tv) { const pw = (1 + 2 * D.skill) * a.rubber * a.rubber * (a.nitroOn ? 1.95 : 1); a.speed = Math.min(tv, a.speed + (driveAccel(ph, a.speed, pw, a.nitroOn ? 1.3 : 1) - dragAccel(ph, a.speed)) * dt); a.braking = false; }
      else { a.braking = a.speed > tv + 0.5; a.speed = Math.max(tv, a.speed - brake * dt); }
    }
    a.lat += a.latV * dt;
    a.s = td.wrap(a.s + a.speed * dt); a.progress += a.speed * dt;
  }
  vertical(a, dt);
  if (!a.finished && a.progress >= race.laps * td.L) { a.finished = true; a.finishTime = race.clock; race.finishOrder.push(a); }
  td.at(a.s, a.lat, _v); a.x = _v.x; a.z = _v.z;
  a.heading = td.heading(a.s) - Math.atan2(a.latV, Math.max(a.speed, 2));
  a.steer = clamp(a.latV * 0.2, -1, 1);
  a.rollVis = damp(a.rollVis || 0, clamp(a.speed * a.speed * td.K[td.idx(a.s)] * 0.0021, -0.06, 0.06), 6, dt);
  placeCar(a);
  animateCar(a.car, a.speed, a.steer, dt, race.t, !!a.nitroOn, a.braking && go ? 1 : 0);
}

// ---------- car vs car collisions
function collide() {
  const p = race.player, td = race.td;
  const circ = (c) => { const sx = Math.sin(c.heading), cz = Math.cos(c.heading); return [[c.x + sx * 1.2, c.z + cz * 1.2], [c.x - sx * 1.2, c.z - cz * 1.2]]; };
  const pc = circ(p);
  for (const a of race.ais) {
    if (Math.abs(a.y - p.y) > 1.6) continue;
    const dx0 = a.x - p.x, dz0 = a.z - p.z; if (dx0 * dx0 + dz0 * dz0 > 49) continue;
    const ac = circ(a);
    for (const P of pc) for (const A of ac) {
      let nx = P[0] - A[0], nz = P[1] - A[1]; const d = Math.hypot(nx, nz);
      if (d >= 2.25 || d < 1e-4) continue;
      nx /= d; nz /= d; const ov = 2.25 - d;
      p.x += nx * ov * 0.55; p.z += nz * ov * 0.55;
      const Rv = td.R[td.idx(a.s)]; a.lat -= (nx * Rv.x + nz * Rv.z) * ov * 0.45;
      const sh = Math.sin(p.heading), ch = Math.cos(p.heading), pvx = sh * p.speed - ch * p.vlat, pvz = ch * p.speed + sh * p.vlat;
      const T = td.T[td.idx(a.s)], avx = T.x * a.speed, avz = T.z * a.speed;
      const rel = (pvx - avx) * nx + (pvz - avz) * nz;
      if (rel < 0) {
        const j = -rel * 0.9;
        p.speed += (sh * nx + ch * nz) * j * 0.5; p.vlat += (-ch * nx + sh * nz) * j * 0.3; p.yawRate += (P === pc[0] ? 1 : -1) * (-ch * nx + sh * nz) * j * 0.03;
        a.speed = Math.max(0, a.speed - (T.x * nx + T.z * nz) * j * 0.5);
        const mx = (P[0] + A[0]) / 2, mz = (P[1] + A[1]) / 2;
        if (-rel > 2) { damage(1.5 + Math.min(3.5, -rel * 0.1), mx, p.y + 0.7, mz); }
        if (Math.random() < 0.8) sparks(mx, p.y + 0.6, mz, 6, 6);
      }
    }
  }
  for (let i = 0; i < race.ais.length; i++) for (let j = i + 1; j < race.ais.length; j++) {
    const a = race.ais[i], b = race.ais[j];
    let d = b.s - a.s; if (d < -td.L / 2) d += td.L; if (d > td.L / 2) d -= td.L;
    const dl = b.lat - a.lat;
    if (Math.abs(d) < 4.8 && Math.abs(dl) < 2.3) { const push = (2.3 - Math.abs(dl)) / 2 * Math.sign(dl || 1); a.lat -= push; b.lat += push; }
  }
}

function finishRace() {
  const p = race.player;
  p.finished = true; p.finishTime = race.raceTime; p.place = race.finishOrder.length + 1; race.finishOrder.push(p);
  p.pts.place = [5000, 3000, 1500, 1500][p.place - 1];
  showMsg(`🏁 ZIEL! PLATZ ${p.place}  +${fmtNum(p.pts.place)}`, '#ffcf5a');
  Sfx.beep(true); setTimeout(() => Sfx.beep(true), 250);
  setTimeout(() => { if (race && race.player === p) showResults(); }, 2600);
}
const totalScore = (p) => p.pts.coins + p.pts.nitro + p.pts.air + p.pts.drift + p.pts.laps + p.pts.place + p.pts.repair;

// ---------- camera
function updateCamera(dt) {
  const p = race.player, v = Math.hypot(p.speed, p.vlat);
  const fx = Math.sin(p.heading), fz = Math.cos(p.heading);
  let pos, look;
  if (p.wrecked) {
    race.wreckAng = (race.wreckAng ?? p.heading + Math.PI) + dt * 0.45;
    pos = _v.set(p.x + Math.sin(race.wreckAng) * 13, p.y + 5.5, p.z + Math.cos(race.wreckAng) * 13); look = _v2.set(p.x, p.y + 1, p.z);
    race.camPos.lerp(pos, 1 - Math.exp(-3 * dt)); race.camLook.lerp(look, 1 - Math.exp(-6 * dt));
  } else {
    race.wreckAng = null;
    const m = race.camMode;
    if (race.camH == null) race.camH = p.heading;
    race.camBeta = damp(race.camBeta || 0, p.beta || 0, 6, dt);   // smoothed, so small slip changes do not swing the view
    race.camH += wrapAng(p.heading - (m === 2 ? 0 : race.camBeta * 0.9) - race.camH) * (1 - Math.exp(-(m === 2 ? 40 : 7) * dt));
    const hx = Math.sin(race.camH), hz = Math.cos(race.camH);
    const back = m === 0 ? 7.4 + v * 0.013 : m === 1 ? 5.2 + v * 0.007 : -0.6;
    const up = m === 0 ? 2.6 + v * 0.005 : m === 1 ? 1.8 : 1.25;
    race.camY = damp(race.camY ?? p.y + up, p.y + up, m === 2 ? 40 : 6, dt);
    pos = _v.set(p.x - hx * back, race.camY, p.z - hz * back);
    look = _v2.set(p.x + hx * (m === 2 ? 30 : 8), p.y + (m === 2 ? 1.0 : 1.1), p.z + hz * (m === 2 ? 30 : 8));
    if (race.state === 'countdown') { race.camPos.lerp(pos, 1 - Math.exp(-2.2 * dt)); race.camLook.lerp(look, 1 - Math.exp(-4 * dt)); }
    else { race.camPos.lerp(pos, 1 - Math.exp(-25 * dt)); race.camLook.lerp(look, 1 - Math.exp(-25 * dt)); }
  }
  camera.position.copy(race.camPos);
  if (race.shake > 0) { const s = race.shake * 0.35; camera.position.x += rand(-s, s); camera.position.y += rand(-s, s) * 0.6; camera.position.z += rand(-s, s); race.shake = Math.max(0, race.shake - dt * 2.2); }
  camera.lookAt(race.camLook);
  const tf = 64 + clamp(v / p.phys.vmax, 0, 1.3) * 12 + (p.nitroOn ? 14 : 0);
  race.fov = damp(race.fov, tf, 4, dt);
  if (Math.abs(camera.fov - race.fov) > 0.05) { camera.fov = race.fov; camera.updateProjectionMatrix(); race.fx.setScale(innerHeight, camera.fov); race.smoke.setScale(innerHeight, camera.fov); }
  // follow lights & sky
  const sun = race.world.sun; sun.target.position.set(p.x, 0, p.z); sun.position.set(p.x + sun.userData.dir.x * 150, sun.userData.dir.y * 150, p.z + sun.userData.dir.z * 150);
  race.world.skyG.position.copy(camera.position);
}

// ---------- main race tick
function updateRace(dt) {
  const r = race; r.t += dt;
  if (r.state === 'paused' || r.state === 'wreckMenu') { updateCamera(0); return; }
  if (r.state === 'countdown') {
    r.cd -= dt; const n = Math.ceil(r.cd - 0.6);
    if (n !== r.cdShown) {
      r.cdShown = n;
      if (n >= 1 && n <= 3) { $('countdown').textContent = n; Sfx.beep(false); r.world.startLights.forEach((l, i) => l.material.color.setHex(i < (4 - n) * 2 - 1 ? 0xff1a1a : 0x220000).multiplyScalar(i < (4 - n) * 2 - 1 ? 4 : 1)); }
    }
    if (r.cd <= 0.6) { r.state = 'race'; $('countdown').textContent = 'GO!'; Sfx.beep(true); r.world.startLights.forEach(l => l.material.color.setHex(0x22ff55).multiplyScalar(2.5)); setTimeout(() => { if ($('countdown').textContent === 'GO!') $('countdown').textContent = ''; }, 900); }
  } else { r.clock += dt; if (!r.player.finished) r.raceTime += dt; if (r.mode === 'endless') updateEndless(dt); }
  const steps = dt > 0.022 ? 2 : 1, h = dt / steps;
  for (let i = 0; i < steps; i++) { updatePlayer(h); for (const a of r.ais) updateAI(a, h); if (r.state !== 'countdown') collide(); }
  // coins spin / respawn
  for (const c of r.td.coins) { if (c.taken > 0) { c.taken -= dt; if (c.taken <= 0) c.mesh.visible = true; } else c.mesh.rotation.y += dt * 3; }
  for (const o of r.td.obstacles) if (o.hit && r.t - o.hit < 0.4) { o.mesh.position.y = 0.55 + Math.sin((r.t - o.hit) * 60) * 0.06; }
  for (const f of r.world.animated) f(dt, r.t);
  if (r.flash) { r.flash.intensity *= Math.exp(-dt * 3); if (r.flash.intensity < 20) { r.scene.remove(r.flash); r.flash.dispose(); r.flash = null; } }
  r.fx.update(dt); r.smoke.update(dt);
  // placement
  const p = r.player;
  if (!p.finished) p.place = 1 + r.ais.filter(a => a.finished || a.progress > p.progress).length;
  if (p.wrecked && r.state === 'race' && p.wreckT > 1.7) {
    if (r.mode === 'endless') { emergencyRepair(true); if (!r.end.over) endAdd(-END_CFG.wreck, '💥 NOTREPARATUR'); }
    else { r.state = 'wreckMenu'; openModal('wreck'); }
  }
  updateLine();
  updateCamera(dt);
  updateHud();
  const f = clamp(Math.abs(p.speed) / p.phys.vmax, 0, 1.2);
  Sfx.engineUpdate(hudRpm(p), (input.gas && !r.pitCtl && !p.finished) || p.nitroOn ? 1 : 0, p.nitroOn, !p.wrecked && r.state !== 'paused', p.offroad ? 0 : p.skid, r.mode === 'endless' ? r.end.rain : 0);
  r.ais.forEach((a, i) => { const d = Math.hypot(a.x - p.x, a.z - p.z), cl = a.lastD != null && dt > 0 ? (a.lastD - d) / dt : 0; a.lastD = d; Sfx.rivalUpdate(i, hudRpm(a), 0.17 / (1 + (d / 10) ** 2), 1 + clamp(cl / 340, -0.12, 0.12)); });
}
function hudGear(p) { if (p.isPlayer) return p.gear; if (p.speed < -0.5) return 'R'; const f = Math.abs(p.speed) / p.phys.vmax; let g = 1; while (g < 8 && f > GEARS[g]) g++; return g; }
function hudRpm(p) {
  const g = hudGear(p), f = Math.hypot(p.speed, p.vlat || 0) / p.phys.vmax;
  if (g === 'R') return 1400 + clamp(Math.abs(p.speed) / 14, 0, 1) * 5000;
  if (p.drifting) return 7000 + Math.random() * 1500;   // wheels spinning
  if (f < 0.01) return 1400 + (input.gas && !p.wrecked ? 2600 + Math.random() * 300 : 0);
  return 1400 + clamp((f - GEARS[g - 1]) / (GEARS[g] - GEARS[g - 1]), 0, 1) * 7600;
}
