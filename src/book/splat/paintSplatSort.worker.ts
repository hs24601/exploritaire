import {sortSplats} from './paintSplatSort';

let centers:Float32Array<ArrayBufferLike>=new Float32Array(0),depths=new Float32Array(0),order=new Uint32Array(0);
const counts=new Uint32Array(65536);
type Message={type:'centers';centers:Float32Array}|{type:'sort';id:number;view:Float32Array;viewProjection:Float32Array;budget:number;out:Float32Array};
self.onmessage=(event:MessageEvent<Message>)=>{
  const data=event.data;
  if(data.type==='centers'){centers=data.centers;const n=centers.length/3;depths=new Float32Array(n);order=new Uint32Array(n);return;}
  const count=sortSplats(centers,data.view,data.viewProjection,data.budget,data.out,depths,order,counts);
  (self as unknown as Worker).postMessage({id:data.id,count,out:data.out},[data.out.buffer]);
};
