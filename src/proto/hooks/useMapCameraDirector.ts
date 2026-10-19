import { gameTime } from '../../gameTime';
import { useEffect, useRef, type RefObject } from 'react';
import type { CameraState } from '../../hooks/useCameraControls';
import { sampleCameraSequence, shotFromCamera, validStep, type CameraShot, type CameraStep } from '../cameraChoreography';
import { getCameraPlayback, registerCameraPort, setCameraPlayback } from '../cameraDirector';
import { isTextEditingTarget } from '../keyboardInput';
type Options = { viewport: RefObject<HTMLDivElement | null>; getCamera: () => CameraState; setFrame: (camera: CameraState, sync?: boolean) => void; sync: () => void; tilted: boolean; pitch: (camera: CameraState) => number; setTilted?: (value: boolean) => void; begin: () => void; paused?: boolean; enabled?: boolean };
export function useMapCameraDirector(options: Options) {
  const live = useRef(options); live.current = options;
  useEffect(() => {
    if (options.enabled === false) return;
    let frame = 0, elapsed = 0, last = 0, playing = false, paused = false, restoreOnEnd = false;
    let steps: CameraStep[] = [], initial: CameraShot;
    let drawnMode = live.current.tilted, shotIndex = -1;
    const capture = () => { const camera = live.current.getCamera(); return { ...shotFromCamera(camera, live.current.tilted, live.current.pitch(camera)), ...(camera.aimY !== undefined ? { framing: camera.aimY / Math.max(1, live.current.viewport.current?.clientHeight ?? 1) } : {}) }; };
    const draw = (shot: CameraShot) => {
      if (drawnMode !== shot.tilted) { drawnMode = shot.tilted; live.current.setTilted?.(shot.tilted); }
      live.current.setFrame({ x: -shot.x * shot.scale, y: -shot.y * shot.scale, scale: shot.scale, yaw: shot.yaw, pitch: shot.pitch, ...(shot.framing !== undefined ? { aimY: shot.framing * (live.current.viewport.current?.clientHeight ?? 1) } : {}) });
    };
    const stop = (restore = false) => {
      gameTime.cancelAnimationFrame(frame);
      if (playing && restore) draw(initial);
      playing = false; live.current.sync();
      setCameraPlayback({ playing: false, moving: false, paused: false, tileLabelIds: [] });
    };
    const tick = (now: number) => {
      if (!playing) return;
      const suspended = paused || document.hidden || live.current.paused;
      if (!suspended) elapsed += Math.max(0, Math.min(100, now - last));
      last = now;
      if (!suspended) {
        const result = sampleCameraSequence(steps, initial, elapsed, matchMedia('(prefers-reduced-motion: reduce)').matches);
        draw(result.shot);
        if (getCameraPlayback().moving !== result.moving) setCameraPlayback({ moving: result.moving });
        if (result.index !== shotIndex) { shotIndex = result.index; setCameraPlayback({ shot: shotIndex }); }
        if (result.done) { stop(restoreOnEnd); return; }
      }
      frame = gameTime.requestAnimationFrame(tick);
    };
    const unregister = registerCameraPort({ capture, stop, pause: () => { paused = !paused; setCameraPlayback({ paused }); }, play: (value, restore, name) => {
      if (!value.length || !value.every(validStep)) throw new Error('The camera sequence contains an invalid shot.');
      stop(); initial = capture(); live.current.begin(); drawnMode = live.current.tilted;
      steps = value; elapsed = 0; last = gameTime.now(); paused = false; playing = true; restoreOnEnd = restore; shotIndex = -1;
      setCameraPlayback({ playing: true, moving: true, paused: false, name, shot: 0 });
      frame = gameTime.requestAnimationFrame(tick);
    } });
    const viewport = live.current.viewport.current;
    const pointer = (event: PointerEvent) => { if ((event.target as Element)?.closest('[data-camera-ignore], [data-world-card], input, select, textarea')) return; if (event.button === 0 && (event.target as Element)?.closest('button:not([data-biome-id])')) return; if (playing) stop(); };
    const wheel = () => { if (playing) stop(); };
    const key = (event: KeyboardEvent) => {
      if (event.isComposing || event.ctrlKey || event.metaKey || event.altKey || isTextEditingTarget(event.target)) return;
      if (playing && ['Escape', 'KeyO', 'KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyQ', 'KeyE', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.code)) stop();
    };
    const visibility = () => { last = gameTime.now(); };
    document.addEventListener('visibilitychange', visibility);
    const toolbar = viewport?.closest('.proto-map')?.querySelector('.proto-map-toolbar');
    viewport?.addEventListener('pointerdown', pointer, true); viewport?.addEventListener('wheel', wheel, true); toolbar?.addEventListener('pointerdown', wheel, true); window.addEventListener('keydown', key, true);
    return () => { document.removeEventListener('visibilitychange', visibility); stop(); unregister(); viewport?.removeEventListener('pointerdown', pointer, true); viewport?.removeEventListener('wheel', wheel, true); toolbar?.removeEventListener('pointerdown', wheel, true); window.removeEventListener('keydown', key, true); };
  }, [options.enabled]);
}
