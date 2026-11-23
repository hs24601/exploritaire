import { chartPoints, type Rect, type SkyPoint } from './stellarSky';

/** Canvas night sky behind the stellar grid.
 *
 * Draws a baked backdrop (gradient, milky way, faint field stars), twinkling
 * stars, settled constellations, the live chain charted across the upper sky,
 * the Eclipse with its HP ring, and short-lived motes, beams, ripples and
 * damage numbers. The low tier keeps every piece of information but drops
 * twinkle, trails, shooting stars and the corona shimmer, and renders at 1x. */
export type SkyLayout = { chart: Rect; foe: { x: number; y: number; r: number }; hero: SkyPoint };
type Settled = { points: SkyPoint[]; tiers: number[]; name: string; home: SkyPoint; half: SkyPoint; from: SkyPoint[]; t0: number };
type Fx =
  | { kind: 'mote'; from: SkyPoint; star: number; t0: number; length: number }
  | { kind: 'beam'; from: SkyPoint; tier: number; t0: number; length: number }
  | { kind: 'number'; text: string; at: SkyPoint; tier: number; t0: number; length: number }
  | { kind: 'ripple'; at: SkyPoint; t0: number; length: number; dark: boolean }
  | { kind: 'tendril'; t0: number; length: number }
  | { kind: 'shoot'; from: SkyPoint; dir: SkyPoint; t0: number; length: number }
  | { kind: 'fizzle'; at: SkyPoint[]; t0: number; length: number };

const TIER_RGB = ['200,220,255', '150,230,255', '255,214,140', '255,190,220'];
const ease = (t: number) => 1 - (1 - Math.min(1, Math.max(0, t))) ** 3;
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const rand = (() => { let s = 7; return () => { s = (s * 16807) % 2147483647; return s / 2147483647; }; })();

function glow(rgb: string) {
  const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,1)'); grad.addColorStop(0.12, `rgba(${rgb},0.9)`); grad.addColorStop(0.35, `rgba(${rgb},0.25)`); grad.addColorStop(1, `rgba(${rgb},0)`);
  g.fillStyle = grad; g.fillRect(0, 0, 64, 64); return c;
}

