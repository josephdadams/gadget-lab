'use strict';
// Keyboard + mouse, touch, and controllers all feed one set of controls (the camera wands live in wands.js).
const inp = { mx: 0, mz: 0, jump: false, gadgetPress: false, gadgetHeld: false, reel: false, lookX: 0, lookY: 0, jumpQ: false, gPressQ: false };
const keys = new Set();
const canvas = $('game');
let lastTouchT = -1e9, mouseMid = false;
const held = { touchGadget: false, touchReel: false, padGadget: false, padReel: false, wandGadget: false };

// each hook can be held by several things at once (mouse, key, button); it lets go when the last one does
const holdSrc = [new Set(), new Set()];
function holdHook(side, src, down) {
  const s = holdSrc[side], was = s.size > 0;
  if (down) s.add(src); else s.delete(src);
  if (state !== 'play') { s.clear(); return; }
  if (!was && s.size) fireHook(side);
  else if (was && !s.size) releaseHook(side);
}
// aim a hook at a spot on the screen (touch taps and wand flicks)
const ray = new THREE.Raycaster();
function hookAtScreen(side, x, y) {
  ray.setFromCamera({ x: x / innerWidth * 2 - 1, y: -(y / innerHeight * 2 - 1) }, camera);
  fireHook(side, ray.ray.direction.clone(), camera.position.clone());
}

// ---- Keyboard ----
addEventListener('keydown', e => {
  const k = e.code;
  if (k === 'Tab') e.preventDefault();
  if (e.repeat) return;
  keys.add(k);
  if (state === 'play') {
    if (k === 'Space') { inp.jumpQ = true; e.preventDefault(); }
    else if (k === 'KeyQ') holdHook(0, 'kq', true);
    else if (k === 'KeyE') holdHook(1, 'ke', true);
    else if (k === 'KeyF') inp.gPressQ = true;
    else if (/^Digit[1-6]$/.test(k)) selectGadget(+k.slice(5) - 1);
    else if (k === 'Tab') openLab();
    else if (k === 'Escape') openMenu();
  } else if (state === 'lab' && (k === 'Tab' || k === 'Escape')) closeLab();
});
addEventListener('keyup', e => {
  keys.delete(e.code);
  if (e.code === 'KeyQ') holdHook(0, 'kq', false);
  if (e.code === 'KeyE') holdHook(1, 'ke', false);
});
addEventListener('blur', () => { keys.clear(); for (let s = 0; s < 2; s++) { holdSrc[s].clear(); } });

function lockMouse() {
  try { const p = canvas.requestPointerLock && canvas.requestPointerLock(); if (p && p.catch) p.catch(() => {}); } catch (e) {}
}
// ---- Mouse (both buttons at once is normal here, so use mouse events rather than pointer events) ----
canvas.addEventListener('mousedown', e => {
  if (state !== 'play' || performance.now() - lastTouchT < 1000) return;
  if (document.pointerLockElement !== canvas) { lockMouse(); return; }
  if (e.button === 0) holdHook(0, 'm0', true);
  else if (e.button === 2) holdHook(1, 'm2', true);
  else if (e.button === 1) { inp.gPressQ = true; mouseMid = true; e.preventDefault(); }
});
addEventListener('mouseup', e => {
  if (e.button === 0) holdHook(0, 'm0', false);
  else if (e.button === 2) holdHook(1, 'm2', false);
  else if (e.button === 1) mouseMid = false;
});
addEventListener('mousemove', e => {
  if (document.pointerLockElement !== canvas) return;
  inp.lookX += e.movementX * 0.0024; inp.lookY += e.movementY * 0.0024;
  autoCam = false; lastLookT = performance.now();
});
canvas.addEventListener('contextmenu', e => e.preventDefault());
let wheelT = 0;
addEventListener('wheel', e => {
  if (state !== 'play' || performance.now() - wheelT < 180) return;
  wheelT = performance.now(); cycleGadget(e.deltaY > 0 ? 1 : -1);
}, { passive: true });

