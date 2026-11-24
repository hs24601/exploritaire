'use strict';
// Hero's behaviour and physics. Positions are physical pixels; speeds are written in
// device-independent pixels and multiplied by the scale of the display Hero is on,
// so she looks and moves the same on 100% and 200% monitors.

const { Animator } = require('./sprites');
const { displayAt, segmentFor, landingPlatform } = require('./world');

const DEFAULTS = {
  size: 112, // sprite cell in DIP (the dog fills roughly 80% of it)
  autoDig: true,
  digEvery: [120, 300], // seconds between unprompted digs
  windowBump: true, // a hard landing nudges the window a few pixels
  sleepAfter: 75, // seconds without pointer activity
};

const WALK = 120;
const RUN = 420;
const GRAVITY = 2600;
const MAX_THROW = 3200;
const TITLE_GRIP = 38; // DIP below a maximized window's top edge, where its title bar ends

const rand = (a, b) => a + Math.random() * (b - a);
const pick = (list) => list[Math.floor(Math.random() * list.length)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

class Hero {
  constructor(sprites, options = {}) {
    this.opts = { ...DEFAULTS, ...options };
    this.anim = new Animator(sprites);
    this.x = 0;
    this.y = 0;
    this.vx = 0;
    this.vy = 0;
    this.facing = 1;
    this.u = 1;
    this.mode = 'air';
    this.platform = null;
    this.ride = null; // {key, rect} of the platform being stood on or hung from
    this.act = null;
    this.clipY = null;
    this.offsetY = 0;
    this.hidden = false;
    this.particles = [];
    this.requests = [];
    this.cursor = { x: 0, y: 0, down: false };
    this.cursorMovedAt = -Infinity;
    this.activityAt = 0;
    this.barkCooldownUntil = 0;
    this.nextDigAt = 0;
    this.now = 0;
    this.pendingGrab = null;
    this.samples = [];
  }

  get cell() { return this.opts.size * this.u; }

  spawn(world, now = 0) {
    const primary = world.displays.find((d) => d.primary) || world.displays[0];
    this.u = primary.scale;
    this.x = primary.phys.x + primary.phys.width * rand(0.35, 0.65);
    this.y = primary.phys.y + this.cell;
    this.vx = 0;
    this.vy = 0;
    this.toAir('fall');
    this.activityAt = now;
    this.scheduleDig(now);
  }

  scheduleDig(now) {
    const [a, b] = this.opts.digEvery;
    this.nextDigAt = now + rand(a, b);
  }

  // ---------------------------------------------------------------- input from the overlay

  pointerDown() {
    if (this.hidden || this.mode === 'held') return;
    this.pendingGrab = { x: this.cursor.x, y: this.cursor.y, at: this.now, dx: this.x - this.cursor.x, dy: this.y - this.cursor.y };
    this.activityAt = this.now;
  }

  pointerUp() {
    if (this.mode === 'held') this.release();
    else if (this.pendingGrab) this.click();
    this.pendingGrab = null;
  }

  doubleClick(world) {
    if (this.mode !== 'ground' || !this.platform) return;
    if (this.platform.kind === 'taskbar') this.startDig(world, true);
    else this.act = { type: 'move', target: this.facing > 0 ? this.platform.x2 : this.platform.x1, run: true, hop: true };
  }

  click() {
    this.activityAt = this.now;
    if (this.mode !== 'ground') return;
    if (this.act && this.act.type === 'sleep') { this.wake(); return; }
    if (this.act && this.act.type === 'dig') return;
    this.facing = this.cursor.x >= this.x ? 1 : -1;
    this.act = { type: 'pose', anim: pick(['celebrate', 'interact', 'roll', 'spin']), once: true };
  }

  grab() {
    const g = this.pendingGrab;
    this.mode = 'held';
    this.act = null;
    this.platform = null;
    this.ride = null;
    this.clipY = null;
    this.offsetY = 0;
    this.grabDx = clamp(g.dx, -this.cell * 0.3, this.cell * 0.3);
    this.grabDy = clamp(g.dy, this.cell * 0.05, this.cell * 0.55);
    this.samples = [];
    this.anim.play('held');
  }

  release() {
    const recent = this.samples.filter((s) => this.now - s.t <= 0.1);
    let vx = 0;
    let vy = 0;
    if (recent.length >= 2) {
      const a = recent[0];
      const b = recent[recent.length - 1];
      const dt = Math.max(1 / 120, b.t - a.t);
      vx = (b.x - a.x) / dt;
      vy = (b.y - a.y) / dt;
    }
    const max = MAX_THROW * this.u;
    const speed = Math.hypot(vx, vy);
    if (speed > max) { vx *= max / speed; vy *= max / speed; }
    this.vx = vx;
    this.vy = vy;
    if (Math.abs(vx) > 30) this.facing = Math.sign(vx);
    this.toAir(vy < 0 ? 'jump-apex' : 'fall');
  }

  // --------------------------------------------------------------------------- the tick

  /**
   * @param {number} dt seconds
   * @param {{displays:any[], platforms:any[], buttons:any[]}} world
   * @param {{x:number,y:number,down:boolean}} cursor physical pixels
   * @param {number} now seconds
   */
  update(dt, world, cursor, now) {
    this.now = now;
    const d = displayAt(world.displays, this.x, this.y - 1);
    if (d) this.u = d.scale;

    if (Math.hypot(cursor.x - this.cursor.x, cursor.y - this.cursor.y) > 3 * this.u) {
      this.cursorMovedAt = now;
      this.activityAt = now;
    }
    this.cursor = { ...cursor };

    if (this.pendingGrab) {
      const moved = Math.hypot(cursor.x - this.pendingGrab.x, cursor.y - this.pendingGrab.y);
      if (!cursor.down && now - this.pendingGrab.at > 0.05) this.pointerUp();
      else if (moved > 6 * this.u && this.mode !== 'held' && !this.hidden) this.grab();
    }

    switch (this.mode) {
      case 'held': this.updateHeld(world); break;
      case 'air': this.updateAir(dt, world); break;
      case 'ground': this.updateGround(dt, world); break;
      case 'dig': this.updateDig(dt, world); break;
      case 'emerge': this.updateEmerge(dt, world); break;
      case 'hang': this.updateHang(dt, world); break;
      default: break;
    }
    this.updateParticles(dt);
    this.anim.advance(dt * 1000);
    this.keepOnScreen(world);
  }

  updateHeld(world) {
    this.x = this.cursor.x + this.grabDx;
    this.y = this.cursor.y + this.grabDy;
    this.samples.push({ t: this.now, x: this.x, y: this.y });
    if (this.samples.length > 30) this.samples.shift();
    if (!this.cursor.down && this.samples.length > 2) { this.pendingGrab = null; this.release(); }
    this.anim.play('held');
  }

  toAir(anim) {
    this.mode = 'air';
    this.platform = null;
    this.ride = null;
    this.act = null;
    this.clipY = null;
    this.offsetY = 0;
    this.anim.play(anim, { restart: true });
  }

  updateAir(dt, world) {
    const u = this.u;
    this.vy += GRAVITY * u * dt;
    const y0 = this.y;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.vx *= Math.pow(0.6, dt); // a little air drag

    // Bounce off the outer edges of the desktop.
    const { minX, maxX, minY } = bounds(world.displays);
    const half = this.cell * 0.3;
    if (this.x < minX + half) { this.x = minX + half; this.vx = Math.abs(this.vx) * 0.45; this.facing = 1; }
    if (this.x > maxX - half) { this.x = maxX - half; this.vx = -Math.abs(this.vx) * 0.45; this.facing = -1; }
    if (this.y - this.cell * 0.8 < minY && this.vy < 0) { this.vy = Math.abs(this.vy) * 0.3; }

    if (this.vy > 0) {
      const p = landingPlatform(world.platforms, this.x, y0, this.y);
      if (p) { this.land(p, this.vy); return; }
    }
    this.anim.play(this.vy < -80 * u ? 'jump-rise' : this.vy < 120 * u ? 'jump-apex' : 'fall');
  }

  land(p, impact) {
    this.mode = 'ground';
    this.y = p.y;
    this.vy = 0;
    this.vx = 0;
    this.setPlatform(p);
    this.act = { type: 'pose', anim: 'land', once: true };
    this.anim.play('land', { restart: true });
    if (p.kind === 'window' && !p.max && this.opts.windowBump && impact > 1500 * this.u) {
      this.requests.push({ type: 'bump', hwnd: p.hwnd, dy: Math.round(8 * this.u) });
    }
  }

  setPlatform(p) {
    this.platform = p;
    this.ride = { key: p.key, rect: p.rect ? [...p.rect] : null };
  }

  /** Follows a moving window; returns false if the platform is gone. */
  followRide(world) {
    const any = world.platforms.find((p) => p.key === this.ride.key);
    if (!any) return false;
    if (any.rect && this.ride.rect) {
      const dx = any.rect[0] - this.ride.rect[0];
      const dy = any.rect[1] - this.ride.rect[1];
      if (dx || dy) { this.x += dx; this.y += dy; }
      this.ride.rect = [...any.rect];
    }
    return true;
  }

  updateGround(dt, world) {
    if (!this.followRide(world)) { this.vx = 0; this.vy = 0; this.toAir('fall'); return; }
    const seg = segmentFor(world.platforms, this.ride.key, this.x, this.cell * 0.15);
    if (!seg) { this.vx = this.facing * 60 * this.u; this.vy = 0; this.toAir('fall'); return; }
    this.platform = seg;
    this.y = seg.y;

    if (this.act && this.act.type === 'dig') { this.runDigApproach(dt, world); return; }

    this.maybeChase();
    if (!this.act) this.chooseNext(world);
    this.runAct(dt, world);
  }

  maybeChase() {
    const a = this.act;
    if (a && (a.type === 'sleep' || a.type === 'dig' || a.type === 'sit')) return;
    const p = this.platform;
    const c = this.cursor;
    const cell = this.cell;
    const recent = this.now - this.cursorMovedAt < 1.2;
    const near = c.y > p.y - cell * 4 && c.y < p.y + cell * 1.2 && c.x > p.x1 - cell && c.x < p.x2 + cell;
    if (!recent || !near) {
      if (a && a.chase) this.act = null;
      return;
    }
    const target = clamp(c.x, p.x1 + cell * 0.3, p.x2 - cell * 0.3);
    if (a && a.chase && a.type === 'move') { a.target = target; a.run = Math.abs(target - this.x) > cell * 2.5; return; }
    if (Math.abs(target - this.x) > cell * 0.7) {
      this.act = { type: 'move', target, run: Math.abs(target - this.x) > cell * 2.5, chase: true };
    }
  }

  chooseNext(world) {
    const now = this.now;
    const p = this.platform;
    if (now - this.activityAt > this.opts.sleepAfter) {
      this.act = { type: 'sleep', phase: 'down' };
      this.anim.play('lie-down', { restart: true });
      return;
    }
    if (this.opts.autoDig && now >= this.nextDigAt && p.kind === 'taskbar' && this.startDig(world, false)) return;

    const roll = Math.random();
    const span = p.x2 - p.x1;
    if (roll < 0.38 && span > this.cell * 1.5) {
      const hop = p.kind === 'window' && Math.random() < 0.3;
      const target = hop ? (Math.random() < 0.5 ? p.x1 : p.x2) : rand(p.x1 + this.cell * 0.4, p.x2 - this.cell * 0.4);
      this.act = { type: 'move', target, run: Math.random() < 0.15, hop };
    } else if (roll < 0.6) {
      this.act = { type: 'pose', anim: 'breath-stand', until: now + rand(3, 6) };
    } else if (roll < 0.75) {
      this.act = { type: 'sit', phase: 'down', until: now + rand(4, 9) };
      this.anim.play('sit-down', { restart: true });
    } else if (roll < 0.85) {
      this.act = { type: 'pose', anim: pick(['roll', 'spin', 'salute']), once: true };
    } else {
      this.act = { type: 'pose', anim: 'idle', until: now + rand(2, 4) };
    }
  }

  runAct(dt, world) {
    const a = this.act;
    const p = this.platform;
    const cell = this.cell;
    if (a.type === 'move') {
      const lo = p.x1 + cell * 0.25;
      const hi = p.x2 - cell * 0.25;
      const target = clamp(a.target, lo, hi);
      const dir = Math.sign(target - this.x);
      if (dir) this.facing = dir;
      const speed = (a.run ? RUN : WALK) * this.u;
      const step = speed * dt;
      this.anim.play(a.run ? 'run' : 'walk');
      if (Math.abs(target - this.x) <= step) {
        this.x = target;
        if (a.hop && p.kind === 'window') {
          this.vx = this.facing * 280 * this.u;
          this.vy = -620 * this.u;
          this.x += this.facing * cell * 0.3;
          this.toAir('jump-rise');
          return;
        }
        if (a.chase) {
          const close = Math.abs(this.cursor.x - this.x) < cell;
          if (close && this.now > this.barkCooldownUntil) {
            this.barkCooldownUntil = this.now + 6;
            this.act = { type: 'pose', anim: 'interact', once: true };
          } else {
            this.act = { type: 'pose', anim: 'breath-stand', until: this.now + rand(1.5, 3), chase: true };
          }
        } else {
          this.act = null;
        }
        return;
      }
      this.x += dir * step;
      return;
    }
    if (a.type === 'pose') {
      if (a.once) {
        if (this.anim.name !== a.anim) this.anim.play(a.anim, { restart: true });
        if (this.anim.done) this.act = null;
      } else {
        this.anim.play(a.anim);
        if (this.now >= a.until) this.act = null;
      }
      return;
    }
    if (a.type === 'sit') {
      if (a.phase === 'down' && this.anim.done) { a.phase = 'hold'; this.anim.play('breath-sit'); }
      if (a.phase === 'hold' && (this.now >= a.until || this.now - this.cursorMovedAt < 0.2)) {
        a.phase = 'up';
        this.anim.play('stand-up', { restart: true });
      }
      if (a.phase === 'up' && this.anim.done) this.act = null;
      return;
    }
    if (a.type === 'sleep') {
      if (a.phase === 'down' && this.anim.done) { a.phase = 'sleep'; this.anim.play('sleep'); }
      const nearby = Math.hypot(this.cursor.x - this.x, this.cursor.y - this.y) < cell * 3;
      if (a.phase === 'sleep' && this.now - this.cursorMovedAt < 0.3 && nearby) this.wake();
      if (a.phase === 'up' && this.anim.done) this.act = null;
    }
  }

  wake() {
    this.activityAt = this.now;
    this.act = { type: 'sleep', phase: 'up' };
    this.anim.play('stand-up', { restart: true });
  }

  // ------------------------------------------------------------- digging into the taskbar

  startDig(world, user) {
    const p = this.platform;
    const fg = world.foreground;
    const buttons = (world.buttons || []).filter((b) => b.hwnd && b.rect[0] < p.x2 && b.rect[2] > p.x1 && Math.abs(b.rect[1] - p.y) < this.cell);
    const fresh = buttons.filter((b) => b.hwnd !== fg);
    const choices = fresh.length ? fresh : buttons;
    this.scheduleDig(this.now);
    if (!choices.length) return false;
    // Prefer an entry near Hero unless the user asked.
    let button;
    if (user) button = pick(choices);
    else {
      choices.sort((a, b) => Math.abs((a.rect[0] + a.rect[2]) / 2 - this.x) - Math.abs((b.rect[0] + b.rect[2]) / 2 - this.x));
      button = pick(choices.slice(0, 3));
    }
    const target = (button.rect[0] + button.rect[2]) / 2;
    this.act = { type: 'dig', phase: 'go', button, target };
    return true;
  }

  runDigApproach(dt) {
    const a = this.act;
    const cell = this.cell;
    if (a.phase === 'go') {
      const dir = Math.sign(a.target - this.x);
      if (dir) this.facing = dir;
      const far = Math.abs(a.target - this.x) > cell * 2;
      const step = (far ? RUN : WALK) * this.u * dt;
      this.anim.play(far ? 'run' : 'walk');
      if (Math.abs(a.target - this.x) <= step) {
        this.x = a.target;
        a.phase = 'sniff';
        this.anim.play('interact', { restart: true });
      } else this.x += dir * step;
      return;
    }
    if (a.phase === 'sniff' && this.anim.done) { a.phase = 'crouch'; this.anim.play('crouch', { restart: true }); return; }
    if (a.phase === 'crouch' && this.anim.done) {
      this.mode = 'dig';
      a.phase = 'sink';
      a.t = 0;
      this.clipY = this.platform.y;
      this.anim.play('crawl');
    }
  }

  updateDig(dt) {
    const a = this.act;
    const cell = this.cell;
    if (a.phase === 'sink') {
      a.t += dt;
      const k = clamp(a.t / 0.8, 0, 1);
      this.offsetY = k * cell * 0.95;
      this.spray(this.x, this.clipY, 3);
      if (k >= 1) {
        a.phase = 'wait';
        a.t = 0;
        this.hidden = true;
        this.requests.push({ type: 'activate', hwnd: a.button.hwnd });
      }
      return;
    }
    if (a.phase === 'wait') {
      a.t += dt;
      if (a.t > 4) this.emergeAt(this.x, this.ride.key, this.platform.y, null);
    }
  }

  /** Called by main with the helper's answer to an activate request. */
  activated(result, world) {
    if (this.mode !== 'dig') return;
    const rect = result && result.rect;
    if (!rect || rect[2] - rect[0] < 50) { this.emergeAt(this.x, this.ride.key, this.platform.y, null); return; }
    const [left, top, right] = rect;
    const d = displayAt(world.displays, (left + right) / 2, top + 1);
    this.u = d ? d.scale : this.u;
    const cell = this.cell;
    const x = clamp(rand(left + (right - left) * 0.3, left + (right - left) * 0.7), left + cell * 0.5, right - cell * 0.5);
    const headroom = d && top - d.phys.y >= cell * 0.85;
    if (headroom) {
      this.emergeAt(x, `w:${result.hwnd}`, top, rect);
    } else {
      // Maximized: no room above the title bar, so she pops out underneath it and hangs on.
      this.hidden = false;
      this.mode = 'hang';
      this.act = { until: this.now + rand(2.5, 4.5) };
      this.x = x;
      this.y = top + TITLE_GRIP * this.u;
      this.clipY = null;
      this.offsetY = 0;
      this.ride = { key: `w:${result.hwnd}`, rect: [...rect] };
      this.spray(this.x, this.y, 14);
      this.anim.play('ledge-hang', { restart: true });
    }
  }

  emergeAt(x, key, y, rect) {
    this.hidden = false;
    this.mode = 'emerge';
    this.x = x;
    this.y = y;
    this.clipY = y;
    this.offsetY = this.cell * 0.95;
    this.ride = { key, rect: rect ? [...rect] : null };
    this.act = { t: 0 };
    this.anim.play('jump-prepare', { restart: true });
  }

  updateEmerge(dt, world) {
    // Track the window if it is still settling into place.
    if (this.ride.rect) {
      const p = world.platforms.find((q) => q.key === this.ride.key);
      if (p) {
        this.x += p.rect[0] - this.ride.rect[0];
        this.y += p.rect[1] - this.ride.rect[1];
        this.clipY = this.y;
        this.ride.rect = [...p.rect];
      }
    }
    this.act.t += dt;
    const k = clamp(this.act.t / 0.45, 0, 1);
    this.offsetY = (1 - k) * (1 - k) * this.cell * 0.95;
    this.spray(this.x, this.clipY, 2);
    if (k >= 1) {
      this.vx = this.facing * 40 * this.u;
      this.vy = -700 * this.u;
      this.y -= 1;
      this.toAir('jump-rise');
    }
  }

  updateHang(dt, world) {
    const p = world.windows && world.windows.find((w) => `w:${w.hwnd}` === this.ride.key);
    if (!p) { this.vx = 0; this.vy = 0; this.toAir('fall'); return; }
    if (this.ride.rect) {
      this.x += p.rect[0] - this.ride.rect[0];
      this.y += p.rect[1] - this.ride.rect[1];
    }
    this.ride.rect = [...p.rect];
    this.anim.play('ledge-hang');
    if (this.now >= this.act.until) {
      this.vx = this.facing * 30 * this.u;
      this.vy = 0;
      this.toAir('fall');
    }
  }

  // -------------------------------------------------------------------------- effects

  spray(x, y, n) {
    const u = this.u;
    for (let i = 0; i < n; i++) {
      this.particles.push({
        x: x + rand(-0.25, 0.25) * this.cell,
        y,
        vx: rand(-260, 260) * u,
        vy: rand(-620, -260) * u,
        r: rand(2, 4.5) * u,
        life: rand(0.35, 0.7),
        color: pick(['#7a5232', '#94673f', '#5d3c22', '#b98a55']),
      });
    }
    if (this.particles.length > 160) this.particles.splice(0, this.particles.length - 160);
  }

  updateParticles(dt) {
    for (const p of this.particles) {
      p.vy += GRAVITY * 0.8 * this.u * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
    }
    this.particles = this.particles.filter((p) => p.life > 0);
  }

  keepOnScreen(world) {
    if (this.mode === 'held') return;
    const { maxY } = bounds(world.displays);
    if (this.y > maxY + this.cell * 2 || !Number.isFinite(this.x) || !Number.isFinite(this.y)) this.spawn(world, this.now);
  }

  // --------------------------------------------------------------------------- output

  /** What to draw, in physical pixels. */
  sprite() {
    if (this.hidden) return null;
    const { clip, frame } = this.anim.frame();
    const grip = clip.anchor === 'grip';
    return {
      file: clip.file,
      rect: frame.rect,
      px: frame.pivot.x,
      py: grip ? frame.pivot.y : 0.9,
      x: this.x,
      y: this.y + this.offsetY,
      cell: this.cell,
      mirror: this.facing < 0,
      clipY: this.clipY,
    };
  }

  /** Box that contains the sprite, for deciding which overlays draw it. */
  bounds() {
    const c = this.cell;
    return { x1: this.x - c, x2: this.x + c, y1: this.y - c * 1.1, y2: this.y + c * 0.6 };
  }

  takeRequests() { return this.requests.splice(0); }
}

function bounds(displays) {
  let minX = Infinity; let maxX = -Infinity; let minY = Infinity; let maxY = -Infinity;
  for (const d of displays) {
    minX = Math.min(minX, d.phys.x);
    maxX = Math.max(maxX, d.phys.x + d.phys.width);
    minY = Math.min(minY, d.phys.y);
    maxY = Math.max(maxY, d.phys.y + d.phys.height);
  }
  return { minX, maxX, minY, maxY };
}

module.exports = { Hero, DEFAULTS };
