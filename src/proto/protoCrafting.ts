export const WORLD_ITEMS = {
  wood: { label: 'Wood', glyph: '🪵', kind: 'resource', quality: 0, food: false },
  berries: { label: 'Berries', glyph: '🫐', kind: 'resource', quality: 0, food: true },
  herbs: { label: 'Edible herbs', glyph: '🌿', kind: 'resource', quality: 0, food: true },
  // Pond species, one per rank (rules/fishing.ts POND_SPECIES), and the lucky glowfish.
  minnow: { label: 'Minnow', glyph: '🐟', kind: 'resource', quality: 0, food: true },
  shiner: { label: 'Shiner', glyph: '🐟', kind: 'resource', quality: 0, food: true },
  bluegill: { label: 'Bluegill', glyph: '🐟', kind: 'resource', quality: 0, food: true },
  perch: { label: 'Perch', glyph: '🐟', kind: 'resource', quality: 0, food: true },
  crappie: { label: 'Crappie', glyph: '🐟', kind: 'food', quality: 1, food: true },
  trout: { label: 'Trout', glyph: '🐟', kind: 'food', quality: 1, food: true },
  bass: { label: 'Bass', glyph: '🐟', kind: 'food', quality: 1, food: true },
  walleye: { label: 'Walleye', glyph: '🐟', kind: 'food', quality: 1, food: true },
  carp: { label: 'Carp', glyph: '🐟', kind: 'food', quality: 1, food: true },
  pike: { label: 'Pike', glyph: '🐟', kind: 'food', quality: 2, food: true },
  catfish: { label: 'Catfish', glyph: '🐟', kind: 'food', quality: 2, food: true },
  sturgeon: { label: 'Sturgeon', glyph: '🐟', kind: 'food', quality: 2, food: true },
  kingfish: { label: 'Kingfish', glyph: '🐡', kind: 'food', quality: 3, food: true },
  glowfish: { label: 'Glowfish', glyph: '🐠', kind: 'food', quality: 2, food: true },
  trail_ration: { label: 'Ration', glyph: '🥾', kind: 'food', quality: 1, food: true },
  hearty_ration: { label: 'Hearty ration', glyph: '🍱', kind: 'food', quality: 2, food: true },
  lumber: { label: 'Lumber', glyph: '🪚', kind: 'material', quality: 1, food: false },
  provisions_hut: { label: 'Provisions hut', glyph: '🏠', kind: 'structure', quality: 1, food: false },
} as const;
export type WorldItemId = keyof typeof WORLD_ITEMS;
export type Ingredients = Partial<Record<WorldItemId, number>>;
export type CraftBuild = { recipeId: string; elapsedMs: number; work: number; stationId?: string; foundation: number; tableau: number[] };
export type CraftStack = { id: string; resource: WorldItemId; count: number; biomeId: string;
  position: { x: number; y: number }; ingredients?: Ingredients; stationId?: string; build?: CraftBuild };
export type CraftRecipe = { id: string; label: string; inputs?: Ingredients; lowQualityFood?: number;
  output: WorldItemId; durationMs: number; requiresSolitaire: boolean; workRequired: number; station?: WorldItemId };
