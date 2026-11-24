import { trackGameAnimation } from '../../gameAnimations';

/** Focus Fire: matching tableau cards flare and burn away (ghost copies, so the real cards update at once). */
export function burnCardsFx(cards: HTMLElement[]) {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  for (const card of cards) {
    const rect = card.getBoundingClientRect(), ghost = card.cloneNode(true) as HTMLElement;
    ghost.inert = true; ghost.setAttribute('aria-hidden', 'true');
    ghost.style.cssText = `position:fixed;left:${rect.x}px;top:${rect.y}px;width:${rect.width}px;height:${rect.height}px;--classic-card-w:${rect.width}px;pointer-events:none;z-index:65000;`;
    document.body.append(ghost);
    const animation = trackGameAnimation(ghost.animate(reduced ? [{ opacity: 1 }, { opacity: 0 }] : [
      { opacity: 1, filter: 'none', transform: 'none' },
      { opacity: 1, filter: 'sepia(1) saturate(4) hue-rotate(-20deg) brightness(1.6) drop-shadow(0 0 10px #ff8a2a)', transform: 'scale(1.06)', offset: 0.35 },
      { opacity: 0, filter: 'sepia(1) saturate(5) hue-rotate(-30deg) brightness(.4) blur(2px)', transform: 'translateY(-26px) scale(.9)' },
    ], { duration: reduced ? 120 : 620, easing: 'ease-in' }));
    animation.onfinish = animation.oncancel = () => ghost.remove();
  }
}
