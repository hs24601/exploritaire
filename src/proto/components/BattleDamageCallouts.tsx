import { useCallback, useEffect, useRef, type RefObject } from 'react';
import type { BattleState } from '../rules/battle';
import { useCallouts } from '../hooks/useCallouts';
import { Callout } from './Callout';

/** React to resolved HP damage, including Thorns, at the receiving foundation. */
export function BattleDamageCallouts({ battle, fieldRef, paused }: {
  battle: BattleState; fieldRef: RefObject<HTMLElement | null>; paused: boolean;
}) {
  // One short reaction at a time keeps rapid alternating hits from covering each other.
  const {callouts,show,dismiss,clear}=useCallouts(1);
  const seen=useRef(0);
  const avoidActors=useCallback(()=>Array.from(fieldRef.current?.querySelectorAll<HTMLElement>(
    '.battle-field__actor-card, .battle-foe, .battle-field__status, .momentum-engine, .battle-field__column button:not([data-gameplay-disabled])') ?? []).map(node=>node.getBoundingClientRect()),[fieldRef]);
  useEffect(()=>{
    if(!battle.events.length || battle.result){seen.current=battle.events[battle.events.length-1]?.id ?? 0;clear();return;}
    const fresh=battle.events.filter(event=>event.id>seen.current);
    seen.current=battle.events[battle.events.length-1]?.id ?? 0;
    for(const event of fresh){
      if(!['hit','enemy-hit','dot'].includes(event.kind) || !(event.amount && event.amount>0))continue;
      const actor=battle.party.find(actor=>actor.id===event.targetId);
      if(!actor || (actor.id!=='hero' && actor.id!=='mochi' && actor.id!=='banks'))continue;
      const down=actor.hp<=0;
      show({speaker:actor.name,authoringId:`combat.damage.${actor.id}.${down?'down':event.label==='Thorns'?'thorns':'hurt'}`,
        emoji:{actor:actor.id,emotion:down?'sad':'upset'},tone:'warning',letterMs:0,durationMs:2200,
        text:down?'I’m down!':event.label==='Thorns'?'Ouch! Those thorns sting!':'Ouch!',
        anchor:()=>{
          const node=fieldRef.current?.querySelector<HTMLElement>(`[data-battle-actor="${actor.id}"]`);
          if(!node)return null;
          const box=node.getBoundingClientRect();
          return box.width && box.height ? {x:box.left+box.width/2,y:box.top} : null;
        }});
    }
  },[battle.events,battle.party,battle.result,fieldRef,show,clear]);
  // Roster changes may remove a speaker while its reaction is still alive.
  return <>{!battle.result && callouts.filter(entry=>battle.party.some(actor=>actor.name===entry.speaker)).map(entry=><Callout
    key={entry.id} {...entry} instanceKey={entry.id} placement="foundation" emojiOnly avoidActors={avoidActors} paused={paused}
    onDismiss={()=>dismiss(entry.id)} />)}</>;
}
