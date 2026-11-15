// ============================================================
//  TRACK DEFINITIONS
// ============================================================
const ROAD_HW = 16, CURB_W = 1.8, GRAVEL_OUT = 22.5, WALL = 22.8, PIT_WALL = 34, PIT_S0 = 25, PIT_S1 = 245, PIT_LIMIT = 180 / 3.6;
const TRACKS = [
  { id: 'alps', name: 'Alpenpass Grand Tour', laps: 3, ramps: 5, wear: 0.85, color: '#7fd3ff',
    desc: 'Strahlender Sonnenschein, Schneegipfel, Tannenwälder, Holz-Chalets, Bergsee & Windräder.',
    pts: [[0,0],[0,160],[0,320],[30,440],[130,520],[280,530],[400,460],[470,340],[560,250],[700,240],[800,330],[820,480],[760,620],[640,700],[480,720],[330,780],[180,860],[20,860],[-120,780],[-200,640],[-190,480],[-110,380],[-150,250],[-210,120],[-200,-60],[-200,-250],[-171,-321],[-100,-350],[-29,-321],[0,-250],[0,-125]] },
  { id: 'gp', name: 'Grand Prix Endurance', laps: 4, ramps: 3, wear: 1.15, color: '#ffb46b',
    desc: 'Golden Hour, große Tribünen & Schikanen. 4 Runden + hoher Verschleiß: Boxenstopp entscheidend!',
    pts: [[0,0],[0,170],[0,340],[10,470],[90,540],[200,540],[260,600],[260,720],[330,800],[480,800],[620,760],[700,640],[690,500],[620,420],[640,300],[740,220],[800,100],[760,-40],[650,-100],[540,-90],[450,-160],[340,-220],[240,-320],[170,-370],[100,-360],[29,-331],[0,-260],[0,-130]] },
  { id: 'tokyo', name: 'Tokyo Bay Highway', laps: 3, ramps: 4, wear: 0.95, color: '#ff5bd8',
    desc: 'Nächtliche Hochgeschwindigkeits-Autobahn, Sternenhimmel, Laternen & Neon-Skyline.',
    pts: [[0,0],[0,200],[0,400],[60,580],[220,700],[440,740],[680,720],[900,640],[1040,500],[1060,320],[980,170],[820,110],[640,140],[500,60],[460,-120],[520,-300],[480,-460],[320,-540],[140,-520],[30,-420],[0,-260],[0,-130]] },
];

