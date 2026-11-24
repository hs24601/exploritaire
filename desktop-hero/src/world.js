'use strict';
// Turns a helper snapshot plus the display list into walkable platforms.
// Everything here is in physical pixels and has no Electron dependency, so it is unit tested.

/**
 * @typedef {{id:number, phys:{x:number,y:number,width:number,height:number}, scale:number}} Display
 * @typedef {{key:string, kind:'taskbar'|'floor'|'window', hwnd?:number, x1:number, x2:number, y:number,
 *            displayId:number, rect?:number[], max?:boolean}} Platform
 */

function displayAt(displays, x, y) {
  let best = null;
  let bestDist = Infinity;
  for (const d of displays) {
    const { x: dx, y: dy, width, height } = d.phys;
    const cx = Math.max(dx, Math.min(x, dx + width - 1));
    const cy = Math.max(dy, Math.min(y, dy + height - 1));
    const dist = Math.hypot(cx - x, cy - y);
    if (dist < bestDist) { bestDist = dist; best = d; }
    if (dist === 0) break;
  }
  return best;
}

function subtract(intervals, a, b) {
  const out = [];
  for (const [s, e] of intervals) {
    if (b <= s || a >= e) { out.push([s, e]); continue; }
    if (a > s) out.push([s, a]);
    if (b < e) out.push([b, e]);
  }
  return out;
}

/**
 * Floors: the top edge of each display's bottom taskbar, or the display's bottom edge.
 * Taskbars on other edges (or auto-hidden ones) leave the bottom edge as the floor.
 */
function floorsFor(displays, taskbars = []) {
  return displays.map((d) => {
    const { x, y, width, height } = d.phys;
    const bottom = y + height;
    for (const t of taskbars) {
      const [l, top, r, b] = t.rect;
      const overlapsX = Math.min(r, x + width) - Math.max(l, x) > width * 0.5;
      const atBottom = b >= bottom - 2 && top > y + height * 0.5;
      if (overlapsX && atBottom && !t.autohide && bottom - top >= 8) {
        return { key: `tb:${d.id}`, kind: 'taskbar', x1: x, x2: x + width, y: top, displayId: d.id, rect: t.rect };
      }
    }
    return { key: `floor:${d.id}`, kind: 'floor', x1: x, x2: x + width, y: bottom, displayId: d.id };
  });
}

/**
 * Builds platforms from the snapshot.
 * @param {object} snap helper snapshot (windows top-first)
 * @param {Display[]} displays
 * @param {(d:Display)=>{w:number,h:number}} heroSize hero body size on a display
 */
function buildPlatforms(snap, displays, heroSize) {
  const floors = floorsFor(displays, snap.taskbars);
  const platforms = [...floors];
  const occluders = (snap.taskbars || []).filter((t) => !t.autohide).map((t) => t.rect);
  for (const w of snap.windows || []) {
    const [left, top, right, bottom] = w.rect;
    const d = displayAt(displays, (left + right) / 2, top);
    if (d) {
      const floor = floors.find((f) => f.displayId === d.id);
      const size = heroSize(d);
      const headroom = top - d.phys.y >= size.h * 0.85;
      const aboveFloor = top < floor.y - size.h * 0.5;
      const onDisplay = top >= d.phys.y && top < d.phys.y + d.phys.height;
      if (headroom && aboveFloor && onDisplay) {
        let spans = [[Math.max(left, d.phys.x), Math.min(right, d.phys.x + d.phys.width)]];
        for (const [ol, ot, or, ob] of occluders) {
          if (ot <= top && ob > top) spans = subtract(spans, ol, or);
        }
        for (const [x1, x2] of spans) {
          if (x2 - x1 >= size.w * 0.6) {
            platforms.push({ key: `w:${w.hwnd}`, kind: 'window', hwnd: w.hwnd, x1, x2, y: top, displayId: d.id, rect: w.rect, max: !!w.max });
          }
        }
      }
    }
    occluders.push(w.rect);
  }
  return platforms;
}

/** The platform segment with this key under x (with a little slack), or null. */
function segmentFor(platforms, key, x, slack = 0) {
  let best = null;
  for (const p of platforms) {
    if (p.key !== key) continue;
    if (x >= p.x1 - slack && x <= p.x2 + slack) return p;
    if (!best) best = p;
  }
  return null;
}

/** First platform crossed while moving from y0 to y1 (downward) at x. */
function landingPlatform(platforms, x, y0, y1) {
  let hit = null;
  for (const p of platforms) {
    if (x < p.x1 || x > p.x2) continue;
    if (p.y >= y0 - 0.5 && p.y <= y1 && (!hit || p.y < hit.y)) hit = p;
  }
  return hit;
}

/** Displays whose foreground app is fullscreen. */
function fullscreenDisplays(snap, displays) {
  const fg = snap.fg;
  if (!fg || !fg.fullscreen) return new Set();
  const [l, t, r, b] = fg.monitor;
  const hit = displayAt(displays, (l + r) / 2, (t + b) / 2);
  return new Set(hit ? [hit.id] : []);
}

module.exports = { displayAt, subtract, floorsFor, buildPlatforms, segmentFor, landingPlatform, fullscreenDisplays };
