import type { ArtStyle } from './artStyle';

/** Static actor poses use the same live style selection as the animated rig.
 * Unconverted companions retain their authored artwork. */
export function actorSprite(src: string | undefined, style: ArtStyle): string | undefined {
  if (!src || style !== 'paint') return src;
  return src.replace(/assets\/actors\/(hero-sleeping(?:-topdown)?)\.png$/, 'assets/actors/watercolor-v1/$1-body-v3.png');
}

export const isPaintedActorSprite = (src: string) => src.includes('/actors/watercolor-v1/');
