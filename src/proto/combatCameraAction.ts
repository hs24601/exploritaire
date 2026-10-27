import { IMPACT_SECONDS, type BattleCue } from './rules/battleCues';

/** Bounded, presentation-only impulses. Repeated chips blend instead of stacking. */
export function createCombatCameraAction() {
  let pulses: { start: number; strength: number; direction: number }[] = [];
  return {
    cue(cue: BattleCue, now: number, direction: number) {
      if (cue.kind !== 'attack' || cue.trap) return;
      pulses.push({ start: now + cue.delay, strength: cue.heavy ? 1 : .65, direction });
      pulses = pulses.slice(-12);
    },
    sample(now: number, reduced: boolean) {
      pulses = pulses.filter(p => now - p.start < .95);
      let push = 0, drift = 0, blur = 0;
      if (!reduced) for (const pulse of pulses) {
        const age = now - pulse.start;
        if (age < 0) continue;
        const envelope = age < IMPACT_SECONDS
          ? Math.sin(age / IMPACT_SECONDS * Math.PI / 2)
          : .5 + .5 * Math.cos(Math.min(1, (age - IMPACT_SECONDS) / (.95 - IMPACT_SECONDS)) * Math.PI);
        const weight = envelope * pulse.strength;
        push = Math.max(push, weight);
        if (Math.abs(weight) > Math.abs(drift)) drift = weight * pulse.direction;
        // A short soft smear on the approach; the contact and recovery stay crisp.
        blur = Math.max(blur, age < IMPACT_SECONDS ? Math.sin(age / IMPACT_SECONDS * Math.PI) * pulse.strength * .55 : 0);
      }
      return { zoom: 1 + push * .028, drift: drift * .035, blur };
    },
  };
}
