import {it,expect} from 'vitest';
import {momentumSpiral} from './momentumSpiral';
it.each([[6,0],[7,1],[5,2],[6,3],[8,4]])('variant %s/%s is a continuous center-out path with arc-length fill', (turns,variant)=>{
 const path=momentumSpiral(turns,variant);expect(path.points[0]).toMatchObject({x:180,y:180,distance:0});expect(path.turnEnds[path.turnEnds.length-1]).toBe(1);
 for(let i=1;i<path.points.length;i++){const p=path.points[i],before=path.points[i-1];expect(p.distance).toBeGreaterThan(before.distance);expect(Math.hypot(p.x-before.x,p.y-before.y)).toBeLessThan(4);}
 const portions=path.turnEnds.map((end,i)=>end-(path.turnEnds[i-1]??0));expect(portions[portions.length-1]).toBeGreaterThan(portions[0]*3);expect(momentumSpiral(turns,variant)).toBe(path);
});
