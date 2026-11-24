import React from 'react';
import { Tooltip } from '../components/Tooltip';
import { AbilityApBar } from '../components/combat/AbilityApBar';
import { getKinProfile, getStarterKinKit } from './data/starterKinData';
import type { MegaHandAbilityDefinition } from './megahandAbilityData';
import { getKinHandActorAbilityRanges, getKinHandActorRangesForAp, kinhandAbilityRangeHelpers } from './kinhandAbilityRanges';

type KinHandActorCardProps = {
  actorName: string;
  currentAp: number;
  apCap?: number;
  golfValue: string;
  actorAbilities?: MegaHandAbilityDefinition[] | null;
  highlighted?: boolean;
  dimmed?: boolean;
  enemy?: boolean;
  mobile?: boolean;
  width?: number;
  height?: number;
  currentHp?: number;
  maxHp?: number;
  armor?: number;
  spawnCount?: number;
  placementMode?: boolean;
  placementPrompt?: string;
  onApSegmentClick?: (apValue: number) => void;
  onGolfClick?: () => void;
  onSpawnClick?: () => void;
  onCardClick?: () => void;
  onPointerDown?: (event: React.PointerEvent<HTMLDivElement>) => void;
  buttonRef?: React.Ref<HTMLDivElement>;
};

const FAMILY_LABELS = {
  canid: 'Canid',
  felis: 'Felis',
  mustelid: 'Mustelid',
  corvid: 'Corvid',
  other: 'Other',
} as const;

function CompactActorVitals({
  hp,
  armor,
  accent,
}: {
  hp: number;
  armor: number;
  accent: string;
}) {
  const resolvedHp = Math.max(0, Math.floor(hp));
  const resolvedArmor = Math.max(0, Math.floor(armor));
  return (
    <div className="relative flex h-[42px] w-[42px] items-center justify-center">
      <div
        className="relative flex h-[42px] w-[42px] items-center justify-center"
        style={{ filter: `drop-shadow(0 10px 24px rgba(0,0,0,0.28)) drop-shadow(0 0 18px ${accent}26)` }}
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 32 32"
          className="absolute inset-0 h-full w-full"
        >
          <path
            d="M16 27.5c-5.2-3.08-10.4-7.53-10.4-13.48 0-3.26 2.38-5.77 5.42-5.77 1.96 0 3.81 0.95 4.98 2.61 1.17-1.66 3.02-2.61 4.98-2.61 3.04 0 5.42 2.51 5.42 5.77 0 5.95-5.2 10.4-10.4 13.48Z"
            fill="rgba(34,40,48,0.96)"
            stroke="rgba(255,196,210,0.42)"
            strokeWidth="1.35"
          />
        </svg>
        <span className="relative pt-[3px] text-[11px] font-black leading-none text-white">{resolvedHp}</span>
        {resolvedArmor > 0 ? (
          <div className="absolute -right-1.5 -top-1.5 flex h-[20px] w-[20px] items-center justify-center">
            <svg aria-hidden="true" viewBox="0 0 20 20" className="absolute inset-0 h-full w-full drop-shadow-[0_0_12px_rgba(80,190,255,0.3)]">
              <path
                d="M10 1.8 16.2 4v5.08c0 3.78-2.3 7.02-6.2 8.92-3.9-1.9-6.2-5.14-6.2-8.92V4L10 1.8Z"
                fill="rgba(22,92,156,0.98)"
                stroke="rgba(220,245,255,0.88)"
                strokeWidth="0.9"
              />
            </svg>
            <span className="relative pt-[1px] text-[9px] font-black leading-none text-white">{resolvedArmor}</span>
          </div>
        ) : null}
      </div>
    </div>
  );
}

