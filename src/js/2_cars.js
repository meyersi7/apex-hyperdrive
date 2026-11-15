// ============================================================
//  HYPERCARS – lofted bodies (original designs)
// ============================================================
const CARS = [
  { id: 'vortex', name: 'Vortex V12', livery: 'Giftgrün-Metallic, Pfeil-LED-Scheinwerfer, aktiver Delta-Heckflügel',
    color: 0x45d412, accent: 0x111214, caliper: 0xffc21a, rim: 0x2a2c30, metal: 0.55, top: 365, acc: 96, hand: 95,
    special: 'Perfekter Allrounder aus V12-Power und präzisem Kurven-Handling', style: 'delta', dmgMul: 1, boostMul: 1, gripMul: 1 },
  { id: 'comet', name: 'Comet X16', livery: 'Racing Blue & Carbon, LMP-Dachhutze, Haifischflosse & Lichtband-Heck',
    color: 0x1240c4, accent: 0x0f1013, caliper: 0x39a0ff, rim: 0xc9ced6, metal: 0.6, top: 388, acc: 98, hand: 90,
    special: 'Höchste Endgeschwindigkeit im gesamten Spiel & sehr robuste Karosserie', style: 'lmp', dmgMul: 0.65, boostMul: 1, gripMul: 1 },
  { id: 'polaris', name: 'Polaris R', livery: 'Crystal White mit Orange-Rennstreifen & Doppelfinnen am Heck',
    color: 0xeef0f3, accent: 0xff6a12, caliper: 0xff6a12, rim: 0x1b1c20, metal: 0.15, top: 382, acc: 99, hand: 92,
    special: 'Brachiale Beschleunigung aus Kurven und beim Zünden des Nitro-Boosts', style: 'twinfin', dmgMul: 1, boostMul: 1.25, gripMul: 1 },
  { id: 'inferno', name: 'Inferno GT-R', livery: 'Papaya-Orange mit blauen Akzenten & riesigem Schwanenhals-GT-Flügel',
    color: 0xff6a08, accent: 0x1e5bff, caliper: 0x1e5bff, rim: 0x202226, metal: 0.45, top: 352, acc: 94, hand: 99,
    special: 'Maximaler Anpressdruck und beste Kurvenstabilität bei hohen Tempi', style: 'swan', dmgMul: 1, boostMul: 1, gripMul: 1.08 },
];
// power / drag model: traction-limited launch, power-limited above, drag sets the top speed
function carPhys(spec) {
  const vmax = spec.top / 3.6;
  const a0 = 9.2 + (spec.acc - 90) * 0.62;      // m/s² launch (traction limited)
  const pm = 520 + (spec.acc - 90) * 17;         // W per kg
  const roll = 0.35;
  const cd = (pm / vmax - roll) / (vmax * vmax);
  const grip = (26 + (spec.hand - 90) * 1.5) * spec.gripMul;
  return { vmax, accel: a0, a0, pm, cd, roll, grip };
}
const driveAccel = (ph, u, powMul = 1, a0Mul = 1) => Math.min(ph.a0 * a0Mul, ph.pm * powMul / Math.max(u, 1));
const dragAccel = (ph, u, k = 1) => ph.roll + ph.cd * k * u * u;

