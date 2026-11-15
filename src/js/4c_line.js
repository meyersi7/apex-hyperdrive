// ============================================================
//  IDEAL LINE – a thin ribbon on the road ahead of the car
//  green = full throttle, yellow = lift / hold, red = brake
//  The speeds behind the colours use the same numbers as the driving model:
//  the car (grip, power, top speed), the tyres with their wear, and how wet the track is.
// ============================================================
const LINE = { NP: 116, NV: 230, on: true };
try { LINE.on = localStorage.getItem('apex_line') !== '0'; } catch (_) {}
function lineData(td) {   // path of the racing line and its own curvature (flatter than the road: it cuts the corners)
  if (td.line) return td.line;
  const N = td.N, x = new Float32Array(N), z = new Float32Array(N), hd = new Float32Array(N), k0 = new Float32Array(N), K = new Float32Array(N), gh = new Float32Array(N);
  for (let i = 0; i < N; i++) { x[i] = td.P[i].x + td.R[i].x * td.ideal[i]; z[i] = td.P[i].z + td.R[i].z * td.ideal[i]; gh[i] = td.groundH(i * td.ds, td.ideal[i]); }
  for (let i = 0; i < N; i++) { const a = (i - 2 + N) % N, b = (i + 2) % N; hd[i] = Math.atan2(x[b] - x[a], z[b] - z[a]); }
  for (let i = 0; i < N; i++) { const a = (i - 1 + N) % N, b = (i + 1) % N; k0[i] = wrapAng(hd[b] - hd[a]) / Math.max(0.5, Math.hypot(x[b] - x[a], z[b] - z[a])); }
  for (let i = 0; i < N; i++) { let s = 0; for (let j = -5; j <= 5; j++) s += k0[(i + j + N) % N]; K[i] = Math.abs(s / 11); }
  return td.line = { x, z, K, gh };
}
function buildLine(scene) {
  const NP = LINE.NP, pos = new Float32Array(NP * 6), col = new Float32Array(NP * 8), idx = [];
  for (let j = 0; j < NP - 1; j++) { const a = j * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 4).setUsage(THREE.DynamicDrawUsage));
  geo.setIndex(idx);
  const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 }));
  mesh.frustumCulled = false; mesh.renderOrder = 1; mesh.visible = false; scene.add(mesh);
  return { mesh, geo, pos, col, va: new Float32Array(LINE.NV), lim: 0, need: 0 };
}
function updateLine() {
  const r = race, Ln = r.line; if (!Ln) return;
  const p = r.player, td = r.td;
  const show = LINE.on && !p.wrecked && !p.finished && !r.pitCtl && !p.inPit;
  Ln.mesh.visible = show; if (!show && !Ln.always) return;
  const D = lineData(td), N = td.N, ds = td.ds, ph = p.phys, G = ph.grip * r.gripMul, vm = ph.vmax, NV = LINE.NV, NP = LINE.NP, va = Ln.va;
  const i0 = td.idx(p.s), off = td.wrap(p.s) - i0 * ds;
  // 1) fastest speed each bend allows (grip rises a little with speed: downforce)
  for (let j = 0; j < NV; j++) { const den = D.K[(i0 + j) % N] - 0.2125 * G / (vm * vm); va[j] = den > 1e-6 ? Math.min(vm * 1.3, Math.sqrt(0.85 * G / den)) : vm * 1.3; }
  // 2) backwards: where braking has to start so that speed is reached (80 % of the brakes: room for a human)
  const bFull = Math.min(0.92 * G, 38), b = 0.8 * bFull;
  for (let j = NV - 2; j >= 0; j--) { const lim = Math.sqrt(va[j + 1] * va[j + 1] + 2 * b * ds); if (lim < va[j]) va[j] = lim; }
  // 3) forwards from the current speed at full throttle: where does the car run into that limit?
  let v = Math.max(3, Math.hypot(p.speed, p.vlat));
  const a0Mul = Math.min(1.1, r.gripMul), pos = Ln.pos, col = Ln.col;
  let prevH = 0;
  for (let j = 0; j < NP; j++) {
    const i = (i0 + j) % N, lim = va[j];
    const m = clamp(1 - (lim - v) / (0.07 * lim), 0, 1);                                         // 0 = free road, 1 = on the limit
    const need = clamp((lim * lim - va[j + 1] * va[j + 1]) / (2 * ds * b), 0, 1);                 // how hard this metre asks for the brakes
    const red = Math.max(m * need, clamp((v - lim) / (0.08 * lim), 0, 1));
    if (j === 1) { Ln.lim = lim; Ln.need = red; Ln.m = m; }
    // green -> yellow -> red
    const cr = lerp(lerp(0.1, 1.0, m), 1.0, red), cg = lerp(lerp(1.0, 0.82, m), 0.12, red), cb = lerp(lerp(0.42, 0.08, m), 0.1, red);
    const d = j * ds - off, h = D.gh[i];
    let al = 0.8 * clamp((d - 5) / 11, 0, 1) * clamp((NP * ds - 6 - d) / 80, 0, 1) * clamp(1 - h / 1.2, 0, 1);
    if (h < 0.01 && prevH > 0.01) al = 0; prevH = h;
    const hw = 0.15 + 0.0024 * Math.max(0, d), rx = td.R[i].x * hw, rz = td.R[i].z * hw, o = j * 6, c = j * 8, y = h + 0.05;
    pos[o] = D.x[i] - rx; pos[o + 1] = y; pos[o + 2] = D.z[i] - rz; pos[o + 3] = D.x[i] + rx; pos[o + 4] = y; pos[o + 5] = D.z[i] + rz;
    col[c] = col[c + 4] = cr; col[c + 1] = col[c + 5] = cg; col[c + 2] = col[c + 6] = cb; col[c + 3] = col[c + 7] = al;
    // the car's speed at the next point
    if (v > lim) v = Math.sqrt(Math.max(9, v * v - 2 * bFull * ds));
    else { v = Math.sqrt(Math.max(9, v * v + 2 * (driveAccel(ph, v, 1, a0Mul) - dragAccel(ph, v, 1)) * ds)); if (v > va[j + 1]) v = va[j + 1]; }
  }
  Ln.geo.attributes.position.needsUpdate = true; Ln.geo.attributes.color.needsUpdate = true;
}
function toggleLine() {
  LINE.on = !LINE.on; try { localStorage.setItem('apex_line', LINE.on ? '1' : '0'); } catch (_) {}
  const b = $('lineBtn'); if (b) b.textContent = 'IDEALLINIE: ' + (LINE.on ? 'AN' : 'AUS');
  if (mode === 'race' && race && race.state !== 'paused') showMsg('IDEALLINIE ' + (LINE.on ? 'AN' : 'AUS'), LINE.on ? '#6dffa0' : '#aab');
}
