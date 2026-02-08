import { memo } from 'react';
import { motion } from 'framer-motion';
import type { BlueprintCard as BlueprintCardType } from '../engine/types';
import { getBlueprintDefinition } from '../engine/blueprints';
import { CardFrame } from './card/CardFrame';

interface BlueprintCardProps {
  blueprintCard: BlueprintCardType;
  onClick: () => void;
}

export const BlueprintCard = memo(function BlueprintCard({
  blueprintCard,
  onClick,
}: BlueprintCardProps) {
  const definition = getBlueprintDefinition(blueprintCard.blueprintId);
  if (!definition) return null;

  return (
    <CardFrame
      size={{ width: 100, height: 120 }}
      borderColor="#a16207"
      boxShadow="0 0 18px rgba(161, 98, 7, 0.4)"
      onClick={onClick}
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.95 }}
      initial={{ opacity: 0, scale: 0 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0 }}
      transition={{ type: 'spring', duration: 0.5 }}
      className="bg-gradient-to-br from-yellow-100 to-yellow-200 border-2 shadow-2xl p-3 select-none"
      style={{
        position: 'absolute',
        left: blueprintCard.position.x,
        top: blueprintCard.position.y,
        transform: `rotate(${blueprintCard.rotation}deg)`,
        cursor: 'pointer',
        zIndex: 100,
      }}
    >
      {/* Blueprint icon */}
      <div className="text-center mb-2">
        <span className="text-3xl">📜</span>
      </div>

      {/* Blueprint name */}
      <div className="text-xs font-bold text-center text-yellow-900 mb-1">
        {definition.name.toUpperCase()}
      </div>

      {/* Click to collect hint */}
      <motion.div
        animate={{ opacity: [0.5, 1, 0.5] }}
        transition={{ duration: 1.5, repeat: Infinity }}
        className="text-[8px] text-center text-yellow-700 font-semibold"
      >
        CLICK TO COLLECT
      </motion.div>

      {/* Decorative corners */}
      <div className="absolute top-1 left-1 w-2 h-2 border-t-2 border-l-2 border-yellow-700" />
      <div className="absolute top-1 right-1 w-2 h-2 border-t-2 border-r-2 border-yellow-700" />
      <div className="absolute bottom-1 left-1 w-2 h-2 border-b-2 border-l-2 border-yellow-700" />
      <div className="absolute bottom-1 right-1 w-2 h-2 border-b-2 border-r-2 border-yellow-700" />
    </CardFrame>
  );
});
