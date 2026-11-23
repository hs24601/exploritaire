import type {SpessaVoiceBank} from './spessaVoiceBank';
import {composeBattleTheme,combatReceiptVoicing,HarmonyGuard,type BattleTheme} from './battleComposer';
import { chordMidi, comboCutoff, comboHarmony, degreeMidi, midiHz, rankMidi, type MusicKey } from './musicScale';
import {loadOrchestraSamples,OrchestraSampler} from './orchestraSampler';
import {constellationPhrase,leadChord} from './orchestraExpression';
import {renderOrchestraTextures,chamberImpulse} from './orchestraTextures';

/** Switchable synthesized / sampled chamber voices for musical tableaus.
 *
 * Voices follow the Emergent Mind generative-music study: a resonant pluck for
 * card plays, a soft triangle melody for combo harmony and constellation
 * motifs, a triangle+sine bass for enemy plays and a slow detuned pad bed.
 * Everything feeds a generated reverb and a dotted-eighth delay. Sounds start
 * the moment a play lands; nothing waits for a beat. */
export type ReceiptNote = { rank: number; combo: number; lane?: number; lanes?: number };

const BED_BPM = 72;
const BED_PROGRESSION = [0, 5, 3, 4] as const;
export type OrchestraState={phase:'idle'|'loading'|'ready'|'error';loaded:number;total:number};
export type SpessaState={phase:'idle'|'loading'|'ready'|'error'|'unavailable';progress:number;message?:string};
type PaletteBus={dry:GainNode;verb:GainNode;echo:GainNode};

