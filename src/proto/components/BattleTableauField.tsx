import { ActorHoloCard, ACTOR_HOLO_ART } from './ActorHoloCard';
import { DetailsCardViewer, ActorCardArt } from './DetailsCardViewer';
import { requestHoloDeviceTilt } from '../useHoloDeviceTilt';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { BATTLE_SPRITE_ASSETS } from '../battleSpriteAssets';
import { DARK_SLIME_DIRECTIONAL_SPRITE, type DirectionalSpriteDefinition } from '../directionalSprites';
import { MOCHI_DIRECTIONAL_SPRITE } from '../mochiSprite';
import { rankLabel, type Card } from '../protoState';
import { createSeededSmallWoodsDeal } from '../rules/setup';
import {
  MAX_FOES, actorAttack, addSlime, applyAttack, applyTrap, canDeal, createBattle, dealRow, eligibleActors, enemyTarget, playCard,
  previewAttack, previewTrap, redrawActor, removeSlime, setMochi, setSpirit, tickBattle, type BattleState,
} from '../rules/battle';
import { BATTLE_SCENARIOS, scenarioById } from '../rules/battleScenarios';
import { getCardTransportDurationMs } from '../protoTransport';
import { solverFlightDuration } from '../solverTiming';
import { createTableauLightRig } from '../tableauLighting';
import type { TableLight } from '../protoLighting';
import { ProtoCard } from './ProtoCard';
import { TableauScene } from './TableauScene';
import { SceneButton } from './SceneButton';
import { SpriteStandeeArt } from './SpriteStandee';
import { WORLD_ACTOR_SPRITES } from '../protoData';
import type { StandeeLighting } from '../protoLighting';
import { AbilityCard, AbilityGhost, FoeCard, PartyVitals, TableMark } from './BattleUnits';
import { useAbilityDrag } from './useAbilityDrag';
import { useBattleFx } from './useBattleFx';
import { sceneOf, type BattleScene } from '../rules/battleCues';
import './BattleTableauField.css';
import { BATTLE_TURN_PRIORITY } from '../battleTurnPriority';

const SPRITES: Record<string, DirectionalSpriteDefinition | string> = {
  hero: WORLD_ACTOR_SPRITES.hero, mochi: MOCHI_DIRECTIONAL_SPRITE,
  'dark-slime': DARK_SLIME_DIRECTIONAL_SPRITE, 'rear-slime': DARK_SLIME_DIRECTIONAL_SPRITE, 'small-slime': DARK_SLIME_DIRECTIONAL_SPRITE,
};
const previewDeal = createSeededSmallWoodsDeal();
/** Battle state updates this often; bars ease between updates in CSS. */
const TICK_MS = 100;

/** Hero shares the expedition art; Mochi uses the equivalent quarter-facing pose. */
function FoundationSprite({ sprite, name, lighting }: { sprite: DirectionalSpriteDefinition | string; name: string; lighting: StandeeLighting }) {
  if (typeof sprite === 'string') return <span className="battle-field__sprite" role="img" aria-label={`${name} sprite`}>
    <SpriteStandeeArt sprite={sprite} lighting={lighting} size={64} />
  </span>;
  const frame = sprite.low[sprite.id === 'mochi' ? 1 : 0], rect = frame.parts[0].rect;
  return <svg className="battle-field__sprite" viewBox={rect.join(' ')} preserveAspectRatio="xMidYMax meet" data-foundation-pose={sprite.id === 'mochi' ? 'quarter' : 'front'} role="img" aria-label={`${name} sprite`}>
    <image href={`${import.meta.env.BASE_URL}assets/${BATTLE_SPRITE_ASSETS[frame.source]}`} />
  </svg>;
}

const statusLine = (battle: BattleState, paused: boolean) =>
  battle.result === 'won' ? 'Victory · the slimes are beaten'
    : battle.result === 'lost' ? 'The party is down'
      : !battle.started ? 'Slimes stir on your first play'
        : paused ? 'Paused' : battle.rules.traps ? 'Hit a slime, or trap the card it eyes'
          : battle.rules.hungry ? 'Snatch eyed cards, then strike' : 'Build charge, then drag an ability onto a slime';

