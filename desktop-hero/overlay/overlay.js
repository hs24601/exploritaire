'use strict';
// Draws Hero on this display's overlay and decides, per pixel, whether the pointer is on her.
// Everywhere else the window stays click-through.

const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
const images = new Map();
const masks = new Map();
const MASK = 64;
let state = { s: null, p: [] };
let over = false;
let pressed = false;

function resize() {
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.round(window.innerWidth * dpr);
  canvas.height = Math.round(window.innerHeight * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.imageSmoothingQuality = 'high';
  draw();
}

function image(file) {
  let img = images.get(file);
  if (!img) {
    img = new Image();
    img.src = `hero://assets/${file}`;
    img.onload = draw;
    images.set(file, img);
  }
  return img.complete && img.naturalWidth ? img : null;
}

// Low-resolution alpha mask of one frame, for hit testing.
function mask(file, rect) {
  const key = `${file}@${rect.x},${rect.y}`;
  let m = masks.get(key);
  if (m) return m;
  const img = image(file);
  if (!img) return null;
  const c = new OffscreenCanvas(MASK, MASK);
  const g = c.getContext('2d', { willReadFrequently: true });
  g.drawImage(img, rect.x, rect.y, rect.width, rect.height, 0, 0, MASK, MASK);
  m = g.getImageData(0, 0, MASK, MASK).data;
  masks.set(key, m);
  return m;
}

function draw() {
  ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
  const { s, p } = state;
  for (const [x, y, r, color, a] of p) {
    ctx.globalAlpha = a;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  if (!s) return;
  const img = image(s.file);
  if (!img) return;
  ctx.save();
  if (s.clipY != null) {
    ctx.beginPath();
    ctx.rect(0, 0, window.innerWidth, s.clipY);
    ctx.clip();
  }
  ctx.translate(s.x, s.y);
  ctx.scale(s.mirror ? -1 : 1, 1);
  const r = s.rect;
  ctx.drawImage(img, r.x, r.y, r.width, r.height, -s.px * s.cell, -s.py * s.cell, s.cell, s.cell);
  ctx.restore();
}

function hit(x, y) {
  const s = state.s;
  if (!s) return false;
  if (s.clipY != null && y > s.clipY) return false;
  const lx = (x - s.x) * (s.mirror ? -1 : 1) + s.px * s.cell;
  const ly = y - s.y + s.py * s.cell;
  if (lx < 0 || ly < 0 || lx >= s.cell || ly >= s.cell) return false;
  const m = mask(s.file, s.rect);
  if (!m) return false;
  const mx = Math.floor((lx / s.cell) * MASK);
  const my = Math.floor((ly / s.cell) * MASK);
  return m[(my * MASK + mx) * 4 + 3] > 40;
}

function setOver(value) {
  if (value === over) return;
  over = value;
  document.body.classList.toggle('over', over);
  window.hero.hover(over);
}

window.addEventListener('mousemove', (e) => { if (!pressed) setOver(hit(e.clientX, e.clientY)); });
window.addEventListener('mouseleave', () => { if (!pressed) setOver(false); });
window.addEventListener('mousedown', (e) => {
  if (e.button !== 0 || !hit(e.clientX, e.clientY)) return;
  pressed = true;
  document.body.classList.add('held');
  window.hero.down();
});
window.addEventListener('mouseup', (e) => {
  if (e.button !== 0 || !pressed) return;
  pressed = false;
  document.body.classList.remove('held');
  window.hero.up();
  setOver(hit(e.clientX, e.clientY));
});
window.addEventListener('dblclick', (e) => { if (hit(e.clientX, e.clientY)) window.hero.dbl(); });
window.addEventListener('resize', resize);

window.hero.onFrame((msg) => {
  state = msg;
  draw();
  // Hero moves under a still pointer too; keep click-through honest.
  if (!pressed && over && !msg.s) setOver(false);
});

resize();
