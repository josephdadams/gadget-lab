'use strict';
// People walking laps around the sidewalks, and cars driving the roads. Both are instanced so hundreds cost about the same as one.
const PEDS = 280, CARS = 80;
const SW = BLOCK / 2 - 2, PER = SW * 8; // sidewalk ring around each block, and how long one lap is
const SKIN = ['#f1c27d', '#e0ac69', '#c68642', '#8d5524', '#ffdbac', '#a86b3c'];
const SHIRTS = ['#e63946', '#f4a261', '#2a9d8f', '#e9c46a', '#8338ec', '#3a86ff', '#ff006e', '#06d6a0', '#ffffff', '#264653', '#fb8500'];
const PANTS = ['#2d3e50', '#3b3b3b', '#5a4632', '#1f4e79', '#6b6b6b', '#2b2d42'];
const ICE = new THREE.Color('#bfefff');
const peds = [], cars = [];
let pedLegs, pedBody, pedHead, carBody, carTop;

function perimPos(p) {
  const t = ((p.t % PER) + PER) % PER, side = Math.floor(t / (2 * SW)), u = t - side * 2 * SW - SW;
  const cx = bx(p.bi), cz = bx(p.bj);
  let x, z, dx, dz;
  if (side === 0) { x = cx + u; z = cz - SW; dx = 1; dz = 0; }
  else if (side === 1) { x = cx + SW; z = cz + u; dx = 0; dz = 1; }
  else if (side === 2) { x = cx - u; z = cz + SW; dx = -1; dz = 0; }
  else { x = cx - SW; z = cz - u; dx = 0; dz = -1; }
  // keep to one side of the sidewalk so people pass each other
  p.pos.set(x - dz * p.lane * p.dir, 0, z + dx * p.lane * p.dir);
  p.yaw = Math.atan2(dx * p.dir, dz * p.dir);
}
// find the nearest spot on a sidewalk ring (after flying through the air, for example)
function projectPerim(p) {
  const i = clamp(blockOf(p.pos.x), 0, N - 1), j = clamp(blockOf(p.pos.z), 0, N - 1);
  const lx = clamp(p.pos.x - bx(i), -SW, SW), lz = clamp(p.pos.z - bx(j), -SW, SW);
  const ds = [lz + SW, SW - lx, SW - lz, lx + SW];
  let s = 0;
  for (let k = 1; k < 4; k++) if (ds[k] < ds[s]) s = k;
  const u = s === 0 ? lx : s === 1 ? lz : s === 2 ? -lx : -lz;
  p.bi = i; p.bj = j; p.t = s * 2 * SW + u + SW;
}

function makePeople() {
  const legs = new THREE.BoxGeometry(0.42, 0.8, 0.26); legs.translate(0, 0.4, 0);
  const body = new THREE.BoxGeometry(0.52, 0.68, 0.32); body.translate(0, 1.14, 0);
  const head = new THREE.SphereGeometry(0.21, 8, 6); head.translate(0, 1.66, 0);
  const mk = g => { const m = new THREE.InstancedMesh(g, new THREE.MeshLambertMaterial(), PEDS); m.frustumCulled = false; scene.add(m); return m; };
  pedLegs = mk(legs); pedBody = mk(body); pedHead = mk(head);
  const c = new THREE.Color();
  for (let k = 0; k < PEDS; k++) {
    const p = { k, bi: Math.floor(Math.random() * N), bj: Math.floor(Math.random() * N), t: Math.random() * PER, dir: Math.random() < 0.5 ? 1 : -1,
      lane: 0.6 + Math.random() * 0.8, speed: rand(1.1, 1.8), state: 'walk', pos: new V(), vel: new V(), yaw: 0, spin: 0, timer: 0, scared: 0,
      phase: Math.random() * 6, shirt: pick(SHIRTS), portalCd: 0 };
    perimPos(p);
    peds.push(p);
    pedLegs.setColorAt(k, c.set(pick(PANTS))); pedBody.setColorAt(k, c.set(p.shirt)); pedHead.setColorAt(k, c.set(pick(SKIN)));
  }

  const cb = new THREE.BoxGeometry(2, 0.9, 4.4); cb.translate(0, 0.75, 0);
  const ct = new THREE.BoxGeometry(1.7, 0.7, 2.3); ct.translate(0, 1.55, -0.2);
  carBody = new THREE.InstancedMesh(cb, new THREE.MeshLambertMaterial(), CARS);
  carTop = new THREE.InstancedMesh(ct, new THREE.MeshLambertMaterial({ color: '#27313f' }), CARS);
  carBody.frustumCulled = carTop.frustumCulled = false;
  scene.add(carBody, carTop);
  const CARCOL = ['#e63946', '#f1faee', '#1d3557', '#ffb703', '#219ebc', '#8ecae6', '#2b2d42', '#06d6a0', '#ef476f', '#adb5bd'];
  for (let k = 0; k < CARS; k++) {
    const dir = Math.random() < 0.5 ? 1 : -1;
    cars.push({ axis: k % 2, road: Math.floor(Math.random() * (N + 1)) - 1, dir, s: rand(-HALF, HALF), speed: rand(9, 15), pos: new V(), yaw: 0 });
    carBody.setColorAt(k, c.set(pick(CARCOL)));
  }
}

