export type TableLight = { id: string; position: { x: number; y: number }; radius?: number; height?: number; strength?: number };
export const getTableLighting = (hours: number) => {
  const hour = ((hours % 24) + 24) % 24;
  const daylight = Math.max(0, Math.sin((hour - 6) * Math.PI / 12));
  const night = daylight === 0;
  const angle = (hour - (night ? 18 : 6)) * Math.PI / 12;
  return {
    hour, daylight, phase: daylight > 0.65 ? 'Day' : daylight > 0 ? 'Twilight' : 'Night',
    source: { x: -Math.cos(angle) * 480, y: -Math.sin(angle) * 320 },
    altitude: 65 + (night ? Math.abs(Math.sin(angle)) * 150 : daylight * 430),
    darkness: 0.08 + (1 - daylight) * 0.48,
  };
};

/** 2.5D projection onto a 2D table: elevated pieces cast away from each light.
 * Clamp grazing-angle shadows so they remain useful within the board viewport. */
export const tableObjectShadow = (hours: number, position: { x: number; y: number }, elevation = 8, lights: readonly TableLight[] = []) => {
  const frame = getTableLighting(hours);
  const project = (source: { x: number; y: number }, height: number, opacity: number) => {
    const ratio = elevation / Math.max(20, height - elevation);
    const x = Math.max(-55, Math.min(55, (position.x - source.x) * ratio));
    const y = Math.max(-55, Math.min(55, (position.y - source.y) * ratio));
    const blur = 3 + Math.hypot(x, y) * 0.18;
    return `${x.toFixed(2)}px ${y.toFixed(2)}px ${blur.toFixed(2)}px rgba(0,0,0,${opacity.toFixed(3)})`;
  };
  const shadows = [
    'inset 0 1px 1px rgba(255,255,255,0.28)',
    'inset 0 -3px 1px rgba(0,0,0,0.3)',
    '0 3px 1px rgba(0,0,0,0.45)',
    project(frame.source, frame.altitude, 0.22 + frame.daylight * 0.2),
  ];
  for (const light of lights) {
    const distance = Math.hypot(position.x - light.position.x, position.y - light.position.y);
    const falloff = Math.max(0, 1 - distance / ((light.radius ?? 5) * 48));
    if (falloff > 0) shadows.push(project(light.position, light.height ?? 100, falloff * (light.strength ?? 0.55) * (1 - frame.daylight * 0.8)));
  }
  return shadows.join(', ');
};
