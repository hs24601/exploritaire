import { useRef, type CSSProperties } from 'react';
import type { Action, GameState } from '../rules/game';
import { maxStamina } from '../rules/game';
import { INSPIRATION_COLUMN, saplingAccepts } from '../rules/sapling';
import { useDrag } from './drag';
import { Icon } from './icons';
import { KinPortrait } from './KinPortrait';
import { rankLabel } from './PlayingCard';
import { PuzzleAtmosphere } from './PuzzleAtmosphere';
import { StaminaPips } from './StaminaPips';
import { InspirationHolocard } from './InspirationCard';
import { InspirationReveal } from './InspirationReveal';

const RELIEF = '/assets/runtime/environment/watercolor/v1/';
const groundProps = [
  ['stone-spill-v1.png', 13, 6, 72],
  ['berry-patch-sprite-empty-v1.png', 22, 21, 106],
  ['manaberry-sparse-standee-empty-v1.png', 37, 3, 60],
  ['stone-spill-v1.png', 45, 4, 42],
  ['stone-spill-v1.png', 57, 6, 54],
  ['manaberry-sparse-standee-empty-v1.png', 66, 13, 77],
  ['berry-patch-sprite-empty-v1.png', 81, 4, 114],
  ['stone-spill-v1.png', 91, 21, 67],
] as const;

const clearingDepth = [
  { floor: 42, size: 25, opacity: .47, positions: [7, 17, 26, 34, 65, 76, 86, 96] },
  { floor: 57, size: 53, opacity: .69, positions: [3, 12, 23, 31, 69, 78, 89, 96] },
  { floor: 76, size: 91, opacity: .86, positions: [4, 15, 25, 74, 83, 96] },
  { floor: 96, size: 149, opacity: .96, positions: [2, 15, 29, 71, 86, 99] },
];
const reliefFiles = ['stone-spill-v1.png', 'berry-patch-sprite-empty-v1.png', 'manaberry-sparse-standee-empty-v1.png'];

export function SaplingView({ game, dispatch }: { game: GameState; dispatch: (action: Action) => void }) {
  const run = game.sapling!;
  const { begin, over } = useDrag();
  const recipient = useRef<HTMLDivElement>(null);
  const reward = run.inspiration === 0 && !run.collected;
  return <section className="vg-den vg-sapling-puzzle" aria-label="Curious Sapling tableau"
    style={{ '--dig-columns': run.piles.length } as CSSProperties}>
    <PuzzleAtmosphere clock={game} />
    <div className="vg-sapling-depth" aria-hidden="true">
      {clearingDepth.map(({ floor, size, opacity, positions }, band) => positions.map((x, index) =>
        <span className="vg-sapling-relief" key={`${floor}-${x}`} style={{
          left: `${x}%`, bottom: `${100 - floor + (index % 3 - 1) * 2}%`,
          width: `${size * (.8 + (index % 4) * .13)}px`, opacity,
        }}>
          <img src={RELIEF + reliefFiles[(band + index) % reliefFiles.length]} alt="" draggable={false}
            style={{ scale: index % 2 ? '-1 1' : undefined }} />
        </span>))}
    </div>
    <header className="vg-scene-title"><h1>Curious <em>Sapling</em></h1></header>
    <div className="vg-den-scene">
      <div className="vg-sapling-clearing" aria-hidden="true">
        {groundProps.map(([file, x, y, width]) => <span className="vg-sapling-relief" key={x}
          style={{ left: `${x}%`, bottom: `${y}%`, width: `${width}px` }}>
          <img src={RELIEF + file} alt="" draggable={false} />
        </span>)}
        <div className="vg-sapling-puzzle-plant">
          <img src="/assets/runtime/village/ground/curious-sapling-bud-side-v1.png" alt="" draggable={false} />
          <span className="vg-sapling-motes"><i /><i /><i /><i /></span>
        </div>
      </div>
      <div className="vg-den-cutaway is-infinifill" aria-label="Sapling tableau">
        {run.piles.map((pile, column) => <div className="vg-den-column" key={column}>
          {pile.map((rank, index) => {
            const row = pile.length - index;
            const exposed = row === 1;
            const isInspiration = column === INSPIRATION_COLUMN && row === run.inspiration;
            const playable = exposed && saplingAccepts(run, column);
            const face = <span className="vg-sapling-rank">{isInspiration && <Icon name="burrow" size={16} />}{rankLabel(rank)}</span>;
            const className = `vg-den-soil vg-sapling-wash${exposed ? ' is-exposed' : ' is-covered'}${isInspiration ? ' is-inspiration' : ''}`;
            const play = () => dispatch({ type: 'sapling-play', column });
            return <button type="button" className={className} key={index} disabled={!playable}
              data-receipt-source={exposed ? `sapling-${column}` : undefined}
              aria-label={`Column ${column + 1}, row ${row}, ${isInspiration ? 'Simple Den Inspiration Card, ' : ''}${rankLabel(rank)}`}
              onClick={event => { if (event.detail === 0) play(); }}
              onPointerDown={event => begin(event, { kind: 'sapling-card', id: column, anchor: 'top-left',
                ghost: <span className={className}>{face}</span>, width: event.currentTarget.offsetWidth, height: event.currentTarget.offsetHeight },
              (_, hit) => { if (hit.drop === 'sapling-foundation') play(); }, play)}>{face}</button>;
          })}
        </div>)}
      </div>
    </div>
    <footer>
      <div ref={recipient} className={`vg-den-foundation${reward ? ' is-inspiration-recipient' : ''}${over?.drop === (reward ? 'inspiration-recipient' : 'sapling-foundation') ? ' is-over' : ''}`}
        data-drop={reward ? 'inspiration-recipient' : 'sapling-foundation'} aria-label={reward ? 'Hero, Inspiration Card recipient' : undefined}>
        <KinPortrait kin="hero" /><strong>{rankLabel(run.foundation)}</strong>
        <StaminaPips value={game.stamina.hero} max={maxStamina(game, 'hero')} />
      </div>
      {run.inspiration > 0 && <button type="button" className="vg-btn" disabled={game.stamina.hero <= 0} onClick={() => dispatch({ type: 'sapling-draw' })}>Draw · 1 AP</button>}
    </footer>
    {reward && <InspirationReveal name="Simple Den" recipient={recipient} ghost={<InspirationHolocard motion="static" />}
      onCollect={() => dispatch({ type: 'sapling-collect' })}>
      <InspirationHolocard />
    </InspirationReveal>}
  </section>;
}
