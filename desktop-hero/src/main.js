'use strict';
// Desktop Hero: Electron main process.
// One transparent, always-on-top, click-through overlay per display. Hero's simulation
// runs here in physical pixels; each overlay just draws her when she is on its display.

const { app, BrowserWindow, Menu, Tray, ipcMain, nativeImage, net, protocol, screen } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const { Helper } = require('./helper');
const { loadSprites, ASSET_ROOT } = require('./sprites');
const { buildPlatforms, displayAt, fullscreenDisplays } = require('./world');
const { Hero } = require('./hero');

const APP_ROOT = path.resolve(__dirname, '..', 'overlay');
const args = process.argv.slice(1);
const flag = (name) => args.includes(`--${name}`);
const option = (name, fallback) => {
  const hit = args.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
};

const settings = {
  size: Number(option('size', 112)),
  autoDig: !flag('no-autodig'),
  windowBump: !flag('no-bump'),
  ignoreFullscreen: flag('ignore-fullscreen'),
  paused: false,
};
const selftest = flag('selftest') ? { seconds: Number(option('selftest-seconds', 10)), out: option('selftest-out', '') } : null;

protocol.registerSchemesAsPrivileged([
  { scheme: 'hero', privileges: { standard: true, secure: true, supportFetchAPI: true } },
]);

if (!app.requestSingleInstanceLock()) app.quit();

// Keep the overlay off the GPU blocklist's software fallback path from throttling while hidden.
app.commandLine.appendSwitch('disable-renderer-backgrounding');

let helper;
let hero;
let tray;
const overlays = new Map(); // displayId -> { win, display, shown, hoverable, drew }
let displays = [];
let snap = { windows: [], taskbars: [], fg: null, cursor: [0, 0], lb: false };
let buttons = [];
let world = { displays: [], platforms: [], buttons: [], windows: [], foreground: 0 };
let fullscreen = new Set();

function serveFile(root, relative) {
  const file = path.resolve(root, decodeURIComponent(relative));
  if (!file.startsWith(root + path.sep)) return new Response('Not found', { status: 404 });
  return net.fetch(pathToFileURL(file).toString());
}

function readDisplays() {
  const primary = screen.getPrimaryDisplay().id;
  return screen.getAllDisplays().map((d) => ({
    id: d.id,
    bounds: d.bounds,
    phys: screen.dipToScreenRect(null, d.bounds),
    scale: d.scaleFactor,
    primary: d.id === primary,
  }));
}

function createOverlay(display) {
  const { x, y, width, height } = display.bounds;
  const win = new BrowserWindow({
    x, y, width, height,
    transparent: true,
    frame: false,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    focusable: false,
    hasShadow: false,
    alwaysOnTop: true,
    show: false,
    backgroundColor: '#00000000',
    title: 'Desktop Hero',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      backgroundThrottling: false,
      contextIsolation: true,
      sandbox: true,
    },
  });
  win.setAlwaysOnTop(true, 'screen-saver');
  win.setIgnoreMouseEvents(true, { forward: true });
  win.setBounds(display.bounds); // re-apply after creation; Windows can rescale on mixed-DPI setups
  win.loadURL('hero://app/overlay.html');
  win.once('ready-to-show', () => { win.showInactive(); });
  overlays.set(display.id, { win, display, shown: true, hoverable: false, drew: false });
}

function syncOverlays() {
  displays = readDisplays();
  const ids = new Set(displays.map((d) => d.id));
  for (const [id, o] of overlays) {
    if (!ids.has(id)) { o.win.destroy(); overlays.delete(id); }
  }
  for (const d of displays) {
    const o = overlays.get(d.id);
    if (!o) createOverlay(d);
    else { o.display = d; o.win.setBounds(d.bounds); }
  }
}

function overlayFor(sender) {
  for (const o of overlays.values()) if (o.win.webContents === sender) return o;
  return null;
}

function heroSize(d) {
  const cell = settings.size * d.scale;
  return { w: cell * 0.6, h: cell * 0.8 };
}

function rebuildWorld() {
  world = {
    displays,
    platforms: buildPlatforms(snap, displays, heroSize),
    buttons,
    windows: snap.windows,
    foreground: snap.fg ? snap.fg.hwnd : 0,
  };
  fullscreen = settings.ignoreFullscreen ? new Set() : fullscreenDisplays(snap, displays);
}

