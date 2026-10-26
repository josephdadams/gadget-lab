'use strict';
// Monster mode: you turn into a giant lizard and stomp through the city. Punch buildings down, melt them with atomic breath,
// and fight a giant ape or a three-headed golden dragon. The Lab's robots rebuild the city when you change back.
const NAMES = { me: 'ZILLA', ape: 'MEGA APE', hydra: 'THREE-HEADED KING' };
const kaiju = {
  on: false, hp: 100, energy: 1, empty: false, yaw: 0, onGround: true, airT: 0, phase: 0, lastStep: 0,
  punch: [0, 0], hit: [true, true], tail: 0, tailHit: true, lastReel: false, breathing: false, beamSnd: 0, beamFx: 0,
  calm: 0, down: 0, shake: 0, scareT: 0, hurtT: 0,
  g: null, body: null, legs: [], arms: [], tailSegs: [], head: null, jaw: null, mouth: null, plateMat: null, beam: null, core: null,
};
const foe = {
  on: false, kind: '', hp: 0, max: 0, pos: new V(), vel: new V(), yaw: 0, state: '', t: 0, cd: 0, leapCd: 0, anim: 0, phase: 0,
  side: 0, hitDone: true, tick: 0, zapT: 0, zapHead: 0, orbit: 0, flinch: 0, fall: 0, r: 18, models: {}, m: null,
};
const kv = { a: new V(), b: new V(), c: new V(), d: new V(), e: new V(), f: new V(), aim: new V() };
const KS = 8.6; // your monster is built about 11 units tall, so this makes it about 95 m, taller than almost every building

// little helpers for building the models out of blobs, boxes and sticks
function kit(g) {
  return {
    blob: (r, sx, sy, sz, m, x, y, z, parent = g) => {
      const o = new THREE.Mesh(new THREE.SphereGeometry(r, 14, 10), m); o.scale.set(sx, sy, sz); o.position.set(x, y, z); parent.add(o); return o;
    },
    box: (w, h, d, m, x, y, z, parent = g) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y, z); parent.add(o); return o; },
    limb: (a, b, r0, r1, m, parent = g) => {
      const o = new THREE.Mesh(new THREE.CylinderGeometry(r1, r0, a.distanceTo(b), 8), m);
      o.position.copy(a).add(b).multiplyScalar(0.5);
      o.quaternion.setFromUnitVectors(UP, kv.a.copy(b).sub(a).normalize());
      parent.add(o); return o;
    },
    piv: (x, y, z, parent = g) => { const o = new THREE.Group(); o.position.set(x, y, z); parent.add(o); return o; },
  };
}
const lam = (c, e) => new THREE.MeshLambertMaterial({ color: c, emissive: e || '#000000' });
const fwdOf = (yaw, out) => out.set(Math.sin(yaw), 0, Math.cos(yaw));

// ---- Your monster ----
function makeKaiju() {
  const K = kaiju, skin = lam('#3e4c40'), dark = lam('#283229'), belly = lam('#6f7d5c'), teeth = lam('#f5f0dc'), eye = lam('#ffd34d', '#7a5500');
  K.plateMat = lam('#d6e8f5');
  const g = new THREE.Group(); g.rotation.order = 'YXZ'; // faces +z, so its left is +x
  const { blob, box, limb, piv } = kit(g);
  const plate = (s, x, y, z, parent) => {
    const o = new THREE.Mesh(new THREE.ConeGeometry(0.6, 1.7, 4), K.plateMat);
    o.scale.set(0.3 * s, s, s); o.position.set(x, y, z); o.rotation.x = -0.35; parent.add(o); return o;
  };
  K.legs = [1, -1].map(s => {
    const p = piv(s * 1.3, 4.1, -0.2);
    blob(1, 1.1, 1.7, 1.2, skin, 0, -1.0, 0, p);
    limb(new V(0, -1.9, 0), new V(0, -3.6, 0.3), 0.85, 0.7, skin, p);
    box(1.4, 0.5, 2.2, dark, 0, -3.85, 0.7, p);
    for (const t of [-0.45, 0, 0.45]) { const c = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.6, 5), teeth); c.rotation.x = Math.PI / 2; c.position.set(t, -3.9, 1.9); p.add(c); }
    return p;
  });
  const body = piv(0, 0, 0); K.body = body;
  blob(1, 2.4, 3.3, 2.2, skin, 0, 6.4, 0, body);
  blob(1, 1.85, 2.9, 1.5, belly, 0, 6.2, 0.85, body);
  blob(1, 1.7, 1.9, 1.6, skin, 0, 9.0, 0.6, body);
  for (const [s, y, z] of [[1.4, 10.2, -0.2], [1.8, 9.0, -1.1], [2.0, 7.6, -1.7], [1.7, 6.2, -2.0], [1.3, 5.0, -2.1]]) {
    plate(s, 0, y, z, body); plate(s * 0.65, 0.55, y - 0.4, z + 0.15, body); plate(s * 0.65, -0.55, y - 0.4, z + 0.15, body);
  }
  const head = piv(0, 10.4, 1.4, body); K.head = head;
  box(1.6, 1.35, 1.9, skin, 0, 0, 0, head);
  box(1.25, 0.85, 1.7, skin, 0, -0.15, 1.5, head);
  box(1.8, 0.3, 0.5, dark, 0, 0.62, 0.55, head); // grumpy brow
  for (const s of [1, -1]) blob(0.2, 1, 1, 0.6, eye, s * 0.66, 0.3, 0.75, head);
  for (let t = 0; t < 4; t++) for (const s of [1, -1]) {
    const c = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.3, 4), teeth); c.rotation.x = Math.PI; c.position.set(s * 0.5, -0.65, 0.9 + t * 0.55); head.add(c);
  }
  const jaw = piv(0, -0.6, 0.35, head); K.jaw = jaw;
  box(1.15, 0.38, 2.3, belly, 0, -0.1, 1.05, jaw);
  K.mouth = piv(0, -0.45, 2.5, head);
  K.arms = [1, -1].map(s => {
    const p = piv(s * 1.95, 8.4, 1.0, body);
    const elbow = new V(s * 0.4, -1.3, 0.9), hand = new V(s * 0.5, -1.5, 2.2);
    limb(new V(0, 0, 0), elbow, 0.5, 0.4, skin, p); limb(elbow, hand, 0.4, 0.32, skin, p);
    for (const t of [-0.25, 0, 0.25]) { const c = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.45, 4), teeth); c.rotation.x = Math.PI / 2; c.position.set(hand.x + t, hand.y, hand.z + 0.3); p.add(c); }
    return p;
  });
  // tail: each piece hangs off the one before so it can sway like a whip
  let parent = piv(0, 4.9, -1.9, body), r = 1.35;
  for (let i = 0; i < 9; i++) {
    const seg = piv(0, 0, i ? -1.75 : 0, parent);
    blob(r, 1, 0.95, 1.4, i % 2 ? skin : dark, 0, 0, -0.9, seg);
    if (i < 7) plate(r * 0.9, 0, r * 0.85, -0.8, seg);
    K.tailSegs.push(seg); parent = seg; r *= 0.86;
  }
  const tip = new THREE.Mesh(new THREE.ConeGeometry(0.4, 1.6, 6), dark); tip.rotation.x = -Math.PI / 2; tip.position.z = -2; parent.add(tip);
  // the breath beam: a blue glow around a white-hot middle
  const beamGeo = new THREE.CylinderGeometry(1, 1, 1, 10, 1, true); beamGeo.rotateX(Math.PI / 2); beamGeo.translate(0, 0, 0.5);
  K.beam = new THREE.Mesh(beamGeo, new THREE.MeshBasicMaterial({ color: '#3fa9ff', transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false }));
  K.core = new THREE.Mesh(beamGeo, new THREE.MeshBasicMaterial({ color: '#e8f6ff', transparent: true, opacity: 0.95, depthWrite: false }));
  K.beam.visible = K.core.visible = false;
  scene.add(K.beam, K.core);
  g.scale.setScalar(KS); g.visible = false;
  scene.add(g);
  K.g = g;
}

