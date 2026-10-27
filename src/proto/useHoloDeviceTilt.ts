import { useEffect, useRef } from 'react';
import type { HoloSensorTrace } from './holoDiagnostics';

export type HoloTilt = { x: number; y: number; lift: number };
type OrientationAccess = typeof DeviceOrientationEvent & { requestPermission?: () => Promise<string> };
let permissionRequest: Promise<unknown> | undefined;

/** Safari requires this call during the gesture that opens the card. A denied
 * or unavailable sensor leaves the existing pointer interaction available. */
export function requestHoloDeviceTilt() {
  if (!window.isSecureContext || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const orientation = window.DeviceOrientationEvent as OrientationAccess | undefined;
  if (!orientation?.requestPermission || permissionRequest) return;
  try { permissionRequest = orientation.requestPermission().catch(() => undefined); }
  catch { /* Unsupported or blocked access keeps the static/pointer finish. */ }
}

/** Relative device angles, remapped to the screen rather than the handset axes.
 * Calibrate on opening, screen rotation and resuming a hidden page. */
export function useHoloDeviceTilt(enabled: boolean, calibrationKey: string, onTilt: (tilt: HoloTilt | null) => void,
  onTrace?: (trace: HoloSensorTrace) => void) {
  const callback = useRef(onTilt);
  callback.current = onTilt;
  const trace = useRef(onTrace);
  trace.current = onTrace;
  useEffect(() => {
    let events = 0, calibrations = 0;
    const report = (status: string, target: HoloTilt | null = null) => trace.current?.({ events, calibrations, status, target });
    if (!enabled || !window.isSecureContext || !window.DeviceOrientationEvent) { report('disabled'); return; }
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    let baseline: { beta: number; gamma: number; angle: number } | null = null;
    const reset = (event?: Event) => { baseline = null; callback.current(null); report(`reset: ${event?.type ?? 'cleanup'}`); };
    const orientation = (event: DeviceOrientationEvent) => {
      events++;
      if (media.matches) { report('reduced motion'); return; }
      if (document.hidden) { report('hidden'); return; }
      if (event.beta === null || event.gamma === null || !Number.isFinite(event.beta) || !Number.isFinite(event.gamma)) {
        report('empty reading'); return;
      }
      const angle = window.screen.orientation?.angle
        ?? (window as Window & { orientation?: number }).orientation ?? 0;
      if (!baseline || baseline.angle !== angle) {
        baseline = { beta: event.beta, gamma: event.gamma, angle };
        calibrations++;
      }
      // Wrap beta across +/-180 without a sudden flip; ignore tiny sensor jitter.
      const delta = (value: number, origin: number) => ((value - origin + 540) % 360) - 180;
      const beta = delta(event.beta, baseline.beta), gamma = delta(event.gamma, baseline.gamma);
      const radians = angle * Math.PI / 180, c = Math.cos(radians), s = Math.sin(radians);
      const soften = (value: number) => Math.sign(value) * Math.max(0, Math.abs(value) - .4);
      const horizontal = soften(gamma * c + beta * s), vertical = soften(beta * c - gamma * s);
      const clamp = (value: number) => Math.max(0, Math.min(100, value));
      const target = { x: clamp(50 + horizontal * 1.5), y: clamp(50 + vertical * 1.5),
        lift: Math.min(1, Math.hypot(horizontal, vertical) / 8) };
      callback.current(target);
      report('tracking', target);
    };
    report('listening');
    window.addEventListener('deviceorientation', orientation);
    window.screen.orientation?.addEventListener('change', reset);
    window.addEventListener('orientationchange', reset);
    document.addEventListener('visibilitychange', reset);
    media.addEventListener('change', reset);
    return () => {
      window.removeEventListener('deviceorientation', orientation);
      window.screen.orientation?.removeEventListener('change', reset);
      window.removeEventListener('orientationchange', reset);
      document.removeEventListener('visibilitychange', reset);
      media.removeEventListener('change', reset);
      reset();
    };
  }, [enabled, calibrationKey]);
}
