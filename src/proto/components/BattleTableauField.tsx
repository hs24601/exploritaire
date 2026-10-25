import { CombatTurnBanners } from './CombatTurnBanners';
import { NightRescueScene } from './NightRescueScene';
import { useCombatInspection } from './useCombatInspection';
import { trackGameAnimation } from '../../gameAnimations';
import { gameTime } from '../../gameTime';
import { useGlobalPaused } from './GlobalPause';
import { assignedMovesFor, useActorLoadouts } from '../actorLoadouts';
import { retrievalCost, retrieveCard } from '../rules/battle';
import { ActorHoloCard, ACTOR_HOLO_ART } from './ActorHoloCard';
import { DetailsCardViewer, ActorCardArt } from './DetailsCardViewer';
import { AbilityArtwork } from './AbilityArtwork';
import { requestHoloDeviceTilt } from '../useHoloDeviceTilt';
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { battleSpriteAssets } from '../battleSpriteAssets';
import { useArtStyle } from '../artStyle';
import { useTableauCardLimit } from './useTableauCardLimit';
import { useCombatViewportFit } from './useCombatViewportFit';
import { HERO_DIRECTIONAL_SPRITE, DARK_SLIME_DIRECTIONAL_SPRITE, type DirectionalSpriteDefinition } from '../directionalSprites';
import { MOCHI_DIRECTIONAL_SPRITE } from '../mochiSprite';
import { rankLabel, type Card } from '../protoState';
import { createSeededSmallWoodsDeal } from '../rules/setup';
import {
  releaseGrip, MAX_FOES, actorAttack, inspectActorAbility, addSlime, applyAttack, applyTrap, canDeal, canEndPlayerTurn, endPlayerTurn, createBattle, canUseMomentumSkill, setActorTarget, dealRow, eligibleActors, enemyTarget, playCard,
  previewAttack, previewTrap, redrawActor, removeSlime, setMochi, setSpirit, setMaxAP, tickBattle, type BattleState,
} from '../rules/battle';
import { COMBAT_ABILITY_SLOTS, combatMovesFor, type Attack } from '../rules/battleAbilities';
import { BATTLE_SCENARIOS, scenarioById } from '../rules/battleScenarios';
import { COMBAT_SANDBOX_SCENARIOS, type CombatSandboxScenarioId } from '../rules/battleSandboxScenarios';
import { createCombatSandboxScenario, tableauWidth } from '../rules/battle';
import { IntentCardSlot, HoldSlot } from './BattleDeadRun';
import { PlanLegend, PlanSegments } from './TableauPlanMarkers';
import { tableauPlans } from '../rules/battlePlans';
import { anyLegalPlay, canPityFlip, hasHoldSlot, hasPityDraw, heldCard, heldReceivers, holdCard, holdOwner, holdReceiver, INTENT_RECEIVER, intentDef, playHeld, playOnIntent, pityFlip, tableauReceivers } from '../rules/battleDeadRun';
import { getCardTransportDurationMs } from '../protoTransport';
import { solverFlightDuration } from '../solverTiming';
import { createTableauLightRig } from '../tableauLighting';
import type { TableLight } from '../protoLighting';
import { ProtoCard } from './ProtoCard';
import { TableauScene } from './TableauScene';
import { SceneButton } from './SceneButton';
import { SpriteStandeeArt } from './SpriteStandee';
import type { StandeeLighting } from '../protoLighting';
import { FoeCard, PartyVitals, TableMark, PlayerFoundationFace, DisarmedBadge } from './BattleUnits';
import { BattleTargetArrows } from './BattleTargetArrows';
import { MomentumEngine, type MomentumValueStyle } from './MomentumEngine';
import { MomentumIcon } from './MomentumIcon';
import { MomentumSkillRadial } from './MomentumSkillRadial';
import { MomentumAbilityFlight, type AbilityCast } from './MomentumAbilityFlight';
import { BattleBulletTime } from './BattleBulletTime';
import { battleTimeScale } from '../rules/battle';
import { useMomentumSkill } from '../rules/battle';
import { returnCirToDeck } from '../rules/battle';
import { CirFamiliarBuff, CirFamiliarInspector } from './CirFamiliar';
import { BattleDamageCallouts } from './BattleDamageCallouts';
import { CombatScenarioComplete } from './CombatScenarioComplete';
import { BattleStatusIcons } from './BattleStatusIcons';
import { burnCardsFx } from './burnCardsFx';
import { focusFireCards } from '../rules/battleStatuses';
import { InsightDialog } from './InsightDialog';
import { tutorialIntent, tutorialRounds } from '../rules/battleTutorials';
import { tutorialById } from '../rules/battleTutorialScenarios';
import { canInterruptWithdraw, interruptEnemyWithdraw, resolveEnemyWithdraw, WITHDRAW_INTERRUPT_COST, setMomentumDecay } from '../rules/battle';
import { AbilityTray } from './AbilityTray';
import { AbilityCard } from './AbilityCard';
import { useAbilityDrag } from './useAbilityDrag';
import { useBattleFx } from './useBattleFx';
import { sceneOf, type BattleScene } from '../rules/battleCues';
import './BattleTableauField.css';
import { BATTLE_TURN_PRIORITY } from '../battleTurnPriority';
import { TableauSolveControls, type SolveStepResult } from './TableauSolveControls';
import { assessSolverMove } from '../tableauSolver';

const SPRITES: Record<string, DirectionalSpriteDefinition | string> = {
  hero: HERO_DIRECTIONAL_SPRITE, mochi: MOCHI_DIRECTIONAL_SPRITE,
  'dark-slime': DARK_SLIME_DIRECTIONAL_SPRITE, 'rear-slime': DARK_SLIME_DIRECTIONAL_SPRITE, 'small-slime': DARK_SLIME_DIRECTIONAL_SPRITE,
};
const previewDeal = createSeededSmallWoodsDeal();
/** Battle state updates this often; bars ease between updates in CSS. */
const TICK_MS = 100;

/** Painted Hero/slimes share their rig atlas; Mochi retains its earlier art. */
function FoundationSprite({ sprite, name, lighting, turnedAway = false }: { sprite: DirectionalSpriteDefinition | string; name: string; lighting: StandeeLighting; turnedAway?: boolean }) {
  const assets = battleSpriteAssets(useArtStyle());
  if (typeof sprite === 'string') return <span className="battle-field__sprite" role="img" aria-label={`${name} sprite`}>
    <SpriteStandeeArt sprite={sprite} lighting={lighting} size={64} />
  </span>;
  const quarter = sprite.id === 'mochi' || sprite.id === 'hero';
  const frame = sprite.low[turnedAway ? 4 : quarter ? 1 : 0], rect = frame.parts[0].rect;
  const painted = assets[frame.source].includes('/watercolor/');
  return <svg className="battle-field__sprite" style={painted ? {imageRendering:'auto'} : undefined} viewBox={rect.join(' ')} preserveAspectRatio="xMidYMax meet" data-foundation-pose={turnedAway ? 'rear' : quarter ? 'quarter' : 'front'} role="img" aria-label={`${name} sprite${turnedAway ? ' facing away' : ''}`}>
    <image href={`${import.meta.env.BASE_URL}assets/${assets[frame.source]}`} />
  </svg>;
}

