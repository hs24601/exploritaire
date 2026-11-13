import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { seeded } from '../proto/atmosphere';
import { useFxQuality } from '../proto/fxQuality';
import { CONSTELLATIONS, type SkyEffect, type SkyPoint, type SkyState } from './constellations';

/** Night sky behind the musical tableaus: dim guide stars for every figure,
 * gold lines for the ones the party has drawn. The canvas only animates while
 * a line, ripple or fade is running, then stops. The Low tier draws the same
 * end state with no animation at all. */
export type ConstellationSkyHandle = { play: (effects: SkyEffect[]) => void };

type Anim = { kind: 'comet' | 'ripple' | 'flash' | 'fade' | 'reset'; figure: number; star: number; start: number; length: number; stars?: number; completed?: number[] };

const LINE = '243,219,160', STAR = '255,244,214';
const random = seeded('musical-tableaus-sky');
const FIELD = Array.from({ length: 260 }, () => ({ x: random(), y: random(), r: 0.4 + random() ** 4 * 1.2, a: 0.25 + random() * 0.6, warm: random() > 0.85 }));

const glowSprite = (() => {
  let sprite: HTMLCanvasElement | null = null;
  return () => {
    if (sprite) return sprite;
    sprite = document.createElement('canvas'); sprite.width = sprite.height = 64;
    const ctx = sprite.getContext('2d')!, gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    gradient.addColorStop(0, `rgba(${STAR},0.9)`); gradient.addColorStop(0.25, `rgba(${LINE},0.35)`); gradient.addColorStop(1, `rgba(${LINE},0)`);
    ctx.fillStyle = gradient; ctx.fillRect(0, 0, 64, 64);
    return sprite;
  };
})();

const easeOut = (t: number) => 1 - (1 - t) ** 3;

