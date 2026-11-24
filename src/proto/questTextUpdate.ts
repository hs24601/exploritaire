/** A completed instruction is acknowledged before the replacement is revealed. */
export function questTextUpdate(elapsed: number, length: number, reduced = false) {
  const typingMs = Math.min(4000, Math.max(700, length * 23));
  const end = 1200 + typingMs;
  const phase = reduced ? elapsed < 500 ? 'updated' : 'idle'
    : elapsed < 320 ? 'emphasize' : elapsed < 900 ? 'strike' : elapsed < 1200 ? 'fade' : elapsed < end ? 'type' : 'idle';
  const typing = Math.max(0, Math.min(1, (elapsed - 1200) / typingMs));
  return {
    phase, newText: reduced || elapsed >= 1200,
    characters: reduced || phase === 'idle' ? length : Math.floor(length * typing),
    weight: elapsed < 320 ? 400 + 300 * Math.min(1, elapsed / 320) : 700,
    strike: Math.max(0, Math.min(1, (elapsed - 320) / 450)),
    opacity: phase === 'fade' ? 1 - (elapsed - 900) / 300 : 1,
    progress: reduced ? .5 : Math.min(1, elapsed / end),
    glow: phase === 'idle' ? 0 : reduced ? .16 : .5 * Math.min(1, elapsed / 150, (end - elapsed) / 250),
  };
}
