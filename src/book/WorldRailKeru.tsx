import type {BattleState} from '../proto/rules/battle';
import {INVOKE_KERU,INVOKE_BUFFS,RARITY_NAMES,KERU_CASTS,rarityBuffText,castText,farewellText} from '../proto/rules/keruInvokeData';
import {invokeKeru,invokeReason,invokeCost,feedKeru,feedReason,feedToNextTier,feedNeeded,keruFed,keruTier,keruCooldown,harnessOrder,dismissKeru,dismissReason,castKeru,castTargets,castReason,upkeepPlan} from '../proto/rules/keruInvoke';

/** Compact controls on the world rail; all costs, targets and effects belong
 * to the same 100-series rule functions used by combatsbx. */
export function WorldRailKeru({state,paused,onChange}:{state:BattleState;paused:boolean;onChange:(action:(latest:BattleState)=>BattleState)=>void}){
 const mounted=harnessOrder(state);
 return <section className="world-rail-keru" aria-label="Hero familiars">
  <p>Upkeep: {upkeepPlan(state).total} AP at turn end. Unpaid familiars leave; dismissed familiars retain their tier and value.</p>
  {INVOKE_KERU.map(id=>{const tier=keruTier(state,id),onHero=mounted.includes(id),cooldown=keruCooldown(state,id);
   return <details key={id}><summary>{INVOKE_BUFFS[id].name} · {RARITY_NAMES[tier]} · {rankLabel(state.keruInvoke!.values[id])}{onHero?' · on Hero':''}{cooldown?` · back in ${cooldown} turns`:''}</summary>
    <p>{rarityBuffText(id,tier,state.keruInvoke?.kit)}<br/>{keruFed(state,id)}/{feedNeeded(state,id)} AP fed toward next tier.</p>
    <div><button disabled={paused||!!invokeReason(state,id)} title={invokeReason(state,id)??'Swap this stored value with Hero’s foundation'} onClick={()=>onChange(s=>invokeKeru(s,id))}>Familiarize · {invokeCost(state,id)} AP</button>
     <button disabled={paused||!!feedReason(state,id)} onClick={()=>onChange(s=>feedKeru(s,id))}>Feed 1 AP</button>
     <button disabled={paused||!!feedReason(state,id)} onClick={()=>onChange(s=>feedToNextTier(s,id))}>Feed to next tier</button>
     <button disabled={paused||!!dismissReason(state,id)} title={farewellText(id,tier)} onClick={()=>onChange(s=>dismissKeru(s,id))}>Dismiss</button>
     {castTargets(state,id).map(target=><button key={target} disabled={paused||!!castReason(state,id,target)} title={castText(id,tier)} onClick={()=>onChange(s=>castKeru(s,id,target))}>{KERU_CASTS[id].name} → {target==='hero'?'Hero':state.foes.find(f=>f.id===target)?.name}</button>)}
    </div>
   </details>;
  })}
 </section>;
}
import {rankLabel} from '../proto/protoState';