class TableauMusic {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private music: GainNode | null = null;
  private reverb: GainNode | null = null;
  private delay: GainNode | null = null;
  private muted = false;
  private bedOn = false;
  private bedTimer: number | null = null;
  private bedBar = 0;
  private bedNext = 0;
  private demoState:'idle'|'loading'|'playing'|'error'='idle';
  private demoListeners=new Set<(s:'idle'|'loading'|'playing'|'error')=>void>();
  subscribeDemo(f:(s:'idle'|'loading'|'playing'|'error')=>void){this.demoListeners.add(f);f(this.demoState);return()=>{this.demoListeners.delete(f);};}
  private notifyDemo(s:'idle'|'loading'|'playing'|'error'){this.demoState=s;this.demoListeners.forEach(f=>f(s));}
  async playDemo(){if(!this.spessaActive||this.muted)return;this.stopDemo();this.notifyDemo('loading');this.stopBed();this.stopTextures();this.orchestra?.stop();for(const osc of this.synthSources){try{osc.stop();}catch{}}this.synthSources.clear();this.percussion?.gain.setTargetAtTime(0,this.ctx!.currentTime,.05);
    try{await this.spessa!.playDemo(()=>this.stopDemo());if(this.demoState==='loading')this.notifyDemo('playing');}catch{if(this.demoState==='loading'){this.stopDemo();this.notifyDemo('error');}}
  }
  stopDemo(){this.spessa?.stopDemo();this.notifyDemo('idle');this.setBattleIntensity(this.intensity);if(this.bedOn&&this.ctx)this.startBed();}
  private get demoActive(){return this.demoState==='loading'||this.demoState==='playing';}
  private spessaWanted=false;
  private spessa:SpessaVoiceBank|null=null;
  private spessaState:SpessaState={phase:'idle',progress:0};
  private spessaListeners=new Set<(s:SpessaState)=>void>();
  private spessaAbort:AbortController|null=null;
  subscribeSpessa(listener:(s:SpessaState)=>void){this.spessaListeners.add(listener);listener(this.spessaState);return()=>{this.spessaListeners.delete(listener);};}
  private notifySpessa(s:SpessaState){this.spessaState=s;this.spessaListeners.forEach(f=>f(s));}
  setSpessa(on:boolean){if(!on)this.stopDemo();this.spessaWanted=on;if(!on)this.spessa?.stop();this.selectPalette();if(on)void this.prepareSpessa();}
  private async prepareSpessa(){
    const ctx=this.ctx;if(!ctx||this.spessa||this.spessaAbort)return;
    if(!globalThis.isSecureContext||!ctx.audioWorklet){this.notifySpessa({phase:'unavailable',progress:0,message:'Open on localhost or HTTPS for SpessaSynth. Current instruments remain available.'});return;}
    const abort=new AbortController();this.spessaAbort=abort;this.notifySpessa({phase:'loading',progress:0});
    try{const {SpessaVoiceBank}=await import('./spessaVoiceBank');const bank=await SpessaVoiceBank.load(ctx,this.buses!.orchestra.dry,abort.signal,(loaded,total)=>{if(!abort.signal.aborted)this.notifySpessa({phase:'loading',progress:Math.min(.99,loaded/total)});});if(abort.signal.aborted||this.ctx!==ctx){bank.dispose();return;}this.spessa=bank;this.notifySpessa({phase:'ready',progress:1});this.selectPalette();}
    catch(error){if(!abort.signal.aborted)this.notifySpessa({phase:'error',progress:0,message:'Sound bank could not start. Current instruments remain available; tap Retry.'});}
    finally{if(this.spessaAbort===abort)this.spessaAbort=null;}
  }
  private get spessaActive(){return this.spessaWanted&&!!this.spessa;}
  previewInstrument(){const ctx=this.ready();if(!ctx||this.muted||this.demoActive)return;this.playReceipt({rank:5,combo:0});}
  private orchestraWanted=false;
  private orchestra:OrchestraSampler|null=null;
  private orchestraState:OrchestraState={phase:'idle',loaded:0,total:0};
  private orchestraListeners=new Set<(state:OrchestraState)=>void>();
  private orchestraLoading:Promise<void>|null=null;
  private orchestraAbort:AbortController|null=null;
  private buses:Record<'synth'|'orchestra'|'bed',PaletteBus>|null=null;
  private synthSources=new Set<OscillatorNode>();
  private activeOrchestra=false;
  private activeBackend='synth';
  private textures=new Map<string,AudioBuffer>();
  private textureVoices=new Set<{source:AudioBufferSourceNode;amp:GainNode}>();
  private lastVoicing:number[]=[];
  private receiptIndex=0;
  private combatEvent=0;
  private battleTheme:BattleTheme|null=null;
  private harmony=new HarmonyGuard();
  private intensity=0;
  private percussion:GainNode|null=null;
  private noise:AudioBuffer|null=null;
  private previewUntil=0;
  setBattleTheme(seed:string|number,variation=0){
    this.combatEvent=0;
    this.battleTheme=composeBattleTheme(seed,this.key,variation);
    this.stopBed();this.stopTextures();this.orchestra?.stopBed();this.spessa?.stopBed();this.bedBar=0;this.previewUntil=0;
    if(this.bedOn&&this.ctx)this.startBed();return this.battleTheme;
  }
  setBattleIntensity(value:number){this.intensity=Math.max(0,Math.min(1,value));if(this.ctx&&this.percussion)this.percussion.gain.setTargetAtTime(this.bedOn?this.intensity:0,this.ctx.currentTime,.65);}
  private safe(midi:number,at:number,length:number,low=60,high=88){return this.battleTheme?this.harmony.protect(midi,at,length,this.key,this.ctx!.currentTime,low,high):midi;}
  private sample(...args:Parameters<OrchestraSampler['play']>){const [instrument,midi,at,length,gain,options]=args;const safe=this.safe(midi,at,length+(options?.release??1),instrument==='strings'||instrument==='pizzicato'?48:60,instrument==='bells'?96:instrument==='pizzicato'?77:88);if(safe!==undefined){if(this.spessaActive)this.spessa!.play(instrument,safe,at,length,gain,options);else this.orchestra!.play(instrument,safe,at,length,gain,options);}}
  previewTheme(){const ctx=this.ready();if(!ctx||this.muted||this.demoActive||!this.battleTheme||ctx.currentTime<this.previewUntil)return;this.previewUntil=ctx.currentTime+8*60/this.battleTheme.bpm;for(let i=0;i<8;i++)this.themeBeat(i,ctx.currentTime+.08+i*60/this.battleTheme.bpm,true);this.bedNext=this.previewUntil+.1;}
  private drum(at:number,accent:boolean,preview=false){
    const ctx=this.ctx!;if(!this.percussion){this.percussion=ctx.createGain();this.percussion.gain.value=this.bedOn?this.intensity:0;this.percussion.connect(this.master!);}
    if(!this.noise){this.noise=ctx.createBuffer(1,ctx.sampleRate*.3,ctx.sampleRate);const data=this.noise.getChannelData(0);for(let i=0;i<data.length;i++)data[i]=(Math.random()*2-1)*(1-i/data.length)**3;}
    const source=ctx.createBufferSource(),filter=ctx.createBiquadFilter(),amp=ctx.createGain();source.buffer=this.noise;filter.type=accent?'lowpass':'highpass';filter.frequency.value=accent?260:3800;amp.gain.setValueAtTime(accent?.26:.055,at);amp.gain.exponentialRampToValueAtTime(.0001,at+.22);source.connect(filter);filter.connect(amp);amp.connect(preview?this.master!:this.percussion);source.onended=()=>{source.disconnect();filter.disconnect();amp.disconnect();};source.start(at);source.stop(at+.3);
  }
  private themeBeat(beat:number,at:number,preview=false){
    const t=this.battleTheme!;const step=60/t.bpm,index=beat%16,bar=Math.floor(index/4);
    if(index%4===0){for(const [i,n]of t.chords[bar].entries()){if(this.orchestral)this.sample('strings',n-12,at+i*.055,step*3.5,.025,{bed:true,verb:.2,attack:.3,release:.6});else this.melody(n,at+i*.055,step*3.2,.012,-.3+i*.3);}}
    if(this.orchestral)this.sample('harp',t.melody[index],at,step*t.rhythm[index],.075,{bed:!preview,verb:.2});else this.melody(t.melody[index],at,step*t.rhythm[index],.035);
    this.drum(at,index%4===0,preview);if(index%2===1)this.drum(at+step*.5,false,preview);
  }
  key: MusicKey = { root: 62, mode: 'dorian' };

