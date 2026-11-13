import {apCap,newActor,FOE_RANKS,staggerThreshold,type BattleState} from '../proto/rules/battle';
import {COMBAT_SANDBOX_SCENARIOS} from '../proto/rules/battleSandboxScenarios';
import {rankLabel} from '../proto/protoState';
export type WorldFoundationFace={id:string;name:string;hp:number;maxHp:number;rank:string;detail:string;charge?:number;cap?:number;status:string};
/** Waiting is a read-only roster preview: no deal, battle clock or enemy turn is created. */
export function worldFoundationFaces(state?:BattleState):{party:WorldFoundationFace;enemy:WorldFoundationFace;won:boolean}{
 const hero=state?.party.find(a=>a.id==='hero')??newActor('hero'),foe=state?.foes.find(f=>f.hp>0)??state?.foes[0];
 const opening=COMBAT_SANDBOX_SCENARIOS.find(s=>s.id==='001')!;
 return {party:{id:hero.id,name:hero.name,hp:hero.hp,maxHp:hero.maxHp,rank:rankLabel(hero.rank),detail:`AP ${hero.charge}/${apCap(hero)}`,charge:hero.charge,cap:apCap(hero),status:hero.hp<=0?'Down':hero.turnSpent?'Spent':'Ready'},
  enemy:foe?{id:foe.id,name:foe.name,hp:foe.hp,maxHp:foe.profile.maxHp,rank:rankLabel(foe.rank),detail:`Stagger ${foe.stagger.toFixed(1)}/${staggerThreshold(foe)}`,status:foe.hp<=0?'Defeated':foe.staggered>0?'Staggered':'Ready'}:
   {id:'khad-root',name:opening.name.replace(/^001: /,''),hp:opening.hp,maxHp:opening.hp,rank:rankLabel(FOE_RANKS[0]),detail:'Waiting',status:'Dormant'},won:state?.result==='won'};
}
