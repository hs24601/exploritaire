import { describe,it,expect,vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
vi.mock('./CardJumbo',()=>({useCardJumbo:()=>null}));
vi.mock('./EventCard',()=>({EventCard:()=>null}));
vi.mock('./useTableauDrag',()=>({useTableauDrag:()=>({})}));
import { ProtoCard } from './ProtoCard';
describe('plain numeric tableau values',()=>{
 it('retains standard 10/J/Q/K faces when numeric mode is omitted',()=>{
  for(const [rank,label] of [[10,'10'],[11,'J'],[12,'Q'],[13,'K']] as const){
   const html=renderToStaticMarkup(<ProtoCard card={{id:'face-'+rank,rank}} centerRank/>);
   expect(html).toMatch(new RegExp('proto-card-value-ink[^>]*>'+label+'<'));
  }
 });
 it('prints 1 instead of Ace in numeric scenarios while preserving legacy labels',()=>{
  const numeric=renderToStaticMarkup(<ProtoCard card={{id:'one',rank:1}} numericRanks centerRank/>);
  const legacy=renderToStaticMarkup(<ProtoCard card={{id:'one',rank:1}} centerRank/>);
  expect(numeric).toMatch(/proto-card-value-ink[^>]*>1</);expect(legacy).toMatch(/proto-card-value-ink[^>]*>A</);
 });
});