  /** Create or resume the context. Call from a pointer or key handler: browsers only start audio after a gesture. */
  unlock(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    const Ctor = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    if (!this.ctx) {
      const ctx = new Ctor();
      this.ctx = ctx;
      const limiter = ctx.createDynamicsCompressor();
      limiter.threshold.value = -16; limiter.ratio.value = 3;
      limiter.connect(ctx.destination);
      this.master = ctx.createGain(); this.master.gain.value = this.muted ? 0 : 0.8; this.master.connect(limiter);
      this.music = ctx.createGain(); this.music.gain.value = 1; this.music.connect(this.master);
      // Generated stereo-noise impulse: about 3 s of decaying room, no file.
      const convolver = ctx.createConvolver(), length = Math.floor(ctx.sampleRate * 3), impulse = ctx.createBuffer(2, length, ctx.sampleRate);
      for (let channel = 0; channel < 2; channel++) {
        const data = impulse.getChannelData(channel);
        for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length) ** 2.6;
      }
      convolver.buffer = impulse;
      this.reverb = ctx.createGain(); this.reverb.gain.value = 0.5; this.reverb.connect(convolver); convolver.connect(this.master);
      // Dotted-eighth echo, lowpassed so repeats sit behind the dry note.
      const echo = ctx.createDelay(2), feedback = ctx.createGain(), tone = ctx.createBiquadFilter(), wet = ctx.createGain();
      echo.delayTime.value = 60 / BED_BPM * 0.75; feedback.gain.value = 0.34; tone.type = 'lowpass'; tone.frequency.value = 2600; wet.gain.value = 0.45;
      this.delay = ctx.createGain(); this.delay.connect(echo);
      echo.connect(tone); tone.connect(feedback); feedback.connect(echo); tone.connect(wet); wet.connect(this.master); wet.connect(this.reverb);
      const hall=ctx.createConvolver(),hallInput=ctx.createBiquadFilter(),hallTone=ctx.createBiquadFilter();hall.buffer=chamberImpulse(ctx);hallInput.type='highpass';hallInput.frequency.value=180;hallTone.type='lowpass';hallTone.frequency.value=6200;hallInput.connect(hall);hall.connect(hallTone);hallTone.connect(this.master);
      const bus=(orchestral=false):PaletteBus=>{const dry=ctx.createGain(),verb=ctx.createGain(),echo=ctx.createGain();dry.connect(this.music!);verb.connect(orchestral||this.battleTheme?hallInput:this.reverb!);echo.connect(this.delay!);return {dry,verb,echo};};
      this.buses={synth:bus(),orchestra:bus(true),bed:bus(true)};this.selectPalette(true);
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
    if (this.bedOn) this.startBed();
    if(this.spessaWanted&&!this.spessa&&this.spessaState.phase!=='error'&&this.spessaState.phase!=='unavailable')void this.prepareSpessa();
    if(this.orchestraWanted&&!this.orchestra&&this.orchestraState.phase!=='error')void this.prepareOrchestra();
    return this.ctx;
  }

