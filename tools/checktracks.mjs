// Validates track layouts: length, min corner radius, min distance between non-adjacent parts
import * as THREE from '../vendor/node_modules/three/build/three.module.js';

export const TRACK_PTS = {
  alps: [
    [0,0],[0,160],[0,320],[30,440],[130,520],[280,530],[400,460],[470,340],[560,250],[700,240],
    [800,330],[820,480],[760,620],[640,700],[480,720],[330,780],[180,860],[20,860],[-120,780],
    [-200,640],[-190,480],[-110,380],[-150,250],[-210,120],[-200,-60],[-200,-250],[-171,-321],[-100,-350],[-29,-321],[0,-250],[0,-125]
  ],
  gp: [
    [0,0],[0,170],[0,340],[10,470],[90,540],[200,540],[260,600],[260,720],[330,800],[480,800],
    [620,760],[700,640],[690,500],[620,420],[640,300],[740,220],[800,100],[760,-40],[650,-100],
    [540,-90],[450,-160],[340,-220],[240,-320],[170,-370],[100,-360],[29,-331],[0,-260],[0,-130]
  ],
  tokyo: [
    [0,0],[0,200],[0,400],[60,580],[220,700],[440,740],[680,720],[900,640],[1040,500],[1060,320],
    [980,170],[820,110],[640,140],[500,60],[460,-120],[520,-300],[480,-460],[320,-540],[140,-520],
    [30,-420],[0,-260],[0,-130]
  ]
};

export function sampleTrack(pts, spacing = 2) {
  const curve = new THREE.CatmullRomCurve3(pts.map(p => new THREE.Vector3(p[0], 0, p[1])), true, 'centripetal', 0.5);
  const L = curve.getLength();
  const N = Math.round(L / spacing);
  const P = curve.getSpacedPoints(N).slice(0, N);
  return { curve, L, N, P };
}

if (process.argv[1].endsWith('checktracks.mjs')) {
  for (const [id, pts] of Object.entries(TRACK_PTS)) {
    const { L, N, P } = sampleTrack(pts);
    const ds = L / N;
    // radius via 3-point circle over +-5 samples
    let minR = 1e9, minRs = 0;
    for (let i = 0; i < N; i++) {
      const a = P[(i - 5 + N) % N], b = P[i], c = P[(i + 5) % N];
      const ab = a.distanceTo(b), bc = b.distanceTo(c), ca = c.distanceTo(a);
      const cross = Math.abs((b.x - a.x) * (c.z - a.z) - (b.z - a.z) * (c.x - a.x));
      const R = cross < 1e-6 ? 1e9 : (ab * bc * ca) / (2 * cross);
      if (R < minR) { minR = R; minRs = i * ds; }
    }
    // separation: samples farther than 200m apart along track must be > 75m apart in space
    let minSep = 1e9, at = null;
    const step = 4;
    for (let i = 0; i < N; i += step) for (let j = i + step; j < N; j += step) {
      let dsij = Math.abs(i - j) * ds; dsij = Math.min(dsij, L - dsij);
      if (dsij < 200) continue;
      const d = P[i].distanceTo(P[j]);
      if (d < minSep) { minSep = d; at = [Math.round(i * ds), Math.round(j * ds)]; }
    }
    // straight check at start: lateral deviation from x=0 between s=-80..300
    let maxDev = 0;
    for (let s = -80; s <= 300; s += 2) { const i = ((Math.round(s / ds)) % N + N) % N; maxDev = Math.max(maxDev, Math.abs(P[i].x)); }
    console.log(id.padEnd(6), 'L=', L.toFixed(0), 'minR=', minR.toFixed(0), '@', minRs.toFixed(0), 'minSep=', minSep.toFixed(0), at, 'startDev=', maxDev.toFixed(2));
  }
}
