import { AbilityCostBubble } from './AbilityCostBubble';
import { useEffect, useRef, useState, type CSSProperties, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import { CIR_ART, type BattleActor, type BattleState } from '../rules/battle';
import { castReason, dismissReason, feedNeeded, feedReason, harnessOrder, hasCasts, hasRarity, heroLoad, invokeCost, isExhausted, isStacking, keruCooldown, keruFed, keruJumboActions, keruTier, loadCap, pourReason, upkeepOf, upkeepPlan, type Farewell } from '../rules/keruInvoke';
import { KeruCastGem, useKeruBoard } from './KeruPourCast';
import { FEED_COSTS, INVOKE_BUFFS, KERU_CASTS, RARITY_NAMES, RARITY_TIERS, activeSynergies, castText, farewellText, keruLoad, keruUpkeep, rarityBuffText, synergyText, type InvokeKeruId, type RarityTier } from '../rules/keruInvokeData';
import { useFxQuality } from '../fxQuality';
import { rankLabel } from '../protoState';
import { ACTOR_HOLO_ART } from '../art/actorCardArt';
import demSubject from '../art/keruDrafts/dem-style-v3/dem-storybook-v3.png';
import demBackground from '../art/keruDrafts/dem-draft/dem-background-v1.png';
import { AbilityCardFace, KeruAbilityArt } from './AbilityCardFace';
import { ActorCardArt } from './DetailsCardViewer';
import { KeruExpression } from './KeruExpression';
import { MochiEmoji } from './MochiEmoji';
import { BanksEmoji } from './BanksEmoji';
import { useCardJumbo } from './CardJumbo';
import './KeruRarity.css';

// In-battle Keru rarity presentation (scenarios 1006–1012): tier frames,
// shimmer/holofoil over the card art, progress pips, the tier-up flourish,
// Hero's harness badges, 1010–1011's load meter and synergy links, 1012's
// upkeep badges and farewells, and the Vault Warden's seal meter. Every effect has a
// static low tier (reduced motion or the Low effects setting); gameplay never
// depends on any of it.

export const rarityName = (tier: RarityTier) => RARITY_NAMES[tier];
export const rarityKey = (tier: RarityTier) => RARITY_TIERS[tier];

/** Card art with the tier's shimmer and holofoil layered over it (inherits the card's --foil-x/y pointer position). */
export function RarityArt({ tier, children }: { tier: RarityTier; children: ReactNode }) {
  return <span className="keru-rarity-art" data-rarity={rarityKey(tier)}>
    {children}
    {tier >= 2 && <span className="keru-rarity-art__foil" aria-hidden="true" />}
    {tier >= 1 && <span className="keru-rarity-art__shimmer" aria-hidden="true" />}
  </span>;
}

/** Tier name and progress pips toward the next tier. */
export function RarityProgress({ battle, keru }: { battle: BattleState; keru: InvokeKeruId }) {
  const tier = keruTier(battle, keru), need = feedNeeded(battle, keru), fed = keruFed(battle, keru);
  return <span className="keru-rarity-progress" data-rarity={rarityKey(tier)} role="img"
    aria-label={need ? `${rarityName(tier)} · ${fed} of ${need} AP fed toward ${rarityName((tier + 1) as RarityTier)}` : `${rarityName(tier)} · maximum tier`}>
    <b>{rarityName(tier)}</b>
    {need > 0 && <span className="keru-rarity-progress__pips" aria-hidden="true">{Array.from({ length: need }, (_, i) => <i key={i} data-on={i < fed || undefined} />)}</span>}
  </span>;
}

/** Remembers each Keru's tier and reports the ones that just went up, for the evolve flourish (under 1s). */
export function useTierUps(battle: BattleState): Partial<Record<InvokeKeruId, number>> {
  const previous = useRef(battle.keruInvoke?.tiers), [ups, setUps] = useState<Partial<Record<InvokeKeruId, number>>>({});
  const tiers = battle.keruInvoke?.tiers;
  useEffect(() => {
    const before = previous.current; previous.current = tiers;
    if (!tiers || !before || before === tiers) return;
    const raised = (Object.keys(tiers) as InvokeKeruId[]).filter(keru => tiers[keru] > before[keru]);
    if (!raised.length) return;
    setUps(current => ({ ...current, ...Object.fromEntries(raised.map(keru => [keru, (current[keru] ?? 0) + 1])) }));
    const timer = window.setTimeout(() => setUps(current => Object.fromEntries(Object.entries(current).filter(([keru]) => !raised.includes(keru as InvokeKeruId)))), 900);
    return () => window.clearTimeout(timer);
  }, [tiers]);
  return ups;
}

/** The static/animated effects tier for rarity: Low under reduced motion or the Low effects setting. */
export function useRarityFx() { return useFxQuality() === 'low' ? 'low' : 'high'; }

/** Hero's invoked Keru, each in its tier colour; 1010 shows all three harness slots. */
export function KeruHarnessBadges({ battle, actor, face, onDismiss }: { battle: BattleState; actor: BattleActor; face: (keru: string) => ReactNode; onDismiss?: (keru: InvokeKeruId) => void }) {
  const hold = useLongPress(), open = useKeruJumbo(battle);
  if (battle.keruInvoke?.upkeep) return <KeruUpkeepBadges battle={battle} actor={actor} face={face} onDismiss={onDismiss} />;
  if (isStacking(battle)) return <KeruStack battle={battle} actor={actor} face={face} />;
  const slots = battle.keruInvoke?.slots ?? 1, order = harnessOrder(battle), kit = battle.keruInvoke?.kit ?? 'rarity';
  return <span className="keru-harness" data-slots={slots} role="group" aria-label={slots > 1 ? `Harness · ${order.length} of ${slots} Keru` : 'Invoked Keru'}>
    {Array.from({ length: slots }, (_, i) => {
      const keru = order[i];
      if (!keru) return slots > 1 ? <span key={i} className="keru-harness__slot" data-empty aria-label="Empty harness slot" role="img" /> : null;
      const tier = (actor.harness?.[keru] ?? 0) as RarityTier;
      return <button key={keru} type="button" className="battle-buff-icon battle-invoke-badge keru-harness__slot" data-buff="keru-invoke" data-invoked-keru={keru} data-rarity={rarityKey(tier)}
        aria-label={`${keru} invoked · ${rarityName(tier)}`} data-game-tooltip={`${rarityName(tier)} ${keru[0].toUpperCase() + keru.slice(1)} invoked: ${rarityBuffText(keru, tier, kit)}${actor.keruWard && keru === 'dem' ? ' Ward ready.' : ''}${slots > 1 ? ' A fourth invoke replaces the oldest Keru.' : ' Invoking another Keru replaces it.'} Hold for its card.`} {...hold(() => open(keru))}>{face(keru)}</button>;
    })}
  </span>;
}

/** The Vault Warden's seal: AP poured this turn against the threshold, with a tap fallback to pour 1 AP. */
export function SealMeter({ battle, onPour }: { battle: BattleState; onPour: () => void }) {
  const seal = battle.keruInvoke?.seal;
  if (!seal) return null;
  const blocked = pourReason(battle), broken = seal.stunned > 0;
  return <div className="keru-seal" data-broken={broken || undefined} role="group" aria-label={broken ? `Seal broken · ${seal.stunned} turns` : `Seal ${seal.poured} of ${seal.threshold} AP this turn`}>
    <span className="keru-seal__label">{broken ? `Seal broken · ${seal.stunned}` : `Seal ${seal.poured}/${seal.threshold}`}</span>
    <span className="keru-seal__bar" aria-hidden="true"><i style={{ width: `${broken ? 100 : Math.min(100, seal.poured / seal.threshold * 100)}%` }} /></span>
    {!broken && <button type="button" className="keru-seal__pour" disabled={Boolean(blocked)} title={blocked ?? 'Pour 1 Hero AP into the seal. Reach the threshold this turn to break it.'} onClick={onPour}>Pour 1 AP</button>}
  </div>;
}

const keruName = (keru: string) => keru[0].toUpperCase() + keru.slice(1);
/** Badge pitch in the stack row: a 44px buff icon plus its 4px gap. */
const BADGE = 44, BADGE_GAP = 4;

/**
 * Keru stacking (1010–1011): Hero's Keru badges oldest first (each is also a drop target that replaces
 * that Keru), a glowing link under each synergy pair, her load meter (one pip per load, tinted by the
 * tier of the Keru using it) and a named chip per active synergy.
 */
function KeruStack({ battle, actor, face }: { battle: BattleState; actor: BattleActor; face: (keru: string) => ReactNode }) {
  const order = harnessOrder(battle), kit = battle.keruInvoke?.kit ?? 'rarity', cap = loadCap(battle), used = heroLoad(battle);
  const synergies = activeSynergies(actor.harness), tierOf = (keru: InvokeKeruId) => (actor.harness?.[keru] ?? 0) as RarityTier, hold = useLongPress(), open = useKeruJumbo(battle);
  const pips = order.flatMap(keru => Array.from({ length: keruLoad(tierOf(keru)) }, () => tierOf(keru)));
  const centre = (keru: InvokeKeruId) => order.indexOf(keru) * (BADGE + BADGE_GAP) + BADGE / 2;
  const width = Math.max(1, order.length) * (BADGE + BADGE_GAP) - BADGE_GAP;
  return <span className="keru-stack" data-fx={useRarityFx()} role="group" aria-label={`Keru on Hero · load ${used} of ${cap}`}>
    {order.length > 0 && <span className="keru-stack__badges" style={{ width }}>
      {synergies.length > 0 && <svg className="keru-stack__links" width={width} height={BADGE + 14} viewBox={`0 0 ${width} ${BADGE + 14}`} aria-hidden="true">
        {synergies.map((synergy, i) => { const [a, b] = synergy.pair.map(centre).sort((x, y) => x - y), dip = BADGE + 4 + i * 4;
          return <path key={synergy.id} data-synergy={synergy.id} d={`M ${a} ${BADGE - 6} Q ${(a + b) / 2} ${dip + (b - a) / 6} ${b} ${BADGE - 6}`} />; })}
      </svg>}
      {order.map(keru => { const tier = tierOf(keru), linked = synergies.filter(synergy => synergy.pair.includes(keru)).map(synergy => synergy.id).join(' ');
        return <button key={keru} type="button" className="battle-buff-icon battle-invoke-badge keru-harness__slot" data-buff="keru-invoke" data-invoked-keru={keru} data-replace-keru={keru}
          data-rarity={rarityKey(tier)} data-synergy={linked || undefined} aria-label={`${keruName(keru)} on Hero · ${rarityName(tier)} · load ${keruLoad(tier)}`}
          data-game-tooltip={`${rarityName(tier)} ${keruName(keru)} on Hero (load ${keruLoad(tier)}): ${rarityBuffText(keru, tier, kit)}${actor.keruWard && keru === 'dem' ? ' Ward ready.' : ''} Drop another Keru card here to replace it. Hold for its card.`} {...hold(() => open(keru))}>{face(keru)}</button>; })}
    </span>}
    <span className="keru-load" role="img" aria-label={`Load ${used} of ${cap}`} data-game-tooltip={`Load ${used} of ${cap}. Each Keru on Hero uses load equal to its rarity: Common 1, Rare 2, Epic 3, Legendary 4.`}>
      <span className="keru-load__pips" aria-hidden="true">{Array.from({ length: cap }, (_, i) => <i key={i} data-rarity={pips[i] !== undefined ? rarityKey(pips[i]) : undefined} />)}</span>
      <b>{used}/{cap}</b>
    </span>
    {synergies.map(synergy => <button key={synergy.id} type="button" className="keru-synergy-chip" data-synergy={synergy.id} aria-label={synergyText(synergy.id, actor.harness)}
      data-game-tooltip={`${synergyText(synergy.id, actor.harness)}${synergy.id === 'fortress' && actor.keruWard ? ' Ward ready.' : ''}`}>{synergy.name}</button>)}
  </span>;
}

/** The newest 1012 farewell for a short flourish (1.4s), or null. */
function useFarewell(battle: BattleState): Farewell | null {
  const farewells = battle.keruInvoke?.farewells, latest = farewells?.[farewells.length - 1], [shown, setShown] = useState<Farewell | null>(null), seen = useRef(latest?.serial ?? 0);
  useEffect(() => {
    if (!latest || latest.serial <= seen.current) return;
    seen.current = latest.serial; setShown(latest);
    const timer = window.setTimeout(() => setShown(current => current?.serial === latest.serial ? null : current), 1400);
    return () => window.clearTimeout(timer);
  }, [latest]);
  return shown;
}

/** 1012: the farewell flourish over the enemy a Cir bolt or Mochi stagger landed on. */
export function KeruFarewellFoeFx({ battle, foeId }: { battle: BattleState; foeId: string }) {
  const farewell = useFarewell(battle), fx = useRarityFx();
  if (!farewell || farewell.foeId !== foeId) return null;
  return <span key={farewell.serial} className="keru-farewell-foe" data-keru={farewell.keru} data-fx={fx} role="status">{farewell.keru === 'cir' ? `🔥 ${4 * (farewell.tier + 1)}` : `💫 +${2 * (farewell.tier + 1)}`}</span>;
}

/**
 * 1012 Keru Upkeep: Hero's Keru badges oldest first, each with its upkeep and a
 * red pulse when this turn's AP won't pay it, plus the farewell buffs left by
 * dismissed Keru. Drag a badge off Hero (or tap it and choose Dismiss) to
 * dismiss it; its farewell plays over the badge row.
 */
function KeruUpkeepBadges({ battle, actor, face, onDismiss }: { battle: BattleState; actor: BattleActor; face: (keru: string) => ReactNode; onDismiss?: (keru: InvokeKeruId) => void }) {
  const order = harnessOrder(battle), plan = upkeepPlan(battle), kit = battle.keruInvoke?.kit ?? 'upkeep', fx = useRarityFx(), farewell = useFarewell(battle);
  const [open, setOpen] = useState<InvokeKeruId | null>(null);
  const [drag, setDrag] = useState<{ keru: InvokeKeruId; pointer: number; x: number; y: number; startX: number; startY: number; moved: boolean; off: boolean; home: DOMRect } | null>(null);
  const dragged = useRef(false), hold = useLongPress(), openJumbo = useKeruJumbo(battle);
  const tierOf = (keru: InvokeKeruId) => (actor.harness?.[keru] ?? 0) as RarityTier;
  const canDismiss = (keru: InvokeKeruId) => Boolean(onDismiss) && !dismissReason(battle, keru);
  const dismiss = (keru: InvokeKeruId) => { setOpen(null); onDismiss?.(keru); };
  const turns = (n: number) => `${n} enemy turn${n === 1 ? '' : 's'}`;
  return <span className="keru-stack keru-upkeep" data-fx={fx} role="group" aria-label={`Keru on Hero · upkeep ${plan.total} AP at the end of the turn${plan.starved.length ? ` · ${plan.starved.length} unpaid` : ''}`}>
    {order.length > 0 && <span className="keru-stack__badges">
      {order.map(keru => { const tier = tierOf(keru), starving = plan.starved.includes(keru), cost = upkeepOf(battle, keru);
        // A hold opens the card's jumbo and drops any drag in progress, so it never dismisses.
        const held = hold(() => { setDrag(null); setOpen(null); openJumbo(keru); });
        return <span key={keru} className="keru-upkeep__slot">
          <button type="button" className="battle-buff-icon battle-invoke-badge keru-harness__slot" data-buff="keru-invoke" data-invoked-keru={keru} data-rarity={rarityKey(tier)} data-starving={starving || undefined} data-dragging={drag?.keru === keru && drag.moved || undefined}
            aria-label={`${keruName(keru)} on Hero · ${rarityName(tier)} · upkeep ${cost} AP${starving ? ' · won’t be paid this turn' : ''} · tap for details`} aria-expanded={open === keru}
            data-game-tooltip={open === keru ? undefined : `${rarityName(tier)} ${keruName(keru)} on Hero: ${rarityBuffText(keru, tier, kit)} Upkeep ${cost} AP at the end of each party turn${starving ? ' (Hero can’t pay it this turn, so it will be dismissed)' : ''}. ${farewellText(keru, tier)} Drag it off Hero or tap to dismiss. Hold for its card.`}
            onClickCapture={held.onClickCapture} onContextMenu={held.onContextMenu}
            onPointerDown={event => { held.onPointerDown(event); if (event.button !== 0 || !canDismiss(keru)) return; dragged.current = false; event.currentTarget.setPointerCapture(event.pointerId);
              setDrag({ keru, pointer: event.pointerId, x: event.clientX, y: event.clientY, startX: event.clientX, startY: event.clientY, moved: false, off: false, home: (event.currentTarget.closest('[data-battle-slot]') ?? event.currentTarget).getBoundingClientRect() }); }}
            onPointerMove={event => { held.onPointerMove(event); if (drag?.pointer !== event.pointerId) return; const moved = drag.moved || Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) > 10, h = drag.home;
              setDrag({ ...drag, x: event.clientX, y: event.clientY, moved, off: moved && (event.clientX < h.left || event.clientX > h.right || event.clientY < h.top || event.clientY > h.bottom) }); }}
            onPointerUp={event => { held.onPointerUp(); if (drag?.pointer !== event.pointerId) return; const { moved, off } = drag; setDrag(null); if (moved) dragged.current = true; if (moved && off) dismiss(keru); }}
            onPointerCancel={() => { held.onPointerCancel(); setDrag(null); }}
            onClick={() => { if (dragged.current) { dragged.current = false; return; } setOpen(current => current === keru ? null : keru); }}>
            {face(keru)}<span className="keru-upkeep__cost" aria-hidden="true">{cost}</span>
          </button>
          {open === keru && <span className="keru-upkeep__details" role="dialog" aria-label={`${keruName(keru)} details`}>
            <b>{rarityName(tier)} {keruName(keru)} · upkeep {cost} AP</b>
            <span>{rarityBuffText(keru, tier, kit)}</span>
            <span>{farewellText(keru, tier)}</span>
            {starving && <span className="keru-upkeep__warn">Hero can’t pay this upkeep now: it will be dismissed as the turn ends.</span>}
            <span className="keru-upkeep__actions">
              <button type="button" disabled={!canDismiss(keru)} title={dismissReason(battle, keru) ?? 'Free. Back to the hand with its tier and value.'} onClick={() => dismiss(keru)}>Dismiss</button>
              <button type="button" onClick={() => setOpen(null)}>Close</button>
            </span>
          </span>}
        </span>; })}
    </span>}
    {(actor.farewellWard ?? 0) > 0 && <button type="button" className="battle-buff-icon keru-farewell-buff" data-buff="farewell-ward" aria-label={`Dem’s farewell Ward · ${turns(actor.farewellWard!)} left`}
      data-game-tooltip={`Dem’s farewell Ward: absorbs the next enemy hit. ${turns(actor.farewellWard!)} left. Hold for Dem’s card.`}
      {...hold(() => openJumbo('dem', `Dem’s farewell Ward is on Hero: it absorbs the next enemy hit. ${turns(actor.farewellWard!)} left.`))}>🛡️<small>{actor.farewellWard}</small></button>}
    {(actor.farewellHalve ?? 0) > 0 && <button type="button" className="battle-buff-icon keru-farewell-buff" data-buff="farewell-halve" aria-label={`Banks’ farewell · damage halved · ${turns(actor.farewellHalve!)} left`}
      data-game-tooltip={`Banks’ farewell: incoming damage is halved. ${turns(actor.farewellHalve!)} left. Hold for Banks’ card.`}
      {...hold(() => openJumbo('banks', `Banks’ farewell is on Hero: incoming damage is halved. ${turns(actor.farewellHalve!)} left.`))}>½<small>{actor.farewellHalve}</small></button>}
    {farewell && <span key={farewell.serial} className="keru-farewell-toast" data-keru={farewell.keru} role="status">{keruName(farewell.keru)} farewell{farewell.starved ? ' (starved)' : ''} · {farewell.text.replace(/^Farewell: /, '')}</span>}
    {drag?.moved && <span className="keru-upkeep__ghost" data-off={drag.off || undefined} aria-hidden="true" style={{ left: drag.x, top: drag.y }}>{face(drag.keru)}<small>{drag.off ? 'Release to dismiss' : 'Drag off Hero'}</small></span>}
  </span>;
}

