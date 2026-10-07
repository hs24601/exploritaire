import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

const HOVER_DELAY = 350;
const LONG_PRESS = 500;
const TOUCH_SHOW_MS = 2500;
const MARGIN = 8;
const TIP_ID = 'game-tooltip';

type Tip = { anchor: Element; text: string };

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
  const parked = useRef<{ el: Element; title: string } | null>(null);

  useEffect(() => {
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
      if (parked.current?.el === el) return parked.current.title;
      restore();
      const title = el.getAttribute('title') ?? '';
      el.removeAttribute('title');
      parked.current = { el, title };
      return title;
    };
    // The bubble goes, but a hovered element keeps its title parked until the pointer leaves.
    const hideBubble = () => { window.clearTimeout(timer.current); tipRef.current = null; setTip(null); };
    const hide = () => { hideBubble(); restore(); };
    const show = (el: Element) => {
      const text = park(el).trim();
      if (!text || !el.isConnected) { hide(); return; }
      el.setAttribute('aria-describedby', TIP_ID);
      tipRef.current = { anchor: el, text };
      setTip(tipRef.current);
    };
    const titled = (target: EventTarget | null) => target instanceof Element ? target.closest('[title]') : null;

    const over = (event: PointerEvent) => {
      if (event.pointerType === 'touch') return;
      const el = titled(event.target);
      if (!el || el === parked.current?.el) return;
      hide();
      park(el);
      timer.current = window.setTimeout(() => show(el), HOVER_DELAY);
    };
    const out = (event: PointerEvent) => {
      if (event.pointerType === 'touch') return;
      const anchor = parked.current?.el;
      if (anchor && !(event.relatedTarget instanceof Node && anchor.contains(event.relatedTarget))) hide();
    };

    let press: { x: number; y: number; el: Element; shown: boolean } | null = null;
    const down = (event: PointerEvent) => {
      if (event.pointerType !== 'touch') { hideBubble(); return; }
      const wasShowing = tipRef.current?.anchor;
      hide();
      const el = titled(event.target);
      if (!el) { press = null; return; }
      park(el);
      press = { x: event.clientX, y: event.clientY, el, shown: false };
      if (!interactive(el) && wasShowing !== el) { press.shown = true; show(el); timer.current = window.setTimeout(hide, TOUCH_SHOW_MS); return; }
      timer.current = window.setTimeout(() => { if (!press) return; press.shown = true; show(el); timer.current = window.setTimeout(hide, TOUCH_SHOW_MS); }, LONG_PRESS);
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
      document.removeEventListener('contextmenu', contextMenu, true);
      window.removeEventListener('scroll', hideBubble, true);
      window.removeEventListener('wheel', hideBubble);
      window.removeEventListener('blur', hide);
    };
  }, []);

  return tip ? createPortal(<TooltipBubble tip={tip} />, document.body) : null;
}

/** Sits above its anchor, flips below when there's no room, and stays on screen. */
function TooltipBubble({ tip }: { tip: Tip }) {
  const ref = useRef<HTMLDivElement>(null);
  const [place, setPlace] = useState<{ left: number; top: number; arrow: number; below: boolean } | null>(null);
  useLayoutEffect(() => {
    const target = tip.anchor.getBoundingClientRect();
    const bubble = ref.current?.getBoundingClientRect();
    if (!bubble) return;
    const below = target.top - bubble.height - MARGIN < MARGIN;
    const centre = target.left + target.width / 2;
    const left = Math.max(MARGIN, Math.min(window.innerWidth - bubble.width - MARGIN, centre - bubble.width / 2));
    const top = below ? Math.min(window.innerHeight - bubble.height - MARGIN, target.bottom + MARGIN) : target.top - bubble.height - MARGIN;
    setPlace({ left, top, below, arrow: Math.max(12, Math.min(bubble.width - 12, centre - left)) });
  }, [tip]);
  return <div ref={ref} id={TIP_ID} role="tooltip" className={`game-tooltip${place?.below ? ' game-tooltip--below' : ''}`}
    style={place ? { left: place.left, top: place.top, ['--arrow-x' as string]: `${place.arrow}px` } : { left: 0, top: 0, visibility: 'hidden' }}>
    {tip.text}
  </div>;
}
