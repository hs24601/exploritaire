import { useId } from 'react';

/** Foreground stones share the overhead print's coordinates. Follow the lower
 * outlines of the roof boulders so the hollow can cover Hero's crown without
 * slicing either the rocks or her sleeping sprite along a horizontal seam. */
export function HeroDenRoof({ position, size }: { position: { x: number; y: number }; size: number }) {
  const clipId = useId();
  return <svg data-den-roof="true" aria-hidden="true" viewBox="0 0 128 115"
    style={{ position: 'absolute', left: `calc(50% + ${position.x}px)`, top: `calc(50% + ${position.y}px)`,
      width: size, height: size, imageRendering: 'pixelated', transform: 'translate(-50%, -50%)', pointerEvents: 'none' }}>
    <defs><clipPath id={clipId}>
      <path d="M0 0 H128 V65 H101 V64 H98 V63 H95 V61 H93 V58 H91 V57 H89 V58 H84 V59 H80 V58 H77 V57 H73 V56 H69 V55 H66 V54 H62 V55 H60 V57 H59 V59 H58 V61 H55 V62 H49 V63 H43 V62 H39 V61 H36 V60 H34 V62 H30 V65 H0 Z" />
    </clipPath></defs>
    <image href={`${import.meta.env.BASE_URL}assets/biomes/hero-den-topdown-v2.png`}
      width="128" height="115" clipPath={`url(#${clipId})`} />
  </svg>;
}
