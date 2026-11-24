import { gameTime } from '../gameTime';
const activeReceipts = new Set<() => void>();
export const cancelQuestReceipts = () => { for (const cancel of [...activeReceipts]) cancel(); };

/** Called only after rules accept a receipt. Returns cleanup for restart/cancel. */
export function presentQuestReceipt(source: HTMLElement, berry: boolean, cardDuration: number) {
  const dock = document.querySelector<HTMLElement>('.quest-subtask-deck__active [data-quest-progress-dock]');
  if (!dock || !dock.getBoundingClientRect().width) return () => {};
  const fruit = source.querySelector('img[alt="Manaberries"]');
  const from = (fruit ?? source).getBoundingClientRect();
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let frame = 0, disposed = false, elapsed = 0, last = gameTime.now();
  const ghost = berry ? document.createElement('span') : undefined;
  if (ghost) {
    ghost.className = 'quest-berry-receipt'; ghost.setAttribute('aria-hidden', 'true');
    const image = document.createElement('img'); image.src = import.meta.env.BASE_URL + 'assets/runtime/items/manaberry/manaberry-fruit-v1.svg'; ghost.append(image);
    document.body.append(ghost);
  }
  window.dispatchEvent(new Event('proto-quest-receipt-start'));
  const finish = () => {
    if (disposed) return;
    disposed = true; gameTime.cancelAnimationFrame(frame); ghost?.remove();
    activeReceipts.delete(finish);
    window.dispatchEvent(new Event('proto-quest-receipt-end'));
  };
  activeReceipts.add(finish);
  const duration = berry ? reduced ? 180 : Math.max(cardDuration, 300) + 1050 : cardDuration;
  const tick = () => {
    if (!dock.isConnected) { finish(); return; }
    const now = gameTime.now();
    if (!document.querySelector('.travel-tableau[data-journey-paused="true"]')) elapsed += now - last;
    last = now;
    const t = Math.min(1, elapsed / duration);
    if (ghost) {
      const target = dock.getBoundingClientRect();
      const pop = Math.min(1, elapsed / 300), travel = Math.max(0, Math.min(1, (elapsed - 300) / Math.max(1, duration - 300)));
      const e = travel * travel * (3 - 2 * travel);
      const size = reduced ? 36 : 32 + Math.sin(pop * Math.PI / 2) * 36 - 38 * e;
      ghost.style.left = `${from.left + from.width / 2 + (target.left + target.width / 2 - from.left - from.width / 2) * e - size / 2}px`;
      ghost.style.top = `${from.top + from.height / 2 + (target.top + target.height / 2 - from.top - from.height / 2) * e - (reduced ? 0 : Math.sin(pop * Math.PI / 2) * 65 * (1 - e) + Math.sin(travel * Math.PI) * 100) - size / 2}px`;
      ghost.style.width = ghost.style.height = `${size}px`;
      ghost.style.transform = reduced ? 'none' : `rotate(${Math.sin(travel * Math.PI) * 45}deg)`;
      ghost.style.opacity = reduced ? String(1 - t) : '1';
    }
    if (t >= 1) finish(); else frame = gameTime.requestAnimationFrame(tick);
  };
  tick();
  return finish;
}
