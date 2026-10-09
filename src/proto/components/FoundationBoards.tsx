import React, { useEffect, useRef } from 'react';
import { DEFAULT_CHIP_ABILITY } from '../protoData';
import type { ProtoHeroClass } from '../protoTypes';
import { ACTOR_STAMINA_MAX, DEV_ACTOR_DEFEAT_OVERRIDE, ENEMY_TEAM_SLOT_IDS, FOUNDATION_MOCKUPS, FOUNDATION_SLOTS, heroLabelForTargetId, rankLabel, targetToneForAbility, type AbilityEffectType, type AbilityTargetKind, type AdvisorAbilityOption, type EnemyRuntimeState, type FoundationSlot, type HeroBuff, type PendingAbilityTarget, type SceneKind, type TargetAnnouncement, type TargetHighlightTone } from '../protoState';

export const FoundationBoard = ({
  label,
  subtitle,
  scene = 'combat',
  valueLabel,
  hp,
  maxHp,
  comboCount,
  comboTarget,
  stamina = 0,
  staminaMax = 0,
  workCompleted = 0,
  buffs = [],
  charge,
  accent,
  announcementTargetId,
  active,
  placementTargetable = false,
  targetable,
  targetTone = 'misc',
  canChoose,
  onClick,
  onDevDefeat,
  vitalsRef,
  children,
}: {
  label: string;
  subtitle?: string;
  scene?: SceneKind;
  valueLabel: string;
  hp: number;
  maxHp: number;
  comboCount: number;
  comboTarget: number;
  stamina?: number;
  staminaMax?: number;
  workCompleted?: number;
  buffs?: HeroBuff[];
  charge?: { label: string; value: number; threshold: number };
  accent: {
    text: string;
    border: string;
    valueBorder: string;
  };
  announcementTargetId: string;
  active: boolean;
  placementTargetable?: boolean;
  targetable: boolean;
  targetTone?: TargetHighlightTone;
  canChoose: boolean;
  onClick: () => void;
  onDevDefeat?: () => void;
  vitalsRef?: (node: HTMLDivElement | null) => void;
  children: React.ReactNode;
}) => {
  const devDefeatTimer = useRef<number | null>(null);
  const devDefeatTriggered = useRef(false);
  const cancelDevDefeat = () => {
    if (devDefeatTimer.current === null) return;
    window.clearTimeout(devDefeatTimer.current);
    devDefeatTimer.current = null;
  };
  useEffect(() => cancelDevDefeat, []);
  const comboSections = Math.max(comboTarget, comboCount);
  const comboSectionIndexes = Array.from({ length: comboSections }, (_, sectionIndex) => sectionIndex);
  const hpPercent = `${Math.max(0, Math.min(100, (hp / Math.max(1, maxHp)) * 100))}%`;
  const targetHighlightClass =
    targetTone === 'attack'
      ? 'border-[#ff4d4d]/90 shadow-[0_0_34px_rgba(255,77,77,0.26)]'
      : targetTone === 'heal'
        ? 'border-[#72f2a0]/90 shadow-[0_0_34px_rgba(114,242,160,0.24)]'
        : 'border-[#ffd166]/90 shadow-[0_0_34px_rgba(255,209,102,0.24)]';

  return (
    <div
      data-announcement-target={announcementTargetId}
      className={`proto-foundation-card relative grid w-full grid-rows-[auto_1fr] overflow-hidden rounded-[calc(var(--classic-radius)*1.15)] border bg-[linear-gradient(180deg,rgba(7,9,10,0.98),rgba(3,4,5,0.98))] text-left font-mono text-white transition ${scene === 'exploration' ? 'proto-foundation-card--exploration' : 'proto-foundation-card--combat'} ${
        targetable
          ? targetHighlightClass
          : active
          ? 'border-[#8ef2d4]/80 shadow-[0_0_34px_rgba(110,255,217,0.18)]'
            : accent.border
      }`}
    >
      <div
        ref={vitalsRef}
        role="button"
        tabIndex={canChoose ? 0 : -1}
        onClick={canChoose ? onClick : undefined}
        onKeyDown={
          canChoose
            ? (event) => {
                if (event.key !== 'Enter') return;
                event.preventDefault();
                onClick();
              }
            : undefined
        }
        className={`proto-foundation-header grid min-h-0 ${scene === 'combat' ? 'grid-cols-[auto_minmax(7.25rem,1fr)_auto]' : 'grid-cols-[minmax(0,1fr)_auto]'} items-center gap-[clamp(0.5rem,1.05vmin,0.78rem)] border-b p-[clamp(0.65rem,1.45vmin,1rem)] transition ${
          placementTargetable
            ? 'border-[#8ef2d4]/80 bg-[#8ef2d4]/10 shadow-[inset_0_0_30px_rgba(110,255,217,0.16)]'
            : 'border-white/8'
        } ${canChoose ? 'cursor-pointer hover:bg-white/[0.035]' : 'cursor-default'}`}
      >
        <div
          className={`min-w-[4.6rem] text-[clamp(0.82rem,1.7vmin,1.08rem)] font-black uppercase tracking-[0.12em] ${accent.text}`}
          onPointerDown={(event) => {
            if (!DEV_ACTOR_DEFEAT_OVERRIDE || !onDevDefeat) return;
            cancelDevDefeat();
            devDefeatTriggered.current = false;
            devDefeatTimer.current = window.setTimeout(() => {
              devDefeatTimer.current = null;
              devDefeatTriggered.current = true;
              onDevDefeat();
            }, 3000);
          }}
          onPointerUp={cancelDevDefeat}
          onPointerLeave={cancelDevDefeat}
          onPointerCancel={cancelDevDefeat}
          onClick={(event) => {
            if (!devDefeatTriggered.current) return;
            event.stopPropagation();
            devDefeatTriggered.current = false;
          }}
        >
          <div>{label}</div>
          {subtitle ? <div className="mt-0.5 text-[clamp(0.46rem,0.88vmin,0.6rem)] font-bold tracking-[0.08em] text-white/52">{subtitle}</div> : null}
          {DEV_ACTOR_DEFEAT_OVERRIDE && onDevDefeat ? <div className="proto-dev-defeat-hint mt-1 text-[clamp(0.38rem,0.72vmin,0.5rem)] tracking-[0.1em] text-[#ff8f70]/70">DEV HOLD 3S</div> : null}
          {scene === 'combat' && buffs.length > 0 ? (
            <div className="mt-1 flex flex-wrap gap-1 text-[clamp(0.48rem,0.92vmin,0.62rem)] tracking-[0.06em] text-[#ffe7ad]">
              {buffs.map((buff) => (
                <span key={`${announcementTargetId}-${buff.id}`} className="rounded border border-[#ffd166]/36 bg-[#ffd166]/10 px-1 py-0.5">
                  {buff.id === 'def'
                    ? `DEF +${buff.value}`
                    : buff.id === 'taunt'
                      ? 'TAUNT'
                      : buff.id === 'phase_shift'
                        ? 'PHASE'
                        : buff.id === 'blink_strain'
                          ? 'STRAIN'
                          : buff.id === 'hallowed_strain'
                            ? 'FATIGUE'
                            : buff.id === 'well_fed' ? 'WELL FED' : 'MUDDY'} {buff.turnsRemaining}T
                </span>
              ))}
            </div>
          ) : null}
          {scene === 'combat' && charge ? (
            <div className="mt-1 text-[clamp(0.48rem,0.92vmin,0.62rem)] tracking-[0.06em] text-[#a9d8ff]">
              {charge.label} {charge.value}/{charge.threshold}
            </div>
          ) : null}
        </div>
        <div className="proto-combat-metrics grid min-w-0 gap-[clamp(0.3rem,0.68vmin,0.46rem)]">
          <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-[clamp(0.35rem,0.78vmin,0.58rem)] text-[clamp(0.68rem,1.38vmin,0.9rem)] font-black leading-none text-white/92">
            <span>HP</span>
            <div className="h-[clamp(0.54rem,1.12vmin,0.74rem)] overflow-hidden rounded-full border border-white/30 bg-white/14 shadow-[inset_0_1px_2px_rgba(0,0,0,0.55)]">
              <div className="h-full rounded-full bg-[linear-gradient(90deg,#8ef2d4,#f4c86c)]" style={{ width: hpPercent }} />
            </div>
            <span>{hp}/{maxHp}</span>
          </div>
          <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-[clamp(0.35rem,0.78vmin,0.58rem)] text-[clamp(0.68rem,1.38vmin,0.9rem)] font-black leading-none text-white/92">
            <span>{scene === 'combat' ? 'CB' : 'WORK'}</span>
            <div
              className="grid h-[clamp(0.54rem,1.12vmin,0.74rem)] overflow-hidden rounded-full border border-white/30 bg-white/14 shadow-[inset_0_1px_2px_rgba(0,0,0,0.55)]"
              style={{ gridTemplateColumns: `repeat(${comboSections}, minmax(0, 1fr))` }}
            >
              {comboSectionIndexes.map((sectionIndex) => (
                <span
                  key={`board-combo-section-${announcementTargetId}-${sectionIndex}`}
                  className={`h-full border-r border-black/45 last:border-r-0 ${
                    sectionIndex < comboCount ? 'bg-[linear-gradient(90deg,#8ef2d4,#f4c86c)]' : 'bg-transparent'
                  }`}
                />
              ))}
            </div>
            <span className="min-w-[1.8em] rounded-full border border-white/28 bg-black/50 px-1 py-0.5 text-center text-white/95">{comboCount}</span>
          </div>
          <div className="text-[clamp(0.44rem,0.9vmin,0.58rem)] font-black uppercase tracking-[0.1em] text-white/58">
            Stamina {stamina}/{staminaMax} · Work {workCompleted}
          </div>
        </div>
        <div className={`grid size-[clamp(1.55rem,3.5vmin,2.1rem)] shrink-0 place-items-center rounded-full border bg-[#f8f3dc] text-[clamp(0.78rem,1.78vmin,1.08rem)] font-black leading-none text-black shadow-[0_0_22px_rgba(255,209,102,0.14)] ${accent.valueBorder}`}>
          {valueLabel}
        </div>
      </div>

      <div className="min-h-0 p-[clamp(0.48rem,1.05vmin,0.72rem)]">
        {children}
      </div>
    </div>
  );
};