  private ready() { return this.ctx && this.ctx.state !== 'closed' && this.music && this.reverb && this.delay ? this.ctx : null; }

  private route(source: AudioNode, { pan = 0, dry = 1, verb = 0, echo = 0,orchestra=false,bed=false }: { pan?: number; dry?: number; verb?: number; echo?: number;orchestra?:boolean;bed?:boolean }) {
    const ctx = this.ctx!, panner = ctx.createStereoPanner();
    panner.pan.value = Math.max(-0.85, Math.min(0.85, pan));
    source.connect(panner);
    const gains:GainNode[]=[],bus=this.buses![orchestra?(bed?'bed':'orchestra'):'synth'];
    const send = (target: AudioNode, amount: number) => { if (amount <= 0 || this.battleTheme&&target===bus.echo) return; const gain = ctx.createGain(); gain.gain.value = amount; panner.connect(gain); gain.connect(target);gains.push(gain); };
    send(bus.dry, dry); send(bus.verb, verb); send(bus.echo, echo);
    return ()=>{source.disconnect(panner);panner.disconnect();gains.forEach(g=>g.disconnect());};
  }

  private oscillator(){const osc=this.ctx!.createOscillator();this.synthSources.add(osc);osc.onended=()=>this.synthSources.delete(osc);return osc;}
  private get orchestral(){return this.spessaActive||this.orchestraWanted&&!!this.orchestra;}
  private notifyOrchestra(state:OrchestraState){this.orchestraState=state;for(const listener of this.orchestraListeners)listener(state);}
  subscribeOrchestra(listener:(state:OrchestraState)=>void){this.orchestraListeners.add(listener);listener(this.orchestraState);return()=>{this.orchestraListeners.delete(listener);};}
  setOrchestral(on:boolean){this.orchestraWanted=on;this.selectPalette();if(on&&!this.orchestra)void this.prepareOrchestra();}
  private selectPalette(force=false){
    const ctx=this.ctx;if(!ctx||!this.buses)return;
    const orchestral=this.orchestral;const backend=this.spessaActive?'spessa':orchestral?'orchestra':'synth';if(!force&&backend===this.activeBackend)return;this.activeBackend=backend;this.activeOrchestra=orchestral;
    for(const [name,bus]of Object.entries(this.buses))for(const gain of Object.values(bus)){gain.gain.cancelScheduledValues(ctx.currentTime);gain.gain.setTargetAtTime((name==='synth')!==orchestral?1:0,ctx.currentTime,.035);}
    this.stopTextures();this.lastVoicing=[];this.orchestra?.stop();this.spessa?.stop();for(const osc of this.synthSources){try{osc.stop(ctx.currentTime+.25);}catch{/* Already stopped. */}}this.synthSources.clear();
    // Restart the bed now, rather than waiting for the next long chord boundary.
    if(this.bedTimer!==null){this.stopBed();this.startBed();}
  }
  private prepareOrchestra(){
    const ctx=this.ctx;if(!ctx||ctx.state==='closed'||this.orchestra)return Promise.resolve();if(this.orchestraLoading)return this.orchestraLoading;
    const abort=new AbortController();this.orchestraAbort=abort;this.notifyOrchestra({phase:'loading',loaded:0,total:34});
    this.orchestraLoading=loadOrchestraSamples(ctx,abort.signal,(loaded,total)=>{if(this.ctx===ctx&&!abort.signal.aborted)this.notifyOrchestra({phase:'loading',loaded,total});}).then(async samples=>{
      if(this.ctx!==ctx||abort.signal.aborted)return;
      const textures=await renderOrchestraTextures(samples,abort.signal);if(this.ctx!==ctx||abort.signal.aborted)return;this.textures=textures;
      this.orchestra=new OrchestraSampler(ctx,samples,(node,options)=>this.route(node,{...options,orchestra:true}));this.notifyOrchestra({phase:'ready',loaded:samples.length,total:samples.length});if(this.orchestraWanted)this.selectPalette();
    }).catch(()=>{if(this.ctx===ctx&&!abort.signal.aborted){this.notifyOrchestra({phase:'error',loaded:0,total:34});abort.abort();}}).finally(()=>{if(this.orchestraAbort===abort){this.orchestraLoading=null;this.orchestraAbort=null;}});
    return this.orchestraLoading;
  }

