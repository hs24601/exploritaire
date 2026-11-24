import {afterEach,beforeEach,describe,it,expect,vi} from 'vitest';
import {mountGridTableau} from './gridTableau.js';
// The model still has a table DOM adapter; this inert surface keeps these rule
// tests deterministic without launching a browser or emulating canvas/rendering.
class Surface{
 id='';parent?:Surface;children:Surface[]=[];dataset:Record<string,string>={};hidden=false;tabIndex=0;textContent='';innerHTML='';
 style:Record<string,unknown>&{setProperty:(key:string,value:string)=>void}={setProperty(){}};
 classList={add(){},remove(){},toggle(){}};
 appendChild(node:Surface){node.parent=this;this.children.push(node);return node;}
 getRootNode():Surface{return this.parent?.getRootNode()??this;}
 querySelector(selector:string):Surface|undefined{if(!selector.startsWith('#'))return new Surface();const id=selector.slice(1);return this.children.find(n=>n.id===id)||this.children.map(n=>n.querySelector(selector)).find(Boolean);}
 querySelectorAll(){return [];}
 setAttribute(){}addEventListener(){}replaceChildren(){this.children=[];}getBoundingClientRect(){return {width:900,height:700};}
}
beforeEach(()=>{vi.stubGlobal('document',{createElement:()=>new Surface()});vi.stubGlobal('ResizeObserver',class{observe(){}disconnect(){}});});
afterEach(()=>vi.unstubAllGlobals());
function model(onCard?:(card:{id:string;rank:number;suit:number},kind:'start'|'play'|'stock')=>boolean,pathField=true,stockReselect=false){const stage=new Surface(),board=new Surface();stage.appendChild(board);return mountGridTableau({stage:stage as unknown as HTMLElement,board:board as unknown as HTMLElement,seed:1234,pathField,denseBackfill:!pathField,stockReselect,onCard});}
describe('world path field model',()=>{
 it('plays beyond the first neighborhood and replaces every vacated tile',()=>{
  let receipts=0;const grid=model((_card,kind)=>{if(kind==='play')receipts++;return true;});const start=grid.state.field[18]!;expect(grid.activate(start)).toBe(true);
  for(const [index,rank]of [[18,5],[19,6],[20,7],[21,8]])grid.cards[grid.state.field[index]!].rank=rank;grid.setFoundationRank(5);
  const count=grid.state.field.filter(Boolean).length;
  for(const index of [19,20,21]){const previous=grid.state.fieldIndex!,old=grid.state.field[previous];expect(grid.activate(grid.state.field[index]!)).toBe(true);expect(grid.state.field[previous]).not.toBe(old);expect(grid.state.field.filter(Boolean)).toHaveLength(count);}
  expect(receipts).toBe(3);expect(grid.state.fieldIndex).toBe(21);grid.dispose();
 });
 it('rejects nonadjacent, wrong-rank, stale, and externally refused receipts',()=>{
  let refuse=false;const grid=model((_card,kind)=>!(refuse&&kind==='play'));grid.activate(grid.state.field[18]!);grid.setFoundationRank(5);
  const target=grid.state.field[19]!;grid.cards[target].rank=6;grid.cards[grid.state.field[20]!].rank=6;
  expect(grid.activate(grid.state.field[20]!)).toBe(false);expect(grid.activate('stale-card')).toBe(false);grid.cards[target].rank=10;expect(grid.activate(target)).toBe(false);
  grid.cards[target].rank=6;refuse=true;expect(grid.activate(target)).toBe(false);expect(grid.state.fieldIndex).toBe(18);expect(grid.state.found).toHaveLength(1);grid.dispose();
 });
 it('updates the current floor tile on a stock draw and permits A/K wrap',()=>{
  const grid=model();grid.activate(grid.state.field[18]!);grid.setFoundationRank(13);const id=grid.state.field[19]!;grid.cards[id].rank=1;expect(grid.activate(id)).toBe(true);
  const stock=grid.state.stock[grid.state.stock.length-1];expect(grid.activate(stock)).toBe(true);expect(grid.state.field[19]).toBe(stock);expect(grid.state.found[grid.state.found.length-1]).toBe(stock);grid.dispose();
 });
 it('auto-play chooses a longer known path rather than the first legal neighbor',()=>{
  const grid=model();grid.activate(grid.state.field[18]!);for(const id of grid.state.field)if(id)grid.cards[id].rank=10;
  for(const [index,rank]of [[18,5],[9,4],[19,6],[20,7],[21,8]])grid.cards[grid.state.field[index]!].rank=rank;grid.setFoundationRank(5);expect(grid.autoStep()).toBe(true);expect(grid.state.fieldIndex).toBe(19);grid.dispose();
 });
});
describe('source-style folded world field',()=>{
 it('reopens the full current field after a stellar stock draw and recommends a new foundation',()=>{
  const grid=model(undefined,false,true);grid.activate(grid.state.field[18]!);grid.setFoundationRank(5);const received=grid.state.slots.B3.top!;grid.cards[received].rank=6;grid.activate(received);
  const neighbor=grid.state.slots.A1.top!,stock=grid.state.stock[grid.state.stock.length-1],remaining=grid.state.stock.length;
  expect(grid.activate(stock)).toBe(true);expect(grid.state.phase).toBe('pick');expect(grid.state.stock).toHaveLength(remaining-1);expect(grid.state.field[18]).toBe(stock);expect(grid.state.field[9]).toBe(neighbor);expect(grid.state.field.filter(Boolean)).toHaveLength(40);expect(new Set(grid.state.field).size).toBe(40);expect(grid.bestSequence().kind).toBe('foundation');
  const hint=grid.bestSequence();expect(grid.activate(hint.id!)).toBe(true);expect(grid.state.found).toEqual([hint.id]);grid.dispose();
 });
 it('allows a new foundation search after the last stock card even when the old tableau has no legal play',()=>{
  const grid=model(undefined,false,true);grid.activate(grid.state.field[18]!);for(const card of Object.values(grid.cards))card.rank=10;grid.setFoundationRank(5);grid.state.stock=grid.state.stock.slice(-1);const id=grid.state.stock[0];expect(grid.activate(id)).toBe(true);expect(grid.state.phase).toBe('pick');expect(grid.state.stock).toHaveLength(0);expect(grid.state.over).toBeNull();expect(grid.state.field.filter(Boolean)).toHaveLength(40);grid.dispose();
 });
 it('advises the strongest starting foundation without changing the deal or firing receipts',()=>{
  let receipts=0;const grid=model(()=>{receipts++;return true;},false),before=JSON.stringify(grid.state),hint=grid.bestSequence();expect(hint.kind).toBe('foundation');expect(receipts).toBe(0);expect(JSON.stringify(grid.state)).toBe(before);
  let maximum=0;for(let r=1;r<4;r++)for(let c=1;c<7;c++){const other=model(undefined,false);other.activate(other.state.field[r*8+c]!);for(const card of Object.values(other.cards))if(card.id.startsWith('g'))card.rank=100;maximum=Math.max(maximum,other.bestSequence().length);other.dispose();}expect(hint.length).toBe(maximum);expect(grid.bestSequence(hint.id!).id).not.toBe(hint.id);grid.dispose();
 });
 it('shares the next best receipt with auto-play and returns home when no card is legal',()=>{
  const grid=model(undefined,false);grid.activate(grid.state.field[18]!);for(const card of Object.values(grid.cards))card.rank=10;grid.setFoundationRank(5);
  const slot=grid.state.slots.B3;grid.cards[slot.top!].rank=6;grid.cards[slot.s[0]].rank=7;grid.cards[slot.s[1]].rank=8;
  const before=JSON.stringify(grid.state),hint=grid.bestSequence();expect(hint.id).toBe(slot.top);expect(hint.length).toBeGreaterThanOrEqual(3);expect(grid.bestPath()[0]).toBe(hint.id);expect(grid.bestPath()).toHaveLength(hint.length);expect(JSON.stringify(grid.state)).toBe(before);expect(grid.autoStep()).toBe(true);expect(grid.state.found[grid.state.found.length-1]).toBe(hint.id);expect(grid.bestSequence().id).toBe(slot.top);
  for(const card of Object.values(grid.cards))card.rank=10;grid.setFoundationRank(5);expect(grid.bestSequence()).toEqual({id:grid.state.found[grid.state.found.length-1],kind:'return',length:0});grid.dispose();
 });
 it('includes A/K wrap and alternating corner backfill in Navi guidance',()=>{
  const grid=model(undefined,false);grid.activate(grid.state.field[18]!);for(const card of Object.values(grid.cards))card.rank=9;grid.setFoundationRank(13);const slot=grid.state.slots.A1;grid.cards[slot.top!].rank=1;grid.cards[slot.v[0]].rank=2;grid.cards[slot.s[0]].rank=3;
  expect(grid.bestSequence().length).toBeGreaterThanOrEqual(3);expect(grid.bestSequence().id).toBe(slot.top);grid.autoStep();expect(slot.turn).toBe('s');expect(grid.cards[grid.bestSequence().id!].rank).toBe(2);grid.autoStep();expect(grid.cards[grid.bestSequence().id!].rank).toBe(3);grid.dispose();
 });
 it('previews foundation, neighbors and backfill without committing a receipt',()=>{
  let receipts=0;const grid=model(()=>{receipts++;return true;},false),field=[...grid.state.field];expect(grid.preview(field[18]!)).toBe(true);expect(grid.state.phase).toBe('pick');expect(receipts).toBe(0);expect(grid.state.field).toEqual(field);expect(grid.preview(field[0]!)).toBe(false);expect(grid.preview(null)).toBe(true);expect(grid.state.phase).toBe('pick');grid.dispose();
 });
 it('alternates corner queues and reconstructs the same current cards when unfolded',()=>{
  const grid=model(undefined,false),original=[...grid.state.field];grid.activate(original[18]!);expect(grid.state.originIndex).toBe(18);grid.setFoundationRank(5);
  const slot=grid.state.slots.A1,received=slot.top!,incoming=slot.v[0];grid.cards[received].rank=6;expect(grid.activate(received)).toBe(true);expect(slot.top).toBe(incoming);expect(slot.turn).toBe('s');const stock=[...grid.state.stock],far=slot.v[0];
  expect(grid.reopen()).toBe(true);expect(grid.state.phase).toBe('pick');expect(grid.state.field[18]).toBe(received);expect(grid.state.field[9]).toBe(incoming);expect(grid.state.field[1]).toBe(far);expect(new Set(grid.state.field).size).toBe(40);expect(grid.state.stock).toEqual(stock);
  expect(grid.cancelReopen()).toBe(true);expect(grid.state.originIndex).toBe(18);expect(grid.state.slots.A1.turn).toBe('s');expect(grid.state.found[grid.state.found.length-1]).toBe(received);grid.dispose();
 });
 it('chooses a new non-neighbor foundation without redealing values or stock',()=>{
  const grid=model(undefined,false);grid.activate(grid.state.field[18]!);grid.reopen();const index=29,id=grid.state.field[index]!,rank=grid.cards[id].rank,stock=[...grid.state.stock];expect(grid.activate(id)).toBe(true);expect(grid.state.originIndex).toBe(index);expect(grid.cards[grid.state.found[grid.state.found.length-1]].rank).toBe(rank);expect(grid.state.stock).toEqual(stock);grid.dispose();
 });
});