function setKaiju(on) {
  const K = kaiju, P = player;
  if (on === K.on) return;
  if (on) {
    if (dragon.state === 'ride') hopOffDragon();
    if (dragon.state === 'come') { dragon.state = 'roam'; dragon.goalT = 0; }
    for (let s = 0; s < 2; s++) { const h = P.hooks[s]; h.state = 'none'; h.crook = null; h.rope.visible = h.claw.visible = false; holdSrc[s].clear(); }
    for (let i = crooks.length - 1; i >= 0; i--) removeCrook(i); // the crooks run and hide
    K.on = true; K.hp = 100; K.energy = 1; K.down = 0; K.punch = [0, 0]; K.tail = 0;
    puff(kv.a.copy(P.pos).setY(P.pos.y + 2), '#9be15d', 20, 3, 20);
    P.pos.y = 0; P.vel.set(0, 0, 0);
    K.yaw = camYaw + Math.PI; K.onGround = true; K.airT = 0;
    P.mesh.visible = false; K.g.visible = true;
    smashAround(P.pos, 18, 0, 100);
    camPitch = Math.max(camPitch, 0.05);
    SFX.bigRoar();
    showAlert(`🦖 You're ${NAMES.me}! Smash the city!`);
    toast(isTouch() ? '👊 Hook buttons punch · 🔵 breathes · ⤴ stomps · 🌀 tail spin · 🦍 🐲 pick a fight'
      : '👊 Clicks or Q / E punch · F atomic breath · Space stomp · Shift tail spin · 1 / 2 pick a fight', true);
  } else {
    K.on = false; K.g.visible = false; K.beam.visible = K.core.visible = false;
    if (foe.on) endFoe();
    P.mesh.visible = true; P.vel.set(0, 6, 0); P.pos.y = Math.max(P.pos.y, 0);
    restoreCity();
    collideBody(P.pos, P.vel, 0.4, 1.9);
    crimeT = 4;
    puff(kv.a.copy(P.pos).setY(P.pos.y + 2), '#9be15d', 20, 2, 12);
    toast('🔧 The Lab\'s robots rebuilt the whole city!');
    SFX.pass();
  }
  document.body.classList.toggle('monster', K.on);
  $('fight').hidden = !K.on;
  updateFightUI();
  updateGadgetUI();
  kaijuTouchLabels();
}
const toggleKaiju = () => { if (state === 'play') setKaiju(!kaiju.on); };

const TOUCH_KAIJU = { tHookL: '👊<small>Punch</small>', tHookR: '👊<small>Punch</small>', tJump: '⤴<small>Stomp</small>', tReel: '🌀<small>Tail</small>' };
const touchNormal = {};
function kaijuTouchLabels() {
  for (const id in TOUCH_KAIJU) {
    if (!(id in touchNormal)) touchNormal[id] = $(id).innerHTML;
    $(id).innerHTML = kaiju.on ? TOUCH_KAIJU[id] : touchNormal[id];
  }
}

