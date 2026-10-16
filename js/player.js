'use strict';
// The tester: running, jumping, a grappling hook on each arm, and the chase camera.
const ROPE_MAX = 170;
const player = {
  pos: SPAWN.clone(), vel: new V(), onGround: true, bodyYaw: Math.PI, jumps: 0, flip: 0, phase: 0, portalCd: 0, bonkCd: 0,
  fuel: 1, thrusting: false, blastY: 0, blastT: 0, mesh: null, arms: [], legs: [], flames: [], hooks: [],
};
const pv = { a: new V(), b: new V(), c: new V(), d: new V(), f: new V(), r: new V(), w: new V() };

function makePlayer() {
  const L = c => new THREE.MeshLambertMaterial({ color: c });
  const suit = L('#7ed957'), white = L('#f5f5f0'), orange = L('#ff8a2a'), dark = L('#24303f'), skin = L('#e0ac69');
  const lens = new THREE.MeshLambertMaterial({ color: '#4fd8ff', emissive: '#1a6f88' });
  const g = new THREE.Group();
  const box = (w, h, d, m, x, y, z, parent = g) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y, z); parent.add(o); return o; };
  player.legs = [-0.15, 0.15].map(x => {
    const piv = new THREE.Group(); piv.position.set(x, 0.86, 0); g.add(piv);
    box(0.22, 0.8, 0.26, white, 0, -0.4, 0, piv);
    box(0.26, 0.2, 0.36, orange, 0, -0.78, 0.05, piv);
    const flame = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.9, 8), new THREE.MeshBasicMaterial({ color: '#ffb02e', transparent: true, opacity: 0.85 }));
    flame.rotation.x = Math.PI; flame.position.set(0, -1.3, 0); flame.visible = false; piv.add(flame);
    player.flames.push(flame);
    return piv;
  });
  box(0.64, 0.74, 0.38, suit, 0, 1.24, 0);
  box(0.66, 0.12, 0.4, dark, 0, 0.92, 0);           // belt
  box(0.2, 0.2, 0.05, orange, 0.14, 1.38, 0.2);     // Lab badge
  box(0.52, 0.58, 0.26, dark, 0, 1.28, -0.32);      // gadget pack
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.2, 8), orange);
  for (const x of [-0.14, 0.14]) { const c = cap.clone(); c.position.set(x, 1.66, -0.32); g.add(c); }
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 12, 10), skin); head.position.y = 1.86; g.add(head);
  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.27, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), dark); hair.position.y = 1.9; g.add(hair);
  box(0.56, 0.1, 0.56, dark, 0, 1.9, 0);            // goggle strap
  for (const x of [-0.1, 0.1]) {
    const l = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.085, 0.08, 12), lens);
    l.rotation.x = Math.PI / 2; l.position.set(x, 1.9, 0.26); g.add(l);
  }
  player.arms = [0.42, -0.42].map(x => {   // [left arm, right arm]; the model faces +z so its left is +x
    const piv = new THREE.Group(); piv.position.set(x, 1.52, 0); g.add(piv);
    box(0.17, 0.17, 0.6, suit, 0, 0, 0.3, piv);
    const gun = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.11, 0.32, 10), orange);
    gun.rotation.x = Math.PI / 2; gun.position.z = 0.66; piv.add(gun);
    box(0.08, 0.08, 0.1, dark, 0, 0, 0.85, piv);
    return piv;
  });
  scene.add(g);
  player.mesh = g;

  const ropeGeo = new THREE.CylinderGeometry(0.045, 0.045, 1, 5); ropeGeo.rotateX(Math.PI / 2); ropeGeo.translate(0, 0, 0.5);
  const ropeMat = new THREE.MeshBasicMaterial({ color: '#ffb347' });
  const clawGeo = new THREE.ConeGeometry(0.22, 0.5, 6); clawGeo.rotateX(Math.PI / 2);
  for (let s = 0; s < 2; s++) {
    const rope = new THREE.Mesh(ropeGeo, ropeMat), claw = new THREE.Mesh(clawGeo, new THREE.MeshLambertMaterial({ color: '#ff8a2a' }));
    rope.visible = claw.visible = false;
    scene.add(rope, claw);
    player.hooks.push({ state: 'none', anchor: new V(), tip: new V(), dir: new V(), len: 0, goal: 0, dist: 0, t: 0, pull: 0, crook: null, rope, claw });
  }
}

function handPos(side, out) { return player.arms[side].localToWorld(out.set(0, 0, 0.85)); }