// ---- Touch: left thumb runs, right thumb looks, a quick tap shoots a hook at that spot ----
const touches = new Map();
const stick = { id: null, cx: 0, cy: 0, x: 0, y: 0 };
const STICK_R = 60;
canvas.addEventListener('pointerdown', e => {
  if (e.pointerType === 'mouse') return;
  lastTouchT = performance.now();
  document.body.classList.add('touch'); autoCam = true;
  if (state !== 'play') return;
  const t = { x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY, t0: performance.now(), kind: 'look' };
  if (e.clientX < innerWidth * 0.4 && stick.id === null) {
    t.kind = 'stick'; stick.id = e.pointerId; stick.cx = e.clientX; stick.cy = e.clientY; stick.x = stick.y = 0;
    const s = $('stick'); s.style.left = e.clientX + 'px'; s.style.top = e.clientY + 'px'; s.classList.add('on');
    $('knob').style.transform = '';
  }
  touches.set(e.pointerId, t);
  try { canvas.setPointerCapture(e.pointerId); } catch (err) {}
});
canvas.addEventListener('pointermove', e => {
  const t = touches.get(e.pointerId);
  if (!t) return;
  if (t.kind === 'look') {
    inp.lookX += (e.clientX - t.x) * 0.006; inp.lookY += (e.clientY - t.y) * 0.006;
    lastLookT = performance.now();
  } else {
    let ox = e.clientX - stick.cx, oy = e.clientY - stick.cy;
    const L = Math.hypot(ox, oy);
    if (L > STICK_R) { ox *= STICK_R / L; oy *= STICK_R / L; }
    stick.x = ox / STICK_R; stick.y = oy / STICK_R;
    $('knob').style.transform = `translate(${ox}px, ${oy}px)`;
  }
  t.x = e.clientX; t.y = e.clientY;
});
function touchEnd(e) {
  const t = touches.get(e.pointerId);
  if (!t) return;
  touches.delete(e.pointerId);
  if (t.kind === 'stick') { stick.id = null; stick.x = stick.y = 0; $('stick').classList.remove('on'); }
  const quick = performance.now() - t.t0 < 260 && Math.hypot(t.x - t.x0, t.y - t.y0) < 16;
  if (quick && state === 'play' && e.type === 'pointerup') hookAtScreen(t.x0 < innerWidth / 2 ? 0 : 1, t.x0, t.y0);
}
canvas.addEventListener('pointerup', touchEnd);
canvas.addEventListener('pointercancel', touchEnd);

function touchButton(id, down, up) {
  const b = $(id);
  b.addEventListener('pointerdown', e => {
    e.preventDefault(); e.stopPropagation(); lastTouchT = performance.now();
    b.classList.add('on'); try { b.setPointerCapture(e.pointerId); } catch (err) {}
    down();
  });
  const end = e => { if (!b.classList.contains('on')) return; b.classList.remove('on'); up && up(); };
  b.addEventListener('pointerup', end); b.addEventListener('pointercancel', end);
  b.addEventListener('contextmenu', e => e.preventDefault());
}
for (const [id, side] of [['tHookL', 0], ['tHookR', 1]]) {
  let letGo = false;
  touchButton(id, () => {
    // a hook you shot by tapping the city: tapping its button lets go
    letGo = player.hooks[side].state !== 'none' && holdSrc[side].size === 0;
    if (letGo) releaseHook(side); else holdHook(side, 'touch', true);
  }, () => { if (!letGo) holdHook(side, 'touch', false); });
}
touchButton('tJump', () => { inp.jumpQ = true; });
touchButton('tGadget', () => { inp.gPressQ = true; held.touchGadget = true; }, () => { held.touchGadget = false; });
touchButton('tReel', () => { held.touchReel = true; }, () => { held.touchReel = false; });

