import {chordMidi,type MusicKey} from './musicScale';
import {nearestOrchestraSample,samplePlaybackRate,type LoadedOrchestraSample} from './orchestraSampler';

/** A restrained room with a short pre-delay, discrete early reflections and a
 * darkening diffuse tail. Seeded so palette comparisons share the same room. */
export function chamberImpulse(ctx:BaseAudioContext){
 const buffer=ctx.createBuffer(2,Math.ceil(ctx.sampleRate*2.2),ctx.sampleRate);let seed=8123;
 for(let channel=0;channel<2;channel++){const data=buffer.getChannelData(channel);let low=0;
  for(let i=Math.floor(ctx.sampleRate*.028);i<data.length;i++){seed=(Math.imul(seed,1664525)+1013904223)|0;const noise=(seed>>>0)/2147483648-1,t=i/ctx.sampleRate;low+=(noise-low)*(.4*Math.exp(-t*1.8));data[i]=low*.035*Math.exp(-t*3);}
  for(const [seconds,gain]of [[.041,.5],[.067,.31],[.103,.19],[.151,.09]])data[Math.floor((seconds+channel*.007)*ctx.sampleRate)]+=gain;
 }return buffer;
}

/** Bake performed string layers once, off the live audio graph. No extra downloads.
 * Staggered bow entrances, changing dynamics and a darker distant layer avoid
 * the static, simultaneous sustained chord of a basic MIDI pad. */
export async function renderOrchestraTextures(samples:LoadedOrchestraSample[],signal:AbortSignal){
 const textures=new Map<string,AudioBuffer>();
 if(typeof OfflineAudioContext==='undefined')return textures;
 for(const mode of ['aeolian','lydian'] as const)for(const degree of [0,5,3,4]){
  if(signal.aborted)return textures;
  const ctx=new OfflineAudioContext(2,Math.ceil(9*22050),22050),key:MusicKey={root:62,mode};
  const filter=ctx.createBiquadFilter();filter.type='lowpass';filter.frequency.setValueAtTime(1100,0);filter.frequency.linearRampToValueAtTime(2400,4.5);filter.frequency.linearRampToValueAtTime(900,9);filter.connect(ctx.destination);
  chordMidi(key,degree).forEach((note,i)=>{const midi=note-12,s=nearestOrchestraSample(samples,'strings',midi);if(!s)return;
   for(let layer=0;layer<2;layer++){const source=ctx.createBufferSource(),amp=ctx.createGain(),pan=ctx.createStereoPanner(),start=.15+i*.14+layer*.32,peak=layer?.06:.13;
    source.buffer=s.buffer;source.playbackRate.value=samplePlaybackRate(midi,s.root);source.detune.value=(i%2?1:-1)*(layer?2:0);source.loop=true;source.loopStart=s.loopStart??1.45;source.loopEnd=s.loopEnd??3.65;
    pan.pan.value=(i%2?1:-1)*(layer?.58:.32);amp.gain.setValueAtTime(0,start);amp.gain.linearRampToValueAtTime(peak*.55,2+i*.1);amp.gain.linearRampToValueAtTime(peak,4.1+layer*.4);amp.gain.linearRampToValueAtTime(peak*.62,6);amp.gain.linearRampToValueAtTime(0,8.8);
    source.connect(amp);amp.connect(pan);pan.connect(filter);source.start(start);source.stop(9);
   }
  });
  textures.set(mode+':'+degree,await ctx.startRendering());
 }
 return textures;
}