  /** Synth fallback for plucked cello: rounded fundamental, brief woody attack. */
  private pluck(midi: number, at: number, cutoff: number, gain: number, pan: number) {
    const safe=this.safe(midi,at,1.6,48,77);if(safe===undefined)return;midi=safe;
    const ctx = this.ctx!, filter = ctx.createBiquadFilter(), amp = ctx.createGain(), hz = midiHz(midi);
    filter.type = 'lowpass'; filter.Q.value = .7;
    filter.frequency.setValueAtTime(cutoff, at); filter.frequency.exponentialRampToValueAtTime(480, at + 0.2);
    amp.gain.setValueAtTime(0.0001, at); amp.gain.exponentialRampToValueAtTime(gain, at + 0.004); amp.gain.setTargetAtTime(0.0001, at + 0.02, 0.24);
    for (const [type, level] of [['sine', 1], ['triangle', .45]] as const) {
      const osc = this.oscillator(), mix = ctx.createGain();
      osc.type = type; osc.frequency.value = hz; mix.gain.value = level;
      osc.connect(mix); mix.connect(filter); osc.start(at); osc.stop(at + 1.6);
      if(type==='triangle')osc.onended=()=>{this.synthSources.delete(osc);clean();filter.disconnect();amp.disconnect();};
    }
    filter.connect(amp);
    const clean=this.route(amp, { pan, dry: 0.8, verb: 0.3, echo: 0.4 });
  }

  /** Melody voice: triangle with a quiet octave sine and vibrato fading in. */
  private melody(midi: number, at: number, length: number, gain: number, pan = 0.15) {
    const safe=this.safe(midi,at,length+2);if(safe===undefined)return;midi=safe;
    const ctx = this.ctx!, amp = ctx.createGain(), hz = midiHz(midi), vibrato = this.oscillator(), depth = ctx.createGain();
    vibrato.frequency.value = 5.2; depth.gain.setValueAtTime(0, at); depth.gain.linearRampToValueAtTime(hz * 0.004, at + Math.min(0.5, length));
    vibrato.connect(depth);
    amp.gain.setValueAtTime(0.0001, at); amp.gain.exponentialRampToValueAtTime(gain, at + 0.035);
    amp.gain.setValueAtTime(gain * 0.8, at + length); amp.gain.setTargetAtTime(0.0001, at + length, 0.35);
    for (const [type, mult, level] of [['triangle', 1, 1], ['sine', 2, 0.25]] as const) {
      const osc = this.oscillator(), mix = ctx.createGain();
      osc.type = type; osc.frequency.value = hz * mult; mix.gain.value = level; depth.connect(osc.frequency);
      osc.connect(mix); mix.connect(amp); osc.start(at); osc.stop(at + length + 2);
    }
    vibrato.start(at); vibrato.stop(at + length + 2);
    const clean=this.route(amp, { pan, dry: 0.85, verb: 0.55, echo: 0.3 });
    vibrato.onended=()=>{this.synthSources.delete(vibrato);vibrato.disconnect();depth.disconnect();clean();amp.disconnect();};
  }

  /** A party foundation receipt. */
  playReceipt(note: ReceiptNote) {
    const ctx = this.ready(); if (!ctx || this.muted || this.demoActive) return;
    const at = ctx.currentTime + 0.005, lanes = note.lanes ?? 1;
    const pan = lanes > 1 && note.lane !== undefined ? (note.lane / (lanes - 1)) * 1.2 - 0.6 : 0;
    const phrase=this.battleTheme?combatReceiptVoicing(this.battleTheme,note.rank,this.combatEvent++,this.intensity):null;
    const pitch=phrase?.midi??rankMidi(this.key,note.rank)-12;
    const harmony=phrase?(note.combo>=10?phrase.harmony.slice(1):note.combo>=5?phrase.harmony.slice(1,2):[]):comboHarmony(this.key,note.rank,note.combo).map(n=>n-12);
    if(this.orchestral){
      const variation=++this.receiptIndex;this.sample('pizzicato',pitch,at,.65,.22*(1+.08*Math.sin(variation*2.4)), {pan:pan*.7,verb:.16,echo:0,priority:4,detune:Math.sin(variation*1.7)*1.4});
      harmony.forEach((midi,index)=>this.sample('strings',midi,at+.01*(index+1),.48,.045,{pan:pan*.6,verb:.25}));return;
    }
    this.pluck(pitch, at, Math.min(1800,comboCutoff(note.combo)), 0.16, pan);
    harmony.forEach((midi, index) => this.melody(midi, at + 0.01 * (index + 1), 0.28, 0.05));
  }