export function createSkyRenderer(canvas: HTMLCanvasElement,options:{combat?:boolean}={}) {
  const ctx = canvas.getContext('2d')!;
  const sprites = TIER_RGB.map(glow);
  const backdrop = document.createElement('canvas');
  let W = 0, H = 0, dpr = 1, low = false, layout: SkyLayout | null = null;
  let twinkles: { x: number; y: number; r: number; p: number; s: number }[] = [];
  let active: { ranks: number[]; tiers: number[]; lit: number[]; seed: number } = { ranks: [], tiers: [], lit: [], seed: 1 };
  const settled: Settled[] = [];
  let fx: Fx[] = [];
  let foe = { hp: 1, shown: 1, charge: 0, defeated: 0, hit: 0 }, dawn = 0, dawnTarget = 0, nextShoot = 4000;

  function bake() {
    backdrop.width = Math.round(W * dpr); backdrop.height = Math.round(H * dpr);
    const g = backdrop.getContext('2d')!; g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const sky = g.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, '#03050d'); sky.addColorStop(0.55, '#081029'); sky.addColorStop(1, '#16193a');
    g.fillStyle = sky; g.fillRect(0, 0, W, H);
    // Milky way: a soft diagonal band of haze and dense faint stars.
    const seedRand = (() => { let s = 42; return () => { s = (s * 16807) % 2147483647; return s / 2147483647; }; })();
    const band = (t: number) => ({ x: t * W, y: H * (0.95 - 0.8 * t) + Math.sin(t * 5) * H * 0.04 });
    for (let i = 0; i < (low ? 40 : 90); i++) {
      const t = seedRand(), c = band(t), r = (0.08 + seedRand() * 0.14) * Math.max(W, H);
      const hue = [['70,110,170', 0.05], ['120,80,170', 0.035], ['60,150,160', 0.03], ['170,90,130', 0.02]][i % 4] as [string, number];
      const grad = g.createRadialGradient(c.x + (seedRand() - 0.5) * r, c.y + (seedRand() - 0.5) * r * 0.6, 0, c.x, c.y, r);
      grad.addColorStop(0, `rgba(${hue[0]},${hue[1]})`); grad.addColorStop(1, `rgba(${hue[0]},0)`);
      g.fillStyle = grad; g.fillRect(c.x - r * 1.5, c.y - r * 1.5, r * 3, r * 3);
    }
    const count = Math.round((W * H) / (low ? 2600 : 1100));
    for (let i = 0; i < count; i++) {
      const inBand = seedRand() < 0.45, t = seedRand(), c = band(t);
      const x = inBand ? c.x + (seedRand() - 0.5) * W * 0.18 : seedRand() * W, y = inBand ? c.y + (seedRand() - 0.5) * H * 0.22 : seedRand() * H;
      const r = 0.25 + seedRand() ** 6 * 1.3, a = 0.15 + seedRand() * 0.55, warm = seedRand();
      g.fillStyle = warm > 0.9 ? `rgba(255,220,190,${a})` : warm > 0.75 ? `rgba(190,210,255,${a})` : `rgba(235,240,255,${a})`;
      g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
    }
    twinkles = low ? [] : Array.from({ length: Math.round((W * H) / 9000) }, () => ({ x: seedRand() * W, y: seedRand() * H, r: 0.7 + seedRand() * 1.1, p: seedRand() * 6.28, s: 0.6 + seedRand() * 1.8 }));
  }

  function resize(lowTier: boolean) {
    low = lowTier; dpr = low ? 1 : Math.min(2, window.devicePixelRatio || 1);
    W = canvas.clientWidth; H = canvas.clientHeight;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    bake();
  }

  const chartPx = (p: SkyPoint) => layout ? { x: layout.chart.x + p.x * layout.chart.w, y: layout.chart.y + p.y * layout.chart.h } : p;
  const activePoints = () => chartPoints(active.ranks, active.seed).map(chartPx);
  /** Settled figures keep their charted contour, tilted a little so the sky doesn't fill with level lines. */
  const settledShape = (points: SkyPoint[], seed: number) => {
    const angle = ((seed % 1000) / 1000 - 0.5) * 0.8, cos = Math.cos(angle), sin = Math.sin(angle);
    const turned = points.map(p => ({ x: (p.x - 0.5) * cos - (p.y - 0.5) * 0.6 * sin, y: (p.x - 0.5) * sin + (p.y - 0.5) * 0.6 * cos }));
    const xs = turned.map(p => p.x), ys = turned.map(p => p.y), minX = Math.min(...xs), minY = Math.min(...ys);
    const span = Math.max(Math.max(...xs) - minX, (Math.max(...ys) - minY) * 1.6, 0.001);
    return turned.map(p => ({ x: (p.x - minX) / span + (1 - (Math.max(...xs) - minX) / span) / 2, y: (p.y - minY) / span * 1.6 + (1 - (Math.max(...ys) - minY) / span * 1.6) / 2 }));
  };

  function star(p: SkyPoint, tier: number, size: number, alpha: number) {
    const s = sprites[Math.min(3, Math.max(0, tier - 1))], d = size * (1.8 + tier * 0.5);
    ctx.globalAlpha = alpha; ctx.drawImage(s, p.x - d / 2, p.y - d / 2, d, d); ctx.globalAlpha = 1;
  }
  function line(a: SkyPoint, b: SkyPoint, rgb: string, alpha: number, width: number) {
    ctx.strokeStyle = `rgba(${rgb},${alpha})`; ctx.lineWidth = width; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
  }

  function drawEclipse(now: number) {
    if (!layout) return;
    const { x, y, r } = layout.foe, gone = foe.defeated ? ease((now - foe.defeated) / 2400) : 0;
    foe.shown = lerp(foe.shown, foe.hp, 0.12);
    const pulse = low ? 0 : Math.sin(now / 900) * 0.06, hit = foe.hit ? Math.max(0, 1 - (now - foe.hit) / 350) : 0;
    const corona = ctx.createRadialGradient(x, y, r * 0.9, x, y, r * (2.3 + foe.charge * 0.6 + pulse + gone * 3));
    const heat = Math.round(lerp(190, 110, foe.charge));
    corona.addColorStop(0, `rgba(255,${heat + 40},${heat - 20},${0.55 + hit * 0.4 + gone * 0.45})`);
    corona.addColorStop(0.35, `rgba(240,${heat},${heat - 40},${0.14 + foe.charge * 0.1})`);
    corona.addColorStop(1, 'rgba(120,60,90,0)');
    ctx.fillStyle = corona; ctx.beginPath(); ctx.arc(x, y, r * 4, 0, Math.PI * 2); ctx.fill();
    if (!low) for (let i = 0; i < 7; i++) {
      const a = now / 4000 + i * 0.9, len = r * (1.25 + 0.25 * Math.sin(now / 700 + i * 2) + foe.charge * 0.3);
      ctx.strokeStyle = `rgba(255,${heat + 30},${heat},${0.08 * (1 - gone)})`; ctx.lineWidth = 6; ctx.beginPath();
      ctx.arc(x, y, len, a, a + 0.5 + 0.2 * Math.sin(now / 500 + i)); ctx.stroke();
    }
    const disc = r * (1 - gone * 0.9);
    ctx.fillStyle = '#020309'; ctx.beginPath(); ctx.arc(x, y, disc, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = `rgba(255,235,210,${0.7 + hit * 0.3})`; ctx.lineWidth = 1.5; ctx.stroke();
    // HP ring
    const ringR = r * 1.32, start = -Math.PI / 2;
    ctx.lineCap = 'round';
    ctx.strokeStyle = `rgba(200,210,255,${0.14 * (1 - gone)})`; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(x, y, ringR, 0, Math.PI * 2); ctx.stroke();
    if (foe.shown > 0.002) { ctx.strokeStyle = `rgba(255,214,150,${0.95 * (1 - gone)})`; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(x, y, ringR, start, start + Math.PI * 2 * foe.shown); ctx.stroke(); }
    ctx.lineCap = 'butt';
  }

  function frame(now: number) {
    if (!W || !H) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.drawImage(backdrop, 0, 0, W, H);
    dawn = lerp(dawn, dawnTarget, 0.01);
    if (dawn > 0.01) { const g = ctx.createLinearGradient(0, H, 0, 0); g.addColorStop(0, `rgba(255,170,120,${0.35 * dawn})`); g.addColorStop(0.5, `rgba(120,110,170,${0.25 * dawn})`); g.addColorStop(1, 'rgba(40,50,110,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); }
    for (const t of twinkles) { const a = 0.35 + 0.35 * Math.sin(now / 1000 * t.s + t.p); ctx.fillStyle = `rgba(235,240,255,${a})`; ctx.fillRect(t.x, t.y, t.r, t.r); }
    if (!low && now > nextShoot) {
      nextShoot = now + 7000 + rand() * 9000;
      fx.push({ kind: 'shoot', from: { x: rand() * W, y: rand() * H * 0.4 }, dir: { x: (rand() > 0.5 ? 1 : -1) * (0.6 + rand() * 0.4), y: 0.35 + rand() * 0.3 }, t0: now, length: 900 });
    }
    // Settled constellations.
    ctx.font = '500 16px Outfit, "Segoe UI", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    settled.forEach((c, index) => {
      const k = ease((now - c.t0) / 1600), age = settled.length - 1 - index, fade = Math.max(0.35, 1 - age * 0.06);
      const pts = c.points.map((p, i) => ({ x: lerp(c.from[i].x, (c.home.x - c.half.x + p.x * c.half.x * 2) * W, k), y: lerp(c.from[i].y, (c.home.y - c.half.y + p.y * c.half.y * 2) * H, k) }));
      const breathe = low ? 1 : 0.85 + 0.15 * Math.sin(now / 2400 + index);
      for (let i = 1; i < pts.length; i++) line(pts[i - 1], pts[i], '170,195,255', lerp(0.7, 0.32, k) * fade, 1);
      pts.forEach((p, i) => star(p, c.tiers[i], lerp(7, 4.5, k), lerp(1, 0.75, k) * fade * breathe));
      const label = 1 - Math.max(0, Math.min(1, ((now - c.t0) - 3200) / 1400));
      if (label > 0) {
        const bottom = Math.max(...pts.map(p => p.y));
        ctx.fillStyle = `rgba(225,232,255,${label * 0.9})`; ctx.fillText(c.name, pts.reduce((s, p) => s + p.x, 0) / pts.length, bottom + 12);
      }
    });
    // Live chain.
    const pts = activePoints();
    for (let i = 1; i < pts.length; i++) {
      const k = ease((now - active.lit[i]) / 260); if (k <= 0) continue;
      const a = pts[i - 1], b = pts[i];
      line(a, { x: lerp(a.x, b.x, k), y: lerp(a.y, b.y, k) }, TIER_RGB[Math.min(3, active.tiers[i] - 1)], 0.75, 1.6);
    }
    pts.forEach((p, i) => {
      const age = now - active.lit[i]; if (age < 0) return;
      const pop = 1 + Math.max(0, 1 - age / 400) * 1.2, tw = low ? 1 : 0.88 + 0.12 * Math.sin(now / 300 + i);
      star(p, active.tiers[i], 9 * pop, tw);
    });
    if(options.combat===true)drawEclipse(now);
    // Effects.
    fx = fx.filter(f => now - f.t0 < f.length);
    for (const f of fx) {
      const t = (now - f.t0) / f.length;
      if (f.kind === 'mote') {
        const target = activePoints()[f.star]; if (!target) continue;
        const k = ease(t), arc = Math.sin(t * Math.PI) * 60, p = { x: lerp(f.from.x, target.x, k), y: lerp(f.from.y, target.y, k) - arc };
        if (!low) for (let s = 1; s <= 5; s++) { const kk = ease(Math.max(0, t - s * 0.04)), q = { x: lerp(f.from.x, target.x, kk), y: lerp(f.from.y, target.y, kk) - Math.sin(Math.max(0, t - s * 0.04) * Math.PI) * 60 }; star(q, active.tiers[f.star] ?? 1, 6 - s * 0.8, 0.5 - s * 0.08); }
        star(p, active.tiers[f.star] ?? 1, 8, 1);
      } else if (f.kind === 'beam' && layout) {
        const k = ease(t * 1.6), a = f.from, b = { x: layout.foe.x, y: layout.foe.y };
        const head = { x: lerp(a.x, b.x, k), y: lerp(a.y, b.y, k) }, tail = { x: lerp(a.x, b.x, Math.max(0, k - 0.35)), y: lerp(a.y, b.y, Math.max(0, k - 0.35)) };
        line(tail, head, TIER_RGB[f.tier - 1], 0.85 * (1 - t), 1 + f.tier * 0.7);
        if (k < 1) star(head, f.tier, 7, 1 - t);
      } else if (f.kind === 'number') {
        ctx.font = `600 ${20 + f.tier * 4}px Outfit, "Segoe UI", sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillStyle = `rgba(${TIER_RGB[f.tier - 1]},${1 - ease(Math.max(0, t - 0.5) * 2)})`;
        ctx.fillText(f.text, f.at.x, f.at.y - ease(t) * 34);
      } else if (f.kind === 'ripple') {
        ctx.strokeStyle = f.dark ? `rgba(150,90,170,${0.6 * (1 - t)})` : `rgba(200,225,255,${0.5 * (1 - t)})`; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(f.at.x, f.at.y, 20 + ease(t) * 160, 0, Math.PI * 2); ctx.stroke();
      } else if (f.kind === 'tendril' && layout) {
        const a = { x: layout.foe.x, y: layout.foe.y }, b = layout.hero, k = ease(t * 1.4);
        ctx.strokeStyle = `rgba(150,80,160,${0.7 * (1 - t)})`; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(a.x, a.y);
        const mid = { x: (a.x + b.x) / 2, y: Math.min(a.y, b.y) - 120 };
        for (let s = 1; s <= 24; s++) { const u = s / 24 * k, x = (1 - u) ** 2 * a.x + 2 * (1 - u) * u * mid.x + u * u * b.x, y = (1 - u) ** 2 * a.y + 2 * (1 - u) * u * mid.y + u * u * b.y; ctx.lineTo(x + Math.sin(s + now / 60) * (low ? 0 : 3), y); }
        ctx.stroke();
      } else if (f.kind === 'shoot') {
        const head = { x: f.from.x + f.dir.x * t * 520, y: f.from.y + f.dir.y * t * 520 }, a = Math.sin(t * Math.PI);
        const grad = ctx.createLinearGradient(head.x - f.dir.x * 140, head.y - f.dir.y * 140, head.x, head.y);
        grad.addColorStop(0, 'rgba(220,235,255,0)'); grad.addColorStop(1, `rgba(220,235,255,${0.8 * a})`);
        ctx.strokeStyle = grad; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(head.x - f.dir.x * 140, head.y - f.dir.y * 140); ctx.lineTo(head.x, head.y); ctx.stroke();
      } else if (f.kind === 'fizzle') {
        for (const p of f.at) star({ x: p.x, y: p.y + ease(t) * 30 }, 1, 7 * (1 - t), 1 - t);
      }
    }
  }

  return {
    resize, frame,
    setLayout(next: SkyLayout) { layout = next; },
    /** Start a fresh chain on a foundation star. */
    startChain(rank: number, now: number, from?: SkyPoint) {
      active = { ranks: [rank], tiers: [1], lit: [now + (from ? 380 : 0)], seed: Math.floor(rand() * 1e6) };
      if (from) fx.push({ kind: 'mote', from, star: 0, t0: now, length: 380 });
    },
    /** A receipt rises into its star; optional legacy combat effects stay opt-in. */
    addStar(rank: number, tier: number, damage: number, from: SkyPoint, now: number) {
      active.ranks.push(rank); active.tiers.push(tier); active.lit.push(now + 380);
      const index = active.ranks.length - 1;
      fx.push({ kind: 'mote', from, star: index, t0: now, length: 380 });
      if(options.combat!==true)return;
      const target = activePoints()[index];
      setTimeout(() => {
        fx.push({ kind: 'beam', from: target, tier, t0: performance.now(), length: 420 });
        if (layout) fx.push({ kind: 'number', text: `−${damage}`, at: { x: layout.foe.x, y: layout.foe.y - layout.foe.r * 1.6 }, tier, t0: performance.now() + 180, length: 1000 });
        setTimeout(() => { foe.hit = performance.now(); }, 180);
      }, 380);
    },
    /** End the live chain: three or more stars settle as a named figure; shorter ones fall away. */
    settle(name: string | null, home: SkyPoint | null, half: SkyPoint, now: number) {
      const pts = activePoints();
      if (name && home && pts.length >= 3) settled.push({ points: settledShape(chartPoints(active.ranks, active.seed), active.seed), tiers: [...active.tiers], name, home, half, from: pts, t0: now });
      else if (pts.length) fx.push({ kind: 'fizzle', at: pts, t0: now, length: 700 });
      if (settled.length > 16) settled.shift();
      active = { ranks: [], tiers: [], lit: [], seed: 1 };
    },
    get activeCount() { return active.ranks.length; },
    get diagnostics(){return {combat:options.combat===true,effects:fx.map(effect=>effect.kind)};},
    homes: () => settled.map(s => s.home),
    setFoe(hp: number, charge: number) { foe.hp = hp; foe.charge = charge; },
    strike(now: number) { if (layout) { fx.push({ kind: 'tendril', t0: now, length: 700 }); fx.push({ kind: 'ripple', at: { x: layout.foe.x, y: layout.foe.y }, t0: now, length: 900, dark: true }); fx.push({ kind: 'ripple', at: layout.hero, t0: now + 350, length: 700, dark: true }); } },
    burst(at: SkyPoint, now: number) { fx.push({ kind: 'ripple', at, t0: now, length: 1100, dark: false }); },
    win(now: number) { foe.defeated = now; dawnTarget = 1; },
    reset() { settled.length = 0; fx = []; active = { ranks: [], tiers: [], lit: [], seed: 1 }; foe = { hp: 1, shown: 1, charge: 0, defeated: 0, hit: 0 }; dawnTarget = 0; },
  };
}
export type SkyRenderer = ReturnType<typeof createSkyRenderer>;
