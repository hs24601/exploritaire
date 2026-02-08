import type { Die, DieValue, DicePool } from './types';

let dieIdCounter = 0;

/**
 * Generates a random die value (1-6)
 */
export function rollDieValue(): DieValue {
  return (Math.floor(Math.random() * 6) + 1) as DieValue;
}

/**
 * Creates a new die instance with a random initial value
 */
export function createDie(): Die {
  return {
    id: `die-${++dieIdCounter}`,
    value: rollDieValue(),
    locked: false,
    rolling: false,
  };
}

/**
 * Creates a new die with a specific value (useful for testing)
 */
export function createDieWithValue(value: DieValue): Die {
  return {
    id: `die-${++dieIdCounter}`,
    value,
    locked: false,
    rolling: false,
  };
}

/**
 * Creates an empty dice pool
 */
export function createDicePool(): DicePool {
  return {
    dice: [],
    rollCount: 0,
  };
}

/**
 * Creates a dice pool with N dice
 */
export function createDicePoolWithCount(count: number): DicePool {
  return {
    dice: Array.from({ length: count }, () => createDie()),
    rollCount: 0,
  };
}

/**
 * Adds a new die to the pool
 */
export function addDie(pool: DicePool): DicePool {
  return {
    ...pool,
    dice: [...pool.dice, createDie()],
  };
}

/**
 * Adds multiple dice to the pool
 */
export function addDice(pool: DicePool, count: number): DicePool {
  const newDice = Array.from({ length: count }, () => createDie());
  return {
    ...pool,
    dice: [...pool.dice, ...newDice],
  };
}

/**
 * Removes a die from the pool by ID
 */
export function removeDie(pool: DicePool, dieId: string): DicePool {
  return {
    ...pool,
    dice: pool.dice.filter(die => die.id !== dieId),
  };
}

/**
 * Removes the last die from the pool
 */
export function removeLastDie(pool: DicePool): DicePool {
  if (pool.dice.length === 0) return pool;
  return {
    ...pool,
    dice: pool.dice.slice(0, -1),
  };
}

/**
 * Toggles the locked state of a die
 */
export function toggleLock(pool: DicePool, dieId: string): DicePool {
  return {
    ...pool,
    dice: pool.dice.map(die =>
      die.id === dieId ? { ...die, locked: !die.locked } : die
    ),
  };
}

/**
 * Sets the locked state of a die explicitly
 */
export function setLocked(pool: DicePool, dieId: string, locked: boolean): DicePool {
  return {
    ...pool,
    dice: pool.dice.map(die =>
      die.id === dieId ? { ...die, locked } : die
    ),
  };
}

/**
 * Unlocks all dice in the pool
 */
export function unlockAllDice(pool: DicePool): DicePool {
  return {
    ...pool,
    dice: pool.dice.map(die => ({ ...die, locked: false })),
  };
}

/**
 * Locks all dice in the pool
 */
export function lockAllDice(pool: DicePool): DicePool {
  return {
    ...pool,
    dice: pool.dice.map(die => ({ ...die, locked: true })),
  };
}

/**
 * Marks dice as rolling (for animation state)
 */
export function setRolling(pool: DicePool, dieIds: string[], rolling: boolean): DicePool {
  const idSet = new Set(dieIds);
  return {
    ...pool,
    dice: pool.dice.map(die =>
      idSet.has(die.id) ? { ...die, rolling } : die
    ),
  };
}

/**
 * Rerolls all unlocked dice in the pool
 */
export function rollUnlockedDice(pool: DicePool): DicePool {
  return {
    ...pool,
    dice: pool.dice.map(die =>
      die.locked ? die : { ...die, value: rollDieValue(), rolling: true }
    ),
    rollCount: pool.rollCount + 1,
  };
}

/**
 * Rolls all dice in the pool (ignoring locks)
 */
export function rollAllDice(pool: DicePool): DicePool {
  return {
    ...pool,
    dice: pool.dice.map(die => ({ ...die, value: rollDieValue(), rolling: true })),
    rollCount: pool.rollCount + 1,
  };
}

/**
 * Gets the sum of all dice values
 */
export function getDiceSum(pool: DicePool): number {
  return pool.dice.reduce((sum, die) => sum + die.value, 0);
}

/**
 * Gets the sum of unlocked dice only
 */
export function getUnlockedDiceSum(pool: DicePool): number {
  return pool.dice
    .filter(die => !die.locked)
    .reduce((sum, die) => sum + die.value, 0);
}

/**
 * Counts dice with a specific value
 */
export function countDiceWithValue(pool: DicePool, value: DieValue): number {
  return pool.dice.filter(die => die.value === value).length;
}

/**
 * Gets all unique values in the pool
 */
export function getUniqueValues(pool: DicePool): DieValue[] {
  const values = new Set(pool.dice.map(die => die.value));
  return Array.from(values).sort();
}
