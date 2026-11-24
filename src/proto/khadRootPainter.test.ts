import { describe, expect, it } from 'vitest';
import { KHAD_PAINT_FRAME, paintKhadBridge, paintKhadRoots } from './khadRootPainter';
import { KHAD_REWARD_CLEARANCE, KHAD_VALUE_CLEARANCE, khadBridgeGeometry, khadRootGeometry } from './khadRootGeometry';

const at = (raster: { width: number; data: Uint8ClampedArray }, x: number, y: number) => raster.data.slice((y * raster.width + x) * 4, (y * raster.width + x) * 4 + 4);
const glowing = (p: Uint8ClampedArray) => p[3] > 200 && p[0] > 190 && p[1] < 120 && p[0] > p[1] * 2;

describe('Khad Roots bark-plate painter', () => {
  it('bakes identical pixels for the same card and different pixels per card', () => {
    const a = paintKhadRoots('paint-card-1', false, 1), b = paintKhadRoots('paint-card-1', false, 1), c = paintKhadRoots('paint-card-2', false, 1);
    expect(a.data).toEqual(b.data);
    expect(a.data).not.toEqual(c.data);
  });

  it('paints the vines and leaves the reward and value windows clear unless the value is opted in', () => {
    const d = 1.2;
    for (const id of ['paint-card-3', 'paint-card-4']) {
      const raster = paintKhadRoots(id, false, d), covered = paintKhadRoots(id, true, d), px = (x: number, y: number) => [Math.round((x - KHAD_PAINT_FRAME.x) * d), Math.round((y - KHAD_PAINT_FRAME.y) * d)];
      let painted = 0; for (let i = 3; i < raster.data.length; i += 4) if (raster.data[i] > 40) painted++;
      expect(painted).toBeGreaterThan(raster.width * raster.height * .04);
      for (const r of [KHAD_REWARD_CLEARANCE, KHAD_VALUE_CLEARANCE]) for (let y = r.y + 6; y < r.y + r.h - 6; y += 2) for (let x = r.x + 6; x < r.x + r.w - 6; x += 2) {
        const [cx, cy] = px(x, y); expect(at(raster, cx, cy)[3]).toBe(0);
      }
      // With the opt-in, the crossing vine paints inside the value window.
      let inside = 0; const v = KHAD_VALUE_CLEARANCE;
      for (let y = v.y; y < v.y + v.h; y++) for (let x = v.x; x < v.x + v.w; x++) { const [cx, cy] = px(x, y); if (at(covered, cx, cy)[3] > 40) inside++; }
      expect(inside).toBeGreaterThan(0);
    }
  });

  it('keeps glowing cracks on upper surfaces of the wood, never on undersides', () => {
    const d = 3;
    for (const id of ['paint-card-5', 'paint-card-6', 'paint-card-7']) {
      const raster = paintKhadRoots(id, false, d), stems = khadRootGeometry(id).stems.map(s => s.spine);
      let glow = 0, below = 0;
      for (let y = 0; y < raster.height; y++) for (let x = 0; x < raster.width; x++) {
        if (!glowing(at(raster, x, y))) continue;
        glow++;
        const cx = x / d + KHAD_PAINT_FRAME.x, cy = y / d + KHAD_PAINT_FRAME.y;
        // Vines paint in order, so the visible pixel belongs to the last vine
        // whose body covers it; judge "upper" against that vine's centreline.
        // Project onto each vine's centreline segments, as the painter does.
        const foot = (spine: typeof stems[number]) => { let bestD = Infinity, fx = 0, fy = 0, w = 1;
          for (let i = 1; i < spine.length; i++) { const p = spine[i - 1], q = spine[i], vx = q.x - p.x, vy = q.y - p.y, l2 = vx * vx + vy * vy || 1, t = Math.max(0, Math.min(1, ((cx - p.x) * vx + (cy - p.y) * vy) / l2)), x = p.x + vx * t, y = p.y + vy * t, dd = Math.hypot(cx - x, cy - y) - (p.w + (q.w - p.w) * t);
            if (dd < bestD) { bestD = dd; fx = x; fy = y; w = p.w; } } return { x: fx, y: fy, gap: bestD, w }; };
        let near = foot(stems[0]);
        for (const spine of stems) { const f2 = foot(spine); if (f2.gap <= .15 * f2.w || f2.gap < near.gap) near = f2; }
        // Allow half a pixel of antialiasing at the centreline.
        if (cy > near.y + .5 / d) below++;
      }
      expect(glow).toBeGreaterThan(0);
      expect(below / glow).toBeLessThan(.02);
    }
  });

  it('keeps thorns clearly visible: lighter than the wood and bright enough to read on the card', () => {
    const d = 3, lum = (p: Uint8ClampedArray) => .2126 * p[0] + .7152 * p[1] + .0722 * p[2] + .25 * p[0];
    for (const id of ['paint-card-8', 'paint-card-9']) {
      const raster = paintKhadRoots(id, false, d), g = khadRootGeometry(id), px = (x: number, y: number) => [Math.round((x - KHAD_PAINT_FRAME.x) * d), Math.round((y - KHAD_PAINT_FRAME.y) * d)];
      const thorn: number[] = [], wood: number[] = [];
      for (const stem of g.stems) {
        // Thorn bodies away from the base (where wood overlaps) and the tip.
        for (const t of stem.thornShapes) for (const k of [.4, .5, .6]) {
          const mx = (t.a.x + t.b.x) / 2, my = (t.a.y + t.b.y) / 2, [x, y] = px(mx + (t.tip.x - mx) * k, my + (t.tip.y - my) * k), p = at(raster, x, y);
          if (p[3] > 200) thorn.push(lum(p));
        }
        for (const p of stem.spine.filter((_, i) => i % 4 === 0)) { const [x, y] = px(p.x, p.y), c = at(raster, x, y); if (c[3] > 200) wood.push(lum(c)); }
      }
      const median = (v: number[]) => [...v].sort((a, b) => a - b)[Math.floor(v.length / 2)];
      expect(thorn.length).toBeGreaterThan(20);
      expect(median(thorn)).toBeGreaterThan(median(wood) * 1.25);
      expect(median(thorn)).toBeGreaterThan(45);
    }
  });

  it('paints group links within their own frame', () => {
    const frame = { x: -20, y: -20, size: 200 }, raster = paintKhadBridge({ x: 20, y: 100 }, { x: 150, y: 40 }, 'link:a', frame, 1);
    expect(raster.width).toBe(200);
    const [ax, ay] = [20 - frame.x, 100 - frame.y];
    let near = 0; for (let y = ay - 4; y <= ay + 4; y++) for (let x = ax - 4; x <= ax + 4; x++) if (at(raster, x, y)[3] > 40) near++;
    expect(near).toBeGreaterThan(0);
    expect(khadBridgeGeometry({ x: 20, y: 100 }, { x: 150, y: 40 }, 'link:a').spine.length).toBeGreaterThan(20);
  });

  it('rejects unsupported raster sizes', () => {
    expect(() => paintKhadRoots('paint-card-1', false, 100)).toThrow();
  });
});
