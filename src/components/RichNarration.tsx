import { motion } from 'framer-motion';
import { useMemo } from 'react';
import { NEON_COLORS } from '../utils/styles';

interface RichNarrationProps {
  text: string;
  tone?: 'teal' | 'gold' | 'violet' | 'green';
  className?: string;
}

const EFFECT_NAMES = ['aspect', 'pulse', 'color', 'highlight', 'glow'];

export function RichNarration({ text, tone = 'teal', className = '' }: RichNarrationProps) {
  const getColors = (key: string | undefined) => {
    // If it's a known color name from NEON_COLORS
    if (key && key in NEON_COLORS) {
      const colorKey = key as keyof typeof NEON_COLORS;
      // We need to check if the property is a string (hex) or a function (rgba)
      const hex = typeof NEON_COLORS[colorKey] === 'string' ? NEON_COLORS[colorKey] as string : undefined;
      const rgbaFunc = NEON_COLORS[`${colorKey}Rgba` as keyof typeof NEON_COLORS] as ((a: number) => string) | undefined;
      
      return {
        glow: rgbaFunc ? rgbaFunc(0.8) : (hex || 'rgba(126, 255, 199, 0.8)'),
        text: hex ? `text-[${hex}]` : '' // Tailwind dynamic class might need safety, but let's use style
      };
    }

    // Fallback to tone
    switch (tone) {
      case 'gold': return { glow: 'rgba(230, 179, 30, 0.8)', text: 'text-game-gold' };
      case 'violet': return { glow: 'rgba(139, 92, 246, 0.8)', text: 'text-game-purple' };
      case 'green': return { glow: 'rgba(34, 197, 94, 0.8)', text: 'text-green-400' };
      default: return { glow: 'rgba(126, 255, 199, 0.8)', text: 'text-game-teal' };
    }
  };

  const parts = useMemo(() => text.split(/(\{.*?\})/g), [text]);

  return (
    <span className={className}>
      {parts.map((part, i) => {
        const match = part.match(/^\{(.*?)(?:\|(.*?))?\}$/);
        if (!match) return part;

        const content = match[1];
        const secondPart = match[2]; // Can be effect OR color

        const isEffect = secondPart && EFFECT_NAMES.includes(secondPart);
        const isColor = secondPart && secondPart in NEON_COLORS;
        
        const colors = getColors(isColor ? secondPart : undefined);

        // Default to pulse if it's an aspect/pulse effect OR just a color name
        if (!secondPart || secondPart === 'aspect' || secondPart === 'pulse' || isColor || secondPart === 'glow') {
          return (
            <motion.span
              key={i}
              className="inline-flex font-black uppercase tracking-[0.15em] px-1 text-[1.15em]"
              style={{ color: isColor ? NEON_COLORS[secondPart as keyof typeof NEON_COLORS] as string : undefined }}
              animate={{
                scale: [1, 1.06, 1],
                textShadow: [
                  '0 0 0 rgba(255,255,255,0)',
                  `0 0 15px ${colors.glow}`,
                  '0 0 0 rgba(255,255,255,0)',
                ],
              }}
              transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
            >
              {content}
            </motion.span>
          );
        }

        // Static color highlight
        if (secondPart === 'color' || secondPart === 'highlight') {
          return (
            <span 
              key={i} 
              className={colors.text + " font-bold"}
              style={!colors.text ? { color: colors.glow } : {}}
            >
              {content}
            </span>
          );
        }

        return content;
      })}
    </span>
  );
}
