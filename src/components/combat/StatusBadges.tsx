import { memo } from 'react';
import { Tooltip } from '../Tooltip';

export type StatusBadgeKind = 'buff' | 'debuff' | 'neutral';

export interface StatusBadgeData {
  id: string;
  kind: StatusBadgeKind;
  label: string;
  detail?: string;
  sourceDescription?: string;
  remainingMs?: number;
  totalMs?: number;
}

interface StatusBadgesProps {
  statuses: StatusBadgeData[];
  compact?: boolean;
  className?: string;
  tooltipDisabled?: boolean;
}

const STATUS_THEME: Record<StatusBadgeKind, {
  text: string;
  border: string;
  background: string;
  fill: string;
  glow: string;
}> = {
  buff: {
    text: '#7fdbca',
    border: 'rgba(127, 219, 202, 0.7)',
    background: 'rgba(10, 34, 30, 0.78)',
    fill: 'rgba(127, 219, 202, 0.3)',
    glow: '0 0 8px rgba(127, 219, 202, 0.3)',
  },
  debuff: {
    text: '#ff8d8d',
    border: 'rgba(255, 141, 141, 0.74)',
    background: 'rgba(46, 12, 12, 0.8)',
    fill: 'rgba(255, 141, 141, 0.34)',
    glow: '0 0 8px rgba(255, 141, 141, 0.3)',
  },
  neutral: {
    text: '#c4cbe0',
    border: 'rgba(196, 203, 224, 0.56)',
    background: 'rgba(14, 18, 28, 0.78)',
    fill: 'rgba(196, 203, 224, 0.25)',
    glow: '0 0 8px rgba(196, 203, 224, 0.2)',
  },
};

function formatStatusRemaining(remainingMs?: number): string {
  if (typeof remainingMs !== 'number') return '';
  const seconds = Math.max(0, remainingMs) / 1000;
  return `${seconds.toFixed(seconds >= 10 ? 0 : 1)}s`;
}

function formatStatusName(label: string): string {
  const trimmed = String(label ?? '').trim();
  if (!trimmed) return 'Status';
  const isAllCaps = /^[A-Z0-9 _-]+$/.test(trimmed);
  if (!isAllCaps) return trimmed;
  return trimmed
    .toLowerCase()
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function toBadgeAbbreviation(label: string): string {
  const lettersOnly = formatStatusName(label).replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  if (!lettersOnly) return '--';
  return lettersOnly.slice(0, 2);
}

export const StatusBadges = memo(function StatusBadges({
  statuses,
  compact = false,
  className = '',
  tooltipDisabled = false,
}: StatusBadgesProps) {
  if (!statuses.length) return null;

  return (
    <div className={`flex flex-wrap items-center justify-center gap-1 ${className}`.trim()}>
      {statuses.map((status) => {
        const theme = STATUS_THEME[status.kind] ?? STATUS_THEME.neutral;
        const statusName = formatStatusName(status.label);
        const badgeLabel = toBadgeAbbreviation(status.label);
        const hasDuration = typeof status.remainingMs === 'number'
          && typeof status.totalMs === 'number'
          && status.totalMs > 0;
        const tooltipContent = (
          <div className="space-y-1">
            <div
              className="text-[11px] font-bold tracking-[1.8px] uppercase"
              style={{ color: theme.text }}
            >
              {statusName}
            </div>
            {status.detail && (
              <div className="text-[10px] leading-snug text-game-white/80">
                {status.detail}
              </div>
            )}
            {status.sourceDescription && (
              <div className="text-[10px] leading-snug text-game-white/65 italic">
                {status.sourceDescription}
              </div>
            )}
            {hasDuration && (
              <div className="text-[10px] tracking-[1.2px] text-game-white/70">
                Remaining: {formatStatusRemaining(status.remainingMs)}
              </div>
            )}
          </div>
        );
        return (
          <Tooltip
            key={status.id}
            content={tooltipContent}
            delayMs={120}
            disabled={tooltipDisabled}
            progressRing={
              hasDuration
                ? {
                    remainingMs: Math.max(0, Number(status.remainingMs ?? 0)),
                    totalMs: Math.max(1, Number(status.totalMs ?? 1)),
                    color: theme.text,
                    size: compact ? 34 : 40,
                  }
                : undefined
            }
          >
            <div
              className="relative flex items-center justify-center overflow-hidden rounded-full border font-bold tracking-[1px]"
              style={{
                width: compact ? 18 : 20,
                height: compact ? 18 : 20,
                color: theme.text,
                borderColor: theme.border,
                backgroundColor: theme.background,
                boxShadow: theme.glow,
                fontSize: compact ? '8px' : '9px',
                lineHeight: 1,
              }}
            >
              {hasDuration && (
                <div
                  className="absolute inset-0"
                  style={{
                    backgroundColor: theme.fill,
                    opacity: 0.45,
                  }}
                />
              )}
              <span className="relative z-[1] select-none">
                {badgeLabel}
              </span>
            </div>
          </Tooltip>
        );
      })}
    </div>
  );
});
