import { tutorialQuestArtwork } from '../questArtwork';
import { useLayoutEffect, useRef, useState } from 'react';
import { gameTime } from '../../gameTime';
import { trackGameAnimation } from '../../gameAnimations';
import { firstUnfinishedSubtask, questCardTransition, type SequentialQuest } from '../tutorialQuests';
import { QuestCard } from './QuestCard';
import './QuestSubtaskDeck.css';

/** Card transitions follow requirements; visual queues never gate gameplay. */
export function QuestSubtaskDeck({ quest }: { quest: SequentialQuest }) {
  const root = useRef<HTMLDivElement>(null);
  const desired = firstUnfinishedSubtask(quest);
  const [shown, setShown] = useState(() => desired);
  const [phase, setPhase] = useState<'idle' | 'check' | 'tap' | 'receive' | 'flip'>('idle');
  const [dockedStep, setDockedStep] = useState<string>();
  const departure = useRef<DOMRect | undefined>(undefined);
  const presentationFlight = useRef<Animation | undefined>(undefined);
  const pendingPickup = useRef<string | undefined>(undefined);
  const latest = useRef({ desired, awaitingDiscovery: quest.awaitingDiscovery });
  latest.current = { desired, awaitingDiscovery: quest.awaitingDiscovery };
  useLayoutEffect(() => {
    const queue = (event: Event) => {
      const id = (event as CustomEvent<string>).detail;
      pendingPickup.current = root.current?.dataset.stepId !== id || root.current?.dataset.phase === 'check' ? id : undefined;
    };
    window.addEventListener('proto-quest-pickup-queued', queue);
    return () => window.removeEventListener('proto-quest-pickup-queued', queue);
  }, []);
  // Keep the hidden discovery destination in its eventual jumbo layout so the
  // pickup lands on the real card, without an intermediate stop at the dock.
  const step = quest.steps[shown];
  const presented = Boolean(step && dockedStep !== step.id);
  useLayoutEffect(() => {
    const from = departure.current;
    departure.current = undefined;
    if (!from) return;
    const notifyDocked = () => { if (!presented && step) window.dispatchEvent(new CustomEvent('proto-quest-docked', { detail: step.id })); };
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) { notifyDocked(); return; }
    const element = root.current!;
    const card = element.querySelector<HTMLElement>('.quest-subtask-deck__active');
    if (!card) return;
    const to = card.getBoundingClientRect();
    if (!to.width || !to.height) return;
    const dx = from.left - to.left, dy = from.top - to.top;
    card.style.transformOrigin = 'top left';
    element.dataset.presentationFlight = 'true';
    const flight = trackGameAnimation(card.animate([
      { transform: `translate(${dx}px,${dy}px) scale(${from.width / to.width},${from.height / to.height}) perspective(900px) rotateY(0deg)` },
      { transform: `translate(${dx / 2}px,${dy / 2 - 36}px) scale(${(1 + from.width / to.width) / 2},${(1 + from.height / to.height) / 2}) perspective(900px) rotateY(180deg) rotateZ(-8deg)`, offset: .5 },
      { transform: 'translate(0,0) scale(1,1) perspective(900px) rotateY(360deg) rotateZ(0deg)' },
    ], { duration: 650, easing: 'ease-in-out' }));
    presentationFlight.current = flight;
    const clear = () => { presentationFlight.current = undefined; delete element.dataset.presentationFlight; card.style.removeProperty('transform-origin'); };
    flight.onfinish = () => { clear(); notifyDocked(); };
    flight.oncancel = clear;
    return () => { flight.onfinish = null; flight.oncancel = null; flight.cancel(); clear(); };
  }, [presented, shown]);
  const animating = phase !== 'idle';
  useLayoutEffect(() => {
    if (desired < shown) { setShown(desired); setPhase('idle'); }
    else if (desired === shown && phase === 'check') setPhase('idle');
    else if (desired > shown && phase === 'idle') setPhase('check');
  }, [desired, shown, phase]);
  useLayoutEffect(() => {
    if (!animating) return;
    const element = root.current!, reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const card = element.querySelector<HTMLElement>('.quest-subtask-deck__active');
    if (!card) return;
    let last = gameTime.now(), elapsed = 0, frame = 0, advanced = false;
    let copy: HTMLElement | undefined;
    const from = card.getBoundingClientRect();
    const cleanup = () => { copy?.remove(); card.style.visibility = ''; };
    const tick = () => {
      const now = gameTime.now(); elapsed += now - last; last = now;
      const sample = questCardTransition(elapsed, reduced);
      if (!advanced && (sample.phase === 'flip' || sample.phase === 'idle')) {
        cleanup();
        window.dispatchEvent(new CustomEvent('proto-actor-received', { detail: 'hero' }));
        advanced = true; setShown(index => index + 1);
        if (shown + 1 < latest.current.desired || latest.current.awaitingDiscovery || pendingPickup.current || shown + 1 >= quest.steps.length) {
          pendingPickup.current = undefined;
          element.dataset.phase = 'idle'; setPhase('idle'); return;
        }
        setPhase('flip');
      }
      element.dataset.phase = sample.phase;
      element.style.setProperty('--quest-check-progress', String(sample.check));
      element.style.setProperty('--quest-flip-angle', ((1 - sample.flip) * 180) + 'deg');
      if (!advanced && (sample.phase === 'tap' || sample.phase === 'receive')) {
        if (!copy) {
          copy = card.cloneNode(true) as HTMLElement;
          copy.inert = true; copy.setAttribute('aria-hidden', 'true');
          copy.classList.add('quest-completion-flight');
          copy.style.cssText = 'position:fixed;z-index:10000;pointer-events:none;margin:0;width:' + from.width + 'px;height:' + from.height + 'px;--quest-check-progress:1;';
          document.body.append(copy); card.style.visibility = 'hidden';
        }
        const target = document.querySelector<HTMLElement>('[data-map-actor-card="hero"] [data-actor-holocard="hero"]')?.getBoundingClientRect() ?? from;
        const t = sample.receive, e = t * t * (3 - 2 * t);
        copy.style.left = (from.left + (target.left + target.width / 2 - from.left - from.width / 2) * e) + 'px';
        copy.style.top = (from.top + (target.top + target.height / 2 - from.top - from.height / 2) * e - (reduced ? 0 : Math.sin(t * Math.PI) * 55)) + 'px';
        copy.style.transformOrigin = 'center';
        copy.style.transform = reduced ? 'none' : 'perspective(900px) rotateY(' + (sample.tap * 180) + 'deg) scale(' + (1 + (target.width / Math.max(1, from.width) - 1) * e) + ')';
        // Opacity would flatten the 3D faces and hide the printed back.
        copy.style.opacity = reduced ? String(1 - t * .85) : '1';
        copy.dataset.faceDown = String(reduced && sample.tap >= .5);
      }
      if (sample.phase === 'idle') { setPhase('idle'); return; }
      frame = gameTime.requestAnimationFrame(tick);
    };
    element.dataset.reduced = String(reduced);
    tick();
    return () => { gameTime.cancelAnimationFrame(frame); cleanup(); };
  }, [animating]);
  return <div ref={root} className="quest-subtask-deck" data-quest-id={quest.id} data-step-id={step?.id ?? 'complete'}
    data-map-jumbo={presented || undefined}
    data-awaiting-discovery={quest.awaitingDiscovery && shown === desired || undefined} data-phase={phase} data-remaining={Math.max(0, quest.steps.length - shown)} aria-label={`${quest.title} · Tutorial quest stack`}>
    {step ? <div className="quest-subtask-deck__active" data-subtask-card={step.id}>
      <div className="quest-subtask-deck__flip-back" aria-hidden="true" />
      <div className="quest-subtask-deck__face"><QuestCard authoringId={`tutorial:${quest.id}:${step.id}`} key={step.id} title={step.title} text={step.text} inspirationReward={0} complete={false} onRedeem={()=>{}}
        jumbo={presented} selected={presented} onSelect={() => {
          if (gameTime.isPaused() || phase !== 'idle' || presentationFlight.current) return;
          departure.current = root.current?.querySelector('.quest-subtask-deck__active')?.getBoundingClientRect();
          setDockedStep(presented ? step.id : undefined);
        }}
        statusLabel={phase !== 'idle' ? '✓ Step complete' : `Step ${shown + 1} of ${quest.steps.length}`}
        artwork={tutorialQuestArtwork(step.id)} /></div>
      <svg className="quest-completion-check" viewBox="0 0 100 100" aria-hidden="true"><path className="quest-completion-check__wash" pathLength="1" d="M18 51 Q28 62 38 74 Q57 44 84 22"/><path pathLength="1" d="M18 51 Q28 62 38 74 Q57 44 84 22"/><path className="quest-completion-check__bristle" pathLength="1" d="M16 53 L37 77 Q59 44 86 23"/></svg>
    </div> : <div className="quest-subtask-deck__done" role="status">✓ Before dark · complete</div>}

  </div>;
}