// where each hook goes when you aim with the crosshair: a bit out to its own side and a bit up
function hookAimDir(side, out) { return dirFrom(camYaw + (side ? -0.2 : 0.2), clamp(camPitch + 0.28, -1.2, 1.45), out); }

// a crook close to the aim line wins; otherwise the first building, tilting the aim upward a little until one is found
const aimRes = { p: new V(), crook: null, ok: false };
function findHookTarget(o, d0, out) {
  out.ok = false; out.crook = null;
  let bestA = 0.14;
  for (const c of crooks) {
    if (c.state === 'caught' || c.state === 'yank') continue;
    pv.c.copy(c.pos); pv.c.y += 1; pv.c.sub(o);
    const L = pv.c.length();
    if (L > 140 || L < 2) continue;
    const a = pv.c.angleTo(d0);
    if (a < bestA) { bestA = a; out.crook = c; }
  }
  if (out.crook) { out.p.copy(out.crook.pos); out.p.y += 1; out.ok = true; return out; }
  const yaw = yawOf(d0), pitch = pitchOf(d0);
  for (const step of [0, 0.1, 0.2, 0.32, 0.45, 0.6]) {
    const d = dirFrom(yaw, Math.min(1.5, pitch + step), pv.d);
    const h = rayCity(o, d, ROPE_MAX, step > 0);
    if (h && (h.k !== -2 || h.t < 60)) { out.p.copy(h.p); out.ok = true; return out; }
  }
  return out;
}

// dir/origin given = aimed at a spot on the screen (touch or wand); otherwise the crosshair aim for that arm
function fireHook(side, dir, origin) {
  const h = player.hooks[side];
  h.state = 'none'; h.crook = null;
  const hand = handPos(side, pv.a);
  if (!dir) { dir = hookAimDir(side, pv.b); origin = hand; }
  findHookTarget(origin, dir, aimRes);
  h.t = 0;
  if (!aimRes.ok) { h.state = 'miss'; h.dir.copy(dir); SFX.miss(); return; }
  h.state = 'fly'; h.anchor.copy(aimRes.p); h.crook = aimRes.crook; h.dist = hand.distanceTo(h.anchor);
  SFX.hook();
}
function releaseHook(side) {
  const h = player.hooks[side];
  // letting go mid-swing gives a little boost, so you fly
  if (h.state === 'on' && !h.crook && !player.onGround) { player.vel.multiplyScalar(1.1); if (player.vel.y > -5) player.vel.y += 4; }
  h.state = 'none'; h.crook = null;
}

const angDiff = (a, b) => { let d = a - b; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return d; };

