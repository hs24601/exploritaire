import type { CSSProperties } from 'react';

interface TargetSwirlIndicatorProps {
  className?: string;
  insetPx?: number;
  zIndex?: number;
  ringColor?: string;
  ringGlowColor?: string;
  sparklePrimaryColor?: string;
  sparkleSecondaryColor?: string;
}

export function TargetSwirlIndicator({
  className = '',
  insetPx = 16,
  zIndex = 120,
  ringColor = 'rgba(127, 219, 202, 0.88)',
  ringGlowColor = 'rgba(127, 219, 202, 0.7)',
  sparklePrimaryColor = 'rgba(247,210,75,0.95)',
  sparkleSecondaryColor = 'rgba(127,219,202,0.95)',
}: TargetSwirlIndicatorProps) {
  const wrapperStyle: CSSProperties = {
    inset: `-${insetPx}px`,
    zIndex,
  };

  return (
    <div className={`target-swirl-indicator absolute pointer-events-none ${className}`.trim()} style={wrapperStyle}>
      <div
        className="target-swirl-ring absolute inset-0 rounded-2xl"
        style={{
          border: `2px solid ${ringColor}`,
          boxShadow: `0 0 16px ${ringGlowColor}, inset 0 0 12px rgba(127, 219, 202, 0.28)`,
        }}
      />
      <div
        className="target-swirl-sparkles absolute rounded-full"
        style={{
          backgroundImage: `
            radial-gradient(circle at 12% 42%, ${sparklePrimaryColor} 0 1.6px, transparent 2px),
            radial-gradient(circle at 68% 16%, ${sparkleSecondaryColor} 0 1.6px, transparent 2px),
            radial-gradient(circle at 86% 58%, ${sparklePrimaryColor} 0 1.6px, transparent 2px),
            radial-gradient(circle at 36% 84%, ${sparkleSecondaryColor} 0 1.6px, transparent 2px)
          `,
        }}
      />
    </div>
  );
}

