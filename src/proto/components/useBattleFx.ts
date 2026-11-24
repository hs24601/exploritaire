import { trackGameAnimation } from '../../gameAnimations';
import { gameTime } from '../../gameTime';
import { createCombatClock } from '../combatClock';
import { useEffect, useRef, useState, type RefObject } from 'react';
import { detectFxQuality } from '../atmosphere';
import type { BattleEvent } from '../rules/battle';
import { CUE_SECONDS, IMPACT_SECONDS, cuesFor, freshEvents, type BattleCue } from '../rules/battleCues';
import './BattleFx.css';

// Battle cues on the battle cards: the attacker's card lunges, jaws snap or claws
// rake over the target, the target flinches, beaten slimes burst into rising
// pixels. Held states (a slime gone, an actor down) are CSS on the cards' own
// data-state, so they hold whether or not an effect played. Visual only.

const IMPACT_MS = IMPACT_SECONDS * 1000;
const FANGS = '<svg viewBox="0 0 64 16" preserveAspectRatio="none" aria-hidden="true"><path d="M2 0h60v6H2z" fill="#1a0b10"/><path d="M4 1h56v4H4z" fill="#7a2434"/>'
  + [[6, 7], [14, 9], [22, 6], [30, 6], [38, 6], [46, 9], [54, 7]].map(([x, l]) => `<path d="M${x - (l > 8 ? 5 : 4)} 5h${(l > 8 ? 10 : 8)}l-${l > 8 ? 5 : 4} ${l}z" fill="#f4ead6" stroke="#1a0b10" stroke-width="1"/>`).join('')
  + '</svg>';

/** The element that stands for a unit: a slime's figure, or a party actor's foundation card. */
const unitNode = (root: HTMLElement, id: string) =>
  root.querySelector<HTMLElement>(`[data-battle-target="${id}"] .battle-foe__figure`)
  ?? root.querySelector<HTMLElement>(`[data-battle-slot="${id}"] .battle-field__actor-card`);

export function useBattleFx(root: RefObject<HTMLElement | null>, events: readonly BattleEvent[], paused = false, tactical = false) {
  const [finishedDefeat,setFinishedDefeat]=useState(0);
  const defeatBatch=useRef({generation:0,pending:new Set<number>(),latest:0});
  const seen = useRef(events[events.length - 1]?.id ?? 0);
  const layer = useRef<HTMLDivElement | null>(null);
  const timers = useRef(new Map<number, { due: number; run: () => void }>());
  const clock = useRef(createCombatClock(gameTime.now()));
  const nextTimer = useRef(0);
  const pauseState = useRef({ paused, tactical }); pauseState.current = { paused, tactical };
  const pausedAnimations = useRef(new Set<Animation>());
  const later = (ms: number, run: () => void) => {
    timers.current.set(++nextTimer.current, { due: clock.current.time + ms, run });
  };
  useEffect(() => {
    let frame = 0;
    const tick = () => {
      const { paused, tactical } = pauseState.current;
      const now = clock.current.sample(gameTime.now(), paused);
      document.querySelectorAll<HTMLElement>('.battle-card-flight').forEach(node => {
        node.toggleAttribute('data-tactical-paused', tactical); node.setAttribute('aria-hidden', 'true');
      });
      if (paused) {
        for (const animation of document.getAnimations()) {
          const node = animation.effect instanceof KeyframeEffect ? animation.effect.target : null;
          if (node instanceof Element && (root.current?.contains(node) || layer.current?.contains(node) || node.closest('.battle-card-flight'))
            && (animation.playState === 'running' || animation.pending)) {
            animation.pause(); pausedAnimations.current.add(animation);
          }
        }
      } else {
        pausedAnimations.current.forEach(animation => { if (animation.playState === 'paused') animation.play(); });
        pausedAnimations.current.clear();
        for (const [id, timer] of timers.current) if (timer.due <= now) { timers.current.delete(id); timer.run(); }
      }
      frame = gameTime.requestAnimationFrame(tick);
    };
    frame = gameTime.requestAnimationFrame(tick);
    return () => {
      gameTime.cancelAnimationFrame(frame); timers.current.clear();
      pausedAnimations.current.forEach(animation => { if (animation.playState === 'paused') animation.play(); });
      pausedAnimations.current.clear(); layer.current?.remove(); layer.current = null;
    };
  }, [root]);
  useEffect(() => {
    if(!events.length){seen.current=0;timers.current.clear();layer.current?.replaceChildren();defeatBatch.current={generation:defeatBatch.current.generation+1,pending:new Set(),latest:0};setFinishedDefeat(0);return;}
    const fresh = freshEvents(events, seen.current);
    if (!fresh.length) return;
    seen.current = fresh[fresh.length - 1]!.id;
    const host = root.current;
    if (!host) return;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) {setFinishedDefeat(current=>Math.max(current,...fresh.filter(event=>event.kind==='ko').map(event=>event.id)));return;} // No defeat motion to await.
    const low = detectFxQuality() === 'low';
    if (!layer.current) {
      layer.current = document.createElement('div');
      layer.current.className = 'battle-fx-layer';
      layer.current.setAttribute('aria-hidden', 'true');
      document.body.append(layer.current);
    }
    const fx = layer.current;
    const cues=cuesFor(fresh),batch=defeatBatch.current;
    for(const cue of cues)if(cue.kind==='defeat'){batch.pending.add(cue.id);batch.latest=Math.max(batch.latest,cue.id);}
    for (const cue of cues) later(cue.delay * 1000, () => play(cue, host, fx, low, later,()=>{
      if(defeatBatch.current!==batch)return;
      batch.pending.delete(cue.id);
      if(!batch.pending.size)setFinishedDefeat(batch.latest);
    }));
  }, [events, root]);
  return finishedDefeat;
}

