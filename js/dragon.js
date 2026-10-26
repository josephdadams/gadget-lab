'use strict';
// The dragon: a giant friendly dragon that flies around the buildings. Call it and it swoops down to pick you up,
// then you fly it around and breathe fire on crooks.
const dragon = {
  state: 'roam', // roam | come | ride
  pos: new V(), vel: new V(0, 0, 20), yaw: 0, pitch: 0, roll: 0, flap: 0, flapBoost: 0, t: 0,
  goal: new V(), goalT: 0, comeT: 0, fireT: 0, fireSnd: 0, smokeT: 0, breathing: false, showFireT: 8, roarCd: 0,
  g: null, wings: [], tail: [], head: null, jaw: null, mouth: null, saddle: null,
};
const dv = { a: new V(), b: new V(), c: new V(), d: new V(), e: new V(), aim: new V() };

function makeDragon() {
  const L = (c, e) => new THREE.MeshLambertMaterial({ color: c, emissive: e || '#000000' });
  const scales = L('#c8382c'), belly = L('#f3c05a'), dark = L('#7c1c16'), horn = L('#f5ecd2'), eye = L('#ffe14d', '#b88a00');
  const wingMat = new THREE.MeshLambertMaterial({ color: '#9b241c', side: THREE.DoubleSide });
  const saddleMat = L('#ff8a2a'), strap = L('#24303f');
  const g = new THREE.Group(); g.rotation.order = 'YXZ'; // the model faces +z, so its left is +x
  const blob = (r, sx, sy, sz, m, x, y, z, parent = g) => {
    const o = new THREE.Mesh(new THREE.SphereGeometry(r, 14, 10), m); o.scale.set(sx, sy, sz); o.position.set(x, y, z); parent.add(o); return o;
  };
  const box = (w, h, d, m, x, y, z, parent = g) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y, z); parent.add(o); return o; };
  // a stick from a to b (bones, legs, horns)
  const limb = (a, b, r0, r1, m, parent = g) => {
    const len = a.distanceTo(b);
    const o = new THREE.Mesh(new THREE.CylinderGeometry(r1, r0, len, 7), m);
    o.position.copy(a).add(b).multiplyScalar(0.5);
    o.quaternion.setFromUnitVectors(UP, dv.a.copy(b).sub(a).normalize());
    parent.add(o); return o;
  };

  blob(1, 3.2, 2.8, 7, scales, 0, 0, 0);            // body
  blob(1, 2.7, 2.2, 6, belly, 0, -0.75, 0.3);       // belly
  for (let i = 0; i < 6; i++) {                      // spikes down the back
    const s = new THREE.Mesh(new THREE.ConeGeometry(0.55, 1.5, 5), horn);
    s.position.set(0, 2.75 - Math.abs(i - 2) * 0.12, -5 + i * 1.6 - (i > 1 ? 3.2 : 0)); s.rotation.x = -0.35; g.add(s);
    if (i > 1 && i < 4) s.visible = false;           // no spikes where you sit
  }
  // the Lab saddle, so you have somewhere to sit
  box(2.2, 0.5, 2.6, saddleMat, 0, 2.75, 2.0);
  box(0.5, 0.9, 0.4, saddleMat, 0, 3.2, 3.2);        // a handle to hang on to
  box(3.4, 0.25, 0.5, strap, 0, 2.3, 2.0);
  dragon.saddle = new THREE.Object3D(); dragon.saddle.position.set(0, 2.15, 1.7); g.add(dragon.saddle);

  // neck and head
  for (let i = 0; i < 3; i++) blob(1.55 - i * 0.12, 1, 1, 1.25, scales, 0, 1.3 + i * 1.2, 6.2 + i * 1.7);
  const head = new THREE.Group(); head.position.set(0, 5.2, 11.6); g.add(head);
  box(2.6, 2.1, 3.0, scales, 0, 0, 0, head);
  box(2.0, 1.2, 2.8, scales, 0, -0.25, 2.6, head);   // snout
  box(1.6, 0.25, 0.25, dark, 0, 0.36, 3.95, head);   // nostrils
  const jaw = new THREE.Group(); jaw.position.set(0, -0.85, 0.6); head.add(jaw);
  box(1.8, 0.45, 3.2, belly, 0, 0, 1.6, jaw);
  for (const s of [1, -1]) {
    blob(0.32, 1, 1, 0.6, eye, s * 1.0, 0.45, 1.25, head);
    box(0.7, 0.18, 0.5, dark, s * 1.0, 0.82, 1.2, head); // grumpy eyebrows
    limb(new V(s * 0.8, 0.9, -0.6), new V(s * 1.5, 2.2, -2.6), 0.32, 0.05, horn, head);
    limb(new V(s * 1.25, 0.1, -0.9), new V(s * 2.1, 0.5, -2.2), 0.2, 0.03, horn, head);
  }
  dragon.mouth = new THREE.Object3D(); dragon.mouth.position.set(0, -0.6, 4.2); head.add(dragon.mouth);
  dragon.head = head; dragon.jaw = jaw;

  // tail: each piece hangs off the one before, so it waves like a whip
  let parent = g, r = 1.7;
  for (let i = 0; i < 8; i++) {
    const seg = new THREE.Group(); seg.position.set(0, i ? 0 : 0.2, i ? -2.1 : -6.2); parent.add(seg);
    blob(r, 1, 0.9, 1.5, i % 2 ? scales : dark, 0, 0, -1, seg);
    dragon.tail.push(seg); parent = seg; r *= 0.83;
  }
  const spade = new THREE.Mesh(new THREE.ConeGeometry(1.1, 2.4, 4), dark);
  spade.rotation.x = -Math.PI / 2; spade.scale.set(1, 1, 0.25); spade.position.z = -2.6; parent.add(spade);

  // wings
  const shape = new THREE.Shape();
  [[0, 3], [7, 4.2], [15, 1.2], [12.5, -1.2], [9.5, -0.4], [7.5, -4.2], [4, -2.2], [0, -4]].forEach(([x, y], i) => i ? shape.lineTo(x, y) : shape.moveTo(x, y));
  for (const s of [1, -1]) {
    const piv = new THREE.Group(); piv.position.set(s * 2.4, 1.6, 2.0); g.add(piv);
    const geo = new THREE.ShapeGeometry(shape); geo.rotateX(Math.PI / 2); geo.scale(s, 1, 1);
    piv.add(new THREE.Mesh(geo, wingMat));
    const elbow = new V(s * 7, 0, 4.2), tip = new V(s * 15, 0, 1.2);
    limb(new V(0, 0, 3), elbow, 0.45, 0.32, scales, piv);
    limb(elbow, tip, 0.32, 0.08, scales, piv);
    limb(elbow, new V(s * 7.5, 0, -4.2), 0.14, 0.05, scales, piv);
    limb(elbow, new V(s * 12.5, 0, -1.2), 0.14, 0.05, scales, piv);
    const claw = new THREE.Mesh(new THREE.ConeGeometry(0.25, 0.9, 5), horn); claw.position.copy(elbow).setY(0.4); piv.add(claw);
    dragon.wings.push({ piv, s });
    // legs, tucked back while flying
    for (const z of [3.2, -3.4]) {
      const hip = new V(s * 1.9, -1.4, z), foot = new V(s * 2.1, -3.2, z - 2.2);
      limb(hip, foot, 0.7, 0.45, scales);
      for (const t of [-0.35, 0, 0.35]) limb(foot, new V(foot.x + t, foot.y - 0.3, foot.z - 0.9), 0.14, 0.03, horn);
    }
  }
  g.scale.setScalar(1.05);
  scene.add(g);
  dragon.g = g;
  dragon.pos.set(SPAWN.x + 90, 75, SPAWN.z - 130);
}

