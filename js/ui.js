'use strict';
// HUD (money, aim rings, crook arrows, minimap, pop-up text), the Lab shop, and the menu.
const uv = { a: new V(), b: new V() };

// ---- pop-ups ----
const floaters = [];
function floater(pos, text, color = '#9be15d') {
  const el = document.createElement('div');
  el.className = 'fl'; el.textContent = text; el.style.color = color;
  $('floaters').appendChild(el);
  floaters.push({ el, pos: pos.clone(), t: 0 });
}
function toast(text, gold) {
  const el = document.createElement('div');
  el.className = 'toast' + (gold ? ' gold' : ''); el.textContent = text;
  const box = $('toasts');
  box.appendChild(el);
  while (box.children.length > 3) box.firstChild.remove();
  setTimeout(() => el.remove(), 4200);
}
let alertT = 0;
function showAlert(text) { const a = $('alert'); a.textContent = text; a.hidden = false; alertT = 4.5; }
function addCash(n, pos, text) {
  save.cash += n;
  if (pos) floater(pos, text || `+$${n}`);
  SFX.cash();
  updateCashUI();
}
function updateCashUI() {
  $('cashN').textContent = save.cash.toLocaleString();
  $('caughtN').textContent = save.caught;
  $('labCash').textContent = '$' + save.cash.toLocaleString();
}

// ---- gadgets ----
function updateGadgetUI() {
  const g = gadgetById(save.equipped) || GADGETS[0];
  $('gIcon').textContent = g.icon; $('tGIcon').textContent = g.icon;
  $('gName').textContent = g.id === 'hooks' ? 'Hooks (gadget = reel in)' : g.name;
  $('fuel').hidden = g.id !== 'boots';
}
function selectGadget(i) {
  const g = GADGETS[i];
  if (!g) return;
  if (!save.owned.includes(g.id)) { toast(`🔒 ${g.name} costs $${g.price}. Buy it in the Lab.`); return; }
  save.equipped = g.id; persist(); updateGadgetUI(); SFX.click();
}
function cycleGadget(dir) {
  const owned = GADGETS.filter(g => save.owned.includes(g.id));
  const i = owned.findIndex(g => g.id === save.equipped);
  save.equipped = owned[(i + dir + owned.length) % owned.length].id;
  persist(); updateGadgetUI(); SFX.click();
}
$('gPrev').addEventListener('click', () => cycleGadget(-1));
$('gNext').addEventListener('click', () => cycleGadget(1));

// ---- 1st / 3rd person ----
function setView(fp) {
  firstPerson = fp;
  player.bodyParts.forEach(o => { o.visible = !fp; });
  // in 1st person the arms sit a bit lower and smaller so they don't fill the screen
  player.arms.forEach((a, s) => { a.position.set((s ? -1 : 1) * (fp ? 0.36 : 0.42), fp ? 1.47 : 1.52, fp ? 0.2 : 0); a.scale.setScalar(fp ? 0.6 : 1); });
  $('viewBtn').textContent = fp ? '👁 1st' : '👁 3rd';
  document.querySelectorAll('#viewSeg button').forEach(b => b.setAttribute('aria-pressed', String((b.dataset.v === '1') === fp)));
  try { localStorage.setItem('gadget-lab-view', fp ? '1st' : '3rd'); } catch (e) {}
}
const toggleView = () => { setView(!firstPerson); SFX.click(); };
$('viewBtn').addEventListener('click', toggleView);
document.querySelectorAll('#viewSeg button').forEach(b => b.addEventListener('click', () => setView(b.dataset.v === '1')));

