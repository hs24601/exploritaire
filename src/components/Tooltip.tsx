import { memo, useState, useCallback, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';

interface TooltipProps {
  children: React.ReactNode;
  content: React.ReactNode;
  pinnable?: boolean;
  isPinned?: boolean;
  onPinnedChange?: (pinned: boolean) => void;
  disabled?: boolean;
}

export const Tooltip = memo(function Tooltip({
  children,
  content,
  pinnable = false,
  isPinned = false,
  onPinnedChange,
  disabled = false,
}: TooltipProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const triggerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const hoverTimeoutRef = useRef<number | null>(null);

  const isVisible = !disabled && (isPinned || isHovered);

  // Update position when visible
  const updatePosition = useCallback(() => {
    if (!triggerRef.current) return;

    const rect = triggerRef.current.getBoundingClientRect();
    const tooltipWidth = 280; // Estimated width
    const tooltipHeight = 200; // Estimated height
    const padding = 10;

    // Default: position below the trigger
    let x = rect.left + rect.width / 2 - tooltipWidth / 2;
    let y = rect.bottom + padding;

    // Clamp to viewport
    if (x < padding) x = padding;
    if (x + tooltipWidth > window.innerWidth - padding) {
      x = window.innerWidth - tooltipWidth - padding;
    }

    // If tooltip would go below viewport, show above
    if (y + tooltipHeight > window.innerHeight - padding) {
      y = rect.top - tooltipHeight - padding;
    }

    setPosition({ x, y });
  }, []);

  // Handle mouse enter with delay
  const handleMouseEnter = useCallback(() => {
    if (disabled || isPinned) return;

    hoverTimeoutRef.current = window.setTimeout(() => {
      setIsHovered(true);
      updatePosition();
    }, 150);
  }, [disabled, isPinned, updatePosition]);

  // Handle mouse leave
  const handleMouseLeave = useCallback(() => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
    if (!isPinned) {
      setIsHovered(false);
    }
  }, [isPinned]);

  // Handle click to pin/unpin
  const handleClick = useCallback((e: React.MouseEvent) => {
    if (!pinnable) return;
    e.stopPropagation();

    if (isPinned) {
      onPinnedChange?.(false);
      setIsHovered(false);
    } else {
      onPinnedChange?.(true);
      updatePosition();
    }
  }, [pinnable, isPinned, onPinnedChange, updatePosition]);

  // Handle click outside to unpin
  useEffect(() => {
    if (!isPinned) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (
        triggerRef.current &&
        !triggerRef.current.contains(e.target as Node) &&
        tooltipRef.current &&
        !tooltipRef.current.contains(e.target as Node)
      ) {
        onPinnedChange?.(false);
        setIsHovered(false);
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onPinnedChange?.(false);
        setIsHovered(false);
      }
    };

    // Delay adding listeners to avoid immediate close
    const timeout = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscape);
    }, 50);

    return () => {
      clearTimeout(timeout);
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isPinned, onPinnedChange]);

  // Update position when pinned state changes
  useEffect(() => {
    if (isPinned) {
      updatePosition();
    }
  }, [isPinned, updatePosition]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
      }
    };
  }, []);

  return (
    <>
      <div
        ref={triggerRef}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onClick={handleClick}
        className="inline-block"
      >
        {children}
      </div>

      {createPortal(
        <AnimatePresence>
          {isVisible && (
            <motion.div
              ref={tooltipRef}
              initial={{ opacity: 0, scale: 0.95, y: -5 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -5 }}
              transition={{ duration: 0.15 }}
              style={{
                position: 'fixed',
                left: position.x,
                top: position.y,
                zIndex: 9998,
              }}
              className="pointer-events-auto"
              onMouseEnter={() => !isPinned && setIsHovered(true)}
              onMouseLeave={() => !isPinned && setIsHovered(false)}
            >
              <div
                className="bg-game-bg-dark border-2 border-game-purple rounded-lg p-4 min-w-[200px] max-w-[320px]"
                style={{
                  boxShadow: '0 0 20px rgba(139, 92, 246, 0.3), 0 10px 40px rgba(0, 0, 0, 0.5)',
                }}
              >
                {content}
                {pinnable && (
                  <div className="mt-2 text-[10px] text-game-white opacity-40 text-center">
                    {isPinned ? 'Click outside or press ESC to close' : 'Click to keep open'}
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </>
  );
});