// Press the dragon button: it flies over to pick you up. Press it again while riding to hop off.
function callDragon() {
  if (state !== 'play') return;
  if (kaiju.on) { toast('🐉 Your dragon is too scared of monsters to come down!'); return; }
  if (dragon.state === 'ride') { hopOffDragon(); return; }
  if (dragon.state === 'come') { toast('🐉 Your dragon is on the way!'); return; }
  dragon.state = 'come'; dragon.comeT = 0;
  SFX.roar();
  const d = Math.round(dragon.pos.distanceTo(player.pos));
  showAlert(`🐉 Here comes your dragon! (${d} m away)`);
}

function mountDragon() {
  const P = player;
  dragon.state = 'ride';
  for (let s = 0; s < 2; s++) { P.hooks[s].state = 'none'; P.hooks[s].crook = null; holdSrc[s].clear(); }
  P.flip = 0; P.jumps = 0; P.thrusting = false;
  dragon.vel.y = Math.max(dragon.vel.y, 14); // up and away
  camYaw = Math.atan2(-dragon.vel.x, -dragon.vel.z);
  SFX.roar();
  floater(dv.a.copy(P.pos).setY(P.pos.y + 3), 'All aboard!', '#ffd23f');
  toast(isTouch() ? '🐉 Steer with the stick · ⤴ flaps up · 🔥 breathes fire · 🐉 hops off'
    : '🐉 Steer with the mouse (or A / D) · W goes faster · Space flaps up · F breathes fire · R hops off', true);
  updateGadgetUI();
}

