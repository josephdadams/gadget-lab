'use strict';
// The city: a grid of blocks with roads between them. Every building is a plain box, drawn all at once
// with one instanced mesh, and the windows are painted on by the shader so there's nothing to load.
const N = 14, BLOCK = 60, ROAD = 16, CELL = BLOCK + ROAD, HALF = N * CELL / 2;
const bx = i => (i - (N - 1) / 2) * CELL;            // middle of block i (same for x and z)
const blockOf = x => Math.round(x / CELL + (N - 1) / 2);
const roadC = k => bx(k) + CELL / 2;                  // middle of the road after block k (k = -1 is the west/north edge)
const HQ = { i: 7, j: 7 };
const SPAWN = new V(bx(HQ.i), 0, bx(HQ.j) + 24);
const LIMIT = HALF + 60;

const blocks = [];            // blocks[i * N + j] = { i, j, type, list: [building numbers] }
const boxes = [];             // [x0, y0, z0, x1, y1, z1]
const boxCols = [];
let BN = 0, bmin, bmax;       // flat copies of boxes for fast loops: bmin[k*3 + 0..2]
let hqSpinner = null, sunDir;

const PALETTE = ['#c9b79c', '#a7a9ac', '#9a7560', '#b55d4c', '#6f8fa8', '#d8d2c4', '#7a8b8f', '#9db4c0', '#c48b6a',
  '#5d7183', '#e0c9a6', '#88a39a', '#b8a0c8', '#d9a066', '#7f9cb5'];

function addBox(list, x0, y0, z0, x1, y1, z1, col) {
  list.push(boxes.length);
  boxes.push([x0, y0, z0, x1, y1, z1]);
  boxCols.push(col);
}

function genCity() {
  const parks = new Set();
  while (parks.size < 14) {
    const i = Math.floor(srand() * N), j = Math.floor(srand() * N);
    if (Math.abs(i - HQ.i) + Math.abs(j - HQ.j) > 1) parks.add(i * N + j);
  }
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
    const b = { i, j, type: 'city', list: [] };
    blocks[i * N + j] = b;
    const cx = bx(i), cz = bx(j);
    if (i === HQ.i && j === HQ.j) {
      b.type = 'hq';
      addBox(b.list, cx - 15, 0, cz - 15, cx + 15, 46, cz + 15, '#eeeeea');
      addBox(b.list, cx - 9, 46, cz - 9, cx + 9, 54, cz + 9, '#ff8a2a');
      continue;
    }
    if (parks.has(i * N + j)) { b.type = 'park'; continue; }
    // downtown in the middle is tall, the edges of town are short
    const d = Math.hypot(cx, cz) / HALF;
    const maxH = 26 + 150 * Math.pow(clamp(1 - d, 0, 1), 1.6);
    const k = d < 0.45 ? (srand() < 0.5 ? 1 : 2) : (srand() < 0.35 ? 2 : 3);
    const gap = 3, lot = BLOCK - 10, sz = (lot - gap * (k - 1)) / k;
    for (let a = 0; a < k; a++) for (let c = 0; c < k; c++) {
      if (k > 1 && srand() < 0.08) continue; // a little plaza
      const inset = srand() * 2.5;
      const x0 = cx - lot / 2 + a * (sz + gap) + inset, z0 = cz - lot / 2 + c * (sz + gap) + inset;
      const x1 = x0 + sz - inset * 2, z1 = z0 + sz - inset * 2;
      let h = Math.max(9, maxH * (0.3 + 0.7 * srand()));
      if (srand() < 0.04) h *= 1.6; // the odd skyscraper sticking up
      const col = PALETTE[Math.floor(srand() * PALETTE.length)];
      if (h > 55 && srand() < 0.45) {
        // a tower with a narrower top part
        const low = Math.round(h * (0.5 + srand() * 0.2)), s = Math.min(5, (x1 - x0) * 0.2);
        addBox(b.list, x0, 0, z0, x1, low, z1, col);
        addBox(b.list, x0 + s, low, z0 + s, x1 - s, h, z1 - s, col);
      } else addBox(b.list, x0, 0, z0, x1, h, z1, col);
    }
  }
  BN = boxes.length;
  bmin = new Float32Array(BN * 3); bmax = new Float32Array(BN * 3);
  boxes.forEach((b, q) => { bmin.set(b.slice(0, 3), q * 3); bmax.set(b.slice(3), q * 3); });
}

