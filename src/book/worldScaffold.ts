export type WorldScaffold={id:string;from:{x:number;y:number;z:number};to:{x:number;y:number;z:number};heading:number;kind?:'mantle'|'climb90';speed?:number};
/** Explicit supported climb routes only; scenery walls are never auto-climbable.
 * Put this definition on a picked mesh's userData.worldScaffold to opt it in. */
export function scaffoldLength(s:WorldScaffold){return Math.hypot(s.to.x-s.from.x,s.to.y-s.from.y,s.to.z-s.from.z);}