function hopOffDragon() {
  const P = player;
  seatRider();
  dragon.state = 'roam'; dragon.goalT = 0; dragon.breathing = false;
  P.vel.copy(dragon.vel).multiplyScalar(0.6); P.vel.y = Math.max(P.vel.y, 0) + 7;
  P.jumps = 1; P.onGround = false;
  SFX.jump();
  updateGadgetUI();
}

// put you on the saddle
function seatRider() {
  dragon.g.updateMatrixWorld(true);
  dragon.saddle.getWorldPosition(player.pos);
  player.vel.copy(dragon.vel);
}

// steer toward a direction, sliding up and around buildings in the way
function dragonSteer(dt, want, speed, rate, avoid) {
  const D = dragon;
  if (avoid) {
    const sp = D.vel.length() || 1, look = dv.a.copy(D.vel).multiplyScalar(1 / sp);
    const h = rayCity(D.pos, look, 30 + sp * 1.3, true);
    if (h) { want.addScaledVector(h.n, 1.1); want.y += 1.6; want.normalize(); }
  }
  D.vel.lerp(dv.b.copy(want).multiplyScalar(speed), Math.min(1, rate * dt));
}

function pickRoamGoal() {
  const D = dragon, k = () => Math.floor(rand(-1, N));
  // stay near you, so you see it flying between the buildings
  for (let tries = 0; tries < 20; tries++) {
    D.goal.set(roadC(k()), rand(35, 110), roadC(k()));
    const d = Math.hypot(D.goal.x - player.pos.x, D.goal.z - player.pos.z);
    if (d < 320 && D.goal.distanceTo(D.pos) > 90) break;
  }
  D.goalT = rand(10, 18);
}

