import { useEffect, useMemo, useRef, useState } from 'react';
import type { DragEvent } from 'react';
import { motion } from 'framer-motion';
import { CardFrame } from '../components/card/CardFrame';
import { BurnEdgesEffect, DEFAULT_BURN_EDGES_CONFIG } from '../components/active/BurnEdgesEffect';
import { AbilityApBar } from '../components/combat/AbilityApBar';
import { AbilityCard, type AbilityTargetType } from '../components/combat/AbilityCard';
import { Callout } from '../components/Callout';
import { Tooltip } from '../components/Tooltip';

type BanksMode = 'neutral' | 'prowl';
type BanksInputMode = 'dnd' | 'pointer';
type CombatCardId = 'swipe' | 'prowl' | 'shadow-strike' | 'shred-armor';
type ForecastId = 'rabid-bite' | 'poison-mire';

type TableauCard = {
  id: string;
  cards: number[];
  usedCount: number;
};

type TurnScript = {
  turn: number;
  forecast: ForecastId;
  forecastText: string;
  objective: string;
  targetAp: number;
  layout: number[][];
  enemyPlan?: {
    tableauPulls: number[];
    ability: ForecastId;
  };
};

type CombatCardDef = {
  id: CombatCardId;
  name: string;
  targetType: AbilityTargetType;
  description: (context: { ap: number }) => string;
};

type SliceCalloutEntry = {
  id: number;
  text: string;
  subtitle?: string;
  anchor?: { x: number; y: number };
  centered?: boolean;
};

type DragAnimState = {
  kind: 'card';
  label: string;
  from: { x: number; y: number };
  to: { x: number; y: number };
  rotation: number;
  scale: number;
  width: number;
  height: number;
} | null;

type CursorAnimState = {
  from: { x: number; y: number };
  to: { x: number; y: number };
  clickAtMidpoint?: boolean;
} | null;

type DragPayload =
  | { kind: 'tableau'; columnId: string }
  | { kind: 'combat'; cardId: CombatCardId };

type ActorStatusChip = {
  key: string;
  label: string;
  tone: 'buff' | 'debuff';
  detail: string;
};

type LootReward = {
  id: string;
  name: string;
  type: 'kin';
};

const BANKS_MAX_HP = 10;
const BOSS_RAT_MAX_HP = 7;
const BOSS_RAT_MAX_ARMOR = 25;
const BANKS_CARD_BORDER_COLOR = 'rgba(255,255,255,0.96)';
const BANKS_CARD_BORDER_WIDTH = 3;
const SLICE_CARD_SIZE = { width: 160, height: 220 } as const;
const SLICE_TABLEAU_CARD_SIZE = { width: 104, height: 150 } as const;
const SLICE_MINI_CARD_SIZE = { width: 104, height: 150 } as const;
const SLICE_ABILITY_CARD_SIZE = SLICE_MINI_CARD_SIZE;
const SLICE_TRAY_CARD_SIZE = { width: 84, height: 120 } as const;
const CARD_BURN_DURATION_MS = 5000;
const DELAYED_CHILD_BURN_OFFSET_MS = Math.round(CARD_BURN_DURATION_MS * 0.8);
const BOSS_INCOMING_DURATION_MS = 5000;
const BOSS_RAT_LOOT: LootReward[] = [{ id: 'mochi', name: 'Mochi', type: 'kin' }];

const TURN_SCRIPTS: TurnScript[] = [
  {
    turn: 1,
    forecast: 'rabid-bite',
    forecastText: '5 nature damage + 25% chance to poison target',
    objective: 'Build exactly 2 AP and deal Swipe to defeat the Scout Rat.',
    targetAp: 2,
    layout: [[5, 10], [4, 2], [9], [12], [2], [8], [11]],
    enemyPlan: { tableauPulls: [5, 2, 0, 6, 3], ability: 'rabid-bite' },
  },
  {
    turn: 2,
    forecast: 'rabid-bite',
    forecastText: 'Rabid Bite: 12 damage + chance to poison target',
    objective: 'Build exactly 3 AP and enter Prowl before the bite resolves.',
    targetAp: 3,
    layout: [[5], [4], [3], [8], [9], [10], [11, 12]],
    enemyPlan: { tableauPulls: [3, 4, 5, 6, 6], ability: 'rabid-bite' },
  },
  {
    turn: 3,
    forecast: 'poison-mire',
    forecastText: 'Poison Mire: next attack gains 100% poison chance',
    objective: 'Build 8 AP and use Shred Armor to break Wood Splinter Armor to 0.',
    targetAp: 8,
    layout: [[5], [4], [3], [2], [1], [13], [12], [11], [10]],
    enemyPlan: { tableauPulls: [8], ability: 'poison-mire' },
  },
  {
    turn: 4,
    forecast: 'rabid-bite',
    forecastText: 'Rabid Bite + Poison Mire: lethal if Banks is still exposed',
    objective: 'Build 7 AP and use Shadow Strike to finish the Boss Rat.',
    targetAp: 7,
    layout: [[5], [4], [3], [2], [1], [13], [12], [11]],
    enemyPlan: { tableauPulls: [7], ability: 'poison-mire' },
  },
];

const COMBAT_CARDS: Record<CombatCardId, CombatCardDef> = {
  swipe: {
    id: 'swipe',
    name: 'Swipe',
    targetType: 'single',
    description: ({ ap }) => `Deal ${Math.max(0, ap)} physical damage.`,
  },
  prowl: {
    id: 'prowl',
    name: 'Prowl',
    targetType: 'single',
    description: () => 'Banks becomes untargetable and changes stance to Prowl.',
  },
  'shadow-strike': {
    id: 'shadow-strike',
    name: 'Shadow Strike',
    targetType: 'single',
    description: ({ ap }) => `Deal ${Math.max(0, ap)} damage and stay in Prowl.`,
  },
  'shred-armor': {
    id: 'shred-armor',
    name: 'Shred Armor',
    targetType: 'single',
    description: ({ ap }) => `Deal ${Math.max(0, ap * 3)} damage to armor only. No overflow to HP.`,
  },
};

const BANKS_CARD_ORDER: CombatCardId[] = ['swipe', 'prowl', 'shadow-strike', 'shred-armor'];

const getBanksCardCostLabel = (mode: BanksMode, cardId: CombatCardId) => {
  if (mode === 'prowl') {
    if (cardId === 'swipe') return '1-3 AP';
    if (cardId === 'shadow-strike') return '4-7 AP';
    if (cardId === 'shred-armor') return '8-10 AP';
    return 'Locked';
  }
  if (cardId === 'swipe') return '1-2 AP';
  if (cardId === 'prowl') return '3 AP';
  return 'Locked';
};

const FORECAST_CARDS: Record<ForecastId, { title: string; targetType: AbilityTargetType; description: string }> = {
  'rabid-bite': {
    title: 'Rabid Bite',
    targetType: 'single',
    description: '5 nature damage + 25% chance to poison target',
  },
  'poison-mire': {
    title: 'Poison Mire',
    targetType: 'single',
    description: 'Poison Mire: next attack gains 100% poison chance',
  },
};

const rankLabel = (rank: number) => {
  if (rank === 1) return 'A';
  if (rank === 11) return 'J';
  if (rank === 12) return 'Q';
  if (rank === 13) return 'K';
  return String(rank);
};

const canPlayOnPrime = (candidate: number, prime: number) =>
  candidate === prime + 1 || candidate === prime - 1 || (prime === 1 && candidate === 13) || (prime === 13 && candidate === 1);

const getCombatHand = (mode: BanksMode, ap: number): CombatCardDef[] => {
  if (mode === 'neutral') {
    return ap >= 1 && ap <= 2
      ? [COMBAT_CARDS.swipe]
      : ap === 3
        ? [COMBAT_CARDS.prowl]
        : [];
  }
  if (ap >= 1 && ap <= 3) return [COMBAT_CARDS.swipe];
  if (ap >= 4 && ap <= 7) return [COMBAT_CARDS['shadow-strike']];
  if (ap >= 8 && ap <= 10) return [COMBAT_CARDS['shred-armor']];
  return [];
};

function ForecastBadge({ forecast, detail }: { forecast: ForecastId; detail: string }) {
  const title = forecast === 'rabid-bite' ? 'RABID BITE' : 'POISON MIRE';
  return (
    <div className="rounded-[18px] border border-red-500/28 bg-[#170b0b]/92 px-4 py-3 shadow-[0_0_24px_rgba(255,72,72,0.14)]">
      <div className="text-[10px] font-black uppercase tracking-[0.22em] text-red-200/90">{title}</div>
      <div className="mt-1 text-sm font-semibold text-white/90">{detail}</div>
    </div>
  );
}

