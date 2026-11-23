import {useSyncExternalStore} from 'react';
/** Master feature flag for every holographic card, including Bite's jaw shader. */
export const HOLOGRAPHIC_LENTICULAR_ENABLED=true;
export type HoloOpticsSettings={enabled:boolean;strength:number;pitch:number};
const defaults:HoloOpticsSettings={enabled:HOLOGRAPHIC_LENTICULAR_ENABLED,strength:.55,pitch:2.4};
const key='exploritaire:holographic-lenses-v1';
const bound=(value:unknown,fallback:number,min:number,max:number)=>typeof value==='number'&&Number.isFinite(value)?Math.max(min,Math.min(max,value)):fallback;
const sanitize=(value:Partial<HoloOpticsSettings>):HoloOpticsSettings=>({enabled:HOLOGRAPHIC_LENTICULAR_ENABLED&&(typeof value.enabled==='boolean'?value.enabled:defaults.enabled),strength:bound(value.strength,defaults.strength,0,1),pitch:bound(value.pitch,defaults.pitch,1.5,5)});
let current=defaults;
try{current=sanitize(JSON.parse(localStorage.getItem(key)??localStorage.getItem('musical-tableaus:bite-optics-v1')??'{}'));}catch{/* Optional local preference. */}
const reflectFlag=()=>{if(typeof document!=='undefined')document.documentElement.dataset.holographicLenticular=String(current.enabled);};
reflectFlag();
const listeners=new Set<()=>void>();
export const setHoloOpticsSettings=(patch:Partial<HoloOpticsSettings>)=>{current=sanitize({...current,...patch});reflectFlag();try{localStorage.setItem(key,JSON.stringify(current));}catch{/* Settings still work in memory. */}listeners.forEach(listener=>listener());};
export const useHoloOpticsSettings=()=>useSyncExternalStore(listener=>{listeners.add(listener);return()=>{listeners.delete(listener);};},()=>current,()=>defaults);
