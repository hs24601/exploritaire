import { resolveTooltipTerm, tooltipParts, tooltipHeading } from '../tooltipTerms';
import { gameTime } from '../../gameTime';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

const HOVER_DELAY = 350;
const LONG_PRESS = 500;
const TOUCH_SHOW_MS = 2500;
const MARGIN = 8;
const TIP_ID = 'game-tooltip';
// Temporary presentation suppression requested during scene iteration.
// Keep title parking active so native browser tooltips stay suppressed too.
const TOOLTIPS_ENABLED = false;

type Tip = { anchor: Element; text: string; title?: string };
const stickerJumbo = (anchor: Element) => anchor.closest('.flurry-memory')?.closest('.card-jumbo')
  ?? anchor.closest('.card-jumbo:has(.flurry-memory)');

/** Elements a tap already does something on; those show their tip on long-press only. */
const interactive = (el: Element) => Boolean(el.closest('button, a[href], input, select, textarea, label, [role="button"], [draggable="true"]'));

/** Replaces the browser's title tooltip across the page with a parchment one.
 * Any element with a `title` gets it: hover or keyboard focus on desktop,
 * long-press (or a tap on plain text) on touch. While the tip shows, the
 * element's `title` is parked so the native tooltip can't appear, then put back
 * so React and screen readers still see it. */