// ---- Your attacks ----
function kaijuPunch(side) {
  const K = kaiju;
  if (K.down > 0 || K.punch[side] > 0 || K.tail > 0) return;
  K.punch[side] = 0.5; K.hit[side] = false;
  K.yaw = camYaw + Math.PI;
}
function punchHit(side) {
  const K = kaiju, P = player, fwd = fwdOf(K.yaw, kv.b);
  const off = side ? -13 : 13, fist = kv.c.set(P.pos.x + fwd.x * 35 + Math.cos(K.yaw) * off, P.pos.y + 62, P.pos.z + fwd.z * 35 - Math.sin(K.yaw) * off);
  SFX.punch(); K.shake = Math.max(K.shake, 0.35);
  // the fist sweeps down through anything in reach
  let n = 0;
  for (const y of [62, 40, 18]) { fist.y = P.pos.y + y; n += chopNear(fist, 20, 70, fwd); }
  if (n) floater(fist.setY(P.pos.y + 75), 'SMASH!', '#ffd23f');
  if (foe.on && foe.state !== 'down') {
    const c = foeCenter(kv.d);
    fist.y = clamp(c.y, P.pos.y + 12, P.pos.y + 75);
    if (fist.distanceTo(c) < foe.r + 25) hurtFoe(7, fwd);
  }
}
function tailHit() {
  const P = player;
  SFX.punch(); SFX.crash(); kaiju.shake = Math.max(kaiju.shake, 0.5);
  smashAround(P.pos, 70, P.pos.y, P.pos.y + 45);
  for (const p of peds) if (p.state === 'walk' && p.pos.distanceToSquared(P.pos) < 75 * 75) flingPed(p, kv.a.copy(p.pos).sub(P.pos).setY(0).normalize().multiplyScalar(22).setY(16));
  if (foe.on && foe.state !== 'down' && foe.pos.y < P.pos.y + 60 && Math.hypot(foe.pos.x - P.pos.x, foe.pos.z - P.pos.z) < foe.r + 70)
    hurtFoe(12, kv.b.copy(foe.pos).sub(P.pos).setY(0).normalize());
}
function stomp() {
  const P = player;
  SFX.stomp(); kaiju.shake = 1;
  smashAround(P.pos, 50, 0, P.pos.y + 45);
  for (let a = 0; a < 12; a++) puff(kv.a.set(P.pos.x + Math.cos(a / 12 * 6.28) * 34, 2, P.pos.z + Math.sin(a / 12 * 6.28) * 34), '#c9c1b3', 1, 7, 16);
  for (const p of peds) if (p.state === 'walk' && p.pos.distanceToSquared(P.pos) < 100 * 100) flingPed(p, kv.a.copy(p.pos).sub(P.pos).setY(0).normalize().multiplyScalar(14).setY(18));
  if (foe.on && foe.state !== 'down' && foe.pos.y < 30 && Math.hypot(foe.pos.x - P.pos.x, foe.pos.z - P.pos.z) < 95)
    hurtFoe(10, kv.b.copy(foe.pos).sub(P.pos).setY(0).normalize());
}

// the spot under the crosshair: the camera looks down past you, so this follows the camera, not camYaw / camPitch
function crosshairPoint(out) {
  const d = camera.getWorldDirection(kv.d);
  let t = 900;
  const h = rayCity(camera.position, d, t);
  if (h) t = h.t;
  if (foe.on && foe.state !== 'down') { const s = raySphere(camera.position, d, foeCenter(kv.e), foe.r); if (s >= 0 && s < t) t = s; }
  return out.copy(camera.position).addScaledVector(d, t);
}

// how far along a ray it meets a sphere (or -1)
function raySphere(o, d, c, r) {
  const v = kv.f.copy(c).sub(o), t = v.dot(d);
  if (t < 0) return -1;
  const d2 = v.lengthSq() - t * t;
  return d2 > r * r ? -1 : t - Math.sqrt(r * r - d2);
}

function updateBreath(dt) {
  const K = kaiju;
  if (K.energy <= 0) K.empty = true;
  if (K.empty && K.energy > 0.3) K.empty = false;
  K.breathing = inp.gadgetHeld && !K.empty && K.down <= 0 && K.tail <= 0;
  K.energy = clamp(K.energy + dt * (K.breathing ? -0.24 : 0.2), 0, 1);
  K.plateMat.emissive.setRGB(0.1, 0.45, 1).multiplyScalar(K.breathing ? 0.7 + Math.sin(performance.now() / 40) * 0.3 : Math.max(0, 1 - K.energy) * 0.15);
  K.beam.visible = K.core.visible = K.breathing;
  if (!K.breathing) return;
  K.yaw += angDiff(camYaw + Math.PI, K.yaw) * Math.min(1, dt * 8);
  K.g.updateMatrixWorld(true);
  const mouth = K.mouth.getWorldPosition(kv.a), fwd = fwdOf(K.yaw, kv.b);
  const dir = crosshairPoint(kv.aim).sub(mouth).normalize();
  if (dir.dot(fwd) < 0.25) dir.copy(fwd).setY(-0.15).normalize();
  let len = 700, k = -1;
  const h = rayCity(mouth, dir, len);
  if (h) { len = h.t; k = h.k; }
  let hitFoe = false;
  if (foe.on && foe.state !== 'down') {
    const t = raySphere(mouth, dir, foeCenter(kv.c), foe.r);
    if (t >= 0 && t < len) { len = t; hitFoe = true; k = -1; }
  }
  const wob = 1 + Math.sin(performance.now() / 30) * 0.15;
  K.beam.position.copy(mouth); K.beam.lookAt(kv.d.copy(mouth).add(dir)); K.beam.scale.set(7 * wob, 7 * wob, len);
  K.core.position.copy(mouth); K.core.quaternion.copy(K.beam.quaternion); K.core.scale.set(2.5, 2.5, len);
  const end = kv.e.copy(mouth).addScaledVector(dir, len);
  if (k >= 0) meltBox(k, 80 * dt);
  if (hitFoe) hurtFoe(12 * dt, dir, true);
  if ((K.beamFx -= dt) <= 0) {
    K.beamFx = 0.07;
    puff(end, Math.random() < 0.5 ? '#7cc8ff' : '#ffffff', 2, 4, 20);
    if (k !== -1) puff(end, Math.random() < 0.5 ? '#ff8a2a' : '#3d3d3d', 2, 5, 14);
    scareNear(end, 50);
  }
  if ((K.beamSnd -= dt) <= 0) { K.beamSnd = 0.12; SFX.beam(); }
}

function hurtKaiju(n, dir) {
  const K = kaiju, P = player;
  if (K.down > 0 || !K.on) return;
  K.hp -= n; K.calm = 0; K.shake = Math.max(K.shake, Math.min(1, n / 10)); K.hurtT = 0.25;
  if (dir) { P.vel.x += dir.x * n * 2.2; P.vel.z += dir.z * n * 2.2; }
  if (n >= 3) { SFX.ouch(); floater(kv.a.copy(P.pos).setY(P.pos.y + 100), `-${Math.round(n)}`, '#ff5a5a'); }
  if (K.hp <= 0) {
    K.hp = 0; K.down = 4;
    SFX.bigRoar();
    showAlert(`😵 ${NAMES.me} got knocked down!`);
  }
  updateFightUI();
}

