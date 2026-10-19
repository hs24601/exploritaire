import { gameTime } from '../../gameTime';
import { useTableauDrag } from './useTableauDrag';
import { cardIsManaInfused } from '../manaInfusion';
import { ManaGlow } from './ManaGlow';
import { ManaberryBlob } from './ManaberryBlob';
import React, { useEffect, useState } from 'react';
import { PlayingCard } from '../../golf/components/PlayingCard';
import { rankLabel, type Card } from '../protoState';
import { REVEAL_SWEEP_MS, revealMask } from './Reveal';
import { useCardJumbo } from './CardJumbo';
import { cardResourceFace } from '../cardResourceFace';
import type { TableauCardBackground } from '../biomeCardArt';
import { BiomeCardBackground } from './BiomeCardBackground';
import { EventCard } from './EventCard';

/** Tableau faces match the foundation's standard playing-card proportions. */
const CARD_ASPECT = 88 / 63;

/** The silhouette veil over a buried card. It only exists while the card is
 * buried and while it sweeps away once the card reaches the front: a lit
 * (CSS-filtered) card stops masking it, so a card in play never keeps one. */
function CardVeil({ buried }: { buried: boolean }) {
  const [sweeping, setSweeping] = useState(false);
  const [wasBuried, setWasBuried] = useState(buried);
  if (wasBuried !== buried) { setWasBuried(buried); setSweeping(!buried); }
  const [revealed, setRevealed] = useState(!buried);
  useEffect(() => {
    if (buried) { setRevealed(false); return undefined; }
    // Draw the full veil a frame, then sweep it away and drop it.
    const frame = gameTime.requestAnimationFrame(() => setRevealed(true));
    const done = gameTime.setTimeout(() => setSweeping(false), REVEAL_SWEEP_MS + 50);
    return () => { gameTime.cancelAnimationFrame(frame); gameTime.clearTimeout(done); };
  }, [buried]);
  if (!buried && !sweeping) return null;
  return <span aria-hidden="true" className="proto-card-veil" style={revealMask(1, CARD_ASPECT, revealed ? 1 : 0, { invert: true, unit: 'var(--classic-card-w)' })} />;
}

export const cardBaseClassName = 'relative flex w-full min-w-0 flex-col justify-between overflow-hidden rounded-[calc(var(--classic-radius)*0.95)] border px-[calc(var(--classic-card-w)*0.14)] py-[calc(var(--classic-card-w)*0.12)] text-left transition';

