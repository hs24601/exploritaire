export type AtmosphereEffectId =
  | 'none'
  | 'aurora_forest'
  | 'black_hole'
  | 'brownian_motion'
  | 'chaos_split'
  | 'comet_rain'
  | 'cosmic_lint'
  | 'drifting_purple'
  | 'einstein_rosen'
  | 'electric_skies'
  | 'falling_snow'
  | 'florpus_forest'
  | 'gravity_split'
  | 'inferno_maelstrom'
  | 'lost_in_stars'
  | 'ocean_solar_cycle'
  | 'raging_waves'
  | 'rarity_squares_tunnel'
  | 'sacred_realm'
  | 'solaris_prime'
  | 'sakura_blossoms'
  | 'smoke_green'
  | 'stars_twinkle_performant';

export type AtmospherePreset = {
  id: AtmosphereEffectId;
  label: string;
  category: 'atmosphere';
};

export const ATMOSPHERE_PRESETS: AtmospherePreset[] = [
  { id: 'none', label: 'None', category: 'atmosphere' },
  { id: 'aurora_forest', label: 'aurora_forest', category: 'atmosphere' },
  { id: 'black_hole', label: 'black_hole', category: 'atmosphere' },
  { id: 'brownian_motion', label: 'brownian_motion', category: 'atmosphere' },
  { id: 'chaos_split', label: 'chaos_split', category: 'atmosphere' },
  { id: 'comet_rain', label: 'comet_rain', category: 'atmosphere' },
  { id: 'cosmic_lint', label: 'cosmic_lint', category: 'atmosphere' },
  { id: 'drifting_purple', label: 'drifting_purple', category: 'atmosphere' },
  { id: 'einstein_rosen', label: 'einstein_rosen', category: 'atmosphere' },
  { id: 'electric_skies', label: 'electric_skies', category: 'atmosphere' },
  { id: 'falling_snow', label: 'falling_snow', category: 'atmosphere' },
  { id: 'florpus_forest', label: 'florpus_forest', category: 'atmosphere' },
  { id: 'gravity_split', label: 'gravity_split', category: 'atmosphere' },
  { id: 'inferno_maelstrom', label: 'inferno_maelstrom', category: 'atmosphere' },
  { id: 'lost_in_stars', label: 'lost_in_stars', category: 'atmosphere' },
  { id: 'ocean_solar_cycle', label: 'ocean_solar_cycle', category: 'atmosphere' },
  { id: 'raging_waves', label: 'raging_waves', category: 'atmosphere' },
  { id: 'rarity_squares_tunnel', label: 'rarity_squares_tunnel', category: 'atmosphere' },
  { id: 'sacred_realm', label: 'sacred_realm', category: 'atmosphere' },
  { id: 'solaris_prime', label: 'solaris_prime', category: 'atmosphere' },
  { id: 'sakura_blossoms', label: 'sakura_blossoms', category: 'atmosphere' },
  { id: 'smoke_green', label: 'smoke_green', category: 'atmosphere' },
  { id: 'stars_twinkle_performant', label: 'stars_twinkle_performant', category: 'atmosphere' },
];