// ---- moving around ----
function updateKaiju(dt) {
  const K = kaiju, P = player;
  K.shake = Math.max(0, K.shake - dt * 2.2);
  K.hurtT -= dt;
  for (let s = 0; s < 2; s++) {
    if (K.punch[s] <= 0) continue;
    K.punch[s] -= dt;
    if (!K.hit[s] && K.punch[s] < 0.33) { K.hit[s] = true; punchHit(s); }
  }
  const reel = inp.reel;
  if (reel && !K.lastReel && K.tail <= 0 && K.down <= 0) { K.tail = 0.9; K.tailHit = false; SFX.flap(); }
  K.lastReel = reel;
  if (K.tail > 0) { K.tail -= dt; if (!K.tailHit && K.tail < 0.45) { K.tailHit = true; tailHit(); } }

  if (K.down > 0) {
    K.down -= dt;
    P.vel.multiplyScalar(1 - Math.min(1, dt * 3));
    if (K.down <= 0) { K.hp = 100; SFX.bigRoar(); toast(`💪 ${NAMES.me} gets back up!`, true); updateFightUI(); }
  } else {
    const f = kv.a.set(-Math.sin(camYaw), 0, -Math.cos(camYaw)), r = kv.b.set(Math.cos(camYaw), 0, -Math.sin(camYaw));
    const wish = kv.c.set(0, 0, 0).addScaledVector(f, inp.mz).addScaledVector(r, inp.mx);
    if (wish.lengthSq() > 1) wish.normalize();
    const pushing = smashAround(P.pos, 15, P.pos.y, P.pos.y + 90);
    const top = 30 * (pushing ? 0.5 : 1) * (K.breathing ? 0.35 : 1);
    const k = Math.min(1, (K.onGround ? 5 : 1.2) * dt);
    P.vel.x += (wish.x * top - P.vel.x) * k;
    P.vel.z += (wish.z * top - P.vel.z) * k;
    if (inp.jump && K.onGround) { P.vel.y = 38; K.onGround = false; K.airT = 0; SFX.flap(); }
    // face where you're going (or where you're aiming)
    const hsp = Math.hypot(P.vel.x, P.vel.z);
    if (K.punch[0] > 0 || K.punch[1] > 0 || K.breathing) K.yaw += angDiff(camYaw + Math.PI, K.yaw) * Math.min(1, dt * 8);
    else if (hsp > 2 && wish.lengthSq() > 0.01) K.yaw += angDiff(Math.atan2(P.vel.x, P.vel.z), K.yaw) * Math.min(1, dt * 4);
    if ((K.calm += dt) > 4) K.hp = Math.min(100, K.hp + dt * 4);
  }
  if (!K.onGround) { P.vel.y -= 50 * dt; K.airT += dt; }
  P.pos.addScaledVector(P.vel, dt);
  if (P.pos.y <= 0) {
    P.pos.y = 0;
    if (!K.onGround) { K.onGround = true; if (K.airT > 0.3) stomp(); }
    P.vel.y = 0;
  }
  if (Math.abs(P.pos.x) > LIMIT) { P.pos.x = Math.sign(P.pos.x) * LIMIT; P.vel.x = 0; }
  if (Math.abs(P.pos.z) > LIMIT) { P.pos.z = Math.sign(P.pos.z) * LIMIT; P.vel.z = 0; }
  // can't walk through a monster on the ground
  if (foe.on && foe.pos.y < 30 && foe.state !== 'down') {
    const dx = P.pos.x - foe.pos.x, dz = P.pos.z - foe.pos.z, d = Math.hypot(dx, dz);
    if (d < 45 && d > 0.01) { P.pos.x += dx / d * (45 - d); P.pos.z += dz / d * (45 - d); }
  }
  if ((K.scareT -= dt) <= 0) { K.scareT = 0.5; scareNear(P.pos, 80); }

  updateBreath(dt);
  poseKaiju(dt);
  updateFoe(dt);
  updateFightUI();
}

function poseKaiju(dt) {
  const K = kaiju, P = player, g = K.g;
  const hsp = Math.hypot(P.vel.x, P.vel.z);
  K.phase += dt * (K.onGround ? hsp * 0.075 : 0);
  const sw = Math.sin(K.phase) * Math.min(1, hsp / 12) * 0.5;
  K.legs[0].rotation.x = K.onGround ? sw : -0.4; K.legs[1].rotation.x = K.onGround ? -sw : 0.2;
  // a thud on every step
  const step = Math.floor(K.phase / Math.PI);
  if (step !== K.lastStep && K.onGround && hsp > 4) {
    K.lastStep = step; K.shake = Math.max(K.shake, 0.18);
    if (P.pos.distanceTo(camera.position) < 300) SFX.step();
    const s = step & 1 ? 1 : -1;
    puff(kv.a.set(P.pos.x + Math.cos(K.yaw) * s * 11, 1, P.pos.z - Math.sin(K.yaw) * s * 11), '#c9c1b3', 2, 5, 12);
  }
  for (let s = 0; s < 2; s++) {
    const p = K.punch[s], arm = K.arms[s];
    // wind back, then swing hard forward
    const k = p > 0 ? 1 - p / 0.5 : 0;
    arm.rotation.x = p > 0 ? (k < 0.35 ? lerp(0, 0.6, k / 0.35) : lerp(0.6, -1.5, Math.min(1, (k - 0.35) / 0.2))) : (K.onGround ? -sw * 0.6 : -0.8);
    arm.rotation.z = p > 0 && k > 0.35 ? (s ? 0.5 : -0.5) : 0;
  }
  const t = performance.now() / 1000;
  K.tailSegs.forEach((seg, i) => { seg.rotation.y = Math.sin(t * 1.6 - i * 0.6) * 0.1 + (K.tail > 0 ? Math.sin((0.9 - K.tail) * 7) * 0.2 : 0); seg.rotation.x = 0.06 + i * 0.012; });
  K.jaw.rotation.x = K.breathing ? 0.5 : K.down > 0 ? 0.35 : 0.05;
  K.head.rotation.x = K.breathing ? -clamp(camPitch, -0.4, 0.5) * 0.6 : 0;
  K.head.visible = !firstPerson;
  K.body.rotation.x = 0.1 + (K.punch[0] > 0 || K.punch[1] > 0 ? 0.12 : 0);
  const spin = K.tail > 0 ? (1 - K.tail / 0.9) * Math.PI * 2 : 0;
  g.position.copy(P.pos); g.position.y += K.onGround ? Math.abs(Math.cos(K.phase)) * 1 : 0;
  // knocked down: fall over backward and lie there a moment
  const fall = K.down > 0 ? Math.min(1, (4 - K.down) * 2) * (K.down < 0.6 ? K.down / 0.6 : 1) : 0;
  g.rotation.set(-fall * 1.4, K.yaw + spin, 0);
  g.updateMatrixWorld(true);
}

