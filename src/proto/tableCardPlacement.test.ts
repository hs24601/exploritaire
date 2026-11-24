import { expect, it } from 'vitest';
import { settleTableCard, TABLE_CARD_WIDTH, CARD_RATIO } from './tableCardPlacement';
it('preserves fractional table positions in free space',()=>{expect(settleTableCard({x:12.3,y:41.7},TABLE_CARD_WIDTH,3,[])).toEqual({x:12.3,y:41.7});});
it('moves a tilted card clear of a solid footprint',()=>{const solid={x:0,y:0,width:96,height:96};const angle=4;const p=settleTableCard({x:0,y:0},TABLE_CARD_WIDTH,angle,[solid])!;const a=angle*Math.PI/180;const w=Math.cos(a)*TABLE_CARD_WIDTH+Math.sin(a)*TABLE_CARD_WIDTH/CARD_RATIO;const h=Math.sin(a)*TABLE_CARD_WIDTH+Math.cos(a)*TABLE_CARD_WIDTH/CARD_RATIO;expect(Math.abs(p.x)>solid.width/2+w/2||Math.abs(p.y)>solid.height/2+h/2).toBe(true);});
