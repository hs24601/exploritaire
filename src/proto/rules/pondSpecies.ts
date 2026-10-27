// The pond's catches, by rank. No imports, so setup.ts can build the empty haul from it.

/**
 * Each rank is its own species, smallest to largest. Bigger fish fight harder
 * and feed more: `inspiration` is what eating one restores (the Kingfish is a feast
 * that restores everything), `quality` its food tier (tier 0 counts toward rations).
 */
export const POND_SPECIES = [
  { rank: 1, id: 'minnow', label: 'Minnow', inspiration: 1, quality: 0 },
  { rank: 2, id: 'shiner', label: 'Shiner', inspiration: 1, quality: 0 },
  { rank: 3, id: 'bluegill', label: 'Bluegill', inspiration: 1, quality: 0 },
  { rank: 4, id: 'perch', label: 'Perch', inspiration: 1, quality: 0 },
  { rank: 5, id: 'crappie', label: 'Crappie', inspiration: 2, quality: 1 },
  { rank: 6, id: 'trout', label: 'Trout', inspiration: 2, quality: 1 },
  { rank: 7, id: 'bass', label: 'Bass', inspiration: 2, quality: 1 },
  { rank: 8, id: 'walleye', label: 'Walleye', inspiration: 2, quality: 1 },
  { rank: 9, id: 'carp', label: 'Carp', inspiration: 2, quality: 1 },
  { rank: 10, id: 'pike', label: 'Pike', inspiration: 3, quality: 2 },
  { rank: 11, id: 'catfish', label: 'Catfish', inspiration: 3, quality: 2 },
  { rank: 12, id: 'sturgeon', label: 'Sturgeon', inspiration: 3, quality: 2 },
  { rank: 13, id: 'kingfish', label: 'Kingfish', inspiration: Infinity, quality: 3 },
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
