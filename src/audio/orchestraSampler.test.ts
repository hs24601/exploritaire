import {describe,it,expect,vi} from 'vitest';
import {nearestOrchestraSample,samplePlaybackRate,OrchestraSampler,loadOrchestraSamples,type LoadedOrchestraSample} from './orchestraSampler';
import manifest from '../../public/assets/runtime/audio/constellation-orchestra/v1/manifest.json';

describe('orchestral sample routing',()=>{
 it('uses the SFZ MIDI centers rather than filename octave labels',()=>{
  const flute=manifest.samples.find(s=>s.instrument==='flute'&&s.root===69)!;
  expect(flute.source).toContain('A3');expect(samplePlaybackRate(69,flute.root)).toBe(1);
  expect(samplePlaybackRate(81,69)).toBe(2);expect(samplePlaybackRate(57,69)).toBe(.5);
 });
 it('chooses the closest zone only within the requested instrument',()=>{
  const samples=[{instrument:'flute' as const,root:60,file:'a.wav'},{instrument:'flute' as const,root:72,file:'b.wav'},{instrument:'bells' as const,root:65,file:'c.wav'}];
  expect(nearestOrchestraSample(samples,'flute',65)?.root).toBe(60);expect(nearestOrchestraSample(samples,'flute',70)?.root).toBe(72);expect(nearestOrchestraSample(samples,'strings',70)).toBeUndefined();
 });
 it('ships bounded, versioned assets with valid loop points',()=>{
  expect(manifest.samples).toHaveLength(34);expect(manifest.sampleCommit).toMatch(/^[a-f\d]{40}$/);expect(manifest.samples.reduce((n,s)=>n+s.bytes,0)).toBeLessThan(10e6);
  for(const s of manifest.samples){expect(s.sha256).toMatch(/^[a-f\d]{64}$/);if('loopStart'in s){expect(s.loopStart).toBeGreaterThan(0);expect(s.loopEnd!).toBeGreaterThan(s.loopStart!);expect(s.loopEnd!).toBeLessThanOrEqual(s.duration);}}
 });
 it('keeps polyphony bounded and stops queued notes when the palette changes',()=>{
  const param=()=>({value:0,setValueAtTime:vi.fn(),linearRampToValueAtTime:vi.fn(),setTargetAtTime:vi.fn(),cancelAndHoldAtTime:vi.fn(),cancelScheduledValues:vi.fn()}),sources:any[]=[];
  const ctx={currentTime:0,createBufferSource:()=>{const s={playbackRate:{value:1},connect:vi.fn(),disconnect:vi.fn(),start:vi.fn(),stop:vi.fn()};sources.push(s);return s;},createGain:()=>({gain:param(),connect:vi.fn(),disconnect:vi.fn()})} as unknown as AudioContext;
  const samples=[{instrument:'flute',root:60,file:'x.wav',buffer:{duration:4}},{instrument:'harp',root:60,file:'y.wav',buffer:{duration:4}}] as LoadedOrchestraSample[],sampler=new OrchestraSampler(ctx,samples,()=>()=>{});
  for(let i=0;i<60;i++)sampler.play('flute',60,10+i*.1,.3,.1);
  expect(sampler.activeVoices).toBe(32);expect(sampler.play('harp',60,.01,.3,.2,{priority:4})).toBe(true);expect(sampler.activeVoices).toBe(32);sampler.stop();expect(sampler.activeVoices).toBe(0);expect(sources.every(s=>s.stop.mock.calls.some((a:number[])=>a[0]<1))).toBe(true);
 });
 it('rejects a failed sample fetch so the engine can retain its synth fallback',async()=>{
  vi.stubGlobal('fetch',vi.fn().mockResolvedValueOnce({ok:true,json:async()=>({samples:[{instrument:'flute',root:60,file:'test.wav'}]})}).mockResolvedValue({ok:false}));
  try{await expect(loadOrchestraSamples({} as BaseAudioContext,new AbortController().signal,()=>{})).rejects.toThrow('sample could not load');}finally{vi.unstubAllGlobals();}
 });
});
