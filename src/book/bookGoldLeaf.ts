import * as THREE from 'three';

/** Bake worn leaf patches; metallic glints come from the camera and lights. */
export function goldLeafTexture(mask:HTMLCanvasElement){
  const canvas=document.createElement('canvas');canvas.width=mask.width;canvas.height=mask.height;
  const ctx=canvas.getContext('2d')!,gradient=ctx.createLinearGradient(0,0,canvas.width*.3,canvas.height);
  for(const [at,color]of [[0,'#fff1a6'],[.2,'#d9a541'],[.44,'#ffe28b'],[.67,'#a57024'],[.86,'#efd376'],[1,'#bd8d34']] as const)gradient.addColorStop(at,color);
  ctx.fillStyle=gradient;ctx.fillRect(0,0,canvas.width,canvas.height);
  let seed=23239;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  for(let i=0;i<4200;i++){
    const x=random()*canvas.width,y=random()*canvas.height,w=1+random()*18,h=1+random()*9;
    ctx.fillStyle=random()<.5?`rgba(88,46,8,${.08+random()*.22})`:`rgba(255,247,184,${.08+random()*.24})`;
    ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+w,y+random()*3);ctx.lineTo(x+w*.8,y+h);ctx.lineTo(x-2,y+h*.65);ctx.fill();
  }
  ctx.globalCompositeOperation='destination-in';ctx.drawImage(mask,0,0);
  const color=new THREE.CanvasTexture(canvas);color.colorSpace=THREE.SRGBColorSpace;color.anisotropy=4;return color;
}
