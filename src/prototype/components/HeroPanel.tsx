import type { HeroData, HeroState } from '../types';
import { abilitiesById, modifiersById } from '../engine/catalog';

interface HeroPanelProps {
  heroData: HeroData;
  hero: HeroState;
  wildCards: number;
  onUseAbility: (abilityId: string) => void;
  onPlayWild: () => void;
}

export function HeroPanel({ heroData, hero, wildCards, onUseAbility, onPlayWild }: HeroPanelProps) {
  return (
    <section className="proto-panel proto-hero" style={{ borderTopColor: heroData.color }}>
      <div className="proto-hero-header">
        <div>
          <p className="proto-kicker">Foundation</p>
          <h2>{heroData.name}</h2>
        </div>
        <div className="proto-combo-count">{hero.combo.length}</div>
      </div>
      <div className="proto-hero-bars">
        <span>HP {hero.hp}/{hero.maxHp}</span>
        <span>Block {hero.block}</span>
      </div>
      <div className="proto-foundation">
        {hero.combo.length === 0 ? (
          <span className="proto-empty">Build combo here</span>
        ) : (
          hero.combo.map((card) => {
            const modifier = card.modifierId ? modifiersById[card.modifierId] : null;
            return (
              <span key={card.id} className={card.isWild ? 'proto-mini-card wild' : 'proto-mini-card'}>
                {card.label}
                {modifier ? <i style={{ background: modifier.color }} /> : null}
              </span>
            );
          })
        )}
      </div>
      <div className="proto-ability-row">
        {heroData.abilityIds.map((abilityId) => {
          const ability = abilitiesById[abilityId];
          return (
            <button
              key={abilityId}
              type="button"
              className="proto-button"
              disabled={hero.combo.length === 0}
              onClick={() => onUseAbility(abilityId)}
              title={ability.description}
            >
              {ability.name}
            </button>
          );
        })}
        <button type="button" className="proto-button secondary" disabled={wildCards <= 0} onClick={onPlayWild}>
          Wild
        </button>
      </div>
    </section>
  );
}
