'use strict';
// The gadget you carry (besides your arm hooks), and the tests that pay you for trying them.
let gadgetCd = 0, bootSnd = 0;
const portals = [null, null];
let nextPortal = 0;
const nets = [];
const gv = { a: new V(), b: new V(), c: new V(), d: new V() };

function addStat(key, n = 1) { save.stats[key] = (save.stats[key] || 0) + n; checkTests(); }
function maxStat(key, v) { if (v > (save.stats[key] || 0)) { save.stats[key] = v; checkTests(); } }
function checkTests() {
  for (const g of GADGETS) g.tests.forEach((t, i) => {
    const id = g.id + i;
    if (save.done.includes(id) || (save.stats[t.stat] || 0) < t.goal) return;
    save.done.push(id);
    save.cash += t.pay;
    toast(`✅ Test passed: ${t.text} · +$${t.pay}`, true);
    SFX.pass();
    updateCashUI(); persist();
  });
}

const cameraAim = out => dirFrom(camYaw, camPitch, out);
// the spot under the crosshair
function aimPoint(maxT, out) {
  const d = cameraAim(gv.a), h = rayCity(camera.position, d, maxT);
  return h ? out.copy(h.p) : out.copy(camera.position).addScaledVector(d, maxT);
}
// gadgets lean toward a crook near the crosshair, as long as no building is in the way
function aimCrook(maxAng, maxD) {
  const d = cameraAim(gv.a);
  let best = null, ba = maxAng;
  for (const c of crooks) {
    if (c.state === 'caught' || c.state === 'yank') continue;
    const v = gv.b.copy(c.pos); v.y += 1; v.sub(camera.position);
    const L = v.length();
    if (L > maxD) continue;
    const a = v.angleTo(d);
    if (a >= ba) continue;
    const h = rayCity(camera.position, v.multiplyScalar(1 / L), L - 1, true);
    if (h) continue;
    ba = a; best = c;
  }
  return best;
}

function updateGadgets(dt) {
  gadgetCd -= dt;
  const P = player, g = save.equipped;
  P.thrusting = false;
  if (dragon.state === 'ride') { updateNets(dt); return; } // the gadget button breathes fire instead (dragon.js)
  if (g === 'boots' && inp.gadgetHeld && P.fuel > 0) {
    P.thrusting = true;
    P.fuel = Math.max(0, P.fuel - dt / 3.5);
    P.vel.y = Math.min(18, P.vel.y + 40 * dt);
    P.vel.addScaledVector(dirFrom(camYaw, 0, gv.c), 12 * dt);
    if ((bootSnd -= dt) <= 0) { bootSnd = 0.12; SFX.boots(); }
    if (!P.onGround) { addStat('bootDist', P.vel.length() * dt); if (P.pos.y > 150) maxStat('bootHigh', 1); }
  } else P.fuel = Math.min(1, P.fuel + dt * (P.onGround ? 0.4 : 0.1));
  if (P.blastT > 0) { P.blastT -= dt; maxStat('blastJump', P.pos.y - P.blastY); }
  if (inp.gadgetPress && gadgetCd <= 0) useGadget(g);
  updateNets(dt);
  for (const p of portals) if (p) p.mesh.userData.tex.rotation += dt * 3;
}