function kaijuCamera() {
  const K = kaiju, P = player;
  const F = dirFrom(camYaw, camPitch, camT.f);
  const sh = K.shake * 1.4;
  if (firstPerson) {
    K.head.getWorldPosition(camera.position);
    camera.position.addScaledVector(fwdOf(K.yaw, kv.a), 22).y += 8; // out past the snout
    camera.lookAt(kv.a.copy(camera.position).add(F));
  } else {
    // up high over your shoulder, looking down past you, so buildings don't hide the fight
    const target = camT.t.copy(P.pos); target.y += 70;
    target.x += Math.cos(camYaw) * 50; target.z -= Math.sin(camYaw) * 50; // over the right shoulder, so you can see what you aim at
    const back = camT.b.copy(F).negate(); back.y += 0.55; back.normalize();
    camera.position.copy(target).addScaledVector(back, 145);
    if (camera.position.y < 3) camera.position.y = 3;
    camera.lookAt(kv.a.copy(target).addScaledVector(F, 110));
  }
  const s = kv.b.set(rand(-sh, sh), rand(-sh, sh), rand(-sh, sh));
  camera.position.add(s);
}

// ---- The monsters you fight ----
function makeApe() {
  const fur = lam('#4a3424'), face = lam('#c9a27e'), dark = lam('#24180f'), white = lam('#fff8e0'), red = lam('#ff5a3a', '#6a1000');
  const g = new THREE.Group(); g.rotation.order = 'YXZ';
  const { blob, box, limb, piv } = kit(g), m = { g };
  m.legs = [1, -1].map(s => {
    const p = piv(s * 1.15, 3.1, 0);
    blob(1, 0.95, 1.7, 0.95, fur, 0, -1.2, 0, p);
    box(1.2, 0.55, 1.8, dark, 0, -2.85, 0.4, p);
    return p;
  });
  m.body = piv(0, 0, 0);
  blob(1, 2.6, 2.9, 2.0, fur, 0, 5.6, 0, m.body);
  blob(1, 1.8, 1.9, 0.8, face, 0, 6.1, 1.45, m.body);
  blob(1, 3.2, 1.4, 1.9, fur, 0, 7.7, -0.2, m.body);
  const head = piv(0, 9.0, 0.6, m.body); m.head = head;
  blob(1.2, 1, 1, 1, fur, 0, 0, 0, head);
  blob(0.95, 1.1, 0.95, 0.65, face, 0, -0.2, 0.75, head);
  box(2.0, 0.38, 0.55, dark, 0, 0.42, 0.95, head);
  for (const s of [1, -1]) { blob(0.2, 1, 1, 0.5, white, s * 0.4, 0.12, 1.2, head); blob(0.1, 1, 1, 0.5, red, s * 0.4, 0.12, 1.3, head); }
  m.mouth = box(0.9, 0.18, 0.25, dark, 0, -0.62, 1.3, head);
  m.arms = [1, -1].map(s => {
    const p = piv(s * 2.8, 7.6, 0.1, m.body);
    const elbow = new V(s * 0.5, -3, 0), wrist = new V(s * 0.6, -5.6, 0.3);
    limb(new V(0, 0, 0), elbow, 0.85, 0.7, fur, p); limb(elbow, wrist, 0.7, 0.6, fur, p);
    blob(0.9, 1, 0.9, 1, dark, wrist.x, -6.0, 0.4, p);
    return p;
  });
  g.scale.setScalar(8); g.visible = false; scene.add(g);
  return m;
}

function makeHydra() {
  const gold = lam('#e8b62c'), goldDk = lam('#a87a12'), belly = lam('#f7e08a'), horn = lam('#fff3d0'), eye = lam('#ff3b3b', '#800000');
  const wingMat = new THREE.MeshLambertMaterial({ color: '#d19a1f', side: THREE.DoubleSide });
  const g = new THREE.Group(); g.rotation.order = 'YXZ';
  const { blob, box, limb, piv } = kit(g), m = { g, necks: [], jaws: [], mouths: [], wings: [], tails: [] };
  blob(1, 2.6, 2.3, 5, gold, 0, 0, 0);
  blob(1, 2.1, 1.7, 4.2, belly, 0, -0.7, 0.3);
  for (let i = -1; i <= 1; i++) {
    const n = piv(i * 1.4, 1.2, 3.6);
    for (let k = 1; k <= 4; k++) blob(0.8 - k * 0.05, 1, 1, 1.2, k % 2 ? gold : goldDk, i * 0.55 * k, 1.25 * k, 1.0 * k, n);
    const head = piv(i * 0.55 * 5, 6.4, 5.4, n);
    box(1.5, 1.1, 2.0, gold, 0, 0, 0, head);
    box(1.1, 0.7, 1.6, gold, 0, -0.1, 1.6, head);
    for (const s of [1, -1]) {
      blob(0.18, 1, 1, 0.6, eye, s * 0.6, 0.25, 0.8, head);
      limb(new V(s * 0.5, 0.5, -0.5), new V(s * 0.9, 1.9, -2.2), 0.22, 0.04, horn, head);
    }
    const jaw = piv(0, -0.5, 0.4, head); box(1.0, 0.3, 2.2, belly, 0, 0, 1.0, jaw);
    m.necks.push(n); m.jaws.push(jaw); m.mouths.push(piv(0, -0.3, 2.5, head));
  }
  for (const s of [1, -1]) {
    let parent = piv(s * 0.9, 0.1, -4.6), r = 1.1;
    const segs = [];
    for (let i = 0; i < 7; i++) { const seg = piv(0, 0, i ? -1.6 : 0, parent); blob(r, 1, 0.9, 1.4, i % 2 ? gold : goldDk, 0, 0, -0.8, seg); segs.push(seg); parent = seg; r *= 0.84; }
    const spike = new THREE.Mesh(new THREE.ConeGeometry(0.7, 1.8, 4), horn); spike.rotation.x = -Math.PI / 2; spike.position.z = -1.8; parent.add(spike);
    m.tails.push({ segs, s });
    for (const z of [2.6, -2.8]) limb(new V(s * 1.8, -1.2, z), new V(s * 2.0, -3.0, z - 1.8), 0.6, 0.4, gold);
  }
  const shape = new THREE.Shape();
  [[0, 3], [7, 4.2], [15, 1.2], [12.5, -1.2], [9.5, -0.4], [7.5, -4.2], [4, -2.2], [0, -4]].forEach(([x, y], i) => i ? shape.lineTo(x, y) : shape.moveTo(x, y));
  for (const s of [1, -1]) {
    const p = piv(s * 2.2, 1.5, 1.0);
    const geo = new THREE.ShapeGeometry(shape); geo.rotateX(Math.PI / 2); geo.scale(s, 1, 1);
    p.add(new THREE.Mesh(geo, wingMat));
    limb(new V(0, 0, 3), new V(s * 7, 0, 4.2), 0.45, 0.3, goldDk, p);
    limb(new V(s * 7, 0, 4.2), new V(s * 15, 0, 1.2), 0.3, 0.08, goldDk, p);
    m.wings.push({ p, s });
  }
  g.scale.setScalar(6.5); g.visible = false; scene.add(g);
  return m;
}

