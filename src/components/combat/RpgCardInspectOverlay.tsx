import { memo, useEffect, useMemo, useRef } from 'react';
import type { Card as CardType } from '../../engine/types';
import { CombatOverlayFrame } from './CombatOverlayFrame';

const SOAR_EVASION_BASE_MS = 6000;
const SOAR_EVASION_LEVEL_STEP_MS = 2000;

interface RpgCardInspectOverlayProps {
  card: CardType | null;
  open: boolean;
  onClose: () => void;
  onAdjustRarity?: (delta: -1 | 1) => void;
  zIndex?: number;
}

function getCardLevel(card: CardType): number {
  const match = card.id.match(/-lvl-(\d+)-/);
  if (!match) return 1;
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) ? parsed : 1;
}

export function getRpgCardMeta(card: CardType) {
  const level = getCardLevel(card);
  if (card.id === 'keru-archetype-lupus') {
    return {
      title: 'Lupus',
      subtitle: 'Ranger Archetype',
      body: 'Bind feral ranger instincts into your Keru core.',
      details: ['HP +8', 'Stamina +5'],
      accent: '#f7d24b',
    };
  }
  if (card.id === 'keru-archetype-ursus') {
    return {
      title: 'Ursus',
      subtitle: 'Tank Archetype',
      body: 'Fuse a heavy guardian shell into your Keru form.',
      details: ['HP +14', 'Armor +1'],
      accent: '#ffb075',
    };
  }
  if (card.id === 'keru-archetype-felis') {
    return {
      title: 'Felis',
      subtitle: 'Rogue Archetype',
      body: 'Attune to stealth, sight, and evasive mobility.',
      details: ['HP +5', 'Evasion +15%', 'Stealth +5'],
      accent: '#9de3ff',
    };
  }
  if (card.id.startsWith('rpg-scratch-')) {
    return {
      title: 'Scratch',
      subtitle: 'Fox Signature',
      body: 'Deal direct damage to a target actor.',
      details: [`Power ${card.rank}`, `Level ${level}`, 'Target: Any actor'],
      accent: '#f7d24b',
    };
  }
  if (card.id.startsWith('rpg-bite-') || card.id.startsWith('rpg-vice-bite-')) {
    const hasViceGrip = level >= 3 || card.id.startsWith('rpg-vice-bite-');
    const hasBleed = level >= 5;
    return {
      title: hasViceGrip ? 'Vice Grip' : 'Bite',
      subtitle: 'Wolf Signature',
      body: hasBleed
        ? 'Deal burst damage with bleed chance.'
        : (hasViceGrip ? 'Deal damage and apply heavy drag slow.' : 'Deal direct damage to a target actor.'),
      details: [
        `Power ${card.rank}`,
        `Level ${level}`,
        hasBleed ? 'Effect: 20% Bleed chance' : (hasViceGrip ? 'Effect: Vice Grip' : 'Effect: None'),
      ],
      accent: '#ff9d9d',
    };
  }
  if (card.id.startsWith('rpg-peck-') || card.id.startsWith('rpg-blinding-peck-')) {
    const isBlinding = card.id.startsWith('rpg-blinding-peck-');
    return {
      title: isBlinding ? 'Blinding Peck' : 'Peck',
      subtitle: 'Owl Signature',
      body: isBlinding
        ? 'Deal heavy damage and apply blinded debuff.'
        : 'Deal direct damage and scale with hand growth.',
      details: [
        `Power ${card.rank}`,
        `Level ${level}`,
        isBlinding ? 'Effect: Blinded' : 'Effect: None',
      ],
      accent: '#9de3ff',
    };
  }
  if (card.id.startsWith('rpg-cloud-sight-')) {
    const rarity = card.rarity ? String(card.rarity).toLowerCase() : '';
    const evasionEnabled = level >= 4 || rarity === 'mythic';
    const evasionDurationSeconds = Math.max(
      1,
      Math.round((SOAR_EVASION_BASE_MS + Math.max(0, level - 4) * SOAR_EVASION_LEVEL_STEP_MS) / 1000)
    );
    const details = [
      `Level ${level}`,
      'Effect: Reveal 2nd layer',
      level >= 2 ? '+2s combo timer' : 'No timer extension',
    ];
    if (evasionEnabled) {
      details.push(`+75% evasion for ${evasionDurationSeconds}s`);
    }
    return {
      title: 'Soar',
      subtitle: 'Owl Signature',
      body: 'Reveal second-layer tableau values and improve tempo.',
      details,
      accent: '#7fdbca',
    };
  }
  if (card.id.startsWith('rpg-dark-claw-')) {
    return {
      title: 'Dark Claw',
      subtitle: 'Shadowkit Signature',
      body: 'Deal direct darkness damage to a target actor.',
      details: [`Power ${card.rank}`, 'Level 1', 'Target: Any actor'],
      accent: '#c9adff',
    };
  }
  return {
    title: 'RPG Card',
    subtitle: 'Combat Action',
    body: 'Play this card on a valid target actor.',
    details: [`Power ${card.rank}`, `Level ${level}`],
    accent: '#7fdbca',
  };
}

