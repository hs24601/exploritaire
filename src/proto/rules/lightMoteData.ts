/** Small, stackable combat rewards. The normal Proto ability pool stays separate. */
export const LIGHT_MOTES = {
 'ember-mote': { name: 'Ember Mote', theme: 'fire', color: '#f0a46f', glyph: '✦', description: 'Chip hits add 1 fire damage while AP is full. Stacks up to 3.' },
 'splash-mote': { name: 'Splash Mote', theme: 'water', color: '#82c9eb', glyph: '≈', description: '+1 max AP. When paying an AP cost, 10% chance to save 1 AP; you still need the full cost. Stacks up to 3.' },
 'frost-mote': { name: 'Mote of Frost', theme: 'ice', color: '#c0e5f3', glyph: '❄', description: 'Gain 1 ice armor at the end of your turn, up to 6 armor. Stacks up to 3.' },
 'cinder-mote': { name: 'Cinder Mote', theme: 'fire', color: '#e58968', glyph: '·', description: '+10 percentage points to the holder’s burn chance on a landed hit. Stacks up to 3.' },
 'verdant-mote': { name: 'Verdant Mote', theme: 'nature', color: '#a8d2a0', glyph: '✧', description: 'Every 6 tableau receipts, heal 1 HP. Stacks up to 3; each copy adds 1 healing.' },
 'gale-mote': { name: 'Gale Mote', theme: 'air', color: '#d6c6ef', glyph: '〜', description: '+5% chance to evade an enemy hit. Stacks up to 3, for 15% evasion.' },
 'spark-mote': { name: 'Spark Mote', theme: 'shock', color: '#ecd584', glyph: 'ϟ', description: 'Every 6 tableau receipts, gain 1 extra AP, up to your cap. Further copies shorten this to every 5 / 4 receipts.' },
 'pebble-mote': { name: 'Pebble Mote', theme: 'earth', color: '#c5b196', glyph: '◇', description: 'Begin each encounter with 1 extra armor, up to 6 total armor. Stacks up to 3.' },
} as const;
export type LightMoteId = keyof typeof LIGHT_MOTES;
export type MoteCounts = Partial<Record<LightMoteId, number>>;
export const MOTE_IDS = Object.keys(LIGHT_MOTES) as LightMoteId[];
export const isLightMote = (id: string): id is LightMoteId => Object.prototype.hasOwnProperty.call(LIGHT_MOTES, id);
export const moteCount = (actor: { lightMotes?: MoteCounts }, id: LightMoteId) => Math.max(0, Math.min(3, actor.lightMotes?.[id] ?? 0));