export const ActorFoundationPanel = ({
  foundation,
  index,
  scene,
  hp,
  buffs,
  stamina,
  workCompleted,
  active,
  placementTargetable,
  targetable,
  targetTone,
  pendingAbility,
  mobilityLabel,
  mobilityReady,
  mobilityPending,
  canChoose,
  selectedAdvisorAbility,
  onClick,
  onSelectAdvisorAbility,
  onUseMobility,
  onCancelAbility,
  onDevDefeat,
  onTransportTargetRef,
  announcement,
}: {
  foundation: FoundationSlot;
  index: number;
  scene: SceneKind;
  hp: number;
  buffs: HeroBuff[];
  stamina: number;
  workCompleted: number;
  active: boolean;
  placementTargetable: boolean;
  targetable: boolean;
  targetTone?: TargetHighlightTone;
  pendingAbility: PendingAbilityTarget | null;
  mobilityLabel: string;
  mobilityReady: boolean;
  mobilityPending: boolean;
  canChoose: boolean;
  selectedAdvisorAbility: string | null;
  onClick: () => void;
  onSelectAdvisorAbility: (abilityId: string | null) => void;
  onUseMobility: () => void;
  onCancelAbility: () => void;
  onDevDefeat?: () => void;
  onTransportTargetRef?: (node: HTMLDivElement | null) => void;
  announcement: TargetAnnouncement | null;
}) => {
  const mockup = FOUNDATION_MOCKUPS[index] ?? {
    label: `Hero ${index + 1}`,
    animalType: 'Unknown',
    heroClass: 'Reserve' as ProtoHeroClass,
    hp: 20,
    maxHp: 20,
    cardTransportSpeed: 1,
  };
  const comboCount = foundation?.count ?? 0;
  const defeated = hp <= 0;
  const comboTarget = Math.max(1, comboCount);
  const valueLabel = foundation?.wildcardBridgeFromRank ? '+/-' : foundation ? rankLabel(foundation.card.rank) : '-';
  const activeEffect = pendingAbility?.sourceIndex === index ? pendingAbility : null;
  const defaultTargetKind: AbilityTargetKind =
    mockup.heroClass === 'Cleric' || mockup.heroClass === 'Reserve' ? 'hero' : 'enemy';
  const defaultEffectType: AbilityEffectType = defaultTargetKind === 'hero' ? 'heal' : 'damage';
  const heroName = heroLabelForTargetId('hero');
  const abilityEffectText = (effectType: AbilityEffectType, power: number) => {
    if (effectType === 'chip') return `Placing a card on this foundation immediately deals ${power} damage to a foe.`;
    if (effectType === 'mobility') {
      if (mobilityLabel === 'Dig') return 'Exchange the top card of a tableau column with the card beneath it. Reveals a new route.';
      if (mobilityLabel === 'Blink') return 'Swap Glacia\'s foundation value with any exposed tableau card. Resets her combo.';
      if (mobilityLabel === 'Hallowed Path') return 'Place any exposed card on Jimothy. It adds no CB or combo direction.';
      return 'Manipulate the tableau to create a new route.';
    }
    if (effectType === 'holy_nova') return `Heal every ally and damage every foe for ${power}. Consumes this combo.`;
    if (effectType === 'heal') return `Restore ${power} HP to a hero. Consumes this combo.`;
    if (effectType === 'guard') return `Gain DEF +${power} for 1 enemy turn. Consumes this combo.`;
    if (effectType === 'taunt') return `Force enemy attacks to target ${heroName} for 1 enemy turn. Consumes this combo.`;
    if (effectType === 'frostbolt') return `Deal ${power} damage and drain ${power} enemy CB. Consumes this combo.`;
    if (effectType === 'phase_shift') return 'Give an ally one +/-2 tableau placement. Consumes Arcane Charge.';
    return `Deal ${power} damage to an enemy. Consumes this combo.`;
  };
  const combatAdvisorSlots: AdvisorAbilityOption[] = [
    {
      id: 'chip',
      heading: 'Chip',
      label: DEFAULT_CHIP_ABILITY.label,
      power: DEFAULT_CHIP_ABILITY.damage,
      tone: 'text-[#9ee45d]',
      usable: false,
      targetKind: 'enemy',
      effectType: 'chip',
    },
    {
      id: 'mobility',
      heading: 'Mobility',
      label: mobilityLabel,
      power: 0,
      tone: 'text-[#d9a8ff]',
      suffix: mobilityPending ? 'Choose target' : mobilityReady ? 'Ready' : 'Cooldown',
      usable: !defeated && (mobilityReady || mobilityPending),
      targetKind: 'self',
      effectType: 'mobility',
    },
    {
      id: 'reserve-a',
      heading: 'Reserve',
      label: 'Locked',
      power: 0,
      tone: 'text-white/42',
      usable: false,
      targetKind: 'self',
      effectType: 'mobility',
    },
    {
      id: 'reserve-b',
      heading: 'Reserve',
      label: 'Locked',
      power: 0,
      tone: 'text-white/42',
      usable: false,
      targetKind: 'self',
      effectType: 'mobility',
    },
  ];
  const advisorSlots: AdvisorAbilityOption[] = scene === 'combat' ? combatAdvisorSlots : [];
  const selectedAdvisorOption = advisorSlots.find((ability) => ability.id === selectedAdvisorAbility) ?? null;
  const selectedAbility = activeEffect
    ? {
        heading: 'Loaded',
        label: activeEffect.effectLabel,
        power: activeEffect.power,
        tone: 'text-[#ffe7ad]',
        targetKind: activeEffect.targetKind,
        effectType: activeEffect.effectType,
        usable: true,
      }
    : selectedAdvisorOption
      ? {
          heading: selectedAdvisorOption.heading,
          label: selectedAdvisorOption.label,
        power: selectedAdvisorOption.power,
        tone: selectedAdvisorOption.tone,
        targetKind: selectedAdvisorOption.targetKind,
        effectType: selectedAdvisorOption.effectType,
        usable: selectedAdvisorOption.usable,
        }
      : null;
  const accent =
    index === 0
      ? { text: 'text-[#ffb13d]', border: 'border-[#a85f16]/70', valueBorder: 'border-[#ffb13d]/50' }
      : index === 1
        ? { text: 'text-[#d9a8ff]', border: 'border-[#b47cff]/58', valueBorder: 'border-[#d9a8ff]/48' }
        : { text: 'text-[#9ee45d]', border: 'border-[#9ee45d]/58', valueBorder: 'border-[#9ee45d]/48' };

  return (
    <FoundationBoard
      label={mockup.label}
      scene={scene}
      valueLabel={valueLabel}
      hp={hp}
      maxHp={mockup.maxHp}
      comboCount={comboCount}
      comboTarget={comboTarget}
      stamina={stamina}
      staminaMax={ACTOR_STAMINA_MAX}
      workCompleted={workCompleted}
      buffs={buffs}
      accent={accent}
      announcementTargetId={`hero-${index}`}
      active={active}
      placementTargetable={placementTargetable}
      targetable={targetable}
      targetTone={targetTone}
      canChoose={canChoose && !defeated}
      onClick={onClick}
      onDevDefeat={onDevDefeat}
      vitalsRef={onTransportTargetRef}
    >
        {announcement?.targetKind === 'hero' && announcement.targetIndex === index ? (
          <InlineAnnouncement announcement={announcement} />
        ) : selectedAbility ? (
          <div className="relative grid h-full min-h-0 grid-rows-[auto_1fr] rounded-[calc(var(--classic-radius)*0.7)] border border-[#ffd166]/42 bg-[#ffd166]/10 p-[clamp(0.55rem,1.15vmin,0.82rem)] pr-[clamp(2.2rem,4.4vmin,2.8rem)] text-left">
            <div className="min-w-0">
              <div className="text-[clamp(1rem,2.05vmin,1.28rem)] font-black leading-tight text-[#ffe7ad]">
                {selectedAbility.label}{selectedAbility.power > 0 ? ` (${selectedAbility.power})` : ''}
              </div>
            </div>
            <div className="mt-[clamp(0.35rem,0.82vmin,0.55rem)] flex min-h-0 flex-col justify-center gap-[clamp(0.3rem,0.65vmin,0.45rem)]">
              <div className="text-[clamp(0.9rem,1.82vmin,1.15rem)] font-bold leading-snug text-white/90">
                {abilityEffectText(selectedAbility.effectType, selectedAbility.power)}
              </div>
              <div className={`text-[clamp(0.66rem,1.32vmin,0.84rem)] font-black uppercase tracking-[0.1em] ${selectedAbility.tone}`}>
                {selectedAbility.usable
                  ? selectedAbility.effectType === 'mobility'
                    ? 'Choose a tableau card'
                    : `Choose ${selectedAbility.targetKind === 'enemy' ? 'an enemy' : selectedAbility.targetKind === 'hero' ? 'an ally' : mockup.label}`
                  : 'Not currently castable'}
              </div>
            </div>
            <button
              type="button"
              aria-label="Close advisor detail"
              onClick={(event) => {
                event.stopPropagation();
                onCancelAbility();
                onSelectAdvisorAbility(null);
              }}
              className="absolute bottom-[clamp(0.45rem,1vmin,0.68rem)] right-[clamp(0.45rem,1vmin,0.68rem)] grid size-[clamp(1.55rem,3.2vmin,2rem)] place-items-center rounded-full border border-white/18 bg-black/45 text-[clamp(0.7rem,1.4vmin,0.88rem)] font-black text-white/78 transition hover:border-[#ffd166]/48 hover:text-white"
            >
              X
            </button>
          </div>
        ) : advisorSlots.length > 0 ? (
          <div className={`proto-foundation-advisor-grid grid h-full min-h-[clamp(5.4rem,11dvh,7.2rem)] ${scene === 'combat' ? 'grid-cols-4 divide-x' : 'grid-cols-1'} divide-white/10 text-center text-[clamp(0.62rem,1.24vmin,0.82rem)] leading-tight`}>
            {advisorSlots.map((ability) => (
              <button
                key={`advisor-ability-${mockup.label}-${ability.id}`}
                type="button"
                data-castable={ability.usable ? 'true' : 'false'}
                onClick={(event) => {
                  event.stopPropagation();
                  onSelectAdvisorAbility(ability.id);
                  if (!ability.usable) return;
                  if (ability.effectType === 'mobility') {
                    onUseMobility();
                    return;
                  }
                }}
                className={`px-[clamp(0.35rem,0.8vmin,0.55rem)] transition ${
                  ability.usable
                    ? 'cursor-pointer bg-white/[0.025] shadow-[inset_0_0_18px_rgba(255,255,255,0.025)] hover:bg-white/[0.075]'
                    : 'cursor-pointer bg-white/[0.012] opacity-30 grayscale hover:bg-white/[0.045] hover:opacity-55'
                }`}
              >
                <div className={`text-[0.9em] font-black uppercase tracking-[0.08em] ${ability.tone}`}>
                  {ability.heading}
                </div>
                <div className="mt-[clamp(0.22rem,0.5vmin,0.34rem)] font-bold text-white/92">
                  {ability.label}
                  <br />
                  <span className="text-white/60">({ability.power})</span>
                </div>
                {ability.suffix ? <div className="mt-1 text-[0.85em] font-bold text-white/52">{ability.suffix}</div> : null}
              </button>
            ))}
          </div>
        ) : null}
    </FoundationBoard>
  );
};

