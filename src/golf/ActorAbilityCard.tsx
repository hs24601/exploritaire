import React from 'react';
import { AbilityApBar } from '../components/combat/AbilityApBar';
import { Tooltip } from '../components/Tooltip';
import { RarityAura } from '../components/RarityAura';
import type { ResolvedMegaHandAbilityCard } from './megahandAbilityData';

const getAbilityBackdrop = (ownerName: string, enemy: boolean) => {
  if (enemy) {
    return {
      ring: 'rgba(255, 130, 130, 0.7)',
      glow: '0 0 26px rgba(255, 98, 98, 0.24), 0 0 12px rgba(255, 122, 122, 0.16)',
      background: 'radial-gradient(circle at 50% 16%, rgba(255,120,120,0.18), rgba(34,14,18,0.08) 36%, rgba(4,6,10,0) 78%)',
      badge: 'linear-gradient(180deg, rgba(255,156,132,0.98), rgba(201,72,56,0.98))',
    };
  }
  if (ownerName === 'Hero') {
    return {
      ring: 'rgba(255,162,210,0.72)',
      glow: '0 0 28px rgba(255,126,198,0.3), 0 0 12px rgba(255,126,198,0.18)',
      background: 'radial-gradient(circle at 50% 16%, rgba(255,176,222,0.2), rgba(34,12,24,0.08) 36%, rgba(4,6,10,0) 78%)',
      badge: 'linear-gradient(180deg, rgba(255,194,229,0.98), rgba(226,84,164,0.98))',
    };
  }
  if (ownerName === 'Mochi') {
    return {
      ring: 'rgba(190,154,255,0.68)',
      glow: '0 0 28px rgba(176,124,255,0.28), 0 0 12px rgba(176,124,255,0.18)',
      background: 'radial-gradient(circle at 50% 16%, rgba(198,170,255,0.2), rgba(22,12,36,0.08) 36%, rgba(4,6,10,0) 78%)',
      badge: 'linear-gradient(180deg, rgba(212,190,255,0.98), rgba(126,86,214,0.98))',
    };
  }
  if (ownerName === 'Banks') {
    return {
      ring: 'rgba(255,214,143,0.62)',
      glow: '0 0 28px rgba(255,204,106,0.22), 0 0 12px rgba(255,204,106,0.16)',
      background: 'radial-gradient(circle at 50% 16%, rgba(255,220,152,0.18), rgba(36,24,12,0.08) 36%, rgba(4,6,10,0) 78%)',
      badge: 'linear-gradient(180deg, rgba(255,222,154,0.98), rgba(214,150,44,0.98))',
    };
  }
  if (ownerName === 'Jet') {
    return {
      ring: 'rgba(144,206,255,0.6)',
      glow: '0 0 28px rgba(118,196,255,0.24), 0 0 12px rgba(118,196,255,0.16)',
      background: 'radial-gradient(circle at 50% 16%, rgba(140,210,255,0.18), rgba(10,22,36,0.08) 36%, rgba(4,6,10,0) 78%)',
      badge: 'linear-gradient(180deg, rgba(178,228,255,0.98), rgba(64,124,214,0.98))',
    };
  }
  return {
    ring: 'rgba(205,182,255,0.56)',
    glow: '0 0 24px rgba(182,140,255,0.18), 0 0 12px rgba(182,140,255,0.14)',
    background: 'radial-gradient(circle at 50% 16%, rgba(218,198,255,0.16), rgba(24,16,34,0.08) 36%, rgba(4,6,10,0) 78%)',
    badge: 'linear-gradient(180deg, rgba(224,204,255,0.98), rgba(126,86,214,0.98))',
  };
};

