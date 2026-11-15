import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { Sky } from 'three/addons/objects/Sky.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

// ============================================================
//  UTIL
// ============================================================
const $ = (id) => document.getElementById(id);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const damp = (a, b, k, dt) => lerp(a, b, 1 - Math.exp(-k * dt));
const rand = (a, b) => a + Math.random() * (b - a);
const wrapAng = (a) => { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; };
const smooth = (t) => t * t * (3 - 2 * t);
const fmtNum = (n) => Math.round(n).toLocaleString('de-DE');
function fmtTime(ms) {
  if (ms == null || !isFinite(ms)) return '--:--.--';
  ms = Math.max(0, ms);
  const m = Math.floor(ms / 60000), s = Math.floor((ms % 60000) / 1000), c = Math.floor((ms % 1000) / 10);
  return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0') + '.' + String(c).padStart(2, '0');
}
function seeded(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
const IS_TOUCH = (('ontouchstart' in window) || navigator.maxTouchPoints > 0) && matchMedia('(pointer: coarse)').matches;
const LOW = IS_TOUCH || Math.min(screen.width, screen.height) < 700;

// ============================================================
//  RENDERER
// ============================================================
const canvas = $('gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: !LOW, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, LOW ? 1.25 : 1.75));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const MAX_ANISO = renderer.capabilities.getMaxAnisotropy();

const pmrem = new THREE.PMREMGenerator(renderer);
const ENV_TEX = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 6000);

// post-processing (bloom) with an automatic quality fallback for slow devices
const GFX = { level: LOW ? 1 : 0, lock: false, slow: 0, baseDpr: renderer.getPixelRatio() };
let composer = null, renderPass = null;
function initComposer() {
  try {
    const sz = renderer.getDrawingBufferSize(new THREE.Vector2());
    composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(sz.x, sz.y, { type: THREE.HalfFloatType, samples: 4 }));
    renderPass = new RenderPass(new THREE.Scene(), camera);
    composer.addPass(renderPass);
    composer.addPass(new UnrealBloomPass(new THREE.Vector2(sz.x, sz.y), 0.42, 0.55, 1.0));
    composer.addPass(new OutputPass());
  } catch (e) { composer = null; GFX.level = Math.max(GFX.level, 1); }
}
function renderScene(scene) {
  if (GFX.level === 0 && !composer) initComposer();
  if (GFX.level === 0 && composer) {
    try { renderPass.scene = scene; composer.render(); return; } catch (e) { GFX.level = 1; composer = null; renderer.setRenderTarget(null); }
  }
  renderer.render(scene, camera);
}
function resizeGfx() {
  renderer.setSize(window.innerWidth, window.innerHeight);
  if (composer) { const sz = renderer.getDrawingBufferSize(new THREE.Vector2()); composer.setSize(sz.x, sz.y); }
}
function adaptQuality(dt) {
  if (GFX.lock || GFX.level >= 3) return;
  GFX.slow = dt > 1 / 36 ? GFX.slow + Math.min(dt, 0.1) : Math.max(0, GFX.slow - dt * 2);
  if (GFX.slow > 2.5) { GFX.slow = 0; GFX.level++; if (GFX.level === 2) renderer.setPixelRatio(Math.min(GFX.baseDpr, 1)); if (GFX.level === 3) renderer.setPixelRatio(0.75); resizeGfx(); }
}

