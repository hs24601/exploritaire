import type { CSSProperties } from 'react';
import { KIN_TOKENS, type TokenKin } from '../rules/aspen';
import { DAYLIGHT } from '../rules/daylight';
import { digAccepts, digRemaining, SIMPLE_DEN_SOIL } from '../rules/den';
import { dailyMaxApBonus, daylightLeft, maxStamina, type Action, type GameState } from '../rules/game';
import { useDrag } from './drag';
import { Icon } from './icons';
import { KinPortrait } from './KinPortrait';
import { rankLabel } from './PlayingCard';
import { StaminaPips } from './StaminaPips';
import { PuzzleAtmosphere } from './PuzzleAtmosphere';

export function DenHousing({ game, dispatch, onClose }: { game: GameState; dispatch: (action: Action) => void; onClose: () => void }) {
  const den = game.den!;
  const name = den.level === 2 ? 'Improved Den' : 'Simple Den';
  return <section className="vg-card-panel vg-den-housing" aria-label={name}>
    <div className="vg-panel-head"><h2>{den.dig && !den.level ? 'Simple Den site' : name}</h2>
      <button className="vg-iconbtn" type="button" onClick={onClose} aria-label="Close den details"><Icon name="close" size={18} /></button></div>
    {den.dig && <p>Drag Hero onto this plot to {den.worker ? 'resume' : 'start'} digging.</p>}
    {!!den.level && <>
      <p>{den.residents.length}/{den.level} resident slots. Eight hours of overnight rest grants +{den.level} max stamina and +1 max AP for the next day.</p>
      <div className="vg-den-roster">{(Object.keys(KIN_TOKENS) as TokenKin[]).map(kin => {
        const housed = den.residents.includes(kin);
        return <button key={kin} className="vg-btn is-small" type="button" aria-pressed={housed}
          disabled={!housed && den.residents.length >= den.level} onClick={() => dispatch({ type: 'den-house', kin })}>
          {housed ? `Unassign ${KIN_TOKENS[kin].name}` : `House ${KIN_TOKENS[kin].name}`}
          {dailyMaxApBonus(game, kin) > 0 && <small> · +1 max AP today</small>}
        </button>;
      })}</div>
    </>}
  </section>;
}

export function DenView({ game, dispatch }: { game: GameState; dispatch: (action: Action) => void }) {
  const { begin, over } = useDrag();
  const den = game.den!, { dig, worker } = den;
  const name = den.level === 2 || (den.level === 1 && dig) ? 'Improved Den' : 'Simple Den';
  const depth = dig?.simple ? 4 : den.level === 0 ? 2 : 3;
  const playable = !!worker && daylightLeft(game) > 0;
  const total = dig?.simple ? SIMPLE_DEN_SOIL : depth * (dig?.piles.length ?? 0);
  const excavated = dig ? total - digRemaining(dig) : total;
  const surfaceSoil = dig ? dig.piles.length * 2 : 0;
  const needsRest = dig?.simple && !dig.simple.rested && excavated === surfaceSoil;
  const art = den.level === 0 && dig ? (excavated > surfaceSoil ? 'puzzle-deep' : 'puzzle-surface')
    : den.level === 1 && !dig ? 'puzzle-complete' : null;
  const illustration = art && <div className="vg-den-art">
    <div className="vg-den-bank" aria-hidden="true">
      <div className="vg-den-earth" />
      <div className="vg-den-sod" />
      <img src={`/assets/runtime/village/simple-den/v1/${art}.png`} alt="" draggable={false} />
    </div>
  </div>;
  return <section className={art ? 'vg-den has-bank' : 'vg-den'} aria-label={`${name} excavation`}
    style={{ '--dig-columns': dig?.piles.length ?? 1 } as CSSProperties}>
    <PuzzleAtmosphere clock={game} />
    <header><h1>{name}</h1><span>{dig ? `${excavated}/${total} soil excavated` : 'Excavation complete'}</span></header>
    <div className={art ? 'vg-den-scene has-art' : 'vg-den-scene'}>
      {illustration}
      {dig ? <div className={`vg-den-cutaway${dig.simple ? ' is-infinifill' : ''}`} aria-label="Soil cutaway">{dig.piles.map((pile, column) => <div className="vg-den-column" key={column}>
          {Array.from({ length: depth }, (_, layer) => {
            const index = dig.simple ? layer : depth - layer - 1, rank = pile[index], exposed = index === pile.length - 1;
            const legal = exposed && playable && digAccepts(dig, column);
            const play = () => dispatch({ type: 'den-play', column });
            return rank === undefined ? <span className="vg-den-cleared" key={layer} /> : <button key={layer} type="button" disabled={!legal}
              data-receipt-source={exposed ? `den-${column}` : undefined}
              className={`vg-den-soil${exposed ? ' is-exposed' : ''}`} aria-label={`Column ${column + 1}, layer ${layer + 1}, ${exposed ? rankLabel(rank) : 'buried soil'}`}
              onClick={event => { if (event.detail === 0) play(); }}
              onPointerDown={event => begin(event, { kind: 'dig-soil', id: column, anchor: 'top-left', ghost: <span className="vg-den-soil is-exposed">{rankLabel(rank)}</span>, width: event.currentTarget.offsetWidth, height: event.currentTarget.offsetHeight },
                (_, hit) => { if (hit.drop === 'dig-foundation') play(); }, play)}>{exposed || dig.simple ? rankLabel(rank) : '·'}</button>;
          })}
        </div>)}</div>
      : <DenHousing game={game} dispatch={dispatch} onClose={() => dispatch({ type: 'view', view: 'village' })} />}
    </div>
    {dig &&
      <footer>
        {worker && <div className={`vg-den-foundation${over?.drop === 'dig-foundation' ? ' is-over' : ''}`} data-drop="dig-foundation" data-index="0">
          <KinPortrait kin={worker} /><strong>{rankLabel(dig.foundation)}</strong><StaminaPips value={game.stamina[worker]} max={maxStamina(game, worker)} />
        </div>}
        <button type="button" className="vg-btn" title="Reset the foundation with a stock card"
          disabled={!worker || game.stamina[worker] <= 0 || daylightLeft(game) < DAYLIGHT.drawMinutes}
          onClick={() => dispatch({ type: 'den-draw' })}>Draw · 1 AP · {DAYLIGHT.drawMinutes}m</button>
        {!playable && <span>Rest to resume digging at dawn.</span>}
        {needsRest && <span>Rest on the ground to unlock the deeper soil at dawn.</span>}
      </footer>}
  </section>;
}
