export type AtmosphereEffectId =
  | 'none'
  | 'lost_in_stars'
  | 'aurora_forest'
  | 'black_hole'
  | 'drifting_purple'
  | 'smoke_green'
  | 'inferno_maelstrom';

export type AtmospherePreset = {
  id: AtmosphereEffectId;
  label: string;
  category: 'atmosphere';
};

export const ATMOSPHERE_PRESETS: AtmospherePreset[] = [
  { id: 'none', label: 'None', category: 'atmosphere' },
  { id: 'lost_in_stars', label: 'lost_in_stars', category: 'atmosphere' },
  { id: 'aurora_forest', label: 'aurora_forest', category: 'atmosphere' },
  { id: 'black_hole', label: 'black_hole', category: 'atmosphere' },
  { id: 'drifting_purple', label: 'drifting_purple', category: 'atmosphere' },
  { id: 'smoke_green', label: 'smoke_green', category: 'atmosphere' },
  { id: 'inferno_maelstrom', label: 'inferno_maelstrom', category: 'atmosphere' },
];
