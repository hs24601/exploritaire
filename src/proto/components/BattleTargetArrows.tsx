import { useId, useLayoutEffect, useRef, useState } from 'react';
import type { BattleState } from '../rules/battle';

type Arrow = { actorId: string; targetId: string; name: string; path: string; badgeX: number; badgeY: number };

/** Persistent targeting routes follow live card bounds, including phone layouts. */
export function BattleTargetArrows({ battle }: { battle: BattleState }) {
  const ref = useRef<SVGSVGElement>(null);
  const markerId = useId().replace(/:/g, '');
  const [arrows, setArrows] = useState<Arrow[]>([]);
  const targets = battle.party.filter(actor => actor.hp > 0 && battle.foes.some(foe => foe.id === actor.targetId && foe.hp > 0))
    .map(actor => ({ actorId: actor.id, targetId: actor.targetId!, name: actor.name }));
  const targetKey = JSON.stringify(targets);
  useLayoutEffect(() => {
    const board = ref.current?.parentElement;
    if (!board) return;
    const measure = () => {
      const bounds = board.getBoundingClientRect();
      const scale=board.offsetWidth ? bounds.width/board.offsetWidth : 1;
      const next = targets.flatMap(({ actorId, targetId, name }, index) => {
        const source = board.querySelector<HTMLElement>(`[data-battle-actor="${actorId}"] .battle-field__actor-card`);
        const target = board.querySelector<HTMLElement>(`.battle-foe[data-battle-target="${targetId}"]`);
        if (!source || !target) return [];
        const from = source.getBoundingClientRect(), to = target.getBoundingClientRect();
        const left = index % 2 === 0;
        const x = (from.x - bounds.x + from.width / 2)/scale;
        const y = (from.y - bounds.y + from.height / 2)/scale;
        const tx = (to.x - bounds.x + (left ? 0 : to.width))/scale;
        const ty = (to.y - bounds.y + to.height * .6)/scale;
        // Use the outer lanes so arrows don't run through tableau values.
        const lane = left ? 8 : board.offsetWidth - 8;
        const path=`M ${x} ${y} C ${lane} ${y-28}, ${lane} ${ty+30}, ${tx} ${ty}`;
        const geometry=document.createElementNS('http://www.w3.org/2000/svg','path');
        geometry.setAttribute('d',path);
        const badge=geometry.getPointAtLength(Math.max(0,geometry.getTotalLength()-46));
        return [{ actorId, targetId, name, path, badgeX:badge.x, badgeY:badge.y }];
      });
      setArrows(previous => JSON.stringify(previous) === JSON.stringify(next) ? previous : next);
    };
    const resize = new ResizeObserver(measure);
    resize.observe(board);
    board.querySelectorAll('.battle-field__actor-card, .battle-foe, .battle-field__middle').forEach(node => resize.observe(node));
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    measure();
    return () => { resize.disconnect(); window.removeEventListener('resize', measure); window.removeEventListener('scroll', measure, true); };
  }, [targetKey]);
  return <svg ref={ref} className="battle-target-arrows" aria-hidden="true">
    <defs>{arrows.map(arrow => <marker key={arrow.actorId} id={`${markerId}-${arrow.actorId}`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
      <path d="M 0 0 L 10 5 L 0 10 z" fill={arrow.actorId === 'mochi' ? '#f8b6e2' : '#92dfff'} />
    </marker>)}</defs>
    {arrows.map(arrow => <path key={arrow.actorId} data-source={arrow.actorId} data-target={arrow.targetId} d={arrow.path}
      fill="none" stroke={arrow.actorId === 'mochi' ? '#f8b6e2' : '#92dfff'} strokeWidth="2" strokeDasharray="7 5" markerEnd={`url(#${markerId}-${arrow.actorId})`} />)}
    {arrows.map(arrow=><foreignObject key={`badge-${arrow.actorId}`} x={arrow.badgeX-34} y={arrow.badgeY-12} width="68" height="24">
      <div className="battle-target-badge" data-actor={arrow.actorId}>← {arrow.name}</div>
    </foreignObject>)}
  </svg>;
}
