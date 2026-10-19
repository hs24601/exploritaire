import { useLayoutEffect, useRef, useState } from 'react';
import { gameTime } from '../../gameTime';
import { firstUnfinishedSubtask, questCardTransition, type SequentialQuest } from '../tutorialQuests';
import { QuestCard } from './QuestCard';
import { createQuestCardBurn } from './questCardBurn';
import './QuestSubtaskDeck.css';

/** Card transitions follow requirements; visual queues never gate gameplay. */
export function QuestSubtaskDeck({ quest }: { quest: SequentialQuest }) {
  const root = useRef<HTMLDivElement>(null);
  const burnCanvas = useRef<HTMLCanvasElement>(null);
  const desired = firstUnfinishedSubtask(quest);
  const [shown, setShown] = useState(() => desired);
  const [phase, setPhase] = useState<'idle' | 'burn' | 'flip'>('idle');
  const animating = phase !== 'idle';
  useLayoutEffect(() => {
    if (desired < shown) { setShown(desired); setPhase('idle'); }
    else if (desired === shown && phase === 'burn') setPhase('idle');
    else if (desired > shown && phase === 'idle') setPhase('burn');
  }, [desired, shown, phase]);
  useLayoutEffect(() => {
    if (!animating) return;
    const element = root.current!, reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    let started = gameTime.now(), frame = 0, advanced = false, cancelled = false;
    let burn: Awaited<ReturnType<typeof createQuestCardBurn>> | undefined;
    const clearBurn = () => { burn?.dispose(); burn = undefined; delete element.dataset.burnReady; };
    const tick = () => {
      const sample = questCardTransition(gameTime.now() - started, reduced);
      if (!advanced && sample.phase !== 'burn') {
        clearBurn();
        advanced = true; setShown(index => index + 1);
        if (shown + 1 >= quest.steps.length) { element.dataset.phase = 'idle'; setPhase('idle'); return; }
        setPhase('flip');
      }
      element.dataset.phase = sample.phase;
      burn?.render(sample.burn);
      element.style.setProperty('--quest-burn-progress', String(sample.burn));
      element.style.setProperty('--quest-flip-angle', `${(1 - sample.flip) * 180}deg`);
      if (sample.phase === 'idle') { setPhase('idle'); return; }
      frame = gameTime.requestAnimationFrame(tick);
    };
    element.dataset.reduced = String(reduced);
    element.style.setProperty('--quest-burn-progress', '0');
    const face = element.querySelector<HTMLElement>('.quest-subtask-deck__face');
    const begin = () => { if (!cancelled) { started = gameTime.now(); tick(); } };
    if (!reduced && face && burnCanvas.current) {
      createQuestCardBurn(face, burnCanvas.current).then(effect => {
        if (cancelled) { effect.dispose(); return; }
        burn = effect;
        burn.render(0);
        element.dataset.burnReady = 'true';
      }).catch(() => { /* Snapshot/WebGL unavailable: use the fade fallback. */ }).finally(begin);
    } else begin();
    return () => { cancelled = true; gameTime.cancelAnimationFrame(frame); clearBurn(); };
  }, [animating]);
  const step = quest.steps[shown];
  return <div ref={root} className="quest-subtask-deck" data-quest-id={quest.id} data-step-id={step?.id ?? 'complete'}
    data-awaiting-discovery={quest.awaitingDiscovery && shown === desired || undefined} data-phase={phase} data-remaining={Math.max(0, quest.steps.length - shown)} aria-label={`${quest.title} · Tutorial quest stack`}>
    {step ? <div className="quest-subtask-deck__active" data-subtask-card={step.id}>
      <div className="quest-subtask-deck__flip-back" aria-hidden="true" />
      <div className="quest-subtask-deck__face"><QuestCard key={step.id} title={step.title} text={step.text} inspirationReward={0} complete={false} onRedeem={()=>{}}
        statusLabel={phase === 'burn' ? '✓ Step complete' : `Step ${shown + 1} of ${quest.steps.length}`}
        artwork={{sprite:import.meta.env.BASE_URL+'assets/runtime/ui/quests/hero-snuffling-berries-v1.png',paintedSprite:import.meta.env.BASE_URL+'assets/runtime/ui/quests/hero-snuffling-berries-paint-bobtail-v2.png'}} /></div>
    </div> : <div className="quest-subtask-deck__done" role="status">✓ Before dark · complete</div>}
    <canvas key={shown} ref={burnCanvas} className="quest-subtask-deck__burn" data-html2canvas-ignore="true" aria-hidden="true" />
  </div>;
}
