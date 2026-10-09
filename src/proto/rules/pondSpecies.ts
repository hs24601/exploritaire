// The pond's catches, by rank. No imports, so setup.ts can build the empty haul from it.

/**
 * Each rank is its own species, smallest to largest. Bigger fish fight harder
 * and feed more: `stamina` is what eating one restores (the Kingfish is a feast
 * that restores everything), `quality` its food tier (tier 0 counts toward rations).
 */
export const POND_SPECIES = [
  { rank: 1, id: 'minnow', label: 'Minnow', stamina: 1, quality: 0 },
  { rank: 2, id: 'shiner', label: 'Shiner', stamina: 1, quality: 0 },
  { rank: 3, id: 'bluegill', label: 'Bluegill', stamina: 1, quality: 0 },
  { rank: 4, id: 'perch', label: 'Perch', stamina: 1, quality: 0 },
  { rank: 5, id: 'crappie', label: 'Crappie', stamina: 2, quality: 1 },
  { rank: 6, id: 'trout', label: 'Trout', stamina: 2, quality: 1 },
  { rank: 7, id: 'bass', label: 'Bass', stamina: 2, quality: 1 },
  { rank: 8, id: 'walleye', label: 'Walleye', stamina: 2, quality: 1 },
  { rank: 9, id: 'carp', label: 'Carp', stamina: 2, quality: 1 },
  { rank: 10, id: 'pike', label: 'Pike', stamina: 3, quality: 2 },
  { rank: 11, id: 'catfish', label: 'Catfish', stamina: 3, quality: 2 },
  { rank: 12, id: 'sturgeon', label: 'Sturgeon', stamina: 3, quality: 2 },
  { rank: 13, id: 'kingfish', label: 'Kingfish', stamina: Infinity, quality: 3 },
] as const;
export type PondSpecies = (typeof POND_SPECIES)[number]['id'];
/** Everything the pond can give: a species, or a lucky glowfish tangled in the line. */
export type PondCatch = PondSpecies | 'glowfish';
export const POND_CATCHES: PondCatch[] = [...POND_SPECIES.map((species) => species.id), 'glowfish'];
export const speciesForRank = (rank: number) => POND_SPECIES[rank - 1];
export const catchForRank = (rank: number): PondSpecies => speciesForRank(rank).id;
export const isPondCatch = (id: string): id is PondCatch => (POND_CATCHES as string[]).includes(id);
/** The luck roll on every landed fish: this often a glowfish comes up with it. */
export const GLOWFISH_CHANCE = 0.2;