export const ConstellationSky = forwardRef<ConstellationSkyHandle, { sky: SkyState }>(function ConstellationSky({ sky }, ref) {
  const canvas = useRef<HTMLCanvasElement>(null), skyRef = useRef(sky), anims = useRef<Anim[]>([]), frame = useRef(0), backdrop = useRef<HTMLCanvasElement | null>(null);
  const quality = useFxQuality(), qualityRef = useRef(quality);
  skyRef.current = sky; qualityRef.current = quality;

  const draw = (now: number) => {
    const surface = canvas.current, ctx = surface?.getContext('2d');
    if (!surface || !ctx) return false;
    const width = surface.clientWidth, height = surface.clientHeight, dpr = Math.min(2, window.devicePixelRatio || 1);
    if (surface.width !== Math.round(width * dpr) || surface.height !== Math.round(height * dpr) || !backdrop.current) {
      surface.width = Math.round(width * dpr); surface.height = Math.round(height * dpr);
      const back = document.createElement('canvas'); back.width = surface.width; back.height = surface.height;
      const b = back.getContext('2d')!; b.setTransform(dpr, 0, 0, dpr, 0, 0);
      const gradient = b.createLinearGradient(0, 0, 0, height); gradient.addColorStop(0, '#040a17'); gradient.addColorStop(0.7, '#0a1724'); gradient.addColorStop(1, '#10241f');
      b.fillStyle = gradient; b.fillRect(0, 0, width, height);
      for (const star of FIELD) { b.fillStyle = star.warm ? `rgba(255,226,193,${star.a})` : `rgba(202,225,255,${star.a})`; b.beginPath(); b.arc(star.x * width, star.y * height, star.r, 0, Math.PI * 2); b.fill(); }
      backdrop.current = back;
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(backdrop.current, 0, 0);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const at = (p: SkyPoint) => [p.x * width, p.y * height] as const;
    const line = (a: SkyPoint, b: SkyPoint, alpha: number, t = 1) => {
      if (alpha <= 0.01) return;
      const [x1, y1] = at(a), [x2, y2] = at(b);
      ctx.strokeStyle = `rgba(${LINE},${alpha})`; ctx.lineWidth = 1.6; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x1 + (x2 - x1) * t, y1 + (y2 - y1) * t); ctx.stroke();
    };
    const dot = (p: SkyPoint, radius: number, alpha: number, glow = 0) => {
      const [x, y] = at(p);
      if (glow > 0.01) { const size = 26 * glow + 10; ctx.globalAlpha = Math.min(1, glow); ctx.drawImage(glowSprite(), x - size / 2, y - size / 2, size, size); ctx.globalAlpha = 1; }
      ctx.fillStyle = `rgba(${STAR},${alpha})`; ctx.beginPath(); ctx.arc(x, y, radius, 0, Math.PI * 2); ctx.fill();
    };
    const state = skyRef.current, live = anims.current = anims.current.filter(anim => now - anim.start < anim.length);
    const progress = (anim: Anim) => Math.min(1, Math.max(0, (now - anim.start) / anim.length));
    const resetting = live.find(anim => anim.kind === 'reset');
    CONSTELLATIONS.forEach((figure, index) => {
      const done = state.completed.includes(index), lostDone = resetting?.completed?.includes(index);
      const flash = live.find(anim => anim.kind === 'flash' && anim.figure === index), flashGlow = flash ? 1 - progress(flash) : 0;
      const fade = live.find(anim => anim.kind === 'fade' && anim.figure === index), fadeAlpha = fade ? 1 - easeOut(progress(fade)) : 0;
      const doneAlpha = done ? 1 : lostDone ? 1 - easeOut(progress(resetting!)) : 0;
      const lit = index === state.figure && !done ? state.lit : 0;
      figure.stars.forEach((star, s) => {
        if (s > 0) {
          const comet = live.find(anim => anim.kind === 'comet' && anim.figure === index && anim.star === s);
          if (doneAlpha) line(figure.stars[s - 1], star, (0.55 + 0.4 * flashGlow) * doneAlpha);
          else if (s < lit) line(figure.stars[s - 1], star, 0.75, comet ? easeOut(progress(comet)) : 1);
          else if (fade && s < (fade.stars ?? 0)) line(figure.stars[s - 1], star, 0.6 * fadeAlpha);
        }
      });
      if (doneAlpha) figure.closing?.forEach(([a, b]) => line(figure.stars[a], figure.stars[b], (0.45 + 0.4 * flashGlow) * doneAlpha, flash ? easeOut(Math.min(1, progress(flash) * 2)) : 1));
      figure.stars.forEach((star, s) => {
        const on = doneAlpha > 0 || s < lit, fading = fade && s < (fade.stars ?? 0);
        const ripple = live.find(anim => anim.kind === 'ripple' && anim.figure === index && anim.star === s);
        if (ripple) {
          const [x, y] = at(star), t = progress(ripple);
          for (let ring = 0; ring < 3; ring++) {
            const local = Math.max(0, Math.min(1, (t * ripple.length - ring * 120) / (ripple.length - 240))); if (local <= 0 || local >= 1) continue;
            ctx.strokeStyle = `rgba(${LINE},${0.5 * (1 - local)})`; ctx.lineWidth = 2.2 - 0.6 * ring;
            ctx.beginPath(); ctx.arc(x, y, 6 + easeOut(local) * 34, 0, Math.PI * 2); ctx.stroke();
          }
        }
        if (on) dot(star, 2.6, Math.max(0.85 * Math.max(doneAlpha, s < lit ? 1 : 0), 0.3), (ripple ? 1 - progress(ripple) : 0) + flashGlow * 0.8 + 0.25 * Math.max(doneAlpha, s < lit ? 1 : 0));
        else dot(star, fading ? 2.2 : 1.8, fading ? 0.3 + 0.5 * fadeAlpha : 0.32);
      });
    });
    return live.length > 0;
  };

  const loop = () => {
    cancelAnimationFrame(frame.current);
    const tick = (now: number) => { frame.current = draw(now) ? requestAnimationFrame(tick) : 0; };
    frame.current = requestAnimationFrame(tick);
  };

  useImperativeHandle(ref, () => ({
    play(effects) {
      if (qualityRef.current === 'low') { anims.current = []; return; }
      const now = performance.now();
      for (const effect of effects) {
        if (effect.kind === 'light' || effect.kind === 'complete') {
          if (effect.star > 0 && effect.kind === 'light') anims.current.push({ kind: 'comet', figure: effect.figure, star: effect.star, start: now, length: 260 });
          anims.current.push({ kind: 'ripple', figure: effect.figure, star: effect.star, start: now + (effect.star > 0 ? 200 : 0), length: 1400 });
          if (effect.kind === 'complete') anims.current.push({ kind: 'flash', figure: effect.figure, star: effect.star, start: now, length: 1600 });
        } else if (effect.kind === 'fade') anims.current.push({ kind: 'fade', figure: effect.figure, star: 0, stars: effect.stars, start: now, length: 2500 });
        else anims.current.push({ kind: 'reset', figure: -1, star: 0, start: now, length: 3000, completed: CONSTELLATIONS.map((_, index) => index) });
      }
      loop();
    },
  }), []);

  // Redraw the settled sky whenever the state, tier or size changes.
  useEffect(() => { if (!frame.current) draw(performance.now()); });
  useEffect(() => {
    const resize = () => { backdrop.current = null; if (!frame.current) draw(performance.now()); };
    window.addEventListener('resize', resize);
    return () => { window.removeEventListener('resize', resize); cancelAnimationFrame(frame.current); };
  }, []);

  return <canvas ref={canvas} className="musical-sky" data-constellation-sky="true" aria-hidden="true" />;
});
