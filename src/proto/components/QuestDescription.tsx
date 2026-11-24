import { useLayoutEffect, useRef } from 'react';
import { gameTime } from '../../gameTime';
import { questTextUpdate } from '../questTextUpdate';
import './QuestDescription.css';

/** Shared conditional description: no reward or quest-completion state changes. */
export function QuestDescription({ text, identity }: { text: string; identity: string }) {
  const root = useRef<HTMLSpanElement>(null);
  const previous = useRef({ text, identity });
  useLayoutEffect(() => {
    const element = root.current!, card = element.closest<HTMLElement>('.quest-card')!;
    const words = element.querySelector<HTMLElement>('.quest-step__words')!;
    const oldMeasure = element.querySelector<HTMLElement>('.quest-step__old-measure')!;
    const before = previous.current; previous.current = { text, identity };
    let frame = 0;
    const reset = () => {
      words.textContent = text; oldMeasure.textContent = '';
      element.dataset.phase = 'idle'; card.dataset.questUpdate = 'idle';
      element.style.cssText = ''; card.style.removeProperty('--quest-holo-progress'); card.style.removeProperty('--quest-holo-opacity');
    };
    if (before.text === text || before.identity !== identity) { reset(); return; }
    const started = gameTime.now(), reduced = matchMedia('(prefers-reduced-motion: reduce)');
    oldMeasure.textContent = before.text;
    const tick = () => {
      const sample = questTextUpdate(gameTime.now() - started, Array.from(text).length, reduced.matches);
      if (sample.phase === 'idle') { reset(); return; }
      element.dataset.phase = sample.phase; card.dataset.questUpdate = sample.phase;
      words.textContent = sample.newText ? Array.from(text).slice(0, sample.characters).join('') : before.text;
      element.style.setProperty('--quest-step-weight', String(sample.newText ? 400 : sample.weight));
      element.style.setProperty('--quest-step-strike', `${sample.newText ? 0 : sample.strike * 100}%`);
      element.style.setProperty('--quest-step-opacity', String(sample.opacity));
      card.style.setProperty('--quest-holo-progress', `${sample.progress * 240 - 70}%`);
      card.style.setProperty('--quest-holo-opacity', String(sample.glow));
      frame = gameTime.requestAnimationFrame(tick);
    };
    tick();
    return () => { gameTime.cancelAnimationFrame(frame); reset(); };
  }, [text, identity]);
  return <span className="quest-card__text"><span className="quest-step" ref={root} aria-hidden="true">
    <span className="quest-step__measure">{text}</span><span className="quest-step__measure quest-step__old-measure" />
    <span className="quest-step__ink"><span className="quest-step__words">{text}</span></span>
  </span></span>;
}
