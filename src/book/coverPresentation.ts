const clamp=(n:number)=>Math.max(0,Math.min(1,n));
const ease=(n:number)=>{const t=clamp(n);return t*t*(3-2*t);};
/** Cached page artwork owns the moving cover; independent live mechanisms
 * follow its opening angle throughout the hinge motion. */
export function sampleCoverPresentation(progress:number,opening:boolean,foldFrom=1){
 const t=clamp(progress),boundary=opening ? .78 : .22;
 if(opening){const live=t>=boundary,openness=ease(t/boundary);return {live,openness,popup:openness,stage:live?'raising-popups':'opening-cover'};}
 const live=t<boundary;
 const openness=1-ease((t-boundary)/(1-boundary));
 return {live,openness,popup:foldFrom*openness,stage:live?'folding-popups':'closing-cover'};
}
/** Match the fixed page planes, travelling leaves and gutter exactly. */
export const BOOK_PAGE_FRAME={width:5.8,depth:7.5,center:2.95,flatY:.145,leafY:.15,insideOffset:-.051} as const;
