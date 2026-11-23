import {describe,it,expect} from 'vitest';
import {advanceCardGlide,cardSlotAt,flickLanding} from './castleCardFlick';
import {CastleBridgePuzzle,bridgeCell} from './castleBridgePuzzle';
describe('bridge card flicks',()=>{
  it('integrates momentum and friction independently of frame rate',()=>{
    const coarse={x:0,z:65,vx:5,vz:-25},fine={...coarse};
    for(let i=0;i<15;i++)advanceCardGlide(coarse,1/15);for(let i=0;i<120;i++)advanceCardGlide(fine,1/120);
    expect(coarse.x).toBeCloseTo(fine.x,10);expect(coarse.z).toBeCloseTo(fine.z,10);expect(Math.hypot(coarse.vx,coarse.vz)).toBeLessThan(2);
  });
  it('predicts a legal landing and refuses occupied or incompatible neighbours',()=>{
    const model=new CastleBridgePuzzle();model.collect(0);const p=bridgeCell(4),legal=(slot:number)=>model.canPlace(slot,1);
    expect(flickLanding({x:p.x,z:57,vx:0,vz:-13.5},legal)).toBe(4);
    expect(cardSlotAt(p.x,p.z,slot=>model.canPlace(slot,2))).toBeUndefined();
    model.place(4,model.inventory.find(c=>c.rank===1)!.id);expect(cardSlotAt(p.x,p.z,legal)).toBeUndefined();
    expect(model.inventory).toHaveLength(3);expect(flickLanding({x:50,z:80,vx:0,vz:0},legal)).toBeUndefined();expect(model.inventory).toHaveLength(3);
  });
});