const FOES = {
  ape: { name: NAMES.ape, icon: '🦍', hp: 260, r: 30, cy: 45 },
  hydra: { name: NAMES.hydra, icon: '🐲', hp: 220, r: 32, cy: 0 },
};
function foeCenter(out) { return out.copy(foe.pos).setY(foe.pos.y + FOES[foe.kind].cy); }

function summonFoe(kind) {
  if (state !== 'play' || !kaiju.on) return;
  if (foe.on) { toast(`Beat ${FOES[foe.kind].name} first!`); return; }
  const F = FOES[kind], P = player;
  if (!foe.models[kind]) foe.models[kind] = kind === 'ape' ? makeApe() : makeHydra();
  Object.assign(foe, { on: true, kind, hp: F.hp, max: F.hp, r: F.r, t: 0, cd: 2, leapCd: 5, anim: 0, flinch: 0, fall: 0, m: foe.models[kind] });
  foe.m.g.visible = true; foe.m.g.rotation.set(0, 0, 0);
  // show up in front of you, where you can see it coming
  const f = fwdOf(camYaw + Math.PI, kv.a);
  if (kind === 'ape') {
    foe.pos.set(P.pos.x + f.x * 260, 380, P.pos.z + f.z * 260); foe.vel.set(0, -30, 0); foe.state = 'drop';
    showAlert(`🦍 ${NAMES.ape} is dropping in!`); SFX.apeRoar();
  } else {
    foe.pos.set(P.pos.x + f.x * 500, 200, P.pos.z + f.z * 500); foe.vel.set(-f.x * 55, 0, -f.z * 55); foe.state = 'fly'; foe.orbit = Math.atan2(f.z, f.x);
    showAlert(`🐲 ${NAMES.hydra} is flying in!`); SFX.hydraCry();
  }
  foe.pos.x = clamp(foe.pos.x, -LIMIT + 40, LIMIT - 40); foe.pos.z = clamp(foe.pos.z, -LIMIT + 40, LIMIT - 40);
  foe.yaw = Math.atan2(P.pos.x - foe.pos.x, P.pos.z - foe.pos.z);
  updateFightUI();
}
function endFoe() {
  foe.on = false;
  if (foe.m) foe.m.g.visible = false;
  updateFightUI();
}

function hurtFoe(n, dir, quiet) {
  if (!foe.on || foe.state === 'down') return;
  foe.hp -= n;
  if (!quiet) {
    foe.flinch = 0.35;
    if (dir) { foe.vel.x += dir.x * n * 2; foe.vel.z += dir.z * n * 2; }
    floater(foeCenter(kv.a).setY(kv.a.y + 30), pick(['POW!', 'BAM!', 'WHAM!', 'BOOM!']) + ` -${Math.round(n)}`, '#ffd23f');
    SFX.punch();
  } else if (++foe.tick % 15 === 0) floater(foeCenter(kv.a).setY(kv.a.y + 30), 'ZAP!', '#7cc8ff');
  if (foe.hp <= 0) {
    foe.hp = 0; foe.state = 'down'; foe.t = 0;
    foe.vel.set(0, 0, 0);
    const pay = foe.kind === 'ape' ? 400 : 500;
    save.stats.kaijuWins = (save.stats.kaijuWins || 0) + 1;
    SFX.win();
    if (foe.kind === 'ape') SFX.apeRoar(); else SFX.hydraCry();
    showAlert(`🏆 ${NAMES.me} beat ${FOES[foe.kind].name}!`);
    addCash(pay, kv.a.copy(player.pos).setY(70), `You win! +$${pay}`);
    persist();
  }
  updateFightUI();
}

function updateFoe(dt) {
  if (!foe.on) return;
  const P = player, F = foe, m = F.m;
  F.t += dt; F.anim += dt; F.cd -= dt; F.leapCd -= dt;
  F.flinch = Math.max(0, F.flinch - dt);
  const to = kv.a.set(P.pos.x - F.pos.x, 0, P.pos.z - F.pos.z), dist = to.length();
  to.multiplyScalar(1 / (dist || 1));
  if (F.kind === 'ape') updateApe(dt, to, dist); else updateHydra(dt, to, dist);
  F.pos.x = clamp(F.pos.x, -LIMIT, LIMIT); F.pos.z = clamp(F.pos.z, -LIMIT, LIMIT);
  m.g.position.copy(F.pos);
  m.g.updateMatrixWorld(true);
  if (F.state === 'down' && F.t > 6) endFoe();
}