  /** An enemy foundation receipt: a soft bass pluck two octaves down. */
  playEnemyReceipt(rank: number) {
    const ctx = this.ready(); if (!ctx || this.muted || this.demoActive) return;
    const at = ctx.currentTime + 0.005, pitch=this.battleTheme?combatReceiptVoicing(this.battleTheme,rank,this.combatEvent++,this.intensity,true).midi:rankMidi(this.key,rank)-24, note=this.safe(pitch,at,1.2,36,55);if(note===undefined)return;
    const hz = midiHz(note), filter = ctx.createBiquadFilter(), amp = ctx.createGain();
    filter.type = 'lowpass'; filter.frequency.setValueAtTime(900, at); filter.frequency.exponentialRampToValueAtTime(260, at + 0.25);
    amp.gain.setValueAtTime(0.0001, at); amp.gain.exponentialRampToValueAtTime(0.22, at + 0.008); amp.gain.setTargetAtTime(0.0001, at + 0.05, 0.16);
    for (const [type, mult] of [['triangle', 1], ['sine', 0.5]] as const) {
      const osc = this.oscillator(); osc.type = type; osc.frequency.value = hz * (this.battleTheme?1:mult); osc.connect(filter); osc.start(at); osc.stop(at + 1.2);
    }
    filter.connect(amp);
    this.route(amp, { pan: 0, dry: 1, verb: 0.12,orchestra:this.orchestral });
  }

  /** A completed constellation sings its stars as a short rising phrase that resolves to the root. */
  playMotif(degrees: readonly number[]) {
    const ctx = this.ready(); if (!ctx || this.muted || this.demoActive) return;
    const at = ctx.currentTime + 0.08, step = 60 / BED_BPM / 2;
    if(this.orchestral){
      const phrase=constellationPhrase(degrees,step),last=phrase[phrase.length-1];if(!last)return;
      phrase.forEach((n,index)=>{const final=index===phrase.length-1,note=this.battleTheme?combatReceiptVoicing(this.battleTheme,n.degree,index,this.intensity).midi+12:degreeMidi(this.key,n.degree);
        this.sample('flute',note,at+n.at,n.length,n.gain,{pan:.12,verb:.22,attack:n.attack,release:n.release,expression:n.expression,detune:Math.sin(index*1.3)*1.2});
        if(final){
          this.sample('bells',note+12,at+n.at+.11,2,.055,{pan:-.23,verb:.32,echo:0});
          this.sample('harp',note,at+n.at+.035,1.8,.13,{pan:-.12,verb:.2});
          const voicing=leadChord([0,2,4].map(d=>degreeMidi(this.key,n.degree+d)-12));voicing.forEach((midi,i)=>this.sample('strings',midi,at+Math.max(0,n.at-step)+i*.065,step*4,.048,{pan:(i-1)*.24,verb:.25,attack:.32+i*.04,expression:.6,release:1}));
        }
      });
      const until=at+last.at+last.length+.5;
      for(const gate of Object.values(this.buses!.bed)){const g=gate.gain;g.cancelScheduledValues(ctx.currentTime);g.setTargetAtTime(.35,ctx.currentTime,.08);g.setTargetAtTime(1,until,.45);}return;
    }
    degrees.forEach((degree, index) => this.melody(this.battleTheme?combatReceiptVoicing(this.battleTheme,degree,index,this.intensity).midi+12:degreeMidi(this.key, degree) + 12, at + index * step, index === degrees.length - 1 ? step * 3 : step * 0.9, index === degrees.length - 1 ? 0.11 : 0.08, 0.15 - index * 0.04));
  }

