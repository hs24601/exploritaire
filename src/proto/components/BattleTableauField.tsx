import { ActorHoloCard } from './ActorHoloCard';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { BATTLE_SPRITE_ASSETS } from '../battleSpriteAssets';
import { DARK_SLIME_DIRECTIONAL_SPRITE, type DirectionalSpriteDefinition } from '../directionalSprites';
import { MOCHI_DIRECTIONAL_SPRITE } from '../mochiSprite';
import { rankLabel, type Card } from '../protoState';
import { createSeededSmallWoodsDeal, isAdjacentRank } from '../rules/setup';
import { getCardTransportDurationMs } from '../protoTransport';
import { solverFlightDuration } from '../solverTiming';
import { createTableauLightRig } from '../tableauLighting';
import type { TableLight } from '../protoLighting';
import { ProtoCard } from './ProtoCard';
import { TableauScene } from './TableauScene';
import { SceneButton } from './SceneButton';
import { ActorBaseName } from './ActorBaseName';
import { SpriteStandeeArt } from './SpriteStandee';
import { WORLD_ACTOR_SPRITES } from '../protoData';
import type { StandeeLighting } from '../protoLighting';
import './BattleTableauField.css';
import { BATTLE_TURN_PRIORITY } from '../battleTurnPriority';

// Temporary scene roster. Neither these piles nor the preview deal spend world resources.
const teams = [
  { id: 'enemy', label: 'Enemies', actors: [
    { id: 'dark-slime', name: 'Dark Slime', rank: 8, sprite: DARK_SLIME_DIRECTIONAL_SPRITE },
    { id: 'rear-slime', name: 'Rear Slime', rank: 11, sprite: DARK_SLIME_DIRECTIONAL_SPRITE },
  ] },
  { id: 'party', label: 'Players', actors: [
    { id: 'hero', name: 'Hero', rank: 2, sprite: WORLD_ACTOR_SPRITES.hero },
    { id: 'mochi', name: 'Mochi', rank: 5, sprite: MOCHI_DIRECTIONAL_SPRITE },
  ] },
] as const;
const previewDeal = createSeededSmallWoodsDeal();

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