/** A Keru invoke card's rules text: what it does while on Hero. */
export const keruCardText = (battle: BattleState, keru: InvokeKeruId) =>
  `While invoked: ${hasRarity(battle) ? rarityBuffText(keru, keruTier(battle, keru), battle.keruInvoke!.kit) : INVOKE_BUFFS[keru].text}`;

/** Shared art for hand cards, held cards, badges' inspection and jumbo views. */
export const keruCardArt = (keru: InvokeKeruId, name = keruName(keru)) => keru === 'dem' ? <KeruAbilityArt subject={demSubject} background={demBackground} label="Dem" />
  : keru === 'cir' ? <KeruAbilityArt subject={CIR_ART} label="Cir" /> : keru === 'banks' ? <KeruAbilityArt subject={`${import.meta.env.BASE_URL}assets/runtime/characters/banks/banks-keru-subject-watercolor-v3.png`} label="Banks" /> : keru === 'riv' ? <KeruAbilityArt subject={`${import.meta.env.BASE_URL}assets/runtime/keru/riv/riv-watercolor-v2.png`} label="Riv" />
  : <span className="ability-status-art"><ActorCardArt sprite={ACTOR_HOLO_ART[keru] ?? ACTOR_HOLO_ART.hero} label={name} /></span>;

/** The Keru invoke card face (hand, drag clone and jumbo): art in its tier frame, value chip, cost and rules text. */
export function KeruCardFace({ battle, keru, state = 'compact', cost = invokeCost(battle, keru), status, animated = true, target }: { battle: BattleState; keru: InvokeKeruId; state?: 'compact' | 'jumbo'; cost?: number; status?: string; animated?: boolean; target?: string | null }) {
  const rarity = hasRarity(battle), tier = keruTier(battle, keru), value = battle.keruInvoke?.values[keru], name = keruName(keru), text = keruCardText(battle, keru);
  return <AbilityCardFace animated={animated} id={'familiar-' + keru} title={<span data-ability-name data-combat-inspect={`${name} · ${cost} AP. ${text}`}>{name}</span>} state={state}
    art={<>{rarity ? <RarityArt tier={tier}>{keruCardArt(keru, name)}</RarityArt> : keruCardArt(keru, name)}{hasCasts(battle) && <div className="keru-deck-descriptions" aria-label={`${name} abilities`}>{(!['1012', '111', '100', '101', '102', '103', '104', '105'].includes(battle.sandboxScenario ?? '')) && (!target || !target.startsWith('familiar-square:')) && <div className="keru-deck-description" data-description="cast"><b>Cast</b><span>{castText(keru,tier)}</span></div>}{(!target || target.startsWith('familiar-square:') || (['1012', '111', '100', '101', '102', '103', '104', '105'].includes(battle.sandboxScenario ?? '')) && target==='hero') && <div className="keru-deck-description" data-description="familiar"><b>Familiarize</b><span>{text.replace(/^While invoked:\s*/, '')}</span></div>}</div>}</>} description={text}
    cornerAdornment={value !== undefined ? <span className="ability-fan__stored-value" role="img" aria-label={`Stored value ${rankLabel(value)}`}>{rankLabel(value)}</span> : undefined}
    headerAction={<AbilityCostBubble cost={cost}/>}
    footer={rarity ? <span className="ability-fan__actor keru-rarity-footer"><RarityProgress battle={battle} keru={keru} />{status && <span> · {status}</span>}</span> : status ? <span className="ability-fan__actor">{status}</span> : undefined} />;
}

