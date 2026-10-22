'use strict';
// Crooks: they grab something, then run along the sidewalks. They run faster and away from you once you get close.
const crooks = [];
const LOOT = ['a purse', 'a giant pizza', 'a gold trophy', 'a bag of money', 'a birthday cake', 'a robot puppy', "the mayor's hat",
  'a crate of bananas', 'a skateboard', 'a box of donuts', 'a museum dinosaur egg', 'a puppy-sized diamond'];
const PAY = { tackle: 50, swing: 100, hooks: 120, fling: 150, net: 150, freeze: 150, portal: 200, boots: 150, fire: 150, dragon: 200 };
const HOW = { tackle: 'Tackled!', swing: 'Swing tackle!', hooks: 'Hooked!', fling: 'Flung!', net: 'Netted!', freeze: 'Iced!', portal: 'Portaled!', boots: 'Rocket tackle!', fire: 'Toasted!', dragon: 'Dragon snatch!' };
const latX = a => bx(a) + CELL / 2 - 10; // the sidewalk line running past each block
let crimeT = 3;
let crookMats = null;

function crookMaterials() {
  const c = document.createElement('canvas'); c.width = 16; c.height = 64;
  const g = c.getContext('2d');
  for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? '#111' : '#f4f4f4'; g.fillRect(0, i * 8, 16, 8); }
  const stripes = new THREE.CanvasTexture(c);
  const m = document.createElement('canvas'); m.width = m.height = 64;
  const mg = m.getContext('2d');
  mg.fillStyle = '#ff2b2b'; mg.beginPath(); mg.arc(32, 32, 28, 0, 7); mg.fill();
  mg.strokeStyle = '#fff'; mg.lineWidth = 5; mg.stroke();
  mg.fillStyle = '#fff'; mg.font = 'bold 44px sans-serif'; mg.textAlign = 'center'; mg.textBaseline = 'middle'; mg.fillText('!', 32, 34);
  const ok = document.createElement('canvas'); ok.width = ok.height = 64;
  const og = ok.getContext('2d');
  og.fillStyle = '#2ecc71'; og.beginPath(); og.arc(32, 32, 28, 0, 7); og.fill();
  og.fillStyle = '#fff'; og.font = 'bold 40px sans-serif'; og.textAlign = 'center'; og.textBaseline = 'middle'; og.fillText('✓', 32, 34);
  return {
    stripes: new THREE.MeshLambertMaterial({ map: stripes }), black: new THREE.MeshLambertMaterial({ color: '#1b1b1f' }),
    skin: new THREE.MeshLambertMaterial({ color: '#e0ac69' }), mask: new THREE.MeshLambertMaterial({ color: '#e01e37' }),
    bag: new THREE.MeshLambertMaterial({ color: '#c9a227' }), cuffs: new THREE.MeshLambertMaterial({ color: '#4fd8ff', emissive: '#145a6a' }),
    ice: new THREE.MeshLambertMaterial({ color: '#bfefff', transparent: true, opacity: 0.55, emissive: '#2a6f86' }),
    net: new THREE.MeshBasicMaterial({ color: '#9be15d', wireframe: true }),
    marker: new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(m), depthTest: false, sizeAttenuation: false }),
    markerOk: new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(ok), depthTest: false, sizeAttenuation: false }),
  };
}

function makeCrookMesh() {
  const M = crookMats || (crookMats = crookMaterials());
  const g = new THREE.Group();
  const legs = [-0.13, 0.13].map(x => {
    const piv = new THREE.Group(); piv.position.set(x, 0.82, 0);
    const l = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.82, 0.24), M.black); l.position.y = -0.41;
    piv.add(l); g.add(piv); return piv;
  });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.72, 0.34), M.stripes); torso.position.y = 1.18;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), M.skin); head.position.y = 1.72;
  const mask = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.1, 0.3), M.mask); mask.position.set(0, 1.74, 0.06);
  const hat = new THREE.Mesh(new THREE.SphereGeometry(0.23, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), M.black); hat.position.y = 1.78;
  const bag = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 6), M.bag); bag.position.set(0.32, 1.05, -0.28);
  const cuffs = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.04, 6, 14), M.cuffs); cuffs.position.set(0, 1.0, -0.22); cuffs.visible = false;
  const ice = new THREE.Mesh(new THREE.BoxGeometry(1.2, 2.2, 1.2), M.ice); ice.position.y = 1.05; ice.visible = false;
  const net = new THREE.Mesh(new THREE.SphereGeometry(0.85, 8, 6), M.net); net.scale.y = 1.3; net.position.y = 1.0; net.visible = false;
  const marker = new THREE.Sprite(M.marker); marker.scale.set(0.05, 0.05, 1); marker.position.y = 3; marker.renderOrder = 10;
  g.add(torso, head, mask, hat, bag, cuffs, ice, net, marker);
  scene.add(g);
  return { g, legs, bag, cuffs, ice, net, marker };
}

function spawnCrook() {
  const pl = player.pos, first = save.caught === 0;
  const minD = first ? 30 : 70, maxD = first ? 95 : 260;
  for (let tries = 0; tries < 60; tries++) {
    const a = Math.floor(Math.random() * N), b = Math.floor(Math.random() * N);
    const x = latX(a), z = latX(b), d = Math.hypot(x - pl.x, z - pl.z);
    if (d < minD || d > maxD) continue;
    const c = { a, b, pa: -1, pb: -1, pos: new V(x, 0, z), vel: new V(), state: 'run', timer: 0, life: 150, anim: 0, yaw: 0, spin: 0,
      flee: false, credit: null, portalCd: 0, loot: pick(LOOT), m: makeCrookMesh() };
    crookNext(c);
    crooks.push(c);
    showAlert(`🚨 Stop, thief! A crook grabbed ${c.loot}!`);
    SFX.alert();
    scareNear(c.pos, 20);
    return c;
  }
}

