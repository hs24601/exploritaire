import { memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useHoloInteraction } from '../hooks/useHoloInteraction';

interface JewelOrimProps {
  color?: string;
  size?: number;
  onPointerDown?: React.PointerEventHandler;
}

const STAR_PATH = 'M5,0 L5.8,4.2 L10,5 L5.8,5.8 L5,10 L4.2,5.8 L0,5 L4.2,4.2 Z';

const JEWEL_STARS = [
  { top: '10%', left: '20%', size: 20, delay: 0.2, dur: 3.5 },
  { top: '80%', left: '15%', size: 15, delay: 1.1, dur: 4.2 },
  { top: '25%', left: '85%', size: 18, delay: 0.7, dur: 3.8 },
  { top: '70%', left: '80%', size: 22, delay: 2.3, dur: 4.5 },
];

export const JewelOrim = memo(function JewelOrim({
  color = '#63687F',
  size = 100,
  onPointerDown,
}: JewelOrimProps) {
  const { styles: holoStyles, handlePointerMove, handlePointerLeave } = useHoloInteraction();

  return (
    <div 
      className="flex flex-col items-center relative group"
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      onPointerDown={onPointerDown}
      style={{ 
        perspective: '1000px',
        '--jewel-base': color,
        touchAction: 'none',
      } as React.CSSProperties}
    >
      {/* Floating Stars */}
      {JEWEL_STARS.map((star, idx) => (
        <svg
          key={idx}
          viewBox="0 0 10 10"
          width={star.size}
          height={star.size}
          className="absolute pointer-events-none z-0"
          style={{
            top: star.top,
            left: star.left,
            filter: `drop-shadow(0 0 4px ${color})`,
            animation: `rarity-star-float ${star.dur}s ease-in-out infinite`,
            animationDelay: `${star.delay}s`,
            opacity: 0.6,
          }}
        >
          <path d={STAR_PATH} fill="white" />
        </svg>
      ))}

      {/* Internal Glow */}
      <div 
        className="absolute rounded-full blur-[40px] opacity-40 mix-blend-screen animate-pulse"
        style={{
          width: size * 0.8,
          height: size * 0.8,
          background: `radial-gradient(circle, ${color} 0%, transparent 70%)`,
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
        }}
      />

      <div 
        className="jewel-container relative z-10"
        style={{ 
          width: size, 
          height: size,
          ...holoStyles,
          transition: 'transform 0.1s ease-out'
        }}
      >
        {/* Shimmer Sweep Layer */}
        <div 
          className="absolute inset-0 pointer-events-none z-20 overflow-hidden"
          style={{ 
            clipPath: 'polygon(50% 10%, 90% 40%, 90% 65%, 50% 90%, 10% 65%, 10% 40%)',
            mixBlendMode: 'screen'
          }}
        >
          <div 
            className="absolute inset-0"
            style={{
              background: 'linear-gradient(110deg, transparent 30%, rgba(255,255,255,0.2) 45%, rgba(255,255,255,0.6) 50%, rgba(255,255,255,0.2) 55%, transparent 70%)',
              width: '200%',
              height: '100%',
              left: '-100%',
              animation: 'jewel-auto-shimmer 6s infinite ease-in-out',
            }}
          />
        </div>

        <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 100 100" className="drop-shadow-2xl">
          <defs>
            <linearGradient id="jewel-glare" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="white" stopOpacity="0.4" />
              <stop offset="50%" stopColor="white" stopOpacity="0" />
              <stop offset="100%" stopColor="white" stopOpacity="0.1" />
            </linearGradient>
          </defs>
          
          <path className="jewel" id="one" d="M50.54 15.27L27.335 63.98l21.336 13.918 23.086-13.953" />
          <path className="jewel" id="two" d="M51.633 14.465l21.453 48.98 12.418-4.015.8-19.805" />
          <path className="jewel" id="three" d="M49.406 79.027v7.504L85.11 61.337l-11.92 3.352" />
          <path className="jewel" id="four" d="M49.406 14.676L25.97 63.492l-12.2-5.246-1.08-19.867" />
          <path className="jewel" id="five" d="M47.793 78.87v7.665L13.613 60.12l11.836 4.622" />
          
          {/* Dynamic Shine Overlay */}
          <path 
            d="M50.54 15.27L27.335 63.98l21.336 13.918 23.086-13.953" 
            fill="url(#jewel-glare)" 
            className="pointer-events-none mix-blend-overlay"
            style={{
              opacity: 'var(--hyp)',
              transformOrigin: 'center',
              transform: 'scale(1.02)',
            }}
          />
        </svg>
      </div>

      <style>{`
        @keyframes jewel-auto-shimmer {
          0% { transform: translateX(-150%) skewX(-25deg); }
          20% { transform: translateX(150%) skewX(-25deg); }
          100% { transform: translateX(150%) skewX(-25deg); }
        }
        @keyframes rarity-star-float {
          0%   { transform: translateY(0px)  rotate(0deg)  scale(1);    opacity: 0.6; }
          50%  { transform: translateY(-15px) rotate(22deg) scale(1.2); opacity: 0.8; }
          100% { transform: translateY(0px)  rotate(0deg)  scale(1);    opacity: 0.6; }
        }
        .jewel {
          transition: fill 0.5s ease;
        }
        #one   { fill: var(--jewel-base); }
        #two   { fill: color-mix(in srgb, var(--jewel-base), white 35%); }
        #three { fill: color-mix(in srgb, var(--jewel-base), black 15%); }
        #four  { fill: color-mix(in srgb, var(--jewel-base), white 15%); }
        #five  { fill: color-mix(in srgb, var(--jewel-base), black 30%); }

        .group:hover #one   { fill: color-mix(in srgb, var(--jewel-base), white 10%); }
        .group:hover #two   { fill: color-mix(in srgb, var(--jewel-base), white 45%); }
        .group:hover #three { fill: var(--jewel-base); }
        .group:hover #four  { fill: color-mix(in srgb, var(--jewel-base), white 25%); }
        .group:hover #five  { fill: color-mix(in srgb, var(--jewel-base), black 10%); }
      `}</style>
    </div>
  );
});

interface JewelModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const JewelModal = memo(function JewelModal({ isOpen, onClose }: JewelModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[10050] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="relative w-full max-w-md rounded-2xl bg-[#74689F] p-12 shadow-2xl"
          >
            <button
              onClick={onClose}
              className="absolute top-4 right-4 text-[#322866] hover:opacity-70 transition-opacity"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>
            <JewelOrim size={150} />
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
});