const m4 = new THREE.Matrix4(), qA = new THREE.Quaternion(), qB = new THREE.Quaternion(), eul = new THREE.Euler(), sc1 = new V(1, 1, 1);
function updatePeople(dt) {
  let recolor = false;
  const c = new THREE.Color();
  for (const p of peds) {
    p.portalCd -= dt;
    if (p.state === 'walk') {
      p.scared -= dt;
      const sp = p.speed * (p.scared > 0 ? 3.2 : 1);
      p.t += p.dir * sp * dt; p.phase += sp * dt * 4;
      perimPos(p);
    } else if (p.state === 'fly') {
      p.vel.y -= GRAV * dt;
      p.pos.addScaledVector(p.vel, dt);
      p.spin += dt * 9;
      if (portalTry(p, p.pos, p.vel)) {}
      if (collideBody(p.pos, p.vel, 0.3, 1.7) && p.vel.y <= 0.1) { p.state = 'down'; p.timer = 2.2; p.vel.set(0, 0, 0); }
    } else {
      p.timer -= dt;
      if (p.timer <= 0) {
        if (p.state === 'frozen') { pedBody.setColorAt(p.k, c.set(p.shirt)); recolor = true; }
        projectPerim(p); perimPos(p);
        p.state = 'walk'; p.scared = 5; p.dir = Math.random() < 0.5 ? 1 : -1;
      }
    }
    // pose: walking bob, tumbling through the air, lying down, or stiff as an ice cube
    let y = p.pos.y;
    if (p.state === 'walk') { eul.set(0, p.yaw, 0); y += Math.abs(Math.sin(p.phase)) * 0.07; }
    else if (p.state === 'fly') eul.set(p.spin, p.yaw, p.spin * 0.6);
    else if (p.state === 'down') eul.set(-Math.PI / 2, p.yaw, 0);
    else eul.set(0, p.yaw, 0);
    qA.setFromEuler(eul);
    m4.compose(tmpPos.set(p.pos.x, y, p.pos.z), qA, sc1);
    pedLegs.setMatrixAt(p.k, m4); pedBody.setMatrixAt(p.k, m4); pedHead.setMatrixAt(p.k, m4);
  }
  pedLegs.instanceMatrix.needsUpdate = pedBody.instanceMatrix.needsUpdate = pedHead.instanceMatrix.needsUpdate = true;
  if (recolor) pedBody.instanceColor.needsUpdate = true;

  const edge = HALF + 60;
  cars.forEach((car, k) => {
    car.s += car.dir * car.speed * dt;
    if (car.s > edge) car.s = -edge; else if (car.s < -edge) car.s = edge;
    const line = roadC(car.road) + car.dir * 3.6;
    if (car.axis === 0) { car.pos.set(car.s, 0, line); car.yaw = car.dir > 0 ? Math.PI / 2 : -Math.PI / 2; }
    else { car.pos.set(-line, 0, car.s); car.yaw = car.dir > 0 ? 0 : Math.PI; }
    m4.compose(car.pos, qB.setFromAxisAngle(UP, car.yaw), sc1);
    carBody.setMatrixAt(k, m4); carTop.setMatrixAt(k, m4);
  });
  carBody.instanceMatrix.needsUpdate = carTop.instanceMatrix.needsUpdate = true;
}
const tmpPos = new V();

function flingPed(p, vel) {
  if (p.state === 'frozen') { pedBody.setColorAt(p.k, new THREE.Color(p.shirt)); pedBody.instanceColor.needsUpdate = true; }
  p.state = 'fly'; p.vel.copy(vel); p.pos.y = Math.max(p.pos.y, 0.05);
}
function freezePed(p) {
  p.state = 'frozen'; p.timer = 4;
  pedBody.setColorAt(p.k, ICE); pedBody.instanceColor.needsUpdate = true;
}
function scareNear(pos, r) {
  for (const p of peds) if (p.state === 'walk' && p.pos.distanceToSquared(pos) < r * r) p.scared = 5;
}
