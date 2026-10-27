import { useEffect, useRef, useState, type RefObject } from 'react';
import { createPortal, flushSync } from 'react-dom';
import { gameTime } from '../../gameTime';
import { TooltipBubble } from './GameTooltip';

const inspectable = '[data-game-tooltip], .battle-buff-icon, .ability-card:not([disabled]), [data-skill], .battle-move';
type Inspection = { anchor: HTMLElement; text: string; pinned: boolean };

/** UI inspection owns a clock hold, never the player's explicit pause choice. */
export function useCombatInspection(field: RefObject<HTMLElement | null>, session: number, modalOpen: boolean) {
  const [current, setCurrent] = useState<Inspection | null>(null);
  const live = useRef<Inspection | null>(null);
  const release = useRef<(() => void) | null>(null);
  useEffect(() => {
    let swallowGesture = false;
    const close = () => {
      live.current?.anchor.removeAttribute('data-combat-inspected');
      live.current?.anchor.removeAttribute('aria-describedby');
      live.current = null;
      release.current?.(); release.current = null;
      setCurrent(null);
    };
    const find = (target: EventTarget | null) => {
      const el = target instanceof Element ? target.closest<HTMLElement>(inspectable) : null;
      return el && (field.current?.contains(el) || el.closest('.momentum-skill-layer, .ability-fan, .ability-card-popover')) ? el : null;
    };
    const show = (anchor: HTMLElement, pinned: boolean) => {
      const text = anchor.dataset.combatInspect || anchor.dataset.gameTooltip || anchor.getAttribute('aria-label') || anchor.getAttribute('title') || anchor.textContent?.trim();
      if (!text) return;
      if (live.current?.anchor !== anchor) {
        live.current?.anchor.removeAttribute('data-combat-inspected');
        live.current?.anchor.removeAttribute('aria-describedby');
      }
      anchor.setAttribute('data-combat-inspected', 'true');
      anchor.setAttribute('aria-describedby', 'combat-inspection-tooltip');
      release.current ??= gameTime.hold();
      const next = { anchor, text, pinned };
      live.current = next; setCurrent(next);
    };
    const over = (event: PointerEvent) => {
      if (event.pointerType === 'touch' || event.buttons || live.current?.pinned) return;
      const el = find(event.target);
      if (el && el !== live.current?.anchor) show(el, false);
    };
    const out = (event: PointerEvent) => {
      const tip = live.current;
      if (!tip || tip.pinned || event.pointerType === 'touch') return;
      if (event.relatedTarget instanceof Node && tip.anchor.contains(event.relatedTarget)) return;
      close();
    };
    const down = (event: PointerEvent) => {
      if (event.target instanceof Element && event.target.closest('.combat-inspection')) return;
      swallowGesture = false;
      const el = find(event.target);
      if (event.pointerType === 'touch' && el && live.current?.anchor !== el) {
        show(el, true); swallowGesture = true;
        event.preventDefault(); event.stopImmediatePropagation();
      } else if (live.current?.pinned && el !== live.current.anchor) {
        close(); swallowGesture = true;
        event.preventDefault(); event.stopImmediatePropagation();
      } else if (live.current) {
        // A deliberate second tap or mouse press hands input back to the ability.
        flushSync(close);
      }
    };
    const swallow = (event: Event) => {
      if (!swallowGesture) return;
      event.preventDefault(); event.stopImmediatePropagation();
      if (event.type === 'click' || event.type === 'pointercancel') swallowGesture = false;
    };
    const focus = (event: FocusEvent) => { const el = find(event.target); if (el?.matches(':focus-visible')) show(el, false); };
    const key = (event: KeyboardEvent) => {
      if (!live.current) return;
      if (event.key === 'Escape') { event.preventDefault(); event.stopImmediatePropagation(); close(); }
      else if (event.key === 'Enter' || event.key === ' ') flushSync(close);
    };
    const observer = new MutationObserver(() => { if (live.current && !live.current.anchor.isConnected) close(); });
    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener('pointerover', over, true);
    window.addEventListener('pointerout', out, true);
    window.addEventListener('pointerdown', down, true);
    window.addEventListener('pointerup', swallow, true);
    window.addEventListener('pointercancel', swallow, true);
    window.addEventListener('click', swallow, true);
    window.addEventListener('focusin', focus, true);
    window.addEventListener('focusout', close, true);
    window.addEventListener('keydown', key, true);
    window.addEventListener('blur', close);
    return () => {
      observer.disconnect(); close();
      window.removeEventListener('pointerover', over, true);
      window.removeEventListener('pointerout', out, true);
      window.removeEventListener('pointerdown', down, true);
      window.removeEventListener('pointerup', swallow, true);
      window.removeEventListener('pointercancel', swallow, true);
      window.removeEventListener('click', swallow, true);
      window.removeEventListener('focusin', focus, true);
      window.removeEventListener('focusout', close, true);
      window.removeEventListener('keydown', key, true);
      window.removeEventListener('blur', close);
    };
  }, [field, session]);
  useEffect(() => { if (modalOpen) return gameTime.hold(); }, [modalOpen]);
  const active = Boolean(current) || modalOpen;
  useEffect(() => {
    if (active) document.documentElement.dataset.combatInspection = 'true';
    return () => { delete document.documentElement.dataset.combatInspection; };
  }, [active]);
  return { active, overlay: current && createPortal(<TooltipBubble tip={current} inspection />, document.body) };
}