function updateApe(dt, to, dist) {
  const F = foe, m = F.m, P = player;
  let walk = 0, armL = null, armR = null, roar = false;
  const faceYou = () => { F.yaw += angDiff(Math.atan2(to.x, to.z), F.yaw) * Math.min(1, dt * 4); };
  F.vel.x *= 1 - Math.min(1, dt * 3); F.vel.z *= 1 - Math.min(1, dt * 3);
  if (F.state === 'drop' || F.state === 'leap') {
    F.vel.y -= 45 * dt;
    if (F.state === 'leap') { armL = armR = -2.8; } else { armL = armR = -2.4; }
    F.pos.addScaledVector(F.vel, dt);
    smashAround(F.pos, 16, F.pos.y, F.pos.y + 75);
    if (F.pos.y <= 0) {
      F.pos.y = 0; F.vel.set(0, 0, 0);
      SFX.stomp(); kaiju.shake = Math.max(kaiju.shake, 0.8);
      smashAround(F.pos, 50, 0, 60);
      for (let a = 0; a < 10; a++) puff(kv.b.set(F.pos.x + Math.cos(a) * 32, 2, F.pos.z + Math.sin(a) * 32), '#c9c1b3', 1, 7, 16);
      if (dist < 80) hurtKaiju(10, kv.b.copy(to));
      F.state = F.state === 'drop' ? 'roar' : 'walk'; F.t = 0; F.leapCd = rand(6, 10);
    }
  } else if (F.state === 'roar') {
    faceYou(); roar = true;
    const beat = Math.sin(F.t * 14) > 0;
    armL = beat ? -1.4 : -0.9; armR = beat ? -0.9 : -1.4;
    if (F.t < 0.05) SFX.apeRoar();
    if (F.t > 1.8) { F.state = 'walk'; F.t = 0; }
  } else if (F.state === 'punch') {
    faceYou();
    const k = F.t / 0.75, a = k < 0.5 ? lerp(0, 0.8, k / 0.5) : lerp(0.8, -1.6, Math.min(1, (k - 0.5) / 0.15));
    if (F.side) armR = a; else armL = a;
    if (!F.hitDone && k > 0.6) {
      F.hitDone = true;
      chopNear(kv.b.copy(F.pos).addScaledVector(fwdOf(F.yaw, kv.c), 32).setY(48), 18, 60, kv.c);
      SFX.punch();
      if (dist < 72 && P.pos.y < 60) hurtKaiju(6, kv.b.copy(to));
    }
    if (k >= 1) { F.state = 'walk'; F.t = 0; F.cd = rand(0.7, 1.6); }
  } else if (F.state === 'walk') {
    faceYou();
    if (F.flinch <= 0 && kaiju.down <= 0) {
      if (dist > 55) { F.pos.addScaledVector(to, 24 * dt); walk = 1; }
      smashAround(F.pos, 16, 0, 75);
      if (dist < 64 && F.cd <= 0) { F.state = 'punch'; F.t = 0; F.side = 1 - F.side; F.hitDone = false; }
      else if (dist > 150 && F.leapCd <= 0) {
        // a giant leap: land just short of you
        const T = 1.9, land = Math.max(0, dist - 60);
        F.vel.set(to.x * land / T, 45 * T / 2, to.z * land / T);
        F.state = 'leap'; F.t = 0; SFX.apeRoar();
      } else if (dist > 110 && F.cd <= 0 && Math.random() < dt * 0.15) { F.state = 'roar'; F.t = 0; F.cd = 3; }
    }
  } else if (F.state === 'down') {
    F.fall = Math.min(1, F.t);
    if (F.t < 1 && F.t + dt >= 1) {
      SFX.stomp(); kaiju.shake = Math.max(kaiju.shake, 0.8);
      smashAround(kv.b.copy(F.pos).addScaledVector(fwdOf(F.yaw, kv.c), -40), 35, 0, 50);
    }
    if (F.t > 4) F.pos.y -= dt * 18; // sinks away
    armL = armR = -2.8; roar = true;
  }
  F.pos.x += F.vel.x * dt; F.pos.z += F.vel.z * dt;
  // pose
  F.phase += dt * walk * 2.6;
  const sw = Math.sin(F.phase) * 0.5 * walk;
  m.legs[0].rotation.x = sw; m.legs[1].rotation.x = -sw;
  m.arms[0].rotation.x = armL !== null ? armL : -sw * 0.8;
  m.arms[1].rotation.x = armR !== null ? armR : sw * 0.8;
  m.arms[0].rotation.z = F.state === 'roar' ? 0.5 : 0; m.arms[1].rotation.z = F.state === 'roar' ? -0.5 : 0;
  m.head.rotation.x = roar ? -0.35 : 0;
  m.mouth.scale.y = roar ? 4 : 1;
  m.body.rotation.x = 0.15 + F.flinch * -0.8;
  m.g.rotation.set(-F.fall * Math.PI / 2, F.yaw, 0);
}

