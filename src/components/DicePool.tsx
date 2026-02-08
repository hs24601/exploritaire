import { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { DicePool as DicePoolType } from '../engine/types';
import {
  createDicePool,
  addDie,
  addDice,
  removeDie,
  removeLastDie,
  toggleLock,
  rollUnlockedDice,
  rollAllDice,
  unlockAllDice,
  setRolling,
  getDiceSum,
  getUnlockedDiceSum,
} from '../engine/dice';
import { Die } from './Die';

interface DicePoolProps {
  initialDiceCount?: number;
  maxDice?: number;
  minDice?: number;
  showControls?: boolean;
  showStats?: boolean;
  onPoolChange?: (pool: DicePoolType) => void;
}

export function DicePool({
  initialDiceCount = 5,
  maxDice = 10,
  minDice = 0,
  showControls = true,
  showStats = true,
  onPoolChange,
}: DicePoolProps) {
  const [pool, setPool] = useState<DicePoolType>(() => {
    const newPool = createDicePool();
    return addDice(newPool, initialDiceCount);
  });

  // Notify parent of pool changes
  useEffect(() => {
    if (onPoolChange) {
      onPoolChange(pool);
    }
  }, [pool, onPoolChange]);

  // Clear rolling state after animation completes
  useEffect(() => {
    const rollingDice = pool.dice.filter(d => d.rolling);
    if (rollingDice.length > 0) {
      const timer = setTimeout(() => {
        setPool(prev => setRolling(prev, rollingDice.map(d => d.id), false));
      }, 600);
      return () => clearTimeout(timer);
    }
  }, [pool.dice]);

  const handleAddDie = useCallback(() => {
    if (pool.dice.length < maxDice) {
      setPool(prev => addDie(prev));
    }
  }, [pool.dice.length, maxDice]);

  const handleRemoveDie = useCallback((dieId?: string) => {
    if (pool.dice.length > minDice) {
      setPool(prev => (dieId ? removeDie(prev, dieId) : removeLastDie(prev)));
    }
  }, [pool.dice.length, minDice]);

  const handleToggleLock = useCallback((dieId: string) => {
    setPool(prev => toggleLock(prev, dieId));
  }, []);

  const handleRollUnlocked = useCallback(() => {
    setPool(prev => rollUnlockedDice(prev));
  }, []);

  const handleRollAll = useCallback(() => {
    setPool(prev => rollAllDice(prev));
  }, []);

  const handleUnlockAll = useCallback(() => {
    setPool(prev => unlockAllDice(prev));
  }, []);

  const unlockedCount = pool.dice.filter(d => !d.locked).length;
  const lockedCount = pool.dice.filter(d => d.locked).length;

  return (
    <div className="flex flex-col gap-4 p-4 bg-gray-100 rounded-lg shadow-md">
      {/* Dice Display */}
      <div className="flex flex-wrap gap-4 justify-center min-h-[80px]">
        <AnimatePresence mode="popLayout">
          {pool.dice.map((die, index) => (
            <motion.div
              key={die.id}
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              transition={{ duration: 0.2, delay: index * 0.05 }}
              layout
            >
              <Die
                die={die}
                onToggleLock={() => handleToggleLock(die.id)}
                size={64}
              />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Stats Panel */}
      {showStats && pool.dice.length > 0 && (
        <div className="flex gap-4 justify-center text-sm">
          <div className="px-3 py-1 bg-white rounded-md shadow-sm">
            <span className="font-semibold">Total:</span> {getDiceSum(pool)}
          </div>
          {lockedCount > 0 && (
            <div className="px-3 py-1 bg-white rounded-md shadow-sm">
              <span className="font-semibold">Unlocked:</span> {getUnlockedDiceSum(pool)}
            </div>
          )}
          <div className="px-3 py-1 bg-white rounded-md shadow-sm">
            <span className="font-semibold">Rolls:</span> {pool.rollCount}
          </div>
        </div>
      )}

      {/* Controls */}
      {showControls && (
        <div className="flex flex-col gap-2">
          {/* Primary Actions */}
          <div className="flex gap-2 justify-center">
            <button
              onClick={handleRollUnlocked}
              disabled={unlockedCount === 0}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg font-semibold hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors shadow-md"
            >
              Roll Unlocked ({unlockedCount})
            </button>
            <button
              onClick={handleRollAll}
              disabled={pool.dice.length === 0}
              className="px-4 py-2 bg-green-500 text-white rounded-lg font-semibold hover:bg-green-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors shadow-md"
            >
              Roll All
            </button>
          </div>

          {/* Secondary Actions */}
          <div className="flex gap-2 justify-center">
            <button
              onClick={handleAddDie}
              disabled={pool.dice.length >= maxDice}
              className="px-3 py-1 bg-purple-500 text-white rounded-md text-sm font-medium hover:bg-purple-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
            >
              + Add Die
            </button>
            <button
              onClick={() => handleRemoveDie()}
              disabled={pool.dice.length <= minDice}
              className="px-3 py-1 bg-red-500 text-white rounded-md text-sm font-medium hover:bg-red-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
            >
              - Remove Die
            </button>
            <button
              onClick={handleUnlockAll}
              disabled={lockedCount === 0}
              className="px-3 py-1 bg-orange-500 text-white rounded-md text-sm font-medium hover:bg-orange-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
            >
              Unlock All
            </button>
          </div>
        </div>
      )}

      {/* Hint Text */}
      {showControls && pool.dice.length > 0 && (
        <div className="text-center text-xs text-gray-600">
          Click a die to lock/unlock it
        </div>
      )}
    </div>
  );
}