export function CombatVitalsBar({
  hp,
  hpMax,
  armor = 0,
  superArmor = 0,
  accent = '#f0f0f0',
}: {
  hp: number;
  hpMax: number;
  armor?: number;
  superArmor?: number;
  accent?: string;
}) {
  const clampedHpMax = Math.max(1, hpMax);
  const clampedHp = Math.max(0, Math.min(clampedHpMax, hp));
  const clampedArmor = Math.max(0, Math.min(clampedHpMax, armor));
  const healthRatio = clampedHp / clampedHpMax;
  const isCritical = healthRatio <= 0.2;
  const isWounded = !isCritical && healthRatio <= 0.5;
  const isFullHealth = clampedHp >= clampedHpMax;
  const hpLabel = `${Math.round(clampedHp)}/${Math.round(clampedHpMax)}${clampedArmor > 0 ? ` (${clampedArmor})` : ''}`;
  const hpFill = isFullHealth
    ? 'linear-gradient(180deg, rgba(96,255,150,0.98), rgba(30,166,78,0.94))'
    : isCritical
    ? 'linear-gradient(90deg, rgba(255,72,72,0.98), rgba(173,24,24,0.94))'
    : isWounded
      ? 'linear-gradient(90deg, rgba(255,188,76,0.96), rgba(190,110,16,0.92))'
      : 'linear-gradient(180deg, rgba(125,235,128,0.96), rgba(42,150,58,0.92))';
  const hpGlow = isFullHealth
    ? 'rgba(96,255,150,0.54)'
    : isCritical
    ? 'rgba(255,72,72,0.72)'
    : isWounded
      ? 'rgba(255,188,76,0.58)'
      : `${accent}66`;
  const armorWidthPercent = (clampedArmor / clampedHpMax) * 100;
  const hpWidthPercent = (clampedHp / clampedHpMax) * 100;
  const dividerPositions = Array.from({ length: Math.max(0, clampedHpMax - 1) }, (_, index) => ((index + 1) / clampedHpMax) * 100);

  return (
    <>
      {isCritical ? (
        <style>{`
          @keyframes banks-lowhp-breathe {
            0%, 100% {
              transform: scale(1);
              box-shadow: 0 0 12px rgba(255,72,72,0.32), inset 0 0 0 1px rgba(255,72,72,0.24);
              border-color: rgba(255,72,72,0.7);
            }
            50% {
              transform: scale(1.014);
              box-shadow: 0 0 18px rgba(255,72,72,0.46), 0 0 28px rgba(255,72,72,0.18), inset 0 0 0 1px rgba(255,118,118,0.34);
              border-color: rgba(255,120,120,0.84);
            }
          }
        `}</style>
      ) : null}
      <div
        className="relative h-[18px] w-full overflow-visible rounded-full border-[2px]"
        style={{
          borderColor: superArmor > 0 ? 'rgba(255,220,110,0.94)' : isCritical ? 'rgba(255,72,72,0.78)' : 'rgba(255,255,255,0.16)',
          backgroundColor: 'rgba(255,255,255,0.08)',
          boxShadow: superArmor > 0
            ? `0 0 12px ${accent}55, 0 0 18px rgba(255,220,110,0.52), inset 0 0 0 2px rgba(255,220,110,0.62)`
            : isCritical
              ? '0 0 14px rgba(255,72,72,0.36), inset 0 0 0 1px rgba(255,72,72,0.24)'
              : `0 0 8px ${accent}55`,
          animation: isCritical ? 'banks-lowhp-breathe 2.8s ease-in-out infinite' : undefined,
        }}
      >
        <div className="absolute inset-[2px] overflow-hidden rounded-full bg-[rgba(255,255,255,0.08)]">
          <div
            className="absolute inset-y-0 left-0 rounded-full"
            style={{
              width: `${hpWidthPercent}%`,
              background: hpFill,
              boxShadow: hpWidthPercent > 0 ? `0 0 8px ${hpGlow}` : undefined,
            }}
          />
          {dividerPositions.map((position, index) => (
            <div
              key={`hp-divider-${clampedHpMax}-${index}`}
              className="absolute top-0 bottom-0 w-px"
              style={{
                left: `calc(${position}% - 0.5px)`,
                background: 'rgba(5,8,12,0.9)',
                boxShadow: '1px 0 0 rgba(255,255,255,0.1)',
                zIndex: 2,
              }}
            />
          ))}
        </div>
        {clampedArmor > 0 ? (
          <div
            className="absolute rounded-full"
            style={{
              left: '2px',
              top: '4px',
              bottom: '4px',
              width: `calc(${armorWidthPercent}% - 4px)`,
              minWidth: '10px',
              background: 'linear-gradient(180deg, rgba(166,232,244,0.94), rgba(78,158,192,0.96))',
              boxShadow: '0 0 8px rgba(92,184,205,0.45), inset 0 0 0 1px rgba(210,248,255,0.36)',
              opacity: 0.96,
              zIndex: 2,
            }}
          />
        ) : null}
        <div
          className="absolute inset-0 flex items-center justify-center"
          style={{ zIndex: 3, pointerEvents: 'none' }}
        >
          <div
            className="rounded-full border px-2 text-[9px] font-black leading-[14px] tracking-[0.2px] text-white"
            style={{
              minWidth: 38,
              height: 14,
              textAlign: 'center',
              background: 'rgba(3,5,10,0.96)',
              borderColor: 'rgba(255,255,255,0.24)',
              boxShadow: '0 1px 0 rgba(255,255,255,0.05), 0 2px 10px rgba(0,0,0,0.72)',
              textShadow: '0 1px 2px rgba(0,0,0,0.85)',
            }}
          >
            {hpLabel}
          </div>
        </div>
      </div>
    </>
  );
}

function StatusTray({
  statuses,
  tone,
  width,
}: {
  statuses: ActorStatusChip[];
  tone: 'buff' | 'debuff';
  width: number;
}) {
  if (statuses.length === 0) return null;

  const borderTone = tone === 'buff' ? 'rgba(121,201,255,0.24)' : 'rgba(247,78,78,0.26)';
  const glowTone = tone === 'buff' ? 'rgba(121,201,255,0.08)' : 'rgba(247,78,78,0.08)';

  return (
    <div
      className="mt-2 rounded-[14px] border bg-black/38 px-2 py-2"
      style={{ width, borderColor: borderTone, boxShadow: `inset 0 0 0 1px rgba(255,255,255,0.02), 0 0 16px ${glowTone}` }}
    >
      <div className="flex min-h-[22px] items-center gap-2">
        {statuses.map((status) => (
          <Tooltip
            key={status.key}
            content={
              <div className="rounded-[16px] border border-white/12 bg-[#081018]/96 px-3 py-2.5 text-white shadow-[0_20px_60px_rgba(0,0,0,0.45)]">
                <div className="text-[11px] font-black uppercase tracking-[0.14em] text-white">{status.label}</div>
                <div className="mt-1 text-[11px] leading-4 text-white/88">{status.detail}</div>
              </div>
            }
            pinnable
          >
            <div
              className="flex h-5 min-w-5 items-center justify-center rounded-full border text-[10px] font-black uppercase tracking-[0.08em]"
              style={{
                borderColor: tone === 'buff' ? 'rgba(121,201,255,0.45)' : 'rgba(247,78,78,0.45)',
                background: tone === 'buff' ? 'rgba(32,80,120,0.42)' : 'rgba(120,32,32,0.36)',
                color: '#ffffff',
              }}
            >
              {status.label}
            </div>
          </Tooltip>
        ))}
      </div>
    </div>
  );
}

