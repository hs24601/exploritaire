import { useEffect, useId, useRef, useState } from 'react';
import { setDarknessStrength, setMapLightingRenderer, useDarknessStrength, useMapLightingRenderer } from '../mapLightingRenderer';
import './MapLightingControls.css';

export function MapLightingControls() {
  const mode = useMapLightingRenderer(), darkness = useDarknessStrength();
  const [open, setOpen] = useState(false);
  const host = useRef<HTMLDivElement>(null), trigger = useRef<HTMLButtonElement>(null);
  const id = useId();
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => { if (!host.current?.contains(event.target as Node)) setOpen(false); };
    const escape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault(); event.stopPropagation(); setOpen(false); trigger.current?.focus();
    };
    document.addEventListener('pointerdown', outside, true);
    window.addEventListener('keydown', escape, true);
    return () => { document.removeEventListener('pointerdown', outside, true); window.removeEventListener('keydown', escape, true); };
  }, [open]);
  return <div ref={host} className="map-lighting-controls" data-camera-ignore="true">
    <button ref={trigger} type="button" className="proto-map-camera-button" aria-label="Lighting engine options"
      aria-haspopup="dialog" aria-expanded={open} aria-controls={id} title={`Lighting engine · ${mode}`}
      data-lighting-toggle={mode} onClick={() => setOpen(value => !value)}>LE</button>
    {open && <div id={id} className="map-lighting-flyout" role="dialog" aria-label="Lighting engine options">
      <label>Renderer<select aria-label="Lighting renderer" value={mode} onChange={event => setMapLightingRenderer(event.target.value as typeof mode)}>
        <option value="off">Off</option><option value="mobile">Mobile</option><option value="full">Full</option>
      </select></label>
      <label className="map-lighting-darkness">Darkness strength<output>{darkness}%</output>
        <input type="range" aria-label="Darkness strength" min="0" max="200" step="5" value={darkness}
          disabled={mode === 'off'} onChange={event => setDarknessStrength(Number(event.target.value))} />
      </label>
    </div>}
  </div>;
}
