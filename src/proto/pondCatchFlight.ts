import type { PondCatch } from './rules/fishing';

/** A fish that bit: where its face-down card lay, what it turned out to be. */
export type HookedFish = { rect: DOMRect; kind: PondCatch; rank: string };

const CAST_MS = 240;
const HOOK_MS = 220;
const REEL_MS = 560;
/** Several fish of one rank come up one after another. */
const STAGGER_MS = 140;
export const CATCH_FLIGHT_MS = CAST_MS + HOOK_MS + REEL_MS;

export const CATCH_GLYPH = (kind: PondCatch) => kind === 'glowfish' ? '🐠' : kind === 'kingfish' ? '🐡' : '🐟';

const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);

/**
 * The catch animation: a fishing line flies from the cast bait to each fish card
 * that bit, the fish surfaces on its card with a tug, then the line reels it in
 * along an arc into its pill in the catch tray, where it lands.
 *
 * Positions are captured before the cast changes the pond; the tray pill is
 * measured when the reel starts, after React has committed the new layout.
 */
export function reelInCatch(rod: DOMRect, hooked: HookedFish[], target: (kind: PondCatch) => HTMLElement | null, onLand: (kind: PondCatch) => void,
  { hooked: alreadyHooked = false }: { hooked?: boolean } = {}) {
  if (!hooked.length) return;
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'proto-pond-catch-lines');
  svg.setAttribute('aria-hidden', 'true');
  document.body.append(svg);
  const tip = { x: rod.left + rod.width / 2, y: rod.top + 2 };
  let running = hooked.length;
  // A fish already on the line (after a fight) skips the cast and comes straight up.
  const begin = performance.now() - (alreadyHooked ? CAST_MS : 0);

  hooked.forEach((fish, index) => {
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('class', 'proto-pond-catch-line');
    line.setAttribute('x1', String(tip.x));
    line.setAttribute('y1', String(tip.y));
    svg.append(line);
    const ghost = document.createElement('div');
    ghost.className = `proto-pond-catch-ghost proto-pond-catch-ghost--${fish.kind}`;
    ghost.dataset.catch = fish.kind;
    ghost.innerHTML = `<span class="proto-pond-catch-ghost__rank">${fish.rank}</span><span class="proto-pond-catch-ghost__glyph">${CATCH_GLYPH(fish.kind)}</span>`;
    ghost.style.cssText = `left:${fish.rect.left}px;top:${fish.rect.top}px;width:${fish.rect.width}px;height:${fish.rect.height}px;opacity:0;`;
    document.body.append(ghost);
    const from = { x: fish.rect.left + fish.rect.width / 2, y: fish.rect.top + fish.rect.height / 2 };
    const start = begin + index * STAGGER_MS;
    let to: { x: number; y: number; scale: number; el: HTMLElement | null } | null = null;
    const place = (x: number, y: number, scale: number, rotate: number) => {
      ghost.style.transform = `translate(${x - from.x}px, ${y - from.y}px) rotate(${rotate}deg) scale(${scale})`;
      line.setAttribute('x2', String(x));
      line.setAttribute('y2', String(y - fish.rect.height * scale * 0.42));
    };
    const frame = (now: number) => {
      const t = now - start;
      if (t < 0) { requestAnimationFrame(frame); return; }
      if (t < CAST_MS) {
        // The line flies out from the bait to the card that bit.
        const p = ease(t / CAST_MS);
        line.setAttribute('x2', String(tip.x + (from.x - tip.x) * p));
        line.setAttribute('y2', String(tip.y + (from.y - tip.y) * p));
      } else if (t < CAST_MS + HOOK_MS) {
        // Hooked: the fish surfaces on its card and tugs at the line.
        ghost.style.opacity = '1';
        const tug = Math.sin(((t - CAST_MS) / HOOK_MS) * Math.PI * 3);
        place(from.x, from.y - 4 * Math.abs(tug), 1, tug * 7);
      } else if (t < CATCH_FLIGHT_MS) {
        if (!to) {
          const el = target(fish.kind);
          const box = el?.getBoundingClientRect();
          to = box && box.width
            ? { x: box.left + box.width / 2, y: box.top + box.height / 2, scale: Math.max(0.2, box.height / fish.rect.height), el }
            : { x: from.x, y: window.innerHeight + fish.rect.height, scale: 0.4, el: null };
        }
        // Reeled in along an arc that rises above both ends.
        const p = ease((t - CAST_MS - HOOK_MS) / REEL_MS);
        const lift = Math.min(from.y, to.y) - Math.max(60, fish.rect.height * 0.8);
        const control = { x: (from.x + to.x) / 2, y: lift };
        const x = (1 - p) ** 2 * from.x + 2 * (1 - p) * p * control.x + p ** 2 * to.x;
        const y = (1 - p) ** 2 * from.y + 2 * (1 - p) * p * control.y + p ** 2 * to.y;
        place(x, y, 1 + (to.scale - 1) * p, (1 - p) * 10);
        line.style.opacity = String(Math.min(1, (1 - p) * 3));
      } else {
        ghost.remove();
        line.remove();
        to?.el?.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.3)' }, { transform: 'scale(1)' }], { duration: 260, easing: 'ease-out' });
        onLand(fish.kind);
        running -= 1;
        if (!running) svg.remove();
        return;
      }
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  });
}
