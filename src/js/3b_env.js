// ============================================================
//  ENVIRONMENT HELPERS: noise, terrain, sky, clouds, trees
// ============================================================
const smoothstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
function makeNoise(seed) {
  const R = seeded(seed), perm = new Uint8Array(512), g = new Float32Array(256);
  for (let i = 0; i < 256; i++) { perm[i] = i; g[i] = R(); }
  for (let i = 255; i > 0; i--) { const j = Math.floor(R() * (i + 1)), t = perm[i]; perm[i] = perm[j]; perm[j] = t; }
  for (let i = 0; i < 256; i++) perm[i + 256] = perm[i];
  const val = (ix, iz) => g[perm[(ix & 255) + perm[iz & 255]]];
  const n2 = (x, z) => {
    const ix = Math.floor(x), iz = Math.floor(z), fx = x - ix, fz = z - iz;
    const u = fx * fx * fx * (fx * (fx * 6 - 15) + 10), v = fz * fz * fz * (fz * (fz * 6 - 15) + 10);
    return lerp(lerp(val(ix, iz), val(ix + 1, iz), u), lerp(val(ix, iz + 1), val(ix + 1, iz + 1), u), v) * 2 - 1;
  };
  const fbm = (x, z, oct = 5) => { let a = 0.5, f = 1, s = 0, n = 0; for (let i = 0; i < oct; i++) { s += a * n2(x * f, z * f); n += a; a *= 0.5; f *= 2.03; } return s / n; };
  const ridged = (x, z, oct = 5) => { let a = 0.5, f = 1, s = 0, n = 0, prev = 1; for (let i = 0; i < oct; i++) { let r = 1 - Math.abs(n2(x * f, z * f)); r *= r; s += r * a * prev; prev = r; n += a; a *= 0.5; f *= 2.1; } return s / n; };
  return { n2, fbm, ridged };
}
// distance to the track centre line, precomputed on a grid
function trackDistField(td, margin = 900, cell = 20) {
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const p of td.P) { minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x); minZ = Math.min(minZ, p.z); maxZ = Math.max(maxZ, p.z); }
  const x0 = minX - margin, z0 = minZ - margin, nx = Math.ceil((maxX - minX + 2 * margin) / cell) + 1, nz = Math.ceil((maxZ - minZ + 2 * margin) / cell) + 1;
  const sx = [], sz = []; for (let i = 0; i < td.N; i += 4) { sx.push(td.P[i].x); sz.push(td.P[i].z); }
  const F = new Float32Array(nx * nz), ns = sx.length;
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const x = x0 + i * cell, z = z0 + j * cell; let m = 1e12;
    for (let k = 0; k < ns; k++) { const dx = x - sx[k], dz = z - sz[k], d = dx * dx + dz * dz; if (d < m) m = d; }
    F[j * nx + i] = Math.sqrt(m);
  }
  return (x, z) => {
    const fx = (x - x0) / cell, fz = (z - z0) / cell;
    if (fx < 0 || fz < 0 || fx >= nx - 1 || fz >= nz - 1) return margin;
    const i = Math.floor(fx), j = Math.floor(fz), u = fx - i, v = fz - j, o = j * nx + i;
    return lerp(lerp(F[o], F[o + 1], u), lerp(F[o + nx], F[o + nx + 1], u), v);
  };
}
// heightfield terrain: flat next to the track, rolling hills further out, mountains on the horizon
function buildTerrain(dist, o) {
  const noise = makeNoise(o.seed), N = LOW ? 131 : 191, half = 3900, inner = 1050;
  const warp = (u) => Math.sign(u) * (inner * Math.abs(u) + (half - inner) * Math.pow(Math.abs(u), 4));
  const h = (x, z) => {
    const d = dist(x, z), near = smoothstep(o.flatR, o.flatR + o.ramp, d);
    let y = 0;
    if (near > 0) {
      y = near * (noise.fbm(x * o.hillFreq, z * o.hillFreq) * 0.5 + 0.5) * o.hillAmp * (0.3 + 0.7 * smoothstep(o.flatR, o.flatR + 520, d));
      const far = smoothstep(o.farStart, o.farEnd, Math.hypot(x - o.cx, z - o.cz));
      if (far > 0) y += far * (0.25 + 0.75 * noise.ridged(x * o.mountFreq + 7.3, z * o.mountFreq - 2.1)) * o.mountAmp;
    }
    if (o.lake) { const dl = Math.hypot(x - o.lake.x, z - o.lake.z); y = y * smoothstep(o.lake.r, o.lake.r + 110, dl) - (1 - smoothstep(o.lake.r * 0.55, o.lake.r, dl)) * 1.6; }
    return y - 0.25;
  };
  const pos = new Float32Array(N * N * 3), uv = new Float32Array(N * N * 2), col = new Float32Array(N * N * 3), idx = [];
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const x = o.cx + warp(i / (N - 1) * 2 - 1), z = o.cz + warp(j / (N - 1) * 2 - 1), k = j * N + i;
    pos[k * 3] = x; pos[k * 3 + 1] = h(x, z); pos[k * 3 + 2] = z; uv[k * 2] = x / 34; uv[k * 2 + 1] = z / 34;
    if (i < N - 1 && j < N - 1) idx.push(k, k + N, k + 1, k + 1, k + N, k + N + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
  const nor = g.attributes.normal.array, c = [0, 0, 0];
  for (let k = 0; k < N * N; k++) { o.color(pos[k * 3 + 1], nor[k * 3 + 1], pos[k * 3], pos[k * 3 + 2], noise, c); col[k * 3] = c[0]; col[k * 3 + 1] = c[1]; col[k * 3 + 2] = c[2]; }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const mesh = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, map: TEX.detail, roughness: 0.96, metalness: 0 }));
  mesh.receiveShadow = true;
  return { mesh, h, noise };
}
const mix3 = (out, a, b, t) => { out[0] = lerp(a[0], b[0], t); out[1] = lerp(a[1], b[1], t); out[2] = lerp(a[2], b[2], t); return out; };
function alpsColor(h, ny, x, z, noise, out) {
  const t = noise.fbm(x * 0.012, z * 0.012, 3) * 0.5 + 0.5;
  mix3(out, [0.20, 0.37, 0.11], [0.33, 0.47, 0.17], t);
  mix3(out, out, [0.15, 0.27, 0.12], smoothstep(60, 240, h) * 0.8);
  mix3(out, out, [0.36 + t * 0.06, 0.35 + t * 0.05, 0.35 + t * 0.04], Math.max(smoothstep(0.86, 0.6, ny), smoothstep(300, 470, h)));
  mix3(out, out, [0.92, 0.94, 1.0], smoothstep(330 + t * 90, 470 + t * 90, h) * smoothstep(0.25, 0.55, ny));
  if (h < -0.6) mix3(out, out, [0.36, 0.33, 0.24], 0.8);
}
function gpColor(h, ny, x, z, noise, out) {
  const t = noise.fbm(x * 0.01, z * 0.01, 3) * 0.5 + 0.5;
  mix3(out, [0.30, 0.38, 0.13], [0.47, 0.43, 0.19], t);
  mix3(out, out, [0.44, 0.36, 0.22], smoothstep(40, 200, h) * 0.7);
  mix3(out, out, [0.40, 0.34, 0.27], smoothstep(0.9, 0.7, ny));
}
// physically based sky + matching reflection map
function makeSky(sunDir, o) {
  const sky = new Sky(); sky.scale.setScalar(4000);
  const u = sky.material.uniforms; u.turbidity.value = o.turbidity; u.rayleigh.value = o.rayleigh; u.mieCoefficient.value = o.mie; u.mieDirectionalG.value = o.mieG; u.sunPosition.value.copy(sunDir);
  sky.material.uniforms.skyGain = { value: o.gain ?? 0.5 };
  sky.material.fragmentShader = 'uniform float skyGain;\n' + sky.material.fragmentShader.replace('gl_FragColor = vec4( retColor, 1.0 );', 'gl_FragColor = vec4( retColor * skyGain, 1.0 );');
  sky.frustumCulled = false; sky.renderOrder = -10;
  return sky;
}
function envFromScene(build) {
  const s = new THREE.Scene(); build(s);
  const rt = pmrem.fromScene(s, 0, 1, 9000);
  s.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
  return rt;
}
function skyEnv(sunDir, o, groundHex) {
  return envFromScene((s) => {
    s.add(makeSky(sunDir, o));
    const gnd = new THREE.Mesh(new THREE.CircleGeometry(3800, 24).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: groundHex })); gnd.position.y = -30; s.add(gnd);
  });
}
function addClouds(parent, R, tint, n = 16) {
  const mats = [];
  for (let i = 0; i < n; i++) {
    const m = new THREE.SpriteMaterial({ map: TEX.cloud, color: tint, transparent: true, opacity: 0.55 + R() * 0.35, depthWrite: false, fog: false, rotation: (R() - 0.5) * 0.2 });
    const sp = new THREE.Sprite(m), a = R() * Math.PI * 2, el = 0.1 + R() * 0.32, d = 3300;
    sp.position.set(Math.cos(a) * Math.cos(el) * d, Math.sin(el) * d, Math.sin(a) * Math.cos(el) * d);
    const w = 900 + R() * 1100; sp.scale.set(w, w * (0.3 + R() * 0.12), 1); parent.add(sp); mats.push(m);
  }
  return mats;
}
function coloredGeo(geo, hex) {
  const c = new THREE.Color(hex), n = geo.attributes.position.count, a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
  geo.setAttribute('color', new THREE.BufferAttribute(a, 3));
  return geo.index ? geo.toNonIndexed() : geo;
}
function firGeo() {
  return mergeGeometries([
    coloredGeo(new THREE.CylinderGeometry(0.32, 0.5, 3.2, 6).translate(0, 1.6, 0), 0x4a3222),
    coloredGeo(new THREE.ConeGeometry(3.5, 6, 8).translate(0, 5.2, 0), 0x1a3f24),
    coloredGeo(new THREE.ConeGeometry(2.7, 5.2, 8).translate(0, 8.4, 0), 0x1f4a2a),
    coloredGeo(new THREE.ConeGeometry(1.8, 4.4, 8).translate(0, 11.4, 0), 0x265632),
  ]);
}
function leafTreeGeo() {
  return mergeGeometries([
    coloredGeo(new THREE.CylinderGeometry(0.35, 0.55, 5, 6).translate(0, 2.5, 0), 0x4a3222),
    coloredGeo(new THREE.IcosahedronGeometry(3.6, 1).translate(0, 7.4, 0), 0x55742a),
    coloredGeo(new THREE.IcosahedronGeometry(2.7, 1).translate(2.2, 6.2, 0.8), 0x4b6a25),
    coloredGeo(new THREE.IcosahedronGeometry(2.5, 1).translate(-1.9, 6.4, -1.1), 0x5f7d2f),
  ]);
}
function plantTrees(scene, list, geo, tintFn) {   // list: [x, y, z, scale]
  if (!list.length) return;
  const im = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, flatShading: true }), list.length);
  const M = new THREE.Matrix4(), q = new THREE.Quaternion(), ax = new THREE.Vector3(0, 1, 0), c = new THREE.Color();
  list.forEach(([x, y, z, s], i) => { q.setFromAxisAngle(ax, (x * 7.13 + z * 3.7) % 6.28); M.compose(new THREE.Vector3(x, y - 0.3, z), q, new THREE.Vector3(s, s * (0.9 + ((x * 13.7) % 1 + 1) % 1 * 0.35), s)); im.setMatrixAt(i, M); tintFn(c, i); im.setColorAt(i, c); });
  im.castShadow = !LOW; scene.add(im);
}
