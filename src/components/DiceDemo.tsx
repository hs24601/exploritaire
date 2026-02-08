import { useState } from 'react';
import type { DicePool as DicePoolType } from '../engine/types';
import { DicePool } from './DicePool';
import { getUniqueValues, countDiceWithValue } from '../engine/dice';

/**
 * Demo component showing dice system integration
 * This demonstrates how to use the dice system in your game
 */
export function DiceDemo() {
  const [pool, setPool] = useState<DicePoolType | null>(null);

  // Example: Check for scoring patterns
  const uniqueValues = pool ? getUniqueValues(pool) : [];
  const hasStraight = uniqueValues.length >= 4 &&
    uniqueValues.some((v, i) =>
      i + 3 < uniqueValues.length &&
      uniqueValues[i + 3] === v + 3
    );

  const pairs = pool
    ? uniqueValues.filter(v => countDiceWithValue(pool, v) >= 2)
    : [];

  return (
    <div className="max-w-4xl mx-auto p-8">
      <div className="text-center mb-6">
        <h1 className="text-3xl font-bold mb-2">🎲 Dice System Demo</h1>
        <p className="text-gray-600">
          Click dice to lock/unlock them, then roll to keep the fun going!
        </p>
      </div>

      {/* Main Dice Pool */}
      <DicePool
        initialDiceCount={5}
        maxDice={10}
        minDice={0}
        showControls={true}
        showStats={true}
        onPoolChange={setPool}
      />

      {/* Game Integration Example */}
      {pool && pool.dice.length > 0 && (
        <div className="mt-6 p-4 bg-white rounded-lg shadow-md">
          <h2 className="text-xl font-semibold mb-3">Example: Scoring Patterns</h2>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {/* Straight */}
            <div className={`p-3 rounded-md ${hasStraight ? 'bg-green-100 border-2 border-green-500' : 'bg-gray-100'}`}>
              <div className="font-semibold">Straight</div>
              <div className="text-sm text-gray-600">
                {hasStraight ? '✓ 4 in a row!' : '✗ Need 4 in a row'}
              </div>
            </div>

            {/* Pairs */}
            <div className={`p-3 rounded-md ${pairs.length > 0 ? 'bg-green-100 border-2 border-green-500' : 'bg-gray-100'}`}>
              <div className="font-semibold">Pairs</div>
              <div className="text-sm text-gray-600">
                {pairs.length > 0 ? `✓ ${pairs.join(', ')}` : '✗ No pairs'}
              </div>
            </div>

            {/* All same */}
            <div className={`p-3 rounded-md ${uniqueValues.length === 1 && pool.dice.length >= 3 ? 'bg-green-100 border-2 border-green-500' : 'bg-gray-100'}`}>
              <div className="font-semibold">All Same</div>
              <div className="text-sm text-gray-600">
                {uniqueValues.length === 1 && pool.dice.length >= 3 ? '✓ All match!' : '✗ Need all same'}
              </div>
            </div>
          </div>

          <div className="mt-4 p-3 bg-blue-50 rounded-md">
            <div className="text-sm font-mono">
              <strong>Unique values:</strong> [{uniqueValues.join(', ')}]
            </div>
          </div>
        </div>
      )}

      {/* API Reference */}
      <div className="mt-8 p-6 bg-gray-50 rounded-lg">
        <h2 className="text-xl font-semibold mb-3">Integration Guide</h2>

        <div className="space-y-4 text-sm">
          <div>
            <h3 className="font-semibold mb-1">Engine Functions (from dice.ts):</h3>
            <ul className="list-disc list-inside space-y-1 text-gray-700 ml-2">
              <li><code>createDicePool()</code> - Create an empty pool</li>
              <li><code>addDie(pool)</code> - Add a single die</li>
              <li><code>removeDie(pool, id)</code> - Remove a specific die</li>
              <li><code>toggleLock(pool, id)</code> - Lock/unlock a die</li>
              <li><code>rollUnlockedDice(pool)</code> - Reroll unlocked dice</li>
              <li><code>getDiceSum(pool)</code> - Get total of all dice</li>
              <li><code>countDiceWithValue(pool, value)</code> - Count specific values</li>
            </ul>
          </div>

          <div>
            <h3 className="font-semibold mb-1">Components:</h3>
            <ul className="list-disc list-inside space-y-1 text-gray-700 ml-2">
              <li><code>&lt;Die&gt;</code> - Individual 3D die with lock state</li>
              <li><code>&lt;DicePool&gt;</code> - Complete dice management UI</li>
            </ul>
          </div>

          <div>
            <h3 className="font-semibold mb-1">Quick Start:</h3>
            <pre className="bg-white p-3 rounded mt-2 overflow-x-auto">
{`import { DicePool } from './components/DicePool';
import { createDicePool } from './engine/dice';

function MyGame() {
  return <DicePool initialDiceCount={5} />;
}`}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}