export const CRAFT_RECIPES: readonly CraftRecipe[] = [
  { id: 'hearty-ration', label: 'Prepare hearty ration', lowQualityFood: 3, output: 'hearty_ration', durationMs: 12000, requiresSolitaire: true, workRequired: 4, station: 'provisions_hut' },
  { id: 'ration', label: 'Pack ration', lowQualityFood: 3, output: 'trail_ration', durationMs: 8000, requiresSolitaire: false, workRequired: 0 },
  { id: 'hut', label: 'Build provisions hut', inputs: { lumber: 3, wood: 2 }, output: 'provisions_hut', durationMs: 18000, requiresSolitaire: true, workRequired: 4 },
  { id: 'lumber', label: 'Make lumber', inputs: { wood: 3 }, output: 'lumber', durationMs: 6000, requiresSolitaire: false, workRequired: 0 },
];
export const stackIngredients = (stack: CraftStack): Ingredients => stack.ingredients ?? { [stack.resource]: stack.count };
export const ingredientCount = (items: Ingredients) => Object.values(items).reduce((sum, count) => sum + (count ?? 0), 0);
export const matchRecipe = (items: Ingredients, station?: WorldItemId) => CRAFT_RECIPES.find((recipe) => {
  if (recipe.station !== station) return false;
  if (recipe.lowQualityFood) return Object.entries(items).reduce((sum, [id, count]) => sum + (WORLD_ITEMS[id as WorldItemId].food && WORLD_ITEMS[id as WorldItemId].quality === 0 ? count : 0), 0) >= recipe.lowQualityFood;
  return Object.entries(recipe.inputs ?? {}).every(([id, count]) => (items[id as WorldItemId] ?? 0) >= count);
});
export const reserveIngredients = (items: Ingredients, recipe: CraftRecipe): { reserved: Ingredients; leftovers: Ingredients } => {
  const leftovers = { ...items };
  const reserved: Ingredients = {};
  let foodNeeded = recipe.lowQualityFood ?? 0;
  Object.entries(items).forEach(([key, count]) => {
    const id = key as WorldItemId;
    const food = WORLD_ITEMS[id].food && WORLD_ITEMS[id].quality === 0;
    const used = recipe.lowQualityFood ? (food ? Math.min(count, foodNeeded) : 0) : (recipe.inputs?.[id] ?? 0);
    if (used > 0) { reserved[id] = used; leftovers[id] = count - used; if (food) foodNeeded -= used; }
    if (!leftovers[id]) delete leftovers[id];
  });
  return { reserved, leftovers };
};
export const startStackBuild = (stack: CraftStack, station?: CraftStack, leftoverId = stack.id + '-leftovers'): CraftStack[] => {
  if (stack.build) return [stack];
  const items = stackIngredients(stack);
  const recipe = matchRecipe(items, station?.resource);
  if (!recipe) return [stack];
  const { reserved, leftovers } = reserveIngredients(items, recipe);
  const result: CraftStack[] = [{ ...stack, resource: Object.keys(reserved)[0] as WorldItemId, count: ingredientCount(reserved), ingredients: reserved,
    build: { recipeId: recipe.id, elapsedMs: 0, work: 0, stationId: recipe.requiresSolitaire ? station?.id ?? stack.id : undefined, foundation: 3, tableau: [6, 4, 7, 5] } }];
  if (ingredientCount(leftovers)) result.push({ ...stack, id: leftoverId, resource: Object.keys(leftovers)[0] as WorldItemId, count: ingredientCount(leftovers), ingredients: leftovers, position: { x: stack.position.x + 58, y: stack.position.y }, build: undefined });
  return result;
};
export const advanceBuild = (stack: CraftStack, deltaMs: number, staffed: boolean): CraftStack => {
  if (!stack.build) return stack;
  const recipe = CRAFT_RECIPES.find((entry) => entry.id === stack.build?.recipeId)!;
  if (recipe.requiresSolitaire && !staffed) return stack;
  const build = { ...stack.build, elapsedMs: Math.min(recipe.durationMs, stack.build.elapsedMs + deltaMs) };
  if (build.elapsedMs >= recipe.durationMs && build.work >= recipe.workRequired) {
    return { ...stack, resource: recipe.output, count: 1, ingredients: undefined, stationId: undefined, build: undefined };
  }
  return { ...stack, build };
};
export const playBuildCard = (stack: CraftStack, rank: number): CraftStack => {
  const build = stack.build;
  if (!build || !build.tableau.includes(rank) || Math.abs(build.foundation - rank) !== 1) return stack;
  return { ...stack, build: { ...build, work: build.work + 1, foundation: rank, tableau: build.tableau.filter((card) => card !== rank) } };
};

export const splitStack = (stack: CraftStack, id: string): CraftStack[] => {
  if (stack.build || stack.count < 2 || WORLD_ITEMS[stack.resource].kind === 'structure') return [stack];
  const items = { ...stackIngredients(stack) };
  const item = Object.keys(items).find((key) => (items[key as WorldItemId] ?? 0) > 0) as WorldItemId;
  items[item] = (items[item] ?? 0) - 1;
  if (!items[item]) delete items[item];
  return [
    { ...stack, resource: Object.keys(items)[0] as WorldItemId, count: stack.count - 1, ingredients: items },
    { ...stack, id, resource: item, count: 1, ingredients: undefined, position: { x: stack.position.x + 58, y: stack.position.y } },
  ];
};
