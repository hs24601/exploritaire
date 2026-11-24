import {describe,it,expect} from 'vitest';
import {createFoundationTapConfirmation} from './foundationTap';
describe('foundation double click/tap confirmation',()=>{
 it('previews the first tap and confirms a rapid repeat on the same card exactly once',()=>{
  const input=createFoundationTapConfirmation();expect(input.tap('K8',0)).toBe(false);expect(input.tap('K8',200)).toBe(true);expect(input.tap('K8',250)).toBe(false);
 });
 it('keeps different cards and slow repeats as previews',()=>{
  const input=createFoundationTapConfirmation();expect(input.tap('K8',0)).toBe(false);expect(input.tap('L8',100)).toBe(false);expect(input.tap('L8',700)).toBe(false);expect(input.tap('L8',900)).toBe(true);
 });
 it('does not confirm across a drag, pinch, cancellation, pause or other reset',()=>{
  const input=createFoundationTapConfirmation();input.tap('K8',0);input.reset();expect(input.tap('K8',100)).toBe(false);
 });
});
