'use strict';
// Shared helpers, the save file, sounds, and the gadget list everything else reads from.
const V = THREE.Vector3;
const $ = id => document.getElementById(id);
const clamp = (x, a, b) => x < a ? a : x > b ? b : x;
const lerp = (a, b, t) => a + (b - a) * t;
const rand = (a, b) => a + Math.random() * (b - a);
const pick = a => a[Math.random() * a.length | 0];
let seed = 20261015;
const srand = () => (seed = seed * 16807 % 2147483647) / 2147483647; // the same city every time
const GRAV = 25;
const UP = new V(0, 1, 0);

let state = 'menu'; // menu | play | lab
let renderer, scene, camera;
let camYaw = 0, camPitch = 0.12; // yaw 0 looks toward -z

// direction from a yaw and pitch (yaw 0 = -z, pitch up is positive)
function dirFrom(yaw, pitch, out) {
  const c = Math.cos(pitch);
  return out.set(-Math.sin(yaw) * c, Math.sin(pitch), -Math.cos(yaw) * c);
}
const yawOf = d => Math.atan2(-d.x, -d.z);
const pitchOf = d => Math.asin(clamp(d.y / (d.length() || 1), -1, 1));

// ---- Gadgets ----
// stats are counted as you play; a test passes when its stat reaches the goal
const GADGETS = [
  { id: 'hooks', name: 'Grapple Hooks', icon: '🪝', price: 0,
    desc: 'One hook on each arm. Shoot, hang on, swing, let go, fly.',
    tests: [
      { stat: 'swingDist', goal: 500, pay: 75, text: 'Swing 500 m' },
      { stat: 'hookYank', goal: 1, pay: 150, text: 'Hook a crook and yank them in' },
      { stat: 'tallRoof', goal: 1, pay: 100, text: 'Land on a roof over 100 m tall' },
      { stat: 'swingCatch', goal: 3, pay: 200, text: 'Swing-tackle 3 crooks' },
    ] },
  { id: 'fling', name: 'Fling Blaster', icon: '💥', price: 150,
    desc: 'A big blast of air. Fling crooks across the street, or aim at the ground to blast yourself into the sky.',
    tests: [
      { stat: 'flingCrook', goal: 1, pay: 150, text: 'Fling a crook' },
      { stat: 'blastJump', goal: 40, pay: 100, text: 'Blast yourself 40 m up (aim at your feet)' },
      { stat: 'flingCrook', goal: 5, pay: 250, text: 'Fling 5 crooks' },
    ] },
  { id: 'net', name: 'Net Launcher', icon: '🥅', price: 300,
    desc: 'Fires a sticky net. Wraps up a crook in one shot.',
    tests: [
      { stat: 'netCrook', goal: 1, pay: 150, text: 'Net a crook' },
      { stat: 'longNet', goal: 1, pay: 200, text: 'Net a crook from 40 m away' },
      { stat: 'netCrook', goal: 5, pay: 300, text: 'Net 5 crooks' },
    ] },
  { id: 'portal', name: 'Portal Gun', icon: '🌀', price: 600,
    desc: 'Shoot a blue portal, then an orange one. Anything that goes in one comes out the other.',
    tests: [
      { stat: 'portalTrip', goal: 1, pay: 75, text: 'Go through a portal' },
      { stat: 'portalFar', goal: 1, pay: 150, text: 'Portal more than 150 m in one hop' },
      { stat: 'portalCrook', goal: 1, pay: 250, text: 'Send a crook through a portal' },
    ] },
  { id: 'freeze', name: 'Freeze Ray', icon: '❄️', price: 900,
    desc: 'Freezes a crook in a block of ice. Touch them to make the catch.',
    tests: [
      { stat: 'freezeCrook', goal: 1, pay: 150, text: 'Freeze a crook' },
      { stat: 'freezeCatch', goal: 1, pay: 150, text: 'Catch a frozen crook' },
      { stat: 'freezeCrook', goal: 6, pay: 300, text: 'Freeze 6 crooks' },
    ] },
  { id: 'boots', name: 'Rocket Boots', icon: '🚀', price: 1300,
    desc: 'Hold the gadget button to blast off. Fuel refills while you rest.',
    tests: [
      { stat: 'bootDist', goal: 300, pay: 100, text: 'Fly 300 m on rocket boots' },
      { stat: 'bootHigh', goal: 1, pay: 150, text: 'Fly higher than 150 m' },
      { stat: 'bootCatch', goal: 1, pay: 250, text: 'Catch a crook while flying' },
    ] },
];
const gadgetById = id => GADGETS.find(g => g.id === id);

// ---- Save ----
const SAVE_KEY = 'gadget-lab-save-v1';
const SAVE_NEW = () => ({ cash: 0, owned: ['hooks'], equipped: 'hooks', stats: {}, done: [], caught: 0 });
let save = SAVE_NEW();
try { Object.assign(save, JSON.parse(localStorage.getItem(SAVE_KEY)) || {}); } catch (e) {}
function persist() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) {} }

