import { forwardRef } from 'react';
import type { ReactNode, CSSProperties } from 'react';
import { motion } from 'framer-motion';
import type { MotionProps } from 'framer-motion';
import { GAME_BORDER_WIDTH } from '../../utils/styles';

interface CardFrameProps extends MotionProps {
  size: { width: number; height: number };
  borderColor: string;
  boxShadow?: string;
  isDragging?: boolean;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
  onMouseDown?: (e: React.MouseEvent) => void;
  onTouchStart?: (e: React.TouchEvent) => void;
  onPointerDown?: (e: React.PointerEvent) => void;
  onClick?: () => void;
  dataAttributes?: Record<string, string | number | boolean | undefined>;
  backgroundColor?: string;
}

export const CardFrame = forwardRef<HTMLDivElement, CardFrameProps>(function CardFrame(
  {
    size,
    borderColor,
    boxShadow,
    isDragging,
    className,
    style,
    children,
    onMouseDown,
    onTouchStart,
    onPointerDown,
    onClick,
    dataAttributes,
    backgroundColor,
    ...motionProps
  },
  ref
) {
  const baseStyle: CSSProperties = {
    width: size.width,
    height: size.height,
    minWidth: size.width,
    minHeight: size.height,
    maxWidth: size.width,
    maxHeight: size.height,
    borderColor,
    boxShadow,
    opacity: isDragging ? 0 : 1,
    cursor: onPointerDown || onMouseDown ? 'grab' : onClick ? 'pointer' : 'default',
    touchAction: onPointerDown || onTouchStart ? 'none' : 'auto',
    transform: 'translateZ(0) scale(1.0001)',
    backfaceVisibility: 'hidden',
    WebkitFontSmoothing: 'subpixel-antialiased',
    textRendering: 'geometricPrecision',
    borderWidth: style?.borderWidth ?? GAME_BORDER_WIDTH,
    boxSizing: 'border-box',
    transformStyle: 'preserve-3d',
    backgroundColor,
    ...style,
  };
  const hasBackground = Boolean(backgroundColor);

  return (
    <motion.div
      ref={ref}
      data-card-face
      onMouseDown={onMouseDown}
      onTouchStart={onTouchStart}
      onPointerDown={onPointerDown}
      onClick={onClick}
      className={`rounded-lg border-solid ${hasBackground ? '' : 'bg-game-bg-dark'} transition-[border-color,box-shadow,opacity] select-none relative${className ? ` ${className}` : ''}`}
      style={baseStyle}
      {...dataAttributes}
      {...motionProps}
    >
      {children}
    </motion.div>
  );
});
