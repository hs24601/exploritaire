import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { SnowflakeSticker } from './SnowflakeSticker';
import './snowflakeReward.css';

type Point = { x: number; y: number };

export function useFlurryOpeningDrift(active: boolean) {
  const anchor = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!active) return;
    const move = (event: PointerEvent) => {
      const node = anchor.current;
      if (!node || event.target instanceof Element && node.contains(event.target)) return;
      if (matchMedia('(prefers-reduced-motion: reduce)').matches || event.buttons && event.type === 'pointermove') return;
      const bound = (offset: number, viewport: number, size: number) => {
        const limit = Math.max(0, viewport * .15 - size / 2);
        return Math.max(-limit, Math.min(limit, offset * .24));
      };
      node.style.setProperty('--flurry-x', bound(event.clientX-innerWidth/2,innerWidth,node.offsetWidth)+'px');
      node.style.setProperty('--flurry-y', bound(event.clientY-innerHeight/2,innerHeight,node.offsetHeight)+'px');
    };
    const reset = () => {
      anchor.current?.style.removeProperty('--flurry-x');
      anchor.current?.style.removeProperty('--flurry-y');
    };
    window.addEventListener('pointermove', move, {passive:true});
    window.addEventListener('pointerdown', move, {passive:true});
    window.addEventListener('resize', reset);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerdown', move);
      window.removeEventListener('resize', reset);
    };
  }, [active]);
  return anchor;
}

export function SnowflakeDrag({ label, floating, disabled, armed, onActivate, onDrop, onDragging }: {
  label: string;
  floating?: boolean;
  disabled?: boolean;
  armed?: boolean;
  onActivate: () => void;
  onDrop: (under: Element | null) => void;
  onDragging: (dragging: boolean) => void;
}) {
  const [position, setPosition] = useState<(Point & { width: number }) | null>(null);
  const press = useRef<(Point & { pointer: number; active: boolean }) | null>(null);
  const suppressClick = useRef(false);
  const latest = useRef(onDragging);
  latest.current = onDragging;
  const clear = () => {
    if (press.current?.active) latest.current(false);
    press.current = null;
    setPosition(null);
  };
  useEffect(() => {
    const cancel = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || !press.current) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      suppressClick.current = true;
      clear();
    };
    window.addEventListener('keydown', cancel, true);
    window.addEventListener('blur', clear);
    return () => {
      window.removeEventListener('keydown', cancel, true);
      window.removeEventListener('blur', clear);
      if (press.current?.active) latest.current(false);
    };
  }, []);
  return <>
    <button type="button" className="snowflake-drag" aria-label={label} aria-pressed={armed} disabled={disabled}
      data-dragging={Boolean(position) || undefined}
      onPointerDown={event => {
        if (event.button !== 0 || press.current) return;
        suppressClick.current = false;
        press.current = { pointer: event.pointerId, x: event.clientX, y: event.clientY, active: false };
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerMove={event => {
        const start = press.current;
        if (!start || start.pointer !== event.pointerId) return;
        if (!start.active) {
          if (Math.hypot(event.clientX - start.x, event.clientY - start.y) < 7) return;
          start.active = true;
          latest.current(true);
        }
        setPosition({ x: event.clientX, y: event.clientY, width: event.currentTarget.offsetWidth });
      }}
      onPointerUp={event => {
        const start = press.current;
        if (!start || start.pointer !== event.pointerId) return;
        clear();
        if (!start.active) return;
        suppressClick.current = true;
        if (!disabled) onDrop(document.elementFromPoint(event.clientX, event.clientY));
      }}
      onPointerCancel={clear}
      onLostPointerCapture={clear}
      onClick={event => { if (!suppressClick.current || event.detail === 0) onActivate(); suppressClick.current = false; }}
    >
      <SnowflakeSticker floating={floating} />
    </button>
    {position && createPortal(<div className="snowflake-drag-ghost" aria-hidden="true"
      style={{ left: position.x, top: position.y, width: position.width }}>
      <SnowflakeSticker interactive={false} />
    </div>, document.body)}
  </>;
}
