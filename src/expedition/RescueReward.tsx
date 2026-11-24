import { TradingCard } from '../proto/components/TradingCard';
import { MoteOrb } from '../proto/components/MoteOrb';
import { useCardJumbo } from '../proto/components/CardJumbo';
import type { LightMoteId } from '../proto/rules/lightMoteData';
import { ICE_RARITY_NAMES } from '../proto/rules/iceRewards';
import type { RarityTier } from '../proto/rules/keruInvokeData';

export function RescueReward({ title, description, mote, tier, onApply }: { title: string; description: string; mote?: LightMoteId; tier?: RarityTier; onApply: () => void }) {
  const jumbo = useCardJumbo();
  const face = (large = false) => <TradingCard id="rescue-loot" title={title} badge={tier === undefined ? '✦' : ICE_RARITY_NAMES[tier]} state={large ? 'jumbo' : 'compact'} interactive={false}
    art={mote ? <MoteOrb id={mote}/> : <span className="rescue-reward__glyph" aria-hidden="true">{title === 'Heart of the Phoenix' ? '🔥' : title === 'Demi' ? '❄' : title === 'Recovery' ? '♥' : '♧'}</span>} hideBody={!large}
    description={large ? description : undefined}/>;
  return <section className="rescue-reward" aria-label="Earned reward">
    <button type="button" className="rescue-reward__card" aria-label={`Inspect ${title}`} onClick={() => jumbo?.open({ title, content: face(true), action: onApply, actionLabel: 'Apply reward' })}>{face()}</button>
    <p>{description}</p><button type="button" className="rescue-reward__apply" onClick={onApply}>Apply reward</button>
  </section>;
}
