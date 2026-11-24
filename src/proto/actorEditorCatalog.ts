import { PROTO_ACTORS } from './protoData';
import { BANKS_CHARACTER } from './banksSprite';
import { KERU_DRAFTS, KERU_DRAFT_ART } from './keruDrafts';
import { ACTOR_HOLO_ART, ACTOR_HOLO_LAYERS } from './art/actorCardArt';

export type EditorEntity = { id: string; name: string; description: string; source: string; assets: string[] };
const files = Object.keys(import.meta.glob('/public/assets/**/*.{png,jpg,jpeg,webp,svg,gif}')).map(path => path.replace('/public/', import.meta.env.BASE_URL));
const hero = PROTO_ACTORS.find(actor => actor.id === 'hero')!;

/** Explicit authoring catalog: concepts are editable without claiming finished game art or mechanics. */
const roster = [
  { id: 'hero', name: 'Hero', description: `${hero.animalType} · ${hero.heroClass}` },
  { id: 'banks', name: BANKS_CHARACTER.name, description: BANKS_CHARACTER.description },
  { id: 'mochi', name: 'Mochi', description: 'Hero’s feline companion.' },
  ...['cir', 'dem'].map(id => { const actor = KERU_DRAFTS.find(item => item.id === id)!; return { id, name: actor.name, description: actor.identity }; }),
  { id: 'riv', name: 'Riv', description: 'A water-otter Keru and AP generator.' },
];
const concepts = [
  { id:'dewi', name:'Dewi', description:'Snowy owl · Whiteout. A light-hearted nod to Hedwig; her wings stir a blizzard.' },
  { id:'frodo', name:'Frodo', description:'Arctic stoat · Rime Retort concept. A small, resilient traveler with a fierce icy counterattack.' },
  { id:'brramble', name:'Brramble', description:'Snowy porcupine · Rime Retort concept. Frost gathers on its quills before an icy retaliation.' },
  { id:'achillies', name:'Achillies', description:'Ice tortoise · Rime Retort concept. A patient defender with a chill-themed Achilles pun.' },
  { id:'harecules', name:'Harecules', description:'Arctic hare · Rime Retort concept. A soft-looking hare with a heroic counterattack.' },
  { id:'skadi', name:'Skadi', description:'Winter fox · Rime Retort concept. A watchful counterfighter named for the Norse winter figure.' },
  { id:'keshet', name:'Keshet', description:'Arctic lynx · Rime Retort concept. Its frosty breath forms an icy bow; the name means bow or rainbow in Hebrew.' },
  { id:'galahail', name:'Galahail', description:'Narwhal · Glacial Lance concept. A knightly ice Keru with a piercing horn.' },
  { id:'fenrirr', name:'Fenrirr', description:'Frost wolf · Shatterstrike concept. Breaks through frozen defenses with a myth-inspired bite.' },
  { id:'snow-golem', name:'Snow Golem', description:'Summoned ice companion · Do you want to...? A secondary foundation with Glacial Lance and upkeep.' },
];

export const ACTOR_EDITOR_ENTITIES: EditorEntity[] = [...roster, ...concepts].map(actor => {
  const card = ACTOR_HOLO_ART[actor.id], keru = KERU_DRAFT_ART[actor.id];
  const assets = files.filter(path => path.toLowerCase().split(/[/.]/).some(segment => segment === actor.id || segment.startsWith(actor.id + '-')));
  const scene = actor.id === 'dewi' ? `${import.meta.env.BASE_URL}assets/runtime/ui/holocards/layered/whiteout-scene-no-hero-v1.png` : undefined;
  return { ...actor, source: concepts.some(item=>item.id===actor.id) ? 'Concept' : actor.id==='hero' ? 'Hero' : 'Keru', assets: [...new Set([
    ...(card ? [card, ...Object.values(ACTOR_HOLO_LAYERS[card] ?? {})] : []),
    ...(keru ? [keru.subject, keru.background] : []),
    ...(scene ? [scene] : []),
    ...assets,
  ])] };
});