const buildingVS = `
varying vec3 vW; varying vec3 vN; varying vec3 vC;
void main() {
  vec4 w = modelMatrix * instanceMatrix * vec4(position, 1.0);
  vW = w.xyz; vN = normal; vC = instanceColor;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;
const buildingFS = `
uniform vec3 fogColor; uniform float fogNear; uniform float fogFar; uniform vec3 sunDir;
varying vec3 vW; varying vec3 vN; varying vec3 vC;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
void main() {
  vec3 n = normalize(vN);
  vec3 base = vC;
  vec3 col;
  if (n.y > 0.5) {
    vec2 g = abs(fract(vW.xz / 5.0) - 0.5);
    col = base * 0.5 + 0.13 - step(0.47, max(g.x, g.y)) * 0.05;
  } else if (n.y < -0.5) {
    col = base * 0.3;
  } else {
    float u = abs(n.x) > 0.5 ? vW.z : vW.x;
    float v = vW.y;
    vec2 cell = vec2(u / 3.2, (v - 1.0) / 3.6);
    vec2 f = fract(cell); vec2 id = floor(cell);
    float win = step(0.16, f.x) * step(f.x, 0.84) * step(0.24, f.y) * step(f.y, 0.86);
    float h = hash(id + base.rg * 91.0);
    vec3 glass = mix(vec3(0.22, 0.34, 0.48), vec3(0.62, 0.78, 0.92), clamp(f.y * 0.5 + h * 0.45, 0.0, 1.0));
    glass = mix(glass, vec3(1.0, 0.9, 0.6), step(0.93, h) * 0.6);
    col = mix(base, glass, win * 0.85);
    // ground floor: shop windows and a darker band
    float shop = step(0.8, v) * step(v, 3.4) * step(0.12, fract(u / 7.0)) * step(fract(u / 7.0), 0.88);
    col = v < 4.2 ? mix(base * 0.62, vec3(0.28, 0.36, 0.44), shop) : col;
  }
  float light = 0.58 + 0.5 * max(dot(n, sunDir), 0.0) + 0.08 * n.y;
  col *= light;
  float d = distance(vW, cameraPosition);
  gl_FragColor = vec4(mix(col, fogColor, smoothstep(fogNear, fogFar, d)), 1.0);
}`;

function groundTexture() {
  const S = 512, c = document.createElement('canvas'); c.width = c.height = S;
  const g = c.getContext('2d'), m = S / CELL, r0 = ROAD / 2 * m;
  g.fillStyle = '#41454d'; g.fillRect(0, 0, S, S);
  g.fillStyle = '#bdb9b0'; g.fillRect(r0, r0, BLOCK * m, BLOCK * m);
  g.fillStyle = '#958f84'; g.fillRect(r0 + 4 * m, r0 + 4 * m, (BLOCK - 8) * m, (BLOCK - 8) * m);
  g.strokeStyle = '#e4e1da'; g.lineWidth = 3; g.strokeRect(r0, r0, BLOCK * m, BLOCK * m);
  g.strokeStyle = 'rgba(0,0,0,.13)'; g.lineWidth = 1;
  for (let s = 0; s <= BLOCK; s += 2.5) {
    const p = r0 + s * m;
    g.beginPath(); g.moveTo(p, r0); g.lineTo(p, r0 + 4 * m); g.moveTo(p, S - r0); g.lineTo(p, S - r0 - 4 * m);
    g.moveTo(r0, p); g.lineTo(r0 + 4 * m, p); g.moveTo(S - r0, p); g.lineTo(S - r0 - 4 * m, p); g.stroke();
  }
  // yellow center dashes (the road middles sit right on the tile edges)
  g.fillStyle = '#f2c94c';
  for (let s = r0 + 5 * m; s < S - r0 - 5 * m; s += 6 * m) {
    g.fillRect(s, -2, 3 * m, 4); g.fillRect(s, S - 2, 3 * m, 4); g.fillRect(-2, s, 4, 3 * m); g.fillRect(S - 2, s, 4, 3 * m);
  }
  // crosswalks next to each corner
  g.fillStyle = 'rgba(245,245,245,.85)';
  for (let x = 0.4 * m; x < r0; x += 1.3 * m) for (const zA of [r0 + 0.6 * m, S - r0 - 3.6 * m]) {
    g.fillRect(x, zA, 0.65 * m, 3 * m); g.fillRect(S - x - 0.65 * m, zA, 0.65 * m, 3 * m);
    g.fillRect(zA, x, 3 * m, 0.65 * m); g.fillRect(zA, S - x - 0.65 * m, 3 * m, 0.65 * m);
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return t;
}

function signTexture() {
  const c = document.createElement('canvas'); c.width = 1024; c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#14213d'; g.fillRect(0, 0, 1024, 256);
  g.strokeStyle = '#ff8a2a'; g.lineWidth = 16; g.strokeRect(8, 8, 1008, 240);
  g.font = 'bold 150px "Lilita One", "Arial Rounded MT Bold", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillStyle = '#9be15d'; g.fillText('GADGET LAB', 512, 136);
  return new THREE.CanvasTexture(c);
}

function buildCity() {
  genCity();
  const fogColor = scene.fog.color;
  sunDir = new V(0.45, 0.8, 0.35).normalize();
  // buildings
  const geo = new THREE.BoxGeometry(1, 1, 1); geo.translate(0, 0.5, 0);
  const mat = new THREE.ShaderMaterial({
    vertexShader: buildingVS, fragmentShader: buildingFS,
    uniforms: { fogColor: { value: fogColor }, fogNear: { value: scene.fog.near }, fogFar: { value: scene.fog.far }, sunDir: { value: sunDir } },
  });
  const mesh = new THREE.InstancedMesh(geo, mat, BN), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), col = new THREE.Color();
  boxes.forEach((b, k) => {
    m4.compose(new V((b[0] + b[3]) / 2, b[1], (b[2] + b[5]) / 2), q, new V(b[3] - b[0], b[4] - b[1], b[5] - b[2]));
    mesh.setMatrixAt(k, m4); mesh.setColorAt(k, col.set(boxCols[k]));
  });
  mesh.frustumCulled = false;
  scene.add(mesh);

  // ground
  const gt = groundTexture(), span = N + 6;
  gt.repeat.set(span, span);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(span * CELL, span * CELL), new THREE.MeshLambertMaterial({ map: gt }));
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);

  // parks: grass, a path cross and trees
  const grass = new THREE.MeshLambertMaterial({ color: '#5fae4f' }), path = new THREE.MeshLambertMaterial({ color: '#d9c9a3' });
  const trunkGeo = new THREE.CylinderGeometry(0.3, 0.4, 3, 6); trunkGeo.translate(0, 1.5, 0);
  const leafGeo = new THREE.IcosahedronGeometry(2.6, 0); leafGeo.translate(0, 4.6, 0);
  const treeSpots = [];
  for (const b of blocks) {
    if (b.type !== 'park' && b.type !== 'hq') continue;
    const cx = bx(b.i), cz = bx(b.j), s = BLOCK - 8;
    const lawn = new THREE.Mesh(new THREE.PlaneGeometry(s, s), b.type === 'hq' ? new THREE.MeshLambertMaterial({ color: '#a89f90' }) : grass);
    lawn.rotation.x = -Math.PI / 2; lawn.position.set(cx, 0.03, cz); scene.add(lawn);
    if (b.type === 'hq') continue;
    for (const [w, d] of [[4, s], [s, 4]]) {
      const p = new THREE.Mesh(new THREE.PlaneGeometry(w, d), path);
      p.rotation.x = -Math.PI / 2; p.position.set(cx, 0.05, cz); scene.add(p);
    }
    for (let t = 0; t < 16; t++) {
      let x, z;
      do { x = (srand() - 0.5) * (s - 6); z = (srand() - 0.5) * (s - 6); } while (Math.abs(x) < 4 || Math.abs(z) < 4);
      treeSpots.push([cx + x, cz + z, 0.8 + srand() * 0.6]);
    }
  }
  const trunks = new THREE.InstancedMesh(trunkGeo, new THREE.MeshLambertMaterial({ color: '#7a5233' }), treeSpots.length);
  const leaves = new THREE.InstancedMesh(leafGeo, new THREE.MeshLambertMaterial({ color: '#3f9a3a', flatShading: true }), treeSpots.length);
  treeSpots.forEach(([x, z, s], k) => {
    m4.compose(new V(x, 0, z), q.setFromAxisAngle(UP, s * 9), new V(s, s, s));
    trunks.setMatrixAt(k, m4); leaves.setMatrixAt(k, m4);
  });
  scene.add(trunks, leaves);

  // rooftop bits (air conditioners and water tanks) so the roofs aren't empty
  const roofGeo = new THREE.BoxGeometry(1, 1, 1); roofGeo.translate(0, 0.5, 0);
  const roofBits = new THREE.InstancedMesh(roofGeo, new THREE.MeshLambertMaterial({ color: '#9aa0a6' }), BN);
  let nr = 0;
  boxes.forEach(b => {
    if (b[4] < 15 || srand() < 0.3) return;
    const w = 2 + srand() * 3;
    m4.compose(new V(lerp(b[0] + w, b[3] - w, srand()), b[4], lerp(b[2] + w, b[5] - w, srand())), q.identity(), new V(w, 1.2 + srand() * 2, w * 0.8));
    roofBits.setMatrixAt(nr++, m4);
  });
  roofBits.count = nr;
  scene.add(roofBits);

  // the Lab: orange stripes, a big sign facing the plaza, and a spinning gadget on the roof
  const hx = bx(HQ.i), hz = bx(HQ.j), stripe = new THREE.MeshLambertMaterial({ color: '#ff8a2a' });
  for (const y of [12, 24, 36]) {
    const s = new THREE.Mesh(new THREE.BoxGeometry(30.6, 1.4, 30.6), stripe);
    s.position.set(hx, y, hz); scene.add(s);
  }
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(26, 6.5), new THREE.MeshBasicMaterial({ map: signTexture() }));
  sign.position.set(hx, 41, hz + 15.4); scene.add(sign);
  const sign2 = sign.clone(); sign2.rotation.y = Math.PI; sign2.position.set(hx, 41, hz - 15.4); scene.add(sign2);
  hqSpinner = new THREE.Mesh(new THREE.TorusKnotGeometry(5, 1.3, 80, 10), new THREE.MeshLambertMaterial({ color: '#9be15d', emissive: '#2d5a10' }));
  hqSpinner.position.set(hx, 64, hz); scene.add(hqSpinner);
  const door = new THREE.Mesh(new THREE.PlaneGeometry(8, 5), new THREE.MeshLambertMaterial({ color: '#4fd8ff', emissive: '#0d4a5a' }));
  door.position.set(hx, 2.5, hz + 15.05); scene.add(door);
}

// Push a body (feet at p, radius r, height h) out of the ground and any building it's in. Returns true when standing on something.
function collideBody(p, v, r, h) {
  let ground = false;
  if (p.y <= 0) { p.y = 0; if (v.y < 0) v.y = 0; ground = true; }
  const i0 = blockOf(p.x), j0 = blockOf(p.z);
  for (let a = i0 - 1; a <= i0 + 1; a++) for (let c = j0 - 1; c <= j0 + 1; c++) {
    if (a < 0 || c < 0 || a >= N || c >= N) continue;
    const l = blocks[a * N + c].list;
    for (let q = 0; q < l.length; q++) {
      const k = l[q] * 3;
      const x0 = bmin[k] - r, x1 = bmax[k] + r, y0 = bmin[k + 1] - h, y1 = bmax[k + 1], z0 = bmin[k + 2] - r, z1 = bmax[k + 2] + r;
      if (p.x <= x0 || p.x >= x1 || p.y <= y0 || p.y >= y1 || p.z <= z0 || p.z >= z1) continue;
      const dx0 = p.x - x0, dx1 = x1 - p.x, dz0 = p.z - z0, dz1 = z1 - p.z, dy1 = y1 - p.y, dy0 = p.y - y0;
      // just below a roof edge: hop up onto the roof instead of bumping the wall
      const m = dy1 < 1.1 && v.y > -12 ? dy1 : Math.min(dx0, dx1, dz0, dz1, dy1, dy0);
      if (m === dy1) { p.y = y1; if (v.y < 0) v.y = 0; ground = true; }
      else if (m === dx0) { p.x = x0; if (v.x > 0) v.x = 0; }
      else if (m === dx1) { p.x = x1; if (v.x < 0) v.x = 0; }
      else if (m === dz0) { p.z = z0; if (v.z > 0) v.z = 0; }
      else if (m === dz1) { p.z = z1; if (v.z < 0) v.z = 0; }
      else { p.y = y0; if (v.y > 0) v.y = 0; }
    }
  }
  return ground;
}

// First thing a ray hits: a building or the ground. Returns a shared object (copy what you need).
const rayHit = { t: 0, p: new V(), n: new V(), k: -1 };
function rayCity(o, d, maxT, skipGround) {
  let best = maxT, bk = -1, axis = 0;
  const ix = Math.abs(d.x) > 1e-9 ? 1 / d.x : 1e9, iy = Math.abs(d.y) > 1e-9 ? 1 / d.y : 1e9, iz = Math.abs(d.z) > 1e-9 ? 1 / d.z : 1e9;
  for (let q = 0; q < BN; q++) {
    const k = q * 3;
    let t1 = (bmin[k] - o.x) * ix, t2 = (bmax[k] - o.x) * ix;
    let tn = t1 < t2 ? t1 : t2, tf = t1 < t2 ? t2 : t1, ax = 0;
    t1 = (bmin[k + 1] - o.y) * iy; t2 = (bmax[k + 1] - o.y) * iy;
    let n = t1 < t2 ? t1 : t2, f = t1 < t2 ? t2 : t1;
    if (n > tn) { tn = n; ax = 1; } if (f < tf) tf = f;
    if (tf < tn) continue;
    t1 = (bmin[k + 2] - o.z) * iz; t2 = (bmax[k + 2] - o.z) * iz;
    n = t1 < t2 ? t1 : t2; f = t1 < t2 ? t2 : t1;
    if (n > tn) { tn = n; ax = 2; } if (f < tf) tf = f;
    if (tf < tn || tn < 0 || tn >= best) continue;
    best = tn; bk = q; axis = ax;
  }
  if (!skipGround && d.y < -1e-6) {
    const tg = -o.y / d.y;
    if (tg > 0 && tg < best) { best = tg; bk = -2; axis = 1; }
  }
  if (bk === -1) return null;
  rayHit.t = best; rayHit.k = bk;
  rayHit.p.copy(o).addScaledVector(d, best);
  rayHit.n.set(0, 0, 0);
  if (axis === 0) rayHit.n.x = d.x > 0 ? -1 : 1; else if (axis === 1) rayHit.n.y = d.y > 0 ? -1 : 1; else rayHit.n.z = d.z > 0 ? -1 : 1;
  return rayHit;
}