export const ProtoCard = ({
  card,
  onClick,
  cardRef,
  transporting = false,
  disabled = false,
  active = false,
  mobilityTarget = false,
  muted = false,
  selected = false,
  footerLabel,
  standardRankSize = false,
  buried = false,
  lit = false,
  centerRank = false,
  concealValue = false,
  style,
  jumbo = false,
  allowJumbo = true,
  actionLabel = 'Play card',
  background,
  onDiscard,
  onDropActor,
}: {
  card: Card;
  onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void;
  cardRef?: (node: HTMLButtonElement | null) => void;
  transporting?: boolean;
  disabled?: boolean;
  active?: boolean;
  mobilityTarget?: boolean;
  muted?: boolean;
  selected?: boolean;
  footerLabel?: React.ReactNode;
  standardRankSize?: boolean;
  /** Under another card, out of play: the card and its resource go to the
   * shared silhouette (rank still readable, dimmed) and take no input; when
   * it reaches the front, colour sweeps back in behind a slanted edge. */
  buried?: boolean;
  /** Surface receives the shared scene lighting variables. */
  lit?: boolean;
  /** Front tableau card: the value sits large in the middle of the face and
   * the corner index steps aside (buried cards keep it for the peek row). */
  centerRank?: boolean;
  /** Tactical combat holds remove values from ink and accessible card names. */
  concealValue?: boolean;
  style?: React.CSSProperties;
  jumbo?: boolean;
  /** Tableau cards activate gameplay directly instead of opening inspection. */
  allowJumbo?: boolean;
  actionLabel?: string;
  /** Explicit appearance for flights outside the tableau's biome provider. */
  background?: TableauCardBackground;
  onDiscard?: () => void;
  onDropActor?: (target: HTMLElement) => void;
}) => {
  const viewer = useCardJumbo();
  const drag = useTableauDrag(!disabled && !buried ? onDropActor : undefined);
  if(card.event)return <EventCard card={card} disabled={disabled} buried={buried} style={style} cardRef={cardRef} onPlay={onClick?()=>onClick({} as React.MouseEvent<HTMLButtonElement>):undefined} onDiscard={onDiscard} actionLabel={actionLabel==='Play card'?'Play event':actionLabel} />;
  return (
  <PlayingCard
    {...drag}
    cardRef={cardRef}
    data-resource-node={card.inspirationResource ? 'inspiration' : card.resource}
    data-food-source={card.foodSource}
    data-mana-infused={cardIsManaInfused(card) || undefined}
    data-story-mana={card.id==='day02-woods-mana'&&!buried||undefined}
    data-encounter={card.encounter}
    data-highlight={active || mobilityTarget ? 'true' : undefined}
    aria-pressed={selected || undefined}
    data-buried={buried || undefined}
    data-value-concealed={concealValue || undefined}
    aria-label={concealValue ? 'Tableau card · value hidden during tactical pause' : undefined}
    onClick={event=>{
      if(jumbo)return;
      if(!viewer || !allowJumbo){if(!disabled)onClick?.(event);return;}
      const source=event.currentTarget;
      viewer.open({title: `${rankLabel(card.rank)}${cardResourceFace(card) ? ` · ${cardResourceFace(card)?.label}` : ''}`,
        ratio:56/74,content:<ProtoCard card={card} footerLabel={footerLabel} buried={buried} jumbo />,
        action: !disabled&&onClick ? ()=>onClick({...event,currentTarget:source,detail:0}) : undefined,actionLabel});
    }}
    disabled={(!viewer || !allowJumbo) && disabled}
    data-gameplay-disabled={disabled || undefined}
    aria-haspopup={!jumbo && allowJumbo ? 'dialog' : undefined}
    data-card-jumbo={jumbo || undefined}
    style={{...style, touchAction: onDropActor ? 'none' : style?.touchAction}}
    className={`${cardBaseClassName} ${lit ? 'proto-lit-surface ' : ''}${buried ? 'proto-card--buried ' : ''}${transporting ? 'pointer-events-none opacity-0' : ''} ${
      disabled
        ? selected
          ? 'cursor-default border-[#8ef2d4]/25 bg-[#07100f] text-white/42'
          : 'cursor-default border-white/10 bg-[#080b10] text-white/30'
        : mobilityTarget
          ? 'border-[#d9a8ff]/85 bg-[linear-gradient(180deg,#1b1028,#09070e)] text-white shadow-[0_0_28px_rgba(217,168,255,0.2)]'
        : active
          ? 'border-[#8ef2d4]/70 bg-[linear-gradient(180deg,#0c1c18,#060a0c)] text-white shadow-[0_0_28px_rgba(110,255,217,0.18)]'
          : muted
            ? 'cursor-default border-white/8 bg-[linear-gradient(180deg,#0e1014,#080a0e)] text-white/62'
            : 'border-white/12 bg-[linear-gradient(180deg,#14161b,#080a0e)] text-white/92 hover:-translate-y-0.5 hover:border-[#ffd166]/38'
    }`}
  >
    {!allowJumbo && <BiomeCardBackground background={background} cardId={card.id} buried={buried} />}
    {!buried && cardIsManaInfused(card) && <ManaGlow />}
    <CardVeil buried={buried} />
    <div className="proto-card-header flex min-w-0 items-start justify-between gap-1">
      <div aria-hidden={centerRank || undefined} className={`proto-card-rank ${centerRank ? 'invisible ' : ''}font-semibold leading-none ${standardRankSize ? 'text-[calc(var(--classic-card-w)*0.34)]' : muted ? 'text-[calc(var(--classic-card-w)*0.27)]' : 'text-[calc(var(--classic-card-w)*0.4)]'}`}>
        {concealValue ? null : rankLabel(card.rank)}
      </div>
      {footerLabel ? (
        <div className="proto-card-icon -mt-0.5 shrink-0 font-sans text-[clamp(1rem,calc(var(--classic-card-w)*0.42),1.8rem)] leading-none drop-shadow-[0_0_5px_rgba(255,255,255,0.24)]">
          {cardIsManaInfused(card) && <ManaberryBlob />}
          <span style={{ position: 'relative' }}>{footerLabel}</span>
        </div>
      ) : null}
    </div>
    {centerRank && !concealValue ? <span className="proto-card-center-rank">{rankLabel(card.rank)}</span> : null}
  </PlayingCard>
);
};

export const EmptySlot = ({ emphasis = 'soft' }: { emphasis?: 'soft' | 'strong' }) => (
  <div
    className={`aspect-[56/74] w-full rounded-[calc(var(--classic-radius)*0.95)] border ${
      emphasis === 'strong'
        ? 'border-dashed border-white/12 bg-black/16'
        : 'border-dashed border-white/6 bg-black/10'
    }`}
  />
);

export const PilePanel = ({
  label,
  accent,
  children,
  footer,
  action,
}: {
  label: string;
  accent: 'stock' | 'party';
  children: React.ReactNode;
  footer?: React.ReactNode;
  action?: React.ReactNode;
}) => (
  <section
    className={`flex min-h-0 flex-col rounded-[calc(var(--classic-radius)*1.45)] border p-[clamp(0.7rem,1.8vmin,1.05rem)] shadow-[0_24px_80px_rgba(0,0,0,0.24)] ${
      accent === 'party'
        ? 'border-[#f4c86c]/22 bg-[linear-gradient(180deg,rgba(15,18,22,0.98),rgba(7,8,10,0.98))]'
        : 'border-white/12 bg-[linear-gradient(180deg,rgba(18,20,25,0.96),rgba(6,8,12,0.94))]'
    }`}
  >
    <div className="mb-[clamp(0.45rem,1.2vmin,0.7rem)] text-center text-[clamp(0.62rem,1.5vmin,0.78rem)] uppercase tracking-[0.24em] text-white/48">
      {label}
    </div>
    <div className="flex min-h-0 flex-1 items-center justify-center rounded-[calc(var(--classic-radius)*1.1)] border border-white/10 bg-black/22 p-[clamp(0.55rem,1.6vmin,0.9rem)]">
      {children}
    </div>
    {footer ? <div className="mt-[clamp(0.55rem,1.4vmin,0.8rem)] flex justify-center">{footer}</div> : null}
    {action ? <div className="mt-[clamp(0.45rem,1.2vmin,0.7rem)]">{action}</div> : null}
  </section>
);
