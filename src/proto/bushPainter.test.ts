import { describe, expect, it } from 'vitest';
import { BUSH_CROWN_RULES, BUSH_MAX_FRUIT, BUSH_TRUNK_FORMS, BUSH_TRUNK_RULES, trunkStructure, crownStructure, paintBush, planBush, type BushPaintPreset } from './bushPainter';

const base: BushPaintPreset = { seed: 81723, fullness: .7, spread: 1, brush: .65, warmth: .6, fruit: 1 };
const alphaAt = (data: Uint8ClampedArray, size: number, x: number, y: number) => data[(y * size + x) * 4 + 3];

describe('bush painter v3', () => {
  it('bakes identical pixels for an identical preset and different pixels per seed', () => {
    const a = paintBush(base, 128).data, b = paintBush({ ...base }, 128).data, c = paintBush({ ...base, seed: 81724 }, 128).data;
    expect(a).toEqual(b);
    expect(a).not.toEqual(c);
  });

  it('keeps every seed inside a transparent gutter with finite placement', () => {
    for (let seed = 0; seed < 24; seed++) {
      const preset = { ...base, seed, fullness: seed % 2, spread: seed % 3 / 2, brush: seed % 2, fruit: seed % 4 }, size = 96;
      const { data } = paintBush(preset, size);
      for (let i = 0; i < size; i++) {
        expect(alphaAt(data, size, i, 0)).toBe(0); expect(alphaAt(data, size, i, size - 1)).toBe(0);
        expect(alphaAt(data, size, 0, i)).toBe(0); expect(alphaAt(data, size, size - 1, i)).toBe(0);
      }
      const plan = planBush(preset, size);
      expect(plan.clumps.every(c => Number.isFinite(c.x) && Number.isFinite(c.y) && c.light >= 0 && c.light <= 1)).toBe(true);
      expect(plan.fruit.length).toBeLessThanOrEqual(preset.fruit);
    }
  });

  it('paints fruit independently of foliage growth', () => {
    const without = planBush({ ...base, fruit: 0 }, 256), withFruit = planBush(base, 256);
    expect(without.fruit).toHaveLength(0);
    expect(withFruit.fruit).toHaveLength(1);
    expect(withFruit.clumps.map(c => [c.x, c.y])).toEqual(without.clumps.map(c => [c.x, c.y]));
  });

  it('rejects unsupported raster sizes', () => {
    expect(() => paintBush(base, 32)).toThrow();
    expect(() => paintBush(base, 512.5)).toThrow();
  });
});

describe('mandatory crown structure', () => {
  it('never leaves a central gap, arch or enclosed hole in the crown', () => {
    for (let seed = 0; seed < 30; seed++) {
      const preset = { ...base, seed: 7000 + seed * 37, fullness: (seed % 5) / 4, spread: (seed % 4) / 3, fruit: seed % 3 };
      const size = 160, plan = planBush(preset, size), result = crownStructure(paintBush(preset, size), plan);
      expect(result.enclosedHole, `seed ${preset.seed} enclosed hole`).toBeLessThanOrEqual(BUSH_CROWN_RULES.maxEnclosedHole);
      // Plane outlines are lobed, so allow a small tolerance over the drape target.
      expect(result.window, `seed ${preset.seed} trunk window`).toBeLessThanOrEqual(BUSH_CROWN_RULES.maxTrunkWindow + .08);
      // No open background under the crown beside the trunk: paint reaches the hem.
      expect(result.skirt, `seed ${preset.seed} skirt`).toBeLessThanOrEqual(.05);
    }
  });

  it('flags a crown that floats above open background beside the trunk', () => {
    const size = 160, plan = planBush(base, size), raster = paintBush(base, size);
    // Erase all paint in the lower third except a narrow trunk column.
    const lifted = new Uint8ClampedArray(raster.data), mid = Math.round(size / 2);
    for (let y = Math.round(plan.ground - (plan.ground - Math.min(...plan.clumps.map(c => c.y - c.ry))) * .3); y < size; y++)
      for (let x = 0; x < size; x++) if (Math.abs(x - mid) > 4) lifted[(y * size + x) * 4 + 3] = 0;
    expect(crownStructure({ ...raster, data: lifted }, plan).skirt).toBeGreaterThan(.05);
  });
});

