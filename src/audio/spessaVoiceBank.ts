import {WorkletSynthesizer,Sequencer} from 'spessasynth_lib';
import processorUrl from 'spessasynth_lib/dist/spessasynth_processor.min.js?url';
import type {OrchestraInstrument,SampleRoute} from './orchestraSampler';
const instruments:Record<OrchestraInstrument,{channel:number;program:number}>={pizzicato:{channel:0,program:45},harp:{channel:1,program:46},flute:{channel:2,program:73},strings:{channel:3,program:48},bells:{channel:4,program:9}};
type Note={channel:number;midi:number;bed:boolean;timers:ReturnType<typeof setTimeout>[];started:boolean};
/** Owns cancellable note timers so switching palettes cannot resurrect queued notes. */
export class SpessaVoiceBank{
 private notes=new Set<Note>();
 private sequencer:Sequencer|null=null;
 private demoAbort:AbortController|null=null;
 private setup(){this.synth.reset();for(const {channel,program}of Object.values(instruments))for(const c of [channel,channel+5]){this.synth.programChange(c,program);this.synth.controllerChange(c,91,22);this.synth.controllerChange(c,93,0);}}
 async playDemo(onEnd:()=>void){
  this.stopDemo();this.stop();const abort=new AbortController();this.demoAbort=abort;
  const response=await fetch('/assets/runtime/audio/spessasynth/to-make-the-end-of-battle.mid',{signal:abort.signal});if(!response.ok)throw Error('Demo MIDI could not load.');const binary=await response.arrayBuffer();abort.signal.throwIfAborted();
  const seq=this.sequencer??(this.sequencer=new Sequencer(this.synth));seq.loopCount=0;
  seq.eventHandler.addEvent('songEnded','demo-end',()=>{this.stopDemo();onEnd();});
  await new Promise<void>((resolve,reject)=>{const timeout=setTimeout(()=>reject(Error('Demo loading timed out.')),15000);abort.signal.addEventListener('abort',()=>{clearTimeout(timeout);reject(abort.signal.reason);},{once:true});seq.eventHandler.addEvent('songChange','demo-load',()=>{clearTimeout(timeout);if(!abort.signal.aborted){seq.play();resolve();}});seq.loadNewSongList([{binary,fileName:'TO MAKE THE END OF BATTLE — SC-88 by kou1'}]);});
 }
 stopDemo(){this.demoAbort?.abort();this.demoAbort=null;this.sequencer?.pause();this.synth.stopAll(true);this.setup();}

 private constructor(private ctx:AudioContext,private synth:WorkletSynthesizer){}
 static async load(ctx:AudioContext,destination:AudioNode,signal:AbortSignal,progress:(loaded:number,total:number)=>void){
  if(!globalThis.isSecureContext||!ctx.audioWorklet)throw Error('Open on localhost or HTTPS to use SpessaSynth.');
  const response=await fetch('/assets/runtime/audio/spessasynth/GeneralUser-GS.sf2',{signal});if(!response.ok)throw Error('Sound bank could not load.');
  const total=Number(response.headers.get('content-length'))||32319396,reader=response.body?.getReader();let data:ArrayBuffer;
  if(reader){const chunks:Uint8Array[]=[];let loaded=0;for(;;){const part=await reader.read();if(part.done)break;chunks.push(part.value);loaded+=part.value.length;progress(loaded,total);}const bytes=new Uint8Array(loaded);let offset=0;for(const part of chunks){bytes.set(part,offset);offset+=part.length;}data=bytes.buffer;}else data=await response.arrayBuffer();
  signal.throwIfAborted();await ctx.audioWorklet.addModule(processorUrl);signal.throwIfAborted();
  const synth=new WorkletSynthesizer(ctx);
  try{await synth.isReady;signal.throwIfAborted();await synth.soundBankManager.addSoundBank(data,'generaluser');signal.throwIfAborted();synth.setSystemParameter('voiceCap',64);
   for(const {channel,program}of Object.values(instruments))for(const c of [channel,channel+5]){synth.programChange(c,program);synth.controllerChange(c,91,22);synth.controllerChange(c,93,0);}
   synth.connect(destination);return new SpessaVoiceBank(ctx,synth);
  }catch(error){synth.destroy();throw error;}
 }
 play(instrument:OrchestraInstrument,midi:number,at:number,duration:number,gain:number,options:Partial<SampleRoute>={}){
  if(this.notes.size>=64)return;const channel=instruments[instrument].channel+(options.bed?5:0),note:Note={channel,midi,bed:!!options.bed,timers:[],started:false};this.notes.add(note);
  const start=()=>{if(!this.notes.has(note))return;note.started=true;this.synth.controllerChange(channel,10,Math.round(64+(options.pan??0)*50));this.synth.noteOn(channel,midi,Math.max(15,Math.min(110,Math.round(gain*430))));note.timers.push(setTimeout(()=>{this.notes.delete(note);if(![...this.notes].some(n=>n.started&&n.channel===channel&&n.midi===midi))this.synth.noteOff(channel,midi);},duration*1000));};
  const wait=(at-this.ctx.currentTime)*1000;if(wait<15)start();else note.timers.push(setTimeout(start,wait));
 }
 stopBed(){for(const n of [...this.notes])if(n.bed){n.timers.forEach(clearTimeout);this.notes.delete(n);if(n.started)this.synth.noteOff(n.channel,n.midi);}}
 stop(){for(const n of this.notes)n.timers.forEach(clearTimeout);this.notes.clear();this.synth.stopAll(true);}
 dispose(){this.stopDemo();this.stop();this.synth.destroy();}
}