let snapInFlight = false;
async function pollSnapshot() {
  if (snapInFlight) return;
  snapInFlight = true;
  const s = await helper.snap();
  snapInFlight = false;
  if (s && !s.error) { snap = s; rebuildWorld(); }
}

let buttonsInFlight = false;
async function pollButtons() {
  if (buttonsInFlight) return;
  buttonsInFlight = true;
  const b = await helper.buttons();
  buttonsInFlight = false;
  if (b && Array.isArray(b.buttons)) { buttons = b.buttons; world.buttons = buttons; }
}

function cursorPhys() {
  const p = screen.dipToScreenPoint(screen.getCursorScreenPoint());
  return { x: p.x, y: p.y, down: !!snap.lb };
}

function handleRequests() {
  for (const r of hero.takeRequests()) {
    if (r.type === 'activate') {
      helper.activate(r.hwnd).then((res) => {
        pollSnapshot();
        hero.activated(res, world);
      });
    } else if (r.type === 'bump') {
      helper.move(r.hwnd, 0, r.dy).then(() => setTimeout(() => helper.move(r.hwnd, 0, -r.dy), 110));
    }
  }
}

function toLocal(o, sprite, particles) {
  const { phys, scale } = o.display;
  const lx = (v) => (v - phys.x) / scale;
  const ly = (v) => (v - phys.y) / scale;
  return {
    s: sprite && {
      file: sprite.file,
      rect: sprite.rect,
      px: sprite.px,
      py: sprite.py,
      x: lx(sprite.x),
      y: ly(sprite.y),
      cell: sprite.cell / scale,
      mirror: sprite.mirror,
      clipY: sprite.clipY == null ? null : ly(sprite.clipY),
    },
    p: particles.map((q) => [lx(q.x), ly(q.y), q.r / scale, q.color, Math.min(1, q.life * 3)]),
  };
}

function render() {
  const sprite = hero.sprite();
  const b = hero.bounds();
  for (const o of overlays.values()) {
    const { phys } = o.display;
    const hide = fullscreen.has(o.display.id) || settings.paused;
    if (hide && o.shown) { o.win.hide(); o.shown = false; }
    if (!hide && !o.shown) { o.win.showInactive(); o.win.setAlwaysOnTop(true, 'screen-saver'); o.shown = true; }
    if (!o.shown) continue;
    const on = b.x2 > phys.x && b.x1 < phys.x + phys.width && b.y2 > phys.y && b.y1 < phys.y + phys.height;
    const parts = hero.particles.filter((q) => q.x >= phys.x && q.x < phys.x + phys.width && q.y >= phys.y && q.y < phys.y + phys.height);
    if (on || parts.length) {
      o.win.webContents.send('frame', toLocal(o, on ? sprite : null, parts));
      o.drew = true;
    } else if (o.drew) {
      o.win.webContents.send('frame', { s: null, p: [] });
      o.drew = false;
    }
  }
}

let last = 0;
function tick() {
  const nowMs = performance.now();
  const dt = Math.min(0.05, (nowMs - last) / 1000);
  last = nowMs;
  const d = displayAt(displays, hero.x, hero.y - 1);
  const frozen = settings.paused || (d && fullscreen.has(d.id));
  if (!frozen) {
    hero.update(dt, world, cursorPhys(), nowMs / 1000);
    handleRequests();
  }
  render();
}

function trayIcon() {
  const frame = path.join(ASSET_ROOT, 'suite-v1', 'frames', 'idle', '00.png');
  const img = nativeImage.createFromPath(frame);
  return img.isEmpty() ? nativeImage.createEmpty() : img.resize({ width: 32, height: 32, quality: 'best' });
}