/**
 * The jumbo view of a Keru card. In 1012 a panel beside it lists every tier
 * (buff on Hero, upkeep, farewell and the feed to reach it) with the current
 * tier highlighted, plus the stored value and any dismissal cooldown; elsewhere
 * the panel only appears to carry a note (a farewell buff's turns left).
 */
export function KeruJumboCard({ battle, keru, face, fx, note }: { battle: BattleState; keru: InvokeKeruId; face: ReactNode; fx: 'low' | 'high'; note?: string }) {
  const rarity = hasRarity(battle), tier = keruTier(battle, keru), ladder = Boolean(battle.keruInvoke?.upkeep);
  const kit = battle.keruInvoke?.kit ?? 'rarity', need = feedNeeded(battle, keru), fed = keruFed(battle, keru), cooldown = keruCooldown(battle, keru), value = battle.keruInvoke?.values[keru];
  const casts = hasCasts(battle), exhausted = isExhausted(battle, keru), feedWhy = rarity ? feedReason(battle, keru) : null;
  return <>
    <div className={rarity ? 'ability-jumbo keru-rarity-card' : 'ability-jumbo'} data-rarity={rarity ? rarityKey(tier) : undefined} data-exhausted={exhausted || undefined} data-fx={fx}>{face}</div>
    {(ladder || note || casts) && <aside className="keru-jumbo-panel" aria-label={`${keruName(keru)} details`}>
      {note && <p className="keru-jumbo-panel__note">{note}</p>}
      {casts && <p className="keru-jumbo-panel__cast" data-rarity={rarityKey(tier)} data-exhausted={exhausted || undefined}>{exhausted ? <><b>{(['1012', '111', '100', '101', '102', '103', '104', '105'].includes(battle.sandboxScenario ?? ''))?'Discarded':'Exhausted'}</b> {keruName(keru)} has cast {KERU_CASTS[keru].name} and cannot invoke, feed or cast again this battle.</>
        : <><b>Cast · {KERU_CASTS[keru].name}</b> {castText(keru, tier)} Free; {(['1012', '111', '100', '101', '102', '103', '104', '105'].includes(battle.sandboxScenario ?? ''))?'discard':'exhaust'} {keruName(keru)} for the battle.{castReason(battle, keru) ? ` Now: ${castReason(battle, keru)}.` : ''}</>}</p>}
      {rarity && !exhausted && feedWhy && <p className="keru-jumbo-panel__facts">Feed: {feedWhy}</p>}
      {ladder && <>
        <p className="keru-jumbo-panel__facts">
          {value !== undefined && <span>Value <b>{rankLabel(value)}</b></span>}
          {cooldown > 0 && <span className="keru-jumbo-panel__cooldown">⏳ Back in {cooldown} turn{cooldown === 1 ? '' : 's'}</span>}
        </p>
        <ol className="keru-tier-ladder">
          {RARITY_TIERS.map((key, index) => { const t = index as RarityTier, current = t === tier, next = t === tier + 1;
            return <li key={key} data-rarity={key} data-current={current || undefined} data-reached={t < tier || undefined} aria-current={current ? 'step' : undefined}>
              <span className="keru-tier-ladder__head"><b>{rarityName(t)}</b>
                <span>{t === 0 ? 'Starting tier' : `Feed ${FEED_COSTS[t - 1]} AP${t > 1 ? ' more' : ''}`}</span>
                {current && <em>Current</em>}
              </span>
              {next && need > 0 && <span className="keru-tier-ladder__progress" role="img" aria-label={`${fed} of ${need} AP fed toward ${rarityName(t)}`}>
                {Array.from({ length: need }, (_, i) => <i key={i} data-on={i < fed || undefined} />)}<span>{fed}/{need}</span>
              </span>}
              <span>On Hero: {rarityBuffText(keru, t, kit)}</span>
              <span>Upkeep {keruUpkeep(t)} AP per turn</span>
              <span>{farewellText(keru, t)}</span>
              {casts && <span className="keru-tier-ladder__cast">Cast: {castText(keru, t)}</span>}
            </li>; })}
        </ol>
      </>}
    </aside>}
  </>;
}