function makeTrackData(def) {
  const curve = new THREE.CatmullRomCurve3(def.pts.map(p => new THREE.Vector3(p[0], 0, p[1])), true, 'centripetal', 0.5);
  const L = curve.getLength(), N = Math.round(L / 2), ds = L / N;
  const P = curve.getSpacedPoints(N).slice(0, N);
  const T = [], R = [], H = new Float32Array(N), K = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const a = P[(i - 1 + N) % N], b = P[(i + 1) % N];
    const t = new THREE.Vector3(b.x - a.x, 0, b.z - a.z).normalize();
    T.push(t); R.push(new THREE.Vector3(-t.z, 0, t.x)); H[i] = Math.atan2(t.x, t.z);
  }
  const k0 = new Float32Array(N);
  for (let i = 0; i < N; i++) k0[i] = wrapAng(H[(i + 1) % N] - H[(i - 1 + N) % N]) / (2 * ds);
  for (let i = 0; i < N; i++) { let s = 0; for (let j = -6; j <= 6; j++) s += k0[(i + j + N) % N]; K[i] = s / 13; }
  // ideal racing line (inside of corners, smoothed)
  const raw = new Float32Array(N), ideal = new Float32Array(N);
  for (let i = 0; i < N; i++) raw[i] = clamp(-K[i] * 1400, -10.5, 10.5);
  for (let i = 0; i < N; i++) { let s = 0, w = 0; for (let j = -30; j <= 30; j++) { const ww = 1 - Math.abs(j) / 31; s += raw[(i + j + N) % N] * ww; w += ww; } ideal[i] = s / w; }
  const td = { def, curve, L, N, ds, P, T, R, H, K, ideal };
  td.wrap = (s) => ((s % L) + L) % L;
  td.idx = (s) => Math.floor(td.wrap(s) / ds) % N;
  td.at = (s, lat = 0, out = new THREE.Vector3()) => {
    const w = td.wrap(s), f = w / ds, i = Math.floor(f) % N, j = (i + 1) % N, u = f - Math.floor(f);
    const px = lerp(P[i].x, P[j].x, u), pz = lerp(P[i].z, P[j].z, u), rx = lerp(R[i].x, R[j].x, u), rz = lerp(R[i].z, R[j].z, u);
    return out.set(px + rx * lat, 0, pz + rz * lat);
  };
  td.heading = (s) => { const w = td.wrap(s), f = w / ds, i = Math.floor(f) % N, j = (i + 1) % N; return H[i] + wrapAng(H[j] - H[i]) * (f - Math.floor(f)); };
  td.idealAt = (s) => ideal[td.idx(s)];
  td.project = (x, z, hint = -1) => {
    let best = -1, bd = Infinity;
    if (hint < 0) { for (let i = 0; i < N; i += 2) { const dx = x - P[i].x, dz = z - P[i].z, d = dx * dx + dz * dz; if (d < bd) { bd = d; best = i; } } hint = best; bd = Infinity; }
    for (let k = -24; k <= 24; k++) { const i = (hint + k + N) % N, dx = x - P[i].x, dz = z - P[i].z, d = dx * dx + dz * dz; if (d < bd) { bd = d; best = i; } }
    const dx = x - P[best].x, dz = z - P[best].z;
    const along = dx * T[best].x + dz * T[best].z;
    return { i: best, s: td.wrap(best * ds + along), lat: dx * R[best].x + dz * R[best].z };
  };
  td.rightWall = (s) => {
    s = td.wrap(s);
    if (s >= PIT_S0 && s <= PIT_S1) { const a = s < PIT_S0 + 20 ? (s - PIT_S0) / 20 : s > PIT_S1 - 20 ? (PIT_S1 - s) / 20 : 1; return WALL + smooth(a) * (PIT_WALL - WALL); }
    return WALL;
  };
  td.inPitZone = (s, lat) => { s = td.wrap(s); return s > PIT_S0 + 8 && s < PIT_S1 - 8 && lat > ROAD_HW + CURB_W + 0.8; };
  // ramps
  const straightOK = (s, lim) => { for (let d = -70; d <= 220; d += 6) if (Math.abs(K[td.idx(s + d)]) > lim) return false; return true; };
  td.ramps = [];
  const n = def.ramps, span = L - 560, lats = [0, -6, 6, 0, -5, 5];
  for (let k = 0; k < n; k++) {
    const target = 400 + (k + 0.5) * span / n; let found = null;
    for (const lim of [1 / 700, 1 / 450, 1 / 300, 1 / 200, 1]) {
      for (let d = 0; d < span / n / 2 && !found; d += 8) for (const sg of [1, -1]) { const s = target + d * sg; if (s > 380 && s < L - 230 && straightOK(s, lim)) { found = s; break; } }
      if (found) break;
    }
    if (found != null) td.ramps.push({ s: found, len: 18, h: 2.3, lat: lats[k % lats.length], hw: 9 });
  }
  td.groundH = (s, lat) => {
    for (const r of td.ramps) {
      let d = s - r.s; if (d < -L / 2) d += L; if (d > L / 2) d -= L;
      if (d >= 0 && d <= r.len && Math.abs(lat - r.lat) < r.hw) return r.h * d / r.len;
    }
    return 0;
  };
  // coins (42) – rows before ramps, airborne coins above landing, rest along racing line
  td.coins = [];
  for (const r of td.ramps) {
    for (const d of [-62, -44, -26]) td.coins.push({ s: td.wrap(r.s + d), lat: r.lat, y: 1.2 });
    td.coins.push({ s: td.wrap(r.s + r.len + 40), lat: r.lat, y: 5.2 });
  }
  const busy = (s, m) => td.ramps.some(r => { let d = s - r.s; if (d < -L / 2) d += L; if (d > L / 2) d -= L; return d > -90 - m && d < r.len + 140 + m; }) || td.wrap(s) < 330 + m || td.wrap(s) > L - 60 - m;
  const groups = Math.ceil((42 - td.coins.length) / 3);
  let gi = 0;
  for (let k = 0; k < 400 && td.coins.length < 42; k++) {
    const s = td.wrap(340 + ((gi + 0.5) / groups) * (L - 420) + (k % 7) * 9);
    if (busy(s, 0) && k % 7 !== 6) continue;
    for (let j = 0; j < 3 && td.coins.length < 42; j++) { const ss = td.wrap(s + j * 14); td.coins.push({ s: ss, lat: td.idealAt(ss), y: 1.2 }); }
    gi++; k = Math.ceil(k / 7) * 7 + 6;
  }
  // red obstacles
  td.obstacles = [];
  for (let k = 0; k < 7; k++) {
    let s = td.wrap(420 + (k + 0.25) * (L - 520) / 7);
    for (let t = 0; t < 60 && (busy(s, 130) || td.coins.some(c => Math.abs(c.s - s) < 22)); t++) s = td.wrap(s + 17);
    const id = td.idealAt(s); const lat = clamp(id > 0 ? id - 10 : id + 10, -12.5, 12.5);
    td.obstacles.push({ s, lat, hit: 0 });
  }
  // extra obstacles, switched on lap by lap in the endless mode
  for (let k = 0; k < 10; k++) {
    let s = td.wrap(470 + (k + 0.6) * (L - 580) / 10);
    for (let t = 0; t < 80 && (busy(s, 130) || td.coins.some(c => Math.abs(c.s - s) < 22) || td.obstacles.some(o => Math.abs(o.s - s) < 70)); t++) s = td.wrap(s + 19);
    const id = td.idealAt(s), lat = clamp(k % 2 ? (id > 0 ? id - 7 : id + 7) : (id > 0 ? id + 6 : id - 6), -12.5, 12.5);
    td.obstacles.push({ s, lat, hit: 0, extra: true, active: false });
  }
  return td;
}

