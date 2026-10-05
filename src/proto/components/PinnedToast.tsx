import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

/** A parchment note pinned beside an on-screen element until closed. It sits on
 * the preferred side of `anchor` (or of `edge`, e.g. the tray it belongs to) and
 * drops below the anchor when that side has no room. Portaled so a transformed
 * ancestor can't trap its fixed positioning. */
export function PinnedToast({ title, subtitle, icon, anchor, edge, side = 'right', dismissOnOutside = false, onClose, className = '', children }: {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  anchor: Element | null;
  edge?: Element | null;
  side?: 'left' | 'right';
  /** Close on Escape or a press outside the toast and its anchor. */
  dismissOnOutside?: boolean;
  onClose: () => void;
  className?: string;
  children?: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null);
  useLayoutEffect(() => {
    const place = () => {
      const target = anchor?.getBoundingClientRect();
      const card = ref.current?.getBoundingClientRect();
      if (!target || !card) return;
      const margin = 8;
      const bounds = edge?.getBoundingClientRect() ?? target;
      const besideLeft = side === 'right' ? Math.max(target.right, bounds.right) + margin : Math.min(target.left, bounds.left) - margin - card.width;
      const fitsBeside = besideLeft >= margin && besideLeft + card.width <= window.innerWidth - margin;
      const left = fitsBeside ? besideLeft : Math.max(margin, Math.min(window.innerWidth - card.width - margin, target.left));
      const top = fitsBeside ? target.top : target.bottom + margin;
      setPosition({ left, top: Math.max(margin, Math.min(window.innerHeight - card.height - margin, top)) });
    };
    place();
    const observer = new ResizeObserver(place);
    if (ref.current) observer.observe(ref.current);
    window.addEventListener('resize', place);
    return () => { observer.disconnect(); window.removeEventListener('resize', place); };
  }, [anchor, edge, side]);
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    if (!dismissOnOutside) return;
    const outside = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!ref.current?.contains(target) && !anchor?.contains(target)) close.current();
    };
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') close.current(); };
    document.addEventListener('pointerdown', outside, true);
    document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('pointerdown', outside, true); document.removeEventListener('keydown', escape); };
  }, [anchor, dismissOnOutside]);
  return createPortal(<div ref={ref} className={`pinned-toast ${className}`} role="dialog" aria-label={title}
    style={position ? { left: position.left, top: position.top } : { left: -9999, top: 0 }}>
    <header>
      {icon && <span className="pinned-toast__icon" aria-hidden="true">{icon}</span>}
      <div><h3>{title}</h3>{subtitle && <p>{subtitle}</p>}</div>
      <button type="button" className="pinned-toast__close" aria-label="Close" onClick={onClose}>×</button>
    </header>
    {children}
  </div>, document.body);
}
