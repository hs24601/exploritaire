import { describe, it, expect, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
vi.mock('./ActorHoloCard',()=>({ActorHoloCard:()=>null}));
import { PlayerFoundationFace } from './BattleUnits';
import { newActor } from '../rules/battle';

describe('active foundation health presentation',()=>{
 it('shows separate, labeled live leader and Seed HP without merging their pools',()=>{
  const html=renderToStaticMarkup(<PlayerFoundationFace actor={{...newActor('aldan-seed'),hp:23}} leaderId="hero" leader={{...newActor('hero'),hp:7}} events={[]} portraitRef={()=>{}}/>);
  expect(html).toContain('aria-label="Hero leader HP · protected by Aldan Seed"');
  expect(html).toContain('aria-label="Aldan Seed HP"');
  const text=html.replace(/<[^>]*>/g,'');expect(text).toContain('7/32');expect(text).toContain('Seed 23/40');
  expect(html).toContain('data-keru-portrait="hero"');
  expect(html).toContain('hero-happy-emoji-v1.png');
  expect(html).not.toContain('aldan-seed-watercolor-v1.png');
 });
 it('uses the replacement leader’s own HP',()=>{
  const html=renderToStaticMarkup(<PlayerFoundationFace actor={newActor('aldan-seed')} leaderId="dem" leader={{...newActor('dem'),hp:4}} events={[]} portraitRef={()=>{}}/>);
  expect(html).toContain('Dem leader HP');expect(html.replace(/<[^>]*>/g,'')).toContain('4/40');expect(html).not.toContain('Hero leader HP');
  expect(html).toContain('data-keru-portrait="dem"');expect(html).toContain('aria-label="Dem · happy"');
 });
});
