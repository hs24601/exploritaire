const questAsset = (name: string) => `${import.meta.env.BASE_URL}assets/runtime/ui/quests/${name}`;

/** Keep discovery pickups and the active tutorial card on the same illustration. */
export function tutorialQuestArtwork(stepId: string) {
  const painted = stepId === 'navigate-den' ? 'hero-leaving-cave-night-paint-v1.png'
    : stepId === 'denser-patch' ? 'khad-roots-berry-bush-night-paint-v1.png'
    : stepId === 'first-berry' ? 'hero-snuffling-berries-night-paint-v5.png'
    : 'hero-snuffling-berries-paint-bobtail-v2.png';
  return { sprite: questAsset('hero-snuffling-berries-v1.png'), paintedSprite: questAsset(painted) };
}