// ---- the Lab ----
function renderLab() {
  updateCashUI();
  $('labList').innerHTML = GADGETS.map((g, i) => {
    const own = save.owned.includes(g.id), eq = save.equipped === g.id;
    const tests = g.tests.map((t, k) => {
      const done = save.done.includes(g.id + k), have = Math.min(t.goal, Math.floor(save.stats[t.stat] || 0));
      const prog = t.goal > 1 && !done ? ` (${have}/${t.goal})` : '';
      return `<li class="${done ? 'done' : ''}">${t.text}${prog} <em>$${t.pay}</em></li>`;
    }).join('');
    const btn = own ? `<button class="gbtn" data-eq="${i}" ${eq ? 'disabled' : ''}>${eq ? 'Carrying' : 'Carry'}</button>`
      : `<button class="gbtn buy" data-buy="${i}" ${save.cash < g.price ? 'disabled' : ''}>Buy $${g.price}</button>`;
    return `<div class="gcard ${eq ? 'eq' : ''} ${own ? '' : 'locked'}"><div class="ic">${g.icon}</div><h3>${g.name}</h3><div class="act">${btn}</div><p>${g.desc}</p><ul>${tests}</ul></div>`;
  }).join('');
}
$('labList').addEventListener('click', e => {
  const b = e.target.closest('button');
  if (!b || b.disabled) return;
  if (b.dataset.buy) {
    const g = GADGETS[+b.dataset.buy];
    if (save.cash < g.price) return;
    save.cash -= g.price; save.owned.push(g.id); save.equipped = g.id;
    SFX.pass(); persist(); updateGadgetUI();
  } else if (b.dataset.eq) { save.equipped = GADGETS[+b.dataset.eq].id; SFX.click(); persist(); updateGadgetUI(); }
  renderLab();
});
function releaseAll() { for (let s = 0; s < 2; s++) holdSrc[s].clear(); keys.clear(); held.touchGadget = held.touchReel = false; }
function openLab() {
  state = 'lab'; releaseAll();
  if (document.pointerLockElement) document.exitPointerLock();
  renderLab(); $('lab').hidden = false; $('menu').hidden = true;
  const b = $('lab').querySelector('button:not([disabled])'); if (b) b.focus();
}
function closeLab() { $('lab').hidden = true; startPlay(); }
function openMenu() {
  state = 'menu'; releaseAll();
  if (document.pointerLockElement) document.exitPointerLock();
  $('menu').hidden = false; $('lab').hidden = true; $('hud').hidden = true;
  $('playBtn').textContent = 'Keep playing';
  $('playBtn').focus();
}
let tipsT = 0, tipI = 0;
const isTouch = () => document.body.classList.contains('touch');
function startPlay() {
  audioOn();
  state = 'play';
  $('menu').hidden = true; $('lab').hidden = true; $('hud').hidden = false;
  updateCashUI(); updateGadgetUI();
  if (!isTouch() && matchMedia('(pointer: fine)').matches) lockMouse();
  tipsT = 0; tipI = 0; nextTip();
}
$('playBtn').addEventListener('click', startPlay);
$('menuLabBtn').addEventListener('click', () => { audioOn(); openLab(); });
$('labClose').addEventListener('click', closeLab);
$('labBtn').addEventListener('click', openLab);
$('menuBtn').addEventListener('click', openMenu);
$('resetBtn').addEventListener('click', () => {
  if (!confirm('Erase all your money, gadgets and tests and start over?')) return;
  save = SAVE_NEW(); persist(); updateCashUI(); updateGadgetUI();
});

const TIPS = () => [
  isTouch() || camOn ? (camOn ? 'Flick a wand up to shoot a hook where it points · flick it down to let go' : 'Tap the city to shoot a hook there · tap the hook button to let go')
    : 'Click the game to look around · left and right click shoot your hooks · hold to hang on',
  'Shoot a hook, swing, let go at the bottom of the swing, and fly!',
  'Crooks have a red ! over them. Catch them for cash: run into them, or use a gadget for bigger pay',
  'Spend your cash in the 🧪 Lab on new gadgets. Every gadget has tests that pay extra',
];
function nextTip() {
  const t = TIPS(), h = $('hint');
  if (tipI >= t.length) { h.style.opacity = 0; return; }
  h.textContent = t[tipI++]; h.style.opacity = 1; tipsT = 7;
}