function updatePlayer(dt) {
  const P = player, hooks = P.hooks;
  P.portalCd -= dt; P.bonkCd -= dt;
  P.mesh.updateMatrixWorld(true);
  const f = pv.f.set(-Math.sin(camYaw), 0, -Math.cos(camYaw)), r = pv.r.set(Math.cos(camYaw), 0, -Math.sin(camYaw));
  const wish = pv.w.set(0, 0, 0).addScaledVector(f, inp.mz).addScaledVector(r, inp.mx);
  if (wish.lengthSq() > 1) wish.normalize();
  const swinging = hooks.some(h => h.state === 'on' && !h.crook);

  if (inp.jump) {
    if (P.onGround) { P.vel.y = 10.5; P.jumps = 1; SFX.jump(); }
    else if (P.jumps < 2) { P.vel.y = Math.max(P.vel.y + 6, 10); P.jumps = 2; P.flip = 1; SFX.flip(); }
  }
  if (P.onGround && !swinging) {
    const k = Math.min(1, 9 * dt), top = 11;
    P.vel.x += (wish.x * top - P.vel.x) * k;
    P.vel.z += (wish.z * top - P.vel.z) * k;
  } else {
    P.vel.addScaledVector(wish, (swinging ? 18 : 10) * dt);
    P.vel.multiplyScalar(1 - 0.05 * dt);
  }
  P.vel.y -= GRAV * dt;

  // hooks flying out, hanging on, reeling in
  const reeling = inp.reel || (save.equipped === 'hooks' && inp.gadgetHeld);
  const body = pv.c.copy(P.pos); body.y += 1.3;
  for (let s = 0; s < 2; s++) {
    const h = hooks[s];
    if (h.state === 'fly') {
      if (h.crook) { h.anchor.copy(h.crook.pos); h.anchor.y += 1; }
      h.t += dt * 260;
      if (h.t >= h.dist) {
        h.state = 'on'; SFX.attach();
        if (h.crook) { if (h.crook.state === 'caught') { h.state = 'none'; h.crook = null; } else h.crook.state = 'yank'; }
        else {
          // launch toward the anchor and take in rope until the bottom of the swing clears the ground
          h.len = body.distanceTo(h.anchor);
          h.goal = Math.min(h.len, Math.max(6, h.anchor.y - P.pos.y - 2));
          h.pull = 1.2;
          P.vel.addScaledVector(pv.d.copy(h.anchor).sub(body).normalize(), 12);
          if (P.onGround) P.vel.y = Math.max(P.vel.y, 9);
        }
      }
    } else if (h.state === 'miss') {
      h.t += dt;
      if (h.t > 0.45) h.state = 'none';
    } else if (h.state === 'on') {
      if (h.crook) {
        if (h.crook.state === 'caught') { h.state = 'none'; h.crook = null; } else { h.anchor.copy(h.crook.pos); h.anchor.y += 1; }
        continue;
      }
      h.pull -= dt;
      const L = body.distanceTo(h.anchor), to = pv.d.copy(h.anchor).sub(body).normalize();
      h.len = Math.min(h.len, L); // the rope takes up slack, so it never goes floppy
      if (h.pull > 0 && h.len > h.goal) h.len = Math.max(h.goal, h.len - 40 * dt);
      if (reeling) { h.len = Math.max(2.5, h.len - 32 * dt); P.vel.addScaledVector(to, 34 * dt); }
      P.vel.addScaledVector(to, 9 * dt); // hooks always tug a little
    }
  }

  let sp = P.vel.length();
  if (sp > 85) { P.vel.multiplyScalar(85 / sp); sp = 85; }
  const steps = sp > 28 ? 3 : 1, h = dt / steps;
  let ground = false;
  for (let k = 0; k < steps; k++) {
    P.pos.addScaledVector(P.vel, h);
    // rope: can't get farther from the anchor than the rope is long
    for (const hk of hooks) {
      if (hk.state !== 'on' || hk.crook) continue;
      const bp = pv.a.copy(P.pos); bp.y += 1.3;
      const d = bp.sub(hk.anchor), L = d.length();
      if (L > hk.len && L > 0) {
        d.multiplyScalar(1 / L);
        P.pos.addScaledVector(d, hk.len - L);
        const vr = P.vel.dot(d);
        if (vr > 0) P.vel.addScaledVector(d, -vr);
      }
    }
    const hop = portalTry(P, P.pos, P.vel);
    if (hop) {
      addStat('portalTrip');
      if (hop > 150) addStat('portalFar');
      for (let s = 0; s < 2; s++) hooks[s].state = 'none';
    }
    if (collideBody(P.pos, P.vel, 0.4, 1.9)) ground = true;
  }
  P.onGround = ground;
  if (ground) P.jumps = 0;
  if (Math.abs(P.pos.x) > LIMIT) { P.pos.x = Math.sign(P.pos.x) * LIMIT; P.vel.x = 0; }
  if (Math.abs(P.pos.z) > LIMIT) { P.pos.z = Math.sign(P.pos.z) * LIMIT; P.vel.z = 0; }

  if (swinging && !ground) addStat('swingDist', sp * dt);
  if (ground && P.pos.y > 100) maxStat('tallRoof', 1);

  // tackle crooks by running (or swinging) into them
  for (const c of crooks) {
    if (c.state !== 'run' && c.state !== 'frozen') continue;
    if (P.pos.distanceToSquared(c.pos) > 1.9 * 1.9) continue;
    if (c.state === 'frozen') catchCrook(c, 'freeze');
    else catchCrook(c, P.thrusting ? 'boots' : !ground && sp > 13 ? 'swing' : 'tackle');
  }
  // cars bump you out of the way
  if (P.pos.y < 2.4 && P.bonkCd <= 0) for (const car of cars) {
    const dx = P.pos.x - car.pos.x, dz = P.pos.z - car.pos.z;
    const hx = car.axis === 0 ? 2.6 : 1.4, hz = car.axis === 0 ? 1.4 : 2.6;
    if (Math.abs(dx) > hx || Math.abs(dz) > hz) continue;
    const side = car.axis === 0 ? pv.d.set(0, 0, Math.sign(dz) || 1) : pv.d.set(Math.sign(dx) || 1, 0, 0);
    P.vel.copy(side).multiplyScalar(10); P.vel.y = 8;
    if (car.axis === 0) P.vel.x += car.dir * car.speed * 0.6; else P.vel.z += car.dir * car.speed * 0.6;
    P.bonkCd = 1; SFX.bonk();
    floater(pv.a.copy(P.pos).setY(P.pos.y + 2.5), 'BONK!', '#fff');
    break;
  }

  animatePlayer(dt, sp, ground);
}

