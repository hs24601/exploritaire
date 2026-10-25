import { ActorHoloCard } from './ActorHoloCard';
import { gameTime } from '../../gameTime';
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { ABILITIES, MAX_CHARGE, SPIRITS, nextBreakpoint, type Attack } from '../rules/battleAbilities';
import type { AttackPreview, BattleActor, BattleEvent, BattleFoe, Trap } from '../rules/battle';
import { apCap, staggerVulnerability, staggerThreshold } from '../rules/battle';
import type { TutorialIntent } from '../rules/battleTutorials';
import { rankLabel } from '../protoState';
import './BattleUnits.css';
import { HeroEmoji } from './HeroEmoji';
import { MochiEmoji } from './MochiEmoji';
import { BanksEmoji } from './BanksEmoji';
import { ACTOR_HOLO_ART } from '../art/actorCardArt';

const pct = (value: number, max: number) => `${Math.max(0, Math.min(100, (value / max) * 100))}%`;
const EFFECT_ICON = { burn: '🔥', bleed: '🩸', stun:'Stunned ', grip:'Held ', exposed:'Exposed ' } as const;

/**
 * A bar with an optional preview segment between `value` and `preview`: a loss
 * (HP, timer knocked back) shows as a fading band, a gain (stagger) as a
 * bright band.
 */
function Bar({ kind, value, max, preview, label, children }: {
  kind: 'hp' | 'stagger' | 'timer'; value: number; max: number; preview?: number; label: string; children?: ReactNode;
}) {
  const shown = preview ?? value;
  const low = Math.min(value, shown), high = Math.max(value, shown);
  return <span className="battle-bar" data-bar={kind} role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={max} aria-valuenow={Math.round(value)}>
    <span className="battle-bar__fill" style={{ width: pct(low, max) }} />
    {preview !== undefined && high > low && <span className="battle-bar__preview" data-direction={shown < value ? 'loss' : 'gain'}
      style={{ left: pct(low, max), width: pct(high - low, max) }} />}
    {children && <span className="battle-bar__text">{children}</span>}
  </span>;
}

/** Floating numbers for fresh events on one unit. */
function useFloaters(events: readonly BattleEvent[], unitId: string) {
  const seen = useRef(events[events.length - 1]?.id ?? 0);
  const timers=useRef(new Set<ReturnType<typeof gameTime.setTimeout>>());
  const [floaters, setFloaters] = useState<BattleEvent[]>([]);
  useEffect(()=>()=>{timers.current.forEach(timer=>gameTime.clearTimeout(timer));},[]);
  useEffect(() => {
    if(!events.length){
      seen.current=0;timers.current.forEach(timer=>gameTime.clearTimeout(timer));timers.current.clear();
      setFloaters(current=>current.length?[]:current);return;
    }
    const fresh = events.filter((event) => event.id > seen.current);
    if (!fresh.length) return;
    seen.current = fresh[fresh.length - 1]!.id;
    const mine = fresh.filter((event) => event.targetId === unitId && (event.amount || ['stagger', 'ko', 'down', 'take', 'snatch'].includes(event.kind)));
    if (!mine.length) return;
    setFloaters((current) => [...current, ...mine].slice(-6));
    const timer = gameTime.setTimeout(() => {setFloaters((current) => current.filter((event) => !mine.includes(event)));timers.current.delete(timer);}, 1100);
    timers.current.add(timer);
  }, [events, unitId]);
  return floaters;
}

function Floaters({ events, unitId }: { events: readonly BattleEvent[]; unitId: string }) {
  const floaters = useFloaters(events, unitId);
  return <span className="battle-floaters" aria-hidden="true">
    {floaters.map((event, i) => <span key={event.id} className="battle-floater" data-kind={event.kind} style={{ '--i': i % 3 } as CSSProperties}>
      {event.kind === 'stagger' ? 'BREAK!' : event.kind === 'ko' ? 'KO' : event.kind === 'down' ? 'DOWN' : event.kind === 'take' ? `ate ${rankLabel(Number(event.label))}`
        : event.kind === 'snatch' ? 'Snatch +1' : event.kind === 'trap' ? `Trap -${event.amount}` : `-${event.amount}`}
    </span>)}
  </span>;
}

