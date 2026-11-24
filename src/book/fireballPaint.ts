type Rect={x:number;y:number;width:number;height:number};
const canvas=()=>{const c=document.createElement('canvas');c.width=512;c.height=512;return c;};
/** Runtime sketch from the approved painting; original asset alpha is untouched.
 * Matches bookInkAmount: pigment is revealed by inverse sprite-frame alpha. */
export function createFireballPaint(src:string,maskSrc:string,faceSrc?:string){
 const image=new Image(),mask=new Image(),face=new Image(),outline=canvas(),original=canvas();
 let ready=false,error='',cache=new Map<string,HTMLCanvasElement>();
 image.src=src;mask.src=maskSrc;if(faceSrc)face.src=faceSrc;
 const loaded=Promise.all([image.decode(),mask.decode(),...(faceSrc?[face.decode()]:[])]).then(()=>{
  const ctx=original.getContext('2d',{willReadFrequently:true})!;ctx.drawImage(image,0,0,512,512);if(faceSrc)ctx.drawImage(face,0,0,512,512);
  const pixels=ctx.getImageData(0,0,512,512),ink=outline.getContext('2d')!,result=ink.createImageData(512,512),a=pixels.data;
  const lum=(i:number)=>(a[i]*.2126+a[i+1]*.7152+a[i+2]*.0722)/255;
  for(let y=2;y<510;y++)for(let x=2;x<510;x++){
   const i=(y*512+x)*4,alpha=a[i+3]/255,near=[i-8,i+8,i-512*8,i+512*8],edge=near.some(j=>(a[j+3]>.5*255)!==(alpha>.5));
   const detail=alpha>.7?Math.max(...near.map(j=>Math.abs(lum(i)-lum(j)))):0;
   result.data[i]=255;result.data[i+1]=205;result.data[i+2]=133;result.data[i+3]=edge?225:Math.min(130,Math.max(0,detail-.1)*650);
  }
  ink.putImageData(result,0,0);ready=true;
 }).catch(e=>{error=String(e);});
 const layer=(ctx:CanvasRenderingContext2D,source:CanvasImageSource,progress:number)=>{
  if(progress<=0)return;const temp=canvas(),c=temp.getContext('2d')!;c.drawImage(source,0,0,512,512);
  if(progress<1){const frame=Math.min(39,Math.floor(progress*39)),fw=mask.naturalWidth/40;c.globalCompositeOperation='destination-out';c.drawImage(mask,frame*fw,0,fw,mask.naturalHeight,0,0,512,512);}
  ctx.drawImage(temp,0,0);
 };
 return {
  loaded,get ready(){return ready;},get error(){return error;},
  draw(ctx:CanvasRenderingContext2D,rect:Rect,stroke:number,fill:number){
   if(!ready)return;const key=Math.floor(stroke*40)+':'+Math.floor(fill*40);let art=cache.get(key);
   if(!art){art=canvas();const c=art.getContext('2d')!;layer(c,outline,stroke);layer(c,original,fill);cache.set(key,art);if(cache.size>6)cache.delete(cache.keys().next().value!);}
   ctx.drawImage(art,rect.x,rect.y,rect.width,rect.height);
  },
  dispose(){cache.clear();image.src='';mask.src='';face.src='';}
 };
}
