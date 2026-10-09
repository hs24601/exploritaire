import React from 'react';

/** Upright lettering on the camera-facing arc of a circular token base. */
export function ActorBaseName({ name, position, diameter, screenFacing = false }: { name: string; position: { x: number; y: number }; diameter: number; screenFacing?: boolean }) {
  const letters = Array.from(name);
  const radius = diameter / 2 + 2;
  // Keep a compact word with a small gap between glyphs, independent of
  // the visible front rim's width. Angles stay symmetric about the camera.
  const spacing = 9.2 / radius;
  return <div aria-hidden="true" data-actor-base-name={name} className={`proto-actor-base-name${screenFacing ? ' proto-actor-base-name--screen' : ''}`}
    style={{ left: `calc(50% + ${position.x}px)`, top: `calc(50% + ${position.y}px)` }}>
    {letters.map((letter, index) => {
      const angle = (index - (letters.length - 1) / 2) * spacing;
      return <span key={index} className="proto-actor-base-name__letter" style={{
        transform: screenFacing
          ? `translate3d(${Math.sin(angle) * radius}px,${(Math.cos(angle) - 1) * radius * .3}px,2px) rotateZ(${-angle * .3}rad) scale(0.1666667) translate(-50%,-100%)`
          : `translate3d(${Math.sin(angle) * radius}px,${Math.cos(angle) * radius}px,2px) rotateZ(${-angle}rad) rotateX(-90deg) scale(0.1666667) translate(-50%,-100%)`,
      }}>{letter === ' ' ? '\u00a0' : letter}</span>;
    })}
  </div>;
}
