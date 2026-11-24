'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { buildPlatforms, floorsFor, subtract, landingPlatform, segmentFor, fullscreenDisplays, displayAt } = require('../src/world');

const displays = [
  { id: 1, phys: { x: 0, y: 0, width: 2880, height: 1920 }, scale: 2, primary: true },
  { id: 2, phys: { x: 2880, y: 400, width: 1920, height: 1080 }, scale: 1 },
];
const size = (d) => ({ w: 112 * d.scale * 0.6, h: 112 * d.scale * 0.8 });
const taskbars = [{ primary: true, edge: 3, rect: [0, 1824, 2880, 1920], autohide: false }];

test('floors use the bottom taskbar, or the display bottom', () => {
  const floors = floorsFor(displays, taskbars);
  assert.equal(floors[0].kind, 'taskbar');
  assert.equal(floors[0].y, 1824);
  assert.equal(floors[1].kind, 'floor');
  assert.equal(floors[1].y, 1480);
});

test('auto-hidden taskbars do not count as floors', () => {
  const floors = floorsFor(displays, [{ ...taskbars[0], autohide: true }]);
  assert.equal(floors[0].kind, 'floor');
});

test('subtract splits intervals', () => {
  assert.deepEqual(subtract([[0, 100]], 20, 40), [[0, 20], [40, 100]]);
  assert.deepEqual(subtract([[0, 100]], -5, 200), []);
});

test('window tops become platforms, minus windows in front of them', () => {
  const snap = {
    taskbars,
    windows: [
      { hwnd: 10, rect: [400, 300, 1000, 900] }, // in front
      { hwnd: 20, rect: [200, 600, 1600, 1500] }, // behind; its top is partly covered
      { hwnd: 30, rect: [0, 0, 2880, 1824], max: true }, // maximized: no headroom
    ],
  };
  const platforms = buildPlatforms(snap, displays, size);
  const w20 = platforms.filter((p) => p.key === 'w:20');
  assert.deepEqual(w20.map((p) => [p.x1, p.x2]), [[200, 400], [1000, 1600]]);
  assert.ok(platforms.some((p) => p.key === 'w:10'));
  assert.ok(!platforms.some((p) => p.key === 'w:30'));
});

test('landing finds the highest platform crossed', () => {
  const platforms = [
    { key: 'a', x1: 0, x2: 100, y: 500 },
    { key: 'b', x1: 0, x2: 100, y: 450 },
  ];
  assert.equal(landingPlatform(platforms, 50, 400, 600).key, 'b');
  assert.equal(landingPlatform(platforms, 150, 400, 600), null);
  assert.equal(segmentFor(platforms, 'a', 50).key, 'a');
  assert.equal(segmentFor(platforms, 'a', 150), null);
});

test('fullscreen foreground marks its display', () => {
  const snap = { fg: { fullscreen: true, monitor: [2880, 400, 4800, 1480] } };
  assert.deepEqual([...fullscreenDisplays(snap, displays)], [2]);
  assert.equal(fullscreenDisplays({ fg: { fullscreen: false } }, displays).size, 0);
});

test('displayAt picks the nearest display for points in gaps', () => {
  assert.equal(displayAt(displays, 3000, 600).id, 2);
  assert.equal(displayAt(displays, 100, 100).id, 1);
});
