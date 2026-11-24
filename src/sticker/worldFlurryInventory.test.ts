import {it,expect,vi} from 'vitest';
import {readWorldFlurry,saveWorldFlurry,unstickWorldFlurry} from './worldFlurryInventory';
const legacyKey='exploritaire.world1111.snowflee';
it('retains the collected sticker and unique enhancement without studio data',()=>{
 const values=new Map<string,string>();vi.stubGlobal('localStorage',{getItem:(key:string)=>values.get(key)??null,setItem:(key:string,value:string)=>values.set(key,value)});
 try{expect(readWorldFlurry()).toBeUndefined();expect(saveWorldFlurry('available')).toBe(true);expect(readWorldFlurry()).toBe('available');
  const reward={kinId:'hero',memory:{x:.5,y:.4,enhancement:'Fetch' as const}};expect(saveWorldFlurry(reward)).toBe(true);expect(readWorldFlurry()).toEqual(reward);expect([...values.keys()]).toEqual(['exploritaire.world1111.flurry']);
  expect(unstickWorldFlurry()).toBe(true);expect(readWorldFlurry()).toBe('available');expect(unstickWorldFlurry()).toBe(false);expect(saveWorldFlurry(reward)).toBe(true);expect(readWorldFlurry()).toEqual(reward);
  vi.stubGlobal('localStorage',{getItem:()=>{throw Error('blocked');},setItem:()=>{throw Error('blocked');}});expect(saveWorldFlurry('available')).toBe(false);expect(readWorldFlurry()).toBe('available');
 }finally{vi.unstubAllGlobals();}
});

it('migrates both collected and attached legacy stickers without losing their enhancement',async()=>{
 for(const reward of ['available',{kinId:'hero',memory:{x:.5,y:.4,enhancement:'Fetch'}}]){
  vi.resetModules();const inventory=await import('./worldFlurryInventory');
  const original=JSON.stringify({version:1,reward}),values=new Map([[legacyKey,original]]);
  vi.stubGlobal('localStorage',{getItem:(key:string)=>values.get(key)??null,setItem:(key:string,value:string)=>values.set(key,value)});
  try{expect(inventory.readWorldFlurry()).toEqual(reward);expect(JSON.parse(values.get('exploritaire.world1111.flurry')!).reward).toEqual(reward);expect(values.get(legacyKey)).toBe(original);
   inventory.saveWorldFlurry('available');expect(inventory.readWorldFlurry()).toBe('available');
  }finally{vi.unstubAllGlobals();}
 }
});

it('prefers the new collection and retains legacy progress if migration writes are blocked',async()=>{
 vi.resetModules();const inventory=await import('./worldFlurryInventory');
 const legacy={kinId:'hero',memory:{x:.5,y:.4,enhancement:'Fetch'}};
 const values=new Map([[legacyKey,JSON.stringify({version:1,reward:legacy})],['exploritaire.world1111.flurry',JSON.stringify({version:1,reward:'available'})]]);
 vi.stubGlobal('localStorage',{getItem:(key:string)=>values.get(key)??null,setItem:()=>{throw Error('blocked');}});
 try{expect(inventory.readWorldFlurry()).toBe('available');values.delete('exploritaire.world1111.flurry');expect(inventory.readWorldFlurry()).toEqual(legacy);
  vi.stubGlobal('localStorage',{getItem:()=>{throw Error('blocked');}});expect(inventory.readWorldFlurry()).toEqual(legacy);
 }finally{vi.unstubAllGlobals();}
});