/** A fixed-position effect element centred on `box`, removed when its animation ends. */
function spawn(fx: HTMLElement, box: DOMRect, className: string, size: number, html = '') {
  const node = document.createElement('div');
  node.className = className;
  node.innerHTML = html;
  Object.assign(node.style, { left: `${box.left + box.width / 2 - size / 2}px`, top: `${box.top + box.height / 2 - size / 2}px`, width: `${size}px`, height: `${size}px` });
  fx.append(node);
  return node;
}

function burst(fx: HTMLElement, box: DOMRect, count: number, colors: string[], spec: { distance: number; rise: number; duration: number; size?: number }) {
  const animations:Animation[]=[];
  for (let i = 0; i < count; i++) {
    const bit = spawn(fx, box, 'battle-fx-bit', spec.size ?? 5);
    bit.style.background = colors[i % colors.length];
    const a = Math.random() * Math.PI * 2, d = spec.distance * (.4 + Math.random() * .6);
    const dx = Math.cos(a) * d, dy = Math.sin(a) * d * .6 - spec.rise * (.5 + Math.random());
    const animation=trackGameAnimation(bit.animate([{ transform: 'translate(0,0) scale(1)', opacity: 1 }, { transform: `translate(${dx}px,${dy}px) scale(.4) rotate(${Math.round(Math.random() * 180)}deg)`, opacity: 0 }],
      { duration: spec.duration * (.7 + Math.random() * .6), easing: 'cubic-bezier(.2,.7,.4,1)', fill: 'forwards' }));
    animation.onfinish = () => bit.remove();animations.push(animation);
  }
  return animations;
}

export function enemyDefeatBurst(fx:HTMLElement,box:DOMRect,low=false) {
  const count=(n:number)=>Math.max(2,Math.round(n*(low ? .35 : 1)));
  return [...burst(fx,box,count(22),['#2a1748','#5d3a9b','#7df9ff','#ffffff'],{distance:22,rise:46,duration:1100,size:5}),
    ...burst(fx,box,count(10),['#7df9ff','#c5fff8'],{distance:54,rise:0,duration:620,size:4})];
}