export function FoeCard({ foe, target, targetId, preview, focus, events, sprite, aiming, interaction, targeters, enemyTurn, duskwoodBark = false, statusIcons, tutorialIntent }: {
  duskwoodBark?: boolean;
  /** Tutorial statuses and enemy Momentum, shown in the buff row. */
  statusIcons?: ReactNode;
  /** Tutorial intent copy (Heavy Strike, skips). */
  tutorialIntent?: TutorialIntent | null;
  enemyTurn?: boolean;
  targeters?: { id: string; name: string }[];
  foe: BattleFoe;
  /** Who this foe's next attack will hit. */
  target: string | null;
  targetId?: string;
  preview: AttackPreview | null;
  /** The held ability is over this foe. */
  focus: boolean;
  events: readonly BattleEvent[];
  sprite: ReactNode;
  /** An ability is held or armed, so living foes take it. */
  aiming: boolean;
  interaction: Record<string, unknown>;
}) {
  const alive = foe.hp > 0, staggered = foe.staggered > 0;
  const barkName = duskwoodBark ? 'Duskwood Bark' : 'Ironbark';
  const show = focus ? preview : null;
  const state = !alive ? 'down' : staggered ? 'staggered' : 'ready';
  const doom=foe.gallows!==undefined;
  const intent = doom ? (foe.gallows===0?'The Gallows Bloom · Spent':`The Gallows Bloom · All allies · ${foe.gallows} handoffs`) : foe.disarmed ? 'Rearm · Take lowest exposed card' : foe.intentHidden ? 'Intent hidden' : foe.intent==='tableau' ? 'Play tableau · Gain Indominable' : foe.intent==='idle' ? 'Dormant · No attacks' : foe.intent==='withdraw' ? 'Withdraw · Redeal tableau' : `Strike ${foe.profile.damage+foe.fed} → ${target ?? '—'}`;
  return <div className="battle-enemy-unit">
    {alive && foe.emberPhase && <button type="button" className="battle-buff-icon" data-buff="ember-phase" aria-label={foe.emberPhase===1?'Counterflame':foe.emberPhase===2?'Khad Armor':'Indomitable Thorns'} data-ember-phase={foe.emberPhase} data-game-tooltip={
      foe.emberPhase===1?`I · Counterflame ${foe.counterflames ?? 0}/3 · Bind Cir to Hero; only Hearthflame counters advance. Cannot be staggered. Strikes Hero.`:
       foe.emberPhase===2?'II · Khad Armor · Recall Cir and bind to Mochi. Only Ember Claws fire damages armor.':
       'III · Indomitable Thorns · Cannot be staggered. Hits below 5 do no damage. Recall Cir and invoke Meteor.'}>{foe.emberPhase===1?'🔥':foe.emberPhase===2?'🛡':'🌵'}
    </button>}
    {alive && foe.gallows!==undefined && <div className="battle-enemy-buffs"><button type="button" className="battle-buff-icon" data-buff="gallows-bloom" aria-label={`The Gallows Bloom · ${foe.gallows} handoffs`} data-game-tooltip={`The Gallows Bloom: ${foe.gallows} handoffs until a fatal attack against every ally. Sealed Heartwood blocks damage, stagger and theft.`}>🌳</button></div>}
    {alive && (foe.indominable!==undefined || Boolean(foe.thorns) || foe.ironbark || staggered || foe.disarmed || foe.fed>0 || foe.effects.length>0 || Boolean(statusIcons)) && <div className="battle-enemy-buffs" role="group" aria-label={`${foe.name} statuses`}>
      {statusIcons}
      {foe.indominable!==undefined && <button type="button" className="battle-buff-icon" data-buff="indominable" aria-label={`Indominable · ${foe.indominable} stacks`} data-game-tooltip={`Indominable: ${foe.indominable} stacks. Gains one stack per successful tableau play on its turn. Above 25 stacks, deals 1 damage per stack above 25 (26 stacks = 1 damage) at the end of its turn to every living party member. Each HP lost removes one stack. The stagger gauge cannot increase while any Indominable stacks remain.`}>∞<span>{foe.indominable}</span></button>}
      {foe.disarmed && <DisarmedBadge name={foe.name} />}
      {foe.fed>0 && <button type="button" className="battle-buff-icon" data-buff="fed" aria-label="Fed" data-game-tooltip={`Fed: the next strike deals ${foe.fed} additional damage.`}>🍖</button>}
      {foe.effects.map(effect=><button key={effect.kind} type="button" className="battle-buff-icon battle-debuff-icon" data-debuff={effect.kind} aria-label={effect.kind} data-game-tooltip={`${effect.kind}: ${Math.ceil(effect.left)} seconds remaining. ${effect.kind==='burn'?'Takes fire damage over time.':effect.kind==='bleed'?'Takes bleeding damage over time.':effect.kind==='stun'?'Cannot act while stunned.':effect.kind==='grip'?'Held in place by Vice Grip.':'Vulnerable to enhanced attacks.'}`}>{({burn:'🔥',bleed:'🩸',stun:'💫',grip:'🪢',exposed:'🎯'} as const)[effect.kind]}</button>)}
      {staggered && <button type="button" className="battle-buff-icon battle-debuff-icon" data-debuff="staggered" aria-label={`Staggered · Stage ${foe.staggerStage ?? 1} · Show debuff details`}
        data-game-tooltip={`Staggered: this enemy is stunned and takes ×${staggerVulnerability(foe)} damage from tableau attacks. ${foe.ironbark?`${barkName} no longer protects it.`:''}${targeters!==undefined?' Gameplay timers run at 10% speed during stagger. Stagger has no countdown in this turn-based trial.':` Stun remaining: ${foe.staggered.toFixed(1)} seconds.`}`}>
        <svg viewBox="0 0 32 32" aria-hidden="true"><ellipse cx="16" cy="18" rx="13" ry="6" fill="none" stroke="#e8b967" strokeWidth="2"/><path d="m7 5 2 4 4 1-4 2-2 4-1-4-4-2 4-1m17 2 2 4 4 1-4 2-2 4-1-4-4-2 4-1M16 19l2 4 4 1-4 2-2 4-1-4-4-2 4-1" fill="#ffe8a5"/></svg>
      </button>}
      {Boolean(foe.thorns) && <button type="button" className="battle-buff-icon" data-buff="thorns" aria-label={`Thorns ${foe.thorns} · Show buff details`}
        data-game-tooltip={`Thorns: each attacker takes ${foe.thorns} damage whenever they attack this enemy, including the killing blow. This is passive reflection, not the enemy’s turn action.`}>
        <svg viewBox="0 0 32 32" aria-hidden="true"><path d="M8 29C18 22 9 13 24 3" fill="none" stroke="#8ab48a" strokeWidth="4"/><path d="M12 23L3 17l10 1M14 15l-4-9 9 4M21 8l7 4-2-10" fill="#e78ca5" stroke="#65384b" strokeLinejoin="round"/></svg>
      </button>}
      {foe.ironbark && !staggered && <button type="button" className="battle-buff-icon" data-buff={duskwoodBark ? 'duskwood-bark' : 'ironbark'} aria-label={`${barkName} · Protected · Show buff details`}
        data-game-tooltip={duskwoodBark ? 'Duskwood Bark: Immune to damage and status effects unless staggered.' : 'Ironbark: blocks all HP damage while this enemy is not staggered. Your attacks still build its stagger gauge. Fill the gauge to break its guard; subsequent attacks can damage it while staggered.'}>
        <svg viewBox="0 0 32 32" aria-hidden="true"><path d="M16 2 28 7v10c-1 7-7 11-12 13C11 28 5 24 4 17V7Z" fill="#64513b" stroke="#cab38a" strokeWidth="2"/><path d="m12 6-3 9 4 6-2 5m8-20 3 8-5 5 4 7M16 5v22" fill="none" stroke="#302b25" strokeWidth="2"/></svg>
      </button>}
    </div>}
    <button type="button" className="battle-foe" data-battle-target={foe.id} data-targetable={alive && aiming} data-state={state} data-stagger-stage={foe.staggerStage || undefined}
    data-preview={preview ? (focus ? 'focus' : 'faint') : undefined} disabled={!alive || !aiming}
    aria-label={`${foe.name}: ${foe.hp} of ${foe.profile.maxHp} HP${staggered ? ', staggered' : ''}. Intent: ${intent}${targeters?.length?`. Targeted by ${targeters.map(actor=>actor.name).join(' and ')}`:''}${preview ? `. ${preview.attack.name} would deal ${preview.damage}${preview.ko ? ' and defeat it' : ''}${preview.staggers ? ' and stagger it' : ''}` : ''}`}
    {...interaction}>
    <span className="battle-foe__figure">{sprite}{staggered && targeters !== undefined && <span className="battle-stagger-halo" aria-hidden="true"><span className="battle-stagger-orbit"><i>✦</i><i>✧</i><i>✦</i></span></span>}<Floaters events={events} unitId={foe.id} /></span>
    <span className="battle-foe__name">{foe.name}{foe.eye && foe.hp > 0 && targeters === undefined ? <span className="battle-foe__eye"> · eyes {rankLabel(foe.rank)}±1</span> : null}</span>
    {alive ? <span className="battle-foe__bars">
      <Bar kind="hp" value={foe.hp} max={foe.profile.maxHp} preview={show?.hp.after} label={`${foe.name} HP`}>
        {show ? `${foe.hp}→${show.hp.after}` : `${foe.hp}/${foe.profile.maxHp}`}
      </Bar>
      <Bar kind="stagger" value={targeters === undefined && staggered ? staggerThreshold(foe) : foe.stagger} max={staggerThreshold(foe)} preview={show && !show.vulnerable ? show.stagger.after : undefined} label={`${foe.name} stagger`} >
        {targeters !== undefined ? `Stagger ${foe.stagger.toFixed(1)}/${staggerThreshold(foe)}` : null}
      </Bar>
      {targeters === undefined && <Bar kind="timer" value={foe.timer} max={1} preview={show && !staggered ? show.timer.after : undefined} label={`${foe.name} attack timer`}>
        {staggered ? `⏸ ${foe.staggered.toFixed(1)}s · ×${staggerVulnerability(foe)}` : target ? `→ ${target}` : ''}
      </Bar>}
      
    </span> : <span className="battle-foe__defeated">Defeated</span>}
    {targeters !== undefined && <FoundationValue rank={foe.rank} />}
    {alive && <span className="battle-foe__chips">
      {staggered && targeters === undefined && <span className="battle-chip" data-chip="staggered">STAGGERED</span>}
      {preview?.ko && <span className="battle-chip" data-preview-chip="ko">KO</span>}
      {preview?.staggers && <span className="battle-chip" data-preview-chip="break">BREAK</span>}
      {preview?.vulnerable && <span className="battle-chip" data-preview-chip="vulnerable">×{foe.profile.vulnerability}</span>}
      {preview?.effects.map((effect) => <span key={effect.kind} className="battle-chip" data-preview-chip={effect.kind}>+{EFFECT_ICON[effect.kind]}{effect.chance !== undefined ? ` ${Math.round(effect.chance*100)}%` : ''}</span>)}
    </span>}
  </button>
    {alive && targeters===undefined && <EnemyIntentBadge foe={foe} target={target} targetId={targetId} tutorialIntent={tutorialIntent} enemyTurn={enemyTurn} />}
  </div>;
}


