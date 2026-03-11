import { memo, useEffect, useState, useRef } from 'react';

const COLORS = [
  "#ff0a54", "#ff477e", "#ff85a1",
  "#00f5d4", "#9b5de5",
  "#fee440", "#00bbf9"
];

type ConfettiPiece = {
  id: number;
  left: string;
  color: string;
  fallDuration: string;
  spinDuration: string;
};

export const ConfettiFallEffect = memo(function ConfettiFallEffect({ className }: { className?: string }) {
  const [pieces, setPieces] = useState<ConfettiPiece[]>([]);
  const idCounter = useRef(0);

  useEffect(() => {
    const interval = setInterval(() => {
      const id = idCounter.current++;
      const fallDuration = Math.random() * 4 + 4;
      const newPiece: ConfettiPiece = {
        id,
        left: Math.random() * 100 + "%",
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        fallDuration: fallDuration + "s",
        spinDuration: (Math.random() * 3 + 2) + "s",
      };

      setPieces(prev => [...prev, newPiece]);

      setTimeout(() => {
        setPieces(prev => prev.filter(p => p.id !== id));
      }, fallDuration * 1000);
    }, 90);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className={`absolute inset-0 pointer-events-none overflow-hidden ${className ?? ''}`} style={{ perspective: '1000px' }}>
      <style>{`
        .confetti-container {
          position: absolute;
          top: -50px;
          transform-style: preserve-3d;
          animation: confetti-fall linear forwards;
        }
        .confetti-piece {
          position: relative;
          transform-style: preserve-3d;
          animation: confetti-spin linear infinite;
        }
        .confetti-side {
          position: absolute;
          width: 12px;
          height: 18px;
          backface-visibility: hidden;
        }
        .confetti-back {
          transform: rotateY(180deg);
          filter: brightness(0.6);
        }
        @keyframes confetti-fall {
          0% {
            transform: translateY(0) translateZ(-800px) scale(0.3);
            opacity: 0.8;
          }
          100% {
            transform: translateY(110vh) translateZ(300px) scale(1.4);
            opacity: 1;
          }
        }
        @keyframes confetti-spin {
          0% { transform: rotateX(0deg) rotateY(0deg) rotateZ(0deg); }
          100% { transform: rotateX(720deg) rotateY(720deg) rotateZ(360deg); }
        }
      `}</style>
      {pieces.map(p => (
        <div 
          key={p.id} 
          className="confetti-container" 
          style={{ left: p.left, animationDuration: p.fallDuration }}
        >
          <div className="confetti-piece" style={{ animationDuration: p.spinDuration }}>
            <div className="confetti-side" style={{ background: p.color }} />
            <div className="confetti-side confetti-back" style={{ background: p.color }} />
          </div>
        </div>
      ))}
      <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
        <div className="text-game-teal font-mono text-[10px] uppercase tracking-widest opacity-30">Active Effect: confetti_fall</div>
      </div>
    </div>
  );
});
