import { useState } from 'react';

interface GameButtonProps {
  onClick: () => void;
  children: React.ReactNode;
  color?: 'gold' | 'purple' | 'pink' | 'teal';
  size?: 'sm' | 'md';
}

const colorClasses = {
  gold: {
    base: 'text-game-gold border-game-gold/40',
    hover: 'hover:border-game-gold hover:shadow-neon-gold',
  },
  purple: {
    base: 'text-game-purple border-game-purple/40',
    hover: 'hover:border-game-purple hover:shadow-neon-purple',
  },
  pink: {
    base: 'text-game-pink border-game-pink/40',
    hover: 'hover:border-game-pink hover:shadow-neon-pink',
  },
  teal: {
    base: 'text-game-teal border-game-teal/40',
    hover: 'hover:border-game-teal hover:shadow-neon-teal',
  },
};

export function GameButton({
  onClick,
  children,
  color = 'gold',
  size = 'md',
}: GameButtonProps) {
  const [isHovered, setIsHovered] = useState(false);
  const classes = colorClasses[color];

  const sizeClasses = size === 'sm'
    ? 'px-4 py-2 text-xs tracking-wider'
    : 'px-5 py-2.5 text-sm tracking-widest';

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`
        bg-transparent border-2 rounded-md cursor-pointer font-mono
        transition-all duration-200
        ${sizeClasses}
        ${classes.base}
        ${classes.hover}
        ${isHovered ? 'shadow-lg' : ''}
      `}
    >
      {children}
    </button>
  );
}
