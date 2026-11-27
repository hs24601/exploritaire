import { useEffect, useRef, useState, type CSSProperties, type MouseEvent } from 'react';
import { createPortal } from 'react-dom';
import { activeAspen, ASPEN_FALL_MS, KIN_TOKENS, aspenAccepts, aspenAcceptsRank, aspenMaxHp, aspenSeed, aspenTop, type AspenGrove, type AspenRun, type KinStamina } from '../rules/aspen';
import type { Action } from '../rules/game';
import { rng, type Rank } from '../rules/golf';
import { Icon } from './icons';
import { useDrag } from './drag';
import { KinPortrait } from './KinPortrait';
import { StaminaPips } from './StaminaPips';
import { useKinJumbo } from './useKinJumbo';
import { useSceneCamera } from './useSceneCamera';
import { PuzzleAtmosphere, type PuzzleClock } from './PuzzleAtmosphere';

const rankLabel = (rank: Rank) => ({ 1: 'A', 11: 'J', 12: 'Q', 13: 'K' }[rank as 1 | 11 | 12 | 13] ?? rank);

// Temporary scene stand-in until the authored aspen chopping frames are available.
function AspenTree({ hp, maxHp, index, selected, disabled, pickup, onSelect }: {
  hp: number; maxHp: number; index: number; selected: boolean; disabled: boolean; pickup: boolean;
  onSelect: (event: MouseEvent<HTMLButtonElement>) => void;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const strike = useRef<HTMLSpanElement>(null);
  const announcer = useRef<HTMLSpanElement>(null);
  const previousHp = useRef(hp);
  const combo = useRef({ hits: 0, time: -Infinity });
  useEffect(() => {
    const hit = hp < previousHp.current;
    previousHp.current = hp;
    if (!hit) return;

    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const now = performance.now();
    const hits = now - combo.current.time <= 1600 ? combo.current.hits + 1 : 1;
    combo.current = { hits, time: now };
    if (announcer.current) {
      announcer.current.textContent = hits > 1 ? `${hits}× COMBO` : hp === 0 ? 'TIMBER!' : 'STRIKE!';
    }
    const callout = announcer.current?.animate(reduced
      ? [{ opacity: 1 }, { opacity: 1, offset: .72 }, { opacity: 0 }]
      : [{ opacity: 0, transform: 'translate(-12px, 8px) scale(.76) skewX(-12deg)' },
        { opacity: 1, transform: 'translate(0, 0) scale(1.12) skewX(-12deg)', offset: .17 },
        { opacity: 1, transform: 'translate(0, -5px) scale(1) skewX(-12deg)', offset: .73 },
        { opacity: 0, transform: 'translate(3px, -24px) scale(.96) skewX(-12deg)' }],
      { duration: 950, easing: 'ease-out' });
    const slash = strike.current?.animate(reduced
      ? [{ opacity: .65 }, { opacity: 0 }]
      : [{ opacity: 0, transform: 'scaleX(.28)' }, { opacity: 1, transform: 'scaleX(1)', offset: .21 },
        { opacity: 0, transform: 'scaleX(1.28)' }],
      { duration: 280, easing: 'ease-out' });
    const shake = !reduced ? canvas.current?.animate([
      { transform: 'rotate(0)' }, { transform: 'translateX(4px) rotate(2.6deg)', offset: .16 },
      { transform: 'translateX(-3px) rotate(-1.8deg)', offset: .39 },
      { transform: 'translateX(1px) rotate(.8deg)', offset: .66 }, { transform: 'rotate(0)' },
    ], { duration: 330, easing: 'ease-out' }) : undefined;
    return () => { slash?.cancel(); shake?.cancel(); callout?.cancel(); };
  }, [hp]);
  useEffect(() => {
    const context = canvas.current?.getContext('2d');
    if (!context) return;
    const random = rng(14681 + index * 5197);
    context.clearRect(0, 0, 280, 320);
    context.lineCap = 'round';
    const branch = (x: number, y: number, tx: number, ty: number, width: number) => {
      context.beginPath();
      context.moveTo(x, y);
      context.quadraticCurveTo((x + tx) / 2 + 8, y - (y - ty) * .7, tx, ty);
      context.strokeStyle = '#665c49';
      context.lineWidth = width + 3;
      context.stroke();
      context.strokeStyle = '#ddd7b6';
      context.lineWidth = width;
      context.stroke();
    };
    const crowns = [[63, 113, 36], [116, 61, 45], [168, 57, 43], [207, 103, 42], [155, 119, 41]];
    for (const [x, y] of crowns) branch(140, 201, x, y, 4);
    const bark = context.createLinearGradient(128, 0, 154, 0);
    bark.addColorStop(0, '#74725c'); bark.addColorStop(.42, '#eee4bf'); bark.addColorStop(1, '#aca380');
    context.fillStyle = bark;
    context.beginPath();
    context.moveTo(126, 320);
    context.quadraticCurveTo(136, 251, 134, 179);
    context.lineTo(140, 84);
    context.lineTo(147, 180);
    context.quadraticCurveTo(148, 255, 154, 320);
    context.fill();
    for (let i = 0; i < 21; i++) {
      const y = 134 + random() * 180;
      context.fillStyle = 'rgba(73,65,55,.65)';
      context.fillRect(135 + random() * 9, y, 3 + random() * 6, 1 + random() * 3);
    }
    for (const [cx, cy, r] of crowns) {
      for (let i = 0; i < 62; i++) {
        const a = random() * Math.PI * 2, radius = Math.sqrt(random()) * r;
        context.beginPath();
        context.fillStyle = ['#bca443', '#e9c854', '#ccb54c', '#f4d979', '#8c923c'][Math.floor(random() * 5)];
        context.globalAlpha = .36 + random() * .46;
        context.ellipse(cx + Math.cos(a) * radius, cy + Math.sin(a) * radius, 4 + random() * 11, 3 + random() * 8, a, 0, Math.PI * 2);
        context.fill();
      }
    }
    context.globalAlpha = 1;
    const cut = (maxHp - hp) / maxHp;
    if (cut > 0) {
      context.globalCompositeOperation = 'destination-out';
      context.beginPath(); context.moveTo(156, 310); context.lineTo(153 - cut * 28, 315); context.lineTo(156, 320); context.fill();
      context.globalCompositeOperation = 'source-over';
    }
  }, [hp, maxHp, index]);
  return <>
    <button type="button" className="vg-aspen-tree" aria-label={pickup ? `Collect wood from Aspen ${index + 1}` : `Aspen ${index + 1}, ${hp} of ${maxHp} HP`}
      title={pickup ? 'Collect 1 wood for Hollow' : `Aspen ${index + 1} · ${hp}/${maxHp} HP${disabled ? '' : selected ? ' · Select again to zoom out' : ' · Select to open its tableau'}`}
      aria-pressed={pickup ? undefined : selected} disabled={disabled} onClick={onSelect}>
      <canvas ref={canvas} width={280} height={320} aria-hidden="true" />
      <span className="vg-aspen-strike" ref={strike} />
    </button>
    {!selected && hp > 0 && hp < maxHp && <AspenHealth hp={hp} maxHp={maxHp} index={index} />}
    <span className="vg-aspen-announcer" ref={announcer} aria-hidden="true" />
  </>;
}

function AspenHealth({ hp, maxHp, index, focused = false }: { hp: number; maxHp: number; index: number; focused?: boolean }) {
  return <div className={`vg-aspen-health${focused ? ' is-focused' : ''}`}>
    <meter min={0} max={maxHp} value={hp} aria-label={`Aspen ${index + 1} health`} />
    <span>{hp}/{maxHp} HP</span>
  </div>;
}

function aspenPlacement(index: number) {
  const row = Math.floor(index / 6), column = index % 6;
  const variation = ((index * 7) % 11 - 5) / 55;
  return { row, x: 50 + (column - 2.5) * [10.5, 12, 13.5][row] + [-4, 4, 0][row] + variation * 12,
    height: [34, 44, 58][row] * (1 + variation), widthLimit: [14, 17, 20][row] * (1 + variation),
    base: [40, 22, 4][row] + variation * 20 };
}

export function AspenView({ clock, grove, stamina, staminaCaps, cards, dispatch }: { clock: PuzzleClock; grove: AspenGrove; stamina: KinStamina; staminaCaps: KinStamina; cards: Rank[]; dispatch: (action: Action) => void }) {
  const run = activeAspen(grove);
  const scene = useRef<HTMLDivElement>(null);
  const camera = useSceneCamera(scene, `${grove.target ?? 'grove'}:${run?.phase === 'standing' ? 'upright' : 'resting'}`);
  const [size, setSize] = useState({ width: 0, height: 0, left: 0, top: 0 });
  const [pickups, setPickups] = useState<{ index: number; style: CSSProperties }[]>([]);
  const collect = (index: number, event: MouseEvent<HTMLButtonElement>) => {
    const viewport = scene.current?.getBoundingClientRect();
    const inventory = scene.current?.closest('.vg-app')?.querySelector('.vg-store.is-lumber')?.getBoundingClientRect();
    if (viewport && inventory) {
      const source = event.currentTarget.getBoundingClientRect();
      const x = event.detail ? event.clientX : (Math.max(viewport.left, source.left) + Math.min(viewport.right, source.right)) / 2;
      const y = event.detail ? event.clientY : (Math.max(viewport.top, source.top) + Math.min(viewport.bottom, source.bottom)) / 2;
      const style = { left: x, top: y, '--pickup-x': `${inventory.left + inventory.width / 2 - x}px`,
        '--pickup-y': `${inventory.top + inventory.height / 2 - y}px` } as CSSProperties;
      setPickups(flights => [...flights.filter(flight => flight.index !== index), { index, style }]);
    }
    dispatch({ type: 'aspen-collect', tree: index });
  };
  useEffect(() => {
    const viewport = scene.current;
    if (!viewport) return;
    const observer = new ResizeObserver(([entry]) => setSize({ width: entry.contentRect.width, height: entry.contentRect.height,
      left: viewport.offsetLeft, top: viewport.offsetTop }));
    observer.observe(viewport);
    return () => observer.disconnect();
  }, []);
  let zoomX = 1, zoomY = 1, offsetX = 0, offsetY = 0;
  if (grove.target !== null && size.width && size.height) {
    const { x, base, height, widthLimit } = aspenPlacement(grove.target);
    const treeHeight = Math.min(height * size.height, widthLimit * size.width) / 100;
    const ground = Math.max(size.height * base / 100, treeHeight * 7 / 16 + 8);
    const landing = run?.phase !== 'standing';
    const bottom = landing ? size.height * .67 : size.height * .98 - 32;
    zoomY = landing ? size.height * .64 / treeHeight : Math.max(1, (bottom - size.height * .04) / treeHeight);
    zoomX = Math.min(zoomY, size.width * .9 / (treeHeight * (landing ? 1 : 280 / 320)));
    // The crown swings to one side of its root, so frame the whole landing span.
    const swing = landing ? (x < 50 ? 1 : -1) * treeHeight * zoomX / 2 : 0;
    offsetX = size.width * (.5 - x / 100 * zoomX) - swing;
    offsetY = bottom - (size.height - ground) * zoomY;
  }
  const manual = camera.manual;
  if (manual) {
    offsetX = manual.x + offsetX * manual.zoom;
    offsetY = manual.y + offsetY * manual.zoom;
    zoomX *= manual.zoom;
    zoomY *= manual.zoom;
  }
  const cameraStyle = { transform: `translate(${offsetX}px, ${offsetY}px) scale(${zoomX}, ${zoomY})`,
    '--health-scale': `${1 / zoomX} ${1 / zoomY}` } as CSSProperties;
  // The tile origin is the scene origin. Repeat the projected tiles through the header and tableau.
  const groundStyle = { backgroundPosition: `${size.left + offsetX}px ${size.top + offsetY}px`,
    backgroundSize: `${290 * zoomX}px ${290 * zoomY}px` };
  const overview = () => { if (run && run.phase !== 'falling') { camera.reset(); dispatch({ type: 'aspen-overview' }); } };
  return <section className={`vg-aspen${run ? ' is-focused' : ''}${manual ? ' is-manual' : ''}`} aria-label="Aspen Grove"
    onKeyDown={event => { if (event.key === 'Escape') { camera.reset(); overview(); } }}>
    <PuzzleAtmosphere clock={clock} aspen terrainStyle={groundStyle} shiftX={manual?.x} shiftY={manual?.y} />
    <header className="vg-aspen-head">
      <h1>Aspen <em>Grove</em></h1>
      {!run && <span>{grove.members.length ? 'Choose an aspen' : 'Bring kin to work here'}</span>}
    </header>
    <div className="vg-aspen-scene" ref={scene} tabIndex={0} role="region" aria-label="Aspens"
      title="Drag to pan · Scroll or pinch to zoom · Arrow keys and +/− · Home resets the camera"
      style={{ '--fall-time': `${ASPEN_FALL_MS}ms` } as CSSProperties} {...camera.handlers}
      onClick={event => { if (event.target === event.currentTarget || event.target === event.currentTarget.firstElementChild) overview(); }}>
      <div className={`vg-aspen-camera${run ? ' is-focused' : ''}`} style={cameraStyle}>
      {grove.trees.map((tree, index) => {
        const selected = grove.target === index;
        const phase = tree?.phase ?? 'standing';
        const { row, x, height, widthLimit, base } = aspenPlacement(index);
        const maxHp = tree?.maxHp ?? aspenMaxHp(aspenSeed(grove.seed, index));
        const style = { '--tree-x': `${x}%`, '--tree-depth': row,
          '--tree-height': `${height}cqh`, '--tree-width': `${widthLimit}cqw`, '--tree-base': `${base}%`,
          '--tree-light': [0.76, 0.87, 1][row], '--fall-side': x < 50 ? 1 : -1 } as CSSProperties;
        return <div className={`vg-aspen-site is-${phase}${selected ? ' is-target' : ''}${tree?.spill !== undefined ? ' has-spill' : ''}`} key={index} style={style}>
          {phase !== 'standing' && <span className="vg-aspen-stump" aria-hidden="true" />}
          {phase !== 'felled' && <AspenTree hp={tree?.hp ?? maxHp} maxHp={maxHp} index={index} selected={selected} pickup={phase === 'fallen'}
            disabled={phase !== 'fallen' && (!grove.members.length || phase !== 'standing' || run?.phase === 'falling')}
            onSelect={event => phase === 'fallen' ? collect(index, event) : selected ? overview() : dispatch({ type: 'aspen-target', tree: index })} />}
          {tree?.spill !== undefined && <button type="button" className="vg-aspen-spill" aria-label={`Pick up ${rankLabel(tree.spill)} from Aspen ${index + 1}`}
            title="Pick up this card to use on a matching foundation" onClick={() => dispatch({ type: 'aspen-gather-card', tree: index })}>{rankLabel(tree.spill)}</button>}
        </div>;
      })}
      </div>
      {run?.phase === 'standing' && grove.target !== null && <AspenHealth hp={run.hp} maxHp={run.maxHp} index={grove.target} focused />}
    </div>
    {run && <AspenTableau key={grove.target} run={run} stamina={stamina} staminaCaps={staminaCaps} cards={cards} dispatch={dispatch} />}
    {pickups.length > 0 && createPortal(pickups.map(({ index, style }) => <div key={index} className="vg-aspen-pickup" style={style}
      role="status" onAnimationEnd={() => setPickups(flights => flights.filter(flight => flight.index !== index))}>
      <Icon name="lumber" size={22} />+1 wood
    </div>), document.body)}
  </section>;
}

function AspenTableau({ run, stamina, staminaCaps, cards, dispatch }: { run: AspenRun; stamina: KinStamina; staminaCaps: KinStamina; cards: Rank[]; dispatch: (action: Action) => void }) {
  const { begin, over, dragging } = useDrag();
  const inspectKin = useKinJumbo();
  const [selected, setSelected] = useState(0);
  const standing = run.phase === 'standing';
  const ready = run.foundations.findIndex(({ kin }) => stamina[kin] > 0);
  const chosen = stamina[run.foundations[selected]?.kin] > 0 || ready < 0 ? selected : ready;
  const playFound = (card: number, foundation?: number) => {
    const rank = cards[card];
    const accepts = (index: number) => aspenAcceptsRank(run, rank, index, stamina);
    const target = foundation ?? (accepts(chosen) ? chosen : run.foundations.findIndex((_, i) => accepts(i)));
    if (!accepts(target)) return;
    setSelected(target);
    dispatch({ type: 'aspen-play-card', card, foundation: target });
  };
  const tap = (pile: number) => {
    const target = aspenAccepts(run, pile, chosen, stamina) ? chosen : run.foundations.findIndex((_, i) => aspenAccepts(run, pile, i, stamina));
    if (target < 0) return;
    setSelected(target);
    dispatch({ type: 'aspen-play', pile, foundation: target });
  };
  return <>
      <div className="vg-aspen-columns" aria-label="Aspen tableau">
        {run.piles.map((cards, pile) => <div className="vg-aspen-column" key={pile}>
          {cards.map((rank, i) => {
            const exposed = i === cards.length - 1;
            const playable = exposed && run.foundations.some((_, n) => aspenAccepts(run, pile, n, stamina));
            const className = `vg-aspen-card${exposed ? '' : ' is-covered'}${playable ? ' vg-aspen-playable' : ''}`;
            return <button type="button" key={i} className={className} style={{ '--row': i } as CSSProperties}
              data-receipt-source={exposed ? `aspen-${pile}` : undefined}
              title={playable ? `${rankLabel(rank)} · Play onto a matching foundation to deal 1 damage` : `${rankLabel(rank)} · Column ${pile + 1}`}
              disabled={!playable} aria-label={`Column ${pile + 1}, ${rankLabel(rank)}`}
              aria-hidden={!exposed} onKeyDown={e => {
                if (e.key !== 'Enter' && e.key !== ' ') return;
                e.preventDefault();
                if (!e.repeat) tap(pile);
              }}
              onPointerDown={e => begin(e, { kind: 'aspen-card', id: pile,
                anchor: 'top-left', ghost: <span className="vg-aspen-card vg-aspen-ghost"><span className="vg-aspen-rank">{rankLabel(rank)}</span></span>,
                width: e.currentTarget.offsetWidth, height: e.currentTarget.offsetHeight },
              (_, target) => {
                if (target.drop !== 'aspen-foundation' || !aspenAccepts(run, pile, target.index, stamina)) return;
                setSelected(target.index);
                dispatch({ type: 'aspen-play', pile, foundation: target.index });
              }, () => tap(pile))}><span className="vg-aspen-rank">{rankLabel(rank)}</span></button>;
          })}
        </div>)}
      </div>
      <div className="vg-aspen-foundations" aria-label="Party foundations">
        {run.foundations.map(({ kin, rank }, i) => {
          const dragRank = dragging?.kind === 'aspen-found-card' ? cards[Number(dragging.id)]
            : dragging?.kind === 'aspen-card' ? aspenTop(run, Number(dragging.id)) : undefined;
          const isOver = over?.drop === 'aspen-foundation' && over.index === i && aspenAcceptsRank(run, dragRank, i, stamina);
          const exhausted = stamina[kin] === 0;
          return <button type="button" key={kin} className={`vg-aspen-foundation${chosen === i && !exhausted ? ' is-selected' : ''}${exhausted ? ' is-exhausted' : ''}`}
            data-drop="aspen-foundation" data-index={i} aria-pressed={chosen === i && !exhausted} aria-haspopup="dialog"
            title={exhausted ? `${KIN_TOKENS[kin].name} is exhausted until dawn` : `${stamina[kin]}/${staminaCaps[kin]} stamina · Accepts ranks one above or below ${rankLabel(rank)}`}
            aria-label={`${KIN_TOKENS[kin].name} foundation, ${rankLabel(rank)}, ${stamina[kin]} of ${staminaCaps[kin]} stamina`}
            onClick={event => { if (!exhausted) setSelected(i); inspectKin(kin, event.currentTarget, rankLabel(rank)); }}>
            <span className={`vg-aspen-card${isOver ? ' is-over' : ''}`}>
              <KinPortrait kin={kin} />
              <strong className="vg-aspen-rank">{rankLabel(rank)}</strong>
            </span>
            <StaminaPips value={stamina[kin]} max={staminaCaps[kin]} />
            <span>{KIN_TOKENS[kin].name}</span>
          </button>;
        })}
        <button type="button" className="vg-btn vg-aspen-draw" title="Draw a new rank for the selected foundation without spending stamina" disabled={!standing} onClick={() => dispatch({ type: 'aspen-draw', foundation: chosen })}>Draw</button>
      </div>
      {cards.length > 0 && <div className="vg-aspen-found" aria-label="Found cards">
        <span>Found cards</span>
        <div className="vg-aspen-found-list">{cards.map((rank, card) => {
          const playable = run.foundations.some((_, i) => aspenAcceptsRank(run, rank, i, stamina));
          return <button type="button" key={card} className="vg-aspen-found-card" disabled={!playable}
            data-receipt-source={`found-${card}`}
            aria-label={`Play found ${rankLabel(rank)}`} title={playable ? 'Play this found card onto a matching foundation' : 'Keep this card until a foundation matches'}
            onClick={event => { if (event.detail === 0) playFound(card); }}
            onPointerDown={event => begin(event, { kind: 'aspen-found-card', id: card, anchor: 'top-left', ghost: <span className="vg-aspen-found-card">{rankLabel(rank)}</span>,
              width: event.currentTarget.offsetWidth, height: event.currentTarget.offsetHeight },
            (_, target) => { if (target.drop === 'aspen-foundation') playFound(card, target.index); }, () => playFound(card))}>{rankLabel(rank)}</button>;
        })}</div>
      </div>}
  </>;
}
