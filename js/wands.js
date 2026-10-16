'use strict';
// Camera wands: the camera looks for two bright colors (one wand in each hand), the same way Ribbit Tag does.
// Flick a wand up to shoot that arm's hook where it points, flick it down to let go, pull it close to use your gadget.
const WAND_DEF = [{ h: 105, s: 0.6, v: 0.6 }, { h: 330, s: 0.6, v: 0.65 }]; // neon green, hot pink
let wandCols = WAND_DEF.map(c => Object.assign({}, c));
try { const s = JSON.parse(localStorage.getItem('gadget-lab-wandcols')); if (Array.isArray(s) && s.length === 2) wandCols = s; } catch (e) {}
let camOn = false, camFacing = 'user', camStream = null, camVideo = null, wandCv = null;
try { camOn = localStorage.getItem('gadget-lab-cam') === '1'; camFacing = localStorage.getItem('gadget-lab-camfacing') || 'user'; } catch (e) {}
let wandCal = 0, camNextT = 0, camGap = 40, camLastT = -1;
const wandBase = [0, 0];
const wands = [0, 1].map(() => ({ on: false, x: 0.5, y: 0.5, fx: 0, fy: 0, ft: 0, seen: 0, flickT: 0, grip: false }));
let wandGripWas = false;

function camSay(text) { const n = $('camNote'); n.hidden = !text; n.textContent = text || ''; }
async function camStart() {
  camSay('Starting the camera...');
  try {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) throw new Error('nocam');
    camStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: camFacing, width: { ideal: 320 }, height: { ideal: 240 } }, audio: false });
  } catch (e) {
    setCam(false);
    camSay(e && e.name === 'NotAllowedError' ? 'The tablet said no to the camera. Tap Wands again and pick Allow.' : "Couldn't find a camera to use.");
    return;
  }
  if (!camOn) { camStop(); return; }
  if (!camVideo) { camVideo = document.createElement('video'); camVideo.muted = true; camVideo.playsInline = true; camVideo.setAttribute('playsinline', ''); }
  camVideo.srcObject = camStream;
  try { await camVideo.play(); } catch (e) {}
  camSay((camFacing === 'user' ? 'Hold the tablet so the camera sees both wands.' : 'Point the back camera at your wands.') +
    ' Flick a wand up to shoot a hook, flick it down to let go, and pull one close to use your gadget.');
}
function camStop() {
  if (camStream) camStream.getTracks().forEach(t => t.stop());
  camStream = null; camLastT = -1;
  if (camVideo) camVideo.srcObject = null;
  wands.forEach(w => { w.on = false; });
  $('camView').hidden = true;
}
function setCam(on) {
  camOn = on;
  document.querySelectorAll('#camSeg button').forEach(b => b.setAttribute('aria-pressed', String((b.dataset.c === '1') === on)));
  try { localStorage.setItem('gadget-lab-cam', on ? '1' : '0'); } catch (e) {}
  wandCal = 0; $('wandCalView').hidden = true;
  camStop(); camSay('');
  if (on) { autoCam = true; camStart(); }
}
document.querySelectorAll('#camSeg button').forEach(b => b.addEventListener('click', () => setCam(b.dataset.c === '1')));
function setCamFacing(f) {
  camFacing = f;
  document.querySelectorAll('#camFaceSeg button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.f === f)));
  try { localStorage.setItem('gadget-lab-camfacing', f); } catch (e) {}
  if (camOn) setCam(true);
}
document.querySelectorAll('#camFaceSeg button').forEach(b => b.addEventListener('click', () => setCamFacing(b.dataset.f)));
document.querySelectorAll('#camFaceSeg button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.f === camFacing)));

function wandCss(c) {
  // shown a bit brighter than the camera saw it, so dim-room colors still read as a color
  const v = Math.max(c.v, 0.8), s = Math.max(c.s, 0.6), l = v * (1 - s / 2), sl = l > 0 && l < 1 ? (v - l) / Math.min(l, 1 - l) : 0;
  return `hsl(${c.h}, ${Math.round(sl * 100)}%, ${Math.round(l * 100)}%)`;
}
function wandSwatches() { wandCols.forEach((c, i) => { $('wandSw' + i).style.background = wandCss(c); $('wandDot' + i).style.borderColor = wandCss(c); }); }
wandSwatches();
function wandSave() {
  wandSwatches(); wandBase[0] = wandBase[1] = 0;
  try { localStorage.setItem('gadget-lab-wandcols', JSON.stringify(wandCols)); } catch (e) {}
}
$('wandSet').addEventListener('click', () => {
  if (!camOn) setCam(true);
  wandCal = performance.now() + 5000; $('wandCalView').hidden = false;
  camSay('Hold your left wand in the left circle and your right wand in the right circle.');
});
$('wandReset').addEventListener('click', () => { wandCols = WAND_DEF.map(c => Object.assign({}, c)); wandSave(); camSay('Back to neon green on the left and hot pink on the right.'); });

// ---- find two bright colors in a small copy of each camera frame ----
const WW = 160, WH = 120, CELLW = 8, GX = WW / CELLW, GY = WH / CELLW;
const wandMark = new Uint8Array(WW * WH), wandCnt = [new Uint16Array(GX * GY), new Uint16Array(GX * GY)];
function wandFrame() {
  if (!wandCv) { wandCv = document.createElement('canvas'); wandCv.width = WW; wandCv.height = WH; }
  const g = wandCv.getContext('2d', { willReadFrequently: true });
  g.drawImage(camVideo, 0, 0, WW, WH);
  return g.getImageData(0, 0, WW, WH).data;
}
function wandHsv(r, g, b, out) {
  const mx = Math.max(r, g, b), d = mx - Math.min(r, g, b);
  let h = 0;
  if (d) h = mx === r ? ((g - b) / d + 6) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  out[0] = h * 60; out[1] = mx ? d / mx : 0; out[2] = mx / 255;
}
const hsvTmp = [0, 0, 0];
// [left, right], each null or { x, y (0-1, as you see it), size, grip }
function wandFind() {
  const px = wandFrame(), hsv = hsvTmp;
  const want = wandCols.map(c => ({ h: c.h, s: Math.max(0.32, c.s * 0.5), v: Math.max(0.22, c.v * 0.4) }));
  wandCnt[0].fill(0); wandCnt[1].fill(0);
  for (let i = 0, y = 0; y < WH; y++) for (let x = 0; x < WW; x++, i++) {
    wandMark[i] = 0;
    wandHsv(px[i * 4], px[i * 4 + 1], px[i * 4 + 2], hsv);
    for (let k = 0; k < 2; k++) {
      const w = want[k], dh = Math.abs(hsv[0] - w.h);
      if (Math.min(dh, 360 - dh) < 20 && hsv[1] > w.s && hsv[2] > w.v) { wandMark[i] = k + 1; wandCnt[k][(y / CELLW | 0) * GX + (x / CELLW | 0)]++; break; }
    }
  }
  const mirror = camFacing === 'user', found = [null, null];
  for (let k = 0; k < 2; k++) {
    // the busiest 3x3 patch of grid cells is the wand, so stray specks of that color don't pull it around
    const cnt = wandCnt[k];
    let best = 0, bxx = 0, byy = 0;
    for (let cy = 1; cy < GY - 1; cy++) for (let cx = 1; cx < GX - 1; cx++) {
      let s = 0;
      for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) s += cnt[(cy + j) * GX + cx + i];
      if (s > best) { best = s; bxx = cx; byy = cy; }
    }
    if (best < 10) continue;
    let sx = 0, sy = 0, n = 0;
    const x0 = Math.max(0, (bxx - 3) * CELLW), x1 = Math.min(WW, (bxx + 4) * CELLW), y0 = Math.max(0, (byy - 3) * CELLW), y1 = Math.min(WH, (byy + 4) * CELLW);
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) if (wandMark[y * WW + x] === k + 1) { sx += x; sy += y; n++; }
    // pulled close to the camera the wand looks much bigger than usual: that's a grip
    if (!wandBase[k]) wandBase[k] = n;
    else if (n < wandBase[k]) wandBase[k] += (n - wandBase[k]) * 0.2;
    else if (n < wandBase[k] * 1.6) wandBase[k] += (n - wandBase[k]) * 0.02;
    const x = (sx / n + 0.5) / WW;
    found[k] = { x: mirror ? 1 - x : x, y: (sy / n + 0.5) / WH, size: n, grip: n > wandBase[k] * 2.3 };
  }
  return found;
}
const WAND_SPOTS = [0.25, 0.75], WAND_R = 0.08;
function wandLearn() {
  const px = wandFrame(), hsv = hsvTmp, mirror = camFacing === 'user', missed = [];
  const learned = WAND_SPOTS.map((spot, k) => {
    const cx = (mirror ? 1 - spot : spot) * WW, cy = WH / 2, r = WAND_R * WW;
    let hx = 0, hy = 0, s = 0, v = 0, n = 0;
    for (let y = Math.floor(cy - r); y <= cy + r; y++) for (let x = Math.floor(cx - r); x <= cx + r; x++) {
      if ((x - cx) ** 2 + (y - cy) ** 2 > r * r) continue;
      const i = (y * WW + x) * 4;
      wandHsv(px[i], px[i + 1], px[i + 2], hsv);
      if (hsv[1] < 0.3 || hsv[2] < 0.2) continue;
      hx += Math.cos(hsv[0] * Math.PI / 180); hy += Math.sin(hsv[0] * Math.PI / 180); s += hsv[1]; v += hsv[2]; n++;
    }
    if (n < 25) { missed.push(k ? 'right' : 'left'); return wandCols[k]; }
    return { h: Math.round((Math.atan2(hy, hx) * 180 / Math.PI + 360) % 360), s: s / n, v: v / n };
  });
  wandCols = learned; wandSave();
  if (missed.length) camSay(`Couldn't see a bright color in the ${missed.join(' or ')} circle. Try brighter wands or more light, then Set colors again.`);
  else {
    const dh = Math.abs(learned[0].h - learned[1].h);
    camSay(Math.min(dh, 360 - dh) < 40 ? 'Got them, but the two colors look alike, so the game may mix up your wands. Different colors work best.' : 'Got your wand colors! Go try them in the city.');
  }
}
function camVideoDraw(g, w, h) {
  g.save(); if (camFacing === 'user') { g.translate(w, 0); g.scale(-1, 1); } g.drawImage(camVideo, 0, 0, w, h); g.restore();
}
function wandCalDraw(now) {
  const view = $('wandCalView'), g = view.getContext('2d'), w = view.width, h = view.height;
  camVideoDraw(g, w, h);
  WAND_SPOTS.forEach((spot, k) => {
    g.lineWidth = 4; g.strokeStyle = wandCss(wandCols[k]);
    g.beginPath(); g.arc(spot * w, h / 2, WAND_R * w, 0, 7); g.stroke();
  });
  const left = String(Math.ceil((wandCal - now) / 1000));
  g.fillStyle = '#fff'; g.strokeStyle = 'rgba(10,20,40,.8)'; g.lineWidth = 6; g.font = 'bold 64px sans-serif'; g.textAlign = 'center';
  g.strokeText(left, w / 2, 70); g.fillText(left, w / 2, 70);
}

