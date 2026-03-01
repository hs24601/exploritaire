import { useState, type CSSProperties } from 'react';

interface GameButtonProps {
  onClick: () => void;
  children: React.ReactNode;
  color?: 'gold' | 'purple' | 'pink' | 'teal' | 'red';
  size?: 'sm' | 'md';
  className?: string;
  style?: CSSProperties;
  disabled?: boolean;
  title?: string;
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
  red: {
    base: 'text-game-red border-game-red/40',
    hover: 'hover:border-game-red hover:shadow-neon-red',
  },
};

export function GameButton({
  onClick,
  children,
  color = 'gold',
  size = 'md',
  className = '',
  style,
  disabled = false,
  title,
}: GameButtonProps) {
  const [isHovered, setIsHovered] = useState(false);
  const classes = colorClasses[color];

  const sizeClasses = size === 'sm'
    ? 'px-4 py-2 text-xs tracking-wider'
    : 'px-5 py-2.5 text-sm tracking-widest';

  return (
    <button
      onClick={disabled ? undefined : onClick}
      onMouseEnter={() => !disabled && setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      disabled={disabled}
      title={title}
      style={style}
      className={`
        bg-transparent border-2 rounded-md cursor-pointer font-mono inline-flex items-center justify-center w-auto
        transition-all duration-200
        ${sizeClasses}
        ${classes.base}
        ${disabled ? 'opacity-40 cursor-not-allowed border-white/10 text-white/40' : classes.hover}
        ${isHovered && !disabled ? 'shadow-lg' : ''}
        ${className}
      `}
    >
      {children}
    </button>
  );
}
