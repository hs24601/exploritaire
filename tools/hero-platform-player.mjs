/** Framework-independent sprite clock. World movement and collisions belong to game physics. */
export class HeroPlatformAnimator {
 constructor(manifest){this.manifest=manifest;this.speed=1;this.mirror=false;this.pending=[];this.play(manifest.clips[0].id);}
 play(id,{restart=false,mirror=this.mirror}={}){if(this.id===id&&!restart){this.mirror=mirror;return;}const alias=this.manifest.animations?.[id],clip=this.manifest.clips.find(c=>c.id===(alias?.clip??id));if(!clip)throw Error('Unknown Hero animation: '+id);this.id=id;this.clip=clip;this.sequence=alias?.frames??clip.frames.map(f=>f.index);this.fps=alias?.fps??clip.fps;this.loop=alias?.loop??clip.loop;this.mirror=mirror;this.cursor=0;this.elapsed=0;this.done=false;this.pending=[];this.emit();}
 emit(){const n=this.sequence[this.cursor];for(const cue of this.clip.events??[])if(cue.frame===n)this.pending.push({...cue,animation:this.id});}
 advance(milliseconds){if(this.done||milliseconds<=0||this.speed<=0)return;this.elapsed+=milliseconds*this.speed;let guard=0;while(this.elapsed>=1000/this.fps&&guard++<512){this.elapsed-=1000/this.fps;if(this.cursor+1<this.sequence.length)this.cursor++;else if(this.loop)this.cursor=0;else{this.done=true;this.elapsed=0;break;}this.emit();}}
 events(){return this.pending.splice(0);}
 sample(){const frame=this.clip.frames[this.sequence[this.cursor]];let facing=frame.facing;if(this.mirror)facing=facing==='right'?'left':facing==='left'?'right':facing;return {clip:this.clip.id,animation:this.id,frame,index:frame.index,done:this.done,facing};}
 draw(context,image,x,y,scale=1){const {frame}=this.sample(),r=frame.rect;context.save();context.translate(x,y);context.scale(this.mirror?-scale:scale,scale);context.drawImage(image,r.x,r.y,r.width,r.height,-frame.pivot.x*r.width,-frame.pivot.y*r.height,r.width,r.height);context.restore();}
}
export async function loadHeroPlatformSuite(base=new URL('./',import.meta.url)){
 const root=new URL(base,globalThis.location?.href??import.meta.url),response=await fetch(new URL('manifest.json',root));if(!response.ok)throw Error('Hero manifest: '+response.status);const manifest=await response.json(),images=new Map();return {manifest,createAnimator:()=>new HeroPlatformAnimator(manifest),async image(id){const alias=manifest.animations?.[id],clip=manifest.clips.find(c=>c.id===(alias?.clip??id));if(!clip)throw Error(id);if(!images.has(clip.id))images.set(clip.id,(async()=>{const image=new Image();image.src=new URL(clip.image,root).href;await image.decode();return image;})());return images.get(clip.id);}};
}
