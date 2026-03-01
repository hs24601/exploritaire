import { memo } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { Tooltip } from '../Tooltip';

export interface RelicTrayItem {
  instanceId: string;
  relicId: string;
  behaviorId: string;
  name: string;
  description?: string;
  rarity?: string;
  level?: number;
  params?: Record<string, unknown>;
  enabled: boolean;
}

interface RelicTrayProps {
  items: RelicTrayItem[];
  onToggleRelic?: (instanceId: string) => void;
  onRelicClick?: (item: RelicTrayItem) => void;
  tooltipDisabled?: boolean;
  layout?: 'vertical' | 'horizontal';
  className?: string;
  style?: CSSProperties;
  highlightInstanceId?: string | null;
  itemSizePx?: number;
  widthPx?: number;
  collapsedWidthPx?: number;
  topOffsetPx?: number;
  side?: 'left' | 'right';
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
}

const KNOWN_GLYPH_BY_BEHAVIOR_ID: Record<string, string> = {
  turtle_bide_v1: '🛡',
  heart_of_wild_v1: '🐾',
  sunk_cost_v1: '🐚',
  controlled_dragonfire_v1: '🐉',
  koi_coin_v1: '🪙',
  hindsight_v1: '⌛',
  momentum_v1: '⏱',
  summon_darkspawn_v1: '⚔',
  final_move_v1: '🎯',
  master_strategist_v1: '♟',
  zen_v1: '🧘',
};

function getRelicGlyph(item: RelicTrayItem): string {
  const known = KNOWN_GLYPH_BY_BEHAVIOR_ID[item.behaviorId];
  if (known) return known;
  const fallback = item.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((chunk) => chunk.charAt(0).toUpperCase())
    .join('');
  return fallback || 'R';
}

export const RelicTray = memo(function RelicTray({
  items,
  onToggleRelic,
  onRelicClick,
  tooltipDisabled = false,
  layout = 'vertical',
  className = '',
  style,
  highlightInstanceId = null,
  itemSizePx = 40,
  widthPx = 50,
  collapsedWidthPx = 22,
  topOffsetPx = 30,
  side = 'right',
  collapsed = false,
  onToggleCollapsed,
}: RelicTrayProps) {
  if (!items.length && !onToggleCollapsed) return null;

  const trayWidthPx = collapsed ? collapsedWidthPx : widthPx;
  const collapseChevron = side === 'right'
    ? (collapsed ? '«' : '»')
    : (collapsed ? '»' : '«');
  const buttonSizePx = Math.max(28, Math.round(itemSizePx));
  const buttonFontSizePx = Math.max(12, Math.round(buttonSizePx * 0.35));

  const renderRelicButton = (item: RelicTrayItem): ReactNode => {
    const glyph = getRelicGlyph(item);
    const isActive = !!item.enabled;
    const isHighlighted = highlightInstanceId === item.instanceId;
    const tooltip = (
      <div className="space-y-1">
        <div className="text-[11px] font-bold tracking-[1.8px] uppercase text-game-gold">{item.name}</div>
        <div className="text-[10px] text-game-teal/80 uppercase tracking-[1.4px]">
          {(item.rarity ?? 'common')} • lvl {Math.max(1, Number(item.level ?? 1))}
        </div>
        {item.description && (
          <div className="text-[10px] leading-snug text-game-white/80">
            {item.description}
          </div>
        )}
        {item.params && Object.keys(item.params).length > 0 && (
          <div className="flex flex-wrap gap-1">
            {Object.entries(item.params).map(([key, value]) => (
              <span
                key={`${item.instanceId}-${key}`}
                className="rounded border border-game-gold/40 px-1.5 py-[1px] text-[9px] text-game-gold/90"
              >
                {key}: {String(value)}
              </span>
            ))}
          </div>
        )}
        {onToggleRelic && (
          <div className="text-[10px] text-game-white/60">
            Click to {isActive ? 'deactivate' : 'activate'}
          </div>
        )}
      </div>
    );
    return (
      <Tooltip key={item.instanceId} content={tooltip} disabled={tooltipDisabled} pinnable>
        <button
          type="button"
          onClick={() => {
            onToggleRelic?.(item.instanceId);
            onRelicClick?.(item);
          }}
          className="flex items-center justify-center rounded-full border leading-none transition-colors"
          style={{
            width: `${buttonSizePx}px`,
            height: `${buttonSizePx}px`,
            fontSize: `${buttonFontSizePx}px`,
            borderColor: isActive ? 'rgba(84, 235, 118, 0.95)' : 'rgba(127, 219, 202, 0.5)',
            color: isActive ? '#56eb76' : '#7fdbca',
            backgroundColor: isActive ? 'rgba(9, 28, 12, 0.82)' : 'rgba(8, 15, 18, 0.82)',
            boxShadow: isHighlighted
              ? '0 0 16px rgba(255, 215, 64, 0.75), inset 0 0 8px rgba(255, 215, 64, 0.4)'
              : (isActive
                ? '0 0 12px rgba(84, 235, 118, 0.6), inset 0 0 6px rgba(84, 235, 118, 0.35)'
                : '0 0 7px rgba(127, 219, 202, 0.22)'),
          }}
          title={item.name}
          aria-label={`${isActive ? 'Deactivate' : 'Activate'} ${item.name}`}
        >
          {glyph}
        </button>
      </Tooltip>
    );
  };

  if (layout === 'horizontal') {
    return (
      <div
        className={`rounded border border-game-teal/30 bg-black/70 ${className}`.trim()}
        style={style}
      >
        <div className="flex w-full items-center gap-2 overflow-x-auto px-2 py-1">
          {items.map((item) => renderRelicButton(item))}
        </div>
      </div>
    );
  }

  return (
    <div
      className={`absolute bottom-0 z-20 border-game-teal/30 bg-black/70 ${className}`.trim()}
      style={{
        width: `${trayWidthPx}px`,
        top: `${topOffsetPx}px`,
        [side]: 0,
        borderLeftWidth: side === 'right' ? '1px' : undefined,
        borderRightWidth: side === 'left' ? '1px' : undefined,
        ...style,
      }}
    >
      <div className="flex h-full flex-col items-center gap-1 overflow-y-auto px-1 py-2">
        {onToggleCollapsed && (
          <button
            type="button"
            onClick={onToggleCollapsed}
            className="flex h-5 w-5 items-center justify-center rounded border border-game-teal/50 bg-black/80 text-[10px] font-bold text-game-gold transition-colors hover:bg-black"
            aria-label={collapsed ? 'Expand relic tray' : 'Collapse relic tray'}
            title={collapsed ? 'Expand relic tray' : 'Collapse relic tray'}
          >
            {collapseChevron}
          </button>
        )}
        {collapsed ? null : items.map((item) => renderRelicButton(item))}
      </div>
    </div>
  );
});
