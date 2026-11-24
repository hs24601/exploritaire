// Legacy asset helpers still accept both styles while their sources are retired.
export type ArtStyle = 'pixel' | 'paint';

/** Gameplay has one art direction; saved legacy preferences cannot select it. */
export function useArtStyle(): ArtStyle {
  return 'paint';
}