export function GameTooltip() {
  const [tip, setTip] = useState<Tip | null>(null);
  const tipRef = useRef<Tip | null>(null);
  const timer = useRef<number>(0);
  const jumboHoverTimer = useRef<number>(0);
  const parked = useRef<{ el: Element; title: string } | null>(null);

  useEffect(() => {
    if (!tip?.anchor.hasAttribute('data-game-tooltip')) return;
    // A defeated enemy or a changed intent must not leave an obsolete callout.
    const observer = new MutationObserver(() => {
      if (!tip.anchor.isConnected) { tipRef.current=null; setTip(null); return; }
      const text=tip.anchor.getAttribute('data-game-tooltip') ?? '';
      if(text!==tip.text){const next={anchor:tip.anchor,text};tipRef.current=next;setTip(next);}
    });
    observer.observe(document.body,{childList:true,subtree:true});
    observer.observe(tip.anchor,{attributes:true,attributeFilter:['data-game-tooltip']});
    return () => observer.disconnect();
  }, [tip]);

  useEffect(() => {
    let pendingJumboAnchor: Element | null = null;
    const restore = () => {
      const current = parked.current;
      parked.current = null;
      if (!current) return;
      current.el.removeAttribute('aria-describedby');
      // React may have set a fresh title meanwhile; keep the newer one.
      if (!current.el.hasAttribute('title')) current.el.setAttribute('title', current.title);
    };
    // Take the title off the element now, so the native tooltip never shows.
    const park = (el: Element) => {
      if (el.hasAttribute('data-game-tooltip')) return el.getAttribute('data-game-tooltip') ?? '';
      if (parked.current?.el === el) return parked.current.title;
      restore();
      const title = el.getAttribute('title') ?? '';
      el.removeAttribute('title');
      parked.current = { el, title };
      return title;
    };
    // The bubble goes, but a hovered element keeps its title parked until the pointer leaves.
    const hideBubble = () => { gameTime.clearTimeout(timer.current); window.clearTimeout(jumboHoverTimer.current); pendingJumboAnchor=null; if(tipRef.current?.anchor.hasAttribute('data-game-tooltip'))tipRef.current.anchor.removeAttribute('aria-describedby'); tipRef.current = null; setTip(null); };
    const hide = () => { hideBubble(); restore(); };
    const show = (el: Element) => {
      if (el.hasAttribute('data-combat-inspected')) return;
      const text = park(el).trim();
      if (!TOOLTIPS_ENABLED && !el.hasAttribute('data-game-tooltip')) return;
      if (!text || !el.isConnected) { hide(); return; }
      el.setAttribute('aria-describedby', TIP_ID);
      tipRef.current = { anchor: el, text };
      setTip(tipRef.current);
    };
    const titled = (target: EventTarget | null) => {
      // Combat owns its buff hover/hold and nearby card. Avoid a second tooltip
      // taking the same touch before the long-press has completed.
      if (target instanceof Element && target.closest('.battle-field .battle-buff-icon')) return null;
      return target instanceof Element ? target.closest('[title], [data-game-tooltip]') : null;
    };

    let leaveTimer = 0;
    const over = (event: PointerEvent) => {
      window.clearTimeout(leaveTimer);
      if (event.pointerType === 'touch') return;
      const el = titled(event.target);
      if (!el || el === parked.current?.el) return;
      if (event.relatedTarget instanceof Node && el.contains(event.relatedTarget)) return;
      hide();
      park(el);
      if (stickerJumbo(el)) {
        pendingJumboAnchor = el;
        jumboHoverTimer.current = window.setTimeout(() => { pendingJumboAnchor=null; show(el); }, HOVER_DELAY);
      } else timer.current = gameTime.setTimeout(() => show(el), HOVER_DELAY);
    };
    const out = (event: PointerEvent) => {
      if (event.pointerType === 'touch') return;
      if (event.relatedTarget instanceof Element && event.relatedTarget.closest('.game-tooltip')) return;
      if (pendingJumboAnchor && !(event.relatedTarget instanceof Node && pendingJumboAnchor.contains(event.relatedTarget))) hide();
      const anchor = parked.current?.el ?? tipRef.current?.anchor;
      if (anchor && !(event.relatedTarget instanceof Node && anchor.contains(event.relatedTarget))) leaveTimer = window.setTimeout(hide, 220);
    };

    let touchIntent=false;
    let press: { x: number; y: number; el: Element; shown: boolean } | null = null;
    const down = (event: PointerEvent) => {
      if (event.target instanceof Element && event.target.closest('.game-tooltip')) return;
      if (event.pointerType !== 'touch') { hideBubble(); return; }
      if(event.target instanceof Element && event.target.closest('[data-board-piece="tile"],[data-board-piece="actor"],[data-immutable-region]')){hide();return;}
      const wasShowing = tipRef.current?.anchor;
      hide();
      const el = titled(event.target);
      if (!el) { press = null; return; }
      // Intent summaries have no gameplay action: one tap opens their explanation.
      if (el.hasAttribute('data-game-tooltip')) {
        touchIntent=true;
        press = null;
        if (wasShowing !== el) show(el);
        return;
      }
      park(el);
      press = { x: event.clientX, y: event.clientY, el, shown: false };
      if (!interactive(el) && wasShowing !== el) { press.shown = true; show(el); timer.current = gameTime.setTimeout(hide, TOUCH_SHOW_MS); return; }
      timer.current = gameTime.setTimeout(() => { if (!press) return; press.shown = true; show(el); timer.current = gameTime.setTimeout(hide, TOUCH_SHOW_MS); }, LONG_PRESS);
    };
    const move = (event: PointerEvent) => {
      if (!press || event.pointerType !== 'touch' || press.shown) return;
      if (Math.hypot(event.clientX - press.x, event.clientY - press.y) > 10) { press = null; hide(); }
    };
    const up = (event: PointerEvent) => {
      if (event.pointerType !== 'touch' || !press) return;
      if (!press.shown) { press = null; hide(); return; }
      // A long-press that showed a tip is not also a tap on the button under it.
      if (interactive(press.el) && tipRef.current) window.addEventListener('click', swallow, { capture: true, once: true });
      press = null;
    };
    const swallow = (event: Event) => { event.preventDefault(); event.stopPropagation(); };
    const focus = (event: FocusEvent) => {
      const el = titled(event.target);
      if (el && el === event.target && el.matches(':focus-visible')) show(el);
    };
    const blur = (event: FocusEvent) => {
      if (tipRef.current?.anchor !== event.target) return;
      if (parked.current?.el.matches(':hover')) hideBubble(); else hide();
    };
    const click = (event: MouseEvent) => {
      if(touchIntent){touchIntent=false;return;}
      const el = titled(event.target);
      if (el?.hasAttribute('data-game-tooltip') && !tipRef.current) show(el);
    };
    const key = (event: KeyboardEvent) => { if (event.key === 'Escape') hideBubble(); };
    const contextMenu = (event: Event) => { if (press) event.preventDefault(); };

    document.addEventListener('pointerover', over);
    document.addEventListener('pointerout', out);
    document.addEventListener('pointerdown', down, true);
    document.addEventListener('pointermove', move, true);
    document.addEventListener('pointerup', up, true);
    document.addEventListener('pointercancel', hide, true);
    document.addEventListener('focusin', focus);
    document.addEventListener('focusout', blur);
    document.addEventListener('keydown', key);
    document.addEventListener('click', click);
    document.addEventListener('contextmenu', contextMenu, true);
    window.addEventListener('scroll', hideBubble, true);
    window.addEventListener('wheel', hideBubble, { passive: true });
    window.addEventListener('blur', hide);
    return () => {
      hide();
      document.removeEventListener('pointerover', over);
      document.removeEventListener('pointerout', out);
      document.removeEventListener('pointerdown', down, true);
      document.removeEventListener('pointermove', move, true);
      document.removeEventListener('pointerup', up, true);
      document.removeEventListener('pointercancel', hide, true);
      document.removeEventListener('focusin', focus);
      document.removeEventListener('focusout', blur);
      document.removeEventListener('keydown', key);
      document.removeEventListener('click', click);
      document.removeEventListener('contextmenu', contextMenu, true);
      window.removeEventListener('scroll', hideBubble, true);
      window.removeEventListener('wheel', hideBubble);
      window.removeEventListener('blur', hide);
    };
  }, []);

  return tip ? createPortal(<TooltipBubble tip={tip} />, stickerJumbo(tip.anchor) ?? document.body) : null;
}