function useGadget(g) {
  const P = player;
  if (g === 'fling') {
    gadgetCd = 0.7; SFX.fling();
    const dir = cameraAim(gv.d), o = gv.c.copy(P.pos); o.y += 1.3;
    blastRing(o, dir);
    const push = (pos, out) => {
      const v = gv.b.copy(pos).sub(o); v.y += 1;
      const L = v.length();
      if (L > 34 || L < 0.01 || v.angleTo(dir) > 0.65) return false;
      const k = 1 - L / 45;
      out.copy(dir).multiplyScalar(26 * k).addScaledVector(v.normalize(), 8 * k);
      out.y = Math.max(out.y, 0) + 13 * k;
      return true;
    };
    for (const c of crooks) {
      if (c.state === 'caught' || c.state === 'yank') continue;
      if (push(c.pos, c.vel)) {
        c.state = 'fly'; c.credit = 'fling'; c.m.ice.visible = false; c.pos.y += 0.1;
        addStat('flingCrook');
      }
    }
    for (const p of peds) if (push(p.pos, gv.a)) flingPed(p, gv.a);
    scareNear(o, 40);
    // aim at your feet to blast yourself into the sky
    if (dir.y < -0.45) { P.vel.addScaledVector(dir, -34); P.blastY = P.pos.y; P.blastT = 3; P.jumps = 1; }
    else P.vel.addScaledVector(dir, -5);
  } else if (g === 'net') {
    gadgetCd = 0.6; SFX.net();
    const from = handPos(1, new V()), c = aimCrook(0.14, 120);
    const to = c ? gv.a.copy(c.pos).setY(c.pos.y + 1).addScaledVector(c.vel, c.pos.distanceTo(from) / 70) : aimPoint(200, gv.a);
    const mesh = new THREE.Mesh(netGeo, netMat);
    mesh.position.copy(from);
    scene.add(mesh);
    nets.push({ pos: mesh.position, from: from.clone(), vel: to.sub(from).normalize().multiplyScalar(70), t: 0, mesh });
  } else if (g === 'portal') {
    gadgetCd = 0.35;
    const h = rayCity(camera.position, cameraAim(gv.a), 320);
    if (!h) { SFX.miss(); floater(aimPoint(30, gv.b), 'Too far!', '#fff'); return; }
    placePortal(h.p, h.n);
  } else if (g === 'freeze') {
    gadgetCd = 0.5; SFX.freeze();
    const from = handPos(1, new V()), c = aimCrook(0.12, 110);
    let to;
    if (c) {
      to = gv.a.copy(c.pos).setY(c.pos.y + 1);
      if (c.state === 'run' || c.state === 'fly') {
        c.state = 'frozen'; c.timer = 10; c.vel.set(0, 0, 0); c.m.ice.visible = true;
        addStat('freezeCrook');
        floater(gv.b.copy(c.pos).setY(c.pos.y + 2.6), 'FROZEN! Touch them!', '#bfefff');
      }
    } else {
      to = aimPoint(110, gv.a);
      // freeze whoever is standing near where the beam lands
      for (const p of peds) if (p.state === 'walk' && p.pos.distanceToSquared(to) < 4) { freezePed(p); break; }
    }
    beam(from, to);
  }
}

// ---- Fling Blaster: a ring of air that grows as it flies ----
const ringGeo = new THREE.TorusGeometry(1, 0.18, 6, 24);
function blastRing(o, dir) {
  const m = new THREE.MeshBasicMaterial({ color: '#e8f7ff', transparent: true, opacity: 0.8 });
  m.userData.fxOwned = true;
  const r = new THREE.Mesh(ringGeo, m);
  r.position.copy(o); r.lookAt(gv.b.copy(o).add(dir));
  const v = dir.clone().multiplyScalar(60);
  addFx(r, 0.45, (e, k, dt) => { r.position.addScaledVector(v, dt); r.scale.setScalar(1 + k * 9); m.opacity = 0.8 * (1 - k); });
}

// ---- Freeze Ray beam ----
const beamGeo = new THREE.CylinderGeometry(0.12, 0.12, 1, 6); beamGeo.rotateX(Math.PI / 2); beamGeo.translate(0, 0, 0.5);
function beam(from, to) {
  const m = new THREE.MeshBasicMaterial({ color: '#9feaff', transparent: true, opacity: 0.9 });
  m.userData.fxOwned = true;
  const b = new THREE.Mesh(beamGeo, m);
  b.position.copy(from); b.lookAt(to); b.scale.z = from.distanceTo(to);
  addFx(b, 0.3, (e, k) => { m.opacity = 0.9 * (1 - k); b.scale.x = b.scale.y = 1 + k * 2; });
  puff(to, '#dff8ff', 6, 0.35, 2);
}

// ---- Net Launcher ----
const netGeo = new THREE.PlaneGeometry(1.8, 1.8, 3, 3);
const netMat = new THREE.MeshBasicMaterial({ color: '#9be15d', wireframe: true, side: THREE.DoubleSide });
function insideBuilding(p) {
  const i0 = blockOf(p.x), j0 = blockOf(p.z);
  if (i0 < 0 || j0 < 0 || i0 >= N || j0 >= N) return false;
  for (const q of blocks[i0 * N + j0].list) {
    const k = q * 3;
    if (p.x > bmin[k] && p.x < bmax[k] && p.y > bmin[k + 1] && p.y < bmax[k + 1] && p.z > bmin[k + 2] && p.z < bmax[k + 2]) return true;
  }
  return false;
}
function updateNets(dt) {
  for (let i = nets.length - 1; i >= 0; i--) {
    const n = nets[i];
    n.t += dt;
    n.vel.y -= 6 * dt;
    n.pos.addScaledVector(n.vel, dt);
    n.mesh.rotation.set(n.t * 5, n.t * 7, 0);
    let done = n.t > 2.2 || n.pos.y < 0 || insideBuilding(n.pos);
    for (const c of crooks) {
      if (done || c.state === 'caught') continue;
      if (gv.a.copy(c.pos).setY(c.pos.y + 1).distanceToSquared(n.pos) < 2.4 * 2.4) {
        addStat('netCrook');
        if (n.from.distanceTo(c.pos) > 40) maxStat('longNet', 1);
        catchCrook(c, 'net');
        done = true;
      }
    }
    for (const p of peds) {
      if (done || p.state !== 'walk') continue;
      if (gv.a.copy(p.pos).setY(p.pos.y + 1).distanceToSquared(n.pos) < 1.6) { p.state = 'down'; p.timer = 3; done = true; }
    }
    if (done) { puff(n.pos, '#9be15d', 5, 0.3, 2); scene.remove(n.mesh); nets.splice(i, 1); }
  }
}