function crookNext(c) {
  let best = null, bs = -1e9;
  for (const [da, db] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const a = c.a + da, b = c.b + db;
    if (a < 0 || b < 0 || a >= N || b >= N || (a === c.pa && b === c.pb)) continue;
    let s = Math.random() * 40;
    if (c.flee) s += Math.hypot(latX(a) - player.pos.x, latX(b) - player.pos.z) * 2;
    if (s > bs) { bs = s; best = [a, b]; }
  }
  c.pa = c.a; c.pb = c.b;
  [c.a, c.b] = best || [c.pa, c.pb];
}

const cTmp = new V();
function updateCrooks(dt) {
  crimeT -= dt;
  const active = crooks.filter(c => c.state !== 'caught').length;
  if (crimeT <= 0) {
    if (active < 3) spawnCrook();
    crimeT = active === 0 ? 6 : rand(14, 26);
  }
  for (let i = crooks.length - 1; i >= 0; i--) {
    const c = crooks[i], m = c.m;
    c.portalCd -= dt; c.life -= dt; c.anim += dt;
    let legSwing = 0;
    if (c.state === 'run') {
      const dp = Math.hypot(player.pos.x - c.pos.x, player.pos.z - c.pos.z);
      const wasFlee = c.flee;
      c.flee = dp < 32;
      if (c.flee && !wasFlee) crookNext(c); // just spotted you: turn and run the other way
      const sp = c.flee ? 8.4 : 6;
      cTmp.set(latX(c.a) - c.pos.x, 0, latX(c.b) - c.pos.z);
      const d = cTmp.length();
      if (d < 0.8) crookNext(c);
      else {
        cTmp.multiplyScalar(1 / d);
        c.vel.set(cTmp.x * sp, 0, cTmp.z * sp);
        c.pos.addScaledVector(c.vel, dt);
        c.yaw = Math.atan2(cTmp.x, cTmp.z);
      }
      if (c.pos.y > 0) c.pos.y = Math.max(0, c.pos.y - 12 * dt);
      if (portalTry(c, c.pos, c.vel)) { c.state = 'fly'; c.credit = 'portal'; addStat('portalCrook'); }
      legSwing = Math.sin(c.anim * sp * 1.6) * 0.9;
      if (Math.random() < dt) scareNear(c.pos, 8);
      if (c.life < 0 && dp > 70) {
        showAlert(`💨 The crook with ${c.loot} got away.`);
        removeCrook(i); continue;
      }
    } else if (c.state === 'fly') {
      c.vel.y -= GRAV * dt;
      c.pos.addScaledVector(c.vel, dt);
      c.spin += dt * 8;
      if (portalTry(c, c.pos, c.vel)) { if (c.credit !== 'portal') addStat('portalCrook'); c.credit = 'portal'; }
      if (collideBody(c.pos, c.vel, 0.35, 1.8) && c.vel.y <= 0.1) catchCrook(c, c.credit || 'tackle');
    } else if (c.state === 'frozen') {
      c.timer -= dt;
      if (c.timer <= 0) { c.state = 'run'; m.ice.visible = false; }
    } else if (c.state === 'yank') {
      cTmp.copy(player.pos).sub(c.pos); cTmp.y += 0.4;
      const d = cTmp.length();
      if (d < 2.2) catchCrook(c, 'hooks');
      else { c.pos.addScaledVector(cTmp, Math.min(1, 45 * dt / d)); c.spin += dt * 6; }
    } else if (c.state === 'caught') {
      c.timer -= dt;
      if (c.pos.y > 0 && !c.onRoof) c.pos.y = Math.max(0, c.pos.y - 15 * dt);
      if (c.timer <= 0) { puff(cTmp.copy(c.pos).setY(c.pos.y + 1), '#cfe8ff', 10, 0.5); removeCrook(i); continue; }
    }
    // pose the model
    m.g.position.copy(c.pos);
    m.g.rotation.set(c.state === 'fly' || c.state === 'yank' ? c.spin : 0, c.yaw, 0);
    m.legs[0].rotation.x = legSwing; m.legs[1].rotation.x = -legSwing;
    m.marker.position.y = 3 + Math.sin(c.anim * 4) * 0.25;
    if (c.state === 'caught') m.g.rotation.y = c.yaw + c.anim * 3;
  }
}

function removeCrook(i) {
  const c = crooks[i];
  scene.remove(c.m.g);
  c.m.g.traverse(o => { if (o.geometry) o.geometry.dispose(); });
  crooks.splice(i, 1);
  for (const h of player.hooks) if (h.crook === c) { h.state = 'none'; h.crook = null; }
}

function catchCrook(c, how) {
  if (c.state === 'caught') return;
  c.state = 'caught'; c.timer = 2.4; c.vel.set(0, 0, 0); c.anim = 0;
  c.onRoof = c.pos.y > 0.5;
  const m = c.m;
  m.bag.visible = false; m.cuffs.visible = true; m.ice.visible = false;
  if (how === 'net') m.net.visible = true;
  m.marker.material = crookMats.markerOk;
  const pay = PAY[how] || 50;
  save.caught++;
  if (how === 'swing') addStat('swingCatch');
  if (how === 'hooks') addStat('hookYank');
  if (how === 'freeze') addStat('freezeCatch');
  if (how === 'boots') addStat('bootCatch');
  addCash(pay, cTmp.copy(c.pos).setY(c.pos.y + 2.4), `${HOW[how]} +$${pay}`);
  showAlert(`🚔 Got ${c.loot} back!`);
  for (const h of player.hooks) if (h.crook === c) { h.state = 'none'; h.crook = null; }
  persist();
}
