import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { GYRO_LOG_ENABLED, readHoloCardTrace } from '../holoDiagnostics';
import { holoTiltAngles } from '../holoTilt';
export { GYRO_LOG_ENABLED } from '../holoDiagnostics';

/** Temporary phone playtest aid. No listeners or readings without ?gyrolog;
 * all readings stay on this page and are discarded when it closes. */

type SensorPermission = 'granted' | 'denied' | 'prompt' | 'unknown';
type PolicyDocument = Document & {
  permissionsPolicy?: { allowsFeature: (feature: string) => boolean };
  featurePolicy?: { allowsFeature: (feature: string) => boolean };
};

export function GyroDiagnostics() {
  const [report, setReport] = useState<string[]>([]);
  useEffect(() => {
    if (!GYRO_LOG_ENABLED) return;
    let active = true;
    let events = 0, valid = 0;
    let beta: number | null = null, gamma: number | null = null;
    let permissions: SensorPermission[] = ['unknown', 'unknown'];
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const policy = (document as PolicyDocument).permissionsPolicy ?? (document as PolicyDocument).featurePolicy;
    const policyBlocked = ['accelerometer', 'gyroscope'].some(name => policy?.allowsFeature(name) === false);
    const permissionStatuses: PermissionStatus[] = [];
    if (navigator.permissions?.query) {
      Promise.all(['accelerometer', 'gyroscope'].map(async name => {
        try { return await navigator.permissions.query({ name: name as PermissionName }); }
        catch { return null; } // Not every browser implements sensor permission queries.
      })).then(statuses => {
        if (!active) return;
        permissions = statuses.map(status => status?.state ?? 'unknown');
        // Keep each permission's slot even if only one query is supported.
        statuses.forEach((status, index) => {
          if (!status) return;
          permissionStatuses.push(status);
          status.onchange = () => { permissions[index] = status.state; };
        });
      });
    }
    const orientation = (event: DeviceOrientationEvent) => {
      if (document.hidden) return;
      events++;
      if (event.beta === null || event.gamma === null || !Number.isFinite(event.beta) || !Number.isFinite(event.gamma)) return;
      valid++; beta = event.beta; gamma = event.gamma;
    };
    const draw = () => {
      const card = document.querySelector<HTMLElement>('.details-card-viewer .trading-card');
      const trace = readHoloCardTrace(card);
      const degrees = (pose: { x: number; y: number } | null | undefined) => {
        if (!pose) return '—';
        const angles = holoTiltAngles(pose);
        return `${angles.x.toFixed(1)} / ${angles.y.toFixed(1)}`;
      };
      const tilt = card
        ? ['--tilt-x', '--tilt-y'].map(key => {
          const raw = card.style.getPropertyValue(key), value = parseFloat(raw);
          return Number.isFinite(value) ? value.toFixed(1) : raw || 'unset';
        }).join(' / ')
        : 'open Hero’s details';
      const status = !window.isSecureContext ? 'Blocked: this page is not secure.'
        : media.matches ? 'Tilt paused: Reduce Motion is enabled.'
        : policyBlocked ? 'Blocked by the page’s sensor policy.'
        : permissions.includes('denied') ? 'Blocked: allow Motion sensors in Edge.'
        : !window.DeviceOrientationEvent ? 'Orientation API unavailable in this browser.'
        : !valid ? 'No readings yet. Check Edge’s Motion sensors setting.'
        : 'Orientation readings are arriving.';
      setReport([
        status,
        `Secure: ${window.isSecureContext ? 'yes' : 'no'} · Reduce Motion: ${media.matches ? 'on' : 'off'}`,
        `Accelerometer / gyro: ${permissions.join(' / ')}`,
        `Events: ${events} · Valid: ${valid}`,
        `β / γ: ${beta?.toFixed(1) ?? '—'} / ${gamma?.toFixed(1) ?? '—'}`,
        `Card tilt X / Y: ${tilt}`,
        `Card hook: ${trace?.sensor?.status ?? 'no trace'} · Events: ${trace?.sensor?.events ?? 0} · Calibrations: ${trace?.sensor?.calibrations ?? 0}`,
        `Sensor target: ${degrees(trace?.sensor?.target)}`,
        `Input: ${trace?.input ?? '—'} · Spring target: ${degrees(trace?.target)}`,
        `Paints: ${trace?.frames ?? 0} · Frame: ${trace?.queued ? 'queued' : 'idle'}`,
      ]);
    };
    window.addEventListener('deviceorientation', orientation);
    draw();
    const timer = window.setInterval(draw, 300);
    return () => {
      active = false;
      window.clearInterval(timer);
      window.removeEventListener('deviceorientation', orientation);
      permissionStatuses.forEach(status => { status.onchange = null; });
    };
  }, []);
  if (!GYRO_LOG_ENABLED) return null;
  return createPortal(<aside aria-label="Gyro diagnostics" data-gyro-diagnostics="true" style={{
    position: 'fixed', left: 8, bottom: 8, maxWidth: 'calc(100vw - 16px)', boxSizing: 'border-box',
    padding: 8, border: '2px solid #e8d7a6', background: '#081019f5', color: '#fff3cf',
    font: '16px/1.25 monospace', overflowWrap: 'anywhere', zIndex: 60000, pointerEvents: 'none',
  }}><strong>Gyro check · trace 2</strong>{report.map((line, index) => <div key={index}>{line}</div>)}</aside>, document.body);
}
