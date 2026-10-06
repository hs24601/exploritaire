import React from 'react';
import { PlayingCard } from '../../golf/components/PlayingCard';
import { rankLabel, type Card } from '../protoState';

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
  style,
}: {
  card: Card;
  onClick?: () => void;
  cardRef?: (node: HTMLButtonElement | null) => void;
  transporting?: boolean;
  disabled?: boolean;
  active?: boolean;
  mobilityTarget?: boolean;
  muted?: boolean;
  selected?: boolean;
  footerLabel?: React.ReactNode;
  standardRankSize?: boolean;
  style?: React.CSSProperties;
}) => (
  <PlayingCard
    cardRef={cardRef}
    data-resource-node={card.resource}
    data-encounter={card.encounter}
    data-highlight={active || mobilityTarget ? 'true' : undefined}
    onClick={onClick}
    disabled={disabled}
    style={style}
    className={`${cardBaseClassName} ${transporting ? 'pointer-events-none opacity-0' : ''} ${
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
    <div className="flex min-w-0 items-start justify-between gap-1">
      <div className={`font-semibold leading-none ${standardRankSize ? 'text-[calc(var(--classic-card-w)*0.34)]' : muted ? 'text-[calc(var(--classic-card-w)*0.27)]' : 'text-[calc(var(--classic-card-w)*0.4)]'}`}>
        {rankLabel(card.rank)}
      </div>
      {footerLabel ? (
        <div className="-mt-0.5 shrink-0 font-sans text-[clamp(1rem,calc(var(--classic-card-w)*0.42),1.8rem)] leading-none drop-shadow-[0_0_5px_rgba(255,255,255,0.24)]">
          {footerLabel}
        </div>
      ) : null}
    </div>
  </PlayingCard>
);

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