function buildTray() {
  tray = new Tray(trayIcon());
  tray.setToolTip('Desktop Hero');
  const refresh = () => {
    tray.setContextMenu(Menu.buildFromTemplate([
      { label: 'Dig into an app', click: () => { if (hero.mode === 'ground' && hero.platform && hero.platform.kind === 'taskbar') hero.startDig(world, true); } },
      { label: 'Call Hero back', click: () => hero.spawn(world, performance.now() / 1000) },
      { type: 'separator' },
      { label: 'Dig on her own', type: 'checkbox', checked: settings.autoDig, click: (i) => { settings.autoDig = i.checked; hero.opts.autoDig = i.checked; } },
      { label: 'Nudge windows on hard landings', type: 'checkbox', checked: settings.windowBump, click: (i) => { settings.windowBump = i.checked; hero.opts.windowBump = i.checked; } },
      {
        label: 'Size',
        submenu: [['Small', 84], ['Medium', 112], ['Large', 148]].map(([label, size]) => ({
          label, type: 'radio', checked: settings.size === size,
          click: () => { settings.size = size; hero.opts.size = size; rebuildWorld(); },
        })),
      },
      { label: 'Pause', type: 'checkbox', checked: settings.paused, click: (i) => { settings.paused = i.checked; } },
      { type: 'separator' },
      { label: 'Quit Desktop Hero', click: () => app.quit() },
    ]));
  };
  refresh();
  tray.on('click', () => { settings.paused = false; refresh(); });
}

function wireIpc() {
  ipcMain.on('hover', (e, over) => {
    const o = overlayFor(e.sender);
    if (!o || o.hoverable === over) return;
    o.hoverable = over;
    o.win.setIgnoreMouseEvents(!over, { forward: true });
  });
  ipcMain.on('down', () => hero.pointerDown());
  ipcMain.on('up', () => hero.pointerUp());
  ipcMain.on('dbl', () => hero.doubleClick(world));
}

async function runSelftest() {
  const log = [];
  const started = Date.now();
  const timer = setInterval(() => {
    log.push({
      t: ((Date.now() - started) / 1000).toFixed(1),
      mode: hero.mode,
      anim: hero.anim.name,
      act: hero.act && hero.act.type,
      platform: hero.platform && hero.platform.key,
      x: Math.round(hero.x),
      y: Math.round(hero.y),
      platforms: world.platforms.length,
      buttons: buttons.length,
      fullscreen: [...fullscreen],
    });
  }, 500);
  await new Promise((r) => setTimeout(r, selftest.seconds * 1000));
  clearInterval(timer);
  if (selftest.out) {
    fs.mkdirSync(selftest.out, { recursive: true });
    fs.writeFileSync(path.join(selftest.out, 'log.json'), JSON.stringify({ displays, log }, null, 2));
    for (const [id, o] of overlays) {
      const img = await o.win.webContents.capturePage();
      fs.writeFileSync(path.join(selftest.out, `overlay-${id}.png`), img.toPNG());
    }
  }
  app.quit();
}

app.whenReady().then(async () => {
  protocol.handle('hero', (request) => {
    const url = new URL(request.url);
    const rel = url.pathname.replace(/^\/+/, '');
    if (url.host === 'app') return serveFile(APP_ROOT, rel);
    if (url.host === 'assets') return serveFile(ASSET_ROOT, rel);
    return new Response('Not found', { status: 404 });
  });

  helper = new Helper([process.pid]).start();
  const sprites = loadSprites();
  hero = new Hero(sprites, { size: settings.size, autoDig: settings.autoDig, windowBump: settings.windowBump });

  syncOverlays();
  await pollSnapshot();
  await pollButtons();
  hero.spawn(world, performance.now() / 1000);

  wireIpc();
  buildTray();
  screen.on('display-added', () => { syncOverlays(); rebuildWorld(); });
  screen.on('display-removed', () => { syncOverlays(); rebuildWorld(); });
  screen.on('display-metrics-changed', () => { syncOverlays(); rebuildWorld(); });

  last = performance.now();
  setInterval(tick, 1000 / 60);
  setInterval(pollSnapshot, 33);
  setInterval(pollButtons, 4000);
  setInterval(() => {
    // The taskbar raises itself when clicked; stay above it.
    for (const o of overlays.values()) if (o.shown) { o.win.setAlwaysOnTop(true, 'screen-saver'); o.win.moveTop(); }
  }, 2000);

  if (selftest) runSelftest();
});

app.on('window-all-closed', (e) => e.preventDefault());
app.on('before-quit', () => { if (helper) helper.stop(); });
