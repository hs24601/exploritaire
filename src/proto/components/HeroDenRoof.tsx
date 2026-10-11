import { useId } from 'react';

/** Foreground stones share the overhead print's coordinates. Follow the lower
 * outlines of the roof boulders so the hollow can cover Hero's crown without
 * slicing either the rocks or her sleeping sprite along a horizontal seam. */
export function HeroDenRoof({ position, size }: { position: { x: number; y: number }; size: number }) {
  const clipId = useId();
  return <svg data-den-roof="true" aria-hidden="true" viewBox="0 0 128 128"
    style={{ position: 'absolute', left: `calc(50% + ${position.x}px)`, top: `calc(50% + ${position.y}px)`,
      width: size, height: size, imageRendering: 'pixelated', transform: 'translate(-50%, -50%) rotate(180deg)', pointerEvents: 'none' }}>
    <defs><clipPath id={clipId}>
          <path d="M0 0 H128 V68 H108 V64 H101 V60 H94 V56 H88 V60 H82 V61 H77 V58 H72 V54 H68 V57 H64 V61 H59 V59 H55 V55 H51 V58 H47 V63 H41 V61 H36 V57 H31 V62 H24 V68 H0 Z" />
    </clipPath></defs>
    <image href={`${import.meta.env.BASE_URL}assets/biomes/hero-den-topdown-v3.png`}
      width="128" height="128" clipPath={`url(#${clipId})`} />
  </svg>;
}
