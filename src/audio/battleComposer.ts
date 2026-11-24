import type {MusicKey} from './musicScale';

export const COMPOSER_VERSION=2;
export function normalizeMusicSeed(value:string|number){return String(value).normalize('NFKC').trim();}
export function hashMusicSeed(value:string|number){let h=2166136261;for(const c of normalizeMusicSeed(value)){h^=c.codePointAt(0)!;h=Math.imul(h,16777619);}return h>>>0;}
export function seedRandom(seed:number){return()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t^=t+Math.imul(t^t>>>7,61|t);return((t^t>>>14)>>>0)/4294967296;};}
export function gentlePitchClasses(key:MusicKey){return(key.mode==='aeolian'||key.mode==='dorian'?[0,3,5,7,10]:[0,2,4,7,9]).map(n=>(key.root+n)%12);}
export function pitchesClash(a:number,b:number){const n=Math.abs(a-b)%12;return n===1||n===11||n===6||Math.min(a,b)<55&&Math.abs(a-b)>0&&Math.abs(a-b)<7;}
export type BattleTheme={seed:string;id:string;variation:number;bpm:number;melody:number[];rhythm:number[];chords:number[][];bass:number[];key:MusicKey};
export function composeBattleTheme(seed:string|number,key:MusicKey,variation=0):BattleTheme{
 const text=normalizeMusicSeed(seed),hash=hashMusicSeed(text),random=seedRandom(hashMusicSeed(`battle-v${COMPOSER_VERSION}:${text}:${variation}`)),minor=key.mode==='aeolian'||key.mode==='dorian',scale=minor?[0,3,5,7,10]:[0,2,4,7,9];
 // Chords share one semitone/tritone-free collection. Strong beats outline them.
 const shapes=minor?[[0,3,7],[3,7,10],[5,10,12],[7,10,15]]:[[0,4,7],[4,7,9],[2,7,12],[7,9,14]],order=[0,random()>.5?1:2,random()>.5?2:3,0],chords=order.map(i=>shapes[i].map(n=>key.root+n)),bass=order.map(i=>key.root-12+shapes[i][0]);
 const motifs=[[0,0,3,1],[0,2,0,4],[4,1,3,0],[0,3,1,3]],cell=motifs[Math.floor(random()*motifs.length)];let degree=Math.floor(random()*3);const melody:number[]=[],rhythm:number[]=[];
 for(let bar=0;bar<4;bar++)for(let beat=0;beat<4;beat++){
  degree=(cell[beat]+(bar%2===1?2:0)+(hash%2)+variation)%8;
  let note=key.root+scale[degree%5]+12*Math.floor(degree/5);
  if(beat===0)note=chords[bar][Math.floor(random()*3)];if(bar===3&&beat===3)note=key.root+12;
  melody.push(note);rhythm.push(beat===3?1.25:random()<.22?.5:.8);
 }
 return{seed:text,id:hash.toString(16).padStart(8,'0'),variation,bpm:88+hash%13,melody,rhythm,chords,bass,key:{...key}};
}

/** Values color a phrase; they are never scale-degree addresses. Event order and
 * chord position drive development, so repeated values need not repeat pitches. */
export function combatReceiptVoicing(theme:BattleTheme,value:number,event:number,intensity=0,enemy=false){
 const step=((event%16)+16)%16,bar=Math.floor(step/4),chord=theme.chords[bar];
 const choice=hashMusicSeed(`receipt-v2:${theme.seed}:${theme.variation}:${value}:${bar}:${enemy?'answer':'call'}`);
 let midi=step%4===0?chord[choice%chord.length]:theme.melody[(step+(choice%3)*4)%16];
 if(step===15)midi=theme.key.root;
 if(intensity>.6&&step%4===2)midi=chord[(choice+1)%chord.length]+12;
 if(enemy)midi=chord[(choice+bar)%chord.length]-24;
 else {while(midi>74)midi-=12;while(midi<50)midi+=12;}
 return {midi,harmony:chord.map(n=>n-12),bar,step};
}

type SoundingNote={midi:number;start:number;end:number};
/** Last gate before audio scheduling. Releases and room tails count as overlaps.
 * Unsafe candidates are moved to a permitted pitch; no candidate means a rest. */
export class HarmonyGuard{
 private notes:SoundingNote[]=[];
 protect(midi:number,start:number,duration:number,key:MusicKey,now:number,low=60,high=88){
  this.notes=this.notes.filter(n=>n.end>now);const classes=gentlePitchClasses(key),overlaps=this.notes.filter(n=>n.start<start+duration+3.1&&n.end>start);
  const candidates=Array.from({length:high-low+1},(_,i)=>low+i).filter(n=>classes.includes(n%12)).sort((a,b)=>Math.abs(a-midi)-Math.abs(b-midi)||a-b);
  const safe=candidates.find(n=>overlaps.every(o=>!pitchesClash(n,o.midi)));
  if(safe!==undefined)this.notes.push({midi:safe,start,end:start+duration+3.1});return safe;
 }
 clear(){this.notes=[];}
 get scheduled(){return this.notes.map(n=>({...n}));}
}
