import { gameTime } from '../../gameTime';
import { useEffect, useRef, useState } from 'react';
import { captureCameraShot } from '../cameraDirector';
import { getActorExpression } from '../actorExpression';
import type { CameraShot } from '../cameraChoreography';
import './ScenarioCameraDetails.css';

const snapshot = () => {
  const shot = captureCameraShot();
  return shot ? Object.fromEntries(Object.entries(shot).map(([key, value]) => [key, typeof value === 'number' ? Number(value.toFixed(3)) : value])) as CameraShot : null;
};
const dialogue = () => Array.from(document.querySelectorAll<HTMLElement>('.proto-callout[data-callout-id]'))
  .filter(node => getComputedStyle(node).visibility !== 'hidden')
  .map(node => ({ reference: node.dataset.calloutReference, configuration: node.dataset.calloutId, bubble: Number(node.dataset.page), bubbles: Number(node.dataset.pages) }));

/** Only this readout polls; camera animation never rerenders the game. */
export function ScenarioCameraDetails() {
  const [shot, setShot] = useState<CameraShot | null>(null);
  const [message, setMessage] = useState('');
  const [fallback, setFallback] = useState('');
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    const update = () => {
      if (document.hidden) return;
      const next = snapshot();
      setShot(previous => JSON.stringify(previous) === JSON.stringify(next) ? previous : next);
    };
    update(); const timer = gameTime.setInterval(update, 100);
    return () => { mounted.current = false; gameTime.clearInterval(timer); };
  }, []);
  const copy = async () => {
    const camera = snapshot();
    if (!camera) { setMessage('Map camera unavailable'); return; }
    const payload = JSON.stringify({ dialogue: dialogue(), camera, actors: { hero: { emotion: getActorExpression('hero') ?? 'neutral' } } }, null, 2);
    try {
      await navigator.clipboard.writeText(payload);
      if (mounted.current) { setMessage('Copied camera + dialog'); setFallback(''); }
    } catch {
      if (mounted.current) { setMessage('Select and copy the details below'); setFallback(payload); }
    }
  };
  return <div className="scenario-camera-details" aria-label="Scenario camera details">
    <output aria-label="Live scenario camera" aria-live="off">{shot ? <>
      <span>Camera · {shot.tilted ? 'Immersion' : 'OTT'}</span>
      <span>Target X {shot.x.toFixed(2)} · Y {shot.y.toFixed(2)}</span>
      <span>Zoom {shot.scale.toFixed(3)}×</span>
      <span>Yaw {shot.yaw.toFixed(2)}° · Tilt {(shot.tilted ? shot.pitch : 0).toFixed(2)}°</span>
      <span>Framing {((shot.framing ?? 0) * 100).toFixed(1)}%</span>
    </> : 'Map camera unavailable'}</output>
    <button type="button" onClick={copy} disabled={!shot}>Copy camera + dialog</button>
    {message && <span role="status">{message}</span>}
    {fallback && <textarea aria-label="Camera and dialog details to copy" value={fallback} readOnly onFocus={event => event.currentTarget.select()} />}
  </div>;
}