export function ActorAbilityCard({
  abilityCard,
  onClick,
  onPointerDown,
  buttonRef,
  highlighted = false,
  dimmed = false,
  enemy = false,
  mobile = false,
  showPower = false,
  showEnergyCost = true,
  showOwnerName = true,
  showGolfValue = true,
  width,
  height,
}: {
  abilityCard: ResolvedMegaHandAbilityCard;
  onClick?: () => void;
  onPointerDown?: (event: React.PointerEvent<HTMLButtonElement>) => void;
  buttonRef?: React.Ref<HTMLButtonElement>;
  highlighted?: boolean;
  dimmed?: boolean;
  enemy?: boolean;
  mobile?: boolean;
  showPower?: boolean;
  showEnergyCost?: boolean;
  showOwnerName?: boolean;
  showGolfValue?: boolean;
  width?: number;
  height?: number;
}) {
  const baseWidth = mobile ? 88 : 118;
  const baseHeight = mobile ? 136 : 182;
  const resolvedWidth = width ?? baseWidth;
  const resolvedHeight = height ?? Math.round((baseHeight / baseWidth) * resolvedWidth);
  const outerRadius = Math.max(14, Math.round(resolvedWidth * 0.14));
  const paddingX = Math.max(8, Math.round(resolvedWidth * 0.1));
  const paddingTop = Math.max(9, Math.round(resolvedHeight * 0.08));
  const paddingBottom = Math.max(8, Math.round(resolvedHeight * 0.07));
  const ownerFontSize = Math.max(8, Math.min(11, resolvedWidth * 0.08));
  const abilityFontSize = Math.max(12, Math.min(18, resolvedWidth * 0.14));
  const descriptionFontSize = Math.max(7, Math.min(10, resolvedWidth * 0.08));
  const golfFontSize = Math.max(30, Math.min(48, resolvedWidth * 0.4));
  const chipFontSize = Math.max(7, Math.min(10, resolvedWidth * 0.085));
  const microFontSize = Math.max(7, Math.min(9, resolvedWidth * 0.072));
  const dimmedStyles = dimmed && !highlighted ? { filter: 'saturate(0.58) brightness(0.74)', opacity: 0.74 } : {};
  const palette = getAbilityBackdrop(abilityCard.ownerName, enemy);
  const displayGolfLabel = showGolfValue ? abilityCard.liveGolfLabel : '';
  const showPrintedGolfReference = abilityCard.liveGolfLabel !== abilityCard.printedGolfLabel;
  const rulesText = abilityCard.abilityDescription ?? abilityCard.description;
  const flavorText = abilityCard.flavorText?.trim();
  const effectiveShowPower = showPower && abilityCard.kinhandKind !== 'orim-card';
  const effectiveShowGolfValue = showGolfValue && abilityCard.kinhandKind !== 'orim-card';
  const tooltipContent = (
    <div className="max-w-[280px] rounded-[14px] border border-white/12 bg-[linear-gradient(180deg,rgba(15,20,26,0.98),rgba(8,10,14,0.98))] px-3 py-3 text-left text-white shadow-[0_16px_40px_rgba(0,0,0,0.42)]">
      <div className="text-[10px] font-black uppercase tracking-[0.16em] text-white/58">
        {abilityCard.ownerName}{abilityCard.currentRarity ? ` · ${abilityCard.currentRarity}` : ''}
      </div>
      <div className="mt-1 text-sm font-black text-white">{abilityCard.name}</div>
      {flavorText ? (
        <div className="mt-2 text-[11px] italic leading-snug text-white/54">{flavorText}</div>
      ) : null}
      <div className="mt-2 text-xs leading-snug text-white/78">{rulesText}</div>
      <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] text-white/70">
        {effectiveShowGolfValue ? <div>Golf {abilityCard.liveGolfLabel}</div> : <div>Orim</div>}
        {effectiveShowGolfValue ? <div>Base {abilityCard.printedGolfLabel}</div> : <div>{abilityCard.currentRarity}</div>}
        <div>Energy {abilityCard.currentEnergyCost}</div>
        <div>AP {abilityCard.currentAp}/{abilityCard.maxAp}</div>
        {!effectiveShowPower ? <div>Ability</div> : <div>Power {abilityCard.power}</div>}
        <div>{abilityCard.wildcard ? 'Wildcard' : 'Standard'}</div>
      </div>
    </div>
  );

  const button = (
    <div className="relative" style={{ width: resolvedWidth, height: resolvedHeight }}>
      {abilityCard.currentRarity !== 'common' ? (
        <RarityAura
          rarity={abilityCard.currentRarity}
          cardWidth={resolvedWidth}
          cardHeight={resolvedHeight}
          layer="behind"
          hyp={0}
        />
      ) : null}
      <button
        ref={buttonRef}
        type="button"
        onClick={onClick}
        onPointerDown={onPointerDown}
        className={`relative flex flex-col items-center gap-2 rounded-[16px] p-0 ${onClick ? 'cursor-pointer' : 'cursor-default'}`}
        aria-label={`${abilityCard.ownerName} ${abilityCard.name}`}
        aria-disabled={dimmed && !highlighted}
      >
        <div
          className={`relative flex flex-col overflow-visible border text-white transition ${
            highlighted
              ? 'bg-[linear-gradient(180deg,rgba(18,48,40,0.96),rgba(7,12,16,0.98))]'
              : enemy
                ? 'bg-[linear-gradient(180deg,rgba(42,20,24,0.98),rgba(13,8,10,0.98))]'
                : 'bg-[linear-gradient(180deg,rgba(18,23,29,0.98),rgba(7,10,14,0.98))]'
          }`}
          style={{
            width: resolvedWidth,
            height: resolvedHeight,
            borderRadius: outerRadius,
            paddingLeft: paddingX,
            paddingRight: paddingX,
            paddingTop,
            paddingBottom,
            borderColor: highlighted ? 'rgba(142,242,212,0.82)' : palette.ring,
            boxShadow: palette.glow,
            ...dimmedStyles,
          }}
        >
          <div
            className="absolute inset-0 overflow-hidden"
            style={{
              borderRadius: outerRadius,
              background: palette.background,
            }}
          />
          {showEnergyCost ? (
            <div
              className="absolute -right-1 -top-2 flex items-center justify-center rounded-full border border-black/40 font-black uppercase tracking-[0.08em] text-[#091015] shadow-[0_10px_18px_rgba(0,0,0,0.28)]"
              style={{
                background: palette.badge,
                fontSize: microFontSize,
                transform: 'translateY(-2px)',
                width: Math.max(24, Math.round(resolvedWidth * 0.22)),
                height: Math.max(24, Math.round(resolvedWidth * 0.22)),
              }}
            >
              {abilityCard.currentEnergyCost}⚡
            </div>
          ) : null}

          <div className="relative min-w-0">
            {showOwnerName ? (
              <div
                className="truncate font-black uppercase tracking-[0.14em] text-white/86"
                style={{ fontSize: ownerFontSize, lineHeight: 1.05 }}
              >
                {abilityCard.ownerName}
              </div>
            ) : null}
            <div
              className={`${showOwnerName ? 'mt-1' : ''} truncate font-black leading-none text-white`}
              style={{ fontSize: abilityFontSize }}
            >
              {abilityCard.name}
            </div>
            <div
              className="mt-1 text-white/58"
              style={{
                fontSize: descriptionFontSize,
                lineHeight: 1.15,
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {rulesText}
            </div>
          </div>

          <div className="relative mt-2 flex flex-1 items-center justify-center">
            <div className="min-w-0 text-center">
              {effectiveShowGolfValue ? (
                <div
                  className="font-black leading-none text-white drop-shadow-[0_0_16px_rgba(255,255,255,0.12)]"
                  style={{ fontSize: golfFontSize }}
                >
                  {displayGolfLabel}
                </div>
              ) : (
                <div className="px-2 text-center text-[10px] font-semibold uppercase tracking-[0.14em] text-white/42">
                  Orim
                </div>
              )}
              {effectiveShowGolfValue && showPrintedGolfReference ? (
                <div className="mt-1 text-[8px] font-semibold uppercase tracking-[0.12em] text-white/36">
                  Base {abilityCard.printedGolfLabel}
                </div>
              ) : null}
            </div>
            {effectiveShowPower ? (
              <div className="absolute right-0 top-1/2 flex -translate-y-1/2 flex-col items-end gap-2">
                <div
                  className="rounded-full border border-white/12 bg-black/28 px-2.5 py-1 font-semibold uppercase tracking-[0.08em] text-white/84"
                  style={{ fontSize: chipFontSize }}
                >
                  Pow {abilityCard.power}
                </div>
              </div>
            ) : null}
          </div>

          <div className="relative mt-auto">
            <AbilityApBar
              ap={abilityCard.currentAp}
              maxAp={abilityCard.maxAp}
              barClassName="h-[8px] rounded-[4px]"
            />
          </div>
        </div>
      </button>
      {abilityCard.currentRarity !== 'common' ? (
        <RarityAura
          rarity={abilityCard.currentRarity}
          cardWidth={resolvedWidth}
          cardHeight={resolvedHeight}
          layer="front"
          hyp={0}
        />
      ) : null}
    </div>
  );

  return (
    <Tooltip content={tooltipContent} disabled={mobile} delayMs={350} hoverEnabled={!mobile} clickToPin={false}>
      {button}
    </Tooltip>
  );
}
