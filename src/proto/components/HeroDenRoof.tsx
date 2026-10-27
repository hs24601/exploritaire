import { useId } from 'react';
import { useArtStyle } from '../artStyle';
import { scenerySprite } from '../sceneryArt';
import { useTileDiscovery } from './TileDiscoveryArt';

/** Foreground stones share the overhead print's coordinates. Follow the lower
 * outlines of the roof boulders so the hollow can cover Hero's crown without
 * slicing either the rocks or her sleeping sprite along a horizontal seam. */
export function HeroDenRoof({ position, size, tileId }: { position: { x: number; y: number }; size: number; tileId?: string }) {
  const clipId = useId();
  const discovery = useTileDiscovery();
  const artStyle=useArtStyle();
  return <svg data-den-roof="true" aria-hidden="true" viewBox="0 0 128 128"
    style={{ position: 'absolute', left: `calc(50% + ${position.x}px)`, top: `calc(50% + ${position.y}px)`,
      width: size, height: size, imageRendering: artStyle==='paint'?'auto':'pixelated', transform: 'translate(-50%, -50%) rotate(180deg)', pointerEvents: 'none' }}>
    <defs><clipPath id={clipId}>
          <path d={artStyle==='paint'
            ? 'M0 0 H128 V64 L108 61 Q103 59 100 55 Q96 51 90 54 Q85 55 81 51 Q77 50 74 54 Q69 59 64 56 Q61 58 57 55 Q54 51 50 53 Q45 57 40 54 Q35 55 31 61 L24 65 H0 Z'
            : 'M0 0 H128 V68 H108 V64 H101 V60 H94 V56 H88 V60 H82 V61 H77 V58 H72 V54 H68 V57 H64 V61 H59 V59 H55 V55 H51 V58 H47 V63 H41 V61 H36 V57 H31 V62 H24 V68 H0 Z'} />
    </clipPath></defs>
    <image href={scenerySprite(`${import.meta.env.BASE_URL}assets/deprecated/pixel/environment/hero-den-topdown-v3.png`,artStyle)}
      width="128" height="128" clipPath={`url(#${clipId})`} filter={discovery.filter(tileId ?? '')} />
  </svg>;
}