const getActorBackdrop = (actorName: string, enemy: boolean) => {
  if (enemy) {
    return {
      ring: 'rgba(255, 130, 130, 0.7)',
      glow: '0 0 26px rgba(255, 98, 98, 0.24), 0 0 12px rgba(255, 122, 122, 0.16)',
      background: 'radial-gradient(circle at 50% 16%, rgba(255,120,120,0.18), rgba(34,14,18,0.08) 36%, rgba(4,6,10,0) 78%)',
      badge: 'linear-gradient(180deg, rgba(255,156,132,0.98), rgba(201,72,56,0.98))',
    };
  }
  if (actorName === 'Hero') {
    return {
      ring: 'rgba(255,162,210,0.72)',
      glow: '0 0 28px rgba(255,126,198,0.3), 0 0 12px rgba(255,126,198,0.18)',
      background: 'radial-gradient(circle at 50% 16%, rgba(255,176,222,0.2), rgba(34,12,24,0.08) 36%, rgba(4,6,10,0) 78%)',
      badge: 'linear-gradient(180deg, rgba(255,194,229,0.98), rgba(226,84,164,0.98))',
    };
  }
  if (actorName === 'Mochi') {
    return {
      ring: 'rgba(190,154,255,0.68)',
      glow: '0 0 28px rgba(176,124,255,0.28), 0 0 12px rgba(176,124,255,0.18)',
      background: 'radial-gradient(circle at 50% 16%, rgba(198,170,255,0.2), rgba(22,12,36,0.08) 36%, rgba(4,6,10,0) 78%)',
      badge: 'linear-gradient(180deg, rgba(212,190,255,0.98), rgba(126,86,214,0.98))',
    };
  }
  if (actorName === 'Banks') {
    return {
      ring: 'rgba(255,214,143,0.62)',
      glow: '0 0 28px rgba(255,204,106,0.22), 0 0 12px rgba(255,204,106,0.16)',
      background: 'radial-gradient(circle at 50% 16%, rgba(255,220,152,0.18), rgba(36,24,12,0.08) 36%, rgba(4,6,10,0) 78%)',
      badge: 'linear-gradient(180deg, rgba(255,222,154,0.98), rgba(214,150,44,0.98))',
    };
  }
  if (actorName === 'Jet') {
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

export function KinHandActorCard({
  actorName,
  currentAp,
  apCap = 5,
  golfValue,
  actorAbilities,
  highlighted = false,
  dimmed = false,
  enemy = false,
  mobile = false,
  width,
  height,
  currentHp = 10,
  maxHp = 10,
  armor = 0,
  spawnCount = 0,
  placementMode = false,
  placementPrompt,
  onApSegmentClick,
  onGolfClick,
  onSpawnClick,
  onCardClick,
  onPointerDown,
  buttonRef,
}: KinHandActorCardProps) {
  const resolvedCurrentAp = Math.max(0, Math.min(apCap, Math.floor(currentAp)));
  const kinKit = getStarterKinKit(actorName);
  const profile = getKinProfile(actorName);
  const activeRanges = getKinHandActorRangesForAp(actorName, resolvedCurrentAp > 0 ? resolvedCurrentAp : 1, actorAbilities);
  const abilityRanges = getKinHandActorAbilityRanges(actorName, actorAbilities);
  const palette = getActorBackdrop(actorName, enemy);
  const baseWidth = mobile ? 88 : 118;
  const baseHeight = mobile ? 136 : 182;
  const resolvedWidth = width ?? baseWidth;
  const resolvedHeight = height ?? Math.round((baseHeight / baseWidth) * resolvedWidth);
  const outerRadius = Math.max(14, Math.round(resolvedWidth * 0.14));
  const paddingX = Math.max(8, Math.round(resolvedWidth * 0.1));
  const paddingTop = Math.max(9, Math.round(resolvedHeight * 0.08));
  const paddingBottom = Math.max(8, Math.round(resolvedHeight * 0.07));
  const ownerFontSize = Math.max(8, Math.min(11, resolvedWidth * 0.08));
  const golfFontSize = Math.max(30, Math.min(48, resolvedWidth * 0.4));
  const cardBadgeWidth = Math.max(28, Math.round(resolvedWidth * 0.3));
  const cardBadgeHeight = Math.max(38, Math.round(cardBadgeWidth * 1.26));
  const dimmedStyles = dimmed && !highlighted ? { filter: 'saturate(0.58) brightness(0.74)', opacity: 0.74 } : {};
  const targetableCardSurface = !!onCardClick && !onGolfClick && !onSpawnClick;
  const tooltipContent = (
    <div className="max-w-[310px] rounded-[14px] border border-white/12 bg-[linear-gradient(180deg,rgba(15,20,26,0.98),rgba(8,10,14,0.98))] px-3 py-3 text-left text-white shadow-[0_16px_40px_rgba(0,0,0,0.42)]">
      <div className="text-[10px] font-black uppercase tracking-[0.16em] text-white/58">
        {actorName} · {FAMILY_LABELS[profile.family]}
      </div>
      <div className="mt-1 text-sm font-black text-white">{actorName}</div>
      <div className="mt-2 text-xs leading-snug text-white/78">
        {abilityRanges.length > 0
          ? `AP ranges authored for ${actorName}'s card kit.`
          : (kinKit?.signature.exploreDescription ?? 'No kin tooltip details authored yet.')}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] text-white/70">
        <div>Golf {golfValue}</div>
        <div>AP {resolvedCurrentAp}/{apCap}</div>
        <div>{activeRanges.length > 0 ? `${activeRanges.length} active` : 'No AP loaded'}</div>
      </div>
      {activeRanges.length > 1 ? (
        <div className="mt-2 text-[11px] leading-snug text-[#8ef2d4]">
          Triggers together: {activeRanges.map((range) => range.name).join(' + ')}
        </div>
      ) : null}
      <div className="mt-3">
        <div className="text-[10px] font-black uppercase tracking-[0.16em] text-white/48">AP Ranges</div>
        <div className="mt-2 flex flex-col gap-2">
          {abilityRanges.map((range) => (
            <div
              key={range.key}
              className="rounded-[10px] border border-white/10 bg-white/[0.03] px-2.5 py-2"
            >
              <div className="flex items-center gap-2 text-[11px] font-semibold text-white">
                <span
                  className="inline-block h-2.5 w-2.5 rounded-full"
                  style={{ background: range.litColor, boxShadow: `0 0 12px ${range.litColor}` }}
                />
                <span>{kinhandAbilityRangeHelpers.formatRangeLabel(range)}</span>
                <span className="text-white/45">·</span>
                <span>{range.name}</span>
              </div>
              <div className="mt-1 text-[11px] leading-snug text-white/68">{range.description}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <div
      ref={buttonRef}
      onPointerDown={onPointerDown}
      onClick={onCardClick}
      className={`relative flex flex-col items-center gap-2 rounded-[16px] p-0 ${onCardClick ? 'cursor-pointer' : ''}`}
      aria-label={actorName}
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

        <div className="absolute -right-4 -top-4 z-10">
          <CompactActorVitals hp={currentHp} armor={armor} accent={palette.ring} />
        </div>

        <div className="relative min-w-0 pr-1">
          <div
            className="font-black uppercase tracking-[0.14em] text-white/86"
            style={{ fontSize: ownerFontSize, lineHeight: 1.05 }}
          >
            {actorName}
          </div>
        </div>

        <div className="relative mt-1 flex w-full flex-col items-center justify-center gap-2">
          {targetableCardSurface ? (
            <div
              aria-label={`${actorName} golf value ${golfValue}`}
              className="min-w-0 rounded-[12px] px-3 py-1"
            >
              <div
                className="font-black leading-none text-white drop-shadow-[0_0_16px_rgba(255,255,255,0.12)]"
                style={{ fontSize: golfFontSize }}
              >
                {golfValue}
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onGolfClick?.();
              }}
              disabled={!onGolfClick}
              aria-label={`${actorName} golf value ${golfValue}`}
              className={`min-w-0 rounded-[12px] px-3 py-1 transition ${
                onGolfClick ? 'cursor-pointer hover:bg-white/[0.06]' : 'cursor-default'
              }`}
            >
              <div
                className="font-black leading-none text-white drop-shadow-[0_0_16px_rgba(255,255,255,0.12)]"
                style={{ fontSize: golfFontSize }}
              >
                {golfValue}
              </div>
            </button>
          )}
          <div className="flex w-full justify-center">
            <Tooltip content={tooltipContent} disabled={mobile || targetableCardSurface} delayMs={350} hoverEnabled={!mobile && !targetableCardSurface} clickToPin={false}>
              <div
                className="relative flex w-full justify-center"
                style={{ width: '100%', height: cardBadgeHeight + 10 }}
              >
                {targetableCardSurface ? (
                  <div
                    aria-label={`${spawnCount} cards can be spawned`}
                    className="absolute left-1/2 top-1/2"
                    style={{
                      width: cardBadgeWidth,
                      height: cardBadgeHeight,
                      transform: 'translate(-50%, -50%) rotate(20deg)',
                      transformOrigin: 'center center',
                    }}
                  >
                    <div
                      className="absolute inset-0 rounded-[10px] border border-white/14 bg-[linear-gradient(180deg,rgba(255,255,255,0.1),rgba(0,0,0,0.18))] shadow-[0_8px_18px_rgba(0,0,0,0.3)]"
                    />
                    <div className="absolute inset-[3px] rounded-[8px] border border-white/10 bg-[linear-gradient(180deg,rgba(18,23,29,0.96),rgba(7,10,14,0.98))]" />
                    <div
                      className="absolute right-[-8px] top-[-8px] flex h-5 min-w-5 items-center justify-center rounded-full border border-white/14 bg-black/80 px-1 text-[10px] font-black leading-none text-white"
                      style={{ transform: 'rotate(-20deg)' }}
                    >
                      {spawnCount}
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      onSpawnClick?.();
                    }}
                    disabled={!onSpawnClick}
                    aria-label={`${spawnCount} cards can be spawned`}
                    className={`absolute left-1/2 top-1/2 transition ${onSpawnClick ? 'cursor-pointer hover:scale-[1.03]' : 'cursor-default opacity-70'}`}
                    style={{
                      width: cardBadgeWidth,
                      height: cardBadgeHeight,
                      transform: 'translate(-50%, -50%) rotate(20deg)',
                      transformOrigin: 'center center',
                    }}
                  >
                    <div
                      className="absolute inset-0 rounded-[10px] border border-white/14 bg-[linear-gradient(180deg,rgba(255,255,255,0.1),rgba(0,0,0,0.18))] shadow-[0_8px_18px_rgba(0,0,0,0.3)]"
                    />
                    <div className="absolute inset-[3px] rounded-[8px] border border-white/10 bg-[linear-gradient(180deg,rgba(18,23,29,0.96),rgba(7,10,14,0.98))]" />
                    <div
                      className="absolute right-[-8px] top-[-8px] flex h-5 min-w-5 items-center justify-center rounded-full border border-white/14 bg-black/80 px-1 text-[10px] font-black leading-none text-white"
                      style={{ transform: 'rotate(-20deg)' }}
                    >
                      {spawnCount}
                    </div>
                  </button>
                )}
              </div>
            </Tooltip>
          </div>
        </div>

        <div className="relative mt-auto w-full">
          <div className="min-w-0 text-center">
            <div className="relative">
              <AbilityApBar
                ap={resolvedCurrentAp}
                maxAp={apCap}
                barClassName="h-[8px] rounded-[4px]"
                segmentRanges={abilityRanges}
              />
              {placementMode && onApSegmentClick ? (
                <div className="absolute inset-0 grid gap-[1px]" style={{ gridTemplateColumns: `repeat(${apCap}, minmax(0, 1fr))` }}>
                  {Array.from({ length: apCap }, (_, index) => {
                    const apValue = index + 1;
                    return (
                      <button
                        key={`actor-card-ap-segment-${actorName}-${apValue}`}
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          onApSegmentClick(apValue);
                        }}
                        className="h-full rounded-[2px] border border-transparent transition hover:border-[#8ef2d4]/75 hover:bg-[rgba(142,242,212,0.14)]"
                        aria-label={`Place on AP segment ${apValue}`}
                      />
                    );
                  })}
                </div>
              ) : null}
            </div>
            {placementMode && placementPrompt ? (
              <div className="mt-1 text-[9px] font-black uppercase tracking-[0.12em] text-[#8ef2d4]">
                {placementPrompt}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
