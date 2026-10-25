import { trackGameAnimation } from '../gameAnimations';
import { getCardTransportDurationMs } from './protoTransport';
import { solverFlightDuration } from './solverTiming';
import { presentQuestReceipt } from './questProgressReceipt';

/** Capture before the play removes its source, including the last arrival card. */
export function flyTravelCard(cardId: string, actorId: string, berry = false) {
  const source = Array.from(document.querySelectorAll<HTMLElement>('[data-travel-card]')).find(node => node.dataset.travelCard === cardId);
  const target = document.querySelector<HTMLElement>(`[data-map-actor-card="${actorId}"]`) ?? Array.from(document.querySelectorAll<HTMLElement>('[data-travel-foundation]')).find(node => node.dataset.travelFoundation === actorId);
  if (!source || !target) return;
  const from = source.getBoundingClientRect(), to = target.getBoundingClientRect();
  if (!from.width || !from.height || !to.width || !to.height) return;
  const ghost = source.cloneNode(true) as HTMLElement;
  if (berry) ghost.querySelector('img[alt="Manaberries"]')?.remove();
  const computed = getComputedStyle(source);
  // The portal leaves the tableau's sizing and lighting providers behind.
  for (const property of computed) {
    if (property.startsWith('--')) ghost.style.setProperty(property, computed.getPropertyValue(property));
  }
  Object.assign(ghost.style, { position: 'fixed', left: `${from.left}px`, top: `${from.top}px`, width: `${from.width}px`, height: `${from.height}px`, transform: 'none', margin: '0', pointerEvents: 'none', zIndex: '100000' });
  ghost.style.setProperty('--classic-card-w', `${from.width}px`);
  ghost.removeAttribute('data-travel-card');
  ghost.setAttribute('data-proto-card-flight', '');
  ghost.setAttribute('aria-hidden', 'true');
  if (ghost instanceof HTMLButtonElement) ghost.disabled = true;
  document.body.append(ghost);
  const dx = to.left + (to.width - from.width) / 2 - from.left;
  const dy = to.top + (to.height - from.height) / 2 - from.top;
  const duration = matchMedia('(prefers-reduced-motion: reduce)').matches ? 1 : solverFlightDuration(getCardTransportDurationMs(from, to));
  const cancelReceipt = actorId === 'hero' ? presentQuestReceipt(source, berry, duration) : () => {};
  const animation = trackGameAnimation(ghost.animate([
    { transform: 'translate(0,0)' },
    { transform: `translate(${dx}px,${dy}px)` },
  ], { duration, easing: 'ease-out' }));
  animation.onfinish = () => ghost.remove();
  animation.oncancel = () => { ghost.remove(); cancelReceipt(); };
}