export const RpgCardInspectOverlay = memo(function RpgCardInspectOverlay({
  card,
  open,
  onClose,
  onAdjustRarity,
  zIndex = 10022,
}: RpgCardInspectOverlayProps) {
  const meta = useMemo(() => (card ? getRpgCardMeta(card) : null), [card]);
  const openedAtRef = useRef(0);

  useEffect(() => {
    if (!open) return;
    openedAtRef.current = performance.now();
  }, [open, card?.id]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose, open]);
  useEffect(() => {
    if (!open) return;
    const onContextMenu = (event: MouseEvent) => {
      event.preventDefault();
      event.stopPropagation();
    };
    const onSelectStart = (event: Event) => {
      event.preventDefault();
      event.stopPropagation();
    };
    window.addEventListener('contextmenu', onContextMenu, true);
    window.addEventListener('selectstart', onSelectStart, true);
    return () => {
      window.removeEventListener('contextmenu', onContextMenu, true);
      window.removeEventListener('selectstart', onSelectStart, true);
    };
  }, [open]);

  if (!open || !card || !meta) return null;

  const rarityKey = (card.rarity ?? 'common').toLowerCase();
  const rarityText = rarityKey.toUpperCase();
  const rarityColorByKey: Record<string, string> = {
    common: '188, 189, 203',
    uncommon: '142, 227, 165',
    rare: '95, 127, 232',
    epic: '132, 104, 216',
    legendary: '242, 154, 88',
    mythic: '222, 91, 117',
  };
  const rarityRgb = rarityColorByKey[rarityKey] ?? rarityColorByKey.common;
  const handleBackdropClose = () => {
    if (performance.now() - openedAtRef.current < 220) return;
    onClose();
  };

  return (
    <CombatOverlayFrame visible={open} interactive dimOpacity={0.6} blurPx={2} zIndex={zIndex}>
      <div
        className="absolute inset-0"
        onClick={handleBackdropClose}
        onContextMenu={(event) => {
          event.preventDefault();
          event.stopPropagation();
        }}
      />
      <div
        className="relative mx-3 my-2 rounded-xl border p-3 md:p-4 flex flex-col gap-3 overflow-hidden"
        style={{
          width: 'min(calc((100dvh - 16px) * 5 / 7), calc(100vw - 24px), 520px)',
          height: 'min(780px, calc(100dvh - 16px))',
          aspectRatio: '5 / 7',
          userSelect: 'none',
          WebkitUserSelect: 'none',
          WebkitTouchCallout: 'none',
          borderColor: 'rgba(127, 219, 202, 0.78)',
          background: 'linear-gradient(180deg, rgba(8,14,24,0.96) 0%, rgba(8,12,18,0.96) 100%)',
          boxShadow: '0 0 28px rgba(127, 219, 202, 0.24)',
        }}
        onClick={(event) => event.stopPropagation()}
        onContextMenu={(event) => {
          event.preventDefault();
          event.stopPropagation();
        }}
      >
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            zIndex: 0,
            mixBlendMode: 'screen',
            opacity: 0.42,
            background: `
              radial-gradient(120% 80% at 18% 14%, rgba(${rarityRgb},0.28) 0%, rgba(255,255,255,0) 58%),
              radial-gradient(110% 70% at 82% 40%, rgba(${rarityRgb},0.2) 0%, rgba(255,255,255,0) 62%),
              radial-gradient(120% 80% at 50% 92%, rgba(${rarityRgb},0.24) 0%, rgba(255,255,255,0) 60%)
            `,
            animation: 'rpg-inspect-ethereal 12s ease-in-out infinite alternate',
          }}
        />
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            zIndex: 0,
            borderRadius: 12,
            background: `linear-gradient(120deg, rgba(255,255,255,0) 10%, rgba(${rarityRgb},0.28) 36%, rgba(255,255,255,0.18) 48%, rgba(255,255,255,0) 62%)`,
            transform: 'translateX(-120%)',
            mixBlendMode: 'screen',
            animation: 'rpg-inspect-sheen 3.2s ease-in-out infinite',
          }}
        />
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            zIndex: 0,
            borderRadius: 12,
            backgroundImage: `
              radial-gradient(circle at 15% 20%, rgba(255,255,255,0.9) 0 1px, transparent 1.5px),
              radial-gradient(circle at 72% 34%, rgba(${rarityRgb},0.9) 0 1px, transparent 1.5px),
              radial-gradient(circle at 48% 76%, rgba(${rarityRgb},0.75) 0 1px, transparent 1.5px),
              radial-gradient(circle at 88% 82%, rgba(255,255,255,0.85) 0 1px, transparent 1.5px)
            `,
            mixBlendMode: 'screen',
            opacity: rarityKey === 'epic' ? 0.22 : (rarityKey === 'legendary' ? 0.34 : (rarityKey === 'mythic' ? 0.46 : 0.16)),
            animation: 'rpg-inspect-sparkle 2.8s ease-in-out infinite',
          }}
        />
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="text-[10px] tracking-[3px] font-bold text-game-teal/80">{meta.subtitle}</div>
            <div className="text-[20px] md:text-[24px] tracking-[3px] font-bold text-game-white uppercase">{meta.title}</div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-2 py-1 rounded border text-[11px] tracking-[2px] font-bold"
            style={{
              borderColor: 'rgba(247, 210, 75, 0.7)',
              color: '#f7d24b',
              backgroundColor: 'rgba(10, 8, 6, 0.85)',
            }}
          >
            CLOSE
          </button>
        </div>

        <div
          className="rounded-lg border px-3 py-2 flex items-center justify-between text-[10px] tracking-[2px] font-bold"
          style={{
            borderColor: 'rgba(127, 219, 202, 0.45)',
            backgroundColor: 'rgba(10, 15, 21, 0.88)',
            color: '#bdeee5',
          }}
        >
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onAdjustRarity?.(-1)}
              disabled={!onAdjustRarity}
              className="w-6 h-6 rounded border text-[12px] leading-none flex items-center justify-center disabled:opacity-50"
              style={{
                borderColor: 'rgba(127, 219, 202, 0.6)',
                color: '#7fdbca',
                backgroundColor: 'rgba(8, 12, 18, 0.9)',
              }}
              title="Decrease rarity"
            >
              -
            </button>
            <span>{rarityText}</span>
            <button
              type="button"
              onClick={() => onAdjustRarity?.(1)}
              disabled={!onAdjustRarity}
              className="w-6 h-6 rounded border text-[12px] leading-none flex items-center justify-center disabled:opacity-50"
              style={{
                borderColor: 'rgba(247, 210, 75, 0.7)',
                color: '#f7d24b',
                backgroundColor: 'rgba(20, 16, 8, 0.8)',
              }}
              title="Increase rarity"
            >
              +
            </button>
          </div>
          <span style={{ color: meta.accent }}>PWR {card.rank}</span>
          <span>LV {getCardLevel(card)}</span>
        </div>

        <div
          className="rounded-lg border flex-1 min-h-[220px] md:min-h-[320px] relative overflow-hidden"
          style={{
            borderColor: 'rgba(127, 219, 202, 0.4)',
            background: 'radial-gradient(circle at 50% 42%, rgba(127,219,202,0.16) 0%, rgba(15,21,34,0.9) 56%, rgba(8,12,18,0.95) 100%)',
          }}
        >
          <div
            className="absolute inset-0 flex items-center justify-center p-3"
            style={{
              background: `radial-gradient(circle at 30% 20%, ${meta.accent}33 0%, transparent 36%)`,
            }}
          >
            <div
              className="text-center uppercase"
              style={{
                color: meta.accent,
                fontSize: 'clamp(34px, 11vw, 72px)',
                lineHeight: 1.1,
                letterSpacing: '8px',
                textShadow: '0 0 24px rgba(127, 219, 202, 0.38)',
                opacity: 0.92,
              }}
            >
              {meta.title}
            </div>
          </div>
        </div>

        <div className="rounded-lg border px-3 py-2" style={{ borderColor: 'rgba(127, 219, 202, 0.4)', backgroundColor: 'rgba(7, 11, 18, 0.9)' }}>
          <div className="text-[10px] tracking-[2px] text-game-teal/80 mb-1 font-bold">TEXT</div>
          <div className="text-[12px] md:text-[13px] text-game-white">{meta.body}</div>
          <div className="mt-2 flex flex-wrap gap-2">
            {meta.details.map((detail) => (
              <span
                key={detail}
                className="px-2 py-1 rounded border text-[10px] tracking-[1px] font-bold"
                style={{
                  borderColor: 'rgba(247, 210, 75, 0.4)',
                  color: '#f7d24b',
                  backgroundColor: 'rgba(20, 16, 8, 0.6)',
                }}
              >
                {detail}
              </span>
            ))}
          </div>
        </div>
        <style>{`
          @keyframes rpg-inspect-sheen {
            0% { transform: translateX(-120%); opacity: 0.14; }
            45% { opacity: 0.55; }
            60% { transform: translateX(120%); opacity: 0.18; }
            100% { transform: translateX(120%); opacity: 0.14; }
          }
          @keyframes rpg-inspect-ethereal {
            0% { transform: translate3d(-2px, -1px, 0) scale(1.01); }
            100% { transform: translate3d(3px, 2px, 0) scale(1.03); }
          }
          @keyframes rpg-inspect-sparkle {
            0%, 100% { opacity: 0.22; filter: brightness(0.95); }
            50% { opacity: 0.48; filter: brightness(1.2); }
          }
        `}</style>
      </div>
    </CombatOverlayFrame>
  );
});