/** Enemy intent shares the player's arrow badge treatment in the sandbox. */
export function EnemyIntentBadge({foe,target,targetId,tutorialIntent,enemyTurn,route=false}:{foe:BattleFoe;target:string|null;targetId?:string;tutorialIntent?:TutorialIntent|null;enemyTurn?:boolean;route?:boolean}) {
  const staggered=foe.staggered>0;
  const doom=foe.gallows!==undefined;
  const kind=foe.intentHidden?'hidden':foe.intent ?? 'attack';
  const damage=tutorialIntent?.heavy?foe.profile.damage*2:foe.profile.damage+foe.fed;
  const summary=tutorialIntent?tutorialIntent.summary:doom?(foe.gallows===0?'Bloom spent':`All allies · ${foe.gallows} handoffs`):foe.disarmed?'Rearm · lowest card':kind==='hidden'?'Unknown':kind==='tableau'?(foe.indominable!==undefined?'All allies':'Tableau'):kind==='idle'?'No target':kind==='withdraw'?'Tableau':target ?? 'No target';
  const detail=tutorialIntent?tutorialIntent.detail:doom?(foe.gallows===0?'The Gallows Bloom struck the veil and missed every ally.':`The Gallows Bloom will kill every ally in ${foe.gallows} handoffs. Snaring Khad Roots prevent tableau plays and Withdraw; Sealed Heartwood blocks damage, stagger and theft.`):foe.disarmed?'Disarmed: next turn this actor only takes the lowest-value exposed tableau card. This does not attack or earn Momentum.':kind==='hidden' ? `${foe.name}’s next action and target are concealed.`
    : kind==='tableau' ? `${foe.name} plays adjacent exposed tableau cards until no legal plays remain, gaining one Indominable stack per play. Above 25 stacks, it deals 1 damage per stack above 25 (26 stacks = 1 damage) at the end of its turn to every living party member. Each HP lost removes one stack. The stagger gauge cannot increase while any Indominable stacks remain.`
    : kind==='idle' ? `${foe.name} is dormant. It takes no action on its turn and does not attack.${foe.thorns ? ` Thorns is passive: each attacker takes ${foe.thorns} damage whenever they hit it, including the killing blow.` : ''}`
    : kind==='withdraw' ? `${foe.name} intends to Withdraw, replacing the entire tableau, including buried and spilled cards. It targets the tableau, not an actor. When it begins, spend Momentum to interrupt and preserve your planned sequence, or allow the redeal.`
    : `${foe.name} intends to Strike ${target ?? 'no available actor'} for ${damage} damage${foe.fed ? `, including ${foe.fed} bonus damage from feeding` : ''}. ${foe.emberPhase===1?'Counterflame targets Hero.':'It targets the living actor with the most AP; ties use party order.'}${staggered ? ' It is currently stunned and cannot attack.' : ''}`;
  return <button type="button" className={route?'battle-enemy-intent battle-target-badge battle-target-badge--enemy':'battle-enemy-intent'} data-intent={kind} data-preparing={enemyTurn || undefined}
      data-intent-target={kind==='attack'?targetId:undefined} data-game-tooltip={detail}
      aria-label={`${kind==='attack'?`Strike ${damage}`:kind==='withdraw'?'Withdraw':kind==='idle'?'Dormant':kind==='tableau'?'Tableau play':'Intent hidden'} · ${summary}. Show intent details`}>
      <span className="battle-enemy-intent__icon" aria-hidden="true">{kind==='hidden'?'?':kind==='idle'||tutorialIntent?.skips?'☾':kind==='withdraw'?'↶':'⚔'}</span>
      {kind==='attack' && !tutorialIntent?.skips && <strong>{damage}</strong>}
      <span aria-hidden="true">{kind==='attack' && !tutorialIntent?.skips?'→':'·'}</span>
      {kind==='attack' && !tutorialIntent?.skips && targetId && ACTOR_HOLO_ART[targetId] && <img src={ACTOR_HOLO_ART[targetId]} alt="" />}
      <span>{summary}</span>
    </button>;
}

