import { useId, useLayoutEffect, useRef, useState } from 'react';
import { enemyTarget, type BattleState } from '../rules/battle';
import { tutorialIntent } from '../rules/battleTutorials';
import { EnemyIntentBadge } from './BattleUnits';

type Arrow = { actorId: string; targetId: string; name: string; path: string; badgeX: number; badgeY: number; enemy?: boolean; badge?: boolean };

/** Persistent targeting routes follow live card bounds, including phone layouts. */
export function BattleTargetArrows({ battle }: { battle: BattleState }) {
  const ref = useRef<SVGSVGElement>(null);
  const markerId = useId().replace(/:/g, '');
  const [arrows, setArrows] = useState<Arrow[]>([]);
  const targets = battle.party.filter(actor => actor.hp > 0 && battle.foes.some(foe => foe.id === actor.targetId && foe.hp > 0))
    .map(actor => ({ actorId: actor.id, targetId: actor.targetId!, name: actor.name }));
  const victim=enemyTarget(battle);
  const enemies=battle.foes.filter(foe=>foe.hp>0).flatMap(foe=>{
    const known=!foe.intentHidden,skip=battle.tutorial && tutorialIntent(foe,victim?.name ?? null)?.skips;
    const ids=known && foe.indominable!==undefined?battle.party.filter(actor=>actor.hp>0).map(actor=>actor.id):
      known && !foe.disarmed && !skip && foe.gallows!==undefined && foe.gallows>0?battle.party.filter(actor=>actor.hp>0).map(actor=>actor.id):
      known && !foe.disarmed && !skip && foe.intent==='attack' && victim?[victim.id]:
      known && (foe.disarmed || foe.intent==='tableau' || foe.intent==='withdraw')?['tableau']:['none'];
    return ids.map((targetId,index)=>({actorId:foe.id,targetId,name:foe.name,enemy:true,badge:index===0}));
  });
  const targetKey = JSON.stringify([targets,enemies]);
  useLayoutEffect(() => {
    const board = ref.current?.parentElement;
    if (!board) return;
    const measure = () => {
      const bounds = board.getBoundingClientRect();
      const scale=board.offsetWidth ? bounds.width/board.offsetWidth : 1;
      const next:Arrow[] = targets.flatMap(({ actorId, targetId, name }, index) => {
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
      for(const route of enemies){
        const source=board.querySelector<HTMLElement>(`.battle-foe[data-battle-target="${route.actorId}"]`);
        const target=route.targetId==='tableau'?board.querySelector<HTMLElement>('.battle-field__rack'):
          board.querySelector<HTMLElement>(`[data-battle-actor="${route.targetId}"]`);
        if(!source)continue;
        const from=source.getBoundingClientRect(),to=target?.getBoundingClientRect();
        const x=(from.x-bounds.x+from.width/2)/scale,y=(from.bottom-bounds.y)/scale;
        const tx=to?(to.x-bounds.x+to.width/2)/scale:x,ty=to?(to.top-bounds.y)/scale:y+46;
        const progress=Math.min(1,28/Math.max(1,ty-y));
        const split=battle.sandboxScenario==='999';
        next.push({...route,path:split?`M ${x} ${y} L ${x} ${Math.min(y+52,ty)} L ${tx} ${ty}`:`M ${x} ${y} L ${tx} ${ty}`,badgeX:split?x:x+(tx-x)*progress,badgeY:y+28});
      }
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
  const color=(arrow:Arrow)=>arrow.enemy?'#d3b5ec':arrow.actorId==='mochi'?'#f8b6e2':'#92dfff';
  return <svg ref={ref} className="battle-target-arrows" role="group" aria-label="Combat targeting and enemy intents">
    <defs>{arrows.map(arrow => <marker key={arrow.actorId+'-'+arrow.targetId} id={`${markerId}-${arrow.actorId}-${arrow.targetId}`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
      <path d="M 0 0 L 10 5 L 0 10 z" fill={color(arrow)} />
    </marker>)}</defs>
    {arrows.map(arrow => <path key={arrow.actorId+'-'+arrow.targetId} data-source={arrow.actorId} data-target={arrow.targetId} data-enemy-route={arrow.enemy || undefined} d={arrow.path} aria-hidden="true"
      fill="none" stroke={color(arrow)} strokeWidth="2" strokeDasharray="7 5" markerEnd={`url(#${markerId}-${arrow.actorId}-${arrow.targetId})`} />)}
    {arrows.filter(arrow=>!arrow.enemy).map(arrow=><foreignObject key={`badge-${arrow.actorId}`} x={arrow.badgeX-34} y={arrow.badgeY-12} width="68" height="24" aria-hidden="true">
      <div className="battle-target-badge" data-actor={arrow.actorId}>← {arrow.name}</div>
    </foreignObject>)}
    {arrows.filter(arrow=>arrow.enemy && arrow.badge).map(arrow=>{
      const foe=battle.foes.find(unit=>unit.id===arrow.actorId)!;
      return <foreignObject key={`intent-${arrow.actorId}`} className="battle-target-intent" x={Math.max(0,arrow.badgeX-100)} y={arrow.badgeY-14} width="200" height="32">
        <EnemyIntentBadge route foe={foe} target={victim?.name ?? null} targetId={victim?.id} enemyTurn={battle.turn==='enemy'} tutorialIntent={battle.tutorial?tutorialIntent(foe,victim?.name ?? null):undefined}/>
      </foreignObject>;
    })}
  </svg>;
}