// small wand moves should still cover the whole screen, so stretch around the middle
const wandSX = x => clamp(0.5 + (x - 0.5) * 1.6, 0, 1) * innerWidth;
const wandSY = y => clamp(0.5 + (y - 0.5) * 1.6, 0, 1) * innerHeight;

function wandControls(dt, acc) {
  held.wandGadget = false;
  const view = $('camView');
  if (!camOn || !camVideo || camVideo.readyState < 2 || !camStream) { view.hidden = true; $('wandDot0').hidden = $('wandDot1').hidden = true; return; }
  const now = performance.now();
  if (wandCal) {
    if (now < wandCal) { wandCalDraw(now); return; }
    wandCal = 0; $('wandCalView').hidden = true; wandLearn(); return;
  }
  view.hidden = state !== 'play';
  if (state !== 'play') { $('wandDot0').hidden = $('wandDot1').hidden = true; return; }
  if (now >= camNextT && camVideo.currentTime !== camLastT) {
    camLastT = camVideo.currentTime;
    const found = wandFind();
    // slow tablets: look less often so the game stays smooth
    const cost = performance.now() - now;
    camGap = clamp(camGap * 0.8 + cost * 2.5 * 0.2, 30, 120); camNextT = now + camGap;
    for (let k = 0; k < 2; k++) {
      const f = found[k], w = wands[k];
      if (!f) { if (now - w.seen > 400) w.on = false; continue; }
      if (!w.on) { w.on = true; w.x = w.fx = f.x; w.y = w.fy = f.y; w.ft = now; w.seen = now; continue; }
      const sec = Math.max(0.02, (now - w.ft) / 1000);
      const vx = (f.x - w.fx) / sec, vy = (f.y - w.fy) / sec, sp = Math.hypot(vx, vy);
      w.fx = f.x; w.fy = f.y; w.ft = now; w.seen = now;
      w.x += (f.x - w.x) * 0.6; w.y += (f.y - w.y) * 0.6; w.grip = f.grip;
      if (sp > 1.7 && now > w.flickT) {
        w.flickT = now + 450;
        if (vy > sp * 0.7) {                 // flicked down: let go (or jump if nothing to let go of)
          if (player.hooks[k].state !== 'none') releaseHook(k); else inp.jumpQ = true;
        } else hookAtScreen(k, wandSX(f.x), wandSY(f.y));
      }
    }
    // the camera picture in the corner, with a ring on each wand
    const g = view.getContext('2d');
    camVideoDraw(g, view.width, view.height);
    found.forEach((f, k) => {
      if (!f) return;
      g.lineWidth = 4; g.strokeStyle = f.grip ? '#ffd23f' : wandCss(wandCols[k]);
      g.beginPath(); g.arc(f.x * view.width, f.y * view.height, Math.max(10, Math.sqrt(f.size) * view.width / WW), 0, 7); g.stroke();
    });
  }
  // both wands: off to one side turns, held up high runs forward
  const [a, b] = wands;
  if (a.on && b.on) {
    const steer = (a.x + b.x) / 2 - 0.5;
    if (Math.abs(steer) > 0.12) { inp.lookX += (steer - Math.sign(steer) * 0.12) * 4 * dt; lastLookT = now; }
    if ((a.y + b.y) / 2 < 0.38) acc.mz += 1;
  }
  const grip = wands.some(w => w.on && w.grip);
  if (grip && !wandGripWas) inp.gPressQ = true;
  wandGripWas = grip;
  held.wandGadget = grip;
  wands.forEach((w, k) => {
    const dot = $('wandDot' + k);
    dot.hidden = !w.on;
    if (w.on) { dot.style.transform = `translate(${wandSX(w.x)}px, ${wandSY(w.y)}px)`; dot.classList.toggle('grip', w.grip); }
  });
}
setCam(camOn);