/** Sits above its anchor, flips below when there's no room, and stays on screen. */
export function TooltipBubble({ tip, inspection = false, depth = 0 }: { tip: Tip; inspection?: boolean; depth?: number }) {
  const jumbo = stickerJumbo(tip.anchor);
  const [child, setChild] = useState<Tip | null>(null);
  useEffect(() => setChild(null), [tip.text, tip.anchor]);
  const title = tip.title ?? tooltipHeading(tip.anchor);
  const text = title && tip.text.startsWith(title + ":") || title && tip.text.startsWith(title + " ·") ? tip.text.slice(title.length + 1).trimStart().replace(/^·\s*/, "") : tip.text;
  const ref = useRef<HTMLDivElement>(null);
  const [place, setPlace] = useState<{ left: number; top: number; arrow: number; below: boolean } | null>(null);
  useLayoutEffect(() => {
    const position = () => {
    const target = tip.anchor.getBoundingClientRect();
    const bubble = ref.current?.getBoundingClientRect();
    if (!bubble) return;
      let below = target.top - bubble.height - MARGIN < MARGIN;
    const centre = target.left + target.width / 2;
    const left = Math.max(MARGIN, Math.min(window.innerWidth - bubble.width - MARGIN, centre - bubble.width / 2));
      let top = Math.max(MARGIN, below ? Math.min(window.innerHeight - bubble.height - MARGIN, target.bottom + MARGIN) : target.top - bubble.height - MARGIN);
      const portrait = jumbo?.querySelector('.flurry-memory__portrait')?.getBoundingClientRect();
      if (portrait && left + bubble.width > portrait.left && left < portrait.right &&
        top + bubble.height > portrait.top && top < portrait.bottom) {
        if (portrait.top - bubble.height >= MARGIN * 2) {
          below = false;
          top = portrait.top - bubble.height - MARGIN;
        } else if (portrait.bottom + bubble.height + MARGIN * 2 <= window.innerHeight) {
          below = true;
          top = portrait.bottom + MARGIN;
        }
      }
    setPlace({ left, top, below, arrow: Math.max(12, Math.min(bubble.width - 12, centre - left)) });
    };
    position();
    const observer = new ResizeObserver(position);
    observer.observe(tip.anchor);
    if (ref.current) observer.observe(ref.current);
    window.addEventListener('resize', position);
    window.addEventListener('scroll', position, true);
    return () => { observer.disconnect(); window.removeEventListener('resize', position); window.removeEventListener('scroll', position, true); };
  }, [tip, jumbo]);
  return <div ref={ref} id={depth ? `tooltip-term-${depth}` : inspection ? 'combat-inspection-tooltip' : TIP_ID} role="tooltip" className={`game-tooltip${inspection ? ' combat-inspection' : ''}${place?.below ? ' game-tooltip--below' : ''}`}
    style={{ ...(place ? { left: place.left, top: place.top, ['--arrow-x' as string]: `${place.arrow}px` } : { left: 0, top: 0, visibility: 'hidden' as const }), zIndex: 70000 + depth * 10, pointerEvents: 'auto', ...(inspection || jumbo ? { animation: 'none' } : {}) }}>
    {title && <strong className="game-tooltip__title">{title}</strong>}
    <div className="game-tooltip__details">{tooltipParts(text).map((part, index) => {
      const term = part.id ? resolveTooltipTerm(part.id) : null;
      if (!term || depth >= 5) return <span key={index}>{part.label}</span>;
      const open = (anchor: Element) => setChild({ anchor, title: term.name, text: term.description });
      return <button type="button" className="game-tooltip__term" key={index} aria-expanded={child?.anchor.getAttribute('data-term') === part.id} data-term={part.id} onPointerEnter={e => { if (e.pointerType !== 'touch') open(e.currentTarget); }} onFocus={e => open(e.currentTarget)} onClick={e => { e.preventDefault(); e.stopPropagation(); open(e.currentTarget); }}>{part.label}</button>;
    })}</div>
    {child && createPortal(<TooltipBubble tip={child} inspection={inspection} depth={depth + 1} />, jumbo ?? document.body)}
  </div>;
}
