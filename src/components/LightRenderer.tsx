import { memo, useEffect, useState } from 'react';
import type { LightSource } from '../engine/lighting';

interface LightRendererProps {
  lights: LightSource[];
  ambientLight: number;
  ambientColor: string;
  className?: string;
}

/**
 * Renders 2D lighting effects as overlays
 */
export const LightRenderer = memo(function LightRenderer({
  lights,
  ambientLight,
  ambientColor,
  className = '',
}: LightRendererProps) {
  const [time, setTime] = useState(0);

  // Animation loop for flickering
  useEffect(() => {
    let animationId: number;
    let lastTime = performance.now();

    const animate = (currentTime: number) => {
      const delta = (currentTime - lastTime) / 1000;
      lastTime = currentTime;
      setTime((t) => t + delta);
      animationId = requestAnimationFrame(animate);
    };

    animationId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationId);
  }, []);

  return (
    <div className={`pointer-events-none ${className}`}>
      {/* Ambient darkness overlay */}
      <div
        className="absolute inset-0"
        style={{
          backgroundColor: ambientColor,
          opacity: 1 - ambientLight,
          mixBlendMode: 'multiply',
        }}
      />

      {/* Light sources */}
      {lights.map((light) => {
        let intensity = light.intensity;

        // Apply flicker
        if (light.flicker?.enabled) {
          const flickerOffset = Math.sin(time * light.flicker.speed * 10) * light.flicker.amount;
          intensity *= (1 + flickerOffset);
        }

        return (
          <div
            key={light.id}
            className="absolute"
            style={{
              left: light.x,
              top: light.y,
              width: light.radius * 2,
              height: light.radius * 2,
              transform: 'translate(-50%, -50%)',
              background: `radial-gradient(circle, ${light.color}${Math.round(intensity * 80).toString(16).padStart(2, '0')} 0%, ${light.color}00 70%)`,
              mixBlendMode: 'screen',
            }}
          />
        );
      })}
    </div>
  );
});

/**
 * Simple ambient vignette effect
 */
export const AmbientVignette = memo(function AmbientVignette({
  intensity = 0.5,
  color = '#000000',
}: {
  intensity?: number;
  color?: string;
}) {
  return (
    <div
      className="absolute inset-0 pointer-events-none"
      style={{
        background: `radial-gradient(ellipse at center, transparent 0%, transparent 40%, ${color}${Math.round(intensity * 255).toString(16).padStart(2, '0')} 100%)`,
      }}
    />
  );
});
