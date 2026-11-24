'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadSprites } = require('../src/sprites');
const { buildPlatforms } = require('../src/world');
const { Hero } = require('../src/hero');

const sprites = loadSprites();
const displays = [{ id: 1, phys: { x: 0, y: 0, width: 2880, height: 1920 }, scale: 2, primary: true }];
const size = (d) => ({ w: 112 * d.scale * 0.6, h: 112 * d.scale * 0.8 });
const taskbars = [{ primary: true, edge: 3, rect: [0, 1824, 2880, 1920], autohide: false }];

function worldWith(windows, buttons = []) {
  const snap = { taskbars, windows };
  return { displays, platforms: buildPlatforms(snap, displays, size), windows, buttons, foreground: 0 };
}

function run(hero, world, seconds, cursor = { x: -9999, y: -9999, down: false }, start = 0) {
  let t = start;
  for (let i = 0; i < seconds * 60; i++) {
    t += 1 / 60;
    hero.update(1 / 60, typeof world === 'function' ? world(t) : world, cursor, t);
  }
  return t;
}

test('sprites load both painted suites and the derived sequences', () => {
  for (const name of ['walk', 'run', 'idle', 'fall', 'land', 'jump-rise', 'crouch', 'interact', 'ledge-hang', 'breath-stand', 'sleep', 'lie-down']) {
    assert.ok(sprites.animations.has(name), name);
  }
});

test('Hero drops in and lands on the taskbar', () => {
  const hero = new Hero(sprites, { autoDig: false });
  const world = worldWith([]);
  hero.spawn(world, 0);
  run(hero, world, 3);
  assert.equal(hero.mode, 'ground');
  assert.equal(hero.platform.kind, 'taskbar');
  assert.equal(hero.y, 1824);
});

test('Hero chases a moving pointer along the taskbar', () => {
  const hero = new Hero(sprites, { autoDig: false });
  const world = worldWith([]);
  hero.spawn(world, 0);
  let t = run(hero, world, 3);
  hero.x = 600;
  for (let i = 0; i < 180; i++) {
    t += 1 / 60;
    hero.update(1 / 60, world, { x: 2200 + (i % 2) * 10, y: 1860, down: false }, t);
  }
  assert.ok(hero.x > 2000, `x=${hero.x}`);
});

test('Hero rides a dragged window and falls when it closes', () => {
  const hero = new Hero(sprites, { autoDig: false });
  let rect = [800, 900, 1800, 1500];
  let open = true;
  const world = () => worldWith(open ? [{ hwnd: 7, rect }] : []);
  hero.spawn(world(), 0);
  hero.x = 1300;
  hero.y = 700;
  let t = run(hero, world, 1.5);
  assert.equal(hero.platform && hero.platform.key, 'w:7');
  hero.act = { type: 'pose', anim: 'idle', until: 1e9 };
  const x0 = hero.x;
  rect = [900, 850, 1900, 1450];
  t = run(hero, world, 0.1, undefined, t);
  assert.equal(Math.round(hero.x - x0), 100);
  assert.equal(hero.y, 850);
  open = false;
  run(hero, world, 2, undefined, t);
  assert.equal(hero.platform.kind, 'taskbar');
});

test('Hero digs into a taskbar entry and pops out on that window', () => {
  const hero = new Hero(sprites, { autoDig: false });
  const windows = [{ hwnd: 42, rect: [600, 500, 1800, 1400] }];
  const world = worldWith(windows, [{ hwnd: 42, rect: [1000, 1824, 1300, 1920], name: 'App' }]);
  hero.spawn(world, 0);
  hero.x = 300;
  let t = run(hero, world, 3);
  assert.ok(hero.startDig(world, true));
  let request = null;
  for (let i = 0; i < 600 && !request; i++) {
    t += 1 / 60;
    hero.update(1 / 60, world, { x: -9999, y: -9999, down: false }, t);
    request = hero.takeRequests().find((r) => r.type === 'activate');
  }
  assert.equal(request && request.hwnd, 42);
  assert.equal(hero.sprite(), null);
  hero.activated({ ok: true, hwnd: 42, rect: windows[0].rect }, world);
  assert.equal(hero.mode, 'emerge');
  run(hero, world, 2, undefined, t);
  assert.equal(hero.platform && hero.platform.key, 'w:42');
});

test('a maximized window makes Hero hang under its title bar, then drop', () => {
  const hero = new Hero(sprites, { autoDig: false });
  const windows = [{ hwnd: 9, rect: [0, 0, 2880, 1824], max: true }];
  const world = worldWith(windows, [{ hwnd: 9, rect: [1000, 1824, 1300, 1920] }]);
  hero.spawn(world, 0);
  let t = run(hero, world, 3);
  hero.startDig(world, true);
  for (let i = 0; i < 600 && hero.mode !== 'dig'; i++) { t += 1 / 60; hero.update(1 / 60, world, { x: -1, y: -1, down: false }, t); }
  hero.act.phase = 'wait';
  hero.activated({ ok: true, hwnd: 9, rect: windows[0].rect }, world);
  assert.equal(hero.mode, 'hang');
  run(hero, world, 7, undefined, t);
  assert.equal(hero.platform.kind, 'taskbar');
});

test('grab and throw', () => {
  const hero = new Hero(sprites, { autoDig: false });
  const world = worldWith([]);
  hero.spawn(world, 0);
  let t = run(hero, world, 3);
  const c = { x: hero.x, y: hero.y - 100, down: true };
  hero.update(1 / 60, world, c, (t += 1 / 60));
  hero.pointerDown();
  for (let i = 0; i < 20; i++) {
    c.x += 30;
    c.y -= 25;
    hero.update(1 / 60, world, { ...c }, (t += 1 / 60));
  }
  assert.equal(hero.mode, 'held');
  hero.update(1 / 60, world, { ...c, down: false }, (t += 1 / 60));
  assert.equal(hero.mode, 'air');
  assert.ok(hero.vx > 0 && hero.vy < 0);
  run(hero, world, 4, undefined, t);
  assert.equal(hero.mode, 'ground');
});