/** Charge pips, with a notch at each form's breakpoint. */
function ChargePips({ actorId, charge, spirits }: { actorId: string; charge: number; spirits: readonly string[] }) {
  const def = ABILITIES[actorId];
  const breaks = new Set([...(def?.tiers.slice(1).map((tier) => tier.from) ?? []), ...spirits.map((id) => SPIRITS[id]?.from).filter(Boolean)]);
  return <span className="battle-pips" aria-hidden="true">
    {Array.from({ length: MAX_CHARGE }, (_, i) => <span key={i} className="battle-pip" data-on={i < charge || undefined} data-break={breaks.has(i + 1) || undefined} />)}
  </span>;
}

export function AbilityCard({ actor, attack, armed, dragging, interaction, disabled }: {
  actor: BattleActor; attack: Attack | null; armed: boolean; dragging: boolean; interaction: Record<string, unknown>; disabled: boolean;
}) {
  const def = ABILITIES[actor.id];
  const form = attack?.form ?? def.tiers[0].name;
  const prefix = attack && attack.name !== attack.form ? attack.name.slice(0, -attack.form.length).trim() : '';
  const next = nextBreakpoint(actor.id, actor.charge, actor.spirits);
  return <button type="button" className="battle-ability" data-ability-actor={actor.id} data-armed={armed || undefined} data-dragging={dragging || undefined}
    data-tier={attack?.tier ?? 0} data-element={attack?.element ?? undefined} disabled={disabled}
    aria-label={attack ? `${attack.name}, charge ${attack.charge}: ${attack.damage} damage, ${attack.stagger} stagger. Drag onto an enemy, or press to choose one.` : `${form}: play cards on ${actor.name}'s foundation to charge it`}
    title={next ? `Next: ${next.label} at ${next.at}` : 'Fully charged'}
    {...interaction}>
    <span className="battle-ability__name">{prefix && <span className="battle-ability__prefix">{prefix}</span>}<span>{form}</span></span>
    <span className="battle-ability__charge" aria-hidden="true">{actor.charge}</span>
    <span className="battle-ability__stats" aria-hidden="true">
      <span title="Damage">⚔{attack?.damage ?? 0}</span><span title="Stagger">✦{attack ? Math.round(attack.stagger) : 0}</span>
    </span>
    <ChargePips actorId={actor.id} charge={actor.charge} spirits={actor.spirits} />
  </button>;
}

