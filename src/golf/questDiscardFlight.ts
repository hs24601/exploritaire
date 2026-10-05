import { PLAYING_CARD_RATIO } from './components/PlayingCardStack';

/** Capture the departing card now; measure its destination after the reward's layout commit. */
export function flyQuestToDiscard(source: HTMLElement | null) {
  if (!source) return;
  const from = source.getBoundingClientRect();
  if (!from.width || !from.height) return;
  const flight = document.createElement('div');
  flight.className = 'quest-discard-flight';
  flight.style.cssText = `position:fixed;left:${from.left}px;top:${from.top}px;width:${from.width}px;height:${from.width / PLAYING_CARD_RATIO}px;z-index:60000;pointer-events:none;transform-origin:0 0;perspective:900px;`;
  const flipper = document.createElement('div');
  flipper.className = 'quest-discard-flight__flipper';
  const front = source.cloneNode(true) as HTMLElement;
  front.classList.add('quest-discard-flight__front');
  const back = document.createElement('div');
  back.className = 'quest-card-back quest-discard-flight__back';
  back.textContent = '✓';
  flipper.append(front, back);
  flight.append(flipper);
  document.body.append(flight);

  // React applies redemption, removes its notice, and updates the discard count
  // before this frame. The icon's header row does not depend on quest contents.
  requestAnimationFrame(() => {
    const icon = document.querySelector<HTMLElement>('[data-quest-discard-icon]');
    const tray = icon?.closest('[data-open]');
    const target = icon?.getBoundingClientRect();
    const visible = tray?.getAttribute('data-open') === 'true' && target && target.width > 0 && target.left < window.innerWidth;
    const width = target?.width || 24;
    const destination = {
      x: visible ? target!.left : Math.max(window.innerWidth + 64, target?.left || 0),
      y: target?.height ? target.top : window.innerHeight * 0.3,
      width,
    };
    flight.dataset.destination = visible ? 'tray' : 'offscreen';
    const dx = destination.x - from.left, dy = destination.y - from.top;
    const scale = destination.width / from.width;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const flip = flipper.animate([{transform:'rotateY(0deg)'}, {transform:'rotateY(180deg)'}], {duration: reduced ? 1 : 260, fill:'forwards', easing:'ease-in-out'});
    const move = flight.animate([
      {transform:'translate(0,0) scale(1)'},
      {transform:`translate(${dx * 0.45}px,${dy * 0.45 - 60}px) scale(${(1 + scale) / 2})`, offset:0.5},
      {transform:`translate(${dx}px,${dy}px) scale(${scale})`},
    ], {duration: reduced ? 1 : 650, easing:'ease-in-out', fill:'forwards'});
    const cleanup = () => { flip.cancel(); flight.remove(); };
    move.onfinish = cleanup;
    move.oncancel = cleanup;
  });
}
