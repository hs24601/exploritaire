import {useGrit} from '../rules/grit';
import {Grit,GritBuffIcon} from './Grit';
import {canFetchMusical, castAdept, digAdept, digTargets, fetchMusical, playDigReceipt} from '../rules/adept';
import {canPlaceSnowflake,placeSnowflake,type StickerMemory} from '../rules/snowflakeReward';
import {SnowflakeDrag,useFlurryOpeningDrift} from '../../sticker/SnowflakeDrag';
import {readWorldFlurry,saveWorldFlurry} from '../../sticker/worldFlurryInventory';
import {FlurryMemory} from '../../sticker/FlurryMemory';
import {SnowflakeRewardShade} from '../../sticker/SnowflakeRewardShade';
import {FlurryAmbiance} from '../../sticker/SnowflakeSticker';
import {Adept,AdeptFace} from './Adept';
import {adeptExpression} from '../rules/adeptData';
import {ScenarioShare} from './ScenarioShare';
import {MusicalSummons} from './MusicalSummons';
import {PackLeaderBuff} from './PackLeaderCard';
import {PackLeaderControls} from './PackLeaderControls';
import {useCardJumbo} from './CardJumbo';
import {KeruFoundationJumbo} from './KeruFoundationJumbo';
import {PrimeTableauValue} from './PrimeTableauValue';
import {FastSwipesFace} from './FastSwipesCard';
import {fastSwipesDescription,fastSwipesSpec} from '../rules/fastSwipesData';
import type {CardRarity} from '../cardRarity';
import { BiteFace } from './BiteCard';
import { MoteRecipeControls } from './MoteRecipeControls';
import { useGlobalLights, setGlobalLightsEnabled } from '../globalLighting';
import { MochiEmoji } from './MochiEmoji';
import { KeruExpression } from './KeruExpression';
import { BanksEmoji } from './BanksEmoji';
import { RecommendedMoveArrow } from './RecommendedMoveArrow';
import { VERTICAL_ROWS, verticalCanReach, verticalReach, verticalEntries, isVerticalScenario, verticalSlot, floorSlot, floorCell, floorLayout, isTiledFloor, verticalStand, steppingScene } from '../rules/verticalColumns';
import { legalCardRanks } from '../rules/battle';
import { foundationSummon, FOUNDATION_SUMMON_SLOT } from '../rules/battleStatusData';
import './LayoutLaboratory.css';
import { LAYOUT_EXPERIMENTS, laneLabel, laneReach, moveExperiment } from '../rules/layoutExperiment';
import { createLayoutExperiment, playExperimentReserve, canPlay, digReceiptReceiver } from '../rules/battle';
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
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode, type CSSProperties } from 'react';
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
  releaseGrip, MAX_FOES, actorAttack, inspectActorAbility, addSlime, applyAttack, applyTrap, canDeal, canEndPlayerTurn, endPlayerTurn, createBattle, setActorTarget, dealRow, eligibleActors, enemyTarget, playCard,
  previewAttack, previewTrap, redrawActor, removeSlime, setMochi, setSpirit, setMaxAP, tickBattle, type BattleState,
} from '../rules/battle';
import { COMBAT_ABILITY_SLOTS, combatMovesFor, type Attack } from '../rules/battleAbilities';
import { BATTLE_SCENARIOS, scenarioById } from '../rules/battleScenarios';
import { COMBAT_SANDBOX_SCENARIOS, type CombatSandboxScenarioId } from '../rules/battleSandboxScenarios';
import { packLeaderReady, promoteWithPackLeader, setPackLeaderTuning, PRIME_TRANSFER_COST, primeFoundationId, transferPrimeFoundation, startMusicalBattle, equipBite, equipFastSwipes, setFastSwipesTier, castBite, createPlayableSandboxScenario, tableauWidth } from '../rules/battle';
import { IntentCardSlot, HoldSlot } from './BattleDeadRun';
import { PlanLegend, PlanSegments } from './TableauPlanMarkers';
import { tableauPlans } from '../rules/battlePlans';
import { anyLegalPlay, canPityFlip, hasHoldSlot, heldCard, heldReceivers, holdCard, holdOwner, holdReceiver, INTENT_RECEIVER, intentDef, playHeld, playOnIntent, pityFlip, tableauReceivers } from '../rules/battleDeadRun';
import { getCardTransportDurationMs } from '../protoTransport';
import { solverFlightDuration } from '../solverTiming';
import { createTableauLightRig } from '../tableauLighting';
import type { TableLight } from '../protoLighting';
import { ProtoCard } from './ProtoCard';
import { TableauScene } from './TableauScene';
import { SceneButton } from './SceneButton';
import { SpriteStandeeArt } from './SpriteStandee';
import type { StandeeLighting } from '../protoLighting';
import { FoeCard, SupportKeruFace, PartyVitals, TableMark, PlayerFoundationFace, DisarmedBadge } from './BattleUnits';
import { BattleTargetArrows } from './BattleTargetArrows';
import { MomentumEngine, type MomentumValueStyle } from './MomentumEngine';
import { MomentumIcon } from './MomentumIcon';
import { MomentumSkillRadial } from './MomentumSkillRadial';
import { FamiliarDropSlot, KeruAttachmentTile } from './CirCompanionControls';
import { canTapIn, personalValue, tapInKeru, keruExpeditionSnapshot, type KeruExpedition, type LeaderKeruId } from '../rules/keruLeadership';
import { releaseCir } from '../rules/cirCompanion';
import { CIR_ART } from '../rules/battle';
import { actorElements } from '../rules/elementSuits';
import { MomentumAbilityFlight, type AbilityCast } from './MomentumAbilityFlight';
import { BattleBulletTime } from './BattleBulletTime';
import { battleTimeScale } from '../rules/battle';
import { useMomentumSkill } from '../rules/battle';
import { returnCirToDeck } from '../rules/battle';
import { CirFamiliarBuff, CirFamiliarInspector } from './CirFamiliar';
import { BattleDamageCallouts } from './BattleDamageCallouts';
import { CombatScenarioComplete } from './CombatScenarioComplete';
import { summonSnowGolem, castGlacialLance, golemFarewell } from '../rules/iceAbilities';
import { ICE_REWARDS, rewardHeal, type IceRewardPick } from '../rules/iceRewards';
import { carrySeriesParty, isSeriesEncounter } from '../rules/combatSeries';
import { BattleStatusIcons } from './BattleStatusIcons';
import { burnCardsFx } from './burnCardsFx';
import { focusFireCards } from '../rules/battleStatuses';
import { ScenarioNotes } from './ScenarioNotes';
import { isKeruInvokeScenario, isTruefourstar } from '../rules/battleSandboxScenarios';
import { castKeru, castReason, dismissKeru, feedKeru, feedToNextTier, invokeKeru, invokeReason, pourIntoSeal } from '../rules/keruInvoke';
import { KeruBoardProvider } from './KeruPourCast';
import { KeruFarewellFoeFx, KeruHarnessBadges, KeruInvokeBadge, KeruSquares, SealMeter } from './KeruRarity';
import { INVOKE_BUFFS, KERU_CASTS, type InvokeKeruId } from '../rules/keruInvokeData';
import { ElementGlyph } from './ElementSuits';
import { cardElement, ELEMENT_FACE, kinElement } from '../rules/elementSuits';
import { tutorialIntent, tutorialRounds } from '../rules/battleTutorials';
import { tutorialById } from '../rules/battleTutorialScenarios';
import { canInterruptWithdraw, interruptEnemyWithdraw, resolveEnemyWithdraw, WITHDRAW_INTERRUPT_COST, setMomentumDecay } from '../rules/battle';
import { AbilityTray } from './AbilityTray';
import { AbilityCard } from './AbilityCard';
import { useAbilityDrag } from './useAbilityDrag';
import { useBattleFx } from './useBattleFx';
import { sceneOf, type BattleScene } from '../rules/battleCues';
import './BattleTableauField.css';
import './VerticalColumns.css';
import { BATTLE_TURN_PRIORITY } from '../battleTurnPriority';
import { TableauSolveControls, type SolveStepResult } from './TableauSolveControls';
import { assessSolverMove } from '../tableauSolver';

/** Small Keru faces for 1004 familiar squares and the 1005 invoke badge. */
const keruFace = (who: string) => who==='dem'?<KeruExpression keru="dem" emotion="upset" label="Dem"/>:who==='cir'?<KeruExpression keru="cir" emotion="upset" label="Cir"/>:who==='mochi'?<MochiEmoji emotion="upset" label="Mochi"/>:who==='banks'?<BanksEmoji emotion="fighting" label="Banks"/>:who==='riv'?<span aria-label="Riv">R</span>:null;

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

