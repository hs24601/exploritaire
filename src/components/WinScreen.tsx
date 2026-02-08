import { memo } from 'react';
import { motion } from 'framer-motion';

interface WinScreenProps {
  className?: string;
}

export const WinScreen = memo(function WinScreen({ className }: WinScreenProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.6, rotate: -6 }}
      animate={{ opacity: 1, scale: 1, rotate: 6 }}
      className={`absolute z-[9400] pointer-events-none ${className || ''}`}
    >
      <div className="relative">
        <svg
          width="120"
          height="120"
          viewBox="0 0 120 120"
          className="drop-shadow-[0_0_20px_rgba(230,179,30,0.6)]"
        >
          <polygon
            points="60,6 72,38 106,38 78,58 90,92 60,72 30,92 42,58 14,38 48,38"
            fill="#0a0a0a"
            stroke="#e6b31e"
            strokeWidth="4"
          />
        </svg>
        <div
          className="absolute inset-0 flex items-center justify-center text-xs font-bold tracking-[3px]"
          style={{ color: '#e6b31e', textShadow: '0 0 12px rgba(230, 179, 30, 0.9)' }}
        >
          COMPLETE!
        </div>
      </div>
    </motion.div>
  );
});
