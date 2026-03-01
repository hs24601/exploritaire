import type { CSSProperties } from 'react';

interface FpsBadgeProps {
  fps?: number;
  serverAlive?: boolean;
  onClick?: () => void;
  title?: string;
  className?: string;
  style?: CSSProperties;
}

export function FpsBadge({
  fps = 0,
  serverAlive = true,
  onClick,
  title = 'FPS',
  className = '',
  style,
}: FpsBadgeProps) {
  const label = serverAlive === false
    ? 'server down'
    : `${Math.round(Math.max(0, Math.floor(fps)))}fps`;

  return (
    <button
      type="button"
      onClick={onClick}
      onContextMenu={(event) => event.preventDefault()}
      aria-disabled={!onClick}
      className={`inline-flex items-center justify-center whitespace-nowrap ${className}`.trim()}
      style={{
        width: 'fit-content',
        opacity: onClick ? 1 : 0.8,
        WebkitTouchCallout: 'none',
        ...style,
      }}
      title={title}
    >
      {label}
    </button>
  );
}
