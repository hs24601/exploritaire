import { useEffect, useRef, useState, type ReactNode } from 'react';
import { setHeroBobtail, useHeroBobtail } from '../heroBobtail';
import './ArtSettings.css';
import { setWatercolorBleed, useWatercolorBleed } from '../watercolorBleed';

export function ArtSettings({ children }: { children?: ReactNode }) {
  const [open, setOpen] = useState(false);
  const bobtail = useHeroBobtail();
  const bleed = useWatercolorBleed();
  const root = useRef<HTMLDivElement>(null), button = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') { event.stopPropagation(); setOpen(false); button.current?.focus(); } };
    document.addEventListener('pointerdown', outside); document.addEventListener('keydown', escape, true);
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', escape, true); };
  }, [open]);
  return <div ref={root} className="art-settings" data-camera-ignore="true">
    <button ref={button} type="button" className="art-settings__cog" aria-label="Game settings" aria-expanded={open} aria-controls="art-settings-panel" onClick={() => setOpen(!open)}>
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="m9 3-1 3-3 1-2 3 2 2-1 3 3 2 3-1 2 2 3-1 1-3 3-1 2-3-2-2 1-3-3-2-3 1-2-2Z"/><circle cx="12" cy="12" r="3"/></svg>
    </button>
    {open && <div id="art-settings-panel" className="art-settings__panel" role="group" aria-label="Game settings">
      <label className="art-settings__toggle"><input type="checkbox" checked={bobtail} onChange={event => setHeroBobtail(event.target.checked)} /> Hero bobtail</label>
      <label className="art-settings__toggle"><input type="checkbox" checked={bleed} onChange={event => setWatercolorBleed(event.target.checked)} /> Watercolor bleed</label>
      {children}
    </div>}
  </div>;
}