export function BattleTableauField({ hours, lights, onWatch, active, onSceneChange, heroInspiration, onRedraw, sandbox = false, cameraOpen = false, keruExpedition, onKeruExpeditionChange, encounter, scenarioIds, onBattleChange, musicalCombat = false, biteRarity, configContent }: {
  /** Sandbox pages that offer only some scenarios (117.html: the 100 series). The first is the default. */
  musicalCombat?: boolean;
  configContent?: ReactNode;
  biteRarity?:CardRarity;
  scenarioIds?: readonly string[];
  /** Every battle state change, for presentation layers such as the musical tableaus. */
  onBattleChange?: (battle: BattleState) => void;
  /** A world variant owns entry, persistence and exit; sandbox controls stay private to the sandbox. */
  encounter?: { suppressCompletion?: boolean; recipes?: boolean; rewardChoices?: IceRewardPick[]; chooseLabel?: string; rewardHeading?: string; victoryHp?: number; initialState: BattleState; onChange: (battle: BattleState) => void; onComplete: (battle: BattleState, rewards: IceRewardPick[]) => void };
  sandbox?: boolean;
  keruExpedition?: KeruExpedition;
  onKeruExpeditionChange?: (saved: KeruExpedition) => void;
  cameraOpen?: boolean;
  hours: number; lights: readonly TableLight[]; onWatch: () => void; active: boolean;
  /** Units (fallen ones included) and recent events, for the 3D arena's animations. */
  onSceneChange?: (scene: BattleScene) => void;
  /** The Hero's world inspiration coming into the fight. */
  heroInspiration?: number;
  /** An actor spent 1 inspiration on a foundation redraw. */
  onRedraw?: (actorId: string) => void;
}) {
  const scenarioOptions = scenarioIds ? COMBAT_SANDBOX_SCENARIOS.filter(option=>scenarioIds.includes(option.id)) : COMBAT_SANDBOX_SCENARIOS;
  const [sandboxScenarioId,setSandboxScenarioId]=useState<CombatSandboxScenarioId>(()=>{
    if (encounter?.initialState.sandboxScenario) return encounter.initialState.sandboxScenario;
    const requested=new URLSearchParams(window.location.search).get('scenario');
    return sandbox && scenarioOptions.find(scenario=>scenario.id===requested)?.id || scenarioOptions[0]?.id || '001';
  });
  const foundationJumbo=useCardJumbo();
  const [openingReward]=useState(()=>new URLSearchParams(window.location.search).get('reward'));
  const [openingSnowflake,setOpeningSnowflake]=useState(musicalCombat&&openingReward==='snowflake');
  const [stickerArmed,setStickerArmed]=useState(false);
  const [stickerDragging,setStickerDragging]=useState(false);
  const specifiedReward = musicalCombat && openingReward && Object.prototype.hasOwnProperty.call(ICE_REWARDS,openingReward)
    ? openingReward as IceRewardPick['id'] : undefined;
  const [highlightLegal,setHighlightLegal]=useState(false);
  const [highlightHeld,setHighlightHeld]=useState(false);
  const [singleMoveTarget,setSingleMoveTarget]=useState<HTMLDivElement|null>(null);
  const [skillMenuOpen,setSkillMenuOpen]=useState(false);
  const [directWithdraw,setDirectWithdraw]=useState(false);
  const [withdrawSelecting,setWithdrawSelecting]=useState(false);
  /** Open Kin radials; empty while the Momentum radial (Withdraw only) is open. */
  const [skillOwners,setSkillOwners]=useState<string[]>([]);
  const [cirInspection,setCirInspection]=useState(false);
  const [momentumValueStyle,setMomentumValueStyle]=useState<MomentumValueStyle>('flamelab');
  const [abilityCast,setAbilityCast]=useState<AbilityCast|null>(null);
  const expeditionWriter=useRef(onKeruExpeditionChange);expeditionWriter.current=onKeruExpeditionChange;
  const musicalSetup = (state: BattleState): BattleState => musicalCombat
    ? {...startMusicalBattle(state),snowflakeReward:openingSnowflake?'available':readWorldFlurry()}
    : state;
  const newBattle = (setup: Parameters<typeof createBattle>[1]) => encounter ? structuredClone(encounter.initialState) : sandbox ? musicalSetup(createPlayableSandboxScenario(sandboxScenarioId)) : createBattle(previewDeal, {...setup,keruExpedition});
  useActorLoadouts();
  const globalPaused = useGlobalPaused();
  const [targetDrag,setTargetDrag]=useState<{actorId:string;dig:boolean}|null>(null);
  const targetGhostRef=useRef<HTMLDivElement|null>(null);
  const digTargetMarker=useRef<HTMLDivElement>(null);
  const targetPointer=useRef({x:0,y:0});
  const targetFrame=useRef<number|null>(null);
  const [rewardPreview,setRewardPreview]=useState(()=>sandbox && (musicalCombat
    ? openingReward==='' || Boolean(specifiedReward)
    : openingReward!==null));
  const [targetPicker,setTargetPicker]=useState<string|null>(null);
  const dragRef=useRef<{actorId:string;x:number;y:number;moved:boolean;dig:boolean}|null>(null);
  const suppressTargetClick=useRef(false);
  const [retrieval,setRetrieval]=useState<string|null>(null);
  const [scenarioId, setScenarioId] = useState(BATTLE_SCENARIOS[0].id);
  const [battle, setBattle] = useState(() => newBattle({ ...BATTLE_SCENARIOS[0].setup, playerAmbush: true, inspiration: { hero: heroInspiration } }));
  const openingStickerVisible=musicalCombat&&battle.snowflakeReward==='available'&&!battle.result&&!foundationJumbo?.isOpen;
  const openingStickerAnchor=useFlurryOpeningDrift(openingStickerVisible);
  const battleWatcher = useRef(onBattleChange); battleWatcher.current = onBattleChange;
  useEffect(() => { battleWatcher.current?.(battle); }, [battle]);
  const encounterWriter = useRef(encounter); encounterWriter.current = encounter;
  useEffect(() => { encounterWriter.current?.onChange(battle); }, [battle]);
  const seriesCheckpoint=useRef<{id:CombatSandboxScenarioId; state:BattleState}|null>(null);
  if (!seriesCheckpoint.current && isSeriesEncounter(sandboxScenarioId)) seriesCheckpoint.current={id:sandboxScenarioId,state:structuredClone(battle)};
  const verticalColumns=isVerticalScenario(battle);
  // 223: the hovered card previews where Hero would stand after playing it.
  const [steppingHover,setSteppingHover]=useState<string|null>(null);
  useEffect(()=>{
   if(battle.sandboxScenario!=='223' && !isTiledFloor(battle.sandboxScenario))return;
   const over=(event:PointerEvent)=>{const card=event.target instanceof Element ? event.target.closest<HTMLElement>('.battle-field[data-vertical-columns] [data-battle-card]') : null;setSteppingHover(card?.dataset.battleCard ?? null);};
   document.addEventListener('pointerover',over);return()=>{document.removeEventListener('pointerover',over);setSteppingHover(null);};
  },[battle.sandboxScenario]);
  useEffect(()=>{if(!sandbox){const saved=keruExpeditionSnapshot(battle);if(saved)expeditionWriter.current?.(saved);}},[battle.keruExpedition,sandbox]);
  const [paused, setPaused] = useState(()=>musicalCombat&&new URLSearchParams(location.search).has('battleSnapshot'));
  const [nightBlocking,setNightBlocking]=useState(false);
  const [withdrawPreview, setWithdrawPreview] = useState(false);
  const [solverSession, setSolverSession] = useState(0);
  const foundationRefs = useRef(new Map<string, HTMLElement>());
  const cardRefs = useRef(new Map<string, HTMLButtonElement>());
  const digReserveRefs = useRef(new Map<string, HTMLButtonElement>());
  /** A tableau card (or a parked one, `heldBy`) waiting for the player to pick its receiver. */
  const [selection, setSelection] = useState<{columnIndex: number; cardId: string; actorIds: string[]; heldBy?: string; rankOptions?: number[]} | null>(null);
  const flights = useRef(new Set<() => void>());
  const tableauSnapshots=useRef(new Map<string,{source:HTMLButtonElement;rect:DOMRect}>());
  const previousTableauTurn=useRef(battle.turn);
  const previousReposition=useRef(battle.reposition?.serial);
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
  // Pointer motion updates only the floating card; the full tableau does not rerender on every move.
  const clearTargetDrag=()=>{if(targetFrame.current!==null)cancelAnimationFrame(targetFrame.current);targetFrame.current=null;dragRef.current=null;fieldRef.current?.removeAttribute('data-target-drag');setTargetDrag(null);};
  const digCardAt=(under:Element|null,x:number,y:number)=>{
    const exposedTarget=under?.closest<HTMLElement>('[data-dig-target]');
    if(exposedTarget)return exposedTarget;
    const marker=digTargetMarker.current;
    if(!marker || marker.hidden)return;
    const rect=marker.getBoundingClientRect();
    if(x<rect.left || x>rect.right || y<rect.top || y>rect.bottom)return;
    const lifted=cardRefs.current.get(marker.dataset.targetCard ?? '');
    return lifted?.hasAttribute('data-dig-target') ? lifted : undefined;
  };
  const moveTargetGhost=(x:number,y:number)=>{
    targetPointer.current={x,y};
    if(targetFrame.current!==null)return;
    targetFrame.current=requestAnimationFrame(()=>{
      targetFrame.current=null;
      if(!dragRef.current?.moved)return;
      const point=targetPointer.current;
      const under=document.elementFromPoint(point.x,point.y);
      const digCard=dragRef.current.dig ? digCardAt(under,point.x,point.y) : undefined;
      const over=dragRef.current.dig ? digCard?.dataset.battleCard : under?.closest<HTMLElement>('.battle-foe')?.dataset.battleTarget;
      if(over)fieldRef.current?.setAttribute('data-target-drag',dragRef.current.dig ? 'dig' : over);else fieldRef.current?.removeAttribute('data-target-drag');
      const marker=digTargetMarker.current;
      if(marker){
        marker.hidden=!digCard;
        if(digCard){
          const rect=digCard.getBoundingClientRect();
          const cardId=digCard.dataset.battleCard ?? '';
          if(marker.dataset.targetCard!==cardId){
            const face=digCard.cloneNode(true) as HTMLElement;
            face.inert=true;
            face.removeAttribute('data-battle-card');
            face.removeAttribute('data-dig-target');
            face.style.cssText='position:absolute;inset:0;width:100%;height:100%;';
            marker.querySelector('.dig-target-marker__face')?.replaceChildren(face);
            marker.dataset.targetCard=cardId;
          }
          marker.style.left=`${rect.left}px`;
          marker.style.top=`${rect.top-6}px`;
          marker.style.width=`${rect.width}px`;
          marker.style.height=`${rect.height}px`;
          marker.style.setProperty('--classic-card-w',`${rect.width}px`);
        }
      }
      targetGhostRef.current?.style.setProperty('transform',`translate3d(${point.x}px, ${point.y}px, 0) translate(-50%, var(--target-ghost-offset-y, -50%)) rotate(-6deg)`);
    });
  };
  useEffect(()=>()=>{if(targetFrame.current!==null)cancelAnimationFrame(targetFrame.current);},[]);
  const combatInspection = useCombatInspection(fieldRef, solverSession, cirInspection || Boolean(inspection) || Boolean(abilityInspection));
  useCombatViewportFit(fieldRef,sandbox && !encounter);
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
  const [summonSlot,setSummonSlot]=useState(false);
  const [availableSummons,setAvailableSummons]=useState(false),[swipeSummonDragging,setSwipeSummonDragging]=useState(false);
  useEffect(()=>{setAvailableSummons(false);setSwipeSummonDragging(false);},[sandboxScenarioId,bannerSession]);
  const [familiarSlots,setFamiliarSlots]=useState(false);
  const [familiarScaffold,setFamiliarScaffold]=useState<Record<string,string>>({});
  const [gripAP,setGripAP]=useState(3);
  const [abilityAnchor, setAbilityAnchor] = useState({x:20,y:120});
  const { aim, holding, holdingRef, cardProps, foeProps, cancel, prime } = useAbilityDrag(spend);
  const loadoutKey=battle.party.map(a=>a.id+':'+assignedMovesFor(a.id).map(m=>m.name).join(',')).join('|');
  useEffect(()=>{cancel();setRetrieval(null);setAbilityInspection(null);},[loadoutKey]);
  useEffect(()=>{if(battle.result)setRetrieval(null);},[battle.result]);
  const presentationPaused = paused || holding || globalPaused || skillMenuOpen || cirInspection || Boolean(abilityCast) || Boolean(inspection);
  const battlePaused = nightBlocking || presentationPaused || Boolean(battle.adeptFrenzy);
  const stickerReady = !paused && !nightBlocking && !holding && !skillMenuOpen && !abilityCast &&
    !inspection && !cirInspection && !rewardPreview &&
    (!globalPaused || combatInspection.active && !gameTime.isPlayerPaused()) &&
    battle.party.some(actor=>canPlaceSnowflake(battle,actor));
  const revealedStickerKin = stickerReady && (stickerArmed || stickerDragging)
    ? battle.party.filter(actor=>canPlaceSnowflake(battle,actor)).map(actor=>actor.id).join(' ')
    : '';
  const choosingFetch = musicalCombat && retrieval==='hero:Fetch';
  const retrievalAP = (column:number, depth:number) => choosingFetch
    ? canFetchMusical(battle) && column<tableauWidth(battle) && depth===battle.columns[column].length-1 ? 2 : null
    : retrieval ? retrievalCost(battle,retrieval,column,depth) : null;
  useEffect(()=>{
    if(!stickerReady){setStickerArmed(false);setStickerDragging(false);}
  },[stickerReady]);
  useEffect(()=>{
    if(!stickerArmed)return;
    fieldRef.current?.querySelector<HTMLElement>('[data-snowflake-eligible]')?.focus({preventScroll:true});
    const escape=(event:KeyboardEvent)=>{if(event.key==='Escape')setStickerArmed(false);};
    window.addEventListener('keydown',escape);
    return()=>window.removeEventListener('keydown',escape);
  },[stickerArmed]);
  const digTargetIds = new Set(musicalCombat && !battlePaused ? digTargets(battle, 'hero').map(({card}) => card.id) : []);
  const bankDigCard = (cardId: string) => {
    if (paused || holdingRef.current || gameTime.isPlayerPaused()) return;
    setBattle(state => digAdept(state, 'hero', cardId));
    setSelection(null);
  };
  const globalLights = useGlobalLights();
  const noLegalMoves = !battle.result && battle.turn === 'party' && !anyLegalPlay(battle);
  // Ticks also advance effects and the free-turn countdown; enemy clocks wait for it.
  const running = battle.started && !battle.result && !battlePaused && (!sandbox || battle.turn==='enemy' && (battle.sandboxScenario==='999' || battle.tutorial?.enemyClock!==undefined || Boolean(battle.enemyPace)) || battle.turn==='party' && ((battle.momentum?.recentPlays?.length ?? 0)>0 || battle.momentum?.decayEnabled!==false && (battle.momentum?.value ?? 0)>0));
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
  // Saved victories have no new knockout animation to finish after a reload.
  const restoredResult = useRef(Boolean(encounter?.initialState.result));
  const defeatReady = restoredResult.current || finishedDefeat >= lastDefeat;
  useEffect(()=>{
    const hp=encounter?.victoryHp,hero=battle.party.find(actor=>actor.id==='hero');
    if(hp===undefined || battle.result!=='won' || !defeatReady || !hero || hero.hp<=0 || hero.hp===hp)return;
    setBattle(current=>({...current,party:current.party.map(actor=>actor.id==='hero'?{...actor,hp:Math.min(actor.maxHp,hp)}:actor)}));
  },[battle.result,battle.party,defeatReady,encounter?.victoryHp]);
  useEffect(() => {
    if (battlePaused) { clearTargetDrag(); setTargetPicker(null); }
  }, [battlePaused]);
  useEffect(() => { if (holding) { setSelection(null); setAnnouncement('Tactical pause · Tableau values hidden'); } }, [holding]);
  // Target changes are presentation updates, including when the battle clock is paused.
  const aimActor = aim?.actorId, aimFoe = aim?.foeId;
  const aimBattle = aimActor ? battle : null;
  useEffect(() => {
    sceneChange.current?.({ ...sceneOf(latest.current, aimActor && !abilityInspection ? { actorId: aimActor, foeId: aimFoe ?? null } : null), verticalTableau: sandboxScenarioId === '222' || sandboxScenarioId === '223' || isTiledFloor(sandboxScenarioId) ? { tiled: isTiledFloor(sandboxScenarioId) ? sandboxScenarioId : undefined, stepping: sandboxScenarioId === '223' || isTiledFloor(sandboxScenarioId) ? steppingScene(latest.current, latest.current.turn === 'party' ? steppingHover : null) : undefined, foundations: { party: JSON.stringify(latest.current.party.map(({ rank, hp, charge, disarmed, turnSpent }) => ({ rank, hp, charge, disarmed, turnSpent }))), enemy: JSON.stringify(latest.current.foes.map(({ rank, hp, stagger, indominable, disarmed }) => ({ rank, hp, stagger, indominable, disarmed }))) }, columns: latest.current.columns.map((column, index) => column.map((card, depth) => ({ id: card.id, rank: card.rank, selected: selection?.cardId === card.id, reachable: verticalCanReach(latest.current, index, depth, latest.current.turn === 'enemy' ? 'enemy' : 'party') }))) } : undefined, paused: battlePaused, battleSession: sandbox ? `${sandboxScenarioId}-${bannerSession}` : undefined, sandboxSession: sandbox ? `${sandboxScenarioId}-${solverSession}` : undefined, khadRoot: sandbox || undefined });
  }, [battle.columns, battle.turn, selection, units, lastEvent, ambushed, aimActor, aimFoe, aimBattle, battlePaused, abilityInspection, sandboxScenarioId, solverSession, bannerSession, sandbox, steppingHover]);
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
    const digging = targetId === 'dig-reserve';
    const animation = trackGameAnimation(ghost.animate([
      {transform:'translate(0,0) scale(1)'},
      {transform:`translate(${dx * .5}px,${dy * .5 - 35}px) scale(${(1 + scale) / 2})`, offset:.5, ...(digging ? {filter:'brightness(1.35) drop-shadow(0 0 14px #ffe3a1)'} : {})},
      {transform:`translate(${dx}px,${dy}px) scale(${scale})`},
    ], {duration:reduced ? 1 : solverFlightDuration(getCardTransportDurationMs(from,to)), easing:'ease-out', fill:'forwards'}));
    const done = () => { animation.cancel(); ghost.remove(); flights.current.delete(done); };
    flights.current.add(done);
    animation.onfinish = done;
  };
  useLayoutEffect(() => {
    for (const card of battle.digReserve ?? []) {
      const source = tableauSnapshots.current.get(card.id);
      const destination = digReserveRefs.current.get(card.id);
      if (source && destination) flyTableauCard(source.source, 'dig-reserve', destination, source.rect);
    }
  }, [battle.digReserve]);
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
  // Automatic row advancement happens during the enemy handoff, after React
  // removes the old cards. Animate retained snapshots before capturing the new row.
  useLayoutEffect(() => {
    const priorTurn = previousTableauTurn.current, priorSerial = previousReposition.current;
    previousTableauTurn.current = battle.turn; previousReposition.current = battle.reposition?.serial;
    if (!sandbox || !(battle.sandboxScenario === '1002' || isTruefourstar(battle.sandboxScenario)) || priorTurn !== 'enemy' || battle.turn !== 'party' || !battle.reposition || battle.reposition.serial === priorSerial) return;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    for (const id of battle.reposition.removedIds) {
      const snapshot = tableauSnapshots.current.get(id); if (!snapshot) continue;
      const { source, rect } = snapshot, ghost = source.cloneNode(true) as HTMLButtonElement;
      ghost.disabled = true; ghost.inert = true; ghost.setAttribute('aria-hidden', 'true');
      ghost.dataset.rowDiscard = id;
      ghost.style.cssText = `position:fixed;left:${rect.x}px;top:${rect.y}px;width:${rect.width}px;height:${rect.height}px;--classic-card-w:${rect.width}px;pointer-events:none;z-index:65000;`;
      document.body.append(ghost);
      const animation = trackGameAnimation(ghost.animate(reduced ? [{ opacity: 1 }, { opacity: 0 }] : [
        { opacity: 1, transform: 'translateY(0) scale(1)', filter: 'brightness(1.4)', offset: 0 },
        { opacity: 1, transform: 'translateY(18px) scale(1.08)', filter: 'brightness(1.8)', offset: .35 },
        { opacity: 0, transform: 'translateY(115px) rotate(-7deg) scale(.72)', filter: 'brightness(1)' },
      ], { duration: reduced ? 140 : 1000, easing: 'ease-in-out', fill: 'forwards' }));
      const done = () => { animation.cancel(); ghost.remove(); flights.current.delete(done); };
      flights.current.add(done); animation.onfinish = done;
    }
  }, [battle.turn, battle.reposition, battle.sandboxScenario, sandbox]);
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
  const play = (index: number, source: HTMLButtonElement, actorId: string, chosenRank?: number) => {
    if (holdingRef.current || paused) return;
    const column = battle.columns[index];
    const depth = battle.rules.spatialLanes || verticalColumns ? column.findIndex(card => card.id === source.dataset.battleCard) : column.length - 1;
    const card = column[depth];
    // The intent card and hold slots receive tableau cards beside the Kin foundations.
    const parkFor = holdOwner(actorId);
    if (card && (actorId === INTENT_RECEIVER || parkFor) && tableauReceivers(battle, card).includes(actorId)) {
      setSelection(null);
      setBattle(current => parkFor ? holdCard(current, index, parkFor) : playOnIntent(current, index, depth));
      setAnnouncement(parkFor ? `${rankLabel(card.rank)} parked in the hold` : `${rankLabel(card.rank)} played onto ${receiverName(actorId)} · one pip removed · Momentum +1`);
      const hold = parkFor && fieldRef.current?.querySelector<HTMLElement>(`[data-battle-slot="${actorId}"] .battle-hold-slot`);
      if (hold) flyTableauCard(source, actorId, hold);
      return;
    }
    const actor = card && eligibleActors(battle, card).find(actor => actor.id === actorId);
    const destination = actor && (sandbox ? fieldRef.current?.querySelector<HTMLElement>(`[data-battle-actor="${actor.id}"] .battle-foundation__value`) : foundationRefs.current.get(actor.id));
    if (!card || !actor) return;
    const ranks=legalCardRanks(battle,actorId,card);
    if(chosenRank===undefined && ranks.length>1){setSelection({columnIndex:index,cardId:card.id,actorIds:[actorId],rankOptions:ranks});setAnnouncement('Choose which value to play');return;}
    const rank=chosenRank ?? ranks[0];
    if(!ranks.includes(rank))return;
    source.querySelector('[data-split-rank="'+rank+'"]')?.setAttribute('data-chosen','true');
    setSelection(null);
    setBattle((current) => playCard(current, index, actor.id, false, current.rules.spatialLanes || isVerticalScenario(current) ? depth : undefined, rank));
    setAnnouncement(`${rankLabel(rank)} added to ${actor.name}'s foundation · ${sandbox?'Momentum +1':`AP ${actor.charge + 1}`}`);
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
    const column = battle.columns[index], card = battle.rules.spatialLanes || verticalColumns ? column.find(card => card.id === source.dataset.battleCard) : column[column.length - 1];
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
    if (source && (battle.rules.spatialLanes || verticalColumns ? column.some(card => card.id === selection.cardId) : column[column.length - 1]?.id === selection.cardId)) play(selection.columnIndex,source,actorId);
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
    if (current.rules.spatialLanes) {
      for (let column = 0; column < current.columns.length; column++) for (const card of current.columns[column].slice(1)) {
        const actor = eligibleActors(current, card)[0], source = cardRefs.current.get(card.id);
        if (actor && source) { play(column, source, actor.id); return { status: 'played', message: 'Spatial lane play' }; }
      }
      return { status: 'blocked', message: 'No legal plays in the shared frontier or party rear' };
    }
    if(current.rules.dualRanks){
      for(let column=0;column<current.columns.length;column++){
        const card=current.columns[column][current.columns[column].length-1],source=card && cardRefs.current.get(card.id);
        if(!card || !source)continue;
        for(const actor of current.party){const ranks=legalCardRanks(current,actor.id,card);if(ranks.length){play(column,source,actor.id,ranks[0]);return {status:'played',message:'Split-card legal play'};}}
      }
      return {status:'blocked',message:'No legal exposed split-card play'};
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
    if(isVerticalScenario(current)){for(const {card,column} of verticalEntries(current,'party')){const actor=eligibleActors(current,card)[0],source=cardRefs.current.get(card.id);if(actor && source){play(column,source,actor.id);return {status:'played',message:'Player-end outer card'};}}}
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
  const restart = (nextScenario?: string, advanceSeries=false, rewards?:IceRewardPick[]) => {
    if (encounter) return;
    setStickerArmed(false);setStickerDragging(false);
    setBannerSession(value=>value+1);setDirectWithdraw(false);setSummonSlot(false);setFamiliarSlots(false);
    setSkillMenuOpen(false);setAbilityCast(null);setCirInspection(false);
    announced.current=0;
    setWithdrawPreview(false);
    setFamiliarScaffold({});
    setSolverSession(session => session + 1);
    cancel(); clearTargetDrag(); setTargetPicker(null); setRetrieval(null); setAbilityInspection(null); setSelection(null); setPaused(false);
    flights.current.forEach(done=>done());seenSpills.current.clear();
    tableauSnapshots.current.clear();previousEnemyFoundations.current=null;previousIntentCards.current=null;
    if(sandbox){
      const id=COMBAT_SANDBOX_SCENARIOS.find(option=>option.id===nextScenario)?.id ?? sandboxScenarioId;
      let next=id==='1001'?createLayoutExperiment(battle.experiment?.layout):musicalSetup(createPlayableSandboxScenario(id));
      if (advanceSeries && battle.result==='won' && isSeriesEncounter(sandboxScenarioId) && isSeriesEncounter(id)) next=carrySeriesParty(battle,next);
      else if (!rewards?.length && isSeriesEncounter(id) && id===sandboxScenarioId && seriesCheckpoint.current?.id===id) next=structuredClone(seriesCheckpoint.current.state);
      if (rewards?.length) next={...next,party:next.party.map(actor=>actor.id==='hero'?{...actor,iceRewards:[...new Set([...(actor.iceRewards ?? []),...rewards.map(reward=>reward.id)])],iceRewardTiers:{...actor.iceRewardTiers,...Object.fromEntries(rewards.map(reward=>[reward.id,reward.tier]))},...(rewards.some(reward=>reward.id==='thorns')?{thornsTurns:3}:{}),...(rewards.some(reward=>reward.id==='stone-shell')?{fossilTurns:rewards.find(reward=>reward.id==='stone-shell')?.tier===2?3:2,fossilRemainder:0}:{})}:actor)};
      seriesCheckpoint.current=isSeriesEncounter(id) ? {id,state:structuredClone(next)} : null;
      setSandboxScenarioId(id);setBattle(next);return;
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
  const kinRadials = Boolean(sandbox && tutorialById(battle.tutorial?.id)?.kinRadials);
  /** Several Kin radials can be open together; the Momentum radial is exclusive. */
  const toggleKinRadial = (actorId: string) => {
    // Inspection releases its hold synchronously on pointerdown; read the live
    // clock here rather than a render's earlier paused snapshot.
    if (nightBlocking || battle.result || paused || holding || gameTime.isPaused() || abilityCast) return;
    if (battle.keruExpedition) {
      if (actorId !== 'aldan-seed' && actorId !== battle.keruExpedition.leader) {
        const current=latest.current,next=tapInKeru(current,actorId as LeaderKeruId);
        if(next===current)return;
        cancel();setSelection(null);setSkillMenuOpen(false);setSkillOwners([]);setDirectWithdraw(false);setBattle(next);
        return;
      }
      actorId=battle.keruExpedition.leader;
    } else if(actorId==='aldan-seed')actorId='hero';
    const open = skillMenuOpen ? skillOwners : [];
    const owners = open.includes(actorId) ? open.filter(id => id !== actorId) : battle.keruExpedition ? [actorId] : [...open, actorId];
    cancel(); setSelection(null); setSkillOwners(owners); setSkillMenuOpen(owners.length > 0);
  };
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
  // Inspection and tactical holds freeze play without hiding information.
  const concealTableau = false;

  // A caster-built intent is its owner's foundation and sits beside it; a shared one stays at the end of the rack.
  const casterIntent = Boolean(intentDef(battle)?.casterOnly);
  const intentSlot = <IntentCardSlot battle={battle} targetable={Boolean(selection?.actorIds.includes(INTENT_RECEIVER))} concealValue={concealTableau} disabled={battlePaused}
    cardRef={node => { intentRef.current = node; }} onChoose={() => choose(INTENT_RECEIVER)} />;
  const foeRow = <div className="battle-field__team" data-team="enemy" data-single-enemy={battle.foes.length === 1 || undefined} style={{ '--slots': battle.foes.length + (sandbox && casterIntent ? 1 : 0) } as CSSProperties}>
    <h3>Enemies</h3>
    {battle.foes.map((foe) => <FoeCard compactVitals={Boolean(encounter)} key={foe.id} foe={foe} turnKey={`${battle.round ?? 0}-${battle.turn}-${battle.result ?? ''}`} duskwoodBark={battle.sandboxScenario==='007'} target={target?.name ?? null} targetId={target?.id} events={battle.events}
      enemyTurn={sandbox && battle.turn==='enemy'} hideFoundationValue={casterIntent && battle.sandboxScenario!=='1012'}
      statusIcons={battle.tutorial ? <><BattleStatusIcons key={`${solverSession}-${foe.id}`} unit={foe} battle={battle} paused={battlePaused} />{battle.keruInvoke?.seal && foe.id===battle.foes[0]?.id && <SealMeter battle={battle} onPour={()=>setBattle(b=>pourIntoSeal(b))}/>}{battle.keruInvoke?.upkeep && <KeruFarewellFoeFx battle={battle} foeId={foe.id}/>}</> : undefined} tutorialIntent={battle.tutorial ? tutorialIntent(foe, target?.name ?? null, battle) : undefined}
      preview={previews.get(foe.id) ?? null} focus={aim?.foeId === foe.id} aiming={sandbox ? !battlePaused && !battle.result : Boolean(aim && playableAttack && !paused)}
      targeters={sandbox ? battle.party.filter(a=>a.hp>0 && a.targetId===foe.id).map(a=>({id:a.id,name:a.name})) : undefined}
      interaction={sandbox ? {onClick:()=>{if(targetPicker && !battlePaused){setBattle(b=>setActorTarget(b,targetPicker,foe.id));setTargetPicker(null);}}} : foeProps(foe.id)}
      sprite={foe.id.startsWith('mote-of-darkness') ? <span className={`mote-of-darkness${foe.name === 'Crimson Mote' ? ' mote-of-darkness--crimson' : ''}`} role="img" aria-label={foe.name === 'Crimson Mote' ? 'Crimson Mote' : 'Mote of Darkness'}/> : foe.appearance==='khad-root'
        ? <img className="battle-field__khad-root" src={`${import.meta.env.BASE_URL}assets/runtime/ui/quests/khad-roots-berry-bush-night-paint-v1.png`} alt="Dark crimson-thorned Khad Root" />
        : <FoundationSprite sprite={SPRITES[foe.id]} name={foe.name} lighting={rig.standee(0, -55, 64)} turnedAway={ambushed} />} />)}
    {sandbox && casterIntent && intentSlot}
  </div>;

  const seedParty = battle.sandboxScenario === '1002';
  const supports = battle.party.filter(actor => actor.id !== 'aldan-seed' && actor.id !== battle.keruExpedition?.leader);
  const inspectSticker=(actor:BattleState['party'][number])=>{
    const applySticker=(memory:StickerMemory)=>{
      if(gameTime.isPlayerPaused())return false;
      const current=latest.current,next=placeSnowflake(current,actor.id,memory);
      if(next===current)return false;
      setBattle(next);
      if(readWorldFlurry()==='available'&&next.snowflakeReward)saveWorldFlurry(next.snowflakeReward);
      setAnnouncement('Flurry applied to '+actor.name);
      return true;
    };
    foundationJumbo?.open({title:actor.name+' sticker memory',content:<FlurryMemory actor={actor} onConfirm={applySticker}/>});
  };
  const inspectFoundation=(actor:BattleState['party'][number],initialCard?:string)=>{
    foundationJumbo?.open({title:actor.name,content:<KeruFoundationJumbo actor={actor} battle={battle} initialCard={initialCard} musical={musicalCombat}
      onFetch={musicalCombat&&actor.id==='hero'&&canFetchMusical(battle)&&!battlePaused ? ()=>{
        if(gameTime.isPlayerPaused()||!canFetchMusical(latest.current))return;
        cancel();setSelection(null);setRetrieval('hero:Fetch');setAnnouncement('Fetch · Choose an exposed tableau card');
        foundationJumbo?.dismiss();
      } : undefined}
      onGritApply={()=>{if(gameTime.isPlayerPaused())return;const next=useGrit(latest.current,actor.id);if(next===latest.current)return;setBattle(next);foundationJumbo?.dismiss();}}
      onPackLeaderPromote={id=>{if(gameTime.isPlayerPaused())return;const next=promoteWithPackLeader(latest.current,id);if(next===latest.current)return;setBattle(next);foundationJumbo?.dismiss();}}/>});
  };
  const chooseStickerKin=(id:string|undefined)=>{
    const current=latest.current,actor=current.party.find(unit=>unit.id===id);
    if(!stickerReady||!actor||!canPlaceSnowflake(current,actor)||gameTime.isPlayerPaused())return;
    cancel();setSelection(null);setRetrieval(null);setStickerArmed(false);
    inspectSticker(actor);
  };
  const partyRow = <div className="battle-field__team" data-team="party" data-seed-party={seedParty || undefined} data-momentum={sandbox || undefined} style={{ '--slots': battle.party.length } as CSSProperties}>
    <h3>{battle.party.some(a=>a.id==='aldan-seed')?'Expedition':'Players'}</h3>
    {battle.party.map((actor) => {
      if(battle.keruExpedition?.leader===actor.id)return null;
      if(battle.party.some(a=>a.id==='aldan-seed') && actor.id!=='aldan-seed')return <div key={actor.id} className="battle-field__slot battle-support-slot" data-support-position={supports.indexOf(actor)} data-battle-slot={actor.id} data-down={actor.hp<=0 || undefined}><button type="button" className="battle-support-keru" data-battle-actor={actor.id} data-battle-target={actor.id} aria-label={actor.name+(battle.keruExpedition?' · Tap to become leader':' · Open collected Keru cards')} disabled={!!selection || !!battle.result || actor.hp<=0 || !!battle.keruExpedition && (battlePaused || !canTapIn(battle,actor.id as LeaderKeruId))} onClick={()=>toggleKinRadial(actor.id)}><SupportKeruFace actor={actor} value={personalValue(battle,actor.id as LeaderKeruId)} events={battle.events} paused={battlePaused}/></button>{battle.keruExpedition && !seedParty && <button type="button" className="keru-tap-in" disabled={battlePaused || !canTapIn(battle,actor.id as LeaderKeruId)} onClick={()=>setBattle(s=>tapInKeru(s,actor.id as LeaderKeruId))}>Tap in · {rankLabel(personalValue(battle,actor.id as LeaderKeruId))}</button>}</div>;

      const canRedraw = (!sandbox || battle.turn==='party') && actor.inspiration > 0 && actor.hp > 0 && !battle.result && !battlePaused;
      return <div key={actor.id} className="battle-field__slot" data-primary-foundation={seedParty && actor.id === 'aldan-seed' || undefined} data-battle-slot={actor.id} data-down={actor.hp <= 0 || undefined}>
        {actor.id==='cir' && !isTruefourstar(battle.sandboxScenario) && <button type="button" className="cir-release" disabled={battlePaused || battle.turn!=='party' || !!battle.result} onClick={()=>setBattle(releaseCir)}>Release Cir</button>}
        {sandbox && <div className="battle-party-buffs">{actor.grit&&<GritBuffIcon/>}{actor.packLeader&&<PackLeaderBuff effect={actor.packLeader} onInspect={()=>inspectFoundation(actor,'Pack Leader')}/>}{actor.fastSwipes && <button type="button" className="battle-buff-icon fast-swipes-buff" data-buff="fast-swipes" aria-label={`Fast Swipes · ${fastSwipesSpec(actor.fastSwipes.tier).name} · ${actor.fastSwipes.moves}/${fastSwipesSpec(actor.fastSwipes.tier).interval}`} data-game-tooltip={`${fastSwipesDescription(actor.fastSwipes.tier)} Progress: ${actor.fastSwipes.moves}/${fastSwipesSpec(actor.fastSwipes.tier).interval} Hero tableau plays.`}><span aria-hidden="true">🐾</span><b>{actor.fastSwipes.moves}/{fastSwipesSpec(actor.fastSwipes.tier).interval}</b></button>}{actor.rooted && <button type="button" className="battle-buff-icon battle-debuff-icon" data-debuff="snaring-khad-roots" aria-label="Snaring Khad Roots" data-game-tooltip="Cannot receive tableau cards or Withdraw. Abilities remain available. Break the caster’s stagger gauge to release the team.">🌿</button>}{actor.controller==='npc' && <button type="button" className="battle-buff-icon" data-buff="precipice-of-night" aria-label="Precipice of Night" data-game-tooltip="NPC ally. Dark abilities cost self-stagger instead of Momentum. Cannot receive manual tableau plays.">🌘</button>}{actor.disarmed && <DisarmedBadge name={actor.name}/>}{actor.id==='hero' && battle.keruInvoke?.tiers && <KeruHarnessBadges battle={battle} actor={actor} face={keruFace} onDismiss={keru=>setBattle(b=>dismissKeru(b,keru))}/>}{actor.invokedKeru && !battle.keruInvoke?.tiers && <KeruInvokeBadge battle={battle} keru={actor.invokedKeru} face={keruFace}/>} {battle.cir?.status==='bound' && battle.cir.actorId===actor.id && <CirFamiliarBuff kin={battle.cir.actorId} disabled={battlePaused && !combatInspection.active || Boolean(battle.result) || battle.turn!=='party'} onInspect={()=>setCirInspection(true)} />} <BattleStatusIcons key={`${solverSession}-${actor.id}`} unit={actor} battle={battle} paused={battlePaused}
          canActivatePity={actor.id === 'hero' && canPityFlip(battle) && !nightBlocking && !paused && !holding && !skillMenuOpen && !abilityCast && !cirInspection && !inspection && !gameTime.isPlayerPaused()}
          onPityFlip={()=>{const next=pityFlip(latest.current);if(next===latest.current)return;cancel();setSelection(null);setBattle(next);setAnnouncement(`Every Dog Has Her Day: Hero’s foundation is now ${rankLabel(next.party.find(unit=>unit.id==='hero')?.rank ?? 1)}`);}} />{actor.stickyPaws && <button type="button" className="battle-buff-icon" data-buff="sticky-paws" aria-label="Sticky Paws · Next attack steals" data-game-tooltip="Sticky Paws: Mochi’s next attack steals the target’s top foundation card. If emptied, it becomes Disarmed and spends its next turn rearming.">🐾</button>}</div>}
        <div className="keru-foundation-group">
        {actor.id==='hero' && isKeruInvokeScenario(battle.sandboxScenario) && battle.expeditionKeru?.length!==0 ? <KeruSquares battle={battle} actor={actor} onDismiss={battle.keruInvoke?.upkeep ? keru=>setBattle(b=>dismissKeru(b,keru)) : undefined}/>
         : battle.expeditionKeru?.length!==0 && isTruefourstar(battle.sandboxScenario) && !['111','100'].includes(battle.sandboxScenario ?? '') && (['left','right'] as const).map(side=><div key={side} className={`foundation-empty-tiles foundation-empty-tiles--${side}`} role="group" aria-label={side+' familiar squares'}>{[0,1].map(index=>{const key=side+'-'+index,who=familiarScaffold[key];return <span key={key} data-familiar-slot={!who && familiarSlots ? key : undefined} data-battle-target={!who && familiarSlots ? 'familiar-square:'+key : undefined} data-companion-portrait={who || undefined} data-empty={!who || undefined} aria-label={who ? who+' familiar' : 'Empty familiar square'} style={{visibility:who || familiarSlots ? 'visible' : 'hidden'}}>{who ? keruFace(who) : null}</span>})}</div>)}

        {!isTruefourstar(battle.sandboxScenario) && (familiarSlots || abilityCast?.targetId===`familiar:${actor.id}`) && actor.hp>0 && actor.id!=='cir' && actor.controller!=='npc' && !(battle.cirCompanion?.form==='familiar' && battle.cirCompanion.host===actor.id) && <FamiliarDropSlot host={actor.id} name={actor.name}/>}
        {battle.cirCompanion?.form==='familiar' && battle.cirCompanion.host===actor.id && <KeruAttachmentTile battle={battle} disabled={battlePaused && !combatInspection.active || gameTime.isPlayerPaused() || battle.turn!=='party' || !!battle.result} onRelease={()=>setBattle(releaseCir)}/>}
        {musicalCombat && actor.adept && actor.id!==primeFoundationId(battle) && <span className="adept-foundation-value">Value {rankLabel(actor.rank)}</span>}
        {musicalCombat && actor.id===primeFoundationId(battle) && <PrimeTableauValue freePromotion={packLeaderReady(battle)} value={actor.rank} disabled={battlePaused || !!battle.result || battle.turn!=='party' || !!selection || actor.hp<=0 || !packLeaderReady(battle)&&(battle.momentum?.value ?? 0)<PRIME_TRANSFER_COST} fieldRef={fieldRef} onTransfer={id=>{setBattle(state=>transferPrimeFoundation(state,id));cancel();setSelection(null);}}/>}
        <button type="button" className={`battle-field__foundation ${sandbox ? "battle-foundation--unified" : ""} ${actor.id === 'aldan-seed' && battle.keruExpedition ? "battle-leader-foundation" : ""}`} data-foundation-mode={musicalCombat?(actor.foundationMode ?? 'active'):undefined} data-dig-source={actor.id==='hero' && digTargetIds.size>0 || undefined} data-game-tooltip={!stickerArmed && !stickerDragging && actor.id==='hero' && digTargetIds.size ? 'Drag Dig onto any second-row card to save it for a golf receipt.' : undefined} data-battle-actor={actor.id} data-snowflake-eligible={stickerReady&&canPlaceSnowflake(battle,actor)||undefined} data-active-leader={actor.id==='aldan-seed'?battle.keruExpedition?.leader:undefined}
          data-empty-foundation={musicalCombat && actor.id==='hero' && !battle.bite?.equipped || undefined}
          data-battle-target={actor.id} data-targetable={Boolean(previews.get(actor.id) && !paused) || selection?.actorIds.includes(actor.id) || undefined}
          data-preview={previews.get(actor.id) ? (aim?.foeId === actor.id ? 'focus' : 'faint') : undefined}
          {...(aim && playableAttack && !paused ? foeProps(actor.id) : {})}
          disabled={aim ? !previews.get(actor.id) || paused : !!selection && !selection.actorIds.includes(actor.id)}
          onPointerDown={sandbox ? event=>{
            suppressTargetClick.current=false;
            if(stickerArmed)return;
            const dig=musicalCombat && actor.id==='hero' && Boolean(actor.adept) && adeptExpression(actor.charge)?.name==='Dig';
            if(musicalCombat && actor.id==='hero' && !battle.bite?.equipped && !actor.adept)return;
            if(dig && !digTargetIds.size)return;
            if(actor.controller==='npc' || battlePaused || battle.result || actor.hp<=0 || selection || event.button!==0)return;
            dragRef.current={actorId:actor.id,x:event.clientX,y:event.clientY,moved:false,dig};
            event.currentTarget.setPointerCapture(event.pointerId);
          } : undefined}
          onPointerMove={sandbox ? event=>{
            const drag=dragRef.current;if(!drag || battlePaused)return;
            if(Math.hypot(event.clientX-drag.x,event.clientY-drag.y)>6)drag.moved=true;
            if(drag.moved){
              if(!targetDrag)setTargetDrag({actorId:drag.actorId,dig:drag.dig});
              moveTargetGhost(event.clientX,event.clientY);
            }
          } : undefined}
          onPointerCancel={clearTargetDrag}
          onLostPointerCapture={clearTargetDrag}
          onPointerUp={sandbox ? event=>{
            const drag=dragRef.current;
            const under=drag?.moved ? document.elementFromPoint(event.clientX,event.clientY) : null;
            const digCard=drag?.dig ? digCardAt(under,event.clientX,event.clientY) : undefined;
            clearTargetDrag();
            if(!drag?.moved)return;suppressTargetClick.current=true;
            if(drag.dig){
              const cardId=digCard?.dataset.battleCard;
              if(cardId && !battlePaused)bankDigCard(cardId);
              return;
            }
            const over=under?.closest<HTMLElement>('.battle-foe')?.dataset.battleTarget;
            if(over && !battlePaused){if(musicalCombat && drag.actorId==='hero'){setBattle(b=>b.party.find(a=>a.id==='hero')?.adept?castAdept(b,'hero',over):castBite(b,over));return;}setBattle(b=>setActorTarget(b,drag.actorId,over));setAnnouncement(actor.name+' targets '+battle.foes.find(f=>f.id===over)?.name);}
          } : undefined}
          onClick={event => {
            if(suppressTargetClick.current){suppressTargetClick.current=false;return;}
            if(stickerArmed&&canPlaceSnowflake(battle,actor)){chooseStickerKin(actor.id);return;}
            if (aim) { if (previews.get(actor.id) && !paused) foeProps(actor.id).onClick(); return; }
            if (selection) { choose(actor.id); return; }
            // Sandbox ability bindings are unwired, except in scenarios that open Kin radials (1000's Summon: Dem); card receipt selection remains available.
            if (musicalCombat) { inspectFoundation(actor);return; }
            if (sandbox) { if (!musicalCombat && kinRadials && actor.controller!=='npc') toggleKinRadial(actor.id); return; }
            requestHoloDeviceTilt();
            setInspection({ id: actor.id, name: actor.name, anchor: event.currentTarget });
          }} aria-haspopup={sandbox?undefined:'dialog'} aria-label={`${actor.name} foundation${battle.rules.elementSuits && actorElements(battle,actor.id).length ? ` · ${actorElements(battle,actor.id).map(e=>ELEMENT_FACE[e].name).join('/')} element` : ''}${selection?.actorIds.includes(actor.id) ? ' · choose for selected card' : ''}`} style={rig.surface(55, 60)}>
          <>{sandbox ? <PlayerFoundationFace holocard={musicalCombat && actor.adept?<AdeptFace kinId={actor.id} title={actor.id==='hero'?adeptExpression(actor.charge)?.name??actor.name:actor.name} description={actor.charge+' AP'}/>:musicalCombat && actor.id==='hero'?<BiteFace showValue={false} hp={actor.hp} resetKey={sandboxScenarioId+'-'+bannerSession} rarity={biteRarity} orientation="landscape" value={battle.bite?.equipped?actor.rank:0} damage={battle.bite?.moves ?? 0}/>:musicalCombat && actor.id==='mochi'?<FastSwipesFace foundation moves={actor.fastSwipes?.moves ?? 0} support={actor.foundationMode==='support'} tier={actor.fastSwipes?.tier}/>:undefined} leader={actor.id==='aldan-seed'?(battle.party.find(a=>a.id===battle.keruExpedition?.leader) ?? (battle.keruExpedition?.leader==='cir'?battle.cirCompanion?.actor:undefined)):undefined} leaderId={actor.id==='aldan-seed'?battle.keruExpedition?.leader:undefined} actor={actor} biteDamage={musicalCombat && actor.id==='hero' && battle.bite?.equipped ? battle.bite.moves : undefined} turnKey={`${battle.round ?? 0}-${battle.turn}-${battle.result ?? ''}`} demiExpressions={battle.sandboxScenario==='111' || Boolean(encounter?.recipes)} element={battle.rules.elementSuits ? kinElement(actor.id) : undefined} elements={battle.rules.elementSuits ? actorElements(battle,actor.id) : []} events={battle.events} paused={presentationPaused} noLegalMoves={noLegalMoves} hero1012={(['1012', '111', '100', '101', '102', '103', '104', '105'].includes(battle.sandboxScenario ?? '')) && actor.id==='hero'} highlightActive={highlightLegal || highlightHeld} portraitRef={node=>{if(node)foundationRefs.current.set(actor.id,node);else foundationRefs.current.delete(actor.id);}}/> : <div className="battle-field__pile">
            <div className="battle-field__actor-card proto-lit-surface" ref={node => { if (node) foundationRefs.current.set(actor.id,node); else foundationRefs.current.delete(actor.id); }}>
              <ActorHoloCard actorId={actor.id} name={actor.name} rank={rankLabel(actor.rank)} receivedResources={sandbox ? { inspiration: actor.inspiration } : { AP: actor.charge, inspiration: actor.inspiration }} />
            </div>
          </div>}</>
        </button>
        </div>
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
        {!sandbox && <PartyVitals actor={actor} turnKey={`${battle.round ?? 0}-${battle.turn}-${battle.result ?? ''}`} preview={aim?.foeId === actor.id ? previews.get(actor.id)?.hp.after : undefined} count={actor.count} events={battle.events} targeted={(!sandbox || battle.turn==='enemy') && battle.started && !battle.result && target?.id === actor.id} />}

      </div>;
    })}
    {battle.cirCompanion?.form==='meteor' && <div className="battle-field__slot" data-battle-slot="cir-meteor"><button type="button" className="battle-field__foundation battle-foundation--unified cir-meteor-foundation" data-battle-target="cir-meteor" aria-label={`Meteor · ${battle.cirCompanion.pips}/3 pips${battle.cirCompanion.pips>=3?' · Ready':''}`} disabled={battlePaused && !combatInspection.active || gameTime.isPlayerPaused() || battle.turn!=='party' || !!battle.result} onClick={()=>toggleKinRadial('cir')} data-game-tooltip="Meteor: untargetable; accepts no tableau cards. Gains one pip each subsequent party turn. At three pips, open Cir’s hand and drag Meteor to an enemy for 22 Fire damage to all enemies; exhausts Cir."><img src={CIR_ART} alt="Cir ascending"/><span>Meteor</span><span aria-hidden="true">{Array.from({length:3},(_,i)=>i<battle.cirCompanion!.pips?'●':'○').join(' ')}</span><span>{battle.cirCompanion.pips>=3?'Ready':`Ready in ${3-battle.cirCompanion.pips} turns`}</span></button></div>}
    {musicalCombat && swipeSummonDragging && !battle.party.some(a=>a.id==='mochi') && <div className="battle-field__slot battle-summon-slot battle-support-slot fast-swipes-support-slot" data-battle-slot="fast-swipes-support"><div className="battle-field__foundation battle-foundation--unified" data-fast-swipes-support-target role="group" aria-label="Empty support foundation · Fast Swipes · 3 Momentum"><span>＋</span><span>Support · 3 Momentum</span></div></div>}
    {(summonSlot || battle.sandboxScenario!=='1002' && abilityCast && foundationSummon(abilityCast.id) && !battle.party.some(actor=>actor.id===foundationSummon(abilityCast.id))) && <div className="battle-field__slot battle-summon-slot" data-battle-slot={FOUNDATION_SUMMON_SLOT}><div className="battle-field__foundation battle-foundation--unified" data-battle-target={FOUNDATION_SUMMON_SLOT} data-foundation-summon-slot role="group" aria-label="New friendly foundation slot"><span>＋</span><span>New foundation</span></div></div>}
    {musicalCombat && Boolean(battle.digReserve?.length) && <div className="dig-reserve" role="group" aria-label={battle.digReserve?.some(card=>card.fetched)?'Retrieved cards':'Dug cards'}>
      {battle.digReserve?.map(card => <button key={card.id} type="button" className="dig-reserve__card"
        ref={node => {if(node)digReserveRefs.current.set(card.id,node);else digReserveRefs.current.delete(card.id);}}
        disabled={battlePaused || !digReceiptReceiver(battle, card)} aria-label={`Play ${card.fetched?'fetched':'dug'} ${rankLabel(card.rank)}${card.element==='ice'?' · Ice':''} as a golf receipt`}
        onClick={event => {
          const receiverId = digReceiptReceiver(latest.current, card);
          if (!receiverId || battlePaused || gameTime.isPlayerPaused()) return;
          const destination = fieldRef.current?.querySelector<HTMLElement>(`[data-battle-actor="${receiverId}"]`);
          if (destination) flyTableauCard(event.currentTarget, receiverId, destination);
          setBattle(state => playDigReceipt(state, card.id));
          setSelection(null);
          setAnnouncement(`${rankLabel(card.rank)} played from ${card.fetched?'Fetch':'Dig'} · Momentum +1`);
        }}><span>{card.fetched?'Fetch':'Dig'}</span><strong>{rankLabel(card.rank)}</strong>{card.element==='ice'&&<ElementGlyph element="ice"/>}</button>)}
    </div>}
    {battle.experiment?.layout==='reserve' && <div className="layout-reserve" role="group" aria-label="Hero reserve hand"><span>Reserve · refreshes each turn</span><div>{battle.experiment.reserve.map(card=><ProtoCard key={card.id} card={card} natureAdornment={showTableauElements && cardElement(card)==='nature'} fireAdornment={showTableauElements && cardElement(card)==='fire'} waterAdornment={showTableauElements && cardElement(card)==='water'} airAdornment={showTableauElements && cardElement(card)==='air'} earthAdornment={showTableauElements && cardElement(card)==='earth'} chaosAdornment={showTableauElements && cardElement(card)==='chaos'} allowJumbo={false} centerRank lit disabled={battlePaused || !canPlay(battle,'hero',card)} actionLabel={'Play reserve '+rankLabel(card.rank)} onClick={()=>{setBattle(state=>playExperimentReserve(state,card.id));cancel();setSelection(null);}} />)}</div></div>}
    {sandbox && battle.party.filter(actor => hasHoldSlot(battle, actor.id)).map(actor => { const held = heldCard(battle, actor.id); return <HoldSlot key={'hold-'+actor.id} actorId={actor.id} card={held}
      targetable={Boolean(selection?.actorIds.includes(holdReceiver(actor.id)))} concealValue={concealTableau} disabled={battlePaused || !heldReceivers(battle, actor.id).length}
      cardRef={node => { if (!held) return; if (node) { cardRefs.current.set(held.id,node); node.dataset.battleCard=held.id; node.dataset.battleRank=String(held.rank); } else cardRefs.current.delete(held.id); }}
      onChoose={() => choose(holdReceiver(actor.id))} onActivate={source => activateHeld(actor.id, source)}
      onDropActor={target => { const id = target.dataset.battleActor, source = held && cardRefs.current.get(held.id); if (id && source && !battlePaused) playFromHold(actor.id, source, id); }} />; })}
    {sandbox && !isVerticalScenario(battle) && !battle.party.some(a=>a.controller==='npc') && !tutorialById(battle.tutorial?.id)?.hideEmptySlot && !(battle.party.length > 1 && battle.party.some(actor => hasHoldSlot(battle, actor.id))) && <div className="battle-field__slot" data-battle-slot="empty">
      <div className="battle-field__foundation battle-field__foundation--empty" role="img" aria-label="Empty player foundation">
        <span aria-hidden="true">◇</span>
        <span>Empty</span>
      </div>
    </div>}
  </div>;

  const separatedLanes = !!battle.rules.spatialLanes && !battle.rules.inwardBackfill;
  const showTableauElements = !!battle.rules.elementSuits && !seedParty && !isTruefourstar(battle.sandboxScenario) && !concealTableau;
  // Presentation only: deeper cards remain in the deal and reveal as front cards leave.
  const musicalVisibleRows: 2 | 3 | 4 | 5 = 2;
  const visibleRows = musicalCombat ? musicalVisibleRows : Infinity;
  const renderColumn = (column: Card[], index: number, lane?: number) => <div className="battle-field__column" key={index} data-vertical-side={verticalColumns?(index<VERTICAL_ROWS?'left':'right'):undefined} style={{ '--vertical-row':isTiledFloor(battle.sandboxScenario)?floorCell(index,battle.sandboxScenario).row+1:index%VERTICAL_ROWS+1,'--tile-column':floorCell(index,battle.sandboxScenario).col+1,'--tile-shift':floorLayout(battle.sandboxScenario).stagger && floorCell(index,battle.sandboxScenario).row%2 ? '50%' : '0%','--cards': lane === undefined ? Math.max(1,Math.min(visibleRows,column.length)) : 1 } as CSSProperties}
              data-withdraw-preview={withdrawPreview && column.length>0 || undefined} data-battle-target={`card:${index}`} data-targetable={Boolean(trapPreviews[index]) || undefined}
              data-preview={trapPreviews[index] ? (aimedColumn === index ? 'focus' : 'faint') : undefined}>
              {musicalCombat && lane===undefined && column.length>visibleRows && <span className="tableau-card-tops" aria-hidden="true">{Array.from({length:Math.min(2,column.length-visibleRows)},(_,rear)=><i key={rear} data-tableau-card-top={visibleRows+rear+1} style={{'--rear-edge':rear+1} as CSSProperties}/>)}</span>}
              {column.map((card, depth) => depth < column.length-visibleRows ? null : lane !== undefined && !(battle.experiment?.layout==='fanned' && lane===1 ? depth===1 || depth===2 : depth===lane) ? null : <ProtoCard key={card.id} card={card} natureAdornment={showTableauElements && cardElement(card)==='nature'} fireAdornment={showTableauElements && cardElement(card)==='fire'} waterAdornment={showTableauElements && cardElement(card)==='water'} airAdornment={showTableauElements && cardElement(card)==='air'} earthAdornment={showTableauElements && cardElement(card)==='earth'} chaosAdornment={showTableauElements && cardElement(card)==='chaos'} allowJumbo={false} concealValue={concealTableau} disabled={battlePaused || (retrieval ? retrievalAP(index,depth)===null : (!battle.rules.spatialLanes && depth < column.length - 1 && !(verticalColumns && verticalCanReach(battle,index,depth,'party'))) || !tableauReceivers(battle, card).length)} footerLabel={battle.experiment?.layout==='fanned' && depth===1 ? '1 AP' : retrievalAP(index,depth)!==null ? retrievalAP(index,depth)+' AP' : card.element==='ice'&&!concealTableau ? <ElementGlyph element="ice" /> : showTableauElements ? ('nature,fire,water,air,earth,chaos'.split(',').includes(cardElement(card))) ? <span className="sr-only">{ELEMENT_FACE[cardElement(card)].name} affinity</span> : <ElementGlyph element={cardElement(card)} /> : undefined} buried={!separatedLanes && depth < column.length - 1} allowBuriedPlay={!!battle.rules.inwardBackfill || verticalColumns && verticalCanReach(battle,index,depth,'party')} centerRank={verticalColumns || separatedLanes || depth === column.length - 1} lit
                active={!holding && (selection?.cardId === card.id || !!retrieval && retrievalCost(battle,retrieval,index,depth)!==null)} selected={!holding && selection?.cardId === card.id}
                cardRef={node => { if (node) { cardRefs.current.set(card.id,node); node.dataset.battleCard=card.id; node.dataset.battleRank=String(card.rank); node.dataset.battleDepth=String(depth); node.toggleAttribute('data-dig-target',digTargetIds.has(card.id));
                  if(verticalColumns){node.dataset.rowReach=verticalReach(battle,index,depth);node.toggleAttribute('data-row-inaccessible',!verticalCanReach(battle,index,depth,battle.turn==='enemy'?'enemy':'party'));const [x,z]=isTiledFloor(battle.sandboxScenario)?floorSlot(index,battle.sandboxScenario):verticalSlot(index,column.length-1-depth),[standX,standZ]=verticalStand(battle);node.toggleAttribute('data-stepping-stand',(battle.sandboxScenario==='223' || isTiledFloor(battle.sandboxScenario)) && Math.hypot(x-standX,z-standZ)<.01);}
                  // Layout lab reach cues: who may take this cell, and whether Hero can play it right now.
                  if (battle.experiment && lane !== undefined) { const reach = laneReach(battle.experiment,index,depth); node.dataset.reach = reach.party ? (reach.enemy ? 'both' : 'party') : reach.enemy ? 'enemy' : 'none';
                    node.toggleAttribute('data-legal', battle.turn==='party' && !battlePaused && tableauReceivers(battle, card).length > 0); } } else cardRefs.current.delete(card.id); }}
                onDropActor={sandbox && !retrieval ? target=>{
                  const actorId=target.dataset.battleActor;
                  const source=cardRefs.current.get(card.id);
                  if(!actorId || !source || battlePaused || !(latest.current.rules.spatialLanes || verticalColumns ? latest.current.columns[index]?.some(item=>item.id===card.id) : latest.current.columns[index]?.slice(-1)[0]?.id===card.id))return;
                  play(index,source,actorId);
                } : undefined}
                onClick={event => {if(retrieval){setBattle(current=>choosingFetch?fetchMusical(current,index,depth):retrieveCard(current,retrieval,index,depth));setRetrieval(null);}else activate(index,event.currentTarget);}}
                style={{ position: 'absolute', left: verticalColumns?`${(index<VERTICAL_ROWS?-1:1)*(column.length-1-depth)*65}%`:0, transform: battle.experiment?.layout==='fanned' && lane===1 ? depth===1?'translate(-8px,-4px) rotate(-6deg)':'translate(12px,var(--fan-drop,48px)) rotate(5deg)':undefined, top: verticalColumns?0:lane === undefined ? `calc(var(--battle-peek) * ${depth-Math.max(0,column.length-visibleRows)})` : 0, zIndex: depth + 1, ...rig.surface(index * 14 - 42, 0) }} />)}
              {!battle.rules.spatialLanes && <PlanSegments plans={plans} column={column} />}
              {column.length > 0 && !sandbox && <TableMark depth={column.length - 1} trap={battle.traps[column[column.length - 1].id]}
                eyes={battle.foes.filter((foe) => foe.hp > 0 && foe.eye?.cardId === column[column.length - 1].id)}
                party={battle.party} />}
            </div>;

  // The layout lab labels each lane with who reaches it; Fanned folds the party rear into the frontier lane.
  const labLaneLines = (depth: number) => !battle.experiment ? null : battle.experiment.layout==='fanned' && depth===1 ? ['Fanned pairs', 'Back: frontier · Hero 1 AP + Dragon', 'Front: party rear · Hero'] : laneLabel(battle.experiment, depth);
  const spatialLane = (depth: number, fallback: string) => { const lines = labLaneLines(depth), label = lines ? lines.join(' · ') : fallback;
    return <div className="battle-spatial-lane" data-lane={['enemy-rear','frontier','party-rear'][depth]} data-pending-redeal={depth>0 && !!battle.pendingRedeal || undefined} role="group" aria-label={label}><span className="battle-spatial-lane__label">{lines ? lines.map((line,i)=>i ? <span key={i}>{line}</span> : <strong key={i}>{line}</strong>) : label}</span><div className="battle-field__rack" style={{ '--rack-columns': tableauWidth(battle) } as CSSProperties}>{battle.columns.slice(0,tableauWidth(battle)).map((column,index)=>renderColumn(column,index,depth))}</div></div>; };
  const endTurnControl = <SceneButton type="button" className="battle-end-turn" disabled={battlePaused || !canEndPlayerTurn(battle)}
              title={battlePaused?'Combat paused':battle.turn==='enemy'?'Enemy turn':battle.result?'Battle complete':canEndPlayerTurn(battle)?'Pass control to the enemy team':'Scripted rescue in progress'}
              onClick={()=>performManeuver(endPlayerTurn)}>END TURN</SceneButton>;

  const sandboxUtilityControls = encounter ? null : <>{battle.result ? <SceneButton type="button" onClick={() => restart()}>Fight again</SceneButton> : <>
              <SceneButton type="button" aria-pressed={paused} disabled={!battle.started || holding} onClick={() => { cancel(); setSelection(null); setPaused((p) => !p); }}>{paused ? 'Resume' : 'Pause'}</SceneButton>
              <SceneButton type="button" disabled={holding} onClick={() => restart()}>Restart</SceneButton>
            </>}</>;
  const recommendedMove = (() => {
    if (!(highlightLegal || highlightHeld) || battlePaused || battle.result || battle.turn !== 'party') return null;
    if (battle.rules.spatialLanes) {
      for (const column of battle.columns) for (const card of column.slice(1)) {
        const actor = eligibleActors(battle, card)[0]; if (actor) return { cardId: card.id, actorId: actor.id };
      }
      return null;
    }
    if (battle.rules.dualRanks) {
      for (const column of battle.columns) { const card = column[column.length - 1]; if (!card) continue; for (const actor of battle.party) if (legalCardRanks(battle, actor.id, card).length) return { cardId: card.id, actorId: actor.id }; }
      return null;
    }
    const rootMoves = battle.columns.flatMap((column, index) => eligibleActors(battle, column[column.length - 1]).map(actor => ({ column: index, foundation: battle.party.indexOf(actor) })));
    const assessment = assessSolverMove({ columns: battle.columns, stock: battle.stock, foundations: battle.party.map(actor => actor.rank) }, { rootMoves });
    if (assessment) { const { column, foundation } = assessment.move; return { cardId: battle.columns[column][battle.columns[column].length-1].id, actorId: battle.party[foundation].id }; }
    if (isVerticalScenario(battle)) for (const { card } of verticalEntries(battle, 'party')) { const actor = eligibleActors(battle, card)[0]; if (actor) return { cardId: card.id, actorId: actor.id }; }
    return null;
  })();
  const solveControls = <TableauSolveControls singleMoveTarget={sandbox?singleMoveTarget:undefined} controlShortcut onHighlightHeldChange={setHighlightHeld} hideStatus={sandbox} highlight={highlightLegal} onHighlightChange={sandbox && !encounter?setHighlightLegal:undefined} key={solverSession} onStep={solveStep} onStart={() => { cancel(); setRetrieval(null); setSelection(null); }} disabled={battlePaused || Boolean(battle.result) || sandbox && battle.turn==='enemy'} allowDivine={false} />;

  // Keru scenarios: Hero's AP meter pours into Keru, and (1006, 1012) Keru cast straight onto a target.
  const castOn = (keru: InvokeKeruId, targetId: string) => { const before = latest.current, next = castKeru(before, keru, targetId);
    if (next === before) { setAnnouncement(`${INVOKE_BUFFS[keru].name} did not cast: ${castReason(before, keru, targetId) ?? 'blocked'}`); return; }
    setBattle(next); setAnnouncement(`${INVOKE_BUFFS[keru].name} cast ${KERU_CASTS[keru].name} on ${[...next.party, ...next.foes].find(unit => unit.id === targetId)?.name ?? targetId}; ${INVOKE_BUFFS[keru].name} is ${(['1012', '111', '100', '101', '102', '103', '104', '105'].includes(before.sandboxScenario ?? ''))?'discarded':'exhausted'} for this battle`); };
  return <KeruBoardProvider battle={battle} fieldRef={fieldRef} disabled={nightBlocking || paused || holding || Boolean(abilityCast) || Boolean(inspection) || cirInspection || globalPaused && (!combatInspection.active || gameTime.isPlayerPaused())} onFeed={keru => setBattle(b => feedKeru(b, keru))} onFeedTier={keru => setBattle(b => feedToNextTier(b, keru))} onPour={() => setBattle(b => pourIntoSeal(b))} onCast={castOn}>
  <section ref={fieldRef} data-complete-view={sandbox && !encounter?.suppressCompletion && (rewardPreview || battle.result && (battle.result!=='won' || defeatReady)) || undefined} data-reward-active={sandbox && !encounter?.suppressCompletion && (rewardPreview || battle.result==='won' && defeatReady) && (rewardPreview || isSeriesEncounter(sandboxScenarioId)) || undefined} data-scenario={battle.sandboxScenario} className="battle-field" data-snowflake-active={(stickerArmed||stickerDragging)||undefined} data-dig-drag={targetDrag?.dig || undefined} style={{'--tableau-visible-rows': musicalCombat ? musicalVisibleRows : undefined, '--hero-position': battle.experiment?.position ?? 2, '--combat-ability-slots': COMBAT_ABILITY_SLOTS, '--tile-cols': floorLayout(battle.sandboxScenario).cols, '--tile-rows': floorLayout(battle.sandboxScenario).rows, '--tableau-card-limit': `${Number.isFinite(tableauCardLimit) ? tableauCardLimit : 10000}px`} as CSSProperties} data-vertical-columns={verticalColumns || undefined} data-tiled-floor={isTiledFloor(battle.sandboxScenario) || undefined} data-layout-experiment={battle.experiment?.layout} data-layered-reach={battle.rules.inwardBackfill || undefined} data-spatial-lanes={separatedLanes || undefined} data-camera-background={active || undefined} data-first-team={BATTLE_TURN_PRIORITY[0]}
    data-night-cloud={battle.night?.cloud || undefined} data-night-phase={battle.night?.phase} data-night-step={battle.night?.step} data-highlight-legal={highlightLegal || highlightHeld} data-team-turn={sandbox ? battle.turn : undefined} data-combat-paused={presentationPaused || undefined} data-result={battle.result ?? undefined} data-tactical-paused={holding || globalPaused || combatInspection.active || undefined} data-aiming={aim && !abilityInspection ? aim.mode : undefined} aria-label="Battle foundations and shared woods tableau">
    {combatInspection.overlay}
    {sandbox && <CombatTurnBanners key={sandboxScenarioId+'-'+bannerSession} battle={battle} paused={presentationPaused} />}
    {battle.night && <NightRescueScene key={solverSession} battle={battle} setBattle={setBattle} fieldRef={fieldRef} paused={paused || holding || globalPaused || Boolean(inspection)} onBlocking={setNightBlocking}/>}
    <header className="battle-field__header">
      {encounter && !battle.result && <output className="aldan-combat-turn" aria-live="polite">{battle.turn === 'enemy' ? 'Enemy turn · light spent' : 'Your turn · play or use an ability'}</output>}
      {battle.experiment && <div className="layout-laboratory"><nav role="tablist" aria-label="Layout experiments">{LAYOUT_EXPERIMENTS.map(layout=><button type="button" role="tab" id={'layout-tab-'+layout.id} aria-controls="layout-experiment-panel" aria-selected={battle.experiment!.layout===layout.id} key={layout.id} onClick={()=>{restart('1001');setBattle(createLayoutExperiment(layout.id));}} onKeyDown={event=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;event.preventDefault();const current=LAYOUT_EXPERIMENTS.findIndex(item=>item.id===layout.id),index=event.key==='Home'?0:event.key==='End'?5:(current+(event.key==='ArrowRight'?1:5))%6;document.getElementById('layout-tab-'+LAYOUT_EXPERIMENTS[index].id)?.click();document.getElementById('layout-tab-'+LAYOUT_EXPERIMENTS[index].id)?.focus();}}>{layout.name}</button>)}</nav>
      <p id="layout-experiment-panel" role="tabpanel" aria-labelledby={'layout-tab-'+battle.experiment.layout}>{LAYOUT_EXPERIMENTS.find(item=>item.id===battle.experiment!.layout)?.detail} <span>Seed 1001 · tabs restart the same deal · 3 starting AP / Momentum</span></p>
      {battle.experiment.layout==='position' && <div className="layout-position-controls"><button type="button" disabled={battlePaused || moveExperiment(battle,-1)===battle} onClick={()=>{setBattle(state=>moveExperiment(state,-1));setSelection(null);}}>← 1 column</button><span>Hero column {battle.experiment.position+1} · 1 Momentum / column</span><button type="button" disabled={battlePaused || moveExperiment(battle,1)===battle} onClick={()=>{setBattle(state=>moveExperiment(state,1));setSelection(null);}}>1 column →</button></div>}
      </div>}
      {sandbox && !encounter && !musicalCombat && <label className="battle-controls__sandbox-scenario"><span className="sr-only">Combat scenario</span>
        <select aria-label="Combat scenario" value={sandboxScenarioId} onChange={event=>restart(event.target.value)}>
          {scenarioOptions.map(option=><option key={option.id} value={option.id}>{option.name}</option>)}
        </select>
      </label>}
      {sandbox && tutorialRounds(battle)!==null && <output className="battle-rounds" aria-live="polite">Rounds completed: {tutorialRounds(battle)}</output>}
      {sandbox && !encounter && <SceneButton className="combat-sandbox__camera-toggle" type="button" aria-pressed={cameraOpen} aria-label={cameraOpen ? 'Close battle camera' : 'Load battle camera'} onClick={onWatch}><span aria-hidden="true">📷</span></SceneButton>}
      {!sandbox && <>{solveControls}<h2>Dark Woods</h2></>}{retrieval && <button type="button" onClick={()=>setRetrieval(null)}>Cancel {retrieval.split(':')[1]}</button>}
      {musicalCombat&&<ScenarioShare battle={battle} onRestore={snapshot=>{const option=scenarioOptions.find(o=>o.id===snapshot.scenario);if(!option)throw Error('This scenario is not available in this scene.');gameTime.setPaused(true);setOpeningSnowflake(false);setRewardPreview(false);setSandboxScenarioId(option.id);setBattle(snapshot.state);seriesCheckpoint.current={id:option.id,state:structuredClone(snapshot.state)};setPaused(false);setAnnouncement('Scenario restored paused · Use Resume scenario');}} onError={()=>{setPaused(false);setAnnouncement('Scenario link could not be restored. Open Settings for details.');}}/>}
      {!encounter && <fieldset className="battle-controls" aria-label="Battle setup" disabled={holding || sandbox && battle.turn==='enemy'}>
        {!sandbox && <label className="battle-controls__scenario" title={scenario.blurb}>
          <select aria-label="Scenario" value={scenarioId} onChange={(event) => restart(event.target.value)}>
            {BATTLE_SCENARIOS.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}
          </select>
        </label>}
        {!sandbox && <label className="battle-controls__max-ap" title="Debug: unlimited ability AP for all player actors. Banked AP is preserved.">
          <input type="checkbox" checked={battle.maxAP} onKeyDown={event=>{if(event.key==='Enter'){event.preventDefault();event.currentTarget.click();}}} onChange={event => {cancel();setBattle(current=>setMaxAP(current,event.target.checked));}} />
          <span>maxAP</span>
        </label>}
        {sandbox ? <details className="battle-config"><summary aria-label="Settings"><span aria-hidden="true">⚙</span></summary><div className="battle-config__panel" role="group" aria-label="Sandbox configuration"><label><input type="checkbox" checked={globalLights} onChange={event=>setGlobalLightsEnabled(event.target.checked)}/> Global lights</label><label className="battle-config__value-style">Momentum numerals<select value={momentumValueStyle} onChange={event=>setMomentumValueStyle(event.target.value as MomentumValueStyle)}><option value="flamelab">Flame lab</option><option value="stroked">Stroked</option></select></label><label><input type="checkbox" checked={battle.momentum?.decayEnabled!==false} onChange={event=>setBattle(state=>setMomentumDecay(state,event.target.checked))}/> Momentum decay</label><span hidden={musicalCombat}><SceneButton type="button" aria-pressed={hasMochi} onClick={() => setBattle((b) => setMochi(b, !hasMochi))}>{hasMochi ? 'Remove Mochi' : 'Add Mochi'}</SceneButton></span>{configContent}{musicalCombat&&<PackLeaderControls battle={battle} onChange={patch=>setBattle(state=>setPackLeaderTuning(state,patch))}/>}{musicalCombat && <label>Fast Swipes draft rarity<select aria-label="Fast Swipes gameplay rarity" value={battle.party.find(a=>a.fastSwipes)?.fastSwipes?.tier ?? battle.fastSwipesTier ?? 0} onChange={event=>setBattle(s=>setFastSwipesTier(s,Number(event.target.value) as 0|1|2|3))}>{([0,1,2,3] as const).map(tier=><option key={tier} value={tier}>{fastSwipesSpec(tier).name} · draft</option>)}</select></label>}{musicalCombat && <label>Encounter<select aria-label="Combat scenario" value={sandboxScenarioId} onChange={event=>restart(event.target.value)}>{scenarioOptions.map(option=><option key={option.id} value={option.id}>{option.name}</option>)}</select></label>}</div></details> : <SceneButton type="button" aria-pressed={hasMochi} onClick={() => setBattle((b) => setMochi(b, !hasMochi))}>{hasMochi ? 'Remove Mochi' : 'Add Mochi'}</SceneButton>}
        {!sandbox && <span className="battle-controls__stepper" role="group" aria-label={`Slimes: ${battle.foes.length}`}>
          <SceneButton type="button" aria-label="Remove a slime" disabled={battle.foes.length <= 1} onClick={() => setBattle(removeSlime)}>−</SceneButton>
          <span aria-hidden="true">Slimes {battle.foes.length}</span>
          <SceneButton type="button" aria-label="Add a slime" disabled={battle.foes.length >= MAX_FOES} onClick={() => setBattle(addSlime)}>+</SceneButton>
        </span>}
        {!sandbox && <SceneButton type="button" aria-pressed={heroCal} title="Cal, a fire spirit: Hero's ability gains fire above combo 3" onClick={() => setBattle((b) => setSpirit(b, 'hero', 'cal', !heroCal))}>Cal {heroCal ? 'on' : 'off'}</SceneButton>}
      </fieldset>}
      {sandbox && !musicalCombat && !encounter && !seedParty && (!isTruefourstar(battle.sandboxScenario) || tutorialById(battle.tutorial?.id)?.notes) && tutorialById(battle.tutorial?.id) && <ScenarioNotes defaultCollapsed={isTruefourstar(battle.sandboxScenario) && window.innerWidth < 1600} key={sandboxScenarioId} scenario={tutorialById(battle.tutorial?.id)!}
        considerations={battle.experiment ? (layout => ({ title: layout.name, pros: layout.pros, cons: layout.cons }))(LAYOUT_EXPERIMENTS.find(layout => layout.id === battle.experiment!.layout)!) : undefined} />}
    </header>
    {targetDrag && createPortal(<><div ref={node=>{targetGhostRef.current=node;if(node){const point=targetPointer.current;node.style.transform=`translate3d(${point.x}px, ${point.y}px, 0) translate(-50%, var(--target-ghost-offset-y, -50%)) rotate(-6deg)`;}}} className="battle-target-ghost" data-dig-ghost={targetDrag.dig || undefined} style={{left:0,top:0}} aria-hidden="true">
      {targetDrag.dig ? <AdeptFace kinId="hero" title="Dig" description="Bank a second-row card"/> : musicalCombat && targetDrag.actorId==='hero'?<BiteFace value={battle.party.find(a=>a.id==='hero')?.rank ?? 2} damage={battle.bite?.moves ?? 0}/>:<ActorHoloCard actorId={targetDrag.actorId} name={battle.party.find(a=>a.id===targetDrag.actorId)?.name ?? ''} rank={rankLabel(battle.party.find(a=>a.id===targetDrag.actorId)?.rank ?? 1)} />}
    </div>{targetDrag.dig && <div ref={digTargetMarker} className="dig-target-marker" hidden aria-hidden="true">
      <div className="dig-target-marker__face" /><span>Dig target</span>
    </div>}</>,document.body)}
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
    {sandbox && battle.momentum && createPortal(<div className="battle-momentum-overlay"><MomentumEngine valueStyle={momentumValueStyle} showDecay={false} paused={presentationPaused} timeScale={battleTimeScale(battle)} pool={battle.momentum} onOpenSkills={musicalCombat ? ()=>setAvailableSummons(visible=>!visible) : ()=>{if(!nightBlocking && !battle.result && !paused && !holding && !globalPaused && !abilityCast){cancel();setSelection(null);setSkillOwners([]);setDirectWithdraw(false);setSkillMenuOpen(true);}}} onDecayChange={enabled=>setBattle(state=>setMomentumDecay(state,enabled))} /></div>, document.querySelector('.combat-sandbox') ?? document.body)}
    <TableauScene immersive={false} terrain="woods" biome={{ terrain: 'woods', danger: true }} rig={rig} hours={hours}>
      <div className="battle-field__board">
        {sandbox && battleTimeScale(battle)<1 && <BattleBulletTime />}
        {sandbox && <BattleTargetArrows battle={battle} />}
        <RecommendedMoveArrow move={recommendedMove} />
        {separatedLanes && spatialLane(0, 'Dragon rear · enemy only')}
        {foeRow}
        <div className="battle-field__middle">
          {separatedLanes && spatialLane(1, battle.experiment?.layout==='fanned'?'Fanned pairs · left card costs 1 AP':'Shared frontier')}
          <div className="battle-field__tableau" hidden={separatedLanes} role="group" aria-label="Shared tableau · Small Woods at 0,-1">
            <div className="battle-field__rack" style={sandbox ? { '--rack-columns': battle.columns.length + (battle.tutorial?.intent && !casterIntent ? 1 : 0) } as CSSProperties : undefined}>
            {!separatedLanes && battle.columns.slice(0,sandbox ? tableauWidth(battle) : undefined).map((column,index)=>renderColumn(column,index))}
            {sandbox && !separatedLanes && battle.columns.slice(tableauWidth(battle)).map((column,i)=>column.length ? renderColumn(column,i+tableauWidth(battle)) : null)}
            {sandbox && !casterIntent && intentSlot}
            <PlanLegend plans={plans} />
            </div>
          </div>

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
        {separatedLanes && battle.experiment?.layout!=='fanned' && spatialLane(2, 'Party rear · allies only')}
      </div>
    </TableauScene>
    {sandbox && (skillMenuOpen || musicalCombat) && !battle.result && <MomentumSkillRadial hideFastSwipes={musicalCombat} onFastSwipesEquip={()=>setBattle(equipFastSwipes)} onBiteEquip={()=>setBattle(equipBite)} persistent={musicalCombat && !skillMenuOpen} onRewardCast={(id,actorId,targetId)=>{const next=id==='snow-golem'?summonSnowGolem(latest.current):castGlacialLance(latest.current,actorId,targetId);if(next===latest.current){setAnnouncement('Ability unavailable: check AP and target');return;}setBattle(next);setSkillMenuOpen(false);setSkillOwners([]);}} onCast={castOn} onInvoke={(keru,replace)=>{const next=invokeKeru(latest.current,keru,replace);if(next===latest.current){setAnnouncement(`${INVOKE_BUFFS[keru].name} not invoked: ${invokeReason(latest.current,keru,replace) ?? 'blocked'}`);return;}cancel();setSelection(null);setBattle(next);setSkillMenuOpen(false);setSkillOwners([]);setAnnouncement(`${INVOKE_BUFFS[keru].name} invoked${replace?` in place of ${INVOKE_BUFFS[replace].name}`:''}: Hero’s foundation is now ${rankLabel(next.party.find(unit=>unit.id==='hero')?.rank ?? 1)}`);}} familiarOccupants={Object.values(familiarScaffold)} onFamiliarPlace={(name,slot)=>{setFamiliarScaffold(current=>({...current,[slot]:name}));setSkillMenuOpen(false);setSkillOwners([]);}} initialSkill={directWithdraw?'withdraw':undefined} onWithdrawSelecting={setWithdrawSelecting} onFoundationSlotChange={setSummonSlot} onFamiliarSlotChange={setFamiliarSlots} onTapIn={id=>{setBattle(s=>tapInKeru(s,id));setSkillMenuOpen(false);setSkillOwners([]);}} key={skillOwners.length?'kin':'momentum'} owners={musicalCombat && !skillMenuOpen ? battle.party.filter(actor=>actor.hp>0 && actor.controller!=='npc' && actor.foundationMode!=='support').map(actor=>actor.id) : skillOwners} onToggleOwner={!musicalCombat && kinRadials ? toggleKinRadial : undefined} valueStyle={momentumValueStyle} battle={battle} fieldRef={fieldRef} disabled={paused || holding || globalPaused && (!combatInspection.active || gameTime.isPlayerPaused())} onClose={()=>{setSkillMenuOpen(false);setSkillOwners([]);}} onChoose={(id,targetId)=>{if(id==='withdraw'){setSkillMenuOpen(false);performManeuver(state=>useMomentumSkill(state,id,targetId),true);return;}const card=document.querySelector<HTMLElement>('.ability-fan__drag, .ability-fan__armed-preview') ?? document.querySelector<HTMLElement>(`.ability-fan button[data-skill="${id}"]`);if(!card)return;setAbilityCast({id,targetId,card:card.cloneNode(true) as HTMLElement,origin:card.getBoundingClientRect()});setSkillMenuOpen(false);setSelection(null);}} />}
    {openingStickerVisible && createPortal(<>
    <SnowflakeRewardShade fieldRef={fieldRef} revealedKin={revealedStickerKin} />
    <aside ref={openingStickerAnchor} className="snowflake-opening" aria-label="Opening reward">
      <FlurryAmbiance />
      <div className="snowflake-opening__sticker">
      <SnowflakeDrag label="Flurry · Choose a kin" armed={stickerArmed} disabled={!stickerReady}
        onActivate={()=>{cancel();setSelection(null);setRetrieval(null);setStickerArmed(armed=>!armed);}} onDragging={setStickerDragging} onDrop={under=>{
          const target=under?.closest<HTMLElement>('[data-snowflake-eligible]');
          if(target&&fieldRef.current?.contains(target))chooseStickerKin(target.dataset.battleActor);
        }}/>
      <p><strong>Flurry</strong><span>{stickerArmed?'Choose a kin foundation':'Drag to a kin foundation'}</span></p>
      </div>
    </aside></>,document.body)}
    {musicalCombat && <Grit battle={battle} visible={availableSummons} fieldRef={fieldRef} onUse={change=>{if(!gameTime.isPlayerPaused())setBattle(change);}}/>}
    {musicalCombat && <Adept battle={battle} visible={availableSummons} fieldRef={fieldRef} onDig={bankDigCard} onChange={change=>{if(!gameTime.isPlayerPaused()||battle.adeptFrenzy)setBattle(change);}}/>}
    {musicalCombat && !battle.result && <MusicalSummons key={sandboxScenarioId+"-"+bannerSession} battle={battle} visible={availableSummons} fieldRef={fieldRef} onDragging={setSwipeSummonDragging} onSummon={()=>{if(gameTime.isPlayerPaused()||paused||holding)return false;const current=latest.current,next=equipFastSwipes(current);if(next===current)return false;setBattle(next);setAvailableSummons(false);return true;}}/>}
    {cirInspection && battle.cir?.status==='bound' && <CirFamiliarInspector kin={battle.cir.actorId} disabled={paused || holding || gameTime.isPlayerPaused()} onClose={()=>setCirInspection(false)} onReturn={()=>{setBattle(returnCirToDeck);setCirInspection(false);}} />}
    {sandbox && skillMenuOpen && skillOwners.includes('snow-golem') && !battle.result && createPortal(<div className="ice-combat-cards"><button type="button" className="ice-combat-dismiss" onClick={()=>{setBattle(s=>golemFarewell({...s,party:s.party.map(a=>a.id==='snow-golem'?{...a,hp:0}:a)}));setSkillMenuOpen(false);setSkillOwners([]);}}>Dismiss Snow Golem</button></div>,document.body)}
    {abilityCast && <MomentumAbilityFlight cast={abilityCast} fieldRef={fieldRef} paused={paused || holding || globalPaused} onImpact={()=>{if(abilityCast.id==='focus-fire')burnCardsFx(focusFireCards(latest.current,abilityCast.targetId).flatMap(card=>cardRefs.current.get(card.id) ?? []));setBattle(state=>useMomentumSkill(state,abilityCast.id,abilityCast.targetId));}} onComplete={()=>setAbilityCast(null)} />}
    {!sandbox && <BattleDamageCallouts battle={battle} fieldRef={fieldRef} paused={battlePaused} />}
    {encounter?.recipes && <MoteRecipeControls battle={battle} onChange={setBattle}/>}
    {sandbox && <div className="battle-field__solver-dock"><div className="battle-field__solver-actions">{solveControls}{sandboxUtilityControls}</div><div className="battle-field__turn-actions"><div ref={setSingleMoveTarget} className="battle-field__single-move" />{battle.keruExpedition && <span className="keru-tap-status" role="status">Tap-in {battle.keruTapInUsed?'spent':'ready'}</span>}{endTurnControl}</div></div>}
    {selection?.rankOptions && <div className="split-card-choice" role="group" aria-label="Choose card value" onKeyDown={event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();setSelection(null);cardRefs.current.get(selection.cardId)?.focus();}}}><span>Play which value on {receiverName(selection.actorIds[0])}?</span>{selection.rankOptions.map(rank=><button type="button" key={rank} autoFocus={rank===selection.rankOptions?.[0]} onClick={()=>{const source=cardRefs.current.get(selection.cardId);if(source)play(selection.columnIndex,source,selection.actorIds[0],rank);}}>Play {rankLabel(rank)}</button>)}<button type="button" onClick={()=>setSelection(null)}>Cancel</button></div>}
    {sandbox && !encounter?.suppressCompletion && (rewardPreview || battle.result && (battle.result!=='won' || defeatReady)) && <CombatScenarioComplete rewardHeading={encounter?.rewardHeading} rewardChoices={encounter?.rewardChoices ?? (rewardPreview&&specifiedReward?[{id:specifiedReward,tier:0}]:undefined)} chooseLabel={encounter?.chooseLabel} expedition={Boolean(encounter)} heroFoundation={()=>fieldRef.current?.querySelector<HTMLElement>('[data-battle-actor="hero"]') ?? null} scenarioId={sandboxScenarioId} won={rewardPreview || battle.result==='won'} preview={rewardPreview} battle={battle} heroHp={battle.party.find(actor=>actor.id==='hero')?.hp} heroMaxHp={battle.party.find(actor=>actor.id==='hero')?.maxHp} onHeal={amount=>setBattle(current=>({...current,party:current.party.map(actor=>actor.id==='hero'?{...actor,hp:rewardHeal(actor.hp,actor.maxHp,amount)}:actor)}))} onChoose={(id,rewards)=>{if(encounter){encounter.onComplete(battle,rewards ?? []);return;}setRewardPreview(false);restart(id, battle.result==='won' && (id!==sandboxScenarioId || Boolean(rewards?.length)),rewards);}} detail={tutorialRounds(battle)!==null ? `Rounds completed: ${tutorialRounds(battle)}` : undefined} />}
    {!active && <footer className="battle-field__footer"><SceneButton type="button" onClick={onWatch}>Watch battle scene</SceneButton></footer>}
    {aim && heldAttack && createPortal(<><div className="ability-card-popover" style={{left:abilityAnchor.x,top:abilityAnchor.y,opacity:aim.mode==='drag'?0:1,visibility:abilityInspection?'hidden':undefined}} role="region" aria-label="Primed ability">
          <button className="ability-card-popover__close" type="button" onClick={cancel} aria-label="Cancel ability">×</button>
          <AbilityCard attack={heldAttack} unavailableReason={!playableAttack ? 'Not enough AP to play · Click to inspect' : undefined} interaction={cardProps(aim.actorId,!paused && !battle.result,anchor => setAbilityInspection({attack:heldAttack,anchor}))} />
          {heldAttack.form === 'Vice Grip' && <label className="ability-card-popover__commit">Commit AP <input type="number" min="3" max={battle.maxAP ? undefined : Math.max(3,battle.party.find(a=>a.id===heldAttack.actorId)?.charge ?? 0)} value={heldAttack.charge} aria-label="AP to commit to Vice Grip"
            onChange={event=>{const points=Math.max(3,Math.floor(Number(event.target.value))||3);setGripAP(points);prime(heldAttack.actorId+':Vice Grip:'+points);}} /></label>}
        </div>{aim.mode==='drag' && <div className="ability-card-drag" style={{left:aim.x,top:aim.y}} aria-hidden="true"><AbilityCard attack={heldAttack} ghost /></div>}</>, document.body)}
  </section>
  </KeruBoardProvider>;
}