export function BattleTableauField({ hours, lights, onWatch, active }: {
  hours: number; lights: readonly TableLight[]; onWatch: () => void; active: boolean;
}) {
  const [tableau, setTableau] = useState(() => previewDeal.tableau.map(column => [...column]));
  const [foundations, setFoundations] = useState<Record<string, {rank: number; count: number}>>(() =>
    Object.fromEntries(teams.flatMap(team => team.actors.map(actor => [actor.id, {rank:actor.rank, count:0}]))));
  const foundationRefs = useRef(new Map<string, HTMLDivElement>());
  const cardRefs = useRef(new Map<string, HTMLButtonElement>());
  const [selection, setSelection] = useState<{columnIndex: number; cardId: string; actorIds: string[]} | null>(null);
  const pending = useRef<{land: () => void; cancel: () => void} | null>(null);
  const [announcement, setAnnouncement] = useState('');
  useEffect(() => () => { pending.current?.cancel(); }, []);
  const eligibleActors = (card: Card) => teams.find(team => team.id === BATTLE_TURN_PRIORITY[0])?.actors
    .filter(actor => isAdjacentRank(card.rank, foundations[actor.id].rank)) ?? [];
  const play = (index: number, source: HTMLButtonElement, actorId: string) => {
    const column = tableau[index];
    const card = column[column.length - 1];
    const actor = card && eligibleActors(card).find(actor => actor.id === actorId);
    const destination = actor && foundationRefs.current.get(actor.id);
    if (!card || !actor || !destination) return;
    setSelection(null);
    pending.current?.land();
    const from = source.getBoundingClientRect(), to = destination.getBoundingClientRect();
    const ghost = source.cloneNode(true) as HTMLButtonElement;
    ghost.disabled = true;
    ghost.classList.add('battle-card-flight');
    ghost.dataset.targetActor = actor.id;
    ghost.style.cssText = `position:fixed;left:${from.x}px;top:${from.y}px;width:${from.width}px;height:${from.height}px;--classic-card-w:${from.width}px;--classic-radius:5px;z-index:60000;pointer-events:none;transform-origin:0 0;font:16px/1.15 'Classic Pixel',monospace;`;
    document.body.append(ghost);
    setTableau(columns => columns.map((column, i) => i === index ? column.slice(0,-1) : column));
    // Project the arriving rank at once so another eligible card can be played mid-flight.
    setFoundations(current => ({...current, [actor.id]: {...current[actor.id], rank:card.rank}}));
    const scale = to.width / from.width;
    const dx = to.x - from.x, dy = to.y - from.y;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const animation = ghost.animate([
      {transform:'translate(0,0) scale(1)'},
      {transform:`translate(${dx * .5}px,${dy * .5 - 35}px) scale(${(1 + scale) / 2})`, offset:.5},
      {transform:`translate(${dx}px,${dy}px) scale(${scale})`},
    ], {duration:reduced ? 1 : solverFlightDuration(getCardTransportDurationMs(from,to)), easing:'ease-out', fill:'forwards'});
    let finished = false;
    const cancel = () => { finished = true; animation.cancel(); ghost.remove(); pending.current = null; };
    const land = () => {
      if (finished) return;
      cancel();
      setFoundations(current => ({...current, [actor.id]: {...current[actor.id], count:current[actor.id].count + 1}}));
      setAnnouncement(`${rankLabel(card.rank)} added to ${actor.name}'s foundation`);
    };
    pending.current = {land, cancel};
    animation.onfinish = land;
  };
  // Match Proto's playColumn / chooseFoundationTarget sequence: never choose
  // between equally eligible actors on the player's behalf.
  const activate = (index: number, source: HTMLButtonElement) => {
    const column = tableau[index], card = column[column.length - 1];
    if (!card) return;
    const actors = eligibleActors(card);
    if (actors.length === 1) { play(index,source,actors[0].id); return; }
    if (actors.length > 1) {
      setSelection(selection?.cardId === card.id ? null : {columnIndex:index,cardId:card.id,actorIds:actors.map(actor=>actor.id)});
      setAnnouncement(`Choose a foundation for ${rankLabel(card.rank)}: ${actors.map(actor=>actor.name).join(' or ')}`);
    }
  };
  const choose = (actorId: string) => {
    if (!selection || !selection.actorIds.includes(actorId)) return;
    const column = tableau[selection.columnIndex];
    const source = cardRefs.current.get(selection.cardId);
    if (source && column[column.length - 1]?.id === selection.cardId) play(selection.columnIndex,source,actorId);
  };
  // Small Woods at table:0,-1 supplies the field's established scenery and lighting.
  const rig = createTableauLightRig(hours, { x: 0, y: -48 }, lights);
  const teamField = (team: typeof teams[number]) => <div className="battle-field__team" data-team={team.id}>
    <h3>{team.label}</h3>
    {team.actors.map(actor => <button type="button" key={actor.id} className="battle-field__foundation" data-battle-actor={actor.id}
      data-targetable={selection?.actorIds.includes(actor.id) || undefined} disabled={!selection?.actorIds.includes(actor.id)}
      onClick={() => choose(actor.id)} aria-label={`${actor.name} foundation${selection?.actorIds.includes(actor.id) ? ' · choose for selected card' : ''}`} style={rig.surface(team.id === 'enemy' ? -55 : 55, 60)}>
      <div className="battle-field__pile">
        <div className="battle-field__counters"><span className="proto-actor-energy" aria-label="Energy 0"><span>⚡</span><span>0</span></span><span className="proto-foundation-count-token" aria-label={`Collected cards ${foundations[actor.id].count}`}>▤{foundations[actor.id].count}</span></div>
        <div className="battle-field__actor-card proto-lit-surface" ref={node => { if (node) foundationRefs.current.set(actor.id,node); else foundationRefs.current.delete(actor.id); }}>
          {team.id === 'party' ? <ActorHoloCard actorId={actor.id} name={actor.name} rank={rankLabel(foundations[actor.id].rank)} /> : <span className="battle-field__rank">{rankLabel(foundations[actor.id].rank)}</span>}
        </div>
      </div>
      {team.id === 'enemy' && <span className="battle-field__actor"><span className="battle-field__actor-base" /><FoundationSprite sprite={actor.sprite} name={actor.name} lighting={rig.standee(0,team.id === 'enemy' ? -55 : 55,64)} />
        <ActorBaseName name={actor.name} position={{x:0,y:0}} diameter={Math.max(44,actor.name.length * 9)} screenFacing />
      </span>}
    </button>)}
  </div>;
  return <section className="battle-field" data-camera-background={active || undefined} data-first-team={BATTLE_TURN_PRIORITY[0]} aria-label="Battle foundations and shared woods tableau">
    <header className="battle-field__header"><h2>Dark Woods</h2><p>Scene tableau · no combat costs or rewards</p></header>
    <span className="sr-only" role="status">{announcement}</span>
    <TableauScene immersive={!active} fillScenery={!active} terrain="woods" rig={rig} hours={hours}>
      <div className="battle-field__board">
        {teamField(teams[0])}
        <div className="battle-field__tableau" role="group" aria-label="Shared tableau · Small Woods at 0,-1">
          <div className="battle-field__rack">
          {tableau.map((column: Card[], index) => <div className="battle-field__column" key={index} style={{ '--cards': Math.max(1,column.length) } as CSSProperties}>
            {column.map((card, depth) => <ProtoCard key={card.id} card={card} disabled={depth < column.length - 1 || !eligibleActors(card).length} buried={depth < column.length - 1} lit
              active={selection?.cardId === card.id} selected={selection?.cardId === card.id}
              cardRef={node => { if (node) cardRefs.current.set(card.id,node); else cardRefs.current.delete(card.id); }}
              onClick={event => activate(index,event.currentTarget)}
              style={{ position: 'absolute', left: 0, top: `calc(var(--battle-peek) * ${depth})`, zIndex: depth + 1, ...rig.surface(index * 14 - 42, 0) }} />)}
          </div>)}
          </div>
        </div>
        {teamField(teams[1])}
      </div>
    </TableauScene>
    {!active && <footer className="battle-field__footer"><SceneButton type="button" onClick={onWatch}>Watch battle scene</SceneButton></footer>}
  </section>;
}