function ActorCardStack({
  width,
  card,
  buffs,
  debuffs,
  defeated = false,
  footer,
  burnImageUrl,
}: {
  width: number;
  card: React.ReactNode;
  buffs: ActorStatusChip[];
  debuffs: ActorStatusChip[];
  defeated?: boolean;
  footer?: React.ReactNode;
  burnImageUrl?: string;
}) {
  const [burnProgress, setBurnProgress] = useState(0);

  useEffect(() => {
    if (!defeated) {
      setBurnProgress(0);
      return;
    }
    let frame = 0;
    let start = 0;
    const durationMs = CARD_BURN_DURATION_MS;
    const tick = (ts: number) => {
      if (start === 0) start = ts;
      const progress = Math.min(1.2, ((ts - start) / durationMs) * 1.2);
      setBurnProgress(progress);
      if (progress < 1.2) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [defeated]);

  return (
    <div className="flex flex-col items-center">
      <div className="relative">
        <div style={{ opacity: defeated ? 0 : 1 }}>
          {card}
        </div>
        {defeated ? (
          <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[18px]">
            <BurnEdgesEffect
              fitContainer
              hideLabel
              className="h-full w-full p-0"
              config={{
                ...DEFAULT_BURN_EDGES_CONFIG,
                progress: burnProgress,
                burnColor: '#ff6b35',
                noiseScale: 0.75,
                cardImageUrl: burnImageUrl,
                aspectRatio: width / SLICE_CARD_SIZE.height,
              }}
            />
          </div>
        ) : null}
      </div>
      <StatusTray statuses={buffs} tone="buff" width={width} />
      <StatusTray statuses={debuffs} tone="debuff" width={width} />
      {footer ? <div className="mt-3">{footer}</div> : null}
    </div>
  );
}

function TableauCardView({ rank, playable = false, used, onClick = () => {} }: { rank: number; playable?: boolean; used?: boolean; onClick?: () => void }) {
  return (
    <CardFrame
      size={SLICE_TABLEAU_CARD_SIZE}
      borderColor={BANKS_CARD_BORDER_COLOR}
      backgroundColor={used ? 'rgba(0,0,0,0.18)' : playable ? 'rgba(0,0,0,0.8)' : 'rgba(0,0,0,0.7)'}
      onClick={!playable || used ? undefined : onClick}
      style={{ borderWidth: BANKS_CARD_BORDER_WIDTH }}
      className={`relative flex items-start justify-center pt-4 transition-all ${used ? 'opacity-35' : playable ? 'hover:-translate-y-1' : ''}`}
    >
      {!used ? (
        <div className="text-[42px] font-black leading-none text-white [text-shadow:0_0_10px_rgba(255,255,255,0.12)]">{rankLabel(rank)}</div>
      ) : null}
    </CardFrame>
  );
}

function MiniBenchCard({
  name,
  energyCount,
  lootCount = 0,
  cardRef,
  onClick,
  active = false,
  flashing = false,
}: {
  name: string;
  energyCount: number;
  lootCount?: number;
  cardRef?: (node: HTMLDivElement | null) => void;
  onClick?: () => void;
  active?: boolean;
  flashing?: boolean;
}) {
  return (
    <CardFrame
      ref={cardRef}
      size={SLICE_MINI_CARD_SIZE}
      borderColor={BANKS_CARD_BORDER_COLOR}
      backgroundColor="rgba(0,0,0,0.70)"
      boxShadow={active ? '0 0 28px rgba(245,176,56,0.24)' : '0 0 24px rgba(255,255,255,0.05)'}
      onClick={onClick}
      style={{ borderWidth: BANKS_CARD_BORDER_WIDTH }}
      className={`flex flex-col justify-between p-3 ${flashing ? 'animate-[pulse_0.5s_ease-in-out_3]' : ''}`}
    >
      <div className="flex h-full flex-col justify-between">
        <div className="rounded-full border border-white/12 bg-black/72 px-2 py-1 text-center text-[9px] font-black uppercase tracking-[0.12em] text-white/82">
          {name}
        </div>
        <div className="flex flex-1 items-center justify-center gap-3">
          <div className="relative h-10 w-9">
            <div className="absolute left-[7px] top-[4px] flex h-8 w-6 items-center justify-center rounded-[7px] border border-white/24 bg-black/82 text-[13px] text-cyan-200 shadow-[0_6px_14px_rgba(0,0,0,0.34)]">
              ⚡
            </div>
            <div className="absolute -bottom-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full border border-white/24 bg-[#050608] px-1 text-[9px] font-black tabular-nums text-white shadow-[0_6px_14px_rgba(0,0,0,0.34)]">
              {energyCount}
            </div>
          </div>
          {lootCount > 0 ? (
            <div className="relative h-10 w-9">
              <div className="absolute left-[7px] top-[4px] flex h-8 w-6 items-center justify-center rounded-[7px] border border-white/24 bg-black/82 text-[12px] text-[#f6cf73] shadow-[0_6px_14px_rgba(0,0,0,0.34)]">
                ◆
              </div>
              <div className="absolute -bottom-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full border border-white/24 bg-[#050608] px-1 text-[9px] font-black tabular-nums text-white shadow-[0_6px_14px_rgba(0,0,0,0.34)]">
                {lootCount}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </CardFrame>
  );
}

function EnemyAbilityCard({ forecast, detail }: { forecast: ForecastId; detail: string }) {
  const def = FORECAST_CARDS[forecast];
  return (
    <AbilityCard
      size={SLICE_ABILITY_CARD_SIZE}
      title={def.title}
      description={detail || def.description}
      targetType={def.targetType}
      titleColor="text-[#ffd7c2]"
      borderColor={BANKS_CARD_BORDER_COLOR}
      borderWidth={BANKS_CARD_BORDER_WIDTH}
      disabled
    />
  );
}

function makeActorCardImageUrl({
  title,
  hp,
  hpMax,
  armor = 0,
  body,
}: {
  title: string;
  hp: number;
  hpMax: number;
  armor?: number;
  body: string;
}) {
  if (typeof document === 'undefined') return undefined;
  const canvas = document.createElement('canvas');
  canvas.width = 160;
  canvas.height = 220;
  const ctx = canvas.getContext('2d');
  if (!ctx) return undefined;
  const hpText = armor > 0 ? `${hp}/${hpMax} (${armor})` : `${hp}/${hpMax}`;
  ctx.fillStyle = '#040506';
  ctx.beginPath();
  ctx.roundRect(0, 0, 160, 220, 18);
  ctx.fill();
  ctx.strokeStyle = BANKS_CARD_BORDER_COLOR;
  ctx.lineWidth = BANKS_CARD_BORDER_WIDTH;
  ctx.beginPath();
  ctx.roundRect(1, 1, 158, 218, 17);
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  ctx.font = '800 10px Arial';
  ctx.fillText(title.toUpperCase(), 14, 24);
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  ctx.strokeStyle = BANKS_CARD_BORDER_COLOR;
  ctx.lineWidth = BANKS_CARD_BORDER_WIDTH;
  ctx.beginPath();
  ctx.roundRect(14, 34, 132, 18, 9);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = 'rgba(240,240,240,0.9)';
  ctx.beginPath();
  ctx.roundRect(14, 34, Math.max(0, Math.min(132, (hp / Math.max(1, hpMax)) * 132)), 18, 9);
  ctx.fill();
  if (armor > 0) {
    ctx.fillStyle = 'rgba(166,232,244,0.9)';
    ctx.beginPath();
    ctx.roundRect(14, 34, Math.max(0, Math.min(132, (armor / Math.max(1, hpMax)) * 132)), 18, 9);
    ctx.fill();
  }
  ctx.strokeStyle = 'rgba(0,0,0,0.98)';
  ctx.lineWidth = 3;
  ctx.strokeText(hpText, 80 - ctx.measureText(hpText).width / 2, 47);
  ctx.fillStyle = '#e9f7ff';
  ctx.font = '700 8px Arial';
  ctx.fillText(hpText, 80 - ctx.measureText(hpText).width / 2, 47);
  ctx.fillStyle = '#ffffff';
  ctx.font = '900 28px Arial';
  ctx.fillText(String(hp), 14, 98);
  ctx.fillStyle = 'rgba(255,255,255,0.72)';
  ctx.font = '13px Arial';
  const words = body.split(' ');
  let line = '';
  let y = 150;
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > 132 && line) {
      ctx.fillText(line, 14, y);
      line = word;
      y += 16;
    } else {
      line = test;
    }
  }
  if (line) ctx.fillText(line, 14, y);
  return canvas.toDataURL('image/png');
}

function makeAbilityCardImageUrl({
  title,
  description,
  targetLabel,
}: {
  title: string;
  description: string;
  targetLabel: string;
}) {
  if (typeof document === 'undefined') return undefined;
  const canvas = document.createElement('canvas');
  canvas.width = 104;
  canvas.height = 150;
  const ctx = canvas.getContext('2d');
  if (!ctx) return undefined;
  ctx.fillStyle = 'rgba(0,0,0,0.74)';
  ctx.beginPath();
  ctx.roundRect(0, 0, 104, 150, 18);
  ctx.fill();
  ctx.strokeStyle = BANKS_CARD_BORDER_COLOR;
  ctx.lineWidth = BANKS_CARD_BORDER_WIDTH;
  ctx.beginPath();
  ctx.roundRect(1, 1, 102, 148, 17);
  ctx.stroke();
  ctx.fillStyle = 'rgba(0,0,0,0.72)';
  ctx.beginPath();
  ctx.roundRect(12, 12, 80, 28, 14);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#ffd7c2';
  ctx.font = '800 12px Arial';
  const titleLines = title.toUpperCase().split(' ');
  titleLines.forEach((line, index) => {
    const w = ctx.measureText(line).width;
    ctx.fillText(line, 52 - w / 2, 24 + index * 12);
  });
  ctx.fillStyle = 'rgba(255,255,255,0.78)';
  ctx.font = '10px Arial';
  const words = description.split(' ');
  let line = '';
  let y = 78;
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > 72 && line) {
      ctx.fillText(line, 16, y);
      line = word;
      y += 12;
    } else {
      line = test;
    }
  }
  if (line) ctx.fillText(line, 16, y);
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.beginPath();
  ctx.roundRect(12, 118, 80, 22, 11);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.72)';
  ctx.font = '800 8px Arial';
  const targetLines = targetLabel.toUpperCase().split(' ');
  targetLines.forEach((line, index) => {
    const w = ctx.measureText(line).width;
    ctx.fillText(line, 52 - w / 2, 128 + index * 9);
  });
  return canvas.toDataURL('image/png');
}