  private padChord(degree: number, at: number, length: number) {
    const ctx = this.ctx!;
    if(this.orchestral){
      const texture=!this.spessaActive&&this.key.root===62?this.textures.get(this.key.mode+':'+degree):undefined;
      if(texture){const source=ctx.createBufferSource(),amp=ctx.createGain();source.buffer=texture;amp.gain.value=.24;source.connect(amp);const clean=this.route(amp,{orchestra:true,bed:true,dry:.85,verb:.22});const voice={source,amp};this.textureVoices.add(voice);source.onended=()=>{this.textureVoices.delete(voice);source.disconnect();clean();amp.disconnect();};source.start(at);return;}
      const notes=leadChord(chordMidi(this.key,degree).map(n=>n-12),this.lastVoicing);this.lastVoicing=notes;
      notes.forEach((midi,index)=>this.sample('strings',midi,at+index*.12,length,.03,{pan:(index%2?1:-1)*.35,verb:.24,bed:true,expression:.65}));return;
    }
    chordMidi(this.key, degree).forEach((midi, index) => {
      const note = midi - 12, amp = ctx.createGain(), filter = ctx.createBiquadFilter();
      filter.type = 'lowpass'; filter.Q.value = 0.6;
      filter.frequency.setValueAtTime(380, at); filter.frequency.linearRampToValueAtTime(1000, at + length * 0.5); filter.frequency.linearRampToValueAtTime(480, at + length);
      amp.gain.setValueAtTime(0.0001, at); amp.gain.linearRampToValueAtTime(0.016, at + length * 0.3); amp.gain.setValueAtTime(0.016, at + length * 0.85); amp.gain.setTargetAtTime(0.0001, at + length * 0.85, 0.4);
      for (const cents of [-7, 7]) {
        const osc = this.oscillator(); osc.type = 'sawtooth'; osc.frequency.value = midiHz(note); osc.detune.value = cents + (Math.random() * 4 - 2);
        osc.connect(filter); osc.start(at); osc.stop(at + length + 2);
      }
      filter.connect(amp);
      this.route(amp, { pan: (index % 2 ? 1 : -1) * 0.5, dry: 0.7, verb: 0.6 });
    });
  }

  /** The night bed: one pad chord per two bars, scheduled ahead on the audio clock. */
  private startBed() {
    if (this.bedTimer !== null || !this.ctx || this.demoActive) return;
    this.bedNext = this.ctx.currentTime + 0.1;
    const bar = this.battleTheme?60/this.battleTheme.bpm:60 / BED_BPM * 4 * 2;
    const tick = () => {
      const ctx = this.ready();
      if (!ctx) return;
      if(this.bedNext<ctx.currentTime-.25)this.bedNext=ctx.currentTime+.02;
      while (this.bedNext < ctx.currentTime + 0.15) {
        if (!this.muted && ctx.state === 'running'&&this.bedNext>=this.previewUntil) {if(this.battleTheme)this.themeBeat(this.bedBar,this.bedNext);else this.padChord(BED_PROGRESSION[this.bedBar % BED_PROGRESSION.length], this.bedNext, bar * 1.05);}
        this.bedNext += bar; this.bedBar += 1;
      }
    };
    tick();
    this.bedTimer = window.setInterval(tick, 50);
  }

  private stopTextures(){const ctx=this.ctx;if(!ctx)return;for(const v of this.textureVoices){v.amp.gain.setTargetAtTime(0,ctx.currentTime,.06);try{v.source.stop(ctx.currentTime+.3);}catch{}}this.textureVoices.clear();}

  private stopBed() { if (this.bedTimer !== null) window.clearInterval(this.bedTimer); this.bedTimer = null; }

  setBed(on: boolean) { this.bedOn = on; this.setBattleIntensity(this.intensity); if (on && this.ctx) this.startBed(); else {this.stopBed();this.stopTextures();this.orchestra?.stopBed();this.spessa?.stopBed();} }

  setMuted(muted: boolean) {
    this.muted = muted;if(muted){this.stopDemo();this.spessa?.stop();}
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(muted ? 0 : 0.8, this.ctx.currentTime, 0.15);
  }

  /** Stop the bed and close the context (page unmount, hot reload). */
  dispose() { this.spessaAbort?.abort();this.spessaAbort=null;this.spessa?.dispose();this.spessa=null;this.stopBed();this.stopTextures();this.textures.clear();this.orchestraAbort?.abort();this.orchestraAbort=null;this.orchestraLoading=null;this.orchestra?.dispose();this.orchestra=null;this.synthSources.clear();void this.ctx?.close(); this.ctx = null; this.master = this.music = this.reverb = this.delay = null;this.buses=null;this.orchestraState={phase:'idle',loaded:0,total:0}; }
}

export const createTableauMusic = () => new TableauMusic();
export type TableauMusicEngine = ReturnType<typeof createTableauMusic>;
