import { CardFrame } from '../card/CardFrame';

export type AbilityTargetType = 'single' | 'bench' | 'all';

const TARGET_LABELS: Record<AbilityTargetType, string> = {
  single: '1 Target',
  bench: 'Bench Target',
  all: 'All Targets',
};

function renderAbilityDescription(description: string) {
  const parts = description.split(/(\[[^\]]+\]|\b\d+%?\b)/g);
  return parts.map((part, index) => {
    if (!part) return null;
    const isValue = /^(\[[^\]]+\]|\d+%?)$/.test(part);
    return isValue
      ? <strong key={`${part}-${index}`} className="font-black text-white">{part}</strong>
      : <span key={`${part}-${index}`}>{part}</span>;
  });
}

type AbilityCardProps = {
  title: string;
  description: string;
  targetType: AbilityTargetType;
  size: { width: number; height: number };
  costLabel?: string;
  collapsed?: boolean;
  onClick?: () => void;
  disabled?: boolean;
  selected?: boolean;
  titleColor?: string;
  cardRef?: (node: HTMLDivElement | null) => void;
  borderColor?: string;
  borderWidth?: number;
};

export function AbilityCard({
  title,
  description,
  targetType,
  size,
  costLabel,
  collapsed = false,
  onClick,
  disabled = false,
  selected = false,
  titleColor = 'text-game-gold/90',
  cardRef,
  borderColor,
  borderWidth,
}: AbilityCardProps) {
  return (
    <CardFrame
      ref={cardRef}
      size={size}
      borderColor={borderColor ?? (selected ? 'rgba(245,176,56,0.7)' : 'rgba(255,255,255,0.12)')}
      backgroundColor="rgba(0,0,0,0.74)"
      boxShadow={selected ? '0 0 28px rgba(245,176,56,0.24)' : '0 0 24px rgba(255,255,255,0.05)'}
      onClick={disabled ? undefined : onClick}
      style={borderWidth ? { borderWidth } : undefined}
      className={`group relative flex w-full min-w-0 flex-col justify-between px-3 pb-3 pt-2 text-left transition-all ${
        disabled
          ? 'opacity-45'
          : selected
            ? '-translate-y-2 rotate-[-2deg]'
            : collapsed
              ? 'hover:z-20 hover:scale-[1.18] hover:border-game-gold/50 hover:shadow-[0_0_24px_rgba(245,176,56,0.18)] focus-within:z-20 focus-within:scale-[1.18]'
              : 'hover:-translate-y-1 hover:border-game-gold/50'
      }`}
    >
      <div className="flex h-full flex-col justify-between gap-2">
        <div className={`pt-0 text-center text-[9px] font-black uppercase tracking-[0.12em] ${titleColor}`}>
          {title}
        </div>
        {collapsed ? (
          <div className="flex flex-1 flex-col justify-between">
            <div className="text-center text-[10px] font-black uppercase tracking-[0.08em] text-white/80">
              {costLabel ?? TARGET_LABELS[targetType]}
            </div>
            <div className="pointer-events-none absolute inset-x-2 bottom-2 rounded-[10px] border border-white/10 bg-black/94 px-2 py-2 opacity-0 shadow-[0_10px_30px_rgba(0,0,0,0.42)] transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100">
              <div className="text-[10px] leading-4 text-white/78">
                {renderAbilityDescription(description)}
              </div>
              <div className="mt-2 flex justify-start">
                <div className="whitespace-nowrap rounded-full border border-white/12 bg-black/60 px-2 py-1 text-[8px] leading-none font-black uppercase tracking-[0.08em] text-white/72">
                  {TARGET_LABELS[targetType]}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className="flex-1 text-[10px] leading-4 text-white/78">
              {renderAbilityDescription(description)}
            </div>
            <div className="flex justify-start">
              <div className="whitespace-nowrap rounded-full border border-white/12 bg-black/60 px-2 py-1 text-[8px] leading-none font-black uppercase tracking-[0.08em] text-white/72">
                {TARGET_LABELS[targetType]}
              </div>
            </div>
          </>
        )}
      </div>
    </CardFrame>
  );
}
