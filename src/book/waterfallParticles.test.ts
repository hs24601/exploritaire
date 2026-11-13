import {describe,it,expect} from 'vitest';
import {advanceFallingStroke,WaterfallParticles,type FallingStroke} from './waterfallParticles';

describe('waterfall gravity emitter',()=>{
  const stroke=():FallingStroke=>({x:30,y:0,vy:0,width:3,height:12,ink:.1,active:true});
  it('accelerates straight down independently of frame rate',()=>{
    const a=stroke(),b=stroke();
    for(let i=0;i<60;i++)advanceFallingStroke(a,1/60,98,1000);
    for(let i=0;i<30;i++)advanceFallingStroke(b,1/30,98,1000);
    expect(a.x).toBe(30);expect(a.y).toBeCloseTo(49);expect(a.vy).toBeCloseTo(98);
    expect(b.y).toBeCloseTo(a.y);expect(b.vy).toBeCloseTo(a.vy);
  });
  it('detects impact at the stroke tip, including a long stroke beyond the first emission group',()=>{
    const p=stroke();p.y=85;
    expect(advanceFallingStroke(p,.1,98,100)).toBe(false);
    expect(advanceFallingStroke(p,.2,98,100)).toBe(true);
  });
  it('recycles every expired stroke into bounded base bubbles over prolonged use',()=>{
    for(const low of [false,true]){
      const model=new WaterfallParticles(128,256,36,low);
      const strokes=model.particles,bubbles=model.bubbles;
      for(let i=0;i<1800;i++)model.step(1/30);
      expect(model.particles).toBe(strokes);expect(model.bubbles).toBe(bubbles);
      expect(strokes.length).toBe(low?160:320);expect(bubbles.length).toBe(low?24:48);
      expect(strokes.some(p=>p.active)).toBe(true);expect(bubbles.some(b=>b.active)).toBe(true);
      for(const p of strokes.filter(p=>p.active)){expect(p.y+p.height).toBeLessThan(246);expect(p.x).toBeGreaterThan(9);expect(p.x).toBeLessThan(119);}
      for(const b of bubbles.filter(b=>b.active))expect(b.y).toBeGreaterThan(240);
    }
  });
});
