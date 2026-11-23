export type SpellPaintPhase='hollow'|'waiting'|'sky-etch'|'sky-paint'|'transfer'|'card-etch'|'card-paint'|'complete';
const durations={'sky-etch':1.25,'sky-paint':1.45,transfer:1.05,'card-etch':.8,'card-paint':1.2} as const;
const steps=['sky-etch','sky-paint','transfer','card-etch','card-paint','complete'] as const;
/** Final legal receipt seals this chain; visual completion never adds power. */
export function createSpellPaintTransfer(){
 let phase:SpellPaintPhase='hollow',age=0,pending=false;
 return {
  reset(){phase='hollow';age=0;pending=false;},
  receipt(){pending=true;},
  exhausted(){if(phase==='hollow'&&pending){phase='waiting';age=0;}},
  update(dt:number,starsReady:boolean,reduced=false){
   if(phase==='hollow'||phase==='complete'){age+=dt;return;}
   if(phase==='waiting'){if(!starsReady)return;phase='sky-etch';age=0;}
   if(reduced){phase='complete';age=0;return;}
   age+=dt;
   while(phase!=='complete'&&age>=durations[phase]){age-=durations[phase];phase=steps[steps.indexOf(phase)+1];}
  },
  get busy(){return phase!=='hollow'&&phase!=='complete';},
  get state(){const progress=phase in durations?Math.min(1,age/durations[phase as keyof typeof durations]):0;return {phase,progress,pending,cardStroke:phase==='hollow'?Math.min(1,age/.65):phase==='card-etch'?progress:phase==='card-paint'||phase==='complete'?1:phase==='transfer'?0:1,cardFill:phase==='complete'?1:phase==='card-paint'?progress:0,skyStroke:phase==='sky-etch'?progress:phase==='sky-paint'||phase==='transfer'?1:0,skyFill:phase==='sky-paint'?progress:phase==='transfer'?1:0};}
 };
}