// ---- Portal Gun ----
let swirlTex = null;
function makeSwirl() {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(64, 64, 4, 64, 64, 64);
  gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.5, '#cccccc'); gr.addColorStop(1, '#777777');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  g.strokeStyle = 'rgba(255,255,255,.9)'; g.lineWidth = 5;
  for (let a = 0; a < 3; a++) {
    g.beginPath();
    for (let t = 0; t < 1; t += 0.02) {
      const ang = a * 2.094 + t * 5, r = t * 60;
      g.lineTo(64 + Math.cos(ang) * r, 64 + Math.sin(ang) * r);
    }
    g.stroke();
  }
  return new THREE.CanvasTexture(c);
}
function makePortalMesh(k) {
  if (!swirlTex) swirlTex = makeSwirl();
  const col = k ? '#ff8a2a' : '#3a9bff';
  const g = new THREE.Group();
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1, 0.12, 8, 40), new THREE.MeshBasicMaterial({ color: col }));
  const tex = swirlTex.clone(); tex.needsUpdate = true; tex.center.set(0.5, 0.5);
  const disc = new THREE.Mesh(new THREE.CircleGeometry(1, 40), new THREE.MeshBasicMaterial({ color: col, map: tex, transparent: true, opacity: 0.88, side: THREE.DoubleSide }));
  g.add(ring, disc);
  g.userData.tex = tex;
  scene.add(g);
  return g;
}
function placePortal(hp, hn) {
  const k = nextPortal;
  nextPortal = 1 - nextPortal;
  const p = portals[k] || (portals[k] = { pos: new V(), n: new V(), mesh: makePortalMesh(k) });
  p.pos.copy(hp); p.n.copy(hn);
  const floor = p.n.y > 0.5, wall = Math.abs(p.n.y) < 0.5;
  if (wall) p.pos.y = Math.max(p.pos.y, 2.1);
  p.pos.addScaledVector(p.n, 0.08);
  const m = p.mesh;
  m.position.copy(p.pos);
  if (wall) { m.rotation.set(0, 0, 0); m.lookAt(gv.b.copy(p.pos).add(p.n)); m.scale.set(1.35, 2, 1); }
  else { m.rotation.set(-Math.PI / 2 * Math.sign(p.n.y), 0, 0); m.scale.set(1.8, 1.8, 1); }
  SFX.portal();
  puff(p.pos, k ? '#ffb070' : '#7cc0ff', 6, 0.3, 3);
  if (!portals[1 - k]) floater(gv.c.copy(p.pos).addScaledVector(p.n, 1).setY(p.pos.y + 2.5), floor ? 'Now shoot the other portal!' : 'Now shoot the orange one!', '#fff');
}
const qPortal = new THREE.Quaternion();
// if this body (feet at pos) is going into a portal, move it out of the other one. Returns how far it went, or 0.
function portalTry(o, pos, vel) {
  if (!portals[0] || !portals[1] || o.portalCd > 0) return 0;
  for (let k = 0; k < 2; k++) {
    const P = portals[k], Q = portals[1 - k];
    const rel = gv.a.copy(pos); rel.y += 0.7; rel.sub(P.pos);
    const dn = rel.dot(P.n);
    if (dn > 1.4 || dn < -1.5) continue;
    const lat = rel.addScaledVector(P.n, -dn).length();
    const floor = P.n.y > 0.5;
    if (lat > (floor ? 1.7 : 1.9)) continue;
    if (!(vel.dot(P.n) < -0.5 || (floor && dn < 0.9))) continue;
    qPortal.setFromUnitVectors(gv.b.copy(P.n).negate(), Q.n);
    vel.applyQuaternion(qPortal);
    const out = vel.dot(Q.n);
    if (out < 12) vel.addScaledVector(Q.n, 12 - out);
    if (Q.n.y > 0.5) { vel.x += Math.sin(player.bodyYaw) * 2; vel.z += Math.cos(player.bodyYaw) * 2; } // drift off a floor portal
    pos.copy(Q.pos).addScaledVector(Q.n, 1.5); pos.y -= 0.7;
    if (Q.n.y < -0.5) pos.y -= 1.2;
    if (pos.y < 0) pos.y = 0;
    o.portalCd = 0.5;
    SFX.warp();
    return Math.max(1, P.pos.distanceTo(Q.pos));
  }
  return 0;
}
