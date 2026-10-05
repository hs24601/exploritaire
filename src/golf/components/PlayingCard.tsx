import React from 'react';
import './golf-components.css';

export type PlayingCardProps = Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'ref'> & {
  /** Callback ref keeps the primitive compatible with animation/transport systems. */
  cardRef?: (node: HTMLButtonElement | null) => void;
};

/**
 * Shared fixed-ratio card surface. Game-specific card faces belong in children;
 * dimensions and the semantic card component stay consistent across scenes.
 */
export const PlayingCard = ({ cardRef, className = '', children, ...props }: PlayingCardProps) => (
  <button ref={cardRef} type="button" {...props} data-component="playing-card" className={`playing-card ${className}`}>
    {children}
  </button>
);