function animatePlayer(dt, sp, ground) {
  const P = player, g = P.mesh;
  const hsp = Math.hypot(P.vel.x, P.vel.z);
  if (hsp > 1.5) P.bodyYaw += angDiff(Math.atan2(P.vel.x, P.vel.z), P.bodyYaw) * Math.min(1, dt * 10);
  else if (P.hooks.some(h => h.state !== 'none')) P.bodyYaw += angDiff(camYaw + Math.PI, P.bodyYaw) * Math.min(1, dt * 8);
  g.position.copy(P.pos);
  g.rotation.set(0, P.bodyYaw, 0);
  if (P.flip > 0) { P.flip = Math.max(0, P.flip - dt * 2.6); g.rotation.x = (1 - P.flip) * Math.PI * 2; }
  P.phase += dt * (ground ? hsp * 1.1 : 4);
  const leg = ground ? Math.sin(P.phase) * Math.min(1, hsp / 6) * 0.9 : 0.5;
  P.legs[0].rotation.x = leg; P.legs[1].rotation.x = ground ? -leg : -0.2;
  g.updateMatrixWorld(true);
  for (let s = 0; s < 2; s++) {
    const arm = P.arms[s], h = P.hooks[s];
    if (h.state === 'fly' || h.state === 'on') arm.lookAt(h.anchor);
    else if (h.state === 'miss') arm.lookAt(pv.a.copy(arm.getWorldPosition(pv.b)).add(h.dir));
    else if (ground) arm.rotation.set(Math.PI / 2 - Math.sin(P.phase) * (s ? -0.6 : 0.6) * Math.min(1, hsp / 6), 0, 0);
    else arm.rotation.set(Math.PI / 2 - 1.3, 0, s ? -0.5 : 0.5);
  }
  for (const fl of P.flames) { fl.visible = P.thrusting; if (P.thrusting) fl.scale.set(1, 0.7 + Math.random() * 0.6, 1); }
  g.updateMatrixWorld(true);
  // ropes and claws
  for (let s = 0; s < 2; s++) {
    const h = P.hooks[s];
    if (h.state === 'none') { h.rope.visible = h.claw.visible = false; continue; }
    const hand = handPos(s, pv.a);
    if (h.state === 'fly') {
      const to = pv.b.copy(h.anchor).sub(hand), L = to.length();
      h.tip.copy(hand).addScaledVector(to, Math.min(1, h.t / Math.max(L, 0.01)));
    } else if (h.state === 'miss') {
      const out = h.t < 0.22 ? h.t * 420 : (0.45 - h.t) * 420;
      h.tip.copy(hand).addScaledVector(h.dir, Math.max(0, out));
    } else h.tip.copy(h.anchor);
    const len = hand.distanceTo(h.tip);
    h.rope.visible = h.claw.visible = len > 0.05;
    h.rope.position.copy(hand); h.rope.lookAt(h.tip); h.rope.scale.set(1, 1, len);
    h.claw.position.copy(h.tip); h.claw.lookAt(pv.b.copy(h.tip).sub(hand).add(h.tip));
  }
}

let lastLookT = 0, autoCam = false;
const camT = { f: new V(), t: new V(), b: new V() };
function updateCamera(dt) {
  const P = player, hsp = Math.hypot(P.vel.x, P.vel.z), sp = P.vel.length();
  // on touch, controllers and wands the camera slowly turns to follow where you're going
  if (autoCam && performance.now() - lastLookT > 1400 && hsp > 5)
    camYaw += angDiff(Math.atan2(-P.vel.x, -P.vel.z), camYaw) * Math.min(1, dt * 0.9);
  const F = dirFrom(camYaw, camPitch, camT.f);
  const target = camT.t.copy(P.pos); target.y += 1.8;
  let dist = 6.5 + Math.min(sp, 60) * 0.05;
  const back = camT.b.copy(F).negate(); back.y += 0.18; back.normalize();
  const hit = rayCity(target, back, dist + 0.6, true);
  if (hit) dist = Math.max(1.2, hit.t - 0.6);
  camera.position.copy(target).addScaledVector(back, dist);
  if (camera.position.y < 0.4) camera.position.y = 0.4;
  camera.lookAt(pv.a.copy(camera.position).add(F));
  const fov = 70 + Math.min(sp, 60) * 0.33;
  if (Math.abs(camera.fov - fov) > 0.05) { camera.fov += (fov - camera.fov) * Math.min(1, dt * 4); camera.updateProjectionMatrix(); }
}
