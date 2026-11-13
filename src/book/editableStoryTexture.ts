import * as THREE from 'three';
import type {PageControl} from './pageDocument';
export function editableStoryTexture(c:PageControl){
 const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=Math.max(64,Math.min(1400,Math.round(1024*c.height/c.width)));const ctx=canvas.getContext('2d')!;
 ctx.globalAlpha=c.paperOpacity??1;ctx.fillStyle=c.paper??'#f0e2c2';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.globalAlpha=1;
 const unit=1024/(c.width*96),font=(c.fontSize??24)*unit,pad=12*unit;ctx.font=`${font}px Georgia`;ctx.fillStyle=c.color??'#493e2d';ctx.textBaseline='top';ctx.textAlign=c.align??'left';
 const x=c.align==='center'?512:c.align==='right'?1024-pad:pad;let y=pad;
 for(const paragraph of (c.text??'').split('\n')){let line='';for(const word of paragraph.split(' ')){const trial=line?line+' '+word:word;if(ctx.measureText(trial).width>1024-pad*2&&line){ctx.fillText(line,x,y);y+=font*1.28;line=word;}else line=trial;}ctx.fillText(line,x,y);y+=font*1.28;}
 const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;return texture;
}