describe('procedural manaberry counts', () => {
  const plans = () => Array.from({ length: 40 }, (_, i) => ({ ...base, seed: 4000 + i * 53, fullness: (i % 5) / 4, spread: (i % 3) / 2 }));

  it('fits every count up to the maximum on every bush, and clamps beyond it', () => {
    for (const preset of plans()) for (let count = 0; count <= BUSH_MAX_FRUIT + 2; count++)
      expect(planBush({ ...preset, fruit: count }, 192).fruit, `seed ${preset.seed} count ${count}`).toHaveLength(Math.min(count, BUSH_MAX_FRUIT));
  });

  it('keeps foliage and earlier berries fixed as the count changes, so harvest removes only one', () => {
    for (const preset of plans()) {
      const full = planBush({ ...preset, fruit: BUSH_MAX_FRUIT }, 192);
      for (let count = 0; count < BUSH_MAX_FRUIT; count++) {
        const fewer = planBush({ ...preset, fruit: count }, 192);
        expect(fewer.fruit).toEqual(full.fruit.slice(0, count));
        expect(fewer.clumps.map(c => [c.x, c.y, c.rx])).toEqual(full.clumps.map(c => [c.x, c.y, c.rx]));
      }
    }
  });

  it('meets the berry design intent: apple-sized, separate, inside the crown, above the trunk window, leaves only at the lower edge', () => {
    for (const preset of plans()) {
      const size = 192, plan = planBush({ ...preset, fruit: BUSH_MAX_FRUIT }, size);
      for (const [i, berry] of plan.fruit.entries()) {
        expect(berry.r / size).toBeGreaterThan(.058); expect(berry.r / size).toBeLessThan(.068);
        expect(berry.y + berry.r * .5).toBeLessThan(plan.drape);
        // Foliage surrounds the berry on its sides and above.
        for (const [dx, dy] of [[-1.1, 0], [1.1, 0], [0, -1.1]]) expect(plan.clumps.some(c => ((berry.x + dx * berry.r - c.x) / c.rx) ** 2 + ((berry.y + dy * berry.r - c.y) / c.ry) ** 2 < 1)).toBe(true);
        for (const other of plan.fruit.slice(i + 1)) expect(Math.hypot(other.x - berry.x, other.y - berry.y)).toBeGreaterThan(berry.r + other.r);
        if (berry.cover >= 0) {
          const leaf = plan.clumps[berry.cover];
          expect(leaf.y - leaf.ry * .55).toBeGreaterThan(berry.y);
          for (const other of plan.fruit) if (other !== berry) expect(((other.x - leaf.x) / (leaf.rx * 1.2 + other.r)) ** 2 + ((other.y - other.r * .3 - leaf.y) / (leaf.ry * 1.2 + other.r * .7)) ** 2).toBeGreaterThanOrEqual(1);
        }
      }
    }
  });
});

describe('mandatory trunk growth', () => {
  it('grows every main limb from one root and only diverges: no converging, crossing or A-frame trunks', () => {
    for (let seed = 0; seed < 120; seed++) {
      const plan = planBush({ ...base, seed: seed * 29 + 11, fullness: (seed % 5) / 4, spread: (seed % 4) / 3 }, 160);
      const { convergence, crossed } = trunkStructure(plan);
      expect(crossed, `seed ${seed * 29 + 11} crossed`).toBe(false);
      expect(convergence / 160, `seed ${seed * 29 + 11} convergence`).toBeLessThanOrEqual(BUSH_TRUNK_RULES.maxConvergence);
    }
  });

  it('flags two limbs that start apart and meet at the top', () => {
    const plan = planBush(base, 160), line = (x0: number, x1: number) => ({ points: Array.from({ length: 21 }, (_, i) => ({ x: x0 + (x1 - x0) * i / 20, y: plan.ground - i * 2, w: 3 })) });
    const aFrame = trunkStructure({ ...plan, mains: [line(60, 80), line(100, 80)] });
    expect(aFrame.convergence).toBeGreaterThan(160 * BUSH_TRUNK_RULES.maxConvergence);
    expect(trunkStructure({ ...plan, mains: [line(60, 100), line(100, 60)] }).crossed).toBe(true);
  });
});

describe('trunk variety', () => {
  it('spreads seeds across every trunk form, independently of fruit count', () => {
    const counts = new Map<string, number>();
    for (let seed = 0; seed < 200; seed++) {
      const plan = planBush({ ...base, seed: seed * 13 + 5 }, 128);
      counts.set(plan.trunk, (counts.get(plan.trunk) ?? 0) + 1);
      expect(planBush({ ...base, seed: seed * 13 + 5, fruit: 4 }, 128).trunk).toBe(plan.trunk);
    }
    for (const form of BUSH_TRUNK_FORMS) expect(counts.get(form) ?? 0, form).toBeGreaterThanOrEqual(25);
  });
});