function updateHydra(dt, to, dist) {
  const F = foe, m = F.m, P = player;
  let open = false, flapSp = 4;
  const chest = kv.d.copy(P.pos).setY(P.pos.y + 52);
  const steer = (tgt, speed, rate) => { F.vel.lerp(kv.b.copy(tgt).sub(F.pos).normalize().multiplyScalar(speed), Math.min(1, rate * dt)); };
  if (F.state === 'fly') {
    // circle around you, then attack
    F.orbit += dt * 0.35;
    steer(kv.c.set(P.pos.x + Math.cos(F.orbit) * 210, 140, P.pos.z + Math.sin(F.orbit) * 210), 65, 1.2);
    if (F.cd <= 0 && dist < 380 && kaiju.down <= 0) {
      F.t = 0;
      if (Math.random() < 0.6) { F.state = 'zap'; F.zapT = 0.4; SFX.hydraCry(); } else { F.state = 'swoop'; SFX.hydraCry(); }
    }
  } else if (F.state === 'zap') {
    // hover and shoot lightning from all three mouths
    const away = kv.c.copy(F.pos).sub(P.pos).setY(0).normalize();
    steer(kv.e.copy(P.pos).addScaledVector(away, 170).setY(110), 25, 2);
    open = true; flapSp = 6;
    if ((F.zapT -= dt) <= 0 && F.t > 0.5) {
      F.zapT = 0.14;
      F.zapHead = (F.zapHead + 1) % 3;
      const from = m.mouths[F.zapHead].getWorldPosition(kv.e);
      const miss = kv.f.set(rand(-1, 1), rand(-1, 1), rand(-1, 1)).multiplyScalar(20);
      const tgt = kv.c.copy(chest).add(miss);
      const dir = tgt.clone().sub(from); const L = dir.length(); dir.multiplyScalar(1 / L);
      const h = rayCity(from, dir, L);
      if (h) { tgt.copy(h.p); if (h.k >= 0) chopBox(h.k, 25, dir); }
      else if (miss.length() < 16) hurtKaiju(1.3, kv.f.copy(dir).setY(0).normalize());
      bolt(from, tgt);
      if (from.distanceTo(camera.position) < 400) SFX.zap();
    }
    if (F.t > 2.4) { F.state = 'fly'; F.t = 0; F.cd = rand(2.5, 4.5); }
  } else if (F.state === 'swoop') {
    steer(chest, 100, 2.5); flapSp = 2; open = true;
    if (F.pos.distanceTo(chest) < 42) {
      hurtKaiju(8, kv.c.copy(to).negate());
      F.state = 'climb'; F.t = 0; SFX.hydraCry();
    }
    if (F.t > 5) { F.state = 'climb'; F.t = 0; }
  } else if (F.state === 'climb') {
    F.vel.y += 55 * dt; flapSp = 7;
    if (F.t > 1.6) { F.state = 'fly'; F.t = 0; F.cd = rand(2.5, 4); F.orbit = Math.atan2(F.pos.z - P.pos.z, F.pos.x - P.pos.x); }
  } else if (F.state === 'down') {
    F.vel.x *= 1 - Math.min(1, dt); F.vel.z *= 1 - Math.min(1, dt);
    if (F.pos.y > 0.5) { F.vel.y -= 30 * dt; flapSp = 0.5; }
    else if (F.fall === 0) {
      F.fall = 1; F.vel.set(0, 0, 0); F.pos.y = 0;
      SFX.stomp(); kaiju.shake = Math.max(kaiju.shake, 0.8);
      smashAround(F.pos, 45, 0, 45);
      puff(kv.c.copy(F.pos).setY(4), '#c9c1b3', 10, 9, 22);
    } else flapSp = 0;
    if (F.t > 4.5) F.pos.y -= dt * 15;
  }
  if (F.flinch > 0) F.vel.multiplyScalar(1 - Math.min(1, dt * 4));
  F.pos.addScaledVector(F.vel, dt);
  if (F.state !== 'down') {
    if (F.pos.y < 45) { F.pos.y = 45; F.vel.y = Math.max(F.vel.y, 0); }
    if (F.pos.y > 300) { F.pos.y = 300; F.vel.y = Math.min(F.vel.y, 0); }
    smashAround(F.pos, 18, F.pos.y - 16, F.pos.y + 16); // flies right through buildings
  }
  // pose: face where it's going (or at you while zapping)
  const hsp = Math.hypot(F.vel.x, F.vel.z);
  const want = F.state === 'zap' ? Math.atan2(to.x, to.z) : hsp > 2 ? Math.atan2(F.vel.x, F.vel.z) : F.yaw;
  F.yaw += angDiff(want, F.yaw) * Math.min(1, dt * (F.state === 'zap' ? 4 : 3));
  F.phase += dt * flapSp;
  const flap = F.state === 'down' && F.fall ? 0.3 : Math.sin(F.phase) * 0.55;
  for (const w of m.wings) w.p.rotation.z = w.s * (flap + 0.1);
  m.necks.forEach((n, i) => { n.rotation.y = Math.sin(F.anim * 1.3 + i * 2) * 0.15; n.rotation.x = Math.sin(F.anim * 1.7 + i) * 0.08 + (F.state === 'down' && F.fall ? 0.6 : 0); });
  m.jaws.forEach((j, i) => { j.rotation.x = open || F.state === 'down' ? 0.5 + Math.sin(F.anim * 20 + i) * 0.1 : 0.05; });
  for (const tl of m.tails) tl.segs.forEach((seg, i) => { seg.rotation.y = tl.s * 0.08 + Math.sin(F.anim * 2 - i * 0.7) * 0.15; });
  const pitch = F.state === 'down' ? 0 : clamp(Math.atan2(F.vel.y, hsp + 1), -0.6, 0.6);
  m.g.rotation.set(-pitch, F.yaw, 0);
}

// a crackly yellow lightning bolt from a to b
const boltGeo = new THREE.CylinderGeometry(1, 1, 1, 5); boltGeo.rotateX(Math.PI / 2); boltGeo.translate(0, 0, 0.5);
function bolt(a, b) {
  const mat = new THREE.MeshBasicMaterial({ color: '#fff27a', transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false });
  mat.userData.fxOwned = true;
  const g = new THREE.Group();
  let p = a.clone();
  const n = 7;
  for (let i = 1; i <= n; i++) {
    const q = a.clone().lerp(b, i / n);
    if (i < n) q.add(new V(rand(-1, 1), rand(-1, 1), rand(-1, 1)).multiplyScalar(7));
    const s = new THREE.Mesh(boltGeo, mat);
    s.position.copy(p); s.lookAt(q); s.scale.set(2.2, 2.2, p.distanceTo(q));
    g.add(s); p = q;
  }
  addFx(g, 0.25, (e, k) => { mat.opacity = 1 - k; });
  puff(b, '#fff27a', 2, 4, 14);
}

// ---- Fight HUD ----
function updateFightUI() {
  if (!kaiju.on) return;
  $('hpMe').style.width = kaiju.hp.toFixed(1) + '%';
  $('hpMe').classList.toggle('low', kaiju.hp < 30);
  $('foeRow').hidden = !foe.on;
  if (foe.on) {
    $('foeName').textContent = `${FOES[foe.kind].icon} ${FOES[foe.kind].name}`;
    $('hpFoe').style.width = (foe.hp / foe.max * 100).toFixed(1) + '%';
  }
}
