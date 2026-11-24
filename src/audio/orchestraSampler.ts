/** Selected VSCO CE samples, hosted locally. No AudioWorklet or runtime SFZ parser. */
export type OrchestraInstrument='harp'|'flute'|'strings'|'bells'|'pizzicato';
export type OrchestraSample={instrument:OrchestraInstrument;root:number;file:string;loopStart?:number;loopEnd?:number};
export type LoadedOrchestraSample=OrchestraSample&{buffer:AudioBuffer};
export type SampleRoute={pan:number;verb:number;echo:number;bed?:boolean;attack?:number;release?:number;expression?:number;detune?:number};
const BASE='/assets/runtime/audio/constellation-orchestra/v1/';

export function nearestOrchestraSample<T extends OrchestraSample>(samples:readonly T[],instrument:OrchestraInstrument,midi:number):T|undefined{
 return samples.filter(s=>s.instrument===instrument).reduce<T|undefined>((best,s)=>!best||Math.abs(s.root-midi)<Math.abs(best.root-midi)?s:best,undefined);
}
export const samplePlaybackRate=(midi:number,root:number)=>2**((midi-root)/12);

export async function loadOrchestraSamples(ctx:BaseAudioContext,signal:AbortSignal,progress:(loaded:number,total:number)=>void){
 const manifestResponse=await fetch(BASE+'manifest.json',{signal});if(!manifestResponse.ok)throw Error('Orchestra manifest could not load');
 const manifest=await manifestResponse.json() as {samples:OrchestraSample[]};
 if(!Array.isArray(manifest.samples)||!manifest.samples.length||manifest.samples.length>64||manifest.samples.some(s=>!['harp','flute','strings','bells','pizzicato'].includes(s.instrument)||!Number.isFinite(s.root)||!/^[-\w]+\.wav$/.test(s.file)))throw Error('Invalid orchestra manifest');
 const samples=manifest.samples,result:LoadedOrchestraSample[]=new Array(samples.length);let cursor=0,done=0;progress(0,samples.length);
 // Keep network/decode work bounded rather than bursting all instruments at once.
 await Promise.all(Array.from({length:3},async()=>{while(cursor<samples.length){const index=cursor++,s=samples[index],response=await fetch(BASE+s.file,{signal});if(!response.ok)throw Error('Orchestra sample could not load: '+s.file);const buffer=await ctx.decodeAudioData(await response.arrayBuffer());if(signal.aborted)throw Error('Orchestra loading cancelled');result[index]={...s,buffer};progress(++done,samples.length);}}));
 return result;
}

type Voice={source:AudioBufferSourceNode;amp:GainNode;gain:number;priority:number;bed:boolean;stop:()=>void};
export class OrchestraSampler{
 private voices=new Set<Voice>();
 readonly limit=32;
 constructor(private ctx:AudioContext,readonly samples:LoadedOrchestraSample[],private route:(node:AudioNode,options:SampleRoute)=>()=>void){}
 play(instrument:OrchestraInstrument,midi:number,at:number,duration:number,gain:number,options:Partial<SampleRoute>&{priority?:number}={}){
  const sample=nearestOrchestraSample(this.samples,instrument,midi);if(!sample)return false;
  const ctx=this.ctx,priority=options.priority??(instrument==='flute'?3:instrument==='bells'?2:instrument==='harp'?1:0);
  if(this.voices.size>=this.limit){const weakest=[...this.voices].sort((a,b)=>a.priority-b.priority||a.gain-b.gain)[0];if(weakest.priority>priority)return false;weakest.stop();}
  const source=ctx.createBufferSource(),amp=ctx.createGain(),rate=samplePlaybackRate(midi,sample.root),start=Math.max(ctx.currentTime+.003,at),attack=options.attack??(instrument==='strings'?(options.bed?.7:.18):instrument==='flute'?.012:.004),release=options.release??(instrument==='strings'?.8:instrument==='flute'?.18:.35);
  source.buffer=sample.buffer;source.playbackRate.value=rate;if(options.detune&&source.detune)source.detune.value=options.detune;
  if(sample.loopStart!==undefined&&sample.loopEnd!==undefined){source.loop=true;source.loopStart=sample.loopStart;source.loopEnd=sample.loopEnd;}
  const end=source.loop?start+duration+release:Math.min(start+duration+release,start+sample.buffer.duration/rate),hold=Math.max(start+attack,Math.min(start+duration,end-.04));
  amp.gain.setValueAtTime(0,start);amp.gain.linearRampToValueAtTime(gain*.82,start+Math.min(attack,duration*.4));amp.gain.linearRampToValueAtTime(gain,start+Math.min(duration*.65,Math.max(attack,.4)));amp.gain.linearRampToValueAtTime(gain*(options.expression??1),hold);amp.gain.linearRampToValueAtTime(0,Math.max(hold+.01,end));source.connect(amp);
  const cleanRoute=this.route(amp,{pan:options.pan??0,verb:options.verb??.3,echo:options.echo??0,bed:options.bed});
  const voice:Voice={source,amp,gain,priority,bed:!!options.bed,stop:()=>{if(!this.voices.delete(voice))return;const now=ctx.currentTime;if(amp.gain.cancelAndHoldAtTime)amp.gain.cancelAndHoldAtTime(now);else amp.gain.cancelScheduledValues(now);amp.gain.setTargetAtTime(0,now,.008);try{source.stop(now+.04);}catch{/* Already ended. */}}};
  source.onended=()=>{this.voices.delete(voice);source.disconnect();cleanRoute();amp.disconnect();};this.voices.add(voice);source.start(start);source.stop(Math.max(start+.02,end));return true;
 }
 stop(){for(const voice of [...this.voices])voice.stop();}
 stopBed(){for(const voice of [...this.voices])if(voice.bed)voice.stop();}
 get activeVoices(){return this.voices.size;}
 dispose(){this.stop();this.samples.length=0;}
}
