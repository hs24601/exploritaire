import * as THREE from 'three';

/** Fixed painted relief from the forest lab's single color/depth pair.
 * CPU displacement makes shadows, peek-through and fold packing share the same
 * geometry. No facing updates, alternate poses, temporal blending or blur. */
export function paintedPopupGeometry(width:number,height:number,color:THREE.Texture,depth:HTMLCanvasElement){
  const geometry=new THREE.PlaneGeometry(width,height,48,72);
  const ctx=depth.getContext('2d')!,pixels=ctx.getImageData(0,0,depth.width,depth.height).data;
  const crop=color.userData.sourceCrop as {x:number;y:number;width:number;height:number} | undefined;
  const sample=(u:number,v:number)=>{
    const x=Math.max(0,Math.min(depth.width-1,Math.round((crop?crop.x+u*crop.width:u)*(depth.width-1))));
    const y=Math.max(0,Math.min(depth.height-1,Math.round((crop?crop.y+(1-v)*crop.height:1-v)*(depth.height-1))));
    return pixels[(y*depth.width+x)*4]/255;
  };
  const anchor=sample(.5,.01),positions=geometry.getAttribute('position'),uv=geometry.getAttribute('uv');
  for(let i=0;i<positions.count;i++)positions.setZ(i,(sample(uv.getX(i),uv.getY(i))-anchor)*height*.7*.22);
  // The cut edge follows the mesh as drawn: bilinear over the same 49×73 vertex grid.
  geometry.userData.reliefAt=(u:number,v:number)=>{const fx=Math.max(0,Math.min(48,u*48)),fy=Math.max(0,Math.min(72,(1-v)*72)),x0=Math.min(47,Math.floor(fx)),y0=Math.min(71,Math.floor(fy)),tx=fx-x0,ty=fy-y0,z=(x:number,y:number)=>positions.getZ(y*49+x);
    return (z(x0,y0)*(1-tx)+z(x0+1,y0)*tx)*(1-ty)+(z(x0,y0+1)*(1-tx)+z(x0+1,y0+1)*tx)*ty;};
  geometry.computeVertexNormals();geometry.computeBoundingSphere();return geometry;
}