export function PartyVitals({ actor, count, events, targeted, preview }: { actor: BattleActor; count: number; events: readonly BattleEvent[]; targeted: boolean; preview?: number }) {
  return <span className="battle-vitals" data-targeted={targeted || undefined}>
    <span className="proto-foundation-count-token" aria-label={`Collected cards ${count}`}>▤{count}</span>
    <Bar kind="hp" value={actor.hp} max={actor.maxHp} preview={preview} label={`${actor.name} HP`}>{actor.hp > 0 ? `${actor.hp}/${actor.maxHp}` : 'Unconscious'}</Bar>
    {actor.spirits.map((id) => SPIRITS[id] && <span key={id} className="battle-chip" data-spirit={id} title={`${SPIRITS[id].name}: ${SPIRITS[id].blurb}`}>{SPIRITS[id].glyph}{SPIRITS[id].name}</span>)}
    <Floaters events={events} unitId={actor.id} />
  </span>;
}

/** The held card follows the pointer while dragging. */
export function AbilityGhost({ attack, x, y, preview, trap }: { attack: Attack; x: number; y: number; preview: AttackPreview | null; trap: number | null }) {
  return <span className="battle-ability-ghost" data-element={attack.element ?? undefined} style={{ left: x, top: y }} aria-hidden="true">
    <span>{attack.name} {attack.charge}</span>
    {preview && <span className="battle-ability-ghost__result">{preview.ko ? 'KO' : `-${preview.damage}`}{preview.staggers ? ' · BREAK' : ''}</span>}
    {trap !== null && <span className="battle-ability-ghost__result">Trap · -{trap}</span>}
  </span>;
}