export const EnemyFoundationPanel = ({
  enemy,
  index,
  active,
  placementTargetable = false,
  targetable,
  targetTone,
  tauntActive = false,
  canChoose,
  onClick,
  onDevDefeat,
  onTransportTargetRef,
  announcement,
}: {
  enemy: EnemyRuntimeState;
  index: number;
  active: boolean;
  placementTargetable?: boolean;
  targetable: boolean;
  targetTone?: TargetHighlightTone;
  tauntActive?: boolean;
  canChoose: boolean;
  onClick: () => void;
  onDevDefeat?: () => void;
  onTransportTargetRef?: (node: HTMLDivElement | null) => void;
  announcement: TargetAnnouncement | null;
}) => {
  const comboTarget = Math.max(1, enemy.threshold);
  const accent = { text: 'text-[#d8c3ff]', border: 'border-[#7b6a50]/72', valueBorder: 'border-[#d8c3ff]/48' };
  const intentTarget = tauntActive && enemy.intent.tone === 'attack'
    ? heroLabelForTargetId('hero')
    : heroLabelForTargetId(enemy.intent.targetId);

  return (
    <FoundationBoard
      label={enemy.label}
      valueLabel={enemy.valueLabel}
      hp={enemy.hp}
      maxHp={enemy.maxHp}
      comboCount={enemy.comboCount}
      comboTarget={comboTarget}
      accent={accent}
      announcementTargetId={`enemy-${index}`}
      active={active}
      placementTargetable={placementTargetable}
      targetable={targetable}
      targetTone={targetTone}
      canChoose={canChoose}
      onClick={onClick}
      onDevDefeat={onDevDefeat}
      vitalsRef={onTransportTargetRef}
    >
      <div className="grid min-h-[clamp(5.4rem,11dvh,7.2rem)] grid-rows-[auto_1fr] gap-[clamp(0.34rem,0.75vmin,0.5rem)]">
        <div className={`rounded-[calc(var(--classic-radius)*0.55)] border px-3 py-[clamp(0.34rem,0.72vmin,0.48rem)] text-center font-black leading-tight ${
          enemy.intent.tone === 'attack'
            ? 'border-[#ff6b6b]/24 bg-[#ff6b6b]/8 text-[#ffd0d0]'
            : 'border-[#8ef2d4]/24 bg-[#8ef2d4]/8 text-[#c7fff2]'
        }`}>
          <span className="text-[1.08em]">{enemy.intent.symbol}</span>
          <span className="mx-1 text-white/72">&gt;</span>
          <span>{intentTarget}</span>
          <span className="ml-1 text-[0.9em] text-white/68">({enemy.ability})</span>
        </div>
        {announcement?.targetKind === 'enemy' && announcement.targetIndex === index ? (
          <InlineAnnouncement announcement={announcement} />
        ) : (
          <div className="grid grid-cols-2 divide-x divide-white/10 text-center text-[clamp(0.55rem,1.22vmin,0.76rem)]">
            <div className="px-2">
              <div className="font-semibold uppercase tracking-[0.1em] text-[#d8c3ff]">Intent</div>
              <div className="mt-1 text-white/86">{enemy.next}</div>
            </div>
            <div className="px-2">
              <div className="font-semibold uppercase tracking-[0.1em] text-[#ffd166]">Threshold</div>
              <div className="mt-1 text-white/86">({enemy.threshold})</div>
            </div>
          </div>
        )}
      </div>
    </FoundationBoard>
  );
};