/**
 * The jumbo's explicit Keru actions, so a tap never feeds or casts by mistake: Feed to next tier (when
 * Hero can pay all of it), Feed 1 AP, and (1006, 1012) Cast, which then asks for a target.
 */
export function useKeruJumboActions(battle: BattleState) {
  const board = useKeruBoard();
  return (keru: InvokeKeruId) => !board ? [] : keruJumboActions(battle, keru).map(({ kind, label }) => ({ label, run: () => kind === 'cast' ? board.armCast(keru) : board.feed(keru, kind) }));
}

/** Opens a Keru card in the shared jumbo view, with its feed and cast actions (invoke and dismiss stay with the hand and badges). */
export function useKeruJumbo(battle: BattleState, onDismiss?: (keru: InvokeKeruId) => void) {
  const jumbo = useCardJumbo(), fx = useRarityFx(), actionsFor = useKeruJumboActions(battle);
  return (keru: InvokeKeruId, note?: string) => { const actions = [...actionsFor(keru), ...(onDismiss && harnessOrder(battle).includes(keru) && !dismissReason(battle,keru) ? [{label:'Dismiss familiar',run:()=>onDismiss(keru)}] : [])]; return jumbo?.open({ title: keruName(keru), ...(actions.length ? { actions } : {}),
    content: <KeruJumboCard battle={battle} keru={keru} fx={fx} note={note} face={<KeruCardFace battle={battle} keru={keru} state="jumbo" status={harnessOrder(battle).includes(keru) ? 'On Hero' : undefined} />} /> }); };
}

