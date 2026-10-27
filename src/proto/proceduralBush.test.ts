import { describe, expect, it } from 'vitest';
import { DEFAULT_BUSH, buildBushModel, parseBushPreset } from './proceduralBush';
describe('procedural bush study',()=>{
  it('reproduces a bounded growth model and varies its structure by seed',()=>{
    expect(buildBushModel(parseBushPreset(JSON.parse(JSON.stringify(DEFAULT_BUSH))))).toEqual(buildBushModel());
    expect(buildBushModel({...DEFAULT_BUSH,seed:81724})).not.toEqual(buildBushModel());
    for(let seed=0;seed<40;seed++){
      const model=buildBushModel({...DEFAULT_BUSH,seed,fullness:seed%2,spread:seed%2?.65:1.25});
      expect(model.masses).toHaveLength(15);expect(model.branches).toHaveLength(8);
      expect(model.masses.every(m=>Number.isFinite(m.x)&&m.x>0&&m.x<1&&m.y>0&&m.y<1)).toBe(true);
      expect(model.branches[0].start).toEqual({x:.5,y:.9});
    }
  });
  it('keeps depletion and paint tuning independent from plant structure',()=>{
    const ripe=buildBushModel(),bare=buildBushModel({...DEFAULT_BUSH,fruit:0});
    expect(bare.branches).toEqual(ripe.branches);expect(bare.masses).toEqual(ripe.masses);expect(bare.fruit).toEqual([]);
    const painted=buildBushModel({...DEFAULT_BUSH,brush:1,warmth:0});expect(painted.branches).toEqual(ripe.branches);expect(painted.masses).toEqual(ripe.masses);
    expect(buildBushModel({...DEFAULT_BUSH,fruit:3}).fruit[0]).toEqual(ripe.fruit[0]);
  });
  it('rejects malformed/unbounded preset work and session-state fields',()=>{
    for(const p of [{...DEFAULT_BUSH,seed:-1},{...DEFAULT_BUSH,fruit:50},{...DEFAULT_BUSH,fruit:1.5},{...DEFAULT_BUSH,fullness:NaN},{...DEFAULT_BUSH,spread:4},{...DEFAULT_BUSH,mana:99},{...DEFAULT_BUSH,version:2}])expect(()=>parseBushPreset(p)).toThrow();
  });
});
