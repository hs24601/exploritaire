import { memo } from 'react';
import type { CSSProperties } from 'react';
import type { WatercolorConfig } from '../types';
import { WatercolorSplotch } from '../WatercolorSplotch';
import { useWatercolorEnabled } from '../useWatercolorEnabled';

interface WatercolorOverlayProps {
  config: WatercolorConfig;
  className?: string;
  style?: CSSProperties;
}

export const WatercolorOverlaySvg = memo(function WatercolorOverlaySvg({
  config,
  className,
  style,
}: WatercolorOverlayProps) {
  const watercolorEnabled = useWatercolorEnabled();
  if (!watercolorEnabled) return null;
  const { splotches, grain } = config;

  // Legacy SVG overlay (archived for reference; no longer used by default).
  const cw = 100;
  const ch = 100;

  return (
    <div
      className={className}
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        overflow: 'hidden',
        zIndex: 0,
        transform: config.overallScale === 1 ? undefined : `scale(${config.overallScale})`,
        transformOrigin: 'center center',
        ...style,
      }}
    >
      {splotches.map((splotch, i) => (
        <WatercolorSplotch
          key={i}
          config={splotch}
          index={i}
          containerWidth={cw}
          containerHeight={ch}
        />
      ))}

      {grain.enabled && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='${grain.frequency}' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='120' height='120' filter='url(%23n)' opacity='0.12'/%3E%3C/svg%3E")`,
            mixBlendMode: grain.blendMode as React.CSSProperties['mixBlendMode'],
            opacity: grain.intensity,
          }}
        />
      )}
    </div>
  );
});
