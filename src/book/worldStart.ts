export type WorldStart='woods'|'grounds'|'painted-valley'|'paint-lab'|'longs';
/** Explicit destinations override the entry page's existing default. */
export function worldStart(search:string,portalEntry:boolean):WorldStart{
 const params=new URLSearchParams(search);
 if(params.has('combat'))return 'woods';
 if(params.has('tree'))return 'grounds';
 if(params.has('valley'))return 'painted-valley';
 if(params.has('cardpaintlab'))return 'paint-lab';
 if(params.has('longs'))return 'longs';
 return portalEntry?'woods':'grounds';
}