/** Press-and-hold time and the movement that cancels it (so drags still work). */
export const LONG_PRESS_MS = 450, LONG_PRESS_SLOP = 6;
/**
 * Long-press with touch or mouse: holding ~450ms without moving more than a few
 * px runs `onHold`, then swallows the click that follows so a hold never feeds,
 * invokes or dismisses. Spread `hold(onHold)` onto the element, or call its
 * handlers from the element's own.
 */
export function useLongPress(duration = LONG_PRESS_MS) {
  const press = useRef<{ pointer: number; x: number; y: number; timer: number } | null>(null), fired = useRef(false);
  const releaseGuard=useRef<(()=>void)|null>(null);
  const cancel = () => { if (press.current) window.clearTimeout(press.current.timer); press.current = null; };
  useEffect(() => ()=>{cancel();releaseGuard.current?.();}, []);
  return (onHold: () => void) => ({
    onPointerDown: (event: ReactPointerEvent<HTMLElement>) => {
      if (event.button !== 0) return;
      cancel(); fired.current = false;
      const node = event.currentTarget, pending = { pointer: event.pointerId, x: event.clientX, y: event.clientY, timer: 0 };
      pending.timer = window.setTimeout(() => {
        if (press.current !== pending) return;
        press.current = null; fired.current = true;
        // A touch release can click the newly opened modal's backdrop instead
        // of this badge. Catch that gesture's tail before it closes the jumbo.
        releaseGuard.current?.();
        let expiry=0;
        const cleanup=()=>{window.clearTimeout(expiry);window.removeEventListener('click',swallow,true);window.removeEventListener('pointerup',released,true);releaseGuard.current=null;};
        const swallow=(click:MouseEvent)=>{if(click.detail===0 && !('pointerType' in click && click.pointerType==='touch'))return;click.preventDefault();click.stopImmediatePropagation();cleanup();};
        const released=(up:PointerEvent)=>{if(up.pointerId===pending.pointer){window.clearTimeout(expiry);expiry=window.setTimeout(cleanup,250);}};
        window.addEventListener('click',swallow,true);window.addEventListener('pointerup',released,true);
        expiry=window.setTimeout(cleanup,1500);releaseGuard.current=cleanup;
        if (node.hasPointerCapture(pending.pointer)) node.releasePointerCapture(pending.pointer);
        onHold();
      }, duration);
      press.current = pending;
    },
    onPointerMove: (event: ReactPointerEvent<HTMLElement>) => { const pending = press.current; if (pending?.pointer === event.pointerId && Math.hypot(event.clientX - pending.x, event.clientY - pending.y) > LONG_PRESS_SLOP) cancel(); },
    onPointerUp: cancel, onPointerCancel: cancel,
    // Keyboard clicks (detail 0) are never a hold's tail.
    onClickCapture: (event: ReactMouseEvent<HTMLElement>) => { if (!fired.current) return; fired.current = false; if (event.detail === 0) return; event.preventDefault(); event.stopPropagation(); },
    onContextMenu: (event: ReactMouseEvent<HTMLElement>) => event.preventDefault(),
  });
}

