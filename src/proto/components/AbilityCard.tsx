import type { Attack } from '../rules/battleAbilities';
import { HERO_MOVES, MOCHI_MOVES } from '../rules/battleAbilities';
import { TradingCard } from './TradingCard';
import { ActorCardArt } from './DetailsCardViewer';
import { ACTOR_HOLO_ART } from './ActorHoloCard';
import './AbilityCard.css';
import { AbilityArtwork } from './AbilityArtwork';
/** Playable portrait card; its action artwork follows the live Paint/Pixel setting. */
export function AbilityCard({ attack, interaction = {}, ghost = false, unavailableReason }: {attack: Attack; interaction?: Record<string,unknown>; ghost?: boolean; unavailableReason?: string}) {
 const move = [...HERO_MOVES,...MOCHI_MOVES].find(m=>m.name===attack.form);
 return <button type="button" className="ability-card" data-ability-card={attack.form} disabled={ghost} aria-label={attack.name+' Ability Card: '+attack.charge+' AP. Click to inspect. '+(unavailableReason ?? 'Drag onto a highlighted actor. Friendly targets take damage.')} {...interaction}>
  <TradingCard id={'ability-'+attack.actorId+'-'+attack.form} title={attack.name} badge={attack.charge+' AP'} badgeLabel="Action point cost"
   art={<AbilityArtwork name={attack.form} fire={attack.element==='fire'} fallback={<ActorCardArt sprite={ACTOR_HOLO_ART[attack.actorId]} label={attack.actorId} />} />} description={move?.description}
   footer={unavailableReason ?? (attack.form==='Vice Grip' ? 'Hold: '+attack.effects.find(e=>e.kind==='grip')?.seconds.toFixed(2)+'s · drag to target' : attack.element==='fire'?'Cal: '+attack.damage+' damage + burn':'Click to inspect · drag to target')} />
 </button>;
}
