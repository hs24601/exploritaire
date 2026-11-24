import {it,expect,vi} from 'vitest';
import {createWorldGridAutoSequence} from './worldGridAutoSequence';
it('plays exactly one best card per tap even if more moves remain available',()=>{
 const grid={autoStep:vi.fn(()=>true)},auto=createWorldGridAutoSequence(grid);
 expect(auto.step(false)).toBe(true);expect(auto.step(false)).toBe(false);expect(auto.step(false)).toBe(false);expect(grid.autoStep).toHaveBeenCalledTimes(1);expect(grid.autoStep).toHaveBeenCalledWith(false);auto.reset();expect(auto.step(false)).toBe(true);expect(grid.autoStep).toHaveBeenCalledTimes(2);
});
it('replans held moves without drawing stock, and stops on exhausted moves',()=>{
 const grid={bestPath:vi.fn(()=>[]),activate:vi.fn(()=>true),autoStep:vi.fn().mockReturnValueOnce(true).mockReturnValue(false)},auto=createWorldGridAutoSequence(grid);
 expect(auto.step(true)).toBe(true);expect(auto.step(true)).toBe(false);expect(grid.autoStep.mock.calls).toEqual([[false],[false]]);expect(grid.bestPath).not.toHaveBeenCalled();
});