/**
 * Keru scenarios (1005–1012): each Keru on Hero also sits in a familiar square beside her
 * foundation, oldest first down the left column, then the right. A square shows the card art in
 * its tier frame and foil, its stored value, (1012) its upkeep and (1006, 1012) its cast gem. Hero's AP
 * meter pours into it while held over it (`data-keru-square`, KeruPourCast), a tap or hold opens its card, and in 1012 dragging it off Hero's
 * slot and squares dismisses it. The columns grow past two rows when more Keru are on Hero, and
 * stay within the foundation's height.
 */
export function KeruSquares({ battle, actor, onDismiss }: { battle: BattleState; actor: BattleActor; onDismiss?: (keru: InvokeKeruId) => void }) {
  const order = harnessOrder(battle), rows = Math.max(battle.expeditionKeru ? 1 : 2, Math.ceil(order.length / 2)), rarity = hasRarity(battle), upkeep = Boolean(battle.keruInvoke?.upkeep);
  const plan = upkeep ? upkeepPlan(battle) : null, hold = useLongPress((['1012', '111', '100', '101', '102', '103', '104', '105'].includes(battle.sandboxScenario ?? '')) ? 2000 : LONG_PRESS_MS), openJumbo = useKeruJumbo(battle, onDismiss), fx = useRarityFx(), tierUps = useTierUps(battle);
  const board = useKeruBoard();
  const [spell, setSpell] = useState<InvokeKeruId | null>(null), [holding, setHolding] = useState<InvokeKeruId | null>(null);
  const [drag, setDrag] = useState<{ keru: InvokeKeruId; pointer: number; x: number; y: number; startX: number; startY: number; moved: boolean; off: boolean; home: DOMRect[] } | null>(null);
  const dragged = useRef(false);
  const tierOf = (keru: InvokeKeruId) => (actor.harness?.[keru] ?? 0) as RarityTier;
  const canDismiss = (keru: InvokeKeruId) => upkeep && Boolean(onDismiss) && !dismissReason(battle, keru);
  const square = (keru: InvokeKeruId) => {
    const tier = tierOf(keru), value = battle.keruInvoke?.values[keru], cost = upkeep ? upkeepOf(battle, keru) : null, starving = plan?.starved.includes(keru) ?? false;
    const held = hold(() => { setHolding(null); setSpell(null); setDrag(null); openJumbo(keru); });
    const face = <button key={keru} type="button" className="keru-square" data-keru-square={keru} data-rarity={rarity ? rarityKey(tier) : undefined} data-starving={starving || undefined} data-dragging={drag?.keru === keru && drag.moved || undefined} data-evolving={tierUps[keru] || undefined}
      aria-label={`${keruName(keru)} in a familiar square${rarity ? ` · ${rarityName(tier)}` : ''}${value !== undefined ? ` · value ${rankLabel(value)}` : ''}${cost !== null ? ` · upkeep ${cost} AP` : ''}${starving ? ' · won’t be paid this turn' : ''} · tap or hold for its card`}
      data-game-tooltip={`${rarity ? rarityName(tier) + ' ' : ''}${keruName(keru)} on Hero. Drag from Hero’s AP meter and hold here to pour AP in.${cost !== null ? ` Upkeep ${cost} AP each party turn. Drag it off Hero to dismiss it.` : ''} Tap or hold for its card.`}
      onClickCapture={held.onClickCapture} onContextMenu={held.onContextMenu}
      onPointerDown={event => { held.onPointerDown(event); if ((['1012', '111', '100', '101', '102', '103', '104', '105'].includes(battle.sandboxScenario ?? '')) && event.button===0) setHolding(keru); if (event.button !== 0 || !canDismiss(keru)) return; dragged.current = false; event.currentTarget.setPointerCapture(event.pointerId);
        const slot = event.currentTarget.closest('[data-battle-slot]'), home = slot ? [slot, ...Array.from(slot.querySelectorAll('.keru-squares'))].map(node => node.getBoundingClientRect()) : [event.currentTarget.getBoundingClientRect()];
        setDrag({ keru, pointer: event.pointerId, x: event.clientX, y: event.clientY, startX: event.clientX, startY: event.clientY, moved: false, off: false, home }); }}
      onPointerMove={event => { held.onPointerMove(event); if (drag && Math.hypot(event.clientX-drag.startX,event.clientY-drag.startY)>10) setHolding(null); if (drag?.pointer !== event.pointerId) return; const moved = drag.moved || Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) > 10;
        setDrag({ ...drag, x: event.clientX, y: event.clientY, moved, off: moved && !drag.home.some(h => event.clientX >= h.left && event.clientX <= h.right && event.clientY >= h.top && event.clientY <= h.bottom) }); }}
      onPointerUp={event => { held.onPointerUp(); setHolding(null); if (drag?.pointer !== event.pointerId) return; const { moved, off } = drag; setDrag(null); if (moved) dragged.current = true; if (moved && off) onDismiss?.(keru); }}
      onPointerCancel={() => { held.onPointerCancel(); setHolding(null); setDrag(null); }}
      onClick={() => { if (dragged.current) { dragged.current = false; return; } if ((['1012', '111', '100', '101', '102', '103', '104', '105'].includes(battle.sandboxScenario ?? ''))) setSpell(current => current===keru ? null : keru); else openJumbo(keru); }}>
      {holding===keru && <span className="keru-hold-progress" aria-hidden="true"/>}
      {(['1012', '111', '100', '101', '102', '103', '104', '105'].includes(battle.sandboxScenario ?? '')) ? keru==='dem'||keru==='cir' ? <KeruExpression keru={keru} emotion="fighting" label={keruName(keru)}/> : keru==='mochi' ? <MochiEmoji emotion="upset" label="Mochi"/> : keru==='banks' ? <BanksEmoji emotion="fighting" label="Banks"/> : <img className="keru-mini-foundation__riv" src={`${import.meta.env.BASE_URL}assets/runtime/keru/riv/riv-watercolor-v2.png`} alt="Riv"/> : rarity ? <RarityArt tier={tier}>{keruCardArt(keru)}</RarityArt> : keruCardArt(keru)}
      {(!['1012', '111', '100', '101', '102', '103', '104', '105'].includes(battle.sandboxScenario ?? '')) && value !== undefined && <span className="keru-square__value" aria-hidden="true">{rankLabel(value)}</span>}
      {(!['1012', '111', '100', '101', '102', '103', '104', '105'].includes(battle.sandboxScenario ?? '')) && cost !== null && <span className="keru-square__upkeep" aria-hidden="true">↻{cost}</span>}
      {(!['1012', '111', '100', '101', '102', '103', '104', '105'].includes(battle.sandboxScenario ?? '')) && <KeruCastGem battle={battle} keru={keru} />}
    </button>;
    return (['1012', '111', '100', '101', '102', '103', '104', '105'].includes(battle.sandboxScenario ?? '')) ? <div key={keru} className="keru-mini-foundation"><div className="keru-mini-foundation__card">{face}<b className="keru-mini-foundation__name">{keruName(keru)}</b>{spell===keru && <span className="keru-mini-foundation__spells"><button type="button" disabled={Boolean(castReason(battle,keru))} onClick={event=>{board?.armCast(keru,event.currentTarget.getBoundingClientRect());setSpell(null);}}>{KERU_CASTS[keru].name}: {castText(keru,tier)}</button></span>}</div><span className="keru-mini-foundation__pips" aria-label="Six empty pips">{Array.from({length:6},(_,i)=><i key={i}/>)}</span></div> : face;
  };
  return <>
    {(['left', 'right'] as const).map((side, s) => <div key={side} className={`foundation-empty-tiles foundation-empty-tiles--${side} keru-squares`} data-fx={fx} style={{ '--keru-rows': rows } as CSSProperties} role="group" aria-label={`${side} familiar squares`}>
      {Array.from({ length: rows }, (_, i) => { const keru = order[s * rows + i]; return keru ? square(keru) : <span key={i} data-empty data-familiar-slot={`${side}-${i}`} data-battle-target={`familiar-square:hero:${side}-${i}`} aria-label="Empty familiar square" role="img" />; })}
    </div>)}
    {drag?.moved && <span className="keru-upkeep__ghost" data-off={drag.off || undefined} aria-hidden="true" style={{ left: drag.x, top: drag.y }}><span className="keru-square__ghost-art">{keruCardArt(drag.keru)}</span><small>{drag.off ? 'Release to dismiss' : 'Drag off Hero'}</small></span>}
  </>;
}

/** 1005's single untiered Keru badge on Hero; long-press for its card. */
export function KeruInvokeBadge({ battle, keru, face }: { battle: BattleState; keru: InvokeKeruId; face: (keru: string) => ReactNode }) {
  const hold = useLongPress(), open = useKeruJumbo(battle);
  return <button type="button" className="battle-buff-icon battle-invoke-badge keru-holdable" data-buff="keru-invoke" data-invoked-keru={keru} aria-label={`${INVOKE_BUFFS[keru].name} invoked · hold for its card`}
    data-game-tooltip={`${INVOKE_BUFFS[keru].name} invoked: ${INVOKE_BUFFS[keru].text} Invoking another Keru replaces it.`} {...hold(() => open(keru))}>{face(keru)}</button>;
}