function updateDragon(dt) {
  const D = dragon, P = player;
  D.t += dt; D.roarCd -= dt;
  const fwd = dv.c.copy(D.vel).normalize();

  if (D.state === 'roam') {
    D.goalT -= dt;
    if (D.goalT <= 0 || D.pos.distanceTo(D.goal) < 25) pickRoamGoal();
    const want = dv.d.copy(D.goal).sub(D.pos).normalize();
    if (D.pos.y < 30) want.y += 0.4;
    dragonSteer(dt, want.normalize(), 26, 1.2, true);
    // now and then it shows off a burst of fire
    if ((D.showFireT -= dt) <= 0) D.showFireT = rand(7, 14);
    D.breathing = D.showFireT < 1.1 && D.pos.y > 25;
  } else if (D.state === 'come') {
    D.comeT += dt;
    // aim the saddle at you: the dragon's middle sits a little below and behind it
    const tgt = dv.d.copy(P.pos).addScaledVector(dv.e.set(fwd.x, 0, fwd.z).normalize(), -1.8); tgt.y -= 2.2;
    const dh = Math.hypot(tgt.x - D.pos.x, tgt.z - D.pos.z);
    let speed;
    if (dh > 80) { tgt.y = Math.max(P.pos.y + 25, 60); speed = dh > 220 ? 85 : 55; }
    else { tgt.y += dh * 0.35; speed = lerp(24, 50, dh / 80); } // a swoop down to you
    const want = tgt.sub(D.pos);
    const close = want.length() < 45;
    dragonSteer(dt, want.normalize(), speed, close ? 3.5 : 1.8, !close);
    D.breathing = false;
    if (D.comeT > 40) { D.pos.set(P.pos.x, P.pos.y + 90, P.pos.z + 120); D.comeT = 0; } // lost? start over close by
    D.g.updateMatrixWorld(true);
    if (D.saddle.getWorldPosition(dv.e).distanceTo(P.pos) < 7.5) mountDragon();
  } else if (D.state === 'ride') {
    // the stick (or A / D) turns, the camera's up and down tilts, forward goes faster
    camYaw -= inp.mx * 1.5 * dt;
    const pitch = clamp((camPitch - 0.12) * 1.3, -1.0, 1.0);
    const want = dirFrom(camYaw, pitch, dv.d);
    const speed = 32 + inp.mz * (inp.mz > 0 ? 24 : 20);
    dragonSteer(dt, want, speed, 2.2, true); // it pulls up over buildings in the way by itself
    if (inp.jump) { D.vel.y += 13; D.flapBoost = 1; SFX.flap(); }
    D.breathing = inp.gadgetHeld;
  }

  // move, and keep out of the buildings and the ground
  const sp = D.vel.length();
  if (sp > 90) D.vel.multiplyScalar(90 / sp);
  D.pos.addScaledVector(D.vel, dt);
  const feet = dv.e.copy(D.pos); feet.y -= 2.6;
  collideBody(feet, D.vel, 3, 5.4);
  D.pos.copy(feet).y += 2.6;
  if (D.pos.y > 320) { D.pos.y = 320; if (D.vel.y > 0) D.vel.y = 0; }
  const lim = LIMIT - 20;
  if (Math.abs(D.pos.x) > lim) { D.pos.x = Math.sign(D.pos.x) * lim; D.vel.x *= -0.5; }
  if (Math.abs(D.pos.z) > lim) { D.pos.z = Math.sign(D.pos.z) * lim; D.vel.z *= -0.5; }

  // pose: face where it's going, lean into turns
  const hsp = Math.hypot(D.vel.x, D.vel.z);
  if (hsp > 1) {
    const ny = Math.atan2(D.vel.x, D.vel.z), turn = angDiff(ny, D.yaw);
    D.yaw += turn * Math.min(1, dt * 5);
    D.roll = lerp(D.roll, clamp(-turn * 4, -0.7, 0.7), Math.min(1, dt * 3));
  }
  D.pitch = lerp(D.pitch, clamp(Math.atan2(D.vel.y, hsp), -0.6, 0.6), Math.min(1, dt * 4));
  D.flapBoost = Math.max(0, D.flapBoost - dt * 1.5);
  const climbing = D.vel.y > 2 || D.state === 'come' || D.flapBoost > 0;
  const lastFlap = Math.sin(D.flap);
  D.flap += dt * (2.6 + (climbing ? 1.4 : 0) + D.flapBoost * 4);
  const amp = D.pitch < -0.35 ? 0.15 : 0.55; // wings tucked in a dive
  for (const w of D.wings) w.piv.rotation.z = w.s * (Math.sin(D.flap) * amp + 0.12);
  if (lastFlap > 0 && Math.sin(D.flap) <= 0 && D.pos.distanceTo(camera.position) < 90) SFX.flap();
  D.tail.forEach((seg, i) => { seg.rotation.y = Math.sin(D.t * 2.2 - i * 0.7) * 0.16; seg.rotation.x = 0.05 + Math.sin(D.t * 1.6 - i * 0.5) * 0.05; });
  D.jaw.rotation.x = D.breathing ? 0.55 : 0.08;
  D.head.rotation.x = -D.pitch * 0.4;
  D.g.position.copy(D.pos); D.g.position.y += Math.cos(D.flap) * 0.35;
  D.g.rotation.set(-D.pitch, D.yaw, D.roll);
  D.g.updateMatrixWorld(true);

  if (D.breathing) breatheFire(dt);
  else D.fireSnd = 0;

  // riding low? swoop on crooks and grab them
  if (D.state === 'ride') for (const c of crooks) {
    if (c.state !== 'run' && c.state !== 'frozen' && c.state !== 'fly') continue;
    if (Math.hypot(c.pos.x - D.pos.x, c.pos.z - D.pos.z) < 6 && Math.abs(c.pos.y + 1 - D.pos.y) < 6) catchCrook(c, 'dragon');
  }
}

