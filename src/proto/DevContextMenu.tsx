import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

/** Window-level interception; future inspection actions can use the captured target. */
export function DevContextMenu({ enabled = import.meta.env.DEV }: { enabled?: boolean }) {
  const [location, setLocation] = useState<{ x: number; y: number; target: EventTarget | null } | null>(null);
  const menu = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const open = (event: MouseEvent) => {
      event.preventDefault();
      if (!enabled) return;
      const target = event.target instanceof Element ? event.target : null;
      const bounds = target?.getBoundingClientRect();
      const keyboard = event.clientX === 0 && event.clientY === 0;
      setLocation({ x: keyboard ? bounds?.left ?? 8 : event.clientX,
        y: keyboard ? bounds?.bottom ?? 8 : event.clientY, target: event.target });
    };
    const dismiss = () => setLocation(null);
    const pointer = (event: PointerEvent) => {
      if (!menu.current?.contains(event.target as Node)) dismiss();
    };
    const key = (event: KeyboardEvent) => { if (event.key === 'Escape') dismiss(); };
    document.addEventListener('contextmenu', open, true);
    document.addEventListener('pointerdown', pointer, true);
    document.addEventListener('keydown', key, true);
    window.addEventListener('resize', dismiss);
    window.addEventListener('blur', dismiss);
    return () => {
      document.removeEventListener('contextmenu', open, true);
      document.removeEventListener('pointerdown', pointer, true);
      document.removeEventListener('keydown', key, true);
      window.removeEventListener('resize', dismiss);
      window.removeEventListener('blur', dismiss);
    };
  }, [enabled]);

  if (!enabled || !location) return null;
  return createPortal(
    <div ref={menu} className="dev-context-menu" role="menu" aria-label="Developer tools"
      style={{ left: Math.max(8, Math.min(location.x, window.innerWidth - 148)),
        top: Math.max(8, Math.min(location.y, window.innerHeight - 52)) }}>
      <span role="menuitem" aria-disabled="true">dev</span>
    </div>, document.body,
  );
}
