import { useEffect, useRef, useState, type RefObject } from 'react';
import { createPortal, flushSync } from 'react-dom';
import { gameTime } from '../../gameTime';
import { TooltipBubble } from './GameTooltip';
import { BuffCardPreview } from './BuffCardPreview';

const inspectable = '[data-game-tooltip], .battle-buff-icon, [data-ability-name], .battle-move';
type Inspection = { anchor: HTMLElement; text: string; pinned: boolean; card?: boolean };

/** UI inspection owns a clock hold, never the player's explicit pause choice. */
export function useCombatInspection(field: RefObject<HTMLElement | null>, session: number, modalOpen: boolean) {
  const [current, setCurrent] = useState<Inspection | null>(null);
  const live = useRef<Inspection | null>(null);
  const release = useRef<(() => void) | null>(null);
  const closeCard = useRef<() => void>(() => {});
  useEffect(() => {
    let swallowGesture = false;
    let leaveTimer = 0;
    let holdTimer = 0, press: {x:number;y:number} | null = null;
    const clearHold = () => { window.clearTimeout(holdTimer); press = null; };
    const close = () => {
      clearHold();
      window.clearTimeout(leaveTimer);
      live.current?.anchor.removeAttribute('data-combat-inspected');
      live.current?.anchor.removeAttribute('aria-describedby');
      live.current = null;
      release.current?.(); release.current = null;
      setCurrent(null);
    };
    closeCard.current = close;
    const find = (target: EventTarget | null) => {
      const el = target instanceof Element ? target.closest<HTMLElement>(inspectable) : null;
      // Hand cards now inspect through jumbo; a tooltip must not consume tap one.
      if (el?.closest('.ability-fan') && !el.hasAttribute('data-ability-name')) return null;
      return el && (field.current?.contains(el) || el.closest('.momentum-skill-layer, .ability-fan, .ability-card-popover')) ? el : null;
    };
    const show = (anchor: HTMLElement, pinned: boolean, card = false) => {
      const text = anchor.dataset.combatInspect || anchor.dataset.gameTooltip || anchor.getAttribute('aria-label') || anchor.getAttribute('title') || anchor.textContent?.trim();
      if (!text) return;
      if (live.current?.anchor !== anchor) {
        live.current?.anchor.removeAttribute('data-combat-inspected');
        live.current?.anchor.removeAttribute('aria-describedby');
      }
      anchor.setAttribute('data-combat-inspected', 'true');
      anchor.setAttribute('aria-describedby', card ? 'combat-buff-card' : 'combat-inspection-tooltip');
      release.current ??= gameTime.hold();
      const next = { anchor, text, pinned, card };
      live.current = next; setCurrent(next);
    };
    const over = (event: PointerEvent) => {
      if (event.target instanceof Element && event.target.closest('.game-tooltip')) { window.clearTimeout(leaveTimer); return; }
      if (event.pointerType === 'touch' || event.buttons || live.current?.pinned) return;
      const el = find(event.target);
      if (el) window.clearTimeout(leaveTimer);
      if (el && el !== live.current?.anchor) show(el, false);
    };
    const out = (event: PointerEvent) => {
      const tip = live.current;
      if (!tip || tip.pinned || event.pointerType === 'touch') return;
      if (event.relatedTarget instanceof Node && tip.anchor.contains(event.relatedTarget)) return;
      if (event.relatedTarget instanceof Element && event.relatedTarget.closest('.game-tooltip')) return;
      leaveTimer = window.setTimeout(close, 220);
    };
    const down = (event: PointerEvent) => {
      if (event.target instanceof Element && event.target.closest('.game-tooltip, .buff-card-preview, .card-jumbo-backdrop')) return;
      swallowGesture = false;
      clearHold();
      const buff = event.target instanceof Element ? event.target.closest<HTMLElement>('.battle-buff-icon') : null;
      if (buff && field.current?.contains(buff) && !buff.matches('.battle-invoke-badge, .keru-holdable, [data-buff="farewell-ward"], [data-buff="farewell-halve"]')) {
        if (live.current) close();
        press = {x:event.clientX,y:event.clientY};
        holdTimer = window.setTimeout(() => { press = null; show(buff, true, true); swallowGesture = true; }, 500);
        return;
      }
      // These cards and buffs own tap/hold/drag gestures. Touch inspection must
      // not swallow their first press before their long-press timer can start.
      if(event.target instanceof Element && event.target.closest('.ability-fan [data-skill], .card-jumbo, .battle-invoke-badge, .keru-square, .keru-holdable, [data-buff="farewell-ward"], [data-buff="farewell-halve"], [data-keru-pour-source], .keru-cast-gem, [data-dig-source]') && !event.target.closest('[data-ability-name]')) {
        if(live.current)flushSync(close);
        return;
      }
      const el = find(event.target);
      if (event.pointerType === 'touch' && el && live.current?.anchor !== el) {
        show(el, true); swallowGesture = true;
        event.preventDefault(); event.stopImmediatePropagation();
      } else if (live.current?.pinned && el !== live.current.anchor) {
        close();
      } else if (live.current) {
        // A deliberate second tap or mouse press hands input back to the ability.
        flushSync(close);
      }
    };
    const swallow = (event: Event) => {
      if (event.type === 'pointerup' || event.type === 'pointercancel') clearHold();
      if (!swallowGesture) return;
      event.preventDefault(); event.stopImmediatePropagation();
      if (event.type === 'click' || event.type === 'pointercancel') swallowGesture = false;
    };
    const move = (event: PointerEvent) => { if (press && Math.hypot(event.clientX - press.x, event.clientY - press.y) > (event.pointerType === 'touch' ? 24 : 12)) clearHold(); };
    const focus = (event: FocusEvent) => { const el = find(event.target); if (el?.matches(':focus-visible')) show(el, false); };
    const key = (event: KeyboardEvent) => {
      if (!live.current) return;
      if (event.target instanceof Element && event.target.closest('.game-tooltip, .buff-card-preview, .card-jumbo-backdrop')) return;
      if (event.key === 'Escape') { event.preventDefault(); event.stopImmediatePropagation(); close(); }
      else if (event.key === 'Enter' || event.key === ' ') flushSync(close);
    };
    const observer = new MutationObserver(() => { if (live.current && !live.current.anchor.isConnected) close(); });
    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener('pointerover', over, true);
    window.addEventListener('pointerout', out, true);
    window.addEventListener('pointerdown', down, true);
    window.addEventListener('pointerup', swallow, true);
    window.addEventListener('pointermove', move, true);
    window.addEventListener('pointercancel', swallow, true);
    window.addEventListener('click', swallow, true);
    window.addEventListener('focusin', focus, true);
    const focusOut = (event: FocusEvent) => { if (!live.current || event.relatedTarget instanceof Element && event.relatedTarget.closest('.game-tooltip, .buff-card-preview, .card-jumbo-backdrop')) return; close(); };
    window.addEventListener('focusout', focusOut, true);
    window.addEventListener('keydown', key, true);
    window.addEventListener('blur', close);
    return () => {
      observer.disconnect(); close();
      window.removeEventListener('pointerover', over, true);
      window.removeEventListener('pointerout', out, true);
      window.removeEventListener('pointerdown', down, true);
      window.removeEventListener('pointerup', swallow, true);
      window.removeEventListener('pointermove', move, true);
      window.removeEventListener('pointercancel', swallow, true);
      window.removeEventListener('click', swallow, true);
      window.removeEventListener('focusin', focus, true);
      window.removeEventListener('focusout', focusOut, true);
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
  return { active, overlay: current && createPortal(current.card ? <BuffCardPreview anchor={current.anchor} text={current.text} onClose={() => closeCard.current()}/> : <TooltipBubble tip={current} inspection />, document.body) };
}
