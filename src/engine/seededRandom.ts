/**
 * Seeded Random Number Generator using Mulberry32 algorithm
 * Provides deterministic pseudo-random number generation for reproducible game states
 */
export class SeededRandom {
  private state: number;

  /**
   * Creates a new SeededRandom instance
   * @param seed - String seed to initialize the generator
   */
  constructor(seed: string) {
    this.state = this.hashSeed(seed);
  }

  /**
   * Hashes a string seed to a 32-bit number using cyrb128-inspired algorithm
   * @param str - The seed string
   * @returns A 32-bit unsigned integer
   */
  private hashSeed(str: string): number {
    let h = 1779033703 ^ str.length;
    for (let i = 0; i < str.length; i++) {
      h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
      h = h << 13 | h >>> 19;
    }
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return (h ^= h >>> 16) >>> 0;
  }

  /**
   * Returns the next random number in the sequence [0, 1)
   * Uses Mulberry32 algorithm for fast, high-quality PRNG
   */
  next(): number {
    this.state |= 0;
    this.state = (this.state + 0x6D2B79F5) | 0;
    let t = Math.imul(this.state ^ (this.state >>> 15), 1 | this.state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /**
   * Returns a random integer in the range [0, max)
   * @param max - The exclusive upper bound
   */
  nextInt(max: number): number {
    return Math.floor(this.next() * max);
  }
}
