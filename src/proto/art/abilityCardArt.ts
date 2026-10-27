/** One illustration per authored move; spirit prefixes retain the base action. */
export const ABILITY_CARD_ART: Readonly<Record<string, string>> = {
  Nip: 'nip', Bite: 'bite', Takedown: 'takedown', 'Vice Grip': 'vice-grip',
  Fetch: 'fetch', Dig: 'dig', Scratch: 'scratch', Claw: 'claw', Lacerate: 'lacerate',
};
export function abilityCardArt(name: string) {
  const slug = ABILITY_CARD_ART[name.replace(/^Inferno /, '')];
  // Fetch/Dig already contain only friendly actors and their ordinary props.
  const version = slug === 'fetch' || slug === 'dig' ? 'v2' : 'v3';
  return slug ? `${import.meta.env.BASE_URL}assets/runtime/ui/abilities/watercolor-${version}/${slug}.webp` : undefined;
}
