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
  const LOCKED_FPS_WIDTH_PX = 82;
  const label = serverAlive === false
    ? 'server down'
    : `${Math.round(Math.max(0, Math.floor(fps)))}fps`;
  const lockWidth = serverAlive !== false;

  return (
    <button
      type="button"
      onClick={onClick}
      onContextMenu={(event) => event.preventDefault()}
      aria-disabled={!onClick}
      className={`inline-flex items-center justify-center whitespace-nowrap ${className}`.trim()}
      style={{
        width: lockWidth ? `${LOCKED_FPS_WIDTH_PX}px` : 'fit-content',
        minWidth: lockWidth ? `${LOCKED_FPS_WIDTH_PX}px` : undefined,
        maxWidth: lockWidth ? `${LOCKED_FPS_WIDTH_PX}px` : undefined,
        flexShrink: 0,
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