// ---- per-frame HUD ----
const scr = { x: 0, y: 0, on: false };
function toScreen(p) {
  uv.a.copy(p).project(camera);
  scr.on = uv.a.z < 1 && Math.abs(uv.a.x) < 1 && Math.abs(uv.a.y) < 1;
  scr.x = (uv.a.x + 1) / 2 * innerWidth; scr.y = (1 - uv.a.y) / 2 * innerHeight;
  return scr;
}
const retRes = { p: new V(), crook: null, ok: false };
let hudFrame = 0;
function updateHud(dt) {
  hudFrame++;
  for (let i = floaters.length - 1; i >= 0; i--) {
    const f = floaters[i];
    f.t += dt;
    const s = toScreen(f.pos);
    if (f.t > 1.6) { f.el.remove(); floaters.splice(i, 1); continue; }
    f.el.style.display = uv.a.z < 1 ? '' : 'none';
    f.el.style.transform = `translate(${s.x}px, ${s.y - f.t * 50}px) translate(-50%, -50%) scale(${1 + Math.min(f.t * 4, 0.3)})`;
    f.el.style.opacity = String(1 - Math.max(0, f.t - 1) / 0.6);
  }
  if (alertT > 0 && (alertT -= dt) <= 0) $('alert').hidden = true;
  if (state !== 'play') return;
  if (tipsT > 0 && (tipsT -= dt) <= 0) nextTip();
  if (save.equipped === 'boots') $('fuel').firstChild.style.width = (player.fuel * 100).toFixed(0) + '%';

  // aim rings: where each hook would land right now
  if (hudFrame % 2 === 0) for (let s = 0; s < 2; s++) {
    const el = $(s ? 'retR' : 'retL'), h = player.hooks[s];
    if (h.state === 'on' || h.state === 'fly') { const p = toScreen(h.anchor); el.style.transform = `translate(${p.x}px, ${p.y}px)`; el.className = 'ret' + (h.crook ? ' crook' : ''); el.style.display = p.on ? '' : 'none'; continue; }
    const o = handPos(s, uv.b), d = hookAimDir(s, new V());
    findHookTarget(o, d, retRes);
    const p = toScreen(retRes.ok ? retRes.p : uv.b.addScaledVector(d, 40));
    el.style.display = uv.a.z < 1 ? '' : 'none';
    el.style.transform = `translate(${p.x}px, ${p.y}px)`;
    el.className = 'ret' + (!retRes.ok ? ' miss' : retRes.crook ? ' crook' : '');
  }

  // arrows at the screen edge pointing to crooks that are off screen
  const box = $('arrows'), live = crooks.filter(c => c.state !== 'caught');
  while (box.children.length < live.length) { const a = document.createElement('div'); a.className = 'arr'; a.innerHTML = '<i></i><span></span>'; box.appendChild(a); }
  [...box.children].forEach((el, i) => {
    const c = live[i];
    if (!c) { el.style.display = 'none'; return; }
    const s = toScreen(uv.b.copy(c.pos).setY(c.pos.y + 2));
    if (s.on) { el.style.display = 'none'; return; }
    el.style.display = '';
    let dx = uv.a.x, dy = -uv.a.y;
    if (uv.a.z > 1) { dx = -dx; dy = -dy; }
    const ang = Math.atan2(dy, dx), m = 56, W = innerWidth, H = innerHeight;
    const k = Math.min((W / 2 - m) / Math.max(0.001, Math.abs(Math.cos(ang))), (H / 2 - m) / Math.max(0.001, Math.abs(Math.sin(ang))));
    const x = W / 2 + Math.cos(ang) * k, y = H / 2 + Math.sin(ang) * k;
    el.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%)`;
    el.firstChild.style.transform = `rotate(${ang + Math.PI / 2}rad)`;
    el.lastChild.textContent = Math.round(c.pos.distanceTo(player.pos)) + ' m';
  });

  if (hudFrame % 3 === 0) drawMinimap();
}

const MM = $('minimap').getContext('2d'), MM_R = 100, MM_RANGE = 190;
const BLOCK_COL = { city: '#7b818c', park: '#4f9a45', hq: '#ff8a2a' };
function drawMinimap() {
  const g = MM, s = MM_R / MM_RANGE, px = player.pos.x, pz = player.pos.z;
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.clearRect(0, 0, 200, 200);
  g.save();
  g.beginPath(); g.arc(100, 100, 99, 0, 7); g.clip();
  g.fillStyle = '#2b3038'; g.fillRect(0, 0, 200, 200);
  g.translate(100, 100); g.rotate(camYaw); g.scale(s, s); g.translate(-px, -pz);
  for (const b of blocks) {
    const cx = bx(b.i), cz = bx(b.j);
    if (Math.abs(cx - px) > MM_RANGE + 60 || Math.abs(cz - pz) > MM_RANGE + 60) continue;
    g.fillStyle = BLOCK_COL[b.type];
    g.fillRect(cx - BLOCK / 2, cz - BLOCK / 2, BLOCK, BLOCK);
    g.fillStyle = '#b4bac4';
    for (const q of b.list) { const k = q * 3; g.fillRect(bmin[k], bmin[k + 2], bmax[k] - bmin[k], bmax[k + 2] - bmin[k + 2]); }
  }
  portals.forEach((p, k) => { if (!p) return; g.fillStyle = k ? '#ff8a2a' : '#3a9bff'; g.beginPath(); g.arc(p.pos.x, p.pos.z, 5 / s, 0, 7); g.fill(); });
  g.restore();
  // crooks: red dots, stuck to the edge when they're far away
  const cy = Math.cos(camYaw), sy = Math.sin(camYaw);
  for (const c of crooks) {
    if (c.state === 'caught') continue;
    const dx = (c.pos.x - px) * s, dz = (c.pos.z - pz) * s;
    let x = dx * cy - dz * sy, y = dx * sy + dz * cy;
    const L = Math.hypot(x, y);
    if (L > 88) { x *= 88 / L; y *= 88 / L; }
    g.fillStyle = '#ff3b3b'; g.strokeStyle = '#fff'; g.lineWidth = 2;
    g.beginPath(); g.arc(100 + x, 100 + y, 7, 0, 7); g.fill(); g.stroke();
  }
  // you, always in the middle pointing the way the camera looks
  g.fillStyle = '#9be15d'; g.strokeStyle = '#14213d'; g.lineWidth = 2;
  g.beginPath(); g.moveTo(100, 88); g.lineTo(109, 108); g.lineTo(100, 103); g.lineTo(91, 108); g.closePath(); g.fill(); g.stroke();
}

// tell long-open tabs that a newer game is on the site
async function checkForUpdate() {
  try {
    const txt = await (await fetch(location.pathname + '?vcheck=' + Date.now(), { cache: 'no-store' })).text();
    const m = txt.match(/APP_VERSION = '([^']+)'/);
    if (m && m[1] !== APP_VERSION) $('update').hidden = false;
  } catch (e) {}
}
$('update').addEventListener('click', () => location.reload());
setTimeout(checkForUpdate, 5000);
setInterval(checkForUpdate, 90000);
