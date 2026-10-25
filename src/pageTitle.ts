import { COMBAT_SANDBOX_SCENARIOS } from './proto/rules/battleSandboxScenarios';

const labels:Record<string,string>={combatsbx:'Combat Sandbox',combatAbilities:'Combat Abilities',motifsbx:'Actor Motifs',kerusbx:'Keru Drafts',demsbx:'Dem Draft',momentumsbx:'Momentum Lab','khad-combat':'Khad Combat',herosbx:'Hero Fur Lab','khad-compare':'Khad Comparison',bushsbx:'Bush Sandbox',woodsbx:'Woods Sandbox',combatdemo:'Battle Camera',holdlog:'Hold Log',gyrolog:'Gyro Diagnostics',fx:'Effects',cinema:'Cinematics',element:'Element',scene:'Scene',scenario:'Scenario',propRenderer:'Prop Renderer',groundRenderer:'Ground Renderer',atmosphere:'Atmosphere','hero-orbit':'Hero Orbit','khad-geometry':'Khad Geometry','khad-paint':'Khad Paint'};
const readable=(key:string)=>labels[key] ?? key.replace(/([a-z])([A-Z])/g,'$1 $2').replace(/[-_.]+/g,' ').replace(/\b\w/g,c=>c.toUpperCase());
/** Every query entry contributes to the title, including unknown and repeated keys. */
export function pageTitle(search:string,baseTitle:string):string {
 const params=new URLSearchParams(search),parts:string[]=[];
 const scenarios=params.getAll('scenario');
 for(const scenario of scenarios){
  const combat=params.has('combatsbx')?COMBAT_SANDBOX_SCENARIOS.find(item=>item.id===scenario):undefined;
  parts.push(combat?combat.name.replace(/^\d+:\s*/, ''):scenario==='ember-explore'?'Hearth Exploration':'Scenario: '+scenario);
 }
 for(const [key,value] of params){
  if(key==='scenario')continue;
  parts.push(readable(key)+(value?': '+value:''));
 }
 return parts.length?[...parts,baseTitle.replace(/^Proto\s*[-·]\s*(?=Exploritaire$)/, '')].join(' · '):baseTitle;
}
