import { useSyncExternalStore } from 'react';
export type MotifActor = 'hero' | 'mochi';
export type MotifOptions = { enabled: boolean; strength: number; depth: number; hidden: readonly string[]; furOverlap: boolean };
export type ActorMotif = { id: string; label: string; x: number; y: number; w: number; h: number; rotation: number; asset?: string; furRoot?: boolean };
export const ACTOR_MOTIFS: Record<MotifActor, readonly ActorMotif[]> = {
 hero: [
  {id:'hero-shoulder-left',label:'Left shoulder flame fur',x:0,y:35.97,w:27.21,h:22.56,rotation:0},
  {id:'hero-shoulder-right',label:'Right shoulder flame fur',x:71.91,y:39.90,w:26.24,h:21.58,rotation:0},
  {id:'hero-paw',label:'Paw flame fur',x:9.72,y:62.79,w:23.32,h:16.35,rotation:0},
 ],
 mochi: [
  {id:'mochi-raised-vine-guard',label:'Raised foreleg vine guard',x:68,y:54,w:27,h:14,rotation:0,asset:'v3/mochi-raised-vine-guard.png',furRoot:true},
  {id:'mochi-front-vine-guard',label:'Standing foreleg vine guard',x:69,y:74,w:31,h:15,rotation:0,asset:'v3/mochi-front-vine-guard.png',furRoot:true},
  {id:'mochi-hind-left-vine-guard',label:'Outer hind-leg vine guard',x:4,y:74,w:30,h:12,rotation:0,asset:'v3/mochi-hind-vine-guard.png',furRoot:true},
  {id:'mochi-hind-inner-vine-guard',label:'Inner hind-leg vine guard',x:42,y:71,w:24,h:12,rotation:0,asset:'v3/mochi-hind-vine-guard.png',furRoot:true},
 ],
};
const store: { options: Record<MotifActor, MotifOptions>; listeners: Set<() => void> } = import.meta.hot?.data.motifStore ?? { options: {
 hero:{enabled:true,strength:1,depth:1,hidden:[],furOverlap:true},mochi:{enabled:true,strength:1,depth:1,hidden:[],furOverlap:true},
}, listeners: new Set<() => void>() };
// Controls and mounted portraits must keep one store across Vite module updates.
if (import.meta.hot) import.meta.hot.data.motifStore = store;
const listeners = store.listeners;
const subscribe = (notify: () => void) => { listeners.add(notify); return () => { listeners.delete(notify); }; };
/** Presentation-only session options; original paintings and gameplay never change. */
export function setActorMotifOptions(actor: MotifActor, patch: Partial<MotifOptions>) {
 store.options = {...store.options,[actor]:{...store.options[actor],...patch,
  ...(patch.strength === undefined ? {} : {strength:Number.isFinite(patch.strength)?Math.max(0,Math.min(1,patch.strength)):1}),
  ...(patch.depth === undefined ? {} : {depth:Number.isFinite(patch.depth)?Math.max(0,Math.min(2,patch.depth)):1}),
 }};
 listeners.forEach(notify => notify());
}
export const useActorMotifOptions = (actor: MotifActor) => useSyncExternalStore(subscribe,() => store.options[actor],() => store.options[actor]);