// ============================================================
//  GEOMETRY HELPERS
// ============================================================
function stripGeo(td, s0, s1, latA, latB, y, vScale, yB = null) {
  const step = td.ds, n = Math.max(1, Math.round((s1 - s0) / step));
  const pos = [], uv = [], idx = [];
  const p = new THREE.Vector3(), q = new THREE.Vector3();
  for (let k = 0; k <= n; k++) {
    const s = s0 + k * (s1 - s0) / n;
    const la = typeof latA === 'function' ? latA(s) : latA, lb = typeof latB === 'function' ? latB(s) : latB;
    td.at(s, la, p); td.at(s, lb, q);
    if (yB == null) { pos.push(p.x, y, p.z, q.x, y, q.z); }
    else { pos.push(p.x, y, p.z, p.x, yB, p.z); }
    uv.push(0, s / vScale, 1, s / vScale);
    if (k < n) { const a = k * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
}
function wallGeo(td, s0, s1, latF, y0, y1, vScale) {
  const step = td.ds, n = Math.max(1, Math.round((s1 - s0) / step));
  const pos = [], uv = [], idx = []; const p = new THREE.Vector3();
  for (let k = 0; k <= n; k++) {
    const s = s0 + k * (s1 - s0) / n, l = typeof latF === 'function' ? latF(s) : latF;
    td.at(s, l, p); pos.push(p.x, y0, p.z, p.x, y1, p.z); uv.push(s / vScale, 0, s / vScale, 1);
    if (k < n) { const a = k * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeVertexNormals(); return g;
}
function rampGeo(hw, len, h) {
  const g = new THREE.BufferGeometry();
  const v = [
    -hw, 0, 0, hw, 0, 0, hw, h, len, -hw, h, len, // slope 0-3
    -hw, 0, len, hw, 0, len, hw, h, len, -hw, h, len, // back 4-7
    -hw, 0, 0, -hw, h, len, -hw, 0, len, // left 8-10
    hw, 0, 0, hw, 0, len, hw, h, len, // right 11-13
  ];
  const uv = [0, 0, 1, 0, 1, 1, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1, 0, 0, 1, 1, 1, 0, 0, 0, 1, 0, 1, 1];
  g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex([0, 2, 1, 0, 3, 2, 4, 5, 6, 4, 6, 7, 8, 10, 9, 11, 13, 12]);
  g.addGroup(0, 6, 0); g.addGroup(6, 12, 1);
  g.computeVertexNormals(); return g;
}
function skyDome(top, horizon, bottom) {
  const g = new THREE.SphereGeometry(4500, 32, 16);
  const m = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { top: { value: new THREE.Color(top) }, hor: { value: new THREE.Color(horizon) }, bot: { value: new THREE.Color(bottom) } },
    vertexShader: 'varying vec3 vP; void main(){ vP=normalize(position); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
    fragmentShader: 'uniform vec3 top; uniform vec3 hor; uniform vec3 bot; varying vec3 vP; void main(){ float h=vP.y; vec3 c = h>0.0 ? mix(hor, top, pow(h,0.6)) : mix(hor, bot, pow(-h,0.4)); gl_FragColor=vec4(c,1.0); }',
  });
  const s = new THREE.Mesh(g, m); s.renderOrder = -10; s.frustumCulled = false; return s;
}

// spatial grid of track samples for "is this far from the track?" queries
function makeTrackGrid(td) {
  const cell = 40, map = new Map();
  for (let i = 0; i < td.N; i += 3) { const p = td.P[i], k = Math.floor(p.x / cell) + ',' + Math.floor(p.z / cell); if (!map.has(k)) map.set(k, []); map.get(k).push(p); }
  return (x, z, minD) => {
    const r = Math.ceil(minD / cell), cx = Math.floor(x / cell), cz = Math.floor(z / cell), m2 = minD * minD;
    for (let a = -r; a <= r; a++) for (let b = -r; b <= r; b++) { const l = map.get((cx + a) + ',' + (cz + b)); if (l) for (const p of l) { const dx = p.x - x, dz = p.z - z; if (dx * dx + dz * dz < m2) return false; } }
    return true;
  };
}

// ============================================================
//  BUILD TRACK SCENE
// ============================================================
function buildTrackScene(td) {
  const scene = new THREE.Scene();
  scene.environment = ENV_TEX;
  const env = td.def.id;
  const night = env === 'tokyo';
  const L = td.L;
  const far = makeTrackGrid(td);
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const p of td.P) { minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x); minZ = Math.min(minZ, p.z); maxZ = Math.max(maxZ, p.z); }
  const cx = (minX + maxX) / 2, cz = (minZ + maxZ) / 2, ext = Math.max(maxX - minX, maxZ - minZ) / 2;
  const animated = [];
  const R = seeded(env.length * 977 + 13);
  const skyG = new THREE.Group(); scene.add(skyG);

  // --- road & surfaces
  const roadMat = new THREE.MeshStandardMaterial({ map: TEX.asphalt, roughness: night ? 0.55 : 0.85, metalness: 0.05, color: night ? 0x9aa0b0 : 0xffffff });
  const road = new THREE.Mesh(stripGeo(td, 0, L, -ROAD_HW, ROAD_HW, 0, 16), roadMat); road.receiveShadow = true; scene.add(road);
  // rubbered-in racing line
  const rub = new THREE.Mesh(stripGeo(td, 0, L, (s) => td.idealAt(s) - 3, (s) => td.idealAt(s) + 3, 0.012, 24), new THREE.MeshBasicMaterial({ map: TEX.rubber, transparent: true, opacity: night ? 0.3 : 0.42, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }));
  scene.add(rub);
  const curbMat = new THREE.MeshStandardMaterial({ map: TEX.curb, roughness: 0.6 });
  for (const sd of [-1, 1]) {
    const a = sd < 0 ? -ROAD_HW - CURB_W : ROAD_HW, b = sd < 0 ? -ROAD_HW : ROAD_HW + CURB_W;
    const c = new THREE.Mesh(stripGeo(td, 0, L, a, b, 0.03, 6), curbMat); c.receiveShadow = true; scene.add(c);
  }
  const gravelMat = new THREE.MeshStandardMaterial({ map: TEX.gravel, roughness: 1, color: night ? 0x6a6a72 : 0xffffff });
  scene.add(new THREE.Mesh(stripGeo(td, 0, L, -GRAVEL_OUT, -ROAD_HW - CURB_W, 0.01, 10), gravelMat));
  scene.add(new THREE.Mesh(stripGeo(td, PIT_S1, L + PIT_S0, ROAD_HW + CURB_W, GRAVEL_OUT, 0.01, 10), gravelMat));
  // pit lane surface
  const pitMat = new THREE.MeshStandardMaterial({ map: TEX.asphaltPit, roughness: 0.7, emissive: 0x0b3d1f, emissiveIntensity: night ? 0.3 : 0.2 });
  const pit = new THREE.Mesh(stripGeo(td, PIT_S0, PIT_S1, ROAD_HW + CURB_W, (s) => td.rightWall(s) - 0.2, 0.015, 24), pitMat); pit.receiveShadow = true; scene.add(pit);
  // start line
  const sl = new THREE.Mesh(stripGeo(td, -1.5, 1.5, -ROAD_HW, ROAD_HW, 0.02, 3), new THREE.MeshStandardMaterial({ map: TEX.checker, roughness: 0.7 }));
  scene.add(sl);

  // --- guardrails & pit wall
  const railMat = new THREE.MeshStandardMaterial({ map: TEX.rail, metalness: 0.85, roughness: 0.3, side: THREE.DoubleSide });
  scene.add(new THREE.Mesh(wallGeo(td, 0, L, -WALL, 0.3, 0.9, 4), railMat));
  scene.add(new THREE.Mesh(wallGeo(td, PIT_S1, L + PIT_S0, WALL, 0.3, 0.9, 4), railMat));
  const pitWallMat = new THREE.MeshStandardMaterial({ map: TEX.concrete, color: 0xb9bec8, roughness: 0.9, side: THREE.DoubleSide });
  scene.add(new THREE.Mesh(wallGeo(td, PIT_S0, PIT_S1, (s) => td.rightWall(s), 0, 1.2, 8), pitWallMat));
  const ledMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0x38ff8b).multiplyScalar(1.8), side: THREE.DoubleSide });
  scene.add(new THREE.Mesh(wallGeo(td, PIT_S0, PIT_S1, (s) => td.rightWall(s), 1.2, 1.32, 8), ledMat));
  // posts
  const postGeo = new THREE.BoxGeometry(0.18, 0.95, 0.18), postMat = new THREE.MeshStandardMaterial({ color: 0x8a9099, metalness: 0.7, roughness: 0.4 });
  const posts = []; const tmpV = new THREE.Vector3();
  for (let s = 0; s < L; s += 6) { posts.push([s, -WALL - 0.12]); if (s < PIT_S0 || s > PIT_S1) posts.push([s, WALL + 0.12]); }
  const pim = new THREE.InstancedMesh(postGeo, postMat, posts.length); const M = new THREE.Matrix4();
  posts.forEach(([s, l], i) => { td.at(s, l, tmpV); M.makeTranslation(tmpV.x, 0.47, tmpV.z); pim.setMatrixAt(i, M); }); scene.add(pim);

  // --- pit repair arches
  const archMat = new THREE.MeshStandardMaterial({ color: 0x0c2a18, emissive: 0x38ff8b, emissiveIntensity: 1.6, metalness: 0.4, roughness: 0.4 });
  for (let s = PIT_S0 + 40; s <= PIT_S1 - 30; s += 40) {
    const g = new THREE.Group(); const a = td.at(s, ROAD_HW + CURB_W + 0.5), b = td.at(s, td.rightWall(s) - 0.6);
    const mid = a.clone().add(b).multiplyScalar(0.5), w = a.distanceTo(b);
    g.position.copy(mid); g.rotation.y = td.heading(s);
    for (const sx of [-1, 1]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.5, 6.5, 0.5), archMat); p.position.set(sx * w / 2, 3.25, 0); g.add(p); }
    const beam = new THREE.Mesh(new THREE.BoxGeometry(w + 0.5, 0.5, 0.5), archMat); beam.position.y = 6.5; g.add(beam);
    const sign = textSprite('🔧 REPAIR', { color: '#38ff8b', border: '#38ff8b', bg: 'rgba(0,30,12,.8)', scale: 0.014 }); sign.position.set(0, 7.6, 0); g.add(sign);
    scene.add(g);
  }
  const pitSign = textSprite('BOXENGASSE ▸ REPARATUR', { color: '#001a0a', bg: '#38ff8b', border: '#0a7a3a', w: 900, scale: 0.014 });
  td.at(PIT_S0 - 10, WALL + 3, tmpV); pitSign.position.set(tmpV.x, 4.5, tmpV.z); scene.add(pitSign);

  // --- start gantry with lights
  const gantry = new THREE.Group(); const gp = td.at(10, 0); gantry.position.copy(gp); gantry.rotation.y = td.heading(10);
  const gMat = new THREE.MeshStandardMaterial({ color: 0x1c1f26, metalness: 0.6, roughness: 0.4 });
  for (const sx of [-1, 1]) { const p = new THREE.Mesh(new THREE.BoxGeometry(1.2, 9, 1.2), gMat); p.position.set(sx * 19, 4.5, 0); p.castShadow = true; gantry.add(p); }
  const beam = new THREE.Mesh(new THREE.BoxGeometry(39.2, 2.2, 1.4), gMat); beam.position.y = 9; gantry.add(beam);
  const signTex = canvasTex(1024, 96, (g, w, h) => { g.fillStyle = '#0b0e16'; g.fillRect(0, 0, w, h); g.font = '900 60px Orbitron, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; const gr = g.createLinearGradient(0, 0, w, 0); gr.addColorStop(0, '#ffcf5a'); gr.addColorStop(1, '#ff7a1a'); g.fillStyle = gr; g.fillText('APEX HYPERDRIVE 3D', w / 2, h / 2 + 4); });
  for (const sd of [-1, 1]) { const sg = new THREE.Mesh(new THREE.PlaneGeometry(30, 2.4), new THREE.MeshBasicMaterial({ map: signTex })); sg.position.set(0, 9, sd * 0.72); if (sd < 0) sg.rotation.y = Math.PI; gantry.add(sg); }
  const startLights = [];
  for (let i = 0; i < 5; i++) { const m = new THREE.Mesh(new THREE.SphereGeometry(0.42, 14, 10), new THREE.MeshBasicMaterial({ color: 0x220000 })); m.position.set((i - 2) * 1.4, 7.3, -0.8); gantry.add(m); startLights.push(m); }
  scene.add(gantry);

  // --- ramps
  const rampTop = new THREE.MeshStandardMaterial({ color: 0x0a1830, emissive: 0xffffff, emissiveMap: TEX.chevron, emissiveIntensity: 1.3, roughness: 0.5, metalness: 0.2 });
  const rampSide = new THREE.MeshStandardMaterial({ color: 0x2a3140, metalness: 0.6, roughness: 0.45 });
  for (const r of td.ramps) {
    const m = new THREE.Mesh(rampGeo(r.hw, r.len, r.h), [rampTop, rampSide]);
    m.position.copy(td.at(r.s, r.lat)); m.rotation.y = td.heading(r.s); m.castShadow = true; m.receiveShadow = true; scene.add(m);
    const sp = textSprite('▲ JUMP ▲', { color: '#3bd5ff', border: '#3bd5ff', bg: 'rgba(0,10,30,.8)', scale: 0.012 });
    td.at(r.s - 4, r.lat - r.hw - 2, tmpV); sp.position.set(tmpV.x, 2.8, tmpV.z); scene.add(sp);
  }
  // --- coins
  const coinGeo = new THREE.CylinderGeometry(0.85, 0.85, 0.16, 28).rotateX(Math.PI / 2);
  const coinMat = new THREE.MeshStandardMaterial({ color: 0xffc83a, metalness: 1, roughness: 0.18, emissive: 0x6b4300, emissiveIntensity: night ? 0.9 : 0.35 });
  const coinStar = new THREE.MeshBasicMaterial({ color: 0xfff1b0 });
  const coinStarGeo = new THREE.TorusGeometry(0.5, 0.06, 6, 20);
  for (const c of td.coins) {
    const g = new THREE.Group(); g.add(new THREE.Mesh(coinGeo, coinMat)); const st = new THREE.Mesh(coinStarGeo, coinStar); g.add(st);
    td.at(c.s, c.lat, tmpV); g.position.set(tmpV.x, c.y, tmpV.z); c.mesh = g; c.taken = 0; scene.add(g);
  }
  // --- obstacles
  const obsMat = [new THREE.MeshStandardMaterial({ map: TEX.wallStripe, color: 0xffffff, roughness: 0.5, emissive: night ? 0x400000 : 0x000000 }), new THREE.MeshStandardMaterial({ color: 0xd61e1e, roughness: 0.5 })];
  for (const o of td.obstacles) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.1, 1.2), [obsMat[0], obsMat[0], obsMat[1], obsMat[1], obsMat[0], obsMat[0]]);
    td.at(o.s, o.lat, tmpV); m.position.set(tmpV.x, 0.55, tmpV.z); m.rotation.y = td.heading(o.s); m.castShadow = true; m.visible = o.active !== false; o.mesh = m; scene.add(m);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: TEX.glow, color: 0xff2020, blending: THREE.AdditiveBlending, depthWrite: false, opacity: night ? 0.9 : 0.5 })); sp.scale.setScalar(2.2); sp.position.set(0, 0.9, 0); m.add(sp);
  }

  // ============ ENVIRONMENT ============
  let sun, hemi, fogColor;
  const groundSize = 9000;
  const addGround = (tex, color = 0xffffff, y = -0.25, rough = 1) => { const g = new THREE.Mesh(new THREE.PlaneGeometry(groundSize, groundSize, 72, 72), new THREE.MeshStandardMaterial({ map: tex, color, roughness: rough, polygonOffset: true, polygonOffsetFactor: 2, polygonOffsetUnits: 4 })); g.rotation.x = -Math.PI / 2; g.position.set(cx, y, cz); g.receiveShadow = true; scene.add(g); return g; };
  const placeRandom = (count, minTrack, radius, fn) => { let tries = 0, made = 0; while (made < count && tries < count * 25) { tries++; const a = R() * Math.PI * 2, d = Math.sqrt(R()) * radius; const x = cx + Math.cos(a) * d, z = cz + Math.sin(a) * d; if (!far(x, z, minTrack)) continue; fn(x, z, made++); } };

  let envRT = null, terrain = null, skyMesh = null, clouds = [];
  const dist = env === 'tokyo' ? null : trackDistField(td);
  const farPlane = (hex) => { const g = new THREE.Mesh(new THREE.PlaneGeometry(40000, 40000).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: hex })); g.position.set(cx, -45, cz); scene.add(g); };
  if (env === 'alps') {
    fogColor = 0xbfd4e8;
    const sd = new THREE.Vector3(0.5, 0.62, 0.3).normalize(), so = { turbidity: 2.5, rayleigh: 1.3, mie: 0.004, mieG: 0.8, gain: 0.42 };
    skyMesh = makeSky(sd, so); skyG.add(skyMesh); envRT = skyEnv(sd, so, 0x33502a);
    clouds = addClouds(skyG, R, 0xffffff, 18);
    scene.fog = new THREE.Fog(fogColor, 1200, 7500);
    hemi = new THREE.HemisphereLight(0xcfe4ff, 0x4b6b38, 0.8); scene.add(hemi);
    sun = new THREE.DirectionalLight(0xfff1d8, 2.9); sun.userData.dir = sd;
    farPlane(0x6f8f6a);
    let lake = null;
    for (let t = 0; t < 800 && !lake; t++) { const x = cx + (R() - 0.5) * ext * 1.7, z = cz + (R() - 0.5) * ext * 1.7; if (dist(x, z) > 185) lake = { x, z, r: 95 }; }
    terrain = buildTerrain(dist, { seed: 11, cx, cz, flatR: 42, ramp: 160, hillAmp: 60, hillFreq: 0.0034, mountAmp: 1000, mountFreq: 0.0008, farStart: ext + 300, farEnd: ext + 1700, lake, color: alpsColor });
    scene.add(terrain.mesh);
    if (lake) { const lm = new THREE.Mesh(new THREE.CircleGeometry(lake.r + 8, 48).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x1c5a86, metalness: 0.9, roughness: 0.05, envMapIntensity: 1.5 })); lm.position.set(lake.x, -0.8, lake.z); scene.add(lm); }
    // wind turbines on the highest ridges around the track
    const tw = new THREE.MeshStandardMaterial({ color: 0xf2f4f6, roughness: 0.5 }), cand = [];
    for (let i = 0; i < 500; i++) { const a = R() * Math.PI * 2, d = R() * (ext + 700), x = cx + Math.cos(a) * d, z = cz + Math.sin(a) * d, dt = dist(x, z); if (dt > 220 && dt < 850) cand.push([terrain.h(x, z), x, z]); }
    cand.sort((a, b) => b[0] - a[0]); const picked = [];
    for (const [h, x, z] of cand) {
      if (picked.length >= 8 || h < 22) break; if (picked.some(q => Math.hypot(q[0] - x, q[1] - z) < 260)) continue; picked.push([x, z]);
      const t = new THREE.Group(); t.position.set(x, h - 1.5, z); t.rotation.y = R() * 6;
      const tower = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 2.2, 70, 10), tw); tower.position.y = 35; t.add(tower);
      const nac = new THREE.Mesh(new THREE.BoxGeometry(3, 3, 8), tw); nac.position.set(0, 71, 0); t.add(nac);
      const rotor = new THREE.Group(); rotor.position.set(0, 71, 4.3); t.add(rotor);
      rotor.add(new THREE.Mesh(new THREE.SphereGeometry(1.4, 10, 8), tw));
      for (let b = 0; b < 3; b++) { const bl = new THREE.Mesh(new THREE.BoxGeometry(1.6, 34, 0.4), tw); bl.geometry.translate(0, 17, 0); bl.rotation.z = (b / 3) * Math.PI * 2; rotor.add(bl); }
      scene.add(t); animated.push((dt) => { rotor.rotation.z += dt * 0.9; });
    }
    // fir forest
    const firs = [], firN = LOW ? 700 : 1700;
    for (let t = 0; t < firN * 14 && firs.length < firN; t++) {
      const a = R() * Math.PI * 2, d = Math.sqrt(R()) * (ext + 950), x = cx + Math.cos(a) * d, z = cz + Math.sin(a) * d, dt = dist(x, z);
      if (dt < 33 || (lake && Math.hypot(x - lake.x, z - lake.z) < lake.r + 6)) continue;
      if (dt > 130 && terrain.noise.fbm(x * 0.0045, z * 0.0045, 3) < -0.12) continue;
      const y = terrain.h(x, z); if (y > 310) continue;
      firs.push([x, y, z, 0.75 + R() * 0.9]);
    }
    plantTrees(scene, firs, firGeo(), (c) => c.setRGB(0.75 + R() * 0.45, 0.8 + R() * 0.4, 0.75 + R() * 0.35));
    // chalets near the track
    const wood = new THREE.MeshStandardMaterial({ color: 0x7a4a2a, roughness: 0.9 }), roofM = new THREE.MeshStandardMaterial({ color: 0x3a2a24, roughness: 0.8 }), win = new THREE.MeshStandardMaterial({ color: 0x332211, emissive: 0xffb050, emissiveIntensity: 1.4 });
    let ch = 0;
    for (let t = 0; t < 600 && ch < 12; t++) {
      const s = R() * L, side = R() < 0.5 ? -1 : 1, d = 48 + R() * 60; const p = td.at(s, side * d);
      if (!far(p.x, p.z, 44)) continue; ch++;
      const g = new THREE.Group(); g.position.set(p.x, terrain.h(p.x, p.z) - 0.4, p.z); g.rotation.y = td.heading(s) + (side > 0 ? 0 : Math.PI);
      const b = new THREE.Mesh(new THREE.BoxGeometry(12, 7, 9), wood); b.position.y = 3; b.castShadow = true; g.add(b);
      const roof = new THREE.Mesh(new THREE.ConeGeometry(8.6, 4, 4, 1), roofM); roof.rotation.y = Math.PI / 4; roof.scale.set(1.05, 1, 0.8); roof.position.y = 8.4; roof.castShadow = true; g.add(roof);
      for (let w = -1; w <= 1; w++) { const wn = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.4), win); wn.position.set(w * 3.4, 3.6, -4.52); wn.rotation.y = Math.PI; g.add(wn); const wn2 = wn.clone(); wn2.position.z = 4.52; wn2.rotation.y = 0; g.add(wn2); }
      scene.add(g);
    }
  } else if (env === 'gp') {
    fogColor = 0xe6b48c;
    const sd = new THREE.Vector3(-0.85, 0.2, 0.35).normalize(), so = { turbidity: 8, rayleigh: 2.6, mie: 0.006, mieG: 0.86, gain: 0.5 };
    skyMesh = makeSky(sd, so); skyG.add(skyMesh); envRT = skyEnv(sd, so, 0x5a4a30);
    clouds = addClouds(skyG, R, 0xffd2b0, 14);
    scene.fog = new THREE.Fog(fogColor, 700, 6000);
    hemi = new THREE.HemisphereLight(0xffd2a8, 0x5a4a30, 0.8); scene.add(hemi);
    sun = new THREE.DirectionalLight(0xffb066, 2.9); sun.userData.dir = sd;
    farPlane(0x8a6f50);
    terrain = buildTerrain(dist, { seed: 23, cx, cz, flatR: 96, ramp: 220, hillAmp: 26, hillFreq: 0.004, mountAmp: 300, mountFreq: 0.0011, farStart: ext + 500, farEnd: ext + 1900, color: gpColor });
    scene.add(terrain.mesh);
    // grandstands
    const standMat = new THREE.MeshStandardMaterial({ color: 0x9aa3b2, roughness: 0.8 }), roofM = new THREE.MeshStandardMaterial({ color: 0xe8e8ec, metalness: 0.3, roughness: 0.5 });
    const crowdCols = [0xff3b3b, 0x3b8bff, 0xffd23b, 0xffffff, 0x2bd36b, 0xff8a1a, 0x9b5bff, 0x222222];
    const crowd = [];
    const standPos = [];
    const stand = (s, side, len, dist) => {
      const g = new THREE.Group(); const p = td.at(s, side * dist); standPos.push([p.x, p.z, len]); g.position.copy(p); g.rotation.y = td.heading(s) + (side < 0 ? -Math.PI / 2 : Math.PI / 2);
      for (let r = 0; r < 7; r++) { const st = new THREE.Mesh(new THREE.BoxGeometry(len, 1.2 + r * 1.2, 2.2), standMat); st.position.set(0, (1.2 + r * 1.2) / 2, -r * 2.2); st.receiveShadow = true; g.add(st); }
      const roof = new THREE.Mesh(new THREE.BoxGeometry(len + 2, 0.4, 18), roofM); roof.position.set(0, 13, -6.5); roof.castShadow = true; g.add(roof);
      for (let x = -len / 2 + 6; x <= len / 2 - 6; x += 18) { const c = new THREE.Mesh(new THREE.BoxGeometry(0.6, 13, 0.6), roofM); c.position.set(x, 6.5, -14.5); g.add(c); }
      scene.add(g); g.updateMatrixWorld(true);
      for (let r = 0; r < 7; r++) for (let x = -len / 2 + 1; x < len / 2 - 1; x += 1.1) if (R() < 0.82) { const v = new THREE.Vector3(x + (R() - 0.5) * 0.3, 1.2 + r * 1.2 + 0.45, -r * 2.2 + 0.2).applyMatrix4(g.matrixWorld); crowd.push([v, crowdCols[Math.floor(R() * crowdCols.length)]]); }
    };
    stand(80, -1, 300, 52);
    const corners = []; for (let i = 0; i < td.N; i += 5) corners.push([Math.abs(td.K[i]), i]); corners.sort((a, b) => b[0] - a[0]);
    const used = [];
    for (const [k, i] of corners) { const s = i * td.ds; if (s < 400 || s > L - 150 || used.some(u => Math.abs(u - s) < 500)) continue; used.push(s); stand(s, td.K[i] > 0 ? 1 : -1, 120, 60); if (used.length >= 3) break; }
    if (crowd.length) {
      const ci = new THREE.InstancedMesh(new THREE.BoxGeometry(0.5, 0.9, 0.45), new THREE.MeshStandardMaterial({ roughness: 0.8 }), crowd.length);
      crowd.forEach(([v, c], i) => { M.makeTranslation(v.x, v.y, v.z); ci.setMatrixAt(i, M); ci.setColorAt(i, new THREE.Color(c)); }); scene.add(ci);
    }
    // sponsor boards along the start straight
    const boardTex = canvasTex(1024, 128, (g, w, h) => { const items = ['APEX', 'HYPERDRIVE', 'ADRIAN_V12', 'KONSTI_GT', 'JULIEN_RS']; for (let i = 0; i < 5; i++) { g.fillStyle = ['#ff7a1a', '#101420', '#1e5bff', '#f2f2f2', '#d61e1e'][i]; g.fillRect(i * w / 5, 0, w / 5, h); g.fillStyle = i === 3 ? '#111' : '#fff'; g.font = '900 34px Orbitron, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(items[i], i * w / 5 + w / 10, h / 2); } }, { repeat: [1, 1] });
    for (const sd of [-1]) scene.add(new THREE.Mesh(wallGeo(td, -200, 330, sd * (WALL + 0.6), 0, 1.6, 60), new THREE.MeshStandardMaterial({ map: boardTex, side: THREE.DoubleSide, roughness: 0.6 })));
    // trees
    const tp = []; placeRandom(LOW ? 260 : 620, 38, ext + 750, (x, z) => { if (!standPos.some(q => Math.hypot(q[0] - x, q[1] - z) < q[2] / 2 + 30)) tp.push([x, terrain.h(x, z), z, 0.8 + R() * 0.9]); });
    plantTrees(scene, tp, leafTreeGeo(), (c) => c.setRGB(0.8 + R() * 0.4, 0.75 + R() * 0.4, 0.7 + R() * 0.3));
  } else {
    fogColor = 0x0b1230;
    skyG.add(skyDome(0x01020a, 0x1a1f4a, 0x05060f));
    scene.fog = new THREE.Fog(fogColor, 380, 2600);
    hemi = new THREE.HemisphereLight(0x5566aa, 0x1a1a2a, 0.75); scene.add(hemi);
    sun = new THREE.DirectionalLight(0xa8c0ff, 0.75); sun.userData.dir = new THREE.Vector3(0.3, 0.9, -0.3).normalize();
    // stars
    const sp = []; for (let i = 0; i < 2200; i++) { const u = R() * 2 - 1, a = R() * Math.PI * 2, y = Math.abs(u) * 0.95 + 0.05, r = Math.sqrt(1 - y * y); sp.push(Math.cos(a) * r * 4000, y * 4000, Math.sin(a) * r * 4000); }
    const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
    const stars = new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffffff, size: 2.2, sizeAttenuation: false, fog: false, transparent: true, opacity: 0.9 })); skyG.add(stars);
    const moon = new THREE.Sprite(new THREE.SpriteMaterial({ map: TEX.glow, color: 0xdfe8ff, fog: false, depthWrite: false })); moon.scale.setScalar(260); moon.position.set(1500, 1900, -2600); skyG.add(moon);
    addGround(TEX.concrete, 0x6a6e7a, -0.25, 0.9);
    const water = new THREE.Mesh(new THREE.PlaneGeometry(groundSize * 2, groundSize * 2, 64, 64), new THREE.MeshStandardMaterial({ color: 0x050b1e, metalness: 0.9, roughness: 0.15, envMapIntensity: 0.6, polygonOffset: true, polygonOffsetFactor: 4, polygonOffsetUnits: 8 }));
    water.rotation.x = -Math.PI / 2; water.position.set(cx, -0.8, cz); scene.add(water);
    // lamps + light pools
    const lamps = []; for (let s = 0; s < L; s += 42) { lamps.push([s, -WALL - 1.2, 1]); if (s < PIT_S0 - 5 || s > PIT_S1 + 5) lamps.push([s + 21, WALL + 1.2, -1]); }
    const poleI = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.15, 0.22, 11, 6).translate(0, 5.5, 0), new THREE.MeshStandardMaterial({ color: 0x3a3f4a, metalness: 0.7, roughness: 0.4 }), lamps.length);
    const headI = new THREE.InstancedMesh(new THREE.BoxGeometry(0.7, 0.25, 2.4), new THREE.MeshBasicMaterial({ color: new THREE.Color(0xfff0c8).multiplyScalar(1.8) }), lamps.length);
    const poolI = new THREE.InstancedMesh(new THREE.PlaneGeometry(26, 26).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: TEX.glow, color: 0xffcf8a, transparent: true, opacity: 0.32, blending: THREE.AdditiveBlending, depthWrite: false }), lamps.length);
    const glowI = []; const q = new THREE.Quaternion();
    lamps.forEach(([s, l, sd], i) => {
      const p = td.at(s, l); M.makeTranslation(p.x, 0, p.z); poleI.setMatrixAt(i, M);
      const h = td.at(s, l + sd * 2.6); q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), td.heading(s)); M.compose(new THREE.Vector3(h.x, 10.9, h.z), q, new THREE.Vector3(1, 1, 1)); headI.setMatrixAt(i, M);
      const pp = td.at(s, l + sd * 9); M.makeTranslation(pp.x, 0.06, pp.z); poolI.setMatrixAt(i, M);
      glowI.push([h.x, 10.6, h.z]);
    });
    scene.add(poleI, headI, poolI);
    const gGeo = new THREE.BufferGeometry(); gGeo.setAttribute('position', new THREE.Float32BufferAttribute(glowI.flat(), 3));
    scene.add(new THREE.Points(gGeo, new THREE.PointsMaterial({ map: TEX.glow, color: 0xffd9a0, size: 6, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })));
    // skyline
    const winTex = (col) => canvasTex(64, 128, (g, w, h) => { g.fillStyle = '#05070d'; g.fillRect(0, 0, w, h); for (let y = 4; y < h; y += 8) for (let x = 3; x < w; x += 8) { if (Math.random() < 0.55) { g.fillStyle = Math.random() < 0.85 ? col : '#fff6d0'; g.globalAlpha = 0.4 + Math.random() * 0.6; g.fillRect(x, y, 5, 4); } } g.globalAlpha = 1; }, { repeat: [1, 1] });
    const bMats = [new THREE.MeshStandardMaterial({ color: 0x10131c, emissive: 0xffffff, emissiveMap: winTex('#3be8ff'), emissiveIntensity: 1.15, roughness: 0.6, metalness: 0.3 }), new THREE.MeshStandardMaterial({ color: 0x14101c, emissive: 0xffffff, emissiveMap: winTex('#ff3bd4'), emissiveIntensity: 1.15, roughness: 0.6, metalness: 0.3 })];
    for (const m of bMats) { m.emissiveMap.wrapS = m.emissiveMap.wrapT = THREE.RepeatWrapping; }
    const blds = [[], []], tops = [];
    placeRandom(LOW ? 260 : 480, 60, ext + 900, (x, z, i) => {
      const dTrack = far(x, z, 160) ? 1 : 0; const h = (dTrack ? 60 : 25) + Math.pow(R(), 1.6) * (dTrack ? 260 : 80), w = 18 + R() * 30, d = 18 + R() * 30;
      const g = new THREE.BoxGeometry(w, h, d); const uv = g.attributes.uv.array;
      for (let k = 0; k < uv.length; k += 2) { const face = Math.floor(k / 2 / 4); const sx = face < 2 ? d : w; uv[k] *= sx / 12; uv[k + 1] *= h / 24; }
      g.translate(x, h / 2, z); blds[i % 2].push(g); if (h > 180) tops.push([x, h + 2, z]);
    });
    for (let k = 0; k < 2; k++) if (blds[k].length) { const merged = mergeBoxes(blds[k]); scene.add(new THREE.Mesh(merged, bMats[k])); }
    if (tops.length) { const tg = new THREE.BufferGeometry(); tg.setAttribute('position', new THREE.Float32BufferAttribute(tops.flat(), 3)); const tm = new THREE.PointsMaterial({ map: TEX.glow, color: 0xff2a2a, size: 14, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }); scene.add(new THREE.Points(tg, tm)); animated.push((dt, t) => { tm.opacity = 0.35 + 0.65 * (Math.sin(t * 3) > 0 ? 1 : 0.2); }); }
    // neon billboards
    const neon = (txt, col) => canvasTex(512, 128, (g, w, h) => { g.fillStyle = '#05050a'; g.fillRect(0, 0, w, h); g.shadowColor = col; g.shadowBlur = 24; g.strokeStyle = col; g.lineWidth = 6; g.strokeRect(10, 10, w - 20, h - 20); g.font = '900 64px Orbitron, sans-serif'; g.fillStyle = col; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(txt, w / 2, h / 2 + 4); });
    const neons = [['APEX', '#3be8ff'], ['TOKYO BAY', '#ff3bd4'], ['HYPERDRIVE', '#ffcf5a'], ['NITRO', '#3be8ff'], ['V12 · GT · RS', '#ff3bd4']];
    for (let i = 0; i < 10; i++) { const s = (i + 0.5) * L / 10, sd = i % 2 ? 1 : -1; if (sd > 0 && s < PIT_S1 + 20) continue; const [t, c] = neons[i % neons.length]; const p = td.at(s, sd * 34); const b = new THREE.Mesh(new THREE.PlaneGeometry(24, 6), new THREE.MeshBasicMaterial({ map: neon(t, c), side: THREE.DoubleSide, color: new THREE.Color(2.2, 2.2, 2.2) })); b.position.set(p.x, 14, p.z); b.rotation.y = td.heading(s) + Math.PI - sd * Math.PI / 4; scene.add(b); const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 11, 6), new THREE.MeshStandardMaterial({ color: 0x222 })); pole.position.set(p.x, 5.5, p.z); scene.add(pole); }
  }
  if (night) envRT = envFromScene((es) => {
    es.add(skyDome(0x01020a, 0x1a1f4a, 0x05060f));
    const cols = [0x3be8ff, 0xff3bd4, 0xffcf8a, 0x3be8ff, 0xff3bd4, 0xfff2d0];
    for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2, m = new THREE.Mesh(new THREE.PlaneGeometry(260, 60 + (i % 3) * 50), new THREE.MeshBasicMaterial({ color: new THREE.Color(cols[i % 6]).multiplyScalar(2.2), side: THREE.DoubleSide })); m.position.set(Math.cos(a) * 700, 50 + (i % 4) * 30, Math.sin(a) * 700); m.lookAt(0, 40, 0); es.add(m); }
  });
  scene.environment = envRT ? envRT.texture : ENV_TEX;
  // sun / shadows
  sun.castShadow = true; const sh = sun.shadow; sh.mapSize.set(LOW ? 1024 : 2048, LOW ? 1024 : 2048);
  sh.camera.left = -55; sh.camera.right = 55; sh.camera.top = 55; sh.camera.bottom = -55; sh.camera.near = 1; sh.camera.far = 400; sh.bias = -0.0004; sh.normalBias = 0.02;
  scene.add(sun, sun.target);
  return { scene, sun, hemi, night, animated, startLights, fogColor, skyG, envRT, terrain, roadMat, skyMesh, clouds };
}
function mergeBoxes(geos) {
  let total = 0, ti = 0; for (const g of geos) { total += g.attributes.position.count; ti += g.index.count; }
  const pos = new Float32Array(total * 3), nor = new Float32Array(total * 3), uv = new Float32Array(total * 2), idx = new Uint32Array(ti);
  let vo = 0, io = 0;
  for (const g of geos) {
    pos.set(g.attributes.position.array, vo * 3); nor.set(g.attributes.normal.array, vo * 3); uv.set(g.attributes.uv.array, vo * 2);
    const ix = g.index.array; for (let k = 0; k < ix.length; k++) idx[io + k] = ix[k] + vo;
    vo += g.attributes.position.count; io += ix.length; g.dispose();
  }
  const m = new THREE.BufferGeometry();
  m.setAttribute('position', new THREE.BufferAttribute(pos, 3)); m.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); m.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); m.setIndex(new THREE.BufferAttribute(idx, 1));
  return m;
}
