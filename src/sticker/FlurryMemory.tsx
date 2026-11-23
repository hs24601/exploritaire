import { useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties, type PointerEvent, type RefObject } from 'react';
import { gameTime } from '../gameTime';
import type { BattleActor } from '../proto/rules/battle';
import { DEFAULT_STICKER_MEMORY, SNOWFLAKE_EXPRESSIONS, STICKER_WIDTH, stickerFrontCoverage, stickerMemory, snowflakeEnhancements, snowflakeEnhancementAt, type StickerMemory, type SnowflakeExpression } from '../proto/rules/snowflakeReward';
import { TradingCard } from '../proto/components/TradingCard';
import { ActorCardArt } from '../proto/components/DetailsCardViewer';
import { ACTOR_HOLO_ART } from '../proto/components/ActorHoloCard';
import { FLURRY_PRINT, SnowflakeSticker, FlurryAmbiance } from './SnowflakeSticker';
import {FlurryFace} from './FlurryFace';
import './flurryMemory.css';

const memoryStyle = (memory: StickerMemory) => ({ left: memory.x * 100 + '%', top: memory.y * 100 + '%' });
const baseAbilities:Record<SnowflakeExpression,string>={
  kin:'A passive benefit for this kin.',
  Grit:'When attacked, Grit can restore AP once per attacker each turn.',
  Fetch:'Save an exposed card to play from reserve later.',
  Dig:'Save the second card in a column to play from reserve later.',
  'Vice Grip':'Hold an enemy with Adept Vice Grip.',
  'Pack Leader':'Pass leadership and inherit the previous leader’s target.',
  Bite:'Spend AP on Adept Bite to damage an enemy.',
};

function StickerPrint({ memory, outline, flipX = false, flipY = false }: {
  memory: StickerMemory; outline?: boolean; flipX?: boolean; flipY?: boolean;
}) {
  const filter = useId();
  return <div className="flurry-mark" data-outline={outline || undefined}
    style={{ ...memoryStyle(memory), width: STICKER_WIDTH * 100 + '%', '--memory-outline': `url("#${filter}")`,
      '--mirror-x': flipX ? -1 : 1, '--mirror-y': flipY ? -1 : 1 } as CSSProperties} aria-hidden="true">
    {outline && <svg width="0" height="0" className="flurry-mark__defs">
      <filter id={filter}>
        <feMorphology in="SourceAlpha" operator="dilate" radius="1.5" result="edge" />
        <feComposite in="edge" in2="SourceAlpha" operator="out" result="ring" />
        <feFlood floodColor="#d0f5ff" result="ink" />
        <feComposite in="ink" in2="ring" operator="in" />
      </filter>
    </svg>}
    <img className="flurry-mark__ice" src={FLURRY_PRINT.body} alt="" draggable={false} />
    {!outline && <FlurryFace animated={false}/>}
  </div>;
}

export function FlurryMemoryMark({ memory, back = false }: { memory: StickerMemory; back?: boolean }) {
  if (!back) return <div className="flurry-print-plane flurry-print-plane--front"><StickerPrint memory={memory} /></div>;
  const xEdge = memory.x < .14 ? 0 : memory.x > .86 ? 1 : undefined;
  const yEdge = memory.y < .101 ? 0 : memory.y > .899 ? 1 : undefined;
  const x = xEdge === undefined ? memory.x : 2*xEdge-memory.x;
  const y = yEdge === undefined ? memory.y : 2*yEdge-memory.y;
  return <div className="flurry-print-plane flurry-print-plane--reverse">
    {xEdge !== undefined && <StickerPrint memory={{ x, y: memory.y }} flipX />}
    {yEdge !== undefined && <StickerPrint memory={{ x: memory.x, y }} flipY />}
    {xEdge !== undefined && yEdge !== undefined && <StickerPrint memory={{ x, y }} flipX flipY />}
  </div>;
}

/** The portrait art draws the inside portion at its normal depth. */
export function FlurryUnfoldedEdge({ memory }: { memory: StickerMemory }) {
  if (stickerFrontCoverage(memory.x, memory.y) >= .999) return null;
  return <div className="flurry-unfolded-edge" aria-hidden="true">
    <FlurryMemoryMark memory={memory} />
  </div>;
}