// ---- Controllers ----
const padPrev = {};
let padNavT = 0;
function pollPads(dt, acc) {
  const pads = navigator.getGamepads ? navigator.getGamepads() : [];
  held.padGadget = held.padReel = false;
  for (const gp of pads) {
    if (!gp) continue;
    const cur = gp.buttons.map(b => b.pressed || b.value > 0.4);
    const prev = padPrev[gp.index] || cur.map(() => false);
    padPrev[gp.index] = cur;
    const pressed = i => cur[i] && !prev[i];
    const ax = i => { const v = gp.axes[i] || 0; return Math.abs(v) < 0.18 ? 0 : v; };
    if (cur.some(Boolean)) autoCam = true;
    if (state === 'play') {
      acc.mx += ax(0); acc.mz -= ax(1);
      const lx = ax(2), ly = ax(3);
      if (lx || ly) { inp.lookX += lx * Math.abs(lx) * 3.2 * dt; inp.lookY += ly * Math.abs(ly) * 2.4 * dt; lastLookT = performance.now(); }
      if (pressed(0)) inp.jumpQ = true;
      if (cur[6] !== prev[6]) holdHook(0, 'pad' + gp.index, cur[6]);
      if (cur[7] !== prev[7]) holdHook(1, 'pad' + gp.index, cur[7]);
      if (pressed(5) || pressed(2)) inp.gPressQ = true;
      if (cur[5] || cur[2]) held.padGadget = true;
      if (cur[4] || cur[1]) held.padReel = true;
      if (pressed(3) || pressed(15)) cycleGadget(1);
      if (pressed(14)) cycleGadget(-1);
      if (pressed(9)) openLab();
      if (pressed(8)) openMenu();
    } else {
      // menus: D-pad or left stick moves, A picks, B goes back, Start plays
      const now = performance.now(), vy = ax(1);
      if (pressed(12) || (vy < -0.5 && now > padNavT)) { moveFocus(-1); padNavT = now + 250; }
      if (pressed(13) || (vy > 0.5 && now > padNavT)) { moveFocus(1); padNavT = now + 250; }
      if (pressed(0)) { const f = document.activeElement; if (f && f.click && f !== document.body) f.click(); else if (state === 'menu') startPlay(); }
      if (pressed(1) && state === 'lab') closeLab();
      if (pressed(9)) { if (state === 'lab') closeLab(); else startPlay(); }
    }
  }
}
function moveFocus(dir) {
  const root = state === 'lab' ? $('lab') : $('menu');
  const list = [...root.querySelectorAll('button, summary')].filter(b => b.offsetParent && !b.disabled);
  if (!list.length) return;
  const i = list.indexOf(document.activeElement);
  const n = list[i < 0 ? 0 : (i + dir + list.length) % list.length];
  n.focus(); n.scrollIntoView({ block: 'nearest' });
}

function pollInput(dt) {
  const acc = { mx: 0, mz: 0 };
  if (state === 'play') {
    if (keys.has('KeyW') || keys.has('ArrowUp')) acc.mz += 1;
    if (keys.has('KeyS') || keys.has('ArrowDown')) acc.mz -= 1;
    if (keys.has('KeyA') || keys.has('ArrowLeft')) acc.mx -= 1;
    if (keys.has('KeyD') || keys.has('ArrowRight')) acc.mx += 1;
    if (stick.id !== null) { acc.mx += stick.x; acc.mz -= stick.y; }
  }
  pollPads(dt, acc);
  wandControls(dt, acc);
  inp.mx = clamp(acc.mx, -1, 1); inp.mz = clamp(acc.mz, -1, 1);
  inp.reel = keys.has('ShiftLeft') || keys.has('ShiftRight') || held.touchReel || held.padReel;
  inp.gadgetHeld = keys.has('KeyF') || mouseMid || held.touchGadget || held.padGadget || held.wandGadget;
  inp.jump = inp.jumpQ; inp.jumpQ = false;
  inp.gadgetPress = inp.gPressQ; inp.gPressQ = false;
  camYaw -= inp.lookX;
  camPitch = clamp(camPitch - inp.lookY, -1.2, 1.25);
  inp.lookX = inp.lookY = 0;
}