export function BattleTableauField({ hours, lights, onWatch, active, onSceneChange, heroStamina, onRedraw }: {
  hours: number; lights: readonly TableLight[]; onWatch: () => void; active: boolean;
  /** Units (fallen ones included) and recent events, for the 3D arena's animations. */
  onSceneChange?: (scene: BattleScene) => void;
  /** The Hero's world stamina coming into the fight. */
  heroStamina?: number;
  /** An actor spent 1 stamina on a foundation redraw. */
  onRedraw?: (actorId: string) => void;
}) {
  const [scenarioId, setScenarioId] = useState(BATTLE_SCENARIOS[0].id);
  const [battle, setBattle] = useState(() => createBattle(previewDeal, { ...BATTLE_SCENARIOS[0].setup, stamina: { hero: heroStamina } }));
  const [paused, setPaused] = useState(false);
  const foundationRefs = useRef(new Map<string, HTMLDivElement>());
  const cardRefs = useRef(new Map<string, HTMLButtonElement>());
  const [selection, setSelection] = useState<{columnIndex: number; cardId: string; actorIds: string[]} | null>(null);
  const flights = useRef(new Set<() => void>());
  const [announcement, setAnnouncement] = useState('');
  const [inspection, setInspection] = useState<{ id: string; name: string; anchor: HTMLElement } | null>(null);
  useEffect(() => () => { flights.current.forEach((cancel) => cancel()); }, []);

  // Enemy clocks run in real time once the party has played.
  const running = battle.started && !battle.result && !paused;
  useEffect(() => {
    if (!running) return;
    let last = performance.now();
    const timer = window.setInterval(() => {
      const now = performance.now();
      const dt = Math.min(0.25, (now - last) / 1000); last = now;
      setBattle((current) => tickBattle(current, dt));
    }, TICK_MS);
    return () => window.clearInterval(timer);
  }, [running]);

  // The arena hears about the battle only when a unit falls or something happens, not every tick.
  const units = [...battle.party.map((a) => `${a.id}:${a.hp > 0}`), ...battle.foes.map((f) => `${f.id}:${f.hp > 0}`)].join(',');
  const lastEvent = battle.events[battle.events.length - 1]?.id ?? 0;
  const sceneChange = useRef(onSceneChange); sceneChange.current = onSceneChange;
  const latest = useRef(battle); latest.current = battle;
  useEffect(() => { sceneChange.current?.(sceneOf(latest.current)); }, [units, lastEvent]);
  // Bites, flinches and falls on the cards themselves.
  const fieldRef = useRef<HTMLElement>(null);
  useBattleFx(fieldRef, battle.events);

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
    const foe = battle.foes.find((f) => f.id === foeId)!;
    setAnnouncement(`${preview.attack.name} hits ${foe.name} for ${preview.damage}${preview.ko ? ', defeated' : preview.staggers ? ', staggered' : ''}`);
  };
  const { aim, cardProps, foeProps, cancel } = useAbilityDrag(spend);
  useEffect(() => { if (battle.result) cancel(); }, [battle.result]); // eslint-disable-line react-hooks/exhaustive-deps

  const play = (index: number, source: HTMLButtonElement, actorId: string) => {
    const column = battle.columns[index];
    const card = column[column.length - 1];
    const actor = card && eligibleActors(battle, card).find(actor => actor.id === actorId);
    const destination = actor && foundationRefs.current.get(actor.id);
    if (!card || !actor) return;
    setSelection(null);
    setBattle((current) => playCard(current, index, actor.id));
    setAnnouncement(`${rankLabel(card.rank)} added to ${actor.name}'s foundation · charge ${Math.min(10, actor.charge + 1)}`);
    if (!destination) return;
    // The play lands at once; the flight is the card's journey to the foundation.
    const from = source.getBoundingClientRect(), to = destination.getBoundingClientRect();
    const ghost = source.cloneNode(true) as HTMLButtonElement;
    ghost.disabled = true;
    ghost.classList.add('battle-card-flight');
    ghost.dataset.targetActor = actor.id;
    ghost.style.cssText = `position:fixed;left:${from.x}px;top:${from.y}px;width:${from.width}px;height:${from.height}px;--classic-card-w:${from.width}px;--classic-radius:5px;z-index:60000;pointer-events:none;transform-origin:0 0;font:16px/1.15 'Classic Pixel',monospace;`;
    document.body.append(ghost);
    const scale = to.width / from.width;
    const dx = to.x - from.x, dy = to.y - from.y;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const animation = ghost.animate([
      {transform:'translate(0,0) scale(1)'},
      {transform:`translate(${dx * .5}px,${dy * .5 - 35}px) scale(${(1 + scale) / 2})`, offset:.5},
      {transform:`translate(${dx}px,${dy}px) scale(${scale})`},
    ], {duration:reduced ? 1 : solverFlightDuration(getCardTransportDurationMs(from,to)), easing:'ease-out', fill:'forwards'});
    const done = () => { animation.cancel(); ghost.remove(); flights.current.delete(done); };
    flights.current.add(done);
    animation.onfinish = done;
  };
  // Match Proto's playColumn / chooseFoundationTarget sequence: never choose
  // between equally eligible actors on the player's behalf.
  const activate = (index: number, source: HTMLButtonElement) => {
    const column = battle.columns[index], card = column[column.length - 1];
    if (!card) return;
    // An armed ability in a trap battle sets its trap on the pressed card instead.
    if (aim?.mode === 'armed' && previewTrap(battle, aim.actorId, index)) { cancel(); spend(aim.actorId, `card:${index}`); return; }
    const actors = eligibleActors(battle, card);
    if (actors.length === 1) { play(index,source,actors[0].id); return; }
    if (actors.length > 1) {
      setSelection(selection?.cardId === card.id ? null : {columnIndex:index,cardId:card.id,actorIds:actors.map(actor=>actor.id)});
      setAnnouncement(`Choose a foundation for ${rankLabel(card.rank)}: ${actors.map(actor=>actor.name).join(' or ')}`);
    }
  };
  const choose = (actorId: string) => {
    if (!selection || !selection.actorIds.includes(actorId)) return;
    const column = battle.columns[selection.columnIndex];
    const source = cardRefs.current.get(selection.cardId);
    if (source && column[column.length - 1]?.id === selection.cardId) play(selection.columnIndex,source,actorId);
  };
  const redraw = (actorId: string) => {
    const next = redrawActor(battle, actorId);
    if (next === battle) return;
    const actor = next.party.find((a) => a.id === actorId)!;
    setSelection(null);
    setBattle(next);
    onRedraw?.(actorId);
    setAnnouncement(`${actor.name} redraws: foundation is now ${rankLabel(actor.rank)} · ${actor.stamina} stamina left`);
  };
  /** Restarts the current scenario with the roster as adjusted, or a fresh scenario as authored. */
  const restart = (nextScenario?: string) => {
    cancel(); setSelection(null); setPaused(false);
    // A new scenario starts as authored; stamina spent on redraws stays spent.
    if (nextScenario) { setScenarioId(nextScenario); setBattle((current) => createBattle(previewDeal, { ...scenarioById(nextScenario).setup, stamina: Object.fromEntries(current.party.map((a) => [a.id, a.stamina])) })); return; }
    setBattle((current) => createBattle(previewDeal, {
      ...scenarioById(scenarioId).setup,
      mochi: current.party.some((a) => a.id === 'mochi'), slimes: current.foes.length,
      spirits: Object.fromEntries(current.party.map((a) => [a.id, a.spirits])),
      stamina: Object.fromEntries(current.party.map((a) => [a.id, a.stamina])),
    }));
  };

  // Small Woods at table:0,-1 supplies the field's established scenery and lighting.
  const rig = createTableauLightRig(hours, { x: 0, y: -48 }, lights);
  const target = enemyTarget(battle);
  const hasMochi = battle.party.some((a) => a.id === 'mochi');
  const heroCal = battle.party.find((a) => a.id === 'hero')?.spirits.includes('cal') ?? false;
  const heldAttack = aim ? actorAttack(battle, aim.actorId) : null;
  const previews = new Map(aim ? battle.foes.map((foe) => [foe.id, previewAttack(battle, aim.actorId, foe.id)]) : []);
  const trapPreviews = aim && battle.rules.traps ? battle.columns.map((_, column) => previewTrap(battle, aim.actorId, column)) : [];
  const aimedColumn = aim?.foeId?.startsWith('card:') ? Number(aim.foeId.slice(5)) : null;
  const ghostPreview = aim?.foeId && aimedColumn === null ? previews.get(aim.foeId) ?? null : null;
  const ghostTrap = aimedColumn !== null ? trapPreviews[aimedColumn] ?? null : null;
  const scenario = scenarioById(scenarioId);

  const foeRow = <div className="battle-field__team" data-team="enemy" style={{ '--slots': battle.foes.length } as CSSProperties}>
    <h3>Enemies</h3>
    {battle.foes.map((foe) => <FoeCard key={foe.id} foe={foe} target={target?.name ?? null} events={battle.events}
      preview={previews.get(foe.id) ?? null} focus={aim?.foeId === foe.id} aiming={Boolean(aim && heldAttack)}
      interaction={foeProps(foe.id)}
      sprite={<FoundationSprite sprite={SPRITES[foe.id]} name={foe.name} lighting={rig.standee(0, -55, 64)} />} />)}
  </div>;

  const partyRow = <div className="battle-field__team" data-team="party" style={{ '--slots': battle.party.length } as CSSProperties}>
    <h3>Players</h3>
    {battle.party.map((actor) => {
      const attack = actorAttack(battle, actor.id);
      const usable = Boolean(attack) && !battle.result && !paused;
      const canRedraw = actor.stamina > 0 && actor.hp > 0 && !battle.result && !paused;
      return <div key={actor.id} className="battle-field__slot" data-battle-slot={actor.id} data-down={actor.hp <= 0 || undefined}>
        <button type="button" className="battle-field__foundation" data-battle-actor={actor.id}
          data-targetable={selection?.actorIds.includes(actor.id) || undefined} disabled={!!selection && !selection.actorIds.includes(actor.id)}
          onClick={event => {
            if (selection) { choose(actor.id); return; }
            requestHoloDeviceTilt();
            setInspection({ id: actor.id, name: actor.name, anchor: event.currentTarget });
          }} aria-haspopup="dialog" aria-label={`${actor.name} foundation${selection?.actorIds.includes(actor.id) ? ' · choose for selected card' : ''}`} style={rig.surface(55, 60)}>
          <div className="battle-field__pile">
            <div className="battle-field__actor-card proto-lit-surface" ref={node => { if (node) foundationRefs.current.set(actor.id,node); else foundationRefs.current.delete(actor.id); }}>
              <ActorHoloCard actorId={actor.id} name={actor.name} rank={rankLabel(actor.rank)} />
            </div>
          </div>
        </button>
        <div className="battle-field__side">
          <AbilityCard actor={actor} attack={attack} disabled={!usable} armed={aim?.mode === 'armed' && aim.actorId === actor.id}
            dragging={aim?.mode === 'drag' && aim.actorId === actor.id} interaction={cardProps(actor.id, usable)} />
          <button type="button" className="battle-field__redraw" data-redraw-actor={actor.id} disabled={!canRedraw} onClick={() => redraw(actor.id)}
            aria-label={`Redraw ${actor.name}'s foundation for 1 stamina · ${actor.stamina} stamina left`}
            title={actor.stamina > 0 ? `Redraw: stuck? Swap ${actor.name}'s foundation value for a new one. Costs 1 stamina (${actor.stamina} left).` : `${actor.name} has no stamina left to redraw`}>
            <span aria-hidden="true">↻ Redraw</span><span className="battle-field__redraw-left" aria-hidden="true">{actor.stamina}</span>
          </button>
        </div>
        <PartyVitals actor={actor} count={actor.count} events={battle.events} targeted={battle.started && !battle.result && target?.id === actor.id} />
      </div>;
    })}
  </div>;

  return <section ref={fieldRef} className="battle-field" data-camera-background={active || undefined} data-first-team={BATTLE_TURN_PRIORITY[0]}
    data-result={battle.result ?? undefined} data-aiming={aim ? aim.mode : undefined} aria-label="Battle foundations and shared woods tableau">
    <header className="battle-field__header">
      <h2>Dark Woods</h2>
      <div className="battle-controls" role="group" aria-label="Battle setup">
        <label className="battle-controls__scenario" title={scenario.blurb}>
          <select aria-label="Scenario" value={scenarioId} onChange={(event) => restart(event.target.value)}>
            {BATTLE_SCENARIOS.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}
          </select>
        </label>
        <SceneButton type="button" aria-pressed={hasMochi} onClick={() => setBattle((b) => setMochi(b, !hasMochi))}>{hasMochi ? 'Remove Mochi' : 'Add Mochi'}</SceneButton>
        <span className="battle-controls__stepper" role="group" aria-label={`Slimes: ${battle.foes.length}`}>
          <SceneButton type="button" aria-label="Remove a slime" disabled={battle.foes.length <= 1} onClick={() => setBattle(removeSlime)}>−</SceneButton>
          <span aria-hidden="true">Slimes {battle.foes.length}</span>
          <SceneButton type="button" aria-label="Add a slime" disabled={battle.foes.length >= MAX_FOES} onClick={() => setBattle(addSlime)}>+</SceneButton>
        </span>
        <SceneButton type="button" aria-pressed={heroCal} title="Cal, a fire spirit: Hero's ability gains fire above combo 3" onClick={() => setBattle((b) => setSpirit(b, 'hero', 'cal', !heroCal))}>Cal {heroCal ? 'on' : 'off'}</SceneButton>
      </div>
    </header>
    <span className="sr-only" role="status">{announcement}</span>
    {inspection && <DetailsCardViewer key={inspection.id} initialJumboId={inspection.id}
      anchor={inspection.anchor} timeOfDay={hours} lights={[...lights]} position={{ x: 0, y: -48 }}
      objects={[{ id: inspection.id, name: inspection.name, badge: '♟', badgeLabel: 'Actor',
        art: <ActorCardArt sprite={ACTOR_HOLO_ART[inspection.id]} label={inspection.name} />,
        descriptor: `${inspection.name} · battle scene actor`,
        trays: [{ id: 'stats', label: 'Foundation', details: (() => { const actor = battle.party.find((a) => a.id === inspection.id); return actor ? `Rank ${rankLabel(actor.rank)} · Collected ${actor.count} · Stamina ${actor.stamina}` : 'Left the battle'; })() }] }]}
      onClose={() => setInspection(null)} onCloseObject={() => setInspection(null)} />}
    <TableauScene immersive={!active} fillScenery={!active} terrain="woods" rig={rig} hours={hours}>
      <div className="battle-field__board">
        {foeRow}
        <div className="battle-field__middle">
          <div className="battle-field__tableau" role="group" aria-label="Shared tableau · Small Woods at 0,-1">
            <div className="battle-field__rack">
            {battle.columns.map((column: Card[], index) => <div className="battle-field__column" key={index} style={{ '--cards': Math.max(1,column.length) } as CSSProperties}
              data-battle-target={`card:${index}`} data-targetable={Boolean(trapPreviews[index]) || undefined}
              data-preview={trapPreviews[index] ? (aimedColumn === index ? 'focus' : 'faint') : undefined}>
              {column.map((card, depth) => <ProtoCard key={card.id} card={card} allowJumbo={false} disabled={paused || depth < column.length - 1 || !eligibleActors(battle, card).length} buried={depth < column.length - 1} centerRank={depth === column.length - 1} lit
                active={selection?.cardId === card.id} selected={selection?.cardId === card.id}
                cardRef={node => { if (node) cardRefs.current.set(card.id,node); else cardRefs.current.delete(card.id); }}
                onClick={event => activate(index,event.currentTarget)}
                style={{ position: 'absolute', left: 0, top: `calc(var(--battle-peek) * ${depth})`, zIndex: depth + 1, ...rig.surface(index * 14 - 42, 0) }} />)}
              {column.length > 0 && <TableMark depth={column.length - 1} trap={battle.traps[column[column.length - 1].id]}
                eyes={battle.foes.filter((foe) => foe.hp > 0 && foe.eye?.cardId === column[column.length - 1].id)}
                party={battle.party} />}
            </div>)}
            </div>
          </div>
          <div className="battle-field__status">
            <span className="battle-field__status-text" data-result={battle.result ?? undefined}>{statusLine(battle, paused)}</span>
            {battle.result ? <SceneButton type="button" onClick={() => restart()}>Fight again</SceneButton> : <>
              <SceneButton type="button" aria-pressed={paused} disabled={!battle.started} onClick={() => { cancel(); setSelection(null); setPaused((p) => !p); }}>{paused ? 'Resume' : 'Pause'}</SceneButton>
              <SceneButton type="button" onClick={() => restart()}>Restart</SceneButton>
              <SceneButton type="button" disabled={!canDeal(battle) || paused} title="Deal one card onto every column with room" onClick={() => setBattle(dealRow)}>Deal a row</SceneButton>
            </>}
          </div>
        </div>
        {partyRow}
      </div>
    </TableauScene>
    {!active && <footer className="battle-field__footer"><SceneButton type="button" onClick={onWatch}>Watch battle scene</SceneButton></footer>}
    {aim?.mode === 'drag' && heldAttack && createPortal(<AbilityGhost attack={heldAttack} x={aim.x} y={aim.y} preview={ghostPreview} trap={ghostTrap?.damage ?? null} />, document.body)}
  </section>;
}