function ActorLane({
  leftTray,
  actor,
  rightTray,
  rightLabel,
  laneWidth,
}: {
  leftTray: React.ReactNode;
  actor: React.ReactNode;
  rightTray: React.ReactNode;
  rightLabel?: string;
  laneWidth: number;
}) {
  return (
    <div className="flex w-full max-w-[1080px] justify-center">
      <div className="w-full" style={{ maxWidth: `${laneWidth}px` }}>
        <div className="mb-2 grid w-full items-end gap-6 md:grid-cols-[minmax(0,1fr)_160px_minmax(0,1fr)]">
          <div />
          <div />
          <div className="text-[11px] font-black uppercase tracking-[0.22em] text-white/52">
            {rightLabel ?? ''}
          </div>
        </div>
        <div className="grid w-full items-start gap-6 md:grid-cols-[minmax(0,1fr)_160px_minmax(0,1fr)]">
          <div className="flex min-w-0 justify-end">{leftTray}</div>
          <div className="flex justify-center">{actor}</div>
          <div className="flex min-w-0 justify-start">{rightTray}</div>
        </div>
      </div>
    </div>
  );
}

export function BanksThinSlice() {
  const [turnIndex, setTurnIndex] = useState(0);
  const [inputMode, setInputMode] = useState<BanksInputMode>('dnd');
  const [mode, setMode] = useState<BanksMode>('neutral');
  const [primeRank, setPrimeRank] = useState(6);
  const [tableau, setTableau] = useState<TableauCard[]>(() => TURN_SCRIPTS[0].layout.map((cards, index) => ({ id: `t0-${index}`, cards, usedCount: 0 })));
  const [ap, setAp] = useState(0);
  const [fps, setFps] = useState(0);
  const [enemyAp, setEnemyAp] = useState(0);
  const [phase, setPhase] = useState<'tableau' | 'combat' | 'enemy' | 'victory'>('tableau');
  const [banksHp, setBanksHp] = useState(1);
  const [bossHp, setBossHp] = useState(0);
  const [bossArmor, setBossArmor] = useState(0);
  const [bossActive, setBossActive] = useState(false);
  const [bossInBench, setBossInBench] = useState(true);
  const [scoutDefeated, setScoutDefeated] = useState(false);
  const [poisonMirePrimed, setPoisonMirePrimed] = useState(false);
  const [combatActionUsed, setCombatActionUsed] = useState<CombatCardId | null>(null);
  const [selectedCombatCard, setSelectedCombatCard] = useState<CombatCardId | null>(null);
  const [bossBenchFlash, setBossBenchFlash] = useState(false);
  const [targetFlash, setTargetFlash] = useState<'scout' | 'boss-bench' | 'boss' | 'banks' | null>(null);
  const [enemyAbilityBurnProgress, setEnemyAbilityBurnProgress] = useState(0);
  const [enemyAbilityDestroyed, setEnemyAbilityDestroyed] = useState(false);
  const [earnedLoot, setEarnedLoot] = useState<LootReward[]>([]);
  const [log, setLog] = useState<string[]>(['Banks tutorial ready.']);
  const [callouts, setCallouts] = useState<SliceCalloutEntry[]>([]);
  const [dragAnim, setDragAnim] = useState<DragAnimState>(null);
  const [cursorAnim, setCursorAnim] = useState<CursorAnimState>(null);
  const [activeDrag, setActiveDrag] = useState<DragPayload | null>(null);
  const [animating, setAnimating] = useState(false);

  const fpsRafRef = useRef(0);
  const fpsLastSampleTimeRef = useRef(0);
  const fpsFrameCountRef = useRef(0);

  useEffect(() => {
    const tick = (timestamp: number) => {
      if (fpsLastSampleTimeRef.current === 0) {
        fpsLastSampleTimeRef.current = timestamp;
      }
      fpsFrameCountRef.current += 1;
      const elapsed = timestamp - fpsLastSampleTimeRef.current;
      if (elapsed >= 500) {
        setFps(Math.round((fpsFrameCountRef.current * 1000) / elapsed));
        fpsFrameCountRef.current = 0;
        fpsLastSampleTimeRef.current = timestamp;
      }
      fpsRafRef.current = window.requestAnimationFrame(tick);
    };

    fpsRafRef.current = window.requestAnimationFrame(tick);
    return () => {
      if (fpsRafRef.current) {
        window.cancelAnimationFrame(fpsRafRef.current);
      }
    };
  }, []);

  const script = TURN_SCRIPTS[turnIndex];
  const combatHand = useMemo(() => getCombatHand(mode, ap), [mode, ap]);
  const dealtCardIds = useMemo(() => new Set(combatHand.map((card) => card.id)), [combatHand]);
  const visibleBanksCards = useMemo(() => BANKS_CARD_ORDER.map((id) => COMBAT_CARDS[id]), []);
  const banksBuffs = useMemo<ActorStatusChip[]>(
    () => (mode === 'prowl' ? [{ key: 'prowl', label: 'P', tone: 'buff', detail: 'Banks is prowling and untargetable.' }] : []),
    [mode]
  );
  const banksDebuffs = useMemo<ActorStatusChip[]>(() => [], []);
  const enemyBuffs = useMemo<ActorStatusChip[]>(
    () => (poisonMirePrimed ? [{ key: 'poison-mire', label: 'P', tone: 'buff', detail: 'Poison Mire primed. The next bite poisons with certainty.' }] : []),
    [poisonMirePrimed]
  );
  const enemyDebuffs = useMemo<ActorStatusChip[]>(() => [], []);
  const scoutBurnImageUrl = useMemo(
    () => makeActorCardImageUrl({ title: 'Scout Rat', hp: 2, hpMax: 2, armor: 0, body: 'Vulnerable target for Swipe' }),
    []
  );
  const bossBurnImageUrl = useMemo(
    () => makeActorCardImageUrl({ title: 'Boss Rat', hp: bossHp, hpMax: BOSS_RAT_MAX_HP, armor: bossArmor, body: 'Wood Splinter Armor active.' }),
    [bossArmor, bossHp]
  );
  const tableauLaneWidth = tableau.length * SLICE_TABLEAU_CARD_SIZE.width + Math.max(0, tableau.length - 1) * 16;
  const playableCount = useMemo(
    () => tableau.filter((card) => {
      const rank = card.cards[card.usedCount];
      return rank !== undefined && canPlayOnPrime(rank, primeRank);
    }).length,
    [tableau, primeRank]
  );
  const tableauRefs = useRef<(HTMLDivElement | null)[]>([]);
  const enemyActorRef = useRef<HTMLDivElement | null>(null);
  const playerActorRef = useRef<HTMLDivElement | null>(null);
  const enemyAbilityRef = useRef<HTMLDivElement | null>(null);
  const enemyGuidanceRef = useRef<HTMLDivElement | null>(null);
  const bossBenchRef = useRef<HTMLDivElement | null>(null);
  const combatCardRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const appendLog = (text: string) => {
    setLog((prev) => [text, ...prev].slice(0, 8));
  };

  const sleep = (ms: number) => new Promise<void>((resolve) => window.setTimeout(resolve, ms));

  const queueCallout = (text: string, subtitle?: string, anchor?: { x: number; y: number }, centered?: boolean) => {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    setCallouts((prev) => [...prev, { id, text, subtitle, anchor, centered }]);
    window.setTimeout(() => {
      setCallouts((prev) => prev.filter((entry) => entry.id !== id));
    }, 2200);
  };

  const getNodeCenter = (node: HTMLElement | null) => {
    if (!node) return null;
    const rect = node.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  };

  const getGuidanceAnchor = (node: HTMLElement | null) => {
    if (!node) return undefined;
    const rect = node.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.bottom + 14 };
  };

  const getEnemyStatusAnchor = () => {
    const actorCenter = getNodeCenter(enemyActorRef.current);
    const abilityCenter = getNodeCenter(enemyAbilityRef.current);
    if (!actorCenter || !abilityCenter) return undefined;
    return { x: actorCenter.x, y: abilityCenter.y };
  };

  const animateCardTravel = async (
    label: string,
    fromNode: HTMLElement | null,
    toNode: HTMLElement | null,
    width = SLICE_TABLEAU_CARD_SIZE.width,
    height = SLICE_TABLEAU_CARD_SIZE.height,
    rotation = -8,
    durationMs = 480,
  ) => {
    const from = getNodeCenter(fromNode);
    const to = getNodeCenter(toNode);
    if (!from || !to) return;
    setDragAnim({ kind: 'card', label, from, to, rotation, scale: 1.06, width, height });
    await sleep(durationMs);
    setDragAnim(null);
  };

  const animateCursorTap = async (fromNode: HTMLElement | null, toNode: HTMLElement | null) => {
    const from = getNodeCenter(fromNode);
    const to = getNodeCenter(toNode);
    if (!from || !to) return;
    setCursorAnim({ from, to, clickAtMidpoint: true });
    await sleep(420);
    setCursorAnim(null);
  };

  const burnEnemyAbilityCard = async (durationMs: number) => {
    let frame = 0;
    let start = 0;
    return new Promise<void>((resolve) => {
      const tick = (ts: number) => {
        if (start === 0) start = ts;
        const progress = Math.min(1.2, ((ts - start) / durationMs) * 1.2);
        setEnemyAbilityBurnProgress(progress);
        if (progress < 1.2) {
          frame = requestAnimationFrame(tick);
        } else {
          resolve();
        }
      };
      setEnemyAbilityBurnProgress(0.0001);
      frame = requestAnimationFrame(tick);
      window.setTimeout(() => cancelAnimationFrame(frame), durationMs + 1000);
    }).finally(() => setEnemyAbilityBurnProgress(0));
  };

  const resetScenario = () => {
    setTurnIndex(0);
    setMode('neutral');
    setPrimeRank(6);
    setTableau(TURN_SCRIPTS[0].layout.map((cards, index) => ({ id: `t0-${index}`, cards, usedCount: 0 })));
    setAp(0);
    setEnemyAp(0);
    setPhase('tableau');
    setBanksHp(1);
    setBossHp(0);
    setBossArmor(0);
    setBossActive(false);
    setBossInBench(true);
    setScoutDefeated(false);
    setPoisonMirePrimed(false);
    setCombatActionUsed(null);
    setSelectedCombatCard(null);
    setBossBenchFlash(false);
    setTargetFlash(null);
    setEnemyAbilityBurnProgress(0);
    setEnemyAbilityDestroyed(false);
    setEarnedLoot([]);
    setLog(['Banks tutorial ready.']);
    setCallouts([]);
    setDragAnim(null);
    setCursorAnim(null);
    setActiveDrag(null);
    setAnimating(false);
  };

  const beginDrag = (payload: DragPayload) => (event: DragEvent<HTMLDivElement>) => {
    if (inputMode !== 'dnd' || animating) {
      event.preventDefault();
      return;
    }
    if (payload.kind === 'combat' && phase === 'tableau' && combatHand.length > 0) {
      setPhase('combat');
      appendLog(`Combat phase. ${combatHand.map((entry) => entry.name).join(', ')} ready.`);
    }
    setActiveDrag(payload);
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', JSON.stringify(payload));
  };

  const endDrag = () => {
    setActiveDrag(null);
  };

  const allowDrop = (event: DragEvent<HTMLDivElement>) => {
    if (inputMode !== 'dnd') return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  };

  const toggleInputMode = () => {
    setInputMode((prev) => (prev === 'dnd' ? 'pointer' : 'dnd'));
    setActiveDrag(null);
  };

  const handlePlayTableau = async (id: string) => {
    if (phase !== 'tableau' || animating) return;
    const card = tableau.find((entry) => entry.id === id);
    const nextRank = card?.cards[card.usedCount];
    if (!card || nextRank === undefined || !canPlayOnPrime(nextRank, primeRank)) return;
    const columnIndex = tableau.findIndex((entry) => entry.id === id);
    setAnimating(true);
    await animateCardTravel(rankLabel(nextRank), tableauRefs.current[columnIndex], playerActorRef.current);
    setTableau((prev) => prev.map((entry) => (entry.id === id ? { ...entry, usedCount: entry.usedCount + 1 } : entry)));
    setPrimeRank(nextRank);
    const nextAp = ap + 1;
    setAp(nextAp);
    const nextHand = getCombatHand(mode, nextAp);
    appendLog(nextHand.length > 0 ? `Dealt ${nextHand.map((entry) => entry.name).join(', ')}.` : 'No combat card dealt.');
    setAnimating(false);
  };

  const advanceTurn = (nextMode = mode) => {
    if (turnIndex >= TURN_SCRIPTS.length - 1) {
      setPhase('victory');
      appendLog('Encounter complete.');
      return;
    }
    const nextTurn = turnIndex + 1;
    setTurnIndex(nextTurn);
    setMode(nextMode);
    setPrimeRank(6);
    setAp(0);
    setEnemyAp(0);
    setPhase('tableau');
    setTableau(TURN_SCRIPTS[nextTurn].layout.map((cards, index) => ({ id: `t${nextTurn}-${index}`, cards, usedCount: 0 })));
    setCombatActionUsed(null);
    setSelectedCombatCard(null);
    setBossBenchFlash(false);
    setTargetFlash(null);
    setEnemyAbilityBurnProgress(0);
    setEnemyAbilityDestroyed(false);
  };

  const resolveEnemyPhase = async (cardUsed?: CombatCardId | null) => {
    if (turnIndex === 0) {
      if (cardUsed === 'swipe') {
        queueCallout('Scout Rat defeated.', 'Combat', getEnemyStatusAnchor(), true);
        setScoutDefeated(true);
        appendLog('Scout Rat falls.');
        window.setTimeout(() => {
          void burnEnemyAbilityCard(CARD_BURN_DURATION_MS).then(() => setEnemyAbilityDestroyed(true));
        }, DELAYED_CHILD_BURN_OFFSET_MS);
        await sleep(CARD_BURN_DURATION_MS);
        setBossBenchFlash(true);
        queueCallout('Boss incoming.', 'Enemy', getEnemyStatusAnchor(), true);
        await animateCardTravel('Boss Rat', bossBenchRef.current, enemyActorRef.current, SLICE_MINI_CARD_SIZE.width, SLICE_MINI_CARD_SIZE.height, 10, BOSS_INCOMING_DURATION_MS);
        setBossBenchFlash(false);
        setBossInBench(false);
        setBossHp(BOSS_RAT_MAX_HP);
        setBossArmor(BOSS_RAT_MAX_ARMOR);
        setBossActive(true);
        setScoutDefeated(false);
        queueCallout('Boss Rat enters the fight.', 'Enemy', getEnemyStatusAnchor(), true);
        appendLog('Boss Rat emerges with 25 Wood Splinter Armor.');
      } else {
        appendLog('The Scout Rat survives. Reset and follow the intended line.');
      }
      advanceTurn();
      return;
    }

    setPhase('enemy');
    setAnimating(true);
    queueCallout('Enemy Turn', 'Phase');

    const plan = script.enemyPlan;
    if (bossActive && plan) {
      setEnemyAp(0);
      for (const columnIndex of plan.tableauPulls) {
        const column = tableau[columnIndex];
        const pullRank = column?.cards[column.usedCount];
        if (pullRank === undefined) continue;
        await animateCursorTap(enemyActorRef.current, tableauRefs.current[columnIndex]);
        await animateCardTravel(rankLabel(pullRank), tableauRefs.current[columnIndex], enemyActorRef.current, SLICE_TABLEAU_CARD_SIZE.width, SLICE_TABLEAU_CARD_SIZE.height, 10);
        setTableau((prev) => prev.map((entry, index) => (index === columnIndex ? { ...entry, usedCount: entry.usedCount + 1 } : entry)));
        setEnemyAp((prev) => prev + 1);
        await sleep(180);
      }

      queueCallout('Combat begins.', 'Enemy', getEnemyStatusAnchor(), true);
      await sleep(360);
      await animateCursorTap(enemyActorRef.current, enemyAbilityRef.current);
      await animateCardTravel(plan.ability === 'rabid-bite' ? 'Rabid Bite' : 'Poison Mire', enemyAbilityRef.current, playerActorRef.current, SLICE_MINI_CARD_SIZE.width, SLICE_MINI_CARD_SIZE.height, -6);
    }

    if (turnIndex === 1) {
      const prowlActive = mode === 'prowl' || cardUsed === 'prowl';
      queueCallout(prowlActive ? 'Missed!' : 'Hit!', 'Rabid Bite', getEnemyStatusAnchor(), true);
      appendLog(prowlActive
        ? 'Rabid Bite misses. Banks is untargetable while prowling.'
        : 'Rabid Bite lands. Banks is defeated.');
      if (!prowlActive) {
        setBanksHp(0);
        setAnimating(false);
        return;
      }
      queueCallout('Enemy turn ends.', 'Enemy', getEnemyStatusAnchor(), true);
      setAnimating(false);
      advanceTurn('prowl');
      return;
    }

    if (turnIndex === 2) {
      setPoisonMirePrimed(true);
      queueCallout('Poison Mire primed.', 'Enemy', getEnemyStatusAnchor(), true);
      appendLog('Poison Mire primed. The next enemy bite will poison with certainty.');
      queueCallout('Enemy turn ends.', 'Enemy', getEnemyStatusAnchor(), true);
      setAnimating(false);
      advanceTurn('prowl');
      return;
    }

    if (turnIndex === 3) {
      if (bossHp <= 0) {
        setPhase('victory');
        setEarnedLoot(BOSS_RAT_LOOT);
        queueCallout('Encounter complete.', 'Victory', getEnemyStatusAnchor(), true);
        appendLog('Boss Rat is down. Banks clears the encounter and drops Mochi.');
      } else {
        appendLog('The Boss Rat survives. This tutorial expects the full Shadow Strike finish.');
      }
      setAnimating(false);
    }
  };

  const activeCombatDragId = activeDrag?.kind === 'combat' ? activeDrag.cardId : null;
  const activeCombatCardId = inputMode === 'dnd' ? activeCombatDragId : selectedCombatCard;
  const highlightScout = phase === 'combat' && activeCombatCardId === 'swipe' && !combatActionUsed && !bossActive;
  const highlightBossBench = phase === 'combat' && activeCombatCardId === 'swipe' && !combatActionUsed && !bossActive;
  const highlightBoss = phase === 'combat' && activeCombatCardId !== null && bossActive && !combatActionUsed;
  const primeExhausted = phase === 'tableau' && playableCount === 0;

  const resolveCombatCardOnTarget = async (card: CombatCardDef, target: 'scout' | 'boss-bench' | 'boss') => {
    if (phase !== 'combat' || combatHand.length === 0 || combatActionUsed || animating) return;
    const cardNode = combatCardRefs.current[card.id];
    if (!cardNode) return;

    if (card.id === 'swipe') {
      if (!bossActive) {
        if (target === 'boss-bench') {
          queueCallout('Scout Rat is the active target.', 'Hint');
          return;
        }
        setAnimating(true);
        await animateCardTravel(card.name, cardNode, enemyActorRef.current, SLICE_MINI_CARD_SIZE.width, SLICE_MINI_CARD_SIZE.height, -6);
        setTargetFlash('scout');
        await sleep(220);
        setTargetFlash(null);
        appendLog(`Swipe deals ${ap} and removes the Scout Rat.`);
        setCombatActionUsed(card.id);
        setSelectedCombatCard(null);
        queueCallout('Scout Rat defeated.', 'Combat', getEnemyStatusAnchor(), true);
        setScoutDefeated(true);
        window.setTimeout(() => {
          void burnEnemyAbilityCard(CARD_BURN_DURATION_MS).then(() => setEnemyAbilityDestroyed(true));
        }, DELAYED_CHILD_BURN_OFFSET_MS);
        await sleep(CARD_BURN_DURATION_MS);
        setBossBenchFlash(true);
        await animateCardTravel('Boss Rat', bossBenchRef.current, enemyActorRef.current, SLICE_MINI_CARD_SIZE.width, SLICE_MINI_CARD_SIZE.height, 10, BOSS_INCOMING_DURATION_MS);
        setBossBenchFlash(false);
        setBossActive(true);
        setScoutDefeated(false);
        setBossHp(BOSS_RAT_MAX_HP);
        setBossArmor(BOSS_RAT_MAX_ARMOR);
        queueCallout('Enemy turn over.', 'Phase', getEnemyStatusAnchor(), true);
        await sleep(900);
        queueCallout('Player turn.', 'Phase');
        advanceTurn();
        setAnimating(false);
        return;
      }

      if (target !== 'boss') return;
      setAnimating(true);
      await animateCardTravel(card.name, cardNode, enemyActorRef.current, SLICE_MINI_CARD_SIZE.width, SLICE_MINI_CARD_SIZE.height, -6);
      setTargetFlash('boss');
      await sleep(220);
      setTargetFlash(null);
      setBossHp((prev) => Math.max(0, prev - ap));
      appendLog(`Swipe deals ${ap} to the Boss Rat.`);
      setCombatActionUsed(card.id);
      setSelectedCombatCard(null);
      setAnimating(false);
      return;
    }

    if (target !== 'boss') return;

    if (card.id === 'prowl') {
      setMode('prowl');
      appendLog('Banks enters Prowl.');
    }
    if (card.id === 'shred-armor') {
      const armorDamage = ap * 3;
      setBossArmor((prev) => Math.max(0, prev - armorDamage));
      appendLog(`Shred Armor deals ${armorDamage} to armor and strips the Boss Rat clean.`);
    }
    if (card.id === 'shadow-strike') {
      setBossHp((prev) => Math.max(0, prev - ap));
      appendLog(`Shadow Strike deals ${ap} and Banks remains in Prowl.`);
    }
    setCombatActionUsed(card.id);
    setSelectedCombatCard(null);

    if (turnIndex === 2 && card.id === 'shred-armor') {
      setBossArmor(0);
    }
    if (turnIndex === 3 && card.id === 'shadow-strike') {
      setBossHp(Math.max(0, bossHp - ap));
    }

    if (turnIndex === 3 && card.id === 'shadow-strike' && bossHp - ap <= 0) {
      setPhase('victory');
      setEarnedLoot(BOSS_RAT_LOOT);
      queueCallout('Boss Rat defeated.', 'Combat', getEnemyStatusAnchor(), true);
      appendLog('Boss Rat is down. Banks clears the encounter and drops Mochi.');
    }
  };

  const handleUseCombatCard = (card: CombatCardDef) => {
    if ((phase !== 'combat' && phase !== 'tableau') || combatHand.length === 0 || combatActionUsed || animating) return;
    if (phase === 'tableau') {
      setPhase('combat');
      appendLog(`Combat phase. ${combatHand.map((entry) => entry.name).join(', ')} ready.`);
    }
    setSelectedCombatCard((prev) => (prev === card.id ? null : card.id));
  };

  const handleCombatEndTurn = () => {
    if (phase !== 'combat' || animating) return;
    resolveEnemyPhase(combatActionUsed);
  };

  const playerFooter = phase === 'combat' ? (
    <button
      type="button"
      onClick={handleCombatEndTurn}
      className="rounded-[14px] border border-white/12 bg-black/52 px-4 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-white/78 transition-all hover:border-game-gold/50 hover:text-white"
    >
      End Turn
    </button>
  ) : phase === 'enemy' ? (
    <div className="px-2 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-white/48">
      Enemy Turn
    </div>
  ) : null;

  const enemyGuidanceActive = callouts.some((entry) => !!entry.anchor);

  return (
    <div
      className="relative min-h-[100dvh] overflow-hidden bg-[#020205] text-white"
      onContextMenu={(event) => event.preventDefault()}
    >
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
        <div className="bg-nebula-layer opacity-40" />
        <div className="absolute inset-0 opacity-10 mix-blend-overlay" style={{ backgroundImage: 'linear-gradient(rgba(127,219,202,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(127,219,202,0.1) 1px, transparent 1px)', backgroundSize: '120px 120px' }} />
      </div>

      <div className="relative z-10 mx-auto flex min-h-[100dvh] w-full max-w-[1480px] flex-col gap-5 px-6 py-6">
        <div className="flex items-start justify-between gap-6">
          <div className="flex flex-col gap-2">
            <div className="text-[11px] font-black uppercase tracking-[0.28em] text-white/50">
              ({fps}) • Turn {script.turn} • Prime {rankLabel(primeRank)} • AP {ap} • {playableCount} legal move{playableCount === 1 ? '' : 's'}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={toggleInputMode}
              className="rounded-[16px] border border-white/12 bg-black/52 px-4 py-2 text-[11px] font-black uppercase tracking-[0.18em] text-white/78 transition-all hover:border-game-gold/50 hover:text-white"
              title={inputMode === 'dnd' ? 'Switch to pointer mode' : 'Switch to drag and drop mode'}
            >
              {inputMode === 'dnd' ? 'DND' : '🖱'}
            </button>
            <button
              type="button"
              onClick={resetScenario}
              className="rounded-[16px] border border-white/12 bg-black/52 px-4 py-2 text-[11px] font-black uppercase tracking-[0.18em] text-white/78 transition-all hover:border-game-gold/50 hover:text-white"
            >
              Reset Slice
            </button>
          </div>
        </div>

        <div className="flex flex-1 flex-col items-center gap-[5px]">
          <ActorLane
            laneWidth={tableauLaneWidth}
            rightLabel="Next enemy action"
            leftTray={(
              <div className="relative flex h-[220px] w-full items-center justify-center rounded-[20px] border border-white/10 bg-black/32 p-3">
                {bossBenchFlash ? (
                  <div className="pointer-events-none absolute left-3 right-3 top-3 z-10 rounded-[10px] border border-red-500/55 bg-[#220407] px-3 py-1 text-center text-[10px] font-black uppercase tracking-[0.24em] text-red-200 animate-[pulse_0.5s_ease-in-out_3]">
                    Boss Incoming
                  </div>
                ) : null}
                {bossInBench && !bossActive ? (
                  <div
                    onDragOver={highlightBossBench && activeDrag?.kind === 'combat' && activeDrag.cardId === 'swipe' ? allowDrop : undefined}
                    onDrop={
                      highlightBossBench
                        ? (event) => {
                            allowDrop(event);
                            if (activeDrag?.kind === 'combat' && activeDrag.cardId === 'swipe') {
                              void resolveCombatCardOnTarget(COMBAT_CARDS.swipe, 'boss-bench');
                            }
                            endDrag();
                          }
                        : undefined
                    }
                    className={highlightBossBench && activeDrag?.kind === 'combat' ? 'rounded-[18px] ring-2 ring-white/35 ring-offset-2 ring-offset-transparent' : undefined}
                  >
                    <MiniBenchCard
                      cardRef={(node) => { bossBenchRef.current = node; }}
                      name="Boss Rat"
                      energyCount={3}
                      lootCount={BOSS_RAT_LOOT.length}
                      onClick={inputMode === 'pointer' && highlightBossBench ? () => resolveCombatCardOnTarget(COMBAT_CARDS.swipe, 'boss-bench') : undefined}
                      active={highlightBossBench}
                      flashing={bossBenchFlash}
                    />
                  </div>
                ) : null}
              </div>
            )}
            actor={(
              <ActorCardStack
                width={SLICE_CARD_SIZE.width}
                defeated={bossActive ? bossHp <= 0 : scoutDefeated}
                buffs={enemyBuffs}
                debuffs={enemyDebuffs}
                burnImageUrl={bossActive ? bossBurnImageUrl : scoutBurnImageUrl}
                card={(
                  <div
                    onDragOver={
                      inputMode === 'dnd' &&
                      ((highlightScout && activeDrag?.kind === 'combat' && activeDrag.cardId === 'swipe')
                        || (highlightBoss && activeDrag?.kind === 'combat'))
                        ? allowDrop
                        : undefined
                    }
                    onDrop={
                      inputMode === 'dnd' && (highlightScout || highlightBoss)
                        ? (event) => {
                            allowDrop(event);
                            if (activeDrag?.kind === 'combat') {
                              if (highlightScout && activeDrag.cardId === 'swipe') {
                                void resolveCombatCardOnTarget(COMBAT_CARDS.swipe, 'scout');
                              } else if (highlightBoss) {
                                void resolveCombatCardOnTarget(COMBAT_CARDS[activeDrag.cardId], 'boss');
                              }
                            }
                            endDrag();
                          }
                        : undefined
                    }
                    className={
                      inputMode === 'dnd' && activeDrag?.kind === 'combat' && (highlightScout || highlightBoss)
                        ? 'rounded-[18px] ring-2 ring-white/35 ring-offset-2 ring-offset-transparent'
                        : undefined
                    }
                  >
                  <CardFrame
                    ref={enemyActorRef}
                    size={SLICE_CARD_SIZE}
                    borderColor={BANKS_CARD_BORDER_COLOR}
                    backgroundColor="rgba(0,0,0,0.74)"
                    boxShadow={
                      highlightScout || highlightBoss
                        ? '0 0 28px rgba(245,176,56,0.24), 0 18px 40px rgba(0,0,0,0.22)'
                        : '0 18px 40px rgba(0,0,0,0.22)'
                    }
                    style={{
                      borderColor: BANKS_CARD_BORDER_COLOR,
                      borderWidth: BANKS_CARD_BORDER_WIDTH,
                    }}
                    onClick={inputMode === 'pointer'
                      ? highlightScout
                        ? () => { void resolveCombatCardOnTarget(COMBAT_CARDS.swipe, 'scout'); }
                        : highlightBoss
                          ? () => { void resolveCombatCardOnTarget(COMBAT_CARDS[selectedCombatCard as CombatCardId], 'boss'); }
                          : undefined
                      : undefined}
                    className={`flex flex-col justify-between p-4 ${
                      highlightScout || highlightBoss
                        ? 'cursor-pointer shadow-[0_0_28px_rgba(245,176,56,0.24)]'
                        : ''
                    } ${targetFlash === 'scout' || targetFlash === 'boss' ? 'animate-[pulse_0.35s_ease-in-out_2]' : ''}`}
                  >
                    <div className="flex h-full flex-col justify-between">
                      <div>
                        <div className="text-[10px] font-black uppercase tracking-[0.14em] text-white/82">
                          {bossActive ? 'Boss Rat' : 'Scout Rat'}
                        </div>
                        <div className="mt-2">
                          <CombatVitalsBar
                            hp={bossActive ? bossHp : 2}
                            hpMax={bossActive ? BOSS_RAT_MAX_HP : 2}
                            armor={bossActive ? bossArmor : 0}
                            superArmor={0}
                            accent="#f0f0f0"
                          />
                        </div>
                        <div className="mt-4 text-4xl font-black text-white">{bossActive ? bossHp : 2}</div>
                      </div>
                      <div className="space-y-2">
                        {bossActive ? (
                          <AbilityApBar ap={enemyAp} maxAp={5} />
                        ) : null}
                        <div className="text-sm text-white/70">
                          {bossActive ? 'Wood Splinter Armor active.' : 'Vulnerable target for Swipe'}
                        </div>
                      </div>
                    </div>
                  </CardFrame>
                  </div>
                )}
              />
            )}
            rightTray={(
              <div className="flex h-[220px] w-full items-center justify-center rounded-[20px] border border-white/10 bg-black/32 p-3">
                <div
                  ref={enemyAbilityRef}
                  className="relative"
                  style={{ width: `${SLICE_ABILITY_CARD_SIZE.width}px`, height: `${SLICE_ABILITY_CARD_SIZE.height}px` }}
                >
                  <div style={{ opacity: enemyAbilityBurnProgress > 0 || enemyAbilityDestroyed ? 0 : 1 }}>
                    <EnemyAbilityCard forecast={script.forecast} detail={script.forecastText} />
                  </div>
                  {enemyAbilityBurnProgress > 0 ? (
                    <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[18px]">
                      <BurnEdgesEffect
                        fitContainer
                        hideLabel
                        className="h-full w-full p-0"
                        config={{
                          ...DEFAULT_BURN_EDGES_CONFIG,
                          progress: enemyAbilityBurnProgress,
                          burnColor: '#ff6b35',
                          noiseScale: 0.75,
                          cardImageUrl: makeAbilityCardImageUrl({
                            title: FORECAST_CARDS[script.forecast].title,
                            description: script.forecastText,
                            targetLabel: 'Single Target',
                          }),
                          aspectRatio: SLICE_ABILITY_CARD_SIZE.width / SLICE_ABILITY_CARD_SIZE.height,
                        }}
                      />
                    </div>
                  ) : null}
                </div>
              </div>
            )}
          />

          <div className="flex w-full max-w-[1080px] justify-center">
            <div className="w-full" style={{ maxWidth: `${tableauLaneWidth}px` }}>
              <div className="grid h-[24px] w-full items-center md:grid-cols-[minmax(0,1fr)_160px_minmax(0,1fr)]">
                <div />
                <div
                  ref={enemyGuidanceRef}
                  className="mx-auto h-[24px] w-[160px] rounded-[14px]"
                  style={{
                    border: enemyGuidanceActive ? '1px solid rgba(255,255,255,0.12)' : '1px solid transparent',
                    background: enemyGuidanceActive ? 'rgba(0,0,0,0.2)' : 'transparent',
                  }}
                />
                <div />
              </div>
            </div>
          </div>

          <div className="flex w-full max-w-[1080px] flex-col items-center gap-[5px]">
            <div className="flex w-full flex-nowrap items-start justify-center gap-2 overflow-x-auto overflow-y-hidden pb-0" style={{ maxWidth: `${tableauLaneWidth}px` }}>
              {tableau.map((column, index) => {
                const visibleRank = column.cards[column.usedCount];
                const remaining = column.cards.slice(column.usedCount + 1);
                return (
                  <div
                    key={column.id}
                    ref={(node) => { tableauRefs.current[index] = node; }}
                    className="relative flex h-[150px] w-[104px] items-start justify-center"
                  >
                    {remaining.map((rank, depth) => (
                      <div
                        key={`${column.id}-depth-${depth}`}
                        className="absolute"
                        style={{ top: `${6 + depth * 10}px`, left: 0 }}
                      >
                        <TableauCardView rank={rank} used />
                      </div>
                    ))}
                    {visibleRank !== undefined ? (
                      <div className="absolute bottom-0 left-0">
                        <div
                          draggable={inputMode === 'dnd' && phase === 'tableau' && !animating && canPlayOnPrime(visibleRank, primeRank)}
                          onDragStart={beginDrag({ kind: 'tableau', columnId: column.id })}
                          onDragEnd={endDrag}
                        >
                          <TableauCardView
                            rank={visibleRank}
                            playable={phase === 'tableau' && !animating && canPlayOnPrime(visibleRank, primeRank)}
                            onClick={inputMode === 'pointer' ? () => handlePlayTableau(column.id) : () => {}}
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="absolute bottom-0 left-0">
                        <TableauCardView rank={0} used />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="text-center text-sm leading-6 text-white/78">
              {script.objective}
            </div>
          </div>

          <ActorLane
            laneWidth={tableauLaneWidth}
            leftTray={(
              <div className="flex h-[220px] w-full items-center justify-center rounded-[20px] border border-white/10 bg-black/32 p-3 text-sm text-white/38" />
            )}
            actor={(
              <ActorCardStack
                width={SLICE_CARD_SIZE.width}
                defeated={banksHp <= 0}
                buffs={banksBuffs}
                debuffs={banksDebuffs}
                footer={playerFooter}
                card={(
                  <div
                    onDragOver={inputMode === 'dnd' && activeDrag?.kind === 'tableau' ? allowDrop : undefined}
                    onDrop={
                      inputMode === 'dnd'
                        ? (event) => {
                            allowDrop(event);
                            if (activeDrag?.kind === 'tableau') {
                              void handlePlayTableau(activeDrag.columnId);
                            }
                            endDrag();
                          }
                        : undefined
                    }
                    className={
                      inputMode === 'dnd' && activeDrag?.kind === 'tableau'
                        ? 'rounded-[18px] ring-2 ring-white/35 ring-offset-2 ring-offset-transparent'
                        : undefined
                    }
                  >
                  <CardFrame
                    ref={playerActorRef}
                    size={SLICE_CARD_SIZE}
                    borderColor={BANKS_CARD_BORDER_COLOR}
                    backgroundColor={primeExhausted ? 'rgba(0,0,0,0.9)' : 'rgba(0,0,0,0.74)'}
                    boxShadow={primeExhausted ? '0 18px 40px rgba(0,0,0,0.38)' : '0 18px 40px rgba(0,0,0,0.22)'}
                    className="flex flex-col justify-between p-4"
                    style={primeExhausted ? { filter: 'brightness(0.72) saturate(0.82)', borderWidth: BANKS_CARD_BORDER_WIDTH } : { borderWidth: BANKS_CARD_BORDER_WIDTH }}
                  >
                    <div className="flex h-full flex-col justify-between">
                      <div>
                        <div className="text-center text-[10px] font-black uppercase tracking-[0.14em] text-white/82">
                          Banks
                        </div>
                        <div className="mt-2">
                          <CombatVitalsBar hp={banksHp} hpMax={BANKS_MAX_HP} armor={0} superArmor={0} accent="#f0f0f0" />
                        </div>
                        <div className="pt-4 text-center text-4xl font-black leading-none text-white">{rankLabel(primeRank)}</div>
                      </div>
                      <AbilityApBar ap={ap} maxAp={mode === 'prowl' ? 10 : 4} />
                    </div>
                  </CardFrame>
                  </div>
                )}
              />
            )}
            rightTray={(
              <div className="relative flex h-[220px] w-full items-center justify-center rounded-[20px] border border-white/10 bg-black/32 p-3">
                <div className="grid w-full grid-cols-2 place-items-center gap-3">
                  {visibleBanksCards.map((card) => {
                    const available = dealtCardIds.has(card.id);
                    return (
                      <div
                        key={card.id}
                        draggable={inputMode === 'dnd' && available && phase !== 'enemy' && phase !== 'victory' && !animating}
                        onDragStart={beginDrag({ kind: 'combat', cardId: card.id })}
                        onDragEnd={endDrag}
                      >
                        <AbilityCard
                          title={card.name}
                          description={card.description({ ap })}
                          targetType={card.targetType}
                          size={SLICE_TRAY_CARD_SIZE}
                          costLabel={getBanksCardCostLabel(mode, card.id)}
                          collapsed
                          cardRef={(node) => { combatCardRefs.current[card.id] = node; }}
                          borderColor={available ? BANKS_CARD_BORDER_COLOR : 'rgba(255,255,255,0.08)'}
                          borderWidth={available ? BANKS_CARD_BORDER_WIDTH : 1}
                          selected={available && selectedCombatCard === card.id}
                          disabled={!available || phase === 'enemy' || phase === 'victory'}
                          onClick={inputMode === 'pointer' ? () => handleUseCombatCard(card) : undefined}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          />

        </div>
      </div>
      {dragAnim ? (
        <motion.div
          className="pointer-events-none fixed z-[140]"
          style={{
            left: dragAnim.from.x - dragAnim.width / 2,
            top: dragAnim.from.y - dragAnim.height / 2,
            width: dragAnim.width,
            height: dragAnim.height,
          }}
          initial={{ x: 0, y: 0, rotate: 0, scale: 1 }}
          animate={{ x: dragAnim.to.x - dragAnim.from.x, y: dragAnim.to.y - dragAnim.from.y, rotate: dragAnim.rotation, scale: dragAnim.scale }}
          transition={{ duration: 0.46, ease: [0.22, 0.68, 0.2, 1] }}
        >
          <CardFrame
            size={{ width: dragAnim.width, height: dragAnim.height }}
            borderColor={BANKS_CARD_BORDER_COLOR}
            backgroundColor="rgba(0,0,0,0.82)"
            boxShadow="0 18px 36px rgba(0,0,0,0.34), 0 0 18px rgba(255,255,255,0.12)"
            style={{ borderWidth: BANKS_CARD_BORDER_WIDTH }}
            className="flex items-center justify-center"
          >
            <div className="text-[28px] font-black text-white">{dragAnim.label}</div>
          </CardFrame>
        </motion.div>
      ) : null}
      {cursorAnim ? (
        <motion.div
          className="pointer-events-none fixed z-[150] text-[28px]"
          style={{
            left: cursorAnim.from.x,
            top: cursorAnim.from.y,
            filter: 'drop-shadow(0 0 10px rgba(255,255,255,0.45))',
          }}
          initial={{ x: 0, y: 0, opacity: 0 }}
          animate={{
            x: cursorAnim.to.x - cursorAnim.from.x,
            y: cursorAnim.to.y - cursorAnim.from.y,
            opacity: [0, 1, 1, 0],
            scale: cursorAnim.clickAtMidpoint ? [1, 1.08, 0.92, 1] : 1,
          }}
          transition={{ duration: 0.42, ease: [0.22, 0.68, 0.2, 1], times: [0, 0.12, 0.78, 1] }}
        >
          ☝
        </motion.div>
      ) : null}
      {callouts.map((entry, index) => (
        <Callout
          key={entry.id}
          visible
          text={entry.text}
          subtitle={entry.subtitle}
          instanceKey={entry.id}
          tone="dialogue"
          autoFadeMs={1600}
          anchor={entry.anchor}
          style={
            entry.anchor
              ? entry.centered
                ? { transform: 'translate(-50%, -50%)' }
                : undefined
              : { position: 'fixed', left: '50%', top: `${22 + index * 72}%`, transform: 'translateX(-50%)' }
          }
        />
      ))}    </div>
  );
}
