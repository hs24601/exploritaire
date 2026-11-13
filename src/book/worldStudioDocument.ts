export type Vec3=[number,number,number];
export type StudioProp={id:string;name:string;kind:'tree'|'rock';position:Vec3;yaw:number;scale:number};
export type StudioShot={id:string;name:string;position:Vec3;target:Vec3;fov:number};
export type StudioAtmosphere={smokeWisps:boolean;smokeDensity:number;buoyancy:number;swirl:number};
export const STUDIO_ATMOSPHERE_DEFAULTS:StudioAtmosphere={smokeWisps:false,smokeDensity:.6,buoyancy:3,swirl:.35};
export type WorldStudioDocument={version:1;page:1110|1111;revision:number;paint:{enabled:boolean;size:number;coverage:number;relief:number;variation:number;palette:'autumn-wood'|'darker-autumn'|'grove'|'ochre'|'moonlit';seed:number};ground:{density:number;height:number;width:number;curl:number;wind:number;moss:number;wetness:number};atmosphere?:StudioAtmosphere;field:{size:64;growth:number[];wet:number[]};props:StudioProp[];shots:StudioShot[]};
export const WORLD_STUDIO_DEFAULTS:WorldStudioDocument={version:1,page:1110,revision:0,paint:{enabled:true,size:1.25,coverage:.8,relief:.16,variation:.16,palette:'autumn-wood',seed:1110},ground:{density:.75,height:.55,width:.075,curl:1.1,wind:.22,moss:.62,wetness:.25},atmosphere:{...STUDIO_ATMOSPHERE_DEFAULTS},field:{size:64,growth:[],wet:[]},props:[],shots:[]};
const number=(n:unknown,min:number,max:number)=>typeof n==='number'&&Number.isFinite(n)&&n>=min&&n<=max;
const vector=(v:unknown):v is Vec3=>Array.isArray(v)&&v.length===3&&v.every(n=>number(n,-3000,3000));
const text=(v:unknown)=>typeof v==='string'&&v.length>0&&v.length<=100;
const keys=(value:object,allowed:string[])=>Object.keys(value).every(key=>allowed.includes(key));
export function validWorldStudioDocument(value:unknown,expectedPage?:1110|1111):value is WorldStudioDocument{
 if(!value||typeof value!=='object')return false;const d=value as WorldStudioDocument,p=d.paint,g=d.ground;
 if(d.version!==1||![1110,1111].includes(d.page)||(expectedPage!==undefined&&d.page!==expectedPage)||!Number.isInteger(d.revision)||d.revision<0||!p||!g||!d.field||!Array.isArray(d.props)||!Array.isArray(d.shots))return false;
 if(!keys(d,['version','page','revision','paint','ground','atmosphere','field','props','shots'])||!keys(p,['enabled','size','coverage','relief','variation','palette','seed'])||!keys(g,['density','height','width','curl','wind','moss','wetness'])||!keys(d.field,['size','growth','wet']))return false;
 if(d.atmosphere!==undefined){const a=d.atmosphere;if(!a||typeof a!=='object'||!keys(a,['smokeWisps','smokeDensity','buoyancy','swirl'])||typeof a.smokeWisps!=='boolean'||!number(a.smokeDensity,0,1)||!number(a.buoyancy,0,6)||!number(a.swirl,0,1))return false;}
 if(typeof p.enabled!=='boolean'||!number(p.size,.25,4)||!number(p.coverage,0,1)||!number(p.relief,0,.6)||!number(p.variation,0,.5)||!['autumn-wood','darker-autumn','grove','ochre','moonlit'].includes(p.palette)||!Number.isInteger(p.seed)||p.seed<1||p.seed>99999)return false;
 if(!number(g.density,0,1)||!number(g.height,.1,1.4)||!number(g.width,.015,.15)||!number(g.curl,0,2.5)||!number(g.wind,0,1.5)||!number(g.moss,0,1)||!number(g.wetness,0,1))return false;
 if(d.field.size!==64||![d.field.growth,d.field.wet].every(a=>Array.isArray(a)&&(a.length===0||a.length===4096)&&a.every(n=>number(n,0,1))))return false;
 if(d.props.length>200||d.shots.length>40)return false;
 if(!d.props.every(p=>p&&typeof p==='object'&&keys(p,['id','name','kind','position','yaw','scale'])&&text(p.id)&&text(p.name)&&['tree','rock'].includes(p.kind)&&vector(p.position)&&number(p.yaw,-360,360)&&number(p.scale,.15,6)))return false;
 if(!d.shots.every(s=>s&&typeof s==='object'&&keys(s,['id','name','position','target','fov'])&&text(s.id)&&text(s.name)&&vector(s.position)&&vector(s.target)&&number(s.fov,15,100)))return false;
 return new Set(d.props.map(p=>p.id)).size===d.props.length&&new Set(d.shots.map(p=>p.id)).size===d.shots.length;
}
export function freshWorldStudioDocument(page:1110|1111=1110){return {...structuredClone(WORLD_STUDIO_DEFAULTS),page};}