export function BattleTableauField({ hours, lights, onWatch, active, onSceneChange, heroInspiration, onRedraw, sandbox = false, cameraOpen = false }: {
  sandbox?: boolean;
  cameraOpen?: boolean;
  hours: number; lights: readonly TableLight[]; onWatch: () => void; active: boolean;
  /** Units (fallen ones included) and recent events, for the 3D arena's animations. */
  onSceneChange?: (scene: BattleScene) => void;
  /** The Hero's world inspiration coming into the fight. */
  heroInspiration?: number;
  /** An actor spent 1 inspiration on a foundation redraw. */
  onRedraw?: (actorId: string) => void;
}) {
  const [sandboxScenarioId,setSandboxScenarioId]=useState<CombatSandboxScenarioId>(()=>{
    const requested=new URLSearchParams(window.location.search).get('scenario');
    return sandbox && COMBAT_SANDBOX_SCENARIOS.find(scenario=>scenario.id===requested)?.id || '001';
  });
  const [highlightLegal,setHighlightLegal]=useState(false);
  const [singleMoveTarget,setSingleMoveTarget]=useState<HTMLDivElement|null>(null);
  const [skillMenuOpen,setSkillMenuOpen]=useState(false);
  const [directWithdraw,setDirectWithdraw]=useState(false);
  const [withdrawSelecting,setWithdrawSelecting]=useState(false);
  /** Open Kin radials; empty while the Momentum radial (Withdraw only) is open. */
  const [skillOwners,setSkillOwners]=useState<string[]>([]);
  const [cirInspection,setCirInspection]=useState(false);
  const [insightOpen,setInsightOpen]=useState(false);
  const [momentumValueStyle,setMomentumValueStyle]=useState<MomentumValueStyle>('flamelab');
  const [abilityCast,setAbilityCast]=useState<AbilityCast|null>(null);
  const newBattle = (setup: Parameters<typeof createBattle>[1]) => sandbox ? createCombatSandboxScenario(sandboxScenarioId) : createBattle(previewDeal, setup);
  useActorLoadouts();
  const globalPaused = useGlobalPaused();
  const [targetDrag,setTargetDrag]=useState<{actorId:string;x:number;y:number;over:string|null}|null>(null);
  const [targetPicker,setTargetPicker]=useState<string|null>(null);
  const dragRef=useRef<{actorId:string;x:number;y:number;moved:boolean}|null>(null);
  const suppressTargetClick=useRef(false);
  const [retrieval,setRetrieval]=useState<string|null>(null);
  const [scenarioId, setScenarioId] = useState(BATTLE_SCENARIOS[0].id);
  const [battle, setBattle] = useState(() => newBattle({ ...BATTLE_SCENARIOS[0].setup, playerAmbush: true, inspiration: { hero: heroInspiration } }));
  const [paused, setPaused] = useState(false);
  const [nightBlocking,setNightBlocking]=useState(false);
  const [withdrawPreview, setWithdrawPreview] = useState(false);
  const [solverSession, setSolverSession] = useState(0);
  const foundationRefs = useRef(new Map<string, HTMLElement>());
  const cardRefs = useRef(new Map<string, HTMLButtonElement>());
  /** A tableau card (or a parked one, `heldBy`) waiting for the player to pick its receiver. */
  const [selection, setSelection] = useState<{columnIndex: number; cardId: string; actorIds: string[]; heldBy?: string} | null>(null);
  const flights = useRef(new Set<() => void>());
  const tableauSnapshots=useRef(new Map<string,{source:HTMLButtonElement;rect:DOMRect}>());
  const previousEnemyFoundations=useRef<BattleState['foes']|null>(null);
  const intentRef=useRef<HTMLElement|null>(null);
  const previousIntentCards=useRef<string[]|null>(null);
  const [bannerSession,setBannerSession]=useState(0);
  const [announcement, setAnnouncement] = useState('');
  const [abilityInspection, setAbilityInspection] = useState<{ attack: Attack; anchor: HTMLElement } | null>(null);
  const [inspection, setInspection] = useState<{ id: string; name: string; anchor: HTMLElement } | null>(null);
  useEffect(() => () => { flights.current.forEach((cancel) => cancel()); }, []);

  // Sync HP changes to scene markers; frame-by-frame positioning stays inside the renderer.
  const units = [...battle.party.map((a) => `${a.id}:${a.hp}:${a.maxHp}`), ...battle.foes.map((f) => `${f.id}:${f.hp}:${f.profile.maxHp}`)].join(',');
  const lastEvent = battle.events[battle.events.length - 1]?.id ?? 0;
  const sceneChange = useRef(onSceneChange); sceneChange.current = onSceneChange;
  const latest = useRef(battle); latest.current = battle;
  const ambushed = Boolean(battle.ambush);
  // Bites, flinches and falls on the cards themselves.
  const fieldRef = useRef<HTMLElement>(null);
  const combatInspection = useCombatInspection(fieldRef, solverSession, cirInspection || insightOpen || Boolean(inspection) || Boolean(abilityInspection));
  useCombatViewportFit(fieldRef,sandbox);
  const tableauCardLimit = useTableauCardLimit(fieldRef);
  const seenSpills = useRef(new Set<string>());
  useEffect(() => {
    if(!sandbox || !battle.reposition)return;
    for(const id of battle.reposition.addedIds){
      const card=cardRefs.current.get(id);if(!card)continue;
      const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
      const animation=trackGameAnimation(card.animate(reduced?[{opacity:.4},{opacity:1}]:[
        {opacity:0,transform:'translateY(-18px) rotateX(-35deg)'},{opacity:1,transform:'none'},
      ],{duration:reduced?80:320,easing:'ease-out'}));
      const done=()=>{animation.cancel();flights.current.delete(done);};
      flights.current.add(done);animation.onfinish=done;
    }
  },[battle.reposition,sandbox]);
  useEffect(() => {
    if (!sandbox) return;
    for (const [id, foeId] of Object.entries(battle.spills ?? {})) {
      if (seenSpills.current.has(id)) continue;
      seenSpills.current.add(id);
      const card = cardRefs.current.get(id);
      const foe = fieldRef.current?.querySelector<HTMLElement>(`[data-battle-target="${foeId}"]`);
      if (!card || !foe) continue;
      const from = foe.getBoundingClientRect(), to = card.getBoundingClientRect();
      const dx = from.x + from.width / 2 - to.x - to.width / 2;
      const dy = from.y + from.height / 2 - to.y - to.height / 2;
      const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
      const ghost = card.cloneNode(true) as HTMLButtonElement;
      ghost.disabled = true;
      ghost.setAttribute('aria-hidden', 'true');
      ghost.style.cssText = `position:fixed;left:${to.x}px;top:${to.y}px;width:${to.width}px;height:${to.height}px;--classic-card-w:${to.width}px;pointer-events:none;z-index:65000;`;
      document.body.append(ghost);
      card.style.visibility='hidden';
      const animation = trackGameAnimation(ghost.animate(reduced ? [{opacity:0},{opacity:1}] : [
        {transform:`translate(${dx}px,${dy}px) rotate(-200deg) scale(.35)`, opacity:.4},
        {transform:`translate(${dx*.45}px,${dy*.5-35}px) rotate(-75deg) scale(1.1)`, opacity:1, offset:.5},
        {transform:'translate(0,0) rotate(0deg) scale(1)', opacity:1},
      ], {duration:reduced ? 80 : 650, easing:'ease-out', fill:'both'}));
      const done = () => { animation.cancel(); ghost.remove(); card.style.visibility=''; flights.current.delete(done); };
      flights.current.add(done); animation.onfinish = done;
    }
  }, [battle.spills, sandbox]);

  // Announce hits on the party and breaks, for screen readers.
  const announced = useRef(0);
  useEffect(() => {
    const fresh = battle.events.filter((event) => event.id > announced.current);
    if (!fresh.length) return;
    announced.current = fresh[fresh.length - 1]!.id;
    const name = (id: string) => [...battle.party, ...battle.foes].find((unit) => unit.id === id)?.name ?? id;
    const lines = fresh.flatMap((event) => event.kind === 'enemy-hit' ? [`${event.label} hits ${name(event.targetId)} for ${event.amount}`]
      : event.kind === 'stagger' ? [`${name(event.targetId)} is staggered`] : event.kind === 'ko' ? [`${name(event.targetId)} is defeated`] : []);
    if (lines.length) setAnnouncement(lines.join('. '));
  }, [battle]);

  /** Spends a held ability on a slime, or on a table card (`card:<column>`) as a trap. */
  const spend = (actorId: string, foeId: string) => {
    if (foeId.startsWith('card:')) {
      const column = Number(foeId.slice(5));
      const trap = previewTrap(battle, actorId, column);
      if (!trap) return;
      setBattle((current) => applyTrap(current, actorId, column));
      setAnnouncement(`${trap.attack.name} set as a trap: ${trap.damage} to the slime that eats it`);
      return;
    }
    const preview = previewAttack(battle, actorId, foeId);
    if (!preview) return;
    setBattle((current) => applyAttack(current, actorId, foeId));
    const foe = [...battle.party, ...battle.foes].find((unit) => unit.id === foeId)!;
    setAnnouncement(`${preview.attack.name} hits ${foe.name} for ${preview.damage}${preview.ko ? ', defeated' : preview.staggers ? ', staggered' : ''}${battle.ambush?.awaitingAttack ? '. Enemy ambushed. Free next turn: ten seconds before enemy attack timers begin' : ''}`);
  };
  const [gripAP,setGripAP]=useState(3);
  const [abilityAnchor, setAbilityAnchor] = useState({x:20,y:120});
  const { aim, holding, holdingRef, cardProps, foeProps, cancel, prime } = useAbilityDrag(spend);
  const loadoutKey=battle.party.map(a=>a.id+':'+assignedMovesFor(a.id).map(m=>m.name).join(',')).join('|');
  useEffect(()=>{cancel();setRetrieval(null);setAbilityInspection(null);},[loadoutKey]);
  useEffect(()=>{if(battle.result)setRetrieval(null);},[battle.result]);
  const presentationPaused = paused || holding || globalPaused || skillMenuOpen || cirInspection || insightOpen || Boolean(abilityCast) || Boolean(inspection);
  const battlePaused = nightBlocking || presentationPaused;
  const noLegalMoves = !battle.result && battle.turn === 'party' && !anyLegalPlay(battle);
  // Ticks also advance effects and the free-turn countdown; enemy clocks wait for it.
  const running = battle.started && !battle.result && !battlePaused && (!sandbox || battle.turn==='enemy' && (battle.sandboxScenario==='999' || battle.tutorial?.enemyClock!==undefined) || battle.turn==='party' && ((battle.momentum?.recentPlays?.length ?? 0)>0 || battle.momentum?.decayEnabled!==false && (battle.momentum?.value ?? 0)>0));
  useEffect(() => {
    if (!running) return;
    let last = gameTime.now();
    const timer = gameTime.setInterval(() => {
      const now = gameTime.now();
      const dt = Math.min(0.25, (now - last) / 1000); last = now;
      if (!holdingRef.current) setBattle((current) => tickBattle(current, dt));
    }, TICK_MS);
    return () => gameTime.clearInterval(timer);
  }, [running]);

  const finishedDefeat=useBattleFx(fieldRef, battle.events, presentationPaused, holding);
  const lastDefeat=battle.events.reduce((last,event)=>event.kind==='ko'?Math.max(last,event.id):last,0);
  useEffect(() => {
    if (battlePaused) { dragRef.current=null; setTargetDrag(null); setTargetPicker(null); }
  }, [battlePaused]);
  useEffect(() => { if (holding) { setSelection(null); setAnnouncement('Tactical pause · Tableau values hidden'); } }, [holding]);
  // Target changes are presentation updates, including when the battle clock is paused.
  const aimActor = aim?.actorId, aimFoe = aim?.foeId;
  const aimBattle = aimActor ? battle : null;
  useEffect(() => {
    sceneChange.current?.({ ...sceneOf(latest.current, aimActor && !abilityInspection ? { actorId: aimActor, foeId: aimFoe ?? null } : null), paused: battlePaused, sandboxSession: sandbox ? `${sandboxScenarioId}-${solverSession}` : undefined, khadRoot: sandbox || undefined });
  }, [units, lastEvent, ambushed, aimActor, aimFoe, aimBattle, battlePaused, abilityInspection, sandboxScenarioId, solverSession, sandbox]);
  useEffect(() => { if (battle.result) cancel(); }, [battle.result]); // eslint-disable-line react-hooks/exhaustive-deps

  const flyTableauCard=(source:HTMLButtonElement,targetId:string,destination:HTMLElement,from=source.getBoundingClientRect())=>{
    // The play lands at once; the flight is the card's journey to the foundation.
    const to = destination.getBoundingClientRect();
    if(!from.width || !from.height)return;
    const ghost = source.cloneNode(true) as HTMLButtonElement;
    ghost.disabled = true;
    ghost.classList.add('battle-card-flight');
    ghost.dataset.targetActor = targetId;
    ghost.setAttribute('aria-hidden','true');ghost.inert=true;
    ghost.style.cssText = `position:fixed;left:${from.x}px;top:${from.y}px;width:${from.width}px;height:${from.height}px;--classic-card-w:${from.width}px;--classic-radius:5px;z-index:60000;pointer-events:none;transform-origin:0 0;font:16px/1.15 'Classic Pixel',monospace;`;
    document.body.append(ghost);
    const scale = to.width / from.width;
    const dx = to.x - from.x, dy = to.y - from.y;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const animation = trackGameAnimation(ghost.animate([
      {transform:'translate(0,0) scale(1)'},
      {transform:`translate(${dx * .5}px,${dy * .5 - 35}px) scale(${(1 + scale) / 2})`, offset:.5},
      {transform:`translate(${dx}px,${dy}px) scale(${scale})`},
    ], {duration:reduced ? 1 : solverFlightDuration(getCardTransportDurationMs(from,to)), easing:'ease-out', fill:'forwards'}));
    const done = () => { animation.cancel(); ghost.remove(); flights.current.delete(done); };
    flights.current.add(done);
    animation.onfinish = done;
  };
  // Detect actual tableau-to-enemy ownership changes, including forced rearming.
  // Source geometry is retained before React removes the received card.
  useLayoutEffect(()=>{
    const previous=previousEnemyFoundations.current;
    previousEnemyFoundations.current=battle.foes;
    if(!previous)return;
    for(const foe of battle.foes){
      const before=previous.find(unit=>unit.id===foe.id);
      if(!before || before.foundationCards===foe.foundationCards)continue;
      const owned=new Set(before.foundationCards?.map(card=>card.id));
      for(const card of foe.foundationCards ?? []){
        if(owned.has(card.id))continue;
        const snapshot=tableauSnapshots.current.get(card.id);
        const target=fieldRef.current?.querySelector<HTMLElement>(`.battle-foe[data-battle-target="${foe.id}"]`);
        const destination=target?.querySelector<HTMLElement>('.battle-foundation__value') ?? target;
        if(snapshot && destination)flyTableauCard(snapshot.source,foe.id,destination,snapshot.rect);
      }
    }
  },[battle.foes]);
  // Cards either side plays onto the intent fly there from their retained tableau geometry.
  useLayoutEffect(()=>{
    const cards=battle.tutorial?.intent?.cards ?? [],previous=previousIntentCards.current;
    previousIntentCards.current=cards.map(card=>card.id);
    if(!previous || !intentRef.current)return;
    for(const card of cards){
      const snapshot=previous.includes(card.id)?undefined:tableauSnapshots.current.get(card.id);
      if(snapshot)flyTableauCard(snapshot.source,INTENT_RECEIVER,intentRef.current,snapshot.rect);
    }
  },[battle.tutorial?.intent]);
  useLayoutEffect(()=>{
    const capture=()=>{
      tableauSnapshots.current=new Map([...cardRefs.current].map(([id,source])=>[id,{source,rect:source.getBoundingClientRect()}]));
    };
    capture();
    const resize=new ResizeObserver(capture);
    if(fieldRef.current)resize.observe(fieldRef.current);
    const board=fieldRef.current?.querySelector('.battle-field__board');if(board)resize.observe(board);
    window.addEventListener('resize',capture);
    return()=>{resize.disconnect();window.removeEventListener('resize',capture);};
  },[battle.columns]);
  const receiverName = (id: string) => id === INTENT_RECEIVER ? intentDef(battle)?.name ?? 'the intent' : holdOwner(id) ? 'Hold' : battle.party.find(actor => actor.id === id)?.name ?? id;
  const play = (index: number, source: HTMLButtonElement, actorId: string) => {
    if (holdingRef.current || paused) return;
    const column = battle.columns[index];
    const card = column[column.length - 1];
    // The intent card and hold slots receive tableau cards beside the Kin foundations.
    const parkFor = holdOwner(actorId);
    if (card && (actorId === INTENT_RECEIVER || parkFor) && tableauReceivers(battle, card).includes(actorId)) {
      setSelection(null);
      setBattle(current => parkFor ? holdCard(current, index, parkFor) : playOnIntent(current, index));
      setAnnouncement(parkFor ? `${rankLabel(card.rank)} parked in the hold` : `${rankLabel(card.rank)} played onto ${receiverName(actorId)} · one pip removed · Momentum +1`);
      const hold = parkFor && fieldRef.current?.querySelector<HTMLElement>(`[data-battle-slot="${actorId}"] .battle-hold-slot`);
      if (hold) flyTableauCard(source, actorId, hold);
      return;
    }
    const actor = card && eligibleActors(battle, card).find(actor => actor.id === actorId);
    const destination = actor && (sandbox ? fieldRef.current?.querySelector<HTMLElement>(`[data-battle-actor="${actor.id}"] .battle-foundation__value`) : foundationRefs.current.get(actor.id));
    if (!card || !actor) return;
    setSelection(null);
    setBattle((current) => playCard(current, index, actor.id));
    setAnnouncement(`${rankLabel(card.rank)} added to ${actor.name}'s foundation · ${sandbox?`Momentum +${playCard(battle,index,actor.id).momentum?.lastGain ?? 1}`:`AP ${actor.charge + 1}`}`);
    if (!destination) return;
    flyTableauCard(source,actor.id,destination);
  };
  /** A parked card leaves its hold for a Kin foundation or the intent. */
  const playFromHold = (ownerId: string, source: HTMLButtonElement, receiverId: string) => {
    const card = heldCard(battle, ownerId);
    if (holdingRef.current || paused || !card || !heldReceivers(battle, ownerId).includes(receiverId)) return;
    setSelection(null);
    setBattle(current => playHeld(current, ownerId, receiverId));
    setAnnouncement(`Held ${rankLabel(card.rank)} played onto ${receiverName(receiverId)}`);
    const destination = receiverId === INTENT_RECEIVER ? null : fieldRef.current?.querySelector<HTMLElement>(`[data-battle-actor="${receiverId}"] .battle-foundation__value`);
    if (destination) flyTableauCard(source, receiverId, destination);
  };
  const activateHeld = (ownerId: string, source: HTMLButtonElement) => {
    const card = heldCard(battle, ownerId), receivers = heldReceivers(battle, ownerId);
    if (holdingRef.current || paused || !card) return;
    if (receivers.length === 1) { playFromHold(ownerId, source, receivers[0]); return; }
    if (receivers.length > 1) {
      setSelection(selection?.cardId === card.id ? null : {columnIndex:-1,cardId:card.id,actorIds:receivers,heldBy:ownerId});
      setAnnouncement(`Choose where held ${rankLabel(card.rank)} goes: ${receivers.map(receiverName).join(' or ')}`);
    }
  };
  // Match Proto's playColumn / chooseFoundationTarget sequence: never choose
  // between equally eligible actors on the player's behalf.
  const activate = (index: number, source: HTMLButtonElement) => {
    if (holdingRef.current || paused) return;
    const column = battle.columns[index], card = column[column.length - 1];
    if (!card) return;
    // An armed ability in a trap battle sets its trap on the pressed card instead.
    if (aim?.mode === 'armed' && previewTrap(battle, aim.actorId, index)) { cancel(); spend(aim.actorId, `card:${index}`); return; }
    // A tap plays straight onto a single receiver; hold slots are offered only when there is a choice.
    const receivers = tableauReceivers(battle, card, false);
    if (receivers.length === 1) { play(index,source,receivers[0]); return; }
    if (receivers.length > 1) {
      const options = tableauReceivers(battle, card);
      setSelection(selection?.cardId === card.id ? null : {columnIndex:index,cardId:card.id,actorIds:options});
      setAnnouncement(`Choose where ${rankLabel(card.rank)} goes: ${options.map(receiverName).join(' or ')}`);
    }
  };
  const choose = (actorId: string) => {
    if (!selection || !selection.actorIds.includes(actorId)) return;
    const source = cardRefs.current.get(selection.cardId);
    if (selection.heldBy) { if (source) playFromHold(selection.heldBy, source, actorId); return; }
    const column = battle.columns[selection.columnIndex];
    if (source && column[column.length - 1]?.id === selection.cardId) play(selection.columnIndex,source,actorId);
  };
  const solveStep = (): SolveStepResult => {
    const current = latest.current;
    if(sandbox && current.turn==='enemy')return {status:'blocked',message:'Enemy turn'};
    if (current.result) return { status: 'complete', message: current.result === 'won' ? 'Victory' : 'Party defeated' };
    if (battlePaused || holdingRef.current) return { status: 'blocked', message: 'Battle paused' };
    if (flights.current.size) return { status: 'waiting', message: 'Waiting for card flight' };
    // Use real attacks to release the opening ambush and finish the fight.
    for (const actor of sandbox ? [] : current.party) {
      for (const foe of current.foes) {
        const attack = previewAttack(current, actor.id, foe.id);
        if (attack && attack.damage > 0) {
          setBattle(state => applyAttack(state, actor.id, foe.id));
          return { status: 'played', message: `${actor.name} · ${attack.attack.name}` };
        }
      }
    }
    const rootMoves = current.columns.flatMap((column, index) => eligibleActors(current, column[column.length - 1]).map(actor => ({ column: index, foundation: current.party.indexOf(actor) })));
    const assessment = assessSolverMove({ columns: current.columns, stock: current.stock, foundations: current.party.map(actor => actor.rank) }, { rootMoves });
    if (assessment) {
      const { column, foundation } = assessment.move;
      const cards = current.columns[column];
      const card = cards[cards.length - 1];
      const source = cardRefs.current.get(card.id);
      if (!source) return { status: 'waiting', message: 'Waiting for tableau' };
      play(column, source, current.party[foundation].id);
      return { status: 'played', message: `${assessment.method} battle move` };
    }
    if (canDeal(current)) {
      setBattle(dealRow);
      return { status: 'played', message: 'Deal a row' };
    }
    if(sandbox)return {status:'blocked',message:'No legal moves · Press END TURN'};
    return { status: 'blocked', message: 'No legal move · Redraw a foundation to continue' };
  };
  const redraw = (actorId: string) => {
    if (holdingRef.current || paused) return;
    const next = redrawActor(battle, actorId);
    if (next === battle) return;
    const actor = next.party.find((a) => a.id === actorId)!;
    setSelection(null);
    setBattle(next);
    onRedraw?.(actorId);
    setAnnouncement(`${actor.name} redraws: foundation is now ${rankLabel(actor.rank)} · ${actor.inspiration} inspiration left`);
  };
  /** Restarts the current scenario with the roster as adjusted, or a fresh scenario as authored. */
  const restart = (nextScenario?: string) => {
    setBannerSession(value=>value+1);setDirectWithdraw(false);
    setSkillMenuOpen(false);setAbilityCast(null);setCirInspection(false);setInsightOpen(false);
    announced.current=0;
    setWithdrawPreview(false);
    setSolverSession(session => session + 1);
    cancel(); setTargetDrag(null); setTargetPicker(null); dragRef.current=null; setRetrieval(null); setAbilityInspection(null); setSelection(null); setPaused(false);
    flights.current.forEach(done=>done());seenSpills.current.clear();
    tableauSnapshots.current.clear();previousEnemyFoundations.current=null;previousIntentCards.current=null;
    if(sandbox){
      const id=COMBAT_SANDBOX_SCENARIOS.find(option=>option.id===nextScenario)?.id ?? sandboxScenarioId;
      setSandboxScenarioId(id);setBattle(createCombatSandboxScenario(id));return;
    }
    // A new scenario starts as authored; inspiration spent on redraws stays spent.
    if (nextScenario) { setScenarioId(nextScenario); setBattle((current) => newBattle({ ...scenarioById(nextScenario).setup, maxAP: current.maxAP, playerAmbush: nextScenario === BATTLE_SCENARIOS[0].id, inspiration: Object.fromEntries(current.party.map((a) => [a.id, a.inspiration])) })); return; }
    setBattle((current) => newBattle({
      ...scenarioById(scenarioId).setup,
      maxAP: current.maxAP,
      playerAmbush: scenarioId === BATTLE_SCENARIOS[0].id,
      mochi: current.party.some((a) => a.id === 'mochi'), slimes: current.foes.length,
      spirits: Object.fromEntries(current.party.map((a) => [a.id, a.spirits])),
      inspiration: Object.fromEntries(current.party.map((a) => [a.id, a.inspiration])),
    }));
  };

  /** Several Kin radials can be open together; the Momentum radial is exclusive. */
  const performManeuver = (action: (state: BattleState)=>BattleState, fromAbility=false) => {
    if(battlePaused && !fromAbility)return;
    const current=latest.current,next=action(current);if(next===current)return;
    cancel();setRetrieval(null);setSelection(null);setWithdrawPreview(false);setSolverSession(value=>value+1);
    if(next.reposition?.serial!==current.reposition?.serial){
      for(const id of next.reposition?.removedIds ?? []){
        const source=cardRefs.current.get(id);if(!source)continue;
        const rect=source.getBoundingClientRect(),ghost=source.cloneNode(true) as HTMLButtonElement;
        ghost.disabled=true;ghost.inert=true;ghost.setAttribute('aria-hidden','true');
        ghost.style.cssText=`position:fixed;left:${rect.x}px;top:${rect.y}px;width:${rect.width}px;height:${rect.height}px;--classic-card-w:${rect.width}px;pointer-events:none;z-index:65000;`;
        document.body.append(ghost);
        const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
        const animation=trackGameAnimation(ghost.animate(reduced?[{opacity:1},{opacity:0}]:[
          {opacity:1,transform:'none'},{opacity:0,transform:'translateY(-48px) rotateY(80deg) scale(.8)'},
        ],{duration:reduced?80:320,easing:'ease-in',fill:'forwards'}));
        const done=()=>{animation.cancel();ghost.remove();flights.current.delete(done);};
        flights.current.add(done);animation.onfinish=done;
      }
    }
    setBattle(next);
    setAnnouncement(next.turn==='enemy'?(next.pendingWithdraw?'Enemy prepares Withdraw. Interrupt with Momentum or allow the shift.':'Enemy turn'):'Player turn');
  };

  // Small Woods at table:0,-1 supplies the field's established scenery and lighting.
  const rig = createTableauLightRig(hours, { x: 0, y: -48 }, lights);
  const target = enemyTarget(battle);
  const hasMochi = battle.party.some((a) => a.id === 'mochi');
  const heroCal = battle.party.find((a) => a.id === 'hero')?.spirits.includes('cal') ?? false;
  const playableAttack = aim && !abilityInspection ? actorAttack(battle, aim.actorId) : null;
  const heldAttack = aim ? actorAttack(battle, aim.actorId) ?? inspectActorAbility(battle, aim.actorId) : null;
  const previews = new Map(aim && !abilityInspection ? [...battle.party, ...battle.foes].map((unit) => [unit.id, previewAttack(battle, aim.actorId, unit.id)]) : []);
  const trapPreviews = aim && !abilityInspection && battle.rules.traps ? battle.columns.map((_, column) => previewTrap(battle, aim.actorId, column)) : [];
  const aimedColumn = aim?.foeId?.startsWith('card:') ? Number(aim.foeId.slice(5)) : null;

  const scenario = scenarioById(scenarioId);
  const plans = sandbox ? tableauPlans(battle) : [];
  const concealTableau = (holding || globalPaused || combatInspection.active || sandbox && skillMenuOpen) && !(withdrawSelecting && !paused && !gameTime.isPlayerPaused());

  const foeRow = <div className="battle-field__team" data-team="enemy" style={{ '--slots': battle.foes.length } as CSSProperties}>
    <h3>Enemies</h3>
    {battle.foes.map((foe) => <FoeCard key={foe.id} foe={foe} duskwoodBark={battle.sandboxScenario==='007'} target={target?.name ?? null} targetId={target?.id} events={battle.events}
      enemyTurn={sandbox && battle.turn==='enemy'}
      statusIcons={battle.tutorial ? <BattleStatusIcons unit={foe} battle={battle} /> : undefined} tutorialIntent={battle.tutorial ? tutorialIntent(foe, target?.name ?? null) : undefined}
      preview={previews.get(foe.id) ?? null} focus={aim?.foeId === foe.id} aiming={sandbox ? !battlePaused && !battle.result : Boolean(aim && playableAttack && !paused)}
      targeters={sandbox ? battle.party.filter(a=>a.hp>0 && a.targetId===foe.id).map(a=>({id:a.id,name:a.name})) : undefined}
      interaction={sandbox ? {onClick:()=>{if(targetPicker && !battlePaused){setBattle(b=>setActorTarget(b,targetPicker,foe.id));setTargetPicker(null);}}} : foeProps(foe.id)}
      sprite={foe.appearance==='khad-root'
        ? <img className="battle-field__khad-root" src={`${import.meta.env.BASE_URL}assets/runtime/ui/quests/khad-roots-berry-bush-night-paint-v1.png`} alt="Dark crimson-thorned Khad Root" />
        : <FoundationSprite sprite={SPRITES[foe.id]} name={foe.name} lighting={rig.standee(0, -55, 64)} turnedAway={ambushed} />} />)}
  </div>;

  const partyRow = <div className="battle-field__team" data-team="party" data-momentum={sandbox || undefined} style={{ '--slots': battle.party.length } as CSSProperties}>
    <h3>Players</h3>
    {battle.party.map((actor) => {
      const canRedraw = (!sandbox || battle.turn==='party') && actor.inspiration > 0 && actor.hp > 0 && !battle.result && !battlePaused;
      return <div key={actor.id} className="battle-field__slot" data-battle-slot={actor.id} data-down={actor.hp <= 0 || undefined}>
        {sandbox && <div className="battle-party-buffs">{actor.rooted && <button type="button" className="battle-buff-icon battle-debuff-icon" data-debuff="snaring-khad-roots" aria-label="Snaring Khad Roots" data-game-tooltip="Cannot receive tableau cards or Withdraw. Abilities remain available. Break the caster’s stagger gauge to release the team.">🌿</button>}{actor.controller==='npc' && <button type="button" className="battle-buff-icon" data-buff="precipice-of-night" aria-label="Precipice of Night" data-game-tooltip="NPC ally. Dark abilities cost self-stagger instead of Momentum. Cannot receive manual tableau plays.">🌘</button>}{actor.disarmed && <DisarmedBadge name={actor.name}/>} {battle.cir?.status==='bound' && battle.cir.actorId===actor.id && <CirFamiliarBuff kin={battle.cir.actorId} disabled={battlePaused && !combatInspection.active || Boolean(battle.result) || battle.turn!=='party'} onInspect={()=>setCirInspection(true)} />} {battle.tutorial && <BattleStatusIcons unit={actor} battle={battle} onInsight={()=>setInsightOpen(true)} />}{actor.stickyPaws && <button type="button" className="battle-buff-icon" data-buff="sticky-paws" aria-label="Sticky Paws · Next attack steals" data-game-tooltip="Sticky Paws: Mochi’s next attack steals the target’s top foundation card. If emptied, it becomes Disarmed and spends its next turn rearming.">🐾</button>}</div>}
        <button type="button" className={`battle-field__foundation ${sandbox ? "battle-foundation--unified" : ""}`} data-battle-actor={actor.id}
          data-battle-target={actor.id} data-targetable={Boolean(previews.get(actor.id) && !paused) || selection?.actorIds.includes(actor.id) || undefined}
          data-preview={previews.get(actor.id) ? (aim?.foeId === actor.id ? 'focus' : 'faint') : undefined}
          {...(aim && playableAttack && !paused ? foeProps(actor.id) : {})}
          disabled={aim ? !previews.get(actor.id) || paused : !!selection && !selection.actorIds.includes(actor.id)}
          onPointerDown={sandbox ? event=>{
            if(actor.controller==='npc' || battlePaused || battle.result || actor.hp<=0 || selection || event.button!==0)return;
            dragRef.current={actorId:actor.id,x:event.clientX,y:event.clientY,moved:false};
            event.currentTarget.setPointerCapture(event.pointerId);
          } : undefined}
          onPointerMove={sandbox ? event=>{
            const drag=dragRef.current;if(!drag || battlePaused)return;
            if(Math.hypot(event.clientX-drag.x,event.clientY-drag.y)>6)drag.moved=true;
            if(drag.moved){const over=document.elementFromPoint(event.clientX,event.clientY)?.closest<HTMLElement>('.battle-foe')?.dataset.battleTarget ?? null;
              setTargetDrag({actorId:drag.actorId,x:event.clientX,y:event.clientY,over});}
          } : undefined}
          onPointerCancel={()=>{dragRef.current=null;setTargetDrag(null);}}
          onPointerUp={sandbox ? event=>{
            const drag=dragRef.current;dragRef.current=null;setTargetDrag(null);
            if(!drag?.moved)return;suppressTargetClick.current=true;
            const over=document.elementFromPoint(event.clientX,event.clientY)?.closest<HTMLElement>('.battle-foe')?.dataset.battleTarget;
            if(over && !battlePaused){setBattle(b=>setActorTarget(b,drag.actorId,over));setAnnouncement(actor.name+' targets '+battle.foes.find(f=>f.id===over)?.name);}
          } : undefined}
          onClick={event => {
            if(suppressTargetClick.current){suppressTargetClick.current=false;return;}
            if (aim) { if (previews.get(actor.id) && !paused) foeProps(actor.id).onClick(); return; }
            if (selection) { choose(actor.id); return; }
            // Sandbox ability bindings are unwired; card receipt selection remains available.
            if (sandbox) return;
            requestHoloDeviceTilt();
            setInspection({ id: actor.id, name: actor.name, anchor: event.currentTarget });
          }} aria-haspopup={sandbox?undefined:'dialog'} aria-label={`${actor.name} foundation${selection?.actorIds.includes(actor.id) ? ' · choose for selected card' : ''}`} style={rig.surface(55, 60)}>
          <>{sandbox ? <PlayerFoundationFace actor={actor} events={battle.events} paused={presentationPaused} noLegalMoves={noLegalMoves} portraitRef={node=>{if(node)foundationRefs.current.set(actor.id,node);else foundationRefs.current.delete(actor.id);}}/> : <div className="battle-field__pile">
            <div className="battle-field__actor-card proto-lit-surface" ref={node => { if (node) foundationRefs.current.set(actor.id,node); else foundationRefs.current.delete(actor.id); }}>
              <ActorHoloCard actorId={actor.id} name={actor.name} rank={rankLabel(actor.rank)} receivedResources={sandbox ? { inspiration: actor.inspiration } : { AP: actor.charge, inspiration: actor.inspiration }} />
            </div>
          </div>}</>
        </button>
        {!sandbox && <div className="battle-field__side">
          {!sandbox && <div className="battle-moves" role="group" aria-label={actor.name + ' abilities'}>
            <strong>{battle.maxAP ? '∞ AP (maxAP)' : `${actor.charge} AP banked`}</strong>
            <AbilityTray actorName={actor.name} abilities={assignedMovesFor(actor.id).map(move => {
              const committed = Math.max(3, battle.maxAP ? gripAP : Math.min(gripAP, actor.charge));
              const key = `${actor.id}:${move.name}${move.name === 'Vice Grip' ? ':' + committed : ''}`;
              const enabled = !holding;
              return <button key={move.name} type="button" className="battle-move" data-combat-inspect={`${move.name}. ${move.description}`} disabled={!enabled} data-ability-actor={key} aria-pressed={aim?.actorId === key || retrieval === key}
                aria-label={move.name} onClick={event => {
                  const rect=event.currentTarget.getBoundingClientRect();
                  setAbilityAnchor({x:Math.max(12,Math.min(window.innerWidth-230,rect.right+12)),y:Math.max(48,Math.min(window.innerHeight-350,rect.top-120))});
                  if(move.retrieval){cancel();setRetrieval(key);setAnnouncement(move.name+' · Choose a highlighted tableau card');}else{setRetrieval(null);prime(key);}
                }}><span className="battle-move__name">{move.name}</span><span className="battle-move__cost" aria-label={`${move.name==='Dig'?'Variable':move.cost}${move.name === 'Vice Grip' ? ' minimum' : ''} AP`}>{move.name==='Dig'?'Variable':move.cost}{move.name === 'Vice Grip' ? '+' : ''} AP</span></button>;
            })} />
            {battle.foes.some(f => f.gripSource === actor.id && f.effects.some(e => e.kind === 'grip')) && <button type="button" disabled={battlePaused || Boolean(battle.result)} onClick={() => setBattle(b => releaseGrip(b, actor.id))}>Release hold</button>}
          </div>}
          {!sandbox && <button type="button" className="battle-field__redraw" data-redraw-actor={actor.id} disabled={!canRedraw} onClick={() => redraw(actor.id)}
            aria-label={`Redraw ${actor.name}'s foundation for 1 inspiration · ${actor.inspiration} inspiration left`}
            title={actor.inspiration > 0 ? `Redraw: stuck? Swap ${actor.name}'s foundation value for a new one. Costs 1 inspiration (${actor.inspiration} left).` : `${actor.name} has no inspiration left to redraw`}>
            <span aria-hidden="true">↻ Redraw</span><span className="battle-field__redraw-left" aria-hidden="true">{actor.inspiration}</span>
          </button>}
        </div>}
        {!sandbox && <PartyVitals actor={actor} preview={aim?.foeId === actor.id ? previews.get(actor.id)?.hp.after : undefined} count={actor.count} events={battle.events} targeted={(!sandbox || battle.turn==='enemy') && battle.started && !battle.result && target?.id === actor.id} />}

      </div>;
    })}
    {sandbox && hasHoldSlot(battle) && battle.party.map(actor => { const held = heldCard(battle, actor.id); return <HoldSlot key={'hold-'+actor.id} actorId={actor.id} card={held}
      targetable={Boolean(selection?.actorIds.includes(holdReceiver(actor.id)))} concealValue={concealTableau} disabled={battlePaused || !heldReceivers(battle, actor.id).length}
      cardRef={node => { if (!held) return; if (node) { cardRefs.current.set(held.id,node); node.dataset.battleCard=held.id; node.dataset.battleRank=String(held.rank); } else cardRefs.current.delete(held.id); }}
      onChoose={() => choose(holdReceiver(actor.id))} onActivate={source => activateHeld(actor.id, source)}
      onDropActor={target => { const id = target.dataset.battleActor, source = held && cardRefs.current.get(held.id); if (id && source && !battlePaused) playFromHold(actor.id, source, id); }} />; })}
    {sandbox && !battle.party.some(a=>a.controller==='npc') && <div className="battle-field__slot" data-battle-slot="empty">
      <div className="battle-field__foundation battle-field__foundation--empty" role="img" aria-label="Empty player foundation">
        <span aria-hidden="true">◇</span>
        <span>Empty</span>
      </div>
    </div>}
  </div>;

  const renderColumn = (column: Card[], index: number) => <div className="battle-field__column" key={index} style={{ '--cards': Math.max(1,column.length) } as CSSProperties}
              data-withdraw-preview={withdrawPreview && column.length>0 || undefined} data-battle-target={`card:${index}`} data-targetable={Boolean(trapPreviews[index]) || undefined}
              data-preview={trapPreviews[index] ? (aimedColumn === index ? 'focus' : 'faint') : undefined}>
              {column.map((card, depth) => <ProtoCard key={card.id} card={card} allowJumbo={false} concealValue={concealTableau} disabled={battlePaused || (retrieval ? retrievalCost(battle,retrieval,index,depth)===null : depth < column.length - 1 || !tableauReceivers(battle, card).length)} footerLabel={retrieval && retrievalCost(battle,retrieval,index,depth)!==null ? retrievalCost(battle,retrieval,index,depth)+' AP' : undefined} buried={depth < column.length - 1} centerRank={depth === column.length - 1} lit
                active={!holding && (selection?.cardId === card.id || !!retrieval && retrievalCost(battle,retrieval,index,depth)!==null)} selected={!holding && selection?.cardId === card.id}
                cardRef={node => { if (node) { cardRefs.current.set(card.id,node); node.dataset.battleCard=card.id; node.dataset.battleRank=String(card.rank); } else cardRefs.current.delete(card.id); }}
                onDropActor={sandbox && !retrieval ? target=>{
                  const actorId=target.dataset.battleActor;
                  const source=cardRefs.current.get(card.id);
                  if(!actorId || !source || battlePaused || latest.current.columns[index]?.slice(-1)[0]?.id!==card.id)return;
                  play(index,source,actorId);
                } : undefined}
                onClick={event => {if(retrieval){setBattle(current=>retrieveCard(current,retrieval,index,depth));setRetrieval(null);}else activate(index,event.currentTarget);}}
                style={{ position: 'absolute', left: 0, top: `calc(var(--battle-peek) * ${depth})`, zIndex: depth + 1, ...rig.surface(index * 14 - 42, 0) }} />)}
              <PlanSegments plans={plans} column={column} />
              {column.length > 0 && !sandbox && <TableMark depth={column.length - 1} trap={battle.traps[column[column.length - 1].id]}
                eyes={battle.foes.filter((foe) => foe.hp > 0 && foe.eye?.cardId === column[column.length - 1].id)}
                party={battle.party} />}
            </div>;

  const endTurnControl = <SceneButton type="button" className="battle-end-turn" disabled={battlePaused || !canEndPlayerTurn(battle)}
              title={battlePaused?'Combat paused':battle.turn==='enemy'?'Enemy turn':battle.result?'Battle complete':canEndPlayerTurn(battle)?'Pass control to the enemy team':'Scripted rescue in progress'}
              onClick={()=>performManeuver(endPlayerTurn)}>END TURN</SceneButton>;
  const withdrawControl = <SceneButton type="button" className="battle-withdraw-button" disabled={battlePaused || !canUseMomentumSkill(battle,'withdraw')} onClick={()=>{cancel();setSelection(null);setSkillOwners([]);setDirectWithdraw(true);setSkillMenuOpen(true);}}>WITHDRAW</SceneButton>;
  const pityControl = sandbox && hasPityDraw(battle) && <SceneButton type="button" className="battle-pity-button" disabled={battlePaused || !canPityFlip(battle)}
              title={canPityFlip(battle) ? 'Nothing is legal: flip one free stock card onto your foundation' : 'Only when a turn opens with nothing legal, once per turn'}
              onClick={()=>{const next=pityFlip(latest.current);if(next===latest.current)return;cancel();setSelection(null);setBattle(next);setAnnouncement(`Pity flip: foundation is now ${rankLabel(next.party.find(actor=>actor.hp>0)?.rank ?? 1)}`);}}>PITY FLIP</SceneButton>;
  const sandboxUtilityControls = <>{battle.result ? <SceneButton type="button" onClick={() => restart()}>Fight again</SceneButton> : <>
              <SceneButton type="button" aria-pressed={paused} disabled={!battle.started || holding} onClick={() => { cancel(); setSelection(null); setPaused((p) => !p); }}>{paused ? 'Resume' : 'Pause'}</SceneButton>
              <SceneButton type="button" disabled={holding} onClick={() => restart()}>Restart</SceneButton>
            </>}</>;
  const solveControls = <TableauSolveControls singleMoveTarget={sandbox?singleMoveTarget:undefined} controlShortcut={sandbox} hideStatus={sandbox} highlight={highlightLegal} onHighlightChange={sandbox?setHighlightLegal:undefined} key={solverSession} onStep={solveStep} onStart={() => { cancel(); setRetrieval(null); setSelection(null); }} disabled={battlePaused || Boolean(battle.result) || sandbox && battle.turn==='enemy'} allowDivine={false} />;

  return <section ref={fieldRef} className="battle-field" style={{'--combat-ability-slots': COMBAT_ABILITY_SLOTS, '--tableau-card-limit': `${Number.isFinite(tableauCardLimit) ? tableauCardLimit : 10000}px`} as CSSProperties} data-camera-background={active || undefined} data-first-team={BATTLE_TURN_PRIORITY[0]}
    data-night-cloud={battle.night?.cloud || undefined} data-night-phase={battle.night?.phase} data-night-step={battle.night?.step} data-highlight-legal={sandbox?highlightLegal:undefined} data-team-turn={sandbox ? battle.turn : undefined} data-combat-paused={presentationPaused || undefined} data-target-drag={targetDrag?.over ?? undefined} data-result={battle.result ?? undefined} data-tactical-paused={holding || globalPaused || combatInspection.active || undefined} data-aiming={aim && !abilityInspection ? aim.mode : undefined} aria-label="Battle foundations and shared woods tableau">
    {combatInspection.overlay}
    {sandbox && <CombatTurnBanners key={sandboxScenarioId+'-'+bannerSession} battle={battle} paused={presentationPaused} />}
    {battle.night && <NightRescueScene key={solverSession} battle={battle} setBattle={setBattle} fieldRef={fieldRef} paused={paused || holding || globalPaused || Boolean(inspection)} onBlocking={setNightBlocking}/>}
    <header className="battle-field__header">
      {sandbox && <label className="battle-controls__sandbox-scenario"><span className="sr-only">Combat scenario</span>
        <select aria-label="Combat scenario" value={sandboxScenarioId} onChange={event=>restart(event.target.value)}>
          {COMBAT_SANDBOX_SCENARIOS.map(option=><option key={option.id} value={option.id}>{option.name}</option>)}
        </select>
      </label>}
      {sandbox && tutorialRounds(battle)!==null && <output className="battle-rounds" aria-live="polite">Rounds completed: {tutorialRounds(battle)}</output>}
      {sandbox && <SceneButton className="combat-sandbox__camera-toggle" type="button" aria-pressed={cameraOpen} onClick={onWatch}>{cameraOpen ? 'Close camera' : 'Load battle camera'}</SceneButton>}
      {!sandbox && <>{solveControls}<h2>Dark Woods</h2></>}{retrieval && <button type="button" onClick={()=>setRetrieval(null)}>Cancel {retrieval.split(':')[1]}</button>}
      <fieldset className="battle-controls" aria-label="Battle setup" disabled={holding || sandbox && battle.turn==='enemy'}>
        {!sandbox && <label className="battle-controls__scenario" title={scenario.blurb}>
          <select aria-label="Scenario" value={scenarioId} onChange={(event) => restart(event.target.value)}>
            {BATTLE_SCENARIOS.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}
          </select>
        </label>}
        {!sandbox && <label className="battle-controls__max-ap" title="Debug: unlimited ability AP for all player actors. Banked AP is preserved.">
          <input type="checkbox" checked={battle.maxAP} onKeyDown={event=>{if(event.key==='Enter'){event.preventDefault();event.currentTarget.click();}}} onChange={event => {cancel();setBattle(current=>setMaxAP(current,event.target.checked));}} />
          <span>maxAP</span>
        </label>}
        {sandbox ? <details className="battle-config"><summary>⚙ Config</summary><div className="battle-config__panel" role="group" aria-label="Sandbox configuration"><label className="battle-config__value-style">Momentum numerals<select value={momentumValueStyle} onChange={event=>setMomentumValueStyle(event.target.value as MomentumValueStyle)}><option value="flamelab">Flame lab</option><option value="stroked">Stroked</option></select></label><label><input type="checkbox" checked={battle.momentum?.decayEnabled!==false} onChange={event=>setBattle(state=>setMomentumDecay(state,event.target.checked))}/> Momentum decay</label><SceneButton type="button" aria-pressed={hasMochi} onClick={() => setBattle((b) => setMochi(b, !hasMochi))}>{hasMochi ? 'Remove Mochi' : 'Add Mochi'}</SceneButton></div></details> : <SceneButton type="button" aria-pressed={hasMochi} onClick={() => setBattle((b) => setMochi(b, !hasMochi))}>{hasMochi ? 'Remove Mochi' : 'Add Mochi'}</SceneButton>}
        {!sandbox && <span className="battle-controls__stepper" role="group" aria-label={`Slimes: ${battle.foes.length}`}>
          <SceneButton type="button" aria-label="Remove a slime" disabled={battle.foes.length <= 1} onClick={() => setBattle(removeSlime)}>−</SceneButton>
          <span aria-hidden="true">Slimes {battle.foes.length}</span>
          <SceneButton type="button" aria-label="Add a slime" disabled={battle.foes.length >= MAX_FOES} onClick={() => setBattle(addSlime)}>+</SceneButton>
        </span>}
        {!sandbox && <SceneButton type="button" aria-pressed={heroCal} title="Cal, a fire spirit: Hero's ability gains fire above combo 3" onClick={() => setBattle((b) => setSpirit(b, 'hero', 'cal', !heroCal))}>Cal {heroCal ? 'on' : 'off'}</SceneButton>}
      </fieldset>
    </header>
    {targetDrag && createPortal(<div className="battle-target-ghost" style={{left:targetDrag.x,top:targetDrag.y}} aria-hidden="true">
      <ActorHoloCard actorId={targetDrag.actorId} name={battle.party.find(a=>a.id===targetDrag.actorId)?.name ?? ''} rank={rankLabel(battle.party.find(a=>a.id===targetDrag.actorId)?.rank ?? 1)} />
    </div>,document.body)}
    <span className="sr-only" role="status">{announcement}</span>
    {inspection && <DetailsCardViewer key={inspection.id} initialJumboId={inspection.id}
      anchor={inspection.anchor} timeOfDay={hours} lights={[...lights]} position={{ x: 0, y: -48 }}
      objects={[{ id: inspection.id, name: inspection.name, badge: '♟', badgeLabel: 'Actor',
        art: <ActorCardArt sprite={ACTOR_HOLO_ART[inspection.id]} label={inspection.name} />,
        descriptor: `${inspection.name} · battle scene actor`,
        trays: [{ id: 'stats', label: 'Foundation', details: (() => { const actor = battle.party.find((a) => a.id === inspection.id); return actor ? `Rank ${rankLabel(actor.rank)} · Collected ${actor.count} · Inspiration ${actor.inspiration}` : 'Left the battle'; })() }] }]}
      onClose={() => setInspection(null)} onCloseObject={() => setInspection(null)} />}
    {abilityInspection && <DetailsCardViewer initialJumboId={'ability-'+abilityInspection.attack.actorId+'-'+abilityInspection.attack.form}
      anchor={abilityInspection.anchor} timeOfDay={hours} lights={[...lights]} position={{x:0,y:-48}}
      objects={[{ id:'ability-'+abilityInspection.attack.actorId+'-'+abilityInspection.attack.form, name:abilityInspection.attack.name,
        badge:abilityInspection.attack.charge+' AP', badgeLabel:'Action point cost',
        art:<AbilityArtwork name={abilityInspection.attack.form} fire={abilityInspection.attack.element==='fire'} fallback={<ActorCardArt sprite={ACTOR_HOLO_ART[abilityInspection.attack.actorId]} label={abilityInspection.attack.name} />} />,
        descriptor:combatMovesFor(abilityInspection.attack.actorId).find(move=>move.name===abilityInspection.attack.form)?.description ?? '',
        trays:[], footer:abilityInspection.attack.charge+' AP required' }]}
      onClose={() => setAbilityInspection(null)} onCloseObject={() => setAbilityInspection(null)} />}
    {sandbox && battle.momentum && createPortal(<div className="battle-momentum-overlay"><MomentumEngine valueStyle={momentumValueStyle} showDecay={false} paused={presentationPaused} timeScale={battleTimeScale(battle)} pool={battle.momentum} onOpenSkills={()=>{if(!nightBlocking && !battle.result && !paused && !holding && !globalPaused && !abilityCast){cancel();setSelection(null);setSkillOwners([]);setDirectWithdraw(false);setSkillMenuOpen(true);}}} onDecayChange={enabled=>setBattle(state=>setMomentumDecay(state,enabled))} /></div>, document.querySelector('.combat-sandbox') ?? document.body)}
    <TableauScene immersive={false} terrain="woods" biome={{ terrain: 'woods', danger: true }} rig={rig} hours={hours}>
      <div className="battle-field__board">
        {sandbox && battleTimeScale(battle)<1 && <BattleBulletTime />}
        {sandbox && <BattleTargetArrows battle={battle} />}
        {foeRow}
        <div className="battle-field__middle">
          <div className="battle-field__tableau" role="group" aria-label="Shared tableau · Small Woods at 0,-1">
            <div className="battle-field__rack" style={sandbox ? { '--rack-columns': tableauWidth(battle) + (battle.tutorial?.intent ? 1 : 0) } as CSSProperties : undefined}>
            {battle.columns.slice(0,sandbox ? tableauWidth(battle) : undefined).map(renderColumn)}
            {sandbox && <IntentCardSlot battle={battle} targetable={Boolean(selection?.actorIds.includes(INTENT_RECEIVER))} concealValue={concealTableau} disabled={battlePaused}
              cardRef={node => { intentRef.current = node; }} onChoose={() => choose(INTENT_RECEIVER)} />}
            <PlanLegend plans={plans} />
            </div>
          </div>
          {sandbox && <div className="battle-spills" role="group" aria-label="Loose tableau cards">
            {battle.columns.slice(tableauWidth(battle)).map((column,i)=>column.length ? renderColumn(column,i+tableauWidth(battle)) : null)}
          </div>}
          <div className="battle-field__status">
            <div className="battle-field__status-actions">
            {sandbox && battle.pendingWithdraw && !battle.result && <div className="battle-withdraw-reaction" role="region" aria-label="Enemy Withdraw response">
              <div><strong>{battle.foes.find(foe=>foe.id===battle.pendingWithdraw!.foeId)?.name} prepares Withdraw</strong>
                <span>All {battle.columns.flat().length} tableau cards will be replaced. Your turn follows.</span></div>
              <SceneButton type="button" disabled={battlePaused || !canInterruptWithdraw(battle)} onClick={()=>performManeuver(interruptEnemyWithdraw)}
                title={canInterruptWithdraw(battle)?'Spend Momentum to preserve this tableau and regain your turn':`Requires ${WITHDRAW_INTERRUPT_COST} Momentum; you have ${battle.momentum?.value ?? 0}`}>
                Interrupt · <MomentumIcon /> {WITHDRAW_INTERRUPT_COST} Momentum
              </SceneButton>
              <SceneButton type="button" disabled={battlePaused} onMouseEnter={()=>setWithdrawPreview(true)} onMouseLeave={()=>setWithdrawPreview(false)} onFocus={()=>setWithdrawPreview(true)} onBlur={()=>setWithdrawPreview(false)}
                onClick={()=>performManeuver(resolveEnemyWithdraw)}>Allow Withdraw</SceneButton>
            </div>}
            {!sandbox && <>{battle.result ? <SceneButton type="button" onClick={() => restart()}>Fight again</SceneButton> : <>
              <SceneButton type="button" aria-pressed={paused} disabled={!battle.started || holding} onClick={() => { cancel(); setSelection(null); setPaused((p) => !p); }}>{paused ? 'Resume' : 'Pause'}</SceneButton>
              <SceneButton type="button" disabled={holding} onClick={() => restart()}>Restart</SceneButton>
              <SceneButton type="button" disabled={!canDeal(battle) || battlePaused} title="Deal one card onto every column with room" onClick={() => setBattle(dealRow)}>Deal a row</SceneButton>
            </>}</>}
            </div>
          </div>
        </div>
        {partyRow}
      </div>
    </TableauScene>
    {sandbox && skillMenuOpen && !battle.result && <MomentumSkillRadial initialSkill={directWithdraw?'withdraw':undefined} onWithdrawSelecting={setWithdrawSelecting} key={skillOwners.length?'kin':'momentum'} owners={skillOwners} valueStyle={momentumValueStyle} battle={battle} fieldRef={fieldRef} disabled={paused || holding || globalPaused && (!combatInspection.active || gameTime.isPlayerPaused())} onClose={()=>{setSkillMenuOpen(false);setSkillOwners([]);}} onChoose={(id,targetId)=>{if(id==='withdraw'){setSkillMenuOpen(false);performManeuver(state=>useMomentumSkill(state,id,targetId),true);return;}const card=document.querySelector<HTMLElement>('.ability-fan__drag, .ability-fan__armed-preview') ?? document.querySelector<HTMLElement>(`.ability-fan button[data-skill="${id}"]`);if(!card)return;setAbilityCast({id,targetId,card:card.cloneNode(true) as HTMLElement,origin:card.getBoundingClientRect()});setSkillMenuOpen(false);setSelection(null);}} />}
    {cirInspection && battle.cir?.status==='bound' && <CirFamiliarInspector kin={battle.cir.actorId} disabled={paused || holding || gameTime.isPlayerPaused()} onClose={()=>setCirInspection(false)} onReturn={()=>{setBattle(returnCirToDeck);setCirInspection(false);}} />}
    {abilityCast && <MomentumAbilityFlight cast={abilityCast} fieldRef={fieldRef} paused={paused || holding || globalPaused} onImpact={()=>{if(abilityCast.id==='focus-fire')burnCardsFx(focusFireCards(latest.current,abilityCast.targetId).flatMap(card=>cardRefs.current.get(card.id) ?? []));setBattle(state=>useMomentumSkill(state,abilityCast.id,abilityCast.targetId));}} onComplete={()=>setAbilityCast(null)} />}
    {!sandbox && <BattleDamageCallouts battle={battle} fieldRef={fieldRef} paused={battlePaused} />}
    {sandbox && <div className="battle-field__solver-dock"><div className="battle-field__solver-actions">{solveControls}{sandboxUtilityControls}</div><div className="battle-field__turn-actions"><div ref={setSingleMoveTarget} className="battle-field__single-move" />{endTurnControl}{withdrawControl}{pityControl}</div></div>}
    {sandbox && battle.result && (battle.result!=='won' || finishedDefeat>=lastDefeat) && <CombatScenarioComplete scenarioId={sandboxScenarioId} won={battle.result==='won'} onChoose={restart} detail={tutorialRounds(battle)!==null ? `Rounds completed: ${tutorialRounds(battle)}` : undefined} />}
    {insightOpen && tutorialById(battle.tutorial?.id) && <InsightDialog scenario={tutorialById(battle.tutorial?.id)!} onClose={()=>setInsightOpen(false)} />}
    {!active && <footer className="battle-field__footer"><SceneButton type="button" onClick={onWatch}>Watch battle scene</SceneButton></footer>}
    {aim && heldAttack && createPortal(<><div className="ability-card-popover" style={{left:abilityAnchor.x,top:abilityAnchor.y,opacity:aim.mode==='drag'?0:1,visibility:abilityInspection?'hidden':undefined}} role="region" aria-label="Primed ability">
          <button className="ability-card-popover__close" type="button" onClick={cancel} aria-label="Cancel ability">×</button>
          <AbilityCard attack={heldAttack} unavailableReason={!playableAttack ? 'Not enough AP to play · Click to inspect' : undefined} interaction={cardProps(aim.actorId,!paused && !battle.result,anchor => setAbilityInspection({attack:heldAttack,anchor}))} />
          {heldAttack.form === 'Vice Grip' && <label className="ability-card-popover__commit">Commit AP <input type="number" min="3" max={battle.maxAP ? undefined : Math.max(3,battle.party.find(a=>a.id===heldAttack.actorId)?.charge ?? 0)} value={heldAttack.charge} aria-label="AP to commit to Vice Grip"
            onChange={event=>{const points=Math.max(3,Math.floor(Number(event.target.value))||3);setGripAP(points);prime(heldAttack.actorId+':Vice Grip:'+points);}} /></label>}
        </div>{aim.mode==='drag' && <div className="ability-card-drag" style={{left:aim.x,top:aim.y}} aria-hidden="true"><AbilityCard attack={heldAttack} ghost /></div>}</>, document.body)}
  </section>;
}
