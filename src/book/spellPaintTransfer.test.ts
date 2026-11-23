import {describe,it,expect} from 'vitest';
import {createSpellPaintTransfer} from './spellPaintTransfer';
describe('Fireball paint transfer',()=>{
 it('does not paint without a receipt or before the final star arrives',()=>{const p=createSpellPaintTransfer();p.exhausted();expect(p.busy).toBe(false);p.receipt();p.exhausted();p.update(20,false);expect(p.state.phase).toBe('waiting');expect(p.state.cardFill).toBe(0);});
 it('etches then paints the sky, transfers, then etches and paints the card',()=>{const p=createSpellPaintTransfer();p.receipt();p.exhausted();p.update(.5,true);expect(p.state.phase).toBe('sky-etch');expect(p.state.skyFill).toBe(0);p.update(.75,true);expect(p.state.phase).toBe('sky-paint');p.update(1.45,true);expect(p.state.phase).toBe('transfer');expect(p.state.cardFill).toBe(0);p.update(1.05,true);expect(p.state.phase).toBe('card-etch');p.update(.8,true);expect(p.state.phase).toBe('card-paint');p.update(1.2,true);expect(p.state.cardFill).toBe(1);expect(p.busy).toBe(false);});
 it('snaps for reduced motion and resets a new foundation to hollow',()=>{const p=createSpellPaintTransfer();p.receipt();p.exhausted();p.update(0,true,true);expect(p.state.phase).toBe('complete');p.reset();p.update(1,false);expect(p.state.cardStroke).toBe(1);expect(p.state.cardFill).toBe(0);});
});