export function FlurryMemory({ actor, saved, onConfirm, onBack, onUnstick }: {
  onUnstick?:()=>void;
  actor: BattleActor;
  saved?: StickerMemory;
  onConfirm?: (memory: StickerMemory) => boolean;
  onBack?: () => void;
}) {
  const [cursor, setCursor] = useState<StickerMemory | null>(null);
  const [draft, setDraft] = useState<StickerMemory | null>(null);
  const [confirmed, setConfirmed] = useState<StickerMemory | null>(null);
  const target = useRef<HTMLButtonElement>(null);
  const source = useRef<HTMLDivElement>(null);
  const follower = useRef<HTMLDivElement>(null);
  const outsideFollower = useRef<HTMLDivElement>(null);
  const [back, setBack] = useState(false);
  const [tappedBenefit,setTappedBenefit]=useState<SnowflakeExpression|null>(null);
  const [hoveredBenefit,setHoveredBenefit]=useState<SnowflakeExpression|null>(null);
  const [focusedBenefit,setFocusedBenefit]=useState<SnowflakeExpression|null>(null);
  const revealedBenefit=hoveredBenefit??focusedBenefit??tappedBenefit;
  const benefitId=useId();
  const effectsPanel=useRef<HTMLElement>(null);
  const [rowFloor,setRowFloor]=useState(76);
  const yes = useRef<HTMLButtonElement>(null);
  const speech = useRef<HTMLDivElement>(null);
  useEffect(() => gameTime.hold(), []);
  useEffect(() => { if (draft) yes.current?.focus(); }, [draft]);
  useEffect(() => {
    if (confirmed) speech.current?.closest('[role="dialog"]')?.querySelector<HTMLButtonElement>('.card-jumbo__close')?.focus({preventScroll:true});
  }, [confirmed]);
  const applied = saved ?? confirmed;
  const placed = applied ?? draft;
  const following = Boolean(cursor && !placed);
  useLayoutEffect(() => {
    const origin = source.current?.getBoundingClientRect();
    if (!following || !origin || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const animations = [follower.current, outsideFollower.current].flatMap(node => {
      if (!node) return [];
      const rect = node.getBoundingClientRect();
      return [node.animate([
        { transform: `translate(${origin.x+origin.width/2-rect.x-rect.width/2}px,${origin.y+origin.height/2-rect.y-rect.height/2}px)` },
        { transform: 'translate(0,0)' },
      ], { duration: 440, easing: 'cubic-bezier(.15,.65,.25,1)' })];
    });
    return () => animations.forEach(animation => animation.cancel());
  }, [following]);
  const preview = (ref: RefObject<HTMLDivElement | null>) => cursor && !placed &&
    <div className="flurry-placement-plane" aria-hidden="true">
      <StickerPrint memory={cursor} outline />
      <div ref={ref} className="flurry-follower" style={memoryStyle(cursor)}>
        <StickerPrint memory={{x:.5,y:.5}} />
      </div>
    </div>;
  const pointAt = (event: PointerEvent<HTMLElement>) => {
    const rect = target.current?.parentElement?.querySelector('.trading-card__art')?.getBoundingClientRect();
    return rect?.width && rect.height
      ? stickerMemory((event.clientX - rect.left) / rect.width, (event.clientY - rect.top) / rect.height)
      : null;
  };
  const acceptsPlacementPointer = (event: PointerEvent<HTMLElement>) => {
    if (!onConfirm || placed || !(event.target instanceof Element)) return false;
    if (target.current?.contains(event.target)) return true;
    return cursor !== null && event.pointerType === 'mouse' &&
      !event.target.closest('button, select, label, .flurry-memory__effects');
  };
  const choices=snowflakeEnhancements(actor);
  const effects=choices.map(name=>[name,SNOWFLAKE_EXPRESSIONS[name]] as const);
  const choicesKey=choices.join('|');
  useLayoutEffect(()=>{
    const panel=effectsPanel.current;if(!panel)return;
    // Hidden full benefits stay in the same grid cell as their base text.
    // Measure both before revealing anything, including after font/width changes.
    const measure=()=>{const rows=[...panel.querySelectorAll<HTMLButtonElement>('.flurry-ability-entry')];
      const height=Math.ceil(Math.max(40,...rows.map(row=>{
        const title=row.firstElementChild as HTMLElement,copy=row.querySelector<HTMLElement>('.flurry-ability-copy')!;
        return title.getBoundingClientRect().height+copy.scrollHeight+10;
      })));setRowFloor(current=>current===height?current:height);
    };
    measure();const observer=new ResizeObserver(measure);observer.observe(panel);
    let active=true;void document.fonts?.ready.then(()=>{if(active)measure();});
    return()=>{active=false;observer.disconnect();};
  },[choicesKey]);
  const highlighted=(placed?.enhancement??(placed?snowflakeEnhancementAt(actor,placed.y):cursor?snowflakeEnhancementAt(actor,cursor.y):undefined));
  const withEnhancement=(memory:StickerMemory):StickerMemory=>({...memory,enhancement:snowflakeEnhancementAt(actor,memory.y)});

  return <section className="flurry-memory" style={{'--memory-row-floor':`${rowFloor}px`,'--memory-rows':choices.length} as CSSProperties} data-jumbo-empty-space aria-label={`Flurry memory for ${actor.name}`}
    onPointerLeave={()=>{if(!placed)setCursor(null);}}
    onPointerMove={event => {
      if (event.pointerType !== 'mouse' || !acceptsPlacementPointer(event)) return;
      const next = pointAt(event);
      if (next) setCursor(current =>
        current && Math.abs(current.x-next.x) < .00001 && Math.abs(current.y-next.y) < .00001 ? current : next);
    }}
    onPointerUp={event => {
      if (event.button !== 0 || !onConfirm || placed ||
          !(event.target instanceof Node) || !target.current?.contains(event.target)) return;
      const point=pointAt(event);if(point)setDraft(withEnhancement(point));
    }}>
    <header className="flurry-memory__header">
      <h2>Flurry</h2>
      <p>{applied ? `Flurry on ${actor.name}` : 'Stick the sticker!'}</p>
    </header>
    <div className="flurry-memory__source" ref={source} data-following={(following || Boolean(draft)) || undefined}>
      {!applied && <><FlurryAmbiance /><SnowflakeSticker floating /><span style={{visibility:draft?'hidden':undefined}}>Flurry</span></>}
    </div>
    <div className="flurry-memory__portrait">
      <TradingCard id={`sticker-portrait-${actor.id}`} title={back ? 'Card back' : actor.name} state="jumbo" hideBody interactive={Boolean(placed)}
        cornerAdornment={following ? <div className="flurry-unfolded-edge" data-placement-preview>{preview(outsideFollower)}</div>
          : applied && !back && <FlurryUnfoldedEdge memory={applied} />}
        art={back && placed ? <div className="flurry-card-back"><FlurryMemoryMark memory={placed} back /></div>
          : <ActorCardArt sprite={ACTOR_HOLO_ART[actor.id]} label={actor.name}
            aboveBackground={placed ? <FlurryMemoryMark memory={placed} /> : preview(follower)} />} />
      {onConfirm && !applied && <div className="flurry-placement-bands" aria-hidden="true" style={{'--sticker-bands':choices.length} as CSSProperties}>
        {choices.map(name=><div key={name} data-enhancement={name} data-targeted={highlighted===name||undefined}><span>{name==='kin'?'Ice Armor':name}</span></div>)}
      </div>}
      {onConfirm && !applied && <button ref={target} className="flurry-memory__target" type="button" disabled={Boolean(draft)}
        aria-label={`Choose a spot on ${actor.name}’s portrait`} aria-describedby="flurry-placement-hint"
        onClick={event => { if (event.detail === 0 && !draft) setDraft(withEnhancement(cursor ?? DEFAULT_STICKER_MEMORY)); }}
        onKeyDown={event => {
          const shift = { ArrowLeft: [-.05, 0], ArrowRight: [.05, 0], ArrowUp: [0, -.05], ArrowDown: [0, .05] }[event.key];
          if (!shift) return;
          event.preventDefault();
          setCursor(current => stickerMemory((current ?? DEFAULT_STICKER_MEMORY).x + shift[0], (current ?? DEFAULT_STICKER_MEMORY).y + shift[1]));
        }} />}
      {draft && <div className="flurry-memory__callout"
        style={{ top: draft.y * 100 + '%', '--pin-x': (back ? 1-draft.x : draft.x) * 100 + '%' } as CSSProperties}
        role="group" aria-label="Flurry asks to help">
        <div><p>Let me help!</p><p>Enhance {draft.enhancement==='kin'?'Ice Armor':draft.enhancement} only.</p>
          <button type="button" ref={yes} onClick={() => {
            if (!onConfirm?.(draft)) return;
            setConfirmed(draft);
            setDraft(null);
            setBack(false);
          }}>Yes</button>
          <button type="button" onClick={() => { setBack(false); setDraft(null); setCursor(draft); requestAnimationFrame(() => target.current?.focus()); }}>No</button>
        </div>
      </div>}
      {confirmed && !back && <div ref={speech} className="flurry-memory__callout flurry-memory__cheer"
        style={{ top: confirmed.y * 100 + '%', '--pin-x': confirmed.x * 100 + '%' } as CSSProperties}>
        <div role="status">
          <span className="sr-only">Flurry says Wheee!</span>
          <span className="flurry-memory__wave" aria-hidden="true">
            {[...'Wheee!'].map((letter, index) => <span key={index} style={{'--wave-index':index} as CSSProperties}>{letter}</span>)}
          </span>
        </div>
      </div>}
    </div>
    <aside ref={effectsPanel} className="flurry-memory__effects" aria-label="Flurry’s effects" style={{'--sticker-bands':choices.length} as CSSProperties}>
      <div className="flurry-effects-heading">
      <h3>{actor.name}’s abilities</h3>
      {onBack && <button type="button" className="flurry-flip" autoFocus onClick={onBack}>Back to {actor.name}</button>}
      {placed && stickerFrontCoverage(placed.x,placed.y) < .999 && <button type="button" className="flurry-flip" onClick={() => setBack(value => !value)}>
        {back ? 'Show card front' : 'Show wrapped back'}
      </button>}
      <p aria-live="polite">{highlighted?`Enhance ${highlighted==='kin'?'Ice Armor':highlighted} only`:'Move vertically to choose one enhancement.'}</p>
      <p className="flurry-benefit-hint">Hover or tap an ability to see it with Flurry.</p>
      </div>
      <dl>{effects.map(([name, detail],index) => {const revealed=revealedBenefit===name;return <div key={name} data-enhancement-row={name} data-targeted={highlighted===name||undefined} data-revealed={revealed||undefined}>
        <dt><button type="button" className="flurry-ability-entry" aria-expanded={revealed} aria-controls={`${benefitId}-${index}`} aria-current={highlighted===name?'true':undefined}
          onPointerEnter={event=>{if(event.pointerType==='mouse')setHoveredBenefit(name);}} onPointerLeave={()=>setHoveredBenefit(null)}
          onFocus={()=>setFocusedBenefit(name)} onBlur={()=>setFocusedBenefit(null)}
          onClick={event=>{setTappedBenefit(current=>current===name?null:name);if(event.detail>0){setFocusedBenefit(null);event.currentTarget.blur();}}}>
          <span>{name==='kin'?'Kin passive':name}</span>
          <span className="flurry-ability-copy">
            <span className="flurry-ability-base" aria-hidden={revealed}>{baseAbilities[name]}</span>
            <span id={`${benefitId}-${index}`} className="flurry-ability-benefit" aria-hidden={!revealed}>
              <span className="flurry-benefit-label">With Flurry</span><strong>{detail}</strong><span className="flurry-benefit-flakes" aria-hidden="true">❄ ✧ ❄</span>
            </span>
          </span>
        </button></dt>
      </div>;})}</dl>
      <div className="flurry-effects-notes">{actor.fastSwipes && <p>Fast Swipes has no ice expression yet.</p>}
      {revealedBenefit==='Vice Grip' && <p tabIndex={0} data-tooltip-title="Frostbite"
        data-game-tooltip="Flurry’s Vice Grip adds one Frostbite stack per enemy turn while the target is held.">Frostbite’s payoff is still in design.</p>}</div>
    </aside>
    {applied&&onUnstick&&<button type="button" className="flurry-unstick" onClick={onUnstick}>Unstick Flurry</button>}
    <p className="flurry-memory__hint" id="flurry-placement-hint" aria-hidden={Boolean(applied)}
      style={{visibility:applied?'hidden':undefined}}>Move up or down to choose one ability band. Click or tap to place; use arrows and Enter on keyboard.</p>
  </section>;
}