// ---------- small geometry helpers
function spline(pts) {
  const n = pts.length, m = [];
  for (let i = 0; i < n; i++) { const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)]; m.push((b[1] - a[1]) / (b[0] - a[0])); }
  return (x) => {
    if (x <= pts[0][0]) return pts[0][1]; if (x >= pts[n - 1][0]) return pts[n - 1][1];
    let i = 1; while (x > pts[i][0]) i++;
    const [x0, y0] = pts[i - 1], [x1, y1] = pts[i], h = x1 - x0, t = (x - x0) / h, t2 = t * t, t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * y0 + (t3 - 2 * t2 + t) * h * m[i - 1] + (-2 * t3 + 3 * t2) * y1 + (t3 - t2) * h * m[i];
  };
}
function resample(pts, n) { // equal arc-length resampling of a polyline [[x,y],...]
  const L = [0]; for (let i = 1; i < pts.length; i++) L.push(L[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const out = [], tot = L[L.length - 1]; let k = 1;
  for (let i = 0; i <= n; i++) {
    const d = tot * i / n; while (k < pts.length - 1 && L[k] < d) k++;
    const t = L[k] === L[k - 1] ? 0 : (d - L[k - 1]) / (L[k] - L[k - 1]);
    out.push([lerp(pts[k - 1][0], pts[k][0], t), lerp(pts[k - 1][1], pts[k][1], t)]);
  }
  return out;
}
// loft a mirrored cross-section along z. section(z) -> half profile [[x,y]...] (sill -> centre). matOf picks the material group.
function loftGeo(zs, ns, section, matOf, nMat, capF, capR) {
  const M = 2 * ns + 1, pos = [], rings = [];
  for (const z of zs) { const h = section(z); rings.push(h); for (let j = 0; j < M; j++) { const k = j <= ns ? j : 2 * ns - j, sg = j <= ns ? 1 : -1; pos.push(sg * h[k][0], h[k][1], z); } }
  const buckets = Array.from({ length: nMat }, () => []);
  for (let i = 0; i < zs.length - 1; i++) for (let j = 0; j < M - 1; j++) {
    const A = i * M + j, B = (i + 1) * M + j, C = B + 1, D = A + 1;
    const k0 = j < ns ? j : 2 * ns - j - 1, h0 = rings[i], h1 = rings[i + 1];
    const xm = (h0[k0][0] + h0[k0 + 1][0] + h1[k0][0] + h1[k0 + 1][0]) / 4, ym = (h0[k0][1] + h0[k0 + 1][1] + h1[k0][1] + h1[k0 + 1][1]) / 4;
    buckets[matOf((zs[i] + zs[i + 1]) / 2, xm, ym, (k0 + 0.5) / ns)].push(A, D, B, B, D, C);
  }
  const cap = (ri, mat, front) => {
    if (mat == null) return; const base = pos.length / 3, h = rings[ri], z = zs[ri]; let cy = 0;
    for (let j = 0; j < M; j++) { const k = j <= ns ? j : 2 * ns - j, sg = j <= ns ? 1 : -1; pos.push(sg * h[k][0], h[k][1], z); cy += h[k][1]; }
    pos.push(0, cy / M, z); const c = base + M;
    for (let j = 0; j < M; j++) { const a = base + j, b = base + (j + 1) % M; front ? buckets[mat].push(c, a, b) : buckets[mat].push(c, b, a); }
  };
  cap(zs.length - 1, capF, true); cap(0, capR, false);
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  const idx = []; let start = 0;
  buckets.forEach((b, m) => { if (!b.length) return; for (const v of b) idx.push(v); g.addGroup(start, b.length, m); start += b.length; });
  g.setIndex(idx); g.computeVertexNormals();
  return g;
}

// ---------- body shape per style
const MAT = { paint: 0, accent: 1, carbon: 2, glass: 3, led: 4 };
function carShape(style) {
  const S = {
    zR: -2.36, zF: 2.36, zwf: 1.45, zwr: -1.42, wheelR: 0.355, archR: 0.43, wx: 0.83, sill: 0.19, ex: 5, ey: 3,
    W: [[-2.36, 0.90], [-2.0, 0.985], [-1.42, 1.0], [-0.5, 0.955], [0.3, 0.95], [1.45, 0.985], [2.0, 0.93], [2.25, 0.80], [2.36, 0.62]],
    sh: [[-2.36, 0.80], [-2.0, 0.90], [-1.42, 0.93], [-0.6, 0.90], [0.3, 0.875], [0.95, 0.87], [1.45, 0.885], [1.9, 0.72], [2.2, 0.53], [2.36, 0.45]],
    cd: [[-2.36, 0.0], [-1.6, 0.04], [-0.5, 0.02], [0.9, 0.0], [1.2, -0.05], [1.6, -0.11], [2.1, -0.07], [2.36, -0.03]],
    roof: [[-1.85, 0.90], [-1.2, 1.02], [-0.55, 1.15], [-0.1, 1.185], [0.2, 1.17], [0.6, 1.04], [1.02, 0.84]],
    Wg: [[-1.85, 0.42], [-1.2, 0.62], [-0.4, 0.74], [0.3, 0.76], [0.8, 0.72], [1.02, 0.66]],
  };
  const set = (arr, i, v) => { arr[i][1] = v; };
  if (style === 'delta') { set(S.sh, 7, 0.70); set(S.sh, 8, 0.50); set(S.sh, 9, 0.42); set(S.W, 7, 0.76); set(S.W, 8, 0.56); set(S.sh, 2, 0.94); }
  if (style === 'lmp') { set(S.sh, 0, 0.84); set(S.W, 0, 0.94); S.Wg.forEach(p => p[1] *= 0.93); set(S.roof, 3, 1.17); set(S.cd, 1, 0.07); S.ex = 5.5; }
  if (style === 'twinfin') { set(S.W, 3, 0.94); set(S.roof, 3, 1.19); set(S.sh, 0, 0.78); S.ex = 4.6; }
  if (style === 'swan') { S.roof.forEach(p => p[1] = 0.84 + (p[1] - 0.84) * 0.93); set(S.sh, 7, 0.745); set(S.W, 8, 0.66); set(S.sh, 2, 0.945); S.ey = 3.4; }
  S.f = { W: spline(S.W), sh: spline(S.sh), cd: spline(S.cd), roof: spline(S.roof), Wg: spline(S.Wg) };
  S.sillAt = (z) => { let s = S.sill; for (const zw of [S.zwf, S.zwr]) { const dz = z - zw; if (Math.abs(dz) < S.archR) s = Math.max(s, S.wheelR + Math.sqrt(S.archR * S.archR - dz * dz)); } return s; };
  S.surfY = (z, x) => { const W = S.f.W(z), sl = S.sillAt(z), xn = clamp(Math.abs(x) / W, 0, 1); return sl + (S.f.sh(z) - sl) * Math.pow(1 - Math.pow(xn, S.ex), 1 / S.ey) + S.f.cd(z) * (1 - xn * xn) ** 2; };
  return S;
}
function bodyGeos(style) {
  const S = carShape(style), f = S.f, K = 120;
  const nz = 118, n1 = LOW ? 6 : 8, n2 = LOW ? 12 : 16, ns = n1 + n2, Q0 = 0.9, ngz = LOW ? 40 : 60, ngs = LOW ? 10 : 14;
  // ----- lower body: side wall resampled by arc length, top surface on fixed q = x/W lines (clean panel edges)
  const zs = []; for (let i = 0; i <= nz; i++) zs.push(S.zR + 0.04 * i);
  const phs = Math.acos(Math.pow(Q0, S.ex / 2));
  const section = (z) => {
    const W = f.W(z), sl = S.sillAt(z), H = f.sh(z) - sl, cdv = f.cd(z), d = [];
    for (let k = 0; k <= 40; k++) { const ph = phs * k / 40, xn = Math.pow(Math.cos(ph), 2 / S.ex); d.push([W * xn, sl + H * Math.pow(Math.sin(ph), 2 / S.ey) + cdv * (1 - xn * xn) ** 2]); }
    const pr = resample(d, n1);
    for (let k = 1; k <= n2; k++) { const q = Q0 * (1 - k / n2); pr.push([W * q, sl + H * Math.pow(1 - Math.pow(q, S.ex), 1 / S.ey) + cdv * (1 - q * q) ** 2]); }
    return pr;
  };
  const between = (v, a, b) => v > a && v < b;
  const led = {
    delta: (z, q) => between(z, 1.92, 1.96) || (between(z, 2.0, 2.04) && q > 0.675),
    lmp: (z, q) => between(z, 1.92, 2.04) && (between(q, 0.506, 0.619) || between(q, 0.731, 0.844)),
    twinfin: (z, q) => between(z, 2.0, 2.08),
    swan: (z, q) => between(z, 1.88, 1.92) || between(z, 2.0, 2.04),
  }[style];
  const matOf = (z, x, y, sf) => {
    const k = Math.floor(sf * ns), top = k >= n1, q = top ? Q0 * (1 - (k - n1 + 0.5) / n2) : 1;
    if (top && between(z, 1.84, 2.12) && between(q, 0.45, 0.9)) return led(z, q) ? MAT.led : MAT.glass;             // headlight cluster
    if (!top && k >= 2 && k < n1 - 2 && between(z, -1.0, -0.32 - (n1 - 3 - k) * 0.08)) return MAT.carbon;           // side intake
    if (k === 0 && between(z, S.zwr + S.archR, S.zwf - S.archR)) return style === 'swan' ? MAT.accent : MAT.carbon;  // sill
    if (top && between(z, -2.24, -1.92) && q < 0.62) return MAT.carbon;                                              // rear deck vents
    if ((style === 'delta' || style === 'swan') && top && between(z, 1.12, 1.36) && between(q, 0.28, 0.57)) return MAT.carbon; // hood vents
    if (style === 'twinfin' && top && q < 0.12) return MAT.accent;                                                   // racing stripe
    if (style === 'lmp' && top && z < -0.9 && q < 0.5) return MAT.carbon;
    if (style === 'swan' && !top && z > 1.96) return MAT.accent;
    return MAT.paint;
  };
  const body = loftGeo(zs, ns, section, matOf, 5, MAT.carbon, MAT.carbon);
  // ----- greenhouse
  const zg = []; for (let i = 0; i <= ngz; i++) zg.push(lerp(-1.85, 1.02, i / ngz));
  const gsec = (z) => {
    const W = f.Wg(z), yb = S.surfY(z, W) - 0.035, H = Math.max(0.02, f.roof(z) - yb), d = [];
    for (let k = 0; k <= 80; k++) { const ph = Math.PI / 2 * k / 80; d.push([W * Math.pow(Math.cos(ph), 2 / 3.2), yb + H * Math.pow(Math.sin(ph), 2 / 2.4)]); }
    return resample(d, ngs);
  };
  const roofMat = style === 'lmp' ? MAT.carbon : MAT.paint;
  const gmat = (z, x, y, s) => {
    if (z > 0.3) return s > 0.42 ? MAT.glass : s > 0.33 ? roofMat : s > 0.07 ? MAT.glass : MAT.paint;        // windshield | A-pillar | quarter glass
    if (z > -0.55) return s > 0.47 ? (style === 'twinfin' && x < 0.12 ? MAT.accent : roofMat) : s > 0.07 ? MAT.glass : MAT.paint;
    if (z > -1.5 && s > 0.58) return style === 'lmp' ? MAT.carbon : MAT.glass;                               // engine cover glass
    return style === 'lmp' ? MAT.carbon : MAT.paint;
  };
  const green = loftGeo(zg, ngs, gsec, gmat, 5, null, null);
  // door shut lines
  const lines = [];
  for (const z0 of [0.78, -0.44]) for (const sx of [-1, 1]) { const wg = f.Wg(z0), pr = section(z0).filter(p => p[0] > wg - 0.02); lines.push(pr.map(p => new THREE.Vector3(sx * (p[0] * 1.004 + 0.002), p[1] + 0.004, z0))); }
  for (const sx of [-1, 1]) { const a = section(0.78)[1], b = section(-0.44)[1]; lines.push([new THREE.Vector3(sx * (a[0] + 0.004), a[1], 0.78), new THREE.Vector3(sx * (b[0] + 0.004), b[1], -0.44)]); }
  const lineGeo = new THREE.BufferGeometry(); const lp = [];
  for (const l of lines) for (let i = 0; i < l.length - 1; i++) lp.push(l[i].x, l[i].y, l[i].z, l[i + 1].x, l[i + 1].y, l[i + 1].z);
  lineGeo.setAttribute('position', new THREE.Float32BufferAttribute(lp, 3));
  return { S, body, green, lineGeo };
}
const GEO_CACHE = {};
function cachedGeo(key, fn) { return GEO_CACHE[key] || (GEO_CACHE[key] = fn()); }
const SHAPE_CACHE = {};
function wheelGeos() {
  return SHAPE_CACHE.wheel || (SHAPE_CACHE.wheel = (() => {
    const prof = [[0.235, -0.15], [0.33, -0.156], [0.35, -0.125], [0.356, -0.05], [0.356, 0.05], [0.35, 0.125], [0.33, 0.156], [0.235, 0.15]];
    const tire = new THREE.LatheGeometry(prof.map(p => new THREE.Vector2(p[0], p[1])), LOW ? 22 : 34).rotateZ(-Math.PI / 2);
    const rim = (sx) => {
      const parts = [new THREE.CylinderGeometry(0.242, 0.242, 0.27, 28, 1, true).rotateZ(Math.PI / 2)];
      for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2 + (i % 2 ? 0.11 : -0.11); parts.push(new THREE.BoxGeometry(0.03, 0.2, 0.03).translate(sx * 0.105, 0.143, 0).rotateX(a)); }
      parts.push(new THREE.TorusGeometry(0.236, 0.016, 6, 28).rotateY(Math.PI / 2).translate(sx * 0.125, 0, 0));
      parts.push(new THREE.CylinderGeometry(0.055, 0.07, 0.05, 12).rotateZ(-sx * Math.PI / 2).translate(sx * 0.11, 0, 0));
      return mergeGeometries(parts.map(p => p.index ? p.toNonIndexed() : p));
    };
    const g = { tire, rimL: rim(1), rimR: rim(-1), disc: new THREE.CylinderGeometry(0.2, 0.2, 0.026, 26).rotateZ(Math.PI / 2), cal: new THREE.BoxGeometry(0.07, 0.15, 0.13),
      liner: new THREE.CylinderGeometry(0.43, 0.43, 0.38, 18, 1, true, 0, Math.PI).rotateZ(Math.PI / 2), linerCap: new THREE.CircleGeometry(0.43, 18, 0, Math.PI).rotateY(Math.PI / 2) };
    for (const k in g) g[k].userData.keep = true;
    return g;
  })());
}

function buildCar(spec, { glow = 0.6, lite = false } = {}) {
  const root = new THREE.Group();
  const body = new THREE.Group(); root.add(body);
  const B = SHAPE_CACHE[spec.style] || (SHAPE_CACHE[spec.style] = (() => { const b = bodyGeos(spec.style); b.body.userData.keep = b.green.userData.keep = b.lineGeo.userData.keep = true; return b; })());
  const S = B.S;
  const mats = {
    paint: new THREE.MeshPhysicalMaterial({ color: spec.color, metalness: spec.metal, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.035, envMapIntensity: 1.25 }),
    accent: new THREE.MeshPhysicalMaterial({ color: spec.accent, metalness: 0.45, roughness: 0.35, clearcoat: 1, clearcoatRoughness: 0.05 }),
    carbon: new THREE.MeshStandardMaterial({ map: TEX.carbon, color: 0xffffff, metalness: 0.35, roughness: 0.4 }),
    glass: new THREE.MeshPhysicalMaterial({ color: 0x070b12, metalness: 0.2, roughness: 0.03, clearcoat: 1, clearcoatRoughness: 0.02, envMapIntensity: 1.9 }),
    head: new THREE.MeshBasicMaterial({ color: new THREE.Color(0xdcefff).multiplyScalar(2.4) }),
    dark: new THREE.MeshStandardMaterial({ color: 0x08080a, roughness: 0.7, metalness: 0.1 }),
    tire: new THREE.MeshStandardMaterial({ color: 0x101011, roughness: 0.88 }),
    rim: new THREE.MeshStandardMaterial({ color: spec.rim, metalness: 1, roughness: 0.25, side: THREE.DoubleSide }),
    disc: new THREE.MeshStandardMaterial({ color: 0x7c7f85, metalness: 0.85, roughness: 0.4, emissive: 0xff4a10, emissiveIntensity: 0 }),
    caliper: new THREE.MeshStandardMaterial({ color: spec.caliper, metalness: 0.3, roughness: 0.4 }),
    tail: new THREE.MeshBasicMaterial({ color: 0xff1a2a }),
    chrome: new THREE.MeshStandardMaterial({ color: 0xdddddd, metalness: 1, roughness: 0.12 }),
  };
  const loftMats = [mats.paint, mats.accent, mats.carbon, mats.glass, mats.head];
  const add = (geo, mat, x = 0, y = 0, z = 0, parent = body, shadow = true) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = shadow; parent.add(m); return m; };
  const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
  const W = wheelGeos();

  add(B.body, loftMats); add(B.green, loftMats);
  body.add(new THREE.LineSegments(B.lineGeo, new THREE.LineBasicMaterial({ color: 0x050505, transparent: true, opacity: 0.7 })));
  // underbody tub, nose floor, skirts, splitter, diffuser
  add(cachedGeo('tub', () => box(1.3, 0.44, 4.1)), mats.dark, 0, 0.38, -0.17, body, false);
  add(cachedGeo('noseFloor', () => box(1.2, 0.12, 0.5)), mats.dark, 0, 0.22, 2.1, body, false);
  add(cachedGeo('splitter', () => box(1.56, 0.03, 0.42)), spec.style === 'swan' ? mats.accent : mats.carbon, 0, 0.165, 2.2);
  for (const sx of [-1, 1]) add(cachedGeo('skirt', () => box(0.3, 0.06, 1.98)), mats.carbon, sx * 0.82, 0.175, 0.015);
  add(cachedGeo('diff', () => box(1.5, 0.13, 0.42)), mats.carbon, 0, 0.245, -2.22);
  for (let i = -3; i <= 3; i++) add(cachedGeo('fin', () => box(0.025, 0.17, 0.46)), mats.carbon, i * 0.22, 0.24, -2.25, body, false);
  // wheel arch liners + lips
  for (const zw of [S.zwf, S.zwr]) for (const sx of [-1, 1]) {
    add(W.liner, mats.dark, sx * 0.80, S.wheelR, zw, body, false).material.side = THREE.DoubleSide;
    const cap = add(W.linerCap, mats.dark, sx * 0.62, S.wheelR, zw, body, false); if (sx < 0) cap.rotation.y = Math.PI;
  }
  // mirrors
  for (const sx of [-1, 1]) {
    add(cachedGeo('mirror', () => new THREE.SphereGeometry(1, 12, 8).scale(0.1, 0.055, 0.075)), spec.style === 'swan' ? mats.accent : mats.paint, sx * 0.93, 0.985, 0.6);
    add(cachedGeo('mstalk', () => box(0.16, 0.02, 0.05)), mats.dark, sx * 0.82, 0.955, 0.6, body, false);
  }
  // lights: glow sprites
  const glowSprites = [];
  const glowMat = new THREE.SpriteMaterial({ map: TEX.glow, color: 0xcfe8ff, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: glow });
  const tailGlowMat = new THREE.SpriteMaterial({ map: TEX.glow, color: 0xff2030, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: glow * 0.9 });
  for (const sx of [-1, 1]) { const sp = new THREE.Sprite(glowMat); sp.scale.setScalar(0.8); sp.position.set(sx * 0.62, S.surfY(1.98, 0.62) + 0.03, 2.03); body.add(sp); glowSprites.push(sp); }
  // rear fascia: tail lights
  const zt = -2.372, lamp = (g, x, y, rz = 0) => { const m = add(g, mats.tail, x, y, zt, body, false); m.rotation.z = rz; return m; };
  if (spec.style === 'delta') for (const sx of [-1, 1]) { lamp(box(0.46, 0.035, 0.03), sx * 0.56, 0.70, sx * 0.22); lamp(box(0.3, 0.035, 0.03), sx * 0.6, 0.6, -sx * 0.26); }
  else if (spec.style === 'lmp') { lamp(box(1.7, 0.04, 0.03), 0, 0.74); for (const sx of [-1, 1]) lamp(box(0.035, 0.22, 0.03), sx * 0.85, 0.64); }
  else if (spec.style === 'twinfin') for (const sx of [-1, 1]) for (const k of [0.42, 0.68]) lamp(cachedGeo('ring', () => new THREE.TorusGeometry(0.085, 0.02, 6, 18)), sx * k, 0.64);
  else { lamp(box(1.6, 0.028, 0.03), 0, 0.73); lamp(box(1.1, 0.028, 0.03), 0, 0.66); }
  for (const sx of [-1, 1]) { const sp = new THREE.Sprite(tailGlowMat); sp.scale.setScalar(0.75); sp.position.set(sx * 0.58, 0.68, -2.46); body.add(sp); glowSprites.push(sp); }
  // exhausts + nitro flames
  const flames = [];
  const flameOuter = new THREE.MeshBasicMaterial({ color: new THREE.Color(0x2a62ff).multiplyScalar(1.8), transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false });
  const flameInner = new THREE.MeshBasicMaterial({ color: new THREE.Color(0xa8f0ff).multiplyScalar(1.8), transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false });
  const exY = 0.5, exZ = -2.37;
  for (const sx of [-1, 1]) {
    add(cachedGeo('exh', () => new THREE.CylinderGeometry(0.08, 0.08, 0.26, 16, 1, true).rotateX(Math.PI / 2)), mats.chrome, sx * 0.2, exY, exZ).material.side = THREE.DoubleSide;
    const fo = new THREE.Mesh(cachedGeo('flO', () => new THREE.ConeGeometry(0.15, 1.3, 12, 1, true).translate(0, 0.65, 0).rotateX(-Math.PI / 2)), flameOuter);
    const fi = new THREE.Mesh(cachedGeo('flI', () => new THREE.ConeGeometry(0.08, 0.85, 10, 1, true).translate(0, 0.425, 0).rotateX(-Math.PI / 2)), flameInner);
    fo.position.set(sx * 0.2, exY, exZ - 0.12); fi.position.copy(fo.position); fo.visible = fi.visible = false; body.add(fo, fi); flames.push(fo, fi);
  }
  // aero per style
  const finGeo = (pts, th = 0.04) => { const sh = new THREE.Shape(); pts.forEach((p, i) => i ? sh.lineTo(p[0], p[1]) : sh.moveTo(p[0], p[1])); const g = new THREE.ExtrudeGeometry(sh, { depth: th, bevelEnabled: false }); g.translate(0, 0, -th / 2); g.rotateY(-Math.PI / 2); return g; };
  const deckY = S.surfY(-2.0, 0);
  let wing = null;
  if (spec.style === 'delta') {
    wing = new THREE.Group(); wing.position.set(0, deckY + 0.13, -2.04); body.add(wing);
    const wg = new THREE.Shape(); wg.moveTo(-0.98, 0.2); wg.lineTo(0.98, 0.2); wg.lineTo(0.74, -0.2); wg.lineTo(-0.74, -0.2); wg.lineTo(-0.98, 0.2);
    const wgeo = new THREE.ExtrudeGeometry(wg, { depth: 0.035, bevelEnabled: false }); wgeo.rotateX(Math.PI / 2);
    const wm = new THREE.Mesh(wgeo, mats.carbon); wm.castShadow = true; wing.add(wm);
    for (const sx of [-1, 1]) add(box(0.045, 0.16, 0.2), mats.accent, sx * 0.45, deckY + 0.05, -2.02);
  } else if (spec.style === 'lmp') {
    add(box(0.3, 0.13, 0.62), mats.carbon, 0, S.f.roof(0) + 0.045, -0.02);
    add(box(0.24, 0.09, 0.03), mats.dark, 0, S.f.roof(0) + 0.05, 0.3, body, false);
    add(finGeo([[-0.5, S.f.roof(-0.5) - 0.02], [-2.2, deckY - 0.04], [-2.25, 1.27], [-1.3, 1.25]]), mats.carbon);
    add(box(1.86, 0.05, 0.3), mats.carbon, 0, 1.12, -2.2);
    for (const sx of [-1, 1]) add(box(0.035, 0.3, 0.42), mats.paint, sx * 0.94, 1.0, -2.18);
  } else if (spec.style === 'twinfin') {
    for (const sx of [-1, 1]) add(finGeo([[-1.25, S.surfY(-1.25, 0.5) - 0.03], [-2.32, 0.84], [-2.3, 1.31], [-1.95, 1.22]], 0.045), mats.accent, sx * 0.52);
    wing = new THREE.Group(); wing.position.set(0, 1.27, -2.13); body.add(wing);
    const wm = new THREE.Mesh(box(1.1, 0.045, 0.36), mats.carbon); wm.castShadow = true; wing.add(wm);
  } else {
    wing = new THREE.Group(); wing.position.set(0, 1.43, -2.12); body.add(wing);
    const wm = new THREE.Mesh(box(2.02, 0.055, 0.52), mats.carbon); wm.castShadow = true; wing.add(wm);
    const gur = new THREE.Mesh(box(2.02, 0.07, 0.02), mats.accent); gur.position.set(0, 0.055, -0.25); wing.add(gur);
    for (const sx of [-1, 1]) {
      const ep = new THREE.Mesh(box(0.035, 0.34, 0.6), mats.accent); ep.position.set(sx * 1.01, -0.05, 0); wing.add(ep);
      const cv = new THREE.CatmullRomCurve3([new THREE.Vector3(sx * 0.4, deckY - 0.03, -1.55), new THREE.Vector3(sx * 0.4, 1.36, -1.75), new THREE.Vector3(sx * 0.4, 1.58, -2.0), new THREE.Vector3(sx * 0.4, 1.47, -2.14)]);
      add(new THREE.TubeGeometry(cv, 16, 0.032, 6, false), mats.accent);
      add(box(0.3, 0.02, 0.26), mats.carbon, sx * 0.8, 0.36, 2.2).rotation.z = sx * 0.25;   // dive planes
    }
  }
  // wheels
  const wheels = [];
  for (const [wz, front] of [[S.zwf, true], [S.zwr, false]]) for (const sx of [-1, 1]) {
    const pivot = new THREE.Group(); pivot.position.set(sx * S.wx, S.wheelR, wz); body.add(pivot);
    const spin = new THREE.Group(); pivot.add(spin);
    const tire = new THREE.Mesh(W.tire, mats.tire); tire.castShadow = !lite; spin.add(tire);
    spin.add(new THREE.Mesh(sx > 0 ? W.rimL : W.rimR, mats.rim));
    if (!lite) {
      const disc = new THREE.Mesh(W.disc, mats.disc); disc.position.x = sx * 0.04; spin.add(disc);
      const cal = new THREE.Mesh(W.cal, mats.caliper); cal.position.set(sx * 0.07, 0.14, front ? -0.07 : 0.07); pivot.add(cal);
    }
    wheels.push({ pivot, spin, front });
  }
  // opponents: all fixed small parts of one material become a single mesh, and only the body shell casts a shadow.
  // Same look, but about a third of the draw calls: that is what lets a field of eight run smoothly.
  if (lite) {
    const groups = new Map();
    for (const m of [...body.children]) {
      if (!m.isMesh || Array.isArray(m.material) || flames.includes(m)) continue;
      const a = m.geometry.attributes; if (!a.position || !a.normal || !a.uv) continue;
      m.updateMatrix(); let g = m.geometry.clone().applyMatrix4(m.matrix); if (g.index) { const t = g.toNonIndexed(); g.dispose(); g = t; }
      for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal' && k !== 'uv') g.deleteAttribute(k);
      g.clearGroups(); const key = m.material.uuid; if (!groups.has(key)) groups.set(key, { mat: m.material, geos: [], parts: [] });
      const G = groups.get(key); G.geos.push(g); G.parts.push(m);
    }
    for (const G of groups.values()) {
      const mg = G.geos.length > 1 ? mergeGeometries(G.geos, false) : null;
      if (mg) { for (const m of G.parts) body.remove(m); body.add(new THREE.Mesh(mg, G.mat)); }
      for (const g of G.geos) g.dispose();
    }
    body.traverse(o => { if (o.isMesh && o.geometry !== B.body) o.castShadow = false; });
  }
  // soft contact shadow
  const shadow = new THREE.Mesh(cachedGeo('blob', () => new THREE.PlaneGeometry(3.3, 6.2).rotateX(-Math.PI / 2)), new THREE.MeshBasicMaterial({ map: TEX.blob, transparent: true, depthWrite: false, opacity: 0.75, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 }));
  shadow.position.y = 0.05; shadow.userData.noShadow = true; shadow.renderOrder = 1; root.add(shadow);

  const orig = {};
  for (const k of ['paint', 'accent', 'glass', 'carbon']) orig[k] = { c: mats[k].color.getHex(), m: mats[k].metalness, r: mats[k].roughness, cc: mats[k].clearcoat ?? 0 };
  root.userData = { spec, body, wheels, flames, wing, mats, glowSprites, orig, wheelR: S.wheelR, shadow, heat: 0, tailBase: new THREE.Color(0xff1a2a), headBase: mats.head.color.clone() };
  return root;
}
function setCharred(car, on) {
  const u = car.userData, { mats, orig, glowSprites } = u;
  for (const k of ['paint', 'accent', 'glass', 'carbon']) {
    const m = mats[k], o = orig[k];
    if (on) { m.color.setHex(k === 'glass' ? 0x050505 : 0x1b1512); m.metalness = 0.1; m.roughness = 0.95; if ('clearcoat' in m) m.clearcoat = 0; }
    else { m.color.setHex(o.c); m.metalness = o.m; m.roughness = o.r; if ('clearcoat' in m) m.clearcoat = o.cc; }
  }
  if (on) mats.head.color.setHex(0x222222); else mats.head.color.copy(u.headBase);
  u.tailBase.setHex(on ? 0x220000 : 0xff1a2a);
  for (const s of glowSprites) s.visible = !on;
}
function animateCar(car, speed, steer, dt, t, boost, brake = 0) {
  const u = car.userData;
  const rot = (speed / u.wheelR) * dt;
  for (const w of u.wheels) { w.spin.rotation.x += rot; if (w.front) w.pivot.rotation.y = -steer * 0.5; }
  for (let i = 0; i < u.flames.length; i++) {
    const f = u.flames[i]; f.visible = boost;
    if (boost) { const s = 0.75 + Math.random() * 0.5; f.scale.set(1 + Math.random() * 0.2, 1 + Math.random() * 0.2, s * (i % 2 ? 1.1 : 1)); }
  }
  u.mats.tail.color.copy(u.tailBase).multiplyScalar(brake > 0.1 ? 3.2 : 1.3);
  u.heat = clamp(u.heat + (brake * Math.min(1, Math.abs(speed) / 60) * 1.1 - 0.3) * dt, 0, 1);
  u.mats.disc.emissiveIntensity = u.heat * u.heat * 3;
}