// ---- Fire breath ----
const flameGeo = new THREE.IcosahedronGeometry(1, 1);
function breatheFire(dt) {
  const D = dragon, riding = D.state === 'ride';
  const mouth = D.mouth.getWorldPosition(dv.a);
  // riding: the fire goes where you aim. Otherwise straight ahead.
  const fwd = dv.b.set(Math.sin(D.yaw) * Math.cos(D.pitch), Math.sin(D.pitch), Math.cos(D.yaw) * Math.cos(D.pitch));
  const dir = dv.aim.copy(fwd);
  if (riding) {
    aimPoint(140, dir).sub(mouth).normalize();
    if (dir.dot(fwd) < 0.3) dir.copy(fwd);
  }
  for (D.fireT -= dt; D.fireT <= 0; D.fireT += 0.022) flame(mouth, dir, D.vel);
  if ((D.fireSnd -= dt) <= 0) { D.fireSnd = 0.11; if (mouth.distanceTo(camera.position) < 140) SFX.fire(); }

  if ((D.smokeT -= dt) <= 0) {
    D.smokeT = 0.15;
    const h = rayCity(mouth, dir, 55);
    if (h) { puff(h.p, '#3d3d3d', 3, 1.4, 4); scareNear(h.p, 18); }
  }
  if (!riding) return;
  for (const c of crooks) {
    if (c.state !== 'run' && c.state !== 'frozen' && c.state !== 'fly') continue;
    const v = dv.c.copy(c.pos); v.y += 1; v.sub(mouth);
    const L = v.length();
    if (L > 60 || v.angleTo(dir) > 0.24) continue;
    if (rayCity(mouth, v.multiplyScalar(1 / L), L - 1, true)) continue;
    puff(dv.d.copy(c.pos).setY(c.pos.y + 1.5), '#2b2b2b', 8, 0.7, 3);
    catchCrook(c, 'fire');
  }
}
function flame(from, dir, carry) {
  const m = new THREE.MeshBasicMaterial({ color: '#ffe14d', transparent: true, opacity: 0.95, depthWrite: false });
  m.userData.fxOwned = true;
  const o = new THREE.Mesh(flameGeo, m);
  o.position.copy(from).addScaledVector(dir, rand(0, 1.5));
  const v = dir.clone().multiplyScalar(rand(50, 62)).add(carry);
  v.x += rand(-4, 4); v.y += rand(-3, 4); v.z += rand(-4, 4);
  const life = rand(0.55, 0.8);
  addFx(o, life, (e, k, dt) => {
    if (insideBuilding(o.position)) v.multiplyScalar(0.25); // splashes against walls
    o.position.addScaledVector(v, dt);
    v.y += 6 * dt; // flames float up
    o.scale.setScalar(0.5 + k * 3.6);
    m.color.setHSL(lerp(0.15, 0.0, Math.min(1, k * 1.4)), 1, k > 0.75 ? lerp(0.5, 0.2, (k - 0.75) * 4) : lerp(0.62, 0.5, k));
    m.opacity = 0.95 * (1 - k * k);
  });
}