export const EnemyTeamPanel = ({
  enemies,
  scene,
  biomeCacheClaimed,
  pendingAbility,
  tauntActive,
  burningEnemyIds,
  onTargetEnemy,
  onDevDefeatEnemy,
  transportTargetIndex,
  onTransportTargetRef,
  announcement,
  ambushCardsRemaining,
}: {
  enemies: EnemyRuntimeState[];
  scene: SceneKind;
  biomeCacheClaimed: boolean;
  pendingAbility: PendingAbilityTarget | null;
  tauntActive: boolean;
  burningEnemyIds: string[];
  onTargetEnemy: (enemyIndex: number) => void;
  onDevDefeatEnemy: (enemyIndex: number) => void;
  transportTargetIndex: number | null;
  onTransportTargetRef: (enemyIndex: number, node: HTMLDivElement | null) => void;
  announcement: TargetAnnouncement | null;
  ambushCardsRemaining: number;
}) => (
  <div className="rounded-[calc(var(--classic-radius)*1.3)] border border-[#8ef2d4]/18 bg-[linear-gradient(180deg,rgba(12,20,24,0.54),rgba(9,10,12,0.28))] p-[clamp(0.5rem,1.25vmin,0.8rem)]">
    {scene === 'combat' && ambushCardsRemaining > 0 ? (
      <div className="mb-[clamp(0.45rem,1vmin,0.7rem)] rounded-[calc(var(--classic-radius)*0.85)] border border-[#ffd166]/55 bg-[#211a08]/70 px-[clamp(0.55rem,1.2vmin,0.8rem)] py-[clamp(0.45rem,0.9vmin,0.65rem)] font-mono text-[#ffe8ae]">
        <div className="text-[clamp(0.7rem,1.3vmin,0.86rem)] font-black uppercase tracking-[0.16em]">Ambush holds</div>
        <div className="mt-1 text-[clamp(0.58rem,1.05vmin,0.72rem)] uppercase tracking-[0.1em] text-[#fff2c9]/80">
          Enemy caught off guard · {ambushCardsRemaining} player cards before breakout
        </div>
      </div>
    ) : null}
    {enemies.length === 0 ? (
      <div className="grid min-h-[clamp(8rem,18dvh,11rem)] place-items-center rounded-[calc(var(--classic-radius)*0.85)] border border-[#8ef2d4]/28 bg-[#8ef2d4]/5 text-center font-mono">
        <div>
          <div className="text-[clamp(0.9rem,1.9vmin,1.2rem)] font-black uppercase tracking-[0.14em] text-[#c7fff2]">
            {scene === 'exploration' ? (biomeCacheClaimed ? 'Forest Cache Secured' : 'Forest Expedition') : 'Combat Cleared'}
          </div>
        </div>
      </div>
    ) : (
      <div
        className="grid w-full justify-center"
        style={{
          gridTemplateColumns: `repeat(${ENEMY_TEAM_SLOT_IDS.length}, minmax(0, calc((var(--actor-board-span) - (var(--classic-gap) * 2)) / ${FOUNDATION_SLOTS})))`,
          gap: 'var(--classic-gap)',
        }}
      >
      {ENEMY_TEAM_SLOT_IDS.map((enemyId) => {
        const index = enemies.findIndex((enemy) => enemy.id === enemyId);
        const enemy = index >= 0 ? enemies[index] : null;
        if (!enemy) return <div key={`enemy-slot-${enemyId}`} aria-hidden="true" />;
        return (
          <div
            key={enemy.id}
            className={`min-w-0 w-full transition-all duration-700 ease-in ${
              burningEnemyIds.includes(enemy.id)
                ? 'scale-95 border-[#ff6b35]/90 opacity-0 saturate-0 shadow-[0_0_42px_rgba(255,78,38,0.85)]'
                : 'opacity-100'
            }`}
          >
            <EnemyFoundationPanel
              enemy={enemy}
              index={index}
              active={pendingAbility?.targetKind === 'enemy' || transportTargetIndex === index}
              placementTargetable={transportTargetIndex === index}
              targetable={pendingAbility?.targetKind === 'enemy'}
              targetTone={targetToneForAbility(pendingAbility)}
              tauntActive={tauntActive}
              canChoose={pendingAbility?.targetKind === 'enemy'}
              onClick={() => onTargetEnemy(index)}
              onDevDefeat={() => onDevDefeatEnemy(index)}
              onTransportTargetRef={(node) => onTransportTargetRef(index, node)}
              announcement={announcement}
            />
          </div>
        );
      })}
      </div>
    )}
  </div>
);