// ============================================================
//  CANVAS TEXTURES
// ============================================================
function canvasTex(w, h, draw, { repeat = null, srgb = true, aniso = true } = {}) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d'); draw(g, w, h);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  if (aniso) t.anisotropy = MAX_ANISO;
  return t;
}
function noise(g, w, h, base, amp, n = 9000, sz = 2) {
  g.fillStyle = base; g.fillRect(0, 0, w, h);
  for (let i = 0; i < n; i++) {
    const v = (Math.random() - 0.5) * amp;
    g.fillStyle = `rgba(${v > 0 ? 255 : 0},${v > 0 ? 255 : 0},${v > 0 ? 255 : 0},${Math.abs(v)})`;
    g.fillRect(Math.random() * w, Math.random() * h, sz * Math.random() + 0.5, sz * Math.random() + 0.5);
  }
}
const TEX = {};
function buildTextures() {
  // asphalt with lanes: u = across (0..1 = 32m), v = along (1 tile = 16 m)
  TEX.asphalt = canvasTex(512, 512, (g, w, h) => {
    noise(g, w, h, '#2b2d31', 0.18, 26000, 2);
    for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(0,0,0,${rand(0.03, 0.08)})`; g.fillRect(rand(0, w), 0, rand(4, 30), h); }
    g.fillStyle = '#e9e9e9'; g.fillRect(w * 0.012, 0, w * 0.012, h); g.fillRect(w * 0.976, 0, w * 0.012, h);
    g.fillStyle = 'rgba(240,240,240,.85)';
    for (const u of [0.25, 0.5, 0.75]) g.fillRect(w * u - 3, h * 0.08, 6, h * 0.42);
  }, { repeat: [1, 1] });
  TEX.asphaltPit = canvasTex(256, 256, (g, w, h) => {
    noise(g, w, h, '#1f2a24', 0.16, 9000, 2);
    g.fillStyle = '#38ff8b'; g.fillRect(0, 0, 8, h); g.fillRect(w - 8, 0, 8, h);
    g.fillStyle = 'rgba(56,255,139,.25)'; for (let y = 0; y < h; y += 64) g.fillRect(w * 0.2, y, w * 0.6, 10);
  }, { repeat: [1, 1] });
  TEX.curb = canvasTex(64, 128, (g, w, h) => {
    g.fillStyle = '#d61e1e'; g.fillRect(0, 0, w, h / 2); g.fillStyle = '#f2f2f2'; g.fillRect(0, h / 2, w, h / 2);
    g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(0, 0, 6, h);
  }, { repeat: [1, 1] });
  TEX.gravel = canvasTex(256, 256, (g, w, h) => noise(g, w, h, '#9c8f7a', 0.35, 14000, 3), { repeat: [1, 1] });
  TEX.grass = canvasTex(512, 512, (g, w, h) => {
    noise(g, w, h, '#4c7a2e', 0.22, 30000, 3);
    for (let i = 0; i < 30; i++) { g.fillStyle = `rgba(${rand(40, 90)},${rand(90, 140)},${rand(20, 50)},.25)`; g.beginPath(); g.arc(rand(0, w), rand(0, h), rand(20, 80), 0, 7); g.fill(); }
  }, { repeat: [80, 80] });
  TEX.dryGrass = canvasTex(512, 512, (g, w, h) => {
    noise(g, w, h, '#6f7a37', 0.22, 30000, 3);
    for (let i = 0; i < 30; i++) { g.fillStyle = `rgba(${rand(120, 160)},${rand(110, 140)},${rand(50, 70)},.22)`; g.beginPath(); g.arc(rand(0, w), rand(0, h), rand(20, 80), 0, 7); g.fill(); }
  }, { repeat: [80, 80] });
  TEX.concrete = canvasTex(256, 256, (g, w, h) => { noise(g, w, h, '#26282e', 0.15, 9000, 2); g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 2; g.strokeRect(0, 0, w, h); }, { repeat: [120, 120] });
  TEX.checker = canvasTex(128, 32, (g, w, h) => { for (let x = 0; x < 16; x++) for (let y = 0; y < 4; y++) { g.fillStyle = (x + y) % 2 ? '#111' : '#fff'; g.fillRect(x * 8, y * 8, 8, 8); }  }, { repeat: [1, 1] });
  TEX.chevron = canvasTex(128, 256, (g, w, h) => {
    g.fillStyle = '#0a1830'; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#3bd5ff'; g.lineWidth = 16; g.lineCap = 'round'; g.shadowColor = '#3bd5ff'; g.shadowBlur = 18;
    for (let i = 0; i < 3; i++) { const y = 210 - i * 75; g.beginPath(); g.moveTo(18, y); g.lineTo(64, y - 46); g.lineTo(110, y); g.stroke(); }
  }, { repeat: [3, 1] });
  TEX.rail = canvasTex(64, 64, (g, w, h) => { const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#e6e9ee'); gr.addColorStop(.5, '#9aa1ab'); gr.addColorStop(1, '#d7dbe1'); g.fillStyle = gr; g.fillRect(0, 0, w, h); g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(0, h * .48, w, 3); }, { repeat: [1, 1] });
  TEX.wallStripe = canvasTex(128, 32, (g, w, h) => { g.fillStyle = '#d8d8d8'; g.fillRect(0, 0, w, h); g.fillStyle = '#c21c1c'; g.fillRect(0, 0, w / 2, h); }, { repeat: [1, 1] });
  TEX.carbon = canvasTex(64, 64, (g, w, h) => { g.fillStyle = '#121214'; g.fillRect(0, 0, w, h); for (let y = 0; y < h; y += 8) for (let x = 0; x < w; x += 8) { g.fillStyle = ((x + y) / 8) % 2 ? '#1d1e22' : '#0b0b0d'; g.fillRect(x, y, 8, 4); g.fillRect(x + 4, y + 4, 4, 4); } }, { repeat: [6, 6] });
  TEX.detail = canvasTex(256, 256, (g, w, h) => { noise(g, w, h, '#d2d2d2', 0.28, 26000, 3); for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(${Math.random() < 0.5 ? 255 : 0},${Math.random() < 0.5 ? 255 : 0},0,.05)`; g.beginPath(); g.arc(Math.random() * w, Math.random() * h, 10 + Math.random() * 40, 0, 7); g.fill(); } }, { repeat: [1, 1] });
  TEX.rubber = canvasTex(64, 64, (g, w, h) => { const gr = g.createLinearGradient(0, 0, w, 0); gr.addColorStop(0, 'rgba(8,8,10,0)'); gr.addColorStop(0.3, 'rgba(8,8,10,.8)'); gr.addColorStop(0.5, 'rgba(8,8,10,1)'); gr.addColorStop(0.7, 'rgba(8,8,10,.8)'); gr.addColorStop(1, 'rgba(8,8,10,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); g.globalCompositeOperation = 'destination-out'; for (let i = 0; i < 30; i++) { g.fillStyle = `rgba(0,0,0,${Math.random() * 0.35})`; g.fillRect(Math.random() * w, 0, 1 + Math.random() * 3, h); } }, { repeat: [1, 1] });
  TEX.cloud = canvasTex(256, 128, (g, w, h) => { for (let i = 0; i < 34; i++) { const x = 46 + Math.random() * (w - 92), y = 52 + Math.random() * (h - 86), r = 16 + Math.random() * 30, gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(255,255,255,.5)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(x - r, y - r, 2 * r, 2 * r); } }, { aniso: false });
  TEX.puddle = canvasTex(256, 256, (g, w, h) => { g.fillStyle = '#f4f4f4'; g.fillRect(0, 0, w, h); g.fillStyle = '#101010'; g.shadowColor = '#101010'; g.shadowBlur = 14; for (let i = 0; i < 26; i++) { g.beginPath(); g.ellipse(Math.random() * w, Math.random() * h, 6 + Math.random() * 22, 14 + Math.random() * 46, (Math.random() - 0.5) * 0.5, 0, 7); g.fill(); } }, { repeat: [1, 0.25], srgb: false });
  TEX.blob = canvasTex(128, 256, (g, w, h) => { g.shadowColor = '#000'; g.shadowBlur = 30; g.fillStyle = 'rgba(0,0,0,.85)'; for (let i = 0; i < 2; i++) { g.beginPath(); g.roundRect ? g.roundRect(34, 40, w - 68, h - 80, 16) : g.rect(34, 40, w - 68, h - 80); g.fill(); } }, { aniso: false });
  TEX.glow = canvasTex(64, 64, (g, w, h) => { const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(.3, 'rgba(255,255,255,.6)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); });
}
function textSprite(text, { color = '#fff', bg = 'rgba(0,0,0,.55)', border = '#ffcf5a', font = 'bold 44px Orbitron, sans-serif', scale = 0.012, w = 512, h = 96 } = {}) {
  const tex = canvasTex(w, h, (g) => {
    g.fillStyle = bg; const r = 22; g.beginPath(); g.roundRect ? g.roundRect(4, 4, w - 8, h - 8, r) : g.rect(4, 4, w - 8, h - 8); g.fill();
    g.lineWidth = 5; g.strokeStyle = border; g.stroke();
    g.font = font; g.fillStyle = color; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, w / 2, h / 2 + 2);
  }, { aniso: false });
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: true, transparent: true }));
  sp.scale.set(w * scale, h * scale, 1);
  return sp;
}

// ============================================================
//  PARTICLES (shader points, one system per blend mode)
// ============================================================
class Particles {
  constructor(max, additive) {
    this.max = max; this.n = 0;
    this.pos = new Float32Array(max * 3); this.col = new Float32Array(max * 3);
    this.alp = new Float32Array(max); this.siz = new Float32Array(max);
    this.p = [];
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('color', new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('alpha', new THREE.BufferAttribute(this.alp, 1).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('size', new THREE.BufferAttribute(this.siz, 1).setUsage(THREE.DynamicDrawUsage));
    this.mat = new THREE.ShaderMaterial({
      uniforms: { uScale: { value: 600 }, uMax: { value: 512 } },
      vertexShader: `attribute float alpha; attribute float size; attribute vec3 color; varying float vA; varying vec3 vC; uniform float uScale; uniform float uMax;
        void main(){ vA=alpha; vC=color; vec4 mv=modelViewMatrix*vec4(position,1.0); gl_PointSize=min(size*uScale/max(-mv.z,0.1), uMax); gl_Position=projectionMatrix*mv; }`,
      fragmentShader: `varying float vA; varying vec3 vC; void main(){ vec2 c=gl_PointCoord-0.5; float d=length(c); if(d>0.5) discard; float a=smoothstep(0.5,0.0,d); gl_FragColor=vec4(vC, a*vA); }`,
      transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    this.points = new THREE.Points(g, this.mat);
    this.points.frustumCulled = false;
    this.geo = g;
  }
  emit(o) { // o: {x,y,z,vx,vy,vz,life,size,size1,r,g,b,r1,g1,b1,a,drag,grav}
    if (this.p.length >= this.max) this.p.shift();
    o.t = 0; o.size1 ??= o.size; o.r1 ??= o.r; o.g1 ??= o.g; o.b1 ??= o.b; o.a ??= 1; o.drag ??= 0; o.grav ??= 0;
    this.p.push(o);
  }
  update(dt) {
    const P = this.p; let w = 0;
    for (let i = 0; i < P.length; i++) {
      const q = P[i]; q.t += dt; if (q.t >= q.life) continue;
      const k = Math.exp(-q.drag * dt);
      q.vx *= k; q.vy = q.vy * k - q.grav * dt; q.vz *= k;
      q.x += q.vx * dt; q.y += q.vy * dt; q.z += q.vz * dt;
      P[w++] = q;
    }
    P.length = w;
    const n = Math.min(w, this.max);
    for (let i = 0; i < n; i++) {
      const q = P[i], f = q.t / q.life;
      this.pos[i * 3] = q.x; this.pos[i * 3 + 1] = q.y; this.pos[i * 3 + 2] = q.z;
      this.col[i * 3] = lerp(q.r, q.r1, f); this.col[i * 3 + 1] = lerp(q.g, q.g1, f); this.col[i * 3 + 2] = lerp(q.b, q.b1, f);
      this.alp[i] = q.a * (f < 0.1 ? f / 0.1 : 1 - (f - 0.1) / 0.9);
      this.siz[i] = lerp(q.size, q.size1, f);
    }
    this.geo.setDrawRange(0, n);
    for (const a of ['position', 'color', 'alpha', 'size']) this.geo.attributes[a].needsUpdate = true;
  }
  clear() { this.p.length = 0; this.geo.setDrawRange(0, 0); }
  setScale(h, fov) { this.mat.uniforms.uScale.value = h * renderer.getPixelRatio() / (2 * Math.tan(THREE.MathUtils.degToRad(fov) / 2)); }
}

// ============================================================
//  AUDIO (WebAudio synth – started on first click)
// ============================================================
const Sfx = {
  ctx: null, master: null, muted: false, eng: null,
  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {}); return; }
    try {
      const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
      this.ctx = new AC(); this.master = this.ctx.createGain(); this.master.gain.value = this.muted ? 0 : 0.55; this.master.connect(this.ctx.destination);
      const nb = this.ctx.createBuffer(1, this.ctx.sampleRate * 2, this.ctx.sampleRate); const d = nb.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; this.noiseBuf = nb;
    } catch (e) { this.ctx = null; }
  },
  setMuted(m) { this.muted = m; if (this.master) this.master.gain.value = m ? 0 : 0.55; $('muteBtn').textContent = m ? '🔇' : '🔊'; },
  // ---- engine voices: every car has its own engine-cycle waveform, looped and pitched by rpm
  ENGINES: {
    vortex: { n: 12, pitch: 0.9, res: 520, decay: 1.3, rough: 0.12, uneven: 0, drive: 1.8, turbo: 0, bright: 1.1, sub: 0.35 },      // V12: smooth, howling
    comet: { n: 16, pitch: 0.62, res: 240, decay: 1.6, rough: 0.2, uneven: 0.06, drive: 2.4, turbo: 1, bright: 0.8, sub: 0.55 },     // W16 quad turbo: deep
    polaris: { n: 8, pitch: 0.9, res: 380, decay: 1.1, rough: 0.25, uneven: 0, drive: 2.8, turbo: 0.7, bright: 1.0, sub: 0.45 },     // flat-plane V8 biturbo: raspy
    inferno: { n: 8, pitch: 0.8, res: 300, decay: 1.0, rough: 0.3, uneven: 0.2, drive: 2.2, turbo: 0, bright: 0.95, sub: 0.55 },     // cross-plane V8: burbling
  },
  engBufs: {},
  engineBuffer(id) {   // exhaust pulse train: every cylinder firing is a short damped "thump" with a bit of noise, slightly irregular
    if (this.engBufs[id]) return this.engBufs[id];
    const P = this.ENGINES[id] || this.ENGINES.vortex, c = this.ctx, sr = c.sampleRate, Tc = 0.04, cycles = 24, len = Math.round(sr * Tc * cycles);
    const buf = c.createBuffer(1, len, sr), d = buf.getChannelData(0), R = seeded(id.length * 7919 + id.charCodeAt(0));
    const cyl = Array.from({ length: P.n }, () => 0.85 + 0.3 * R()), tau = Tc / P.n * P.decay, n = Math.floor(tau * 5 * sr), w1 = 2 * Math.PI * P.res / sr, w2 = w1 * 2.37;
    for (let cy = 0; cy < cycles; cy++) for (let k = 0; k < P.n; k++) {
      const t0 = (cy + (k + (k % 2 ? P.uneven : -P.uneven)) / P.n) * Tc + (R() - 0.5) * 0.006 * Tc, amp = cyl[k] * (0.86 + 0.28 * R());
      const i0 = Math.round(t0 * sr);
      for (let j = 0; j < n; j++) { const env = Math.exp(-j / (tau * sr)); d[((i0 + j) % len + len) % len] += amp * env * (Math.sin(w1 * j) + 0.4 * Math.sin(w2 * j + 1) + (Math.random() * 2 - 1) * P.rough); }
    }
    let peak = 0; for (let i = 0; i < len; i++) peak = Math.max(peak, Math.abs(d[i]));
    for (let i = 0; i < len; i++) d[i] *= 0.9 / peak;
    return (this.engBufs[id] = buf);
  },
  makeVoice(id, withSub) {
    const c = this.ctx, P = this.ENGINES[id] || this.ENGINES.vortex, mk = () => { const s = c.createBufferSource(); s.buffer = this.engineBuffer(id); s.loop = true; return s; };
    const src = mk(), sh = c.createWaveShaper(), curve = new Float32Array(256); for (let i = 0; i < 256; i++) { const x = i / 255 * 2 - 1; curve[i] = Math.tanh(x * P.drive) / Math.tanh(P.drive); } sh.curve = curve;
    const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 800; f.Q.value = 0.9; const g = c.createGain(); g.gain.value = 0;
    src.connect(sh); sh.connect(f); f.connect(g); g.connect(this.master); src.start();
    let sub = null; if (withSub) { sub = mk(); const sg = c.createGain(); sg.gain.value = P.sub; sub.connect(sg); sg.connect(f); sub.start(); }   // one octave lower: body of the sound
    return { src, sub, f, g, P };
  },
  engineStart(id = 'vortex', rivalIds = []) {
    if (!this.ctx || this.eng) return;
    const c = this.ctx, loopNoise = (type, freq, q) => { const n = c.createBufferSource(); n.buffer = this.noiseBuf; n.loop = true; const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q; const g = c.createGain(); g.gain.value = 0; n.connect(f); f.connect(g); g.connect(this.master); n.start(); return { n, g }; };
    const tb = c.createOscillator(), tg = c.createGain(); tb.type = 'sine'; tg.gain.value = 0; tb.connect(tg); tg.connect(this.master); tb.start();
    this.eng = { v: this.makeVoice(id, true), rivals: rivalIds.map(r => this.makeVoice(r)), nitro: loopNoise('bandpass', 1800, 0.8), squeal: loopNoise('bandpass', 1250, 7), rain: loopNoise('highpass', 2600, 0.5), tb, tg, thr: 0 };
  },
  engineUpdate(rpm, thr, boost, on, squeal = 0, rain = 0) {
    const e = this.eng; if (!e) return; const t = this.ctx.currentTime, P = e.v.P, k = clamp(rpm, 900, 9600);
    e.v.src.playbackRate.setTargetAtTime(k / 3000 * P.pitch, t, 0.04); e.v.sub.playbackRate.setTargetAtTime(k / 6000 * P.pitch, t, 0.04);
    e.v.f.frequency.setTargetAtTime((480 + thr * 2300 + k * 0.22) * P.bright, t, 0.07);
    if (on && thr < 0.5 && k > 4800 && Math.random() < 0.05) this.noise(0.05, 0.13, 700 + Math.random() * 900, 2);   // exhaust crackle on the overrun
    e.v.g.gain.setTargetAtTime(on ? (0.085 + 0.1 * thr) * (0.75 + 0.25 * k / 9000) : 0, t, 0.08);
    e.tb.frequency.setTargetAtTime(2400 + k * 0.55, t, 0.1); e.tg.gain.setTargetAtTime(on ? P.turbo * thr * 0.006 * (k / 9000) : 0, t, 0.15);
    if (on && P.turbo && e.thr > 0.5 && thr < 0.5 && k > 4500) this.noise(0.22, 0.09 * P.turbo, 5200, 0.5);   // turbo blow-off
    e.thr = thr;
    e.nitro.g.gain.setTargetAtTime(on && boost ? 0.14 : 0, t, 0.08);
    e.squeal.g.gain.setTargetAtTime(on ? squeal * 0.22 : 0, t, 0.06);
    e.rain.g.gain.setTargetAtTime(on ? rain * 0.045 : 0, t, 0.3);
    if (!on) for (const r of e.rivals) r.g.gain.setTargetAtTime(0, t, 0.08);
  },
  rivalUpdate(i, rpm, vol, doppler) {
    const r = this.eng && this.eng.rivals[i]; if (!r) return; const t = this.ctx.currentTime, k = clamp(rpm, 900, 9600);
    r.src.playbackRate.setTargetAtTime(k / 3000 * r.P.pitch * doppler, t, 0.05); r.f.frequency.setTargetAtTime((700 + k * 0.24) * r.P.bright, t, 0.1); r.g.gain.setTargetAtTime(vol, t, 0.08);
  },
  engineStop() {
    if (!this.eng) return; const e = this.eng;
    try { for (const v of [e.v, ...e.rivals]) { v.src.stop(); if (v.sub) v.sub.stop(); } e.nitro.n.stop(); e.squeal.n.stop(); e.rain.n.stop(); e.tb.stop(); } catch (_) {}
    this.eng = null;
  },
  blip(freq = 880, dur = 0.12, type = 'sine', vol = 0.25, slide = 1.6) {
    if (!this.ctx) return; const c = this.ctx, t = c.currentTime, o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t); o.frequency.exponentialRampToValueAtTime(freq * slide, t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur); o.connect(g); g.connect(this.master); o.start(t); o.stop(t + dur + 0.02);
  },
  noise(dur = 0.25, vol = 0.4, freq = 900, q = 0.7) {
    if (!this.ctx) return; const c = this.ctx, t = c.currentTime, n = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    n.buffer = this.noiseBuf; f.type = 'lowpass'; f.frequency.value = freq; f.Q.value = q;
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur); n.connect(f); f.connect(g); g.connect(this.master); n.start(t); n.stop(t + dur + 0.05);
  },
  coin() { this.blip(988, 0.08, 'square', 0.12, 1); setTimeout(() => this.blip(1318, 0.18, 'square', 0.12, 1), 70); },
  hit(s = 1) { this.noise(0.18 + 0.1 * s, 0.25 + 0.25 * s, 1400); },
  boom() { this.noise(1.6, 0.9, 380, 0.3); this.blip(90, 0.9, 'sawtooth', 0.4, 0.3); },
  beep(hi) { this.blip(hi ? 1320 : 660, hi ? 0.5 : 0.22, 'square', 0.15, 1); },
  repair() { this.blip(520, 0.25, 'triangle', 0.18, 2); },
};
