import * as THREE from 'three';
import {createBookPaper} from './bookPaper';
import {createBookCraft} from './bookCraft';
import {createBookMagic,BOOK_MAGIC} from './bookMagic';
import {createForestAtmosphere,forestFog} from './forestAtmosphere';
import {createBookAtmosphere} from './bookAtmosphere';
import {pagePlane} from './pageArt';
import {editableStoryTexture} from './editableStoryTexture';
import {goldLeafTexture} from './bookGoldLeaf';
import type {BookAtmosphere} from './pageDocument';

export const CASTLE_BELIEVE_SECONDS=BOOK_MAGIC.opened+7;
// World-route pose already exposed when the portal has finished filling view.
export const CASTLE_PORTAL_WORLD_LEAD_SECONDS=1.2;
export function castleBookOpen(seconds:number){return THREE.MathUtils.smoothstep(seconds,BOOK_MAGIC.opening,BOOK_MAGIC.opened);}
export function castlePortalNear(distance:number){return THREE.MathUtils.clamp(distance*.025,.000005,.1);}

/** Page 5's exterior and mist, opening onto Believe instead of a popup. */
export function createCastleBelieveArrival(renderer:THREE.WebGLRenderer){
  const scene=new THREE.Scene();scene.background=new THREE.Color('#050c13');
  const camera=new THREE.PerspectiveCamera(39,1,.1,200),craft=createBookCraft(renderer),paper=createBookPaper(renderer,undefined,512);
  scene.add(new THREE.HemisphereLight(0xfff5e6,0x536c77,1.4));
  const key=new THREE.DirectionalLight(0xfff1db,1.6);key.position.set(-4,10,5);scene.add(key);
  const book=new THREE.Group();book.name='Page 5 book exterior';scene.add(book);
  const box=(w:number,h:number,d:number,material:THREE.Material,x:number,y:number,parent:THREE.Object3D=book)=>{const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material);mesh.position.set(x,y,0);parent.add(mesh);return mesh;};
  box(6.05,.12,7.85,craft.leather(2),2.95,-.3);
  const block=craft.pageBlock(6.05,.28,7.85);block.position.set(2.95,-.08,0);book.add(block);
  const spine=craft.spine(.29,7.85);spine.position.set(-.07,-.078,0);spine.scale.x=.35;book.add(spine);
  const right=pagePlane(paper.right,5.8,7.5,2.95,0);right.position.y=.09;book.add(right);
  const hinge=new THREE.Group();hinge.position.y=.16;book.add(hinge);
  const lid=box(6.05,.09,7.85,craft.leather(2),2.95,0,hinge);
  const cover=craft.cover(6.05,7.85);cover.position.set(2.95,.0455,0);hinge.add(cover);
  for(const [text,z,height,fontSize]of [["Hero's Journey",-2.3,.7,34],['The adventure of a very good girl.',-1.7,.45,17],['The story unfolds...',2.6,.5,18]] as const){
    const map=editableStoryTexture({id:'cover:'+z,name:text,kind:'text',x:2.95,z,elevation:0,width:5.15,height,rotation:0,visible:true,locked:false,opacity:1,layer:0,text,fontSize,color:'#eddbac',paperOpacity:0,align:'center'});
    const title=pagePlane(map,5.15,height,2.95,z);title.position.y=.055;title.userData.bookStory=true;hinge.add(title);
  }
  const magic=createBookMagic(scene,hinge,[cover,lid]);
  // This counter-rotation makes the inside page face down when shut and read
  // normally on the left when the physical cover has opened.
  const inside=new THREE.Group();inside.rotation.z=-Math.PI;inside.position.y=-.06;hinge.add(inside);
  const left=pagePlane(paper.left,5.8,7.5,-2.95,0);left.position.y=0;inside.add(left);
  const text=document.createElement('canvas');text.width=1536;text.height=384;
  const tx=text.getContext('2d')!;tx.font='italic bold 250px Georgia';tx.fillStyle='#ffffff';tx.fillText('Believe.',30,290);
  const map=goldLeafTexture(text),coverMaterial=cover.material as THREE.MeshStandardMaterial;
  const ink=new THREE.MeshStandardMaterial({map,alphaTest:.22,metalness:.86,roughness:.43,envMap:coverMaterial.envMap,envMapIntensity:.85,emissive:'#b88424',emissiveIntensity:.09,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1});
  const word=new THREE.Mesh(new THREE.PlaneGeometry(3.9,.975),ink);word.position.set(-3.65,.014,-2.55);word.rotation.x=-Math.PI/2;word.renderOrder=2;word.userData.bookStory=true;inside.add(word);
  const glyphStart=30+tx.measureText('Bel').width,glyphEnd=glyphStart+tx.measureText('i').width,image=tx.getImageData(0,0,1536,384).data;
  let sx=0,sy=0,n=0;for(let y=45;y<145;y++)for(let x=Math.floor(glyphStart);x<Math.ceil(glyphEnd);x++)if(image[(y*1536+x)*4+3]>100){sx+=x;sy+=y;n++;}
  const dotLocal=new THREE.Vector3(-3.65+((n?sx/n:515)/1536-.5)*3.9,.020,-2.55+((n?sy/n:102)/384-.5)*.975),dot=new THREE.Vector3();
  const target=new THREE.WebGLRenderTarget(2,2,{depthBuffer:true}),resolution=new THREE.Vector2(),size=new THREE.Vector2();
  const portalMaterial=new THREE.ShaderMaterial({toneMapped:false,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2,uniforms:{image:{value:target.texture},resolution:{value:resolution}},
    vertexShader:'varying vec2 q;void main(){q=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader:`varying vec2 q;uniform sampler2D image;uniform vec2 resolution;void main(){if(length(q-.5)>.5)discard;gl_FragColor=texture2D(image,gl_FragCoord.xy/resolution);
      #include <colorspace_fragment>
    }`});
  const portal=new THREE.Mesh(new THREE.PlaneGeometry(.135,.135),portalMaterial);portal.position.copy(dotLocal);portal.rotation.x=-Math.PI/2;portal.renderOrder=3;inside.add(portal);
  const surround=box(200,.3,200,new THREE.MeshStandardMaterial({color:'#202b2d',transparent:true}),0,-.8,scene);surround.userData.bookSurround=true;
  const atmosphere=createBookAtmosphere(),weather=createForestAtmosphere(scene);
  // Page 5's saved perimeter bank, using its shared forest gain and shaders.
  const fog:BookAtmosphere={enabled:true,color:'#0b1b20',density:.11,height:3.2,softness:2.8,darkness:.32,mode:'consistent',thickness:9,distanceDensity:.09,distanceStart:3};
  atmosphere.set(forestFog(fog,9,1),undefined,true);atmosphere.attach(scene);
  const offset=new THREE.Vector3(3.6,10.16,15.026),aim=new THREE.Vector3(),start=new THREE.Vector3(2.95,11.8,13),end=new THREE.Vector3(),openAim=new THREE.Vector3(0,.16,0);let showing=false,time=0;
  function finish(){if(showing){target.setSize(2,2);showing=false;}}
  return {
    finish,
    render(world:THREE.Scene,worldCamera:THREE.Camera,seconds:number){
      if(seconds>=CASTLE_BELIEVE_SECONDS){finish();return false;}
      showing=true;time=seconds;renderer.getDrawingBufferSize(size);resolution.copy(size);
      if(target.width!==size.x||target.height!==size.y)target.setSize(size.x,size.y);
      hinge.rotation.z=castleBookOpen(seconds)*Math.PI;book.updateWorldMatrix(true,true);inside.localToWorld(dot.copy(dotLocal));
      camera.aspect=size.x/size.y;
      if(seconds<BOOK_MAGIC.opened){
        // End exactly at the first portal-approach pose, without a second cut.
        hinge.rotation.z=Math.PI;book.updateWorldMatrix(true,true);inside.localToWorld(end.copy(dotLocal));end.add(offset);
        hinge.rotation.z=castleBookOpen(seconds)*Math.PI;book.updateWorldMatrix(true,true);
        camera.position.lerpVectors(start,end,THREE.MathUtils.smoothstep(seconds,0,BOOK_MAGIC.opened));
        aim.set(2.95,.16,0).lerp(openAim,THREE.MathUtils.smoothstep(seconds,3,BOOK_MAGIC.opened));
      }else{
        const progress=(seconds-BOOK_MAGIC.opened)/7,approach=Math.exp(-10.5*progress**1.6);
        camera.position.copy(dot).addScaledVector(offset,approach);aim.copy(openAim).lerp(dot,THREE.MathUtils.smoothstep(progress,0,.42));
      }
      camera.near=castlePortalNear(camera.position.distanceTo(aim));camera.updateProjectionMatrix();camera.lookAt(aim);
      magic.update(seconds,true,camera,size.y);weather.update(9,1,true,camera,size.y,1,seconds,undefined,undefined,true);
      const previous=renderer.getRenderTarget();renderer.setRenderTarget(target);renderer.render(world,worldCamera);renderer.setRenderTarget(previous);renderer.render(scene,camera);
      return true;
    },
    get diagnostics(){return {showing,duration:CASTLE_BELIEVE_SECONDS,phase:time<BOOK_MAGIC.opening?'exterior':time<BOOK_MAGIC.opened?'opening':'portal',open:castleBookOpen(time),near:camera.near,goldLeaf:true,outerFog:true,targetSize:[target.width,target.height],dot:dot.toArray()};},
  };
}