export const InlineAnnouncement = ({ announcement }: { announcement: TargetAnnouncement }) => (
  <>
    <style>{`
      @keyframes proto-inline-announcement-life {
        0% { opacity: 0; transform: translateY(0.3rem) scale(0.97); }
        10%, 78% { opacity: 1; transform: translateY(0) scale(1); }
        100% { opacity: 0; transform: translateY(-0.25rem) scale(0.98); }
      }
    `}</style>
    <div
      key={`${announcement.targetKind}-${announcement.targetIndex}-${announcement.abilityName}-${announcement.impact}`}
      className="grid min-h-0 place-items-center rounded-[calc(var(--classic-radius)*0.55)] border border-[#ffd166]/52 bg-[#100d06]/72 px-[clamp(0.55rem,1.2vmin,0.82rem)] py-[clamp(0.4rem,0.9vmin,0.62rem)] text-center font-mono shadow-[inset_0_0_24px_rgba(255,209,102,0.08)]"
      style={{ animation: 'proto-inline-announcement-life 3s ease-out forwards' }}
    >
      <div className="truncate text-[clamp(0.72rem,1.45vmin,0.96rem)] font-black uppercase tracking-[0.08em] text-[#ffe7ad]">
        {announcement.abilityName}
      </div>
      <div className="mt-1 text-[clamp(0.95rem,1.85vmin,1.2rem)] font-black leading-none text-white">
        {announcement.impact}
      </div>
    </div>
  </>
);
