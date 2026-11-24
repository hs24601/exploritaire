import { renderVolumeGPUAtlas, type VolumeRenderRequest } from './propVolumeRenderer';
import type { PropVolume } from './propVolume';

const models=new Map<number,PropVolume>();
type Request={id:number;models:{id:number;volume:PropVolume}[];entries:(Omit<VolumeRenderRequest,'target'|'volume'>&{volumeId:number})[]};
const scope=self as unknown as {onmessage:((event:MessageEvent<Request>)=>void)|null;postMessage:(message:unknown,transfer:Transferable[])=>void};
scope.onmessage=event=>{
  const {id,entries}=event.data;event.data.models.forEach(model=>models.set(model.id,model.volume));
  let bitmap:ImageBitmap|null=null;
  try{bitmap=renderVolumeGPUAtlas(entries.map(({volumeId,...entry})=>({...entry,volume:models.get(volumeId)!}) as VolumeRenderRequest));}catch{/* main-thread fallback */}
  scope.postMessage({id,bitmap},bitmap?[bitmap]:[]);
};
