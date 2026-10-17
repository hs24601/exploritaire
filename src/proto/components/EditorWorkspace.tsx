import { useEffect, useRef, useState, type PointerEvent } from 'react';
import './EditorWorkspace.css';

export function EditorTabs({ names, value, onChange, label }: { names: readonly string[]; value: string; onChange: (value: string) => void; label: string }) {
  return <div className="editor-ribbon" role="tablist" aria-label={label}>{names.map(name => <button type="button" role="tab" aria-selected={value === name} key={name} onClick={() => onChange(name)} onKeyDown={event => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const index = event.key === 'Home' ? 0 : event.key === 'End' ? names.length - 1 : (names.indexOf(name) + (event.key === 'ArrowRight' ? 1 : -1) + names.length) % names.length;
    onChange(names[index]);
    (event.currentTarget.parentElement?.children[index] as HTMLElement)?.focus();
  }}>{name}</button>)}</div>;
}

export function useEditorDrag() {
  const ref = useRef<HTMLElement | null>(null);
  const [position, setPosition] = useState<{ left: number; top: number }>();
  const drag = useRef<{ x: number; y: number; left: number; top: number } | undefined>(undefined);
  const clamp = (left: number, top: number) => ({ left: Math.max(8, Math.min(left, window.innerWidth - (ref.current?.offsetWidth ?? 0) - 8)), top: Math.max(8, Math.min(top, window.innerHeight - (ref.current?.offsetHeight ?? 0) - 8)) });
  useEffect(() => {
    const resize = () => setPosition(p => {
      if (!p) return p;
      const next = clamp(p.left, p.top);
      return next.left === p.left && next.top === p.top ? p : next;
    });
    const observer = new ResizeObserver(resize);
    if (ref.current) observer.observe(ref.current);
    window.addEventListener('resize', resize);
    return () => { observer.disconnect(); window.removeEventListener('resize', resize); };
  }, []);
  return { ref, style: position ? { ...position, right: 'auto', bottom: 'auto', margin: 0 } : undefined, handle: {
    onPointerDown: (event: PointerEvent<HTMLElement>) => {
      if (event.button !== 0 || (event.target as Element).closest('button,input,select')) return;
      const rect = ref.current?.getBoundingClientRect(); if (!rect) return;
      drag.current = { x: event.clientX, y: event.clientY, left: rect.left, top: rect.top };
      event.currentTarget.setPointerCapture(event.pointerId); event.preventDefault();
    },
    onPointerMove: (event: PointerEvent<HTMLElement>) => { const d = drag.current; if (d) setPosition(clamp(d.left + event.clientX - d.x, d.top + event.clientY - d.y)); },
    onPointerUp: () => { drag.current = undefined; }, onPointerCancel: () => { drag.current = undefined; },
  } };
}