function play(cue: BattleCue, host: HTMLElement, fx: HTMLElement, low: boolean, later: (ms: number, run: () => void) => void, onDefeatComplete:()=>void) {
  const target = unitNode(host, cue.targetId);
  if (!target) {if(cue.kind==='defeat')onDefeatComplete();return;}
  const box = target.getBoundingClientRect();
  const count = (n: number) => Math.max(2, Math.round(n * (low ? .35 : 1)));
  if (cue.kind === 'attack') {
    const attacker = cue.trap ? null : unitNode(host, cue.actorId);
    if (attacker && !attacker.closest('.battle-foundation--unified')) {
      // The attacker's card leans in toward its target and springs back.
      const from = attacker.getBoundingClientRect();
      const dx = box.left + box.width / 2 - (from.left + from.width / 2), dy = box.top + box.height / 2 - (from.top + from.height / 2);
      const reach = Math.min(1, 34 / Math.max(1, Math.hypot(dx, dy)));
      const hop = cue.motion === 'slam' ? -14 : 0;
      trackGameAnimation(attacker.animate([
        { transform: 'translate(0,0)' },
        { transform: `translate(${dx * reach}px,${dy * reach + hop}px) scale(1.08)`, offset: IMPACT_SECONDS / CUE_SECONDS.attack },
        { transform: `translate(${dx * reach * .8}px,${dy * reach * .8}px) scale(1.04)`, offset: (IMPACT_SECONDS + .08) / CUE_SECONDS.attack },
        { transform: 'translate(0,0)' },
      ], { duration: CUE_SECONDS.attack * 1000, easing: 'ease-out' }));
    }
    if (cue.motion === 'slam') {
      later(IMPACT_MS, () => burst(fx, box, count(10), ['#5d3a9b', '#2a1748', '#7df9ff'], { distance: 46, rise: 10, duration: 520, size: 6 }));
      return;
    }
    const size = Math.round(Math.max(box.width, 48) * ([1.3, 1.6, 2][cue.tier] ?? 1.6));
    const lead = cue.trap ? 120 : IMPACT_MS;
    if (cue.motion === 'bite') {
      const jaws = spawn(fx, box, 'battle-fx-jaws', size, `<span class="battle-fx-jaw" data-jaw="upper">${FANGS}</span><span class="battle-fx-jaw" data-jaw="lower">${FANGS}</span>`);
      if (cue.element) jaws.dataset.element = cue.element;
      const [upper, lower] = jaws.querySelectorAll<HTMLElement>('.battle-fx-jaw');
      const timing = { duration: lead + 260, easing: 'cubic-bezier(.5,0,.9,.4)', fill: 'forwards' as const };
      trackGameAnimation(upper.animate([{ transform: 'translateY(-70%)' }, { transform: 'translateY(-6%)', offset: lead / (lead + 260) }, { transform: 'translateY(-6%)' }], timing));
      trackGameAnimation(lower.animate([{ transform: 'translateY(70%) scaleY(-1)' }, { transform: 'translateY(6%) scaleY(-1)', offset: lead / (lead + 260) }, { transform: 'translateY(6%) scaleY(-1)' }], timing));
      trackGameAnimation(jaws.animate([{ opacity: 1 }, { opacity: 1, offset: .75 }, { opacity: 0 }], { duration: lead + 260, fill: 'forwards' })).onfinish = () => jaws.remove();
    } else {
      const claws = spawn(fx, box, 'battle-fx-claws', size, '<span></span><span></span><span></span>');
      claws.dataset.tier = String(cue.tier);
      if (cue.element) claws.dataset.element = cue.element;
      claws.querySelectorAll<HTMLElement>('span').forEach((streak, i) => trackGameAnimation(streak.animate(
        [{ transform: 'rotate(-50deg) scaleX(0)', opacity: 1 }, { transform: 'rotate(-50deg) scaleX(1)', opacity: 1, offset: .45 }, { transform: 'rotate(-50deg) scaleX(1)', opacity: 0 }],
        { duration: lead + 240, delay: i * 50, easing: 'ease-out', fill: 'both' })));
      later(lead + 400, () => claws.remove());
    }
    later(lead, () => burst(fx, box, count(8 + cue.tier * 6 + (cue.heavy ? 6 : 0)),
      cue.element === 'fire' ? ['#ffb347', '#ff6a2a', '#ffe08a'] : cue.motion === 'scratch' && cue.tier >= 2 ? ['#ff5a5a', '#ffffff', '#9b2532'] : ['#ffffff', '#ffe08a', '#cfd8ff'],
      { distance: 40 + cue.tier * 14, rise: 8, duration: 480 }));
  } else if (cue.kind === 'hurt') {
    // Flinch: knocked back with a hot flash, then settle.
    const away = target.closest('[data-battle-slot]') ? 1 : -1;
    const push = cue.light ? 0 : cue.heavy ? 10 : 6;
    trackGameAnimation(target.animate([
      { transform: 'translate(0,0)', filter: 'none' },
      { transform: `translate(${-push / 2}px,${away * push}px) rotate(${away * -4}deg)`, filter: cue.light ? 'brightness(1.4) sepia(.6)' : 'brightness(0) invert(1)', offset: .12 },
      { transform: `translate(${push / 2}px,${away * push * .6}px) rotate(${away * 3}deg)`, filter: cue.light ? 'brightness(1.2)' : 'brightness(1.4) sepia(1) saturate(5) hue-rotate(-30deg)', offset: .35 },
      { transform: 'translate(0,0)', filter: 'none' },
    ], { duration: CUE_SECONDS.hurt * 1000, easing: 'ease-out' }));
  } else if (cue.kind === 'defeat') {
    // The figure flashes white and evaporates in CSS; here, the pixels it leaves behind.
    const animations=enemyDefeatBurst(fx,box,low);
    animations.push(...(target.closest('.battle-foe')?.getAnimations({subtree:true}) ?? []).filter(animation=>
      animation instanceof CSSAnimation && ['battle-foe-gone','battle-evaporate'].includes(animation.animationName)));
    void Promise.allSettled(animations.map(animation=>animation.finished)).then(onDefeatComplete);
  } else if (cue.kind === 'down') {
    burst(fx, box, count(10), ['#8a7a62', '#5c5244', '#b9a98a'], { distance: 40, rise: 4, duration: 560, size: 6 });
  }

}
