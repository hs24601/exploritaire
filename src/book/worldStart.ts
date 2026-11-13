export type WorldStart='woods'|'grounds'|'painted-valley';
/** Explicit destinations override the entry page's existing default. */
export function worldStart(search:string,portalEntry:boolean):WorldStart{
 const params=new URLSearchParams(search);
 if(params.has('combat'))return 'woods';
 if(params.has('tree'))return 'grounds';
 if(params.has('valley'))return 'painted-valley';
 return portalEntry?'woods':'grounds';
}
