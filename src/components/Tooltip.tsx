import { memo, useState, useCallback, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Z_INDEX } from '../engine/constants';

interface TooltipProgressRing {
  remainingMs: number;
  totalMs: number;
  color?: string;
  size?: number;
}

interface TooltipProps {
  children: React.ReactNode;
  content: React.ReactNode;
  pinnable?: boolean;
  isPinned?: boolean;
  onPinnedChange?: (pinned: boolean) => void;
  disabled?: boolean;
  delayMs?: number;
  progressRing?: TooltipProgressRing;
  hoverEnabled?: boolean;
  clickToPin?: boolean;
  inlineTrigger?: boolean;
}

export const Tooltip = memo(function Tooltip({
  children,
  content,
  pinnable = false,
  isPinned,
  onPinnedChange,
  disabled = false,
  delayMs = 150,
  progressRing,
  hoverEnabled = true,
  clickToPin = true,
  inlineTrigger = false,
}: TooltipProps) {
  const [localPinned, setLocalPinned] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [progressNow, setProgressNow] = useState(0);
  const triggerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const hoverTimeoutRef = useRef<number | null>(null);
  const progressStartRef = useRef(0);
  const tooltipIdRef = useRef(`tooltip-${Math.random().toString(36).slice(2)}`);

  const pinned = isPinned ?? localPinned;
  const previousPinnedRef = useRef(pinned);
  const isVisible = !disabled && (pinned || isHovered);
  const hasProgressRing = !!progressRing && progressRing.totalMs > 0 && progressRing.remainingMs > 0;

  // Update position when visible
  const updatePosition = useCallback(() => {
    if (!triggerRef.current) return;

    const rect = triggerRef.current.getBoundingClientRect();
    const padding = 10;
    const measured = tooltipRef.current?.getBoundingClientRect();
    const tooltipWidth = measured?.width ?? 280;
    const tooltipHeight = measured?.height ?? 200;

    // Default: position below the trigger
    let x = rect.left + rect.width / 2 - tooltipWidth / 2;
    let y = rect.bottom + padding;

    // If tooltip would go below viewport, show above
    if (y + tooltipHeight > window.innerHeight - padding) {
      y = rect.top - tooltipHeight - padding;
    }

    // Clamp to viewport
    x = Math.min(Math.max(x, padding), window.innerWidth - tooltipWidth - padding);
    y = Math.min(Math.max(y, padding), window.innerHeight - tooltipHeight - padding);

    setPosition({ x, y });
  }, []);

  // Handle mouse enter with delay
  const handleMouseEnter = useCallback(() => {
    if (disabled || pinned || !hoverEnabled) return;

    hoverTimeoutRef.current = window.setTimeout(() => {
      window.dispatchEvent(
        new CustomEvent('codex-tooltip-open', {
          detail: { sourceId: tooltipIdRef.current },
        })
      );
      setIsHovered(true);
      requestAnimationFrame(updatePosition);
    }, delayMs);
  }, [delayMs, disabled, hoverEnabled, pinned, updatePosition]);

  // Handle mouse leave
  const handleMouseLeave = useCallback(() => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
    if (!pinned) {
      setIsHovered(false);
    }
  }, [pinned]);

  // Handle click to pin/unpin
  const handleClick = useCallback((e: React.MouseEvent) => {
    if (!pinnable || !clickToPin) return;
    e.stopPropagation();

    if (pinned) {
      onPinnedChange?.(false);
      setLocalPinned(false);
      setIsHovered(false);
    } else {
      window.dispatchEvent(
        new CustomEvent('codex-tooltip-open', {
          detail: { sourceId: tooltipIdRef.current },
        })
      );
      onPinnedChange?.(true);
      setLocalPinned(true);
      updatePosition();
    }
  }, [clickToPin, pinnable, pinned, onPinnedChange, updatePosition]);

  useEffect(() => {
    const handleAnotherTooltipOpen = (event: Event) => {
      const sourceId = (event as CustomEvent<{ sourceId?: string }>).detail?.sourceId;
      if (!sourceId || sourceId === tooltipIdRef.current) return;
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
        hoverTimeoutRef.current = null;
      }
      if (pinned) {
        onPinnedChange?.(false);
        setLocalPinned(false);
      }
      setIsHovered(false);
    };

    window.addEventListener('codex-tooltip-open', handleAnotherTooltipOpen as EventListener);
    return () => {
      window.removeEventListener('codex-tooltip-open', handleAnotherTooltipOpen as EventListener);
    };
  }, [onPinnedChange, pinned]);

  useEffect(() => {
    const wasPinned = previousPinnedRef.current;
    previousPinnedRef.current = pinned;
    if (!pinned || wasPinned) return;

    window.dispatchEvent(
      new CustomEvent('codex-tooltip-open', {
        detail: { sourceId: tooltipIdRef.current },
      })
    );
    requestAnimationFrame(updatePosition);
  }, [pinned, updatePosition]);

  // Handle click outside to unpin
  useEffect(() => {
    if (!pinned) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (
        triggerRef.current &&
        !triggerRef.current.contains(e.target as Node) &&
        tooltipRef.current &&
        !tooltipRef.current.contains(e.target as Node)
      ) {
        onPinnedChange?.(false);
        setLocalPinned(false);
        setIsHovered(false);
      }
    };

    // Delay adding listeners to avoid immediate close
    const timeout = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 50);

    return () => {
      clearTimeout(timeout);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [pinned, onPinnedChange]);

  // Update position when pinned state changes
  useEffect(() => {
    if (!isVisible) return;
    const raf = requestAnimationFrame(updatePosition);
    const handleResize = () => updatePosition();
    window.addEventListener('resize', handleResize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', handleResize);
    };
  }, [isVisible, updatePosition]);

  useEffect(() => {
    if (!isVisible) return;
    progressStartRef.current = performance.now();
    setProgressNow(progressStartRef.current);
  }, [isVisible, progressRing?.remainingMs, progressRing?.totalMs]);

  useEffect(() => {
    if (!isVisible || !hasProgressRing) return;
    let rafId = 0;
    const tick = () => {
      setProgressNow(performance.now());
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [isVisible, hasProgressRing]);

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
        onMouseEnter={hoverEnabled ? handleMouseEnter : undefined}
        onMouseLeave={hoverEnabled ? handleMouseLeave : undefined}
        onClick={handleClick}
        className={inlineTrigger ? 'inline-flex align-baseline' : 'inline-block h-full w-full'}
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
                // Ensure combat status tooltips float above all HUD/combat layers.
                zIndex: Math.max(Z_INDEX.FLYOUT, 11020),
              }}
              className="pointer-events-auto"
              onMouseEnter={() => !isPinned && setIsHovered(true)}
              onMouseLeave={() => !isPinned && setIsHovered(false)}
            >
              {(() => {
                if (!hasProgressRing || !progressRing) return null;
                const elapsedMs = Math.max(0, progressNow - progressStartRef.current);
                const remainingMs = Math.max(0, progressRing.remainingMs - elapsedMs);
                const totalMs = Math.max(1, progressRing.totalMs);
                const ratio = Math.max(0, Math.min(1, remainingMs / totalMs));
                const size = Math.max(28, Math.round(progressRing.size ?? 42));
                const stroke = Math.max(2, Math.round(size * 0.1));
                const radius = (size - stroke) / 2;
                const circumference = 2 * Math.PI * radius;
                const strokeDashoffset = circumference * (1 - ratio);
                const ringColor = progressRing.color ?? '#7fdbca';
                return (
                  <div
                    className="pointer-events-none absolute"
                    style={{
                      top: Math.round(-size * 0.45),
                      right: Math.round(-size * 0.45),
                      width: size,
                      height: size,
                      zIndex: 2,
                    }}
                    aria-hidden
                  >
                    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
                      <circle
                        cx={size / 2}
                        cy={size / 2}
                        r={radius}
                        fill="rgba(5, 8, 14, 0.76)"
                        stroke="rgba(255,255,255,0.16)"
                        strokeWidth={stroke}
                      />
                      <circle
                        cx={size / 2}
                        cy={size / 2}
                        r={radius}
                        fill="none"
                        stroke={ringColor}
                        strokeWidth={stroke}
                        strokeLinecap="round"
                        strokeDasharray={circumference}
                        strokeDashoffset={strokeDashoffset}
                        transform={`rotate(-90 ${size / 2} ${size / 2})`}
                        style={{ filter: `drop-shadow(0 0 6px ${ringColor})` }}
                      />
                    </svg>
                  </div>
                );
              })()}
              <div className="tooltip-surface relative max-w-[320px] overflow-visible leading-[1.4] text-white">
                <div className="tooltip-content">{content}</div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </>
  );
});
