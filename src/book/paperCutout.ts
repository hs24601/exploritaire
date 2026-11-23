import * as THREE from 'three';
const paintTextures=new WeakMap<HTMLCanvasElement,{texture:THREE.CanvasTexture;users:number}>();
function retainPaint(art:HTMLCanvasElement){
 let entry=paintTextures.get(art);if(!entry){const texture=new THREE.CanvasTexture(art);texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=8;entry={texture,users:0};paintTextures.set(art,entry);}entry.users++;
 return {texture:entry.texture,release(){if(--entry!.users===0){entry!.texture.dispose();paintTextures.delete(art);}}};
}

/** Trace the opaque silhouette once at build time, then clip it to a crease.
 * Both cap and cut edge are real geometry; no per-frame pixel reads. */
export function paintedPaperPanel(art:HTMLCanvasElement,height:number,thickness:number,backColor:THREE.ColorRepresentation,minU=0,maxU=1,arch=false,paintedBack=false){
 const width=height*art.width/art.height,ctx=art.getContext('2d')!,pixels=ctx.getImageData(0,0,art.width,art.height).data;
 const left:THREE.Vector2[]=[],right:THREE.Vector2[]=[];
 for(let row=0;row<=100;row++){
  const y=Math.min(art.height-1,Math.round(row/100*(art.height-1)));let lo=art.width,hi=-1;
  for(let x=0;x<art.width;x++)if(pixels[(y*art.width+x)*4+3]>100){lo=Math.min(lo,x);hi=x;}
  if(hi>=lo){const yy=(1-y/art.height)*height;left.push(new THREE.Vector2((lo/art.width-.5)*width,yy));right.push(new THREE.Vector2(((hi+1)/art.width-.5)*width,yy));}
 }
 if(left.length<2)throw new Error('Empty painted paper silhouette');
 // The den's feet are authored along a common baseline. Tiny detached paint
 // flecks below it must not turn the doorway notch into a self-intersection.
 const baseline=arch?height*.1:0;
 let polygon=[...left.filter(p=>p.y>=baseline).reverse(),...right.filter(p=>p.y>=baseline)];
 // An authored doorway notch, connected to the lower edge rather than a dark decal.
 if(arch){
  const base=baseline;
  polygon.push(new THREE.Vector2(width*.43,base));
  polygon.push(new THREE.Vector2(width*.145,base));
  for(let i=0;i<=24;i++){const a=i/24*Math.PI;polygon.push(new THREE.Vector2(Math.cos(a)*width*.145,base+Math.sin(a)*height*.46));}
  polygon.push(new THREE.Vector2(-width*.145,base));
  polygon.push(new THREE.Vector2(-width*.43,base));
 }
 const clip=(points:THREE.Vector2[],edge:number,greater:boolean)=>{
  const out:THREE.Vector2[]=[];
  for(let i=0;i<points.length;i++){const a=points[i],b=points[(i+1)%points.length],ia=greater?a.x>=edge:a.x<=edge,ib=greater?b.x>=edge:b.x<=edge;
   if(ia)out.push(a);if(ia!==ib)out.push(new THREE.Vector2(edge,a.y+(b.y-a.y)*(edge-a.x)/(b.x-a.x)));
  }return out;
 };
 polygon=clip(clip(polygon,(minU-.5)*width,true),(maxU-.5)*width,false);
 const shape=new THREE.Shape(polygon),bodyGeometry=new THREE.ExtrudeGeometry(shape,{depth:thickness,bevelEnabled:false,steps:1});bodyGeometry.translate(0,0,-thickness/2);
 const faceGeometry=new THREE.ShapeGeometry(shape),uv=faceGeometry.getAttribute('uv'),pos=faceGeometry.getAttribute('position');
 for(let i=0;i<uv.count;i++)uv.setXY(i,pos.getX(i)/width+.5,pos.getY(i)/height);
 const retained=retainPaint(art),texture=retained.texture;
 const ink=new THREE.MeshStandardMaterial({map:texture,roughness:.96,alphaTest:.3,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2});
 const paper=new THREE.MeshStandardMaterial({color:backColor,roughness:.96});
 const edge=new THREE.MeshStandardMaterial({color:'#e5d4b1',roughness:1});
 const group=new THREE.Group(),body=new THREE.Mesh(bodyGeometry,[paper,edge]),face=new THREE.Mesh(faceGeometry,ink);face.position.z=thickness/2+.0001;
 body.castShadow=body.receiveShadow=face.receiveShadow=true;group.add(body,face);
 const reverseInk=paintedBack?ink.clone():undefined;
 if(reverseInk){reverseInk.side=THREE.BackSide;const back=new THREE.Mesh(faceGeometry,reverseInk);back.position.z=-thickness/2-.0001;back.receiveShadow=true;group.add(back);}
 return {group,dispose(){bodyGeometry.dispose();faceGeometry.dispose();retained.release();ink.dispose();reverseInk?.dispose();paper.dispose();edge.dispose();}};
}