/** Marks on a table card: a trap waiting inside, and slimes eyeing it with their draining eye bar. */
export function TableMark({ depth, trap, eyes, party }: { depth: number; trap?: Trap; eyes: readonly BattleFoe[]; party: readonly BattleActor[] }) {
  if (!trap && !eyes.length) return null;
  const setter = trap && party.find((actor) => actor.id === trap.actorId)?.name;
  return <span className="battle-card-mark" style={{ top: `calc(var(--battle-peek) * ${depth})` } as CSSProperties}
    role="img" aria-label={[trap ? `Trapped by ${setter}: ${trap.name}` : '', ...eyes.map((foe) => `${foe.name} is eyeing this card`)].filter(Boolean).join('. ')}>
    {eyes.map((foe) => <span key={foe.id} className="battle-card-mark__eye" title={`${foe.name} eats this card when its eye runs out`}>
      <span className="battle-card-mark__eye-fill" style={{ width: pct(foe.eye!.left, foe.eye!.total) }} />
    </span>)}
    {eyes.length > 0 && <span className="battle-card-mark__glyph" data-mark="eye">👁</span>}
    {trap && <span className="battle-card-mark__glyph" data-mark="trap" title={`Trap: ${trap.name}`}>⚠</span>}
  </span>;
}

export function DisarmedBadge({name}:{name:string}) {
 return <button type="button" className="battle-buff-icon battle-debuff-icon" data-debuff="disarmed" aria-label={name+' Disarmed · Show details'} data-game-tooltip="Disarmed: this foundation has no card. Its owner must spend their next turn taking the lowest-value exposed tableau card. No attack or Momentum. No other plays or skills this turn.">⛓</button>;
}
/** Each Kin's banked AP (pays for its own ability cards), shown in the foundation's meter slot. */
function ApMeter({actor}:{actor:BattleActor}) {
 const cap=apCap(actor),ap=Math.min(Math.floor(actor.charge),cap);
 return <span className="battle-foundation__ap" role="meter" aria-label={`${actor.name} AP`} aria-valuemin={0} aria-valuemax={cap} aria-valuenow={ap}>
  <b>AP {ap}</b><span className="battle-foundation__ap-pips" aria-hidden="true">{Array.from({length:cap},(_,i)=><i key={i} data-on={i<ap || undefined}/>)}</span>
 </span>;
}
function FoundationValue({rank}:{rank:number}) {return <span className="battle-foundation__value" aria-label={'Foundation card value '+(rank?rankLabel(rank):'empty')}>{rank?rankLabel(rank):'—'}</span>;}
/** Local, bounded reactions; damage takes priority over a simultaneous attack/Thorns hit. */
function useFoundationEmotion(actor:BattleActor,events:readonly BattleEvent[],paused:boolean,noLegalMoves:boolean) {
 const seen=useRef(events[events.length-1]?.id ?? 0);
 const remaining=useRef(0),activeSerial=useRef(0);
 const [reaction,setReaction]=useState<{emotion:'stars'|'upset'|'heartEyes';serial:number}|null>(null);
 useEffect(()=>{
  if(!events.length){seen.current=0;remaining.current=0;setReaction(null);return;}
  const fresh=events.filter(event=>event.id>seen.current);seen.current=events[events.length-1].id;
  const hurt=fresh.some(event=>event.targetId===actor.id && ['hit','enemy-hit','dot','down'].includes(event.kind) && ((event.amount ?? 0)>0 || event.kind==='down'));
  const victory=fresh.some(event=>event.sourceId===actor.id && event.kind==='ko');
  const hit=fresh.some(event=>event.sourceId===actor.id && ['hit','stagger'].includes(event.kind));
  if(hurt || victory || hit){remaining.current=1500;activeSerial.current=events[events.length-1].id;setReaction({emotion:hurt?'upset':victory?'heartEyes':'stars',serial:events[events.length-1].id});}
 },[events,actor.id]);
 useEffect(()=>{
  if(!reaction || paused)return;
  const start=gameTime.now();const timer=gameTime.setTimeout(()=>{remaining.current=0;setReaction(null);},remaining.current);
  return()=>{gameTime.clearTimeout(timer);if(activeSerial.current===reaction.serial)remaining.current=Math.max(0,remaining.current-(gameTime.now()-start));};
 },[reaction,paused]);
 return actor.hp<=0?'sad':noLegalMoves?'upset':reaction?.emotion ?? 'happy';
}
export function PlayerFoundationFace({actor,events,portraitRef,paused=false,noLegalMoves=false}:{actor:BattleActor;events:readonly BattleEvent[];portraitRef:(node:HTMLSpanElement|null)=>void;paused?:boolean;noLegalMoves?:boolean}) {
 const emotion=useFoundationEmotion(actor,events,paused,noLegalMoves);
 const face=actor.id==='hero'?<HeroEmoji emotion={emotion} label={actor.name+' · '+emotion}/>:actor.id==='mochi'?<MochiEmoji emotion={emotion} label={actor.name+' · '+emotion}/>:<BanksEmoji emotion={emotion} label={actor.name+' · '+emotion}/>;
 return <><span className="battle-foe__name">{actor.name}</span><span className="battle-foe__figure battle-field__actor-card" ref={portraitRef}><span className="battle-foundation__emoji" data-emotion={emotion}>{actor.controller==='npc'?<ActorHoloCard actorId={actor.id} name={actor.name} rank={rankLabel(actor.rank)}/>:face}</span><Floaters events={events} unitId={actor.id}/></span><span className="battle-foe__bars"><Bar kind="hp" value={actor.hp} max={actor.maxHp} label={actor.name+' HP'}>{actor.hp}/{actor.maxHp}</Bar>{actor.staggerMax?<Bar kind="stagger" value={actor.stagger??0} max={actor.staggerMax} label={actor.name+' stagger'}>{`Stagger ${actor.stagger??0}/${actor.staggerMax}`}</Bar>:<ApMeter actor={actor}/>}<span className="battle-foundation__status">{actor.hp<=0?'Down':actor.disarmed?'Disarmed':actor.rooted?'Snaring Khad Roots':actor.controller==='npc'?'NPC ally':actor.turnSpent?'Turn spent · Rearmed':'Ready'}</span></span><FoundationValue rank={actor.rank}/></>;
}
