import { memo } from 'react';
import { motion } from 'framer-motion';

interface WinScreenProps {
  onNewGame: () => void;
}

export const WinScreen = memo(function WinScreen({ onNewGame }: WinScreenProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-game-bg-dark px-16 py-10 rounded-xl border-2 border-game-gold text-center"
      style={{
        boxShadow: '0 0 60px rgba(230, 179, 30, 0.4), inset 0 0 40px rgba(230, 179, 30, 0.07)',
      }}
    >
      <motion.div
        animate={{ scale: [1, 1.1, 1], rotate: [0, 5, -5, 0] }}
        transition={{ duration: 2, repeat: Infinity }}
        className="text-5xl mb-5"
      >
        &#127942;
      </motion.div>
      <div
        className="text-2xl mb-5 text-game-gold tracking-[4px]"
        style={{ textShadow: '0 0 20px #e6b31e' }}
      >
        YOU WIN!
      </div>
      <button
        onClick={onNewGame}
        className="bg-transparent text-game-gold border-2 border-game-gold py-3 px-6 text-base font-mono font-bold rounded-md cursor-pointer tracking-widest hover:shadow-neon-gold transition-shadow"
        style={{ textShadow: '0 0 10px #e6b31e' }}
      >
        NEW GAME
      </button>
    </motion.div>
  );
});