// ---- Sound: tiny synth blips, nothing to download ----
let actx = null, noiseBuf = null;
function audioOn() {
  if (!actx) { try { actx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return; } }
  if (actx.state === 'suspended') actx.resume();
}
function tone(f1, f2, dur, type = 'sine', vol = 0.12, delay = 0) {
  if (!actx) return;
  const t = actx.currentTime + delay, o = actx.createOscillator(), g = actx.createGain();
  o.type = type; o.frequency.setValueAtTime(f1, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f2), t + dur);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g).connect(actx.destination); o.start(t); o.stop(t + dur + 0.02);
}
function noise(dur, vol = 0.15, freq = 1200, delay = 0) {
  if (!actx) return;
  if (!noiseBuf) {
    noiseBuf = actx.createBuffer(1, actx.sampleRate, actx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const t = actx.currentTime + delay, s = actx.createBufferSource(), f = actx.createBiquadFilter(), g = actx.createGain();
  s.buffer = noiseBuf; f.type = 'bandpass'; f.frequency.value = freq;
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  s.connect(f).connect(g).connect(actx.destination); s.start(t); s.stop(t + dur + 0.02);
}
const SFX = {
  hook: () => { tone(300, 1400, 0.15, 'sawtooth', 0.05); noise(0.12, 0.06, 3000); },
  attach: () => tone(900, 500, 0.06, 'square', 0.05),
  miss: () => tone(500, 200, 0.15, 'triangle', 0.05),
  jump: () => tone(250, 520, 0.12, 'triangle', 0.07),
  flip: () => tone(400, 900, 0.18, 'triangle', 0.07),
  fling: () => { noise(0.35, 0.3, 400); tone(160, 40, 0.35, 'sine', 0.3); },
  net: () => { noise(0.2, 0.12, 2000); tone(600, 300, 0.2, 'triangle', 0.05); },
  portal: () => { tone(200, 900, 0.3, 'sine', 0.1); tone(300, 1200, 0.3, 'sine', 0.05, 0.05); },
  warp: () => tone(1200, 150, 0.35, 'sine', 0.12),
  freeze: () => { tone(2000, 3000, 0.25, 'sine', 0.05); noise(0.3, 0.07, 6000); },
  boots: () => noise(0.14, 0.05, 500),
  cash: () => { tone(1320, 1320, 0.1, 'square', 0.05); tone(1760, 1760, 0.25, 'square', 0.05, 0.09); },
  alert: () => { tone(700, 700, 0.16, 'square', 0.04); tone(950, 950, 0.16, 'square', 0.04, 0.18); tone(700, 700, 0.16, 'square', 0.04, 0.36); },
  bonk: () => tone(180, 90, 0.15, 'square', 0.08),
  pass: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, f, 0.15, 'triangle', 0.07, i * 0.08)),
  click: () => tone(700, 700, 0.04, 'square', 0.03),
  roar: () => { tone(170, 55, 1.0, 'sawtooth', 0.12); tone(115, 45, 1.0, 'square', 0.05); noise(0.9, 0.2, 350); },
  flap: () => noise(0.3, 0.12, 200),
  fire: () => { noise(0.16, 0.13, 450); noise(0.16, 0.06, 1500); },
  // monster mode
  stomp: () => { tone(95, 28, 0.7, 'sine', 0.4); noise(0.5, 0.25, 140); },
  step: () => { tone(80, 35, 0.3, 'sine', 0.22); noise(0.2, 0.08, 120); },
  crash: () => { noise(1.1, 0.16, 260); noise(0.6, 0.08, 1100); tone(70, 32, 0.9, 'sine', 0.16); },
  punch: () => { tone(170, 55, 0.2, 'square', 0.1); noise(0.22, 0.2, 500); },
  beam: () => { tone(820, 1150, 0.13, 'sawtooth', 0.035); noise(0.13, 0.07, 3200); },
  zap: () => { noise(0.14, 0.12, 4500); tone(1900, 300, 0.14, 'square', 0.035); },
  bigRoar: () => { tone(240, 70, 1.7, 'sawtooth', 0.13); tone(360, 95, 1.7, 'square', 0.04); noise(1.5, 0.2, 520); },
  apeRoar: () => { tone(150, 60, 1.3, 'sawtooth', 0.13); tone(95, 50, 1.3, 'square', 0.05); noise(1.1, 0.22, 300); },
  hydraCry: () => [0, 0.14, 0.28].forEach((d, i) => tone(760 - i * 90, 240, 0.55, 'sawtooth', 0.055, d)),
  ouch: () => { tone(300, 120, 0.35, 'sawtooth', 0.09); noise(0.25, 0.15, 700); },
  win: () => [523, 659, 784, 1047, 784, 1047].forEach((f, i) => tone(f, f, 0.22, 'triangle', 0.08, i * 0.12)),
};

// ---- Small shared effects: things that grow, fade and go away on their own ----
const fx = [];
function addFx(obj, life, fn) { scene.add(obj); fx.push({ obj, t: 0, life, fn }); }
function updateFx(dt) {
  for (let i = fx.length - 1; i >= 0; i--) {
    const e = fx[i];
    e.t += dt;
    e.fn(e, Math.min(1, e.t / e.life), dt);
    if (e.t >= e.life) {
      scene.remove(e.obj);
      e.obj.traverse(o => { if (o.material && o.material.userData.fxOwned) o.material.dispose(); });
      fx.splice(i, 1);
    }
  }
}
const puffGeo = new THREE.IcosahedronGeometry(1, 0);
function puff(pos, color = '#ffffff', n = 8, size = 0.6, spread = 3) {
  for (let i = 0; i < n; i++) {
    const m = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9 });
    m.userData.fxOwned = true;
    const o = new THREE.Mesh(puffGeo, m);
    o.position.copy(pos);
    const v = new V(rand(-1, 1), rand(0.2, 1.2), rand(-1, 1)).multiplyScalar(spread);
    o.scale.setScalar(size);
    addFx(o, rand(0.4, 0.8), (e, k, dt) => {
      o.position.addScaledVector(v, dt);
      o.scale.setScalar(size * (1 + k));
      m.opacity = 0.9 * (1 - k);
    });
  }
}
