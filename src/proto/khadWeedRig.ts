import * as THREE from 'three';
import { selectKhadFace, type KhadFace, type KhadWeedOptions } from './khadSpriteFaces';

export const THORN_WHIP_SECONDS = .62;
export function sampleThornWhip(age: number) {
  const smooth = (x: number) => { const t = Math.max(0, Math.min(1, x)); return t*t*(3-2*t); };
  const active = age >= 0 && age < THORN_WHIP_SECONDS;
  return { active, windup: active && age < .18 ? Math.sin(age/.18*Math.PI) : 0,
    reach: !active ? 0 : age < .24 ? smooth((age-.14)/.1) : 1-smooth((age-.28)/.34) };
}

/** World-space segmented wood: hooked thorns ride each tapered vine joint. */
export function createKhadWeed(height = 2.5) {
  const root = new THREE.Group(), body = new THREE.Group(); root.name='responsive-khad-root'; root.add(body);
  const whip=new THREE.Group();root.add(whip);
  const capture=new THREE.Scene(), lens=new THREE.OrthographicCamera(-2,2,2,-2,.1,30);
  capture.add(new THREE.AmbientLight(0xc9c4dc,1.5));
  const moon=new THREE.DirectionalLight(0xe5ecff,2);moon.position.set(-3,7,4);capture.add(moon);
  const targetTexture=new THREE.WebGLRenderTarget(256,256,{minFilter:THREE.LinearFilter,magFilter:THREE.LinearFilter});
  const cardGeometry=new THREE.PlaneGeometry(4,4),cardMaterial=new THREE.MeshBasicMaterial({map:targetTexture.texture,transparent:true,depthWrite:false});
  const card=new THREE.Mesh(cardGeometry,cardMaterial);card.position.y=1.25;card.visible=false;root.add(card);
  let face:KhadFace|undefined,previousCount=8,attackActive=false;
  const cameraPosition=new THREE.Vector3(),worldPosition=new THREE.Vector3(),clearColor=new THREE.Color();
  const bark = new THREE.MeshStandardMaterial({color:0x422531,emissive:0x26121d,emissiveIntensity:.45,roughness:1,flatShading:true});
  const thorn = new THREE.MeshStandardMaterial({color:0xc65d70,emissive:0x612435,emissiveIntensity:.4,roughness:1,flatShading:true});
  const seam = new THREE.MeshBasicMaterial({color:0xf34b65});
  const leaf = new THREE.MeshStandardMaterial({color:0x35443a,roughness:1,flatShading:true});
  const cylinder=new THREE.CylinderGeometry(1,1,1,7), cone=new THREE.ConeGeometry(1,1,5), leafGeometry=new THREE.SphereGeometry(1,5,3);
  const up=new THREE.Vector3(0,1,0), direction=new THREE.Vector3();
  const stems: {joint:THREE.Group;wood:THREE.Mesh;crack:THREE.Mesh;hooks:THREE.Group[];index:number;chain:number}[]=[];
  for(let chain=0;chain<7;chain++) for(let index=0;index<14;index++) {
    const joint=new THREE.Group(), wood=new THREE.Mesh(cylinder,bark), crack=new THREE.Mesh(cylinder,seam), hooks:THREE.Group[]=[];
    joint.add(wood,crack);(chain===0?whip:body).add(joint);
    for(let side=0;side<2;side++) {
      const hook=new THREE.Group(), base=new THREE.Mesh(cone,thorn), tip=new THREE.Mesh(cone,bark);
      base.scale.set(.065,.23,.065);base.rotation.z=-.8;base.position.set(.07,.01,0);
      tip.scale.set(.027,.13,.027);tip.rotation.z=.1;tip.position.set(.14,.13,0);
      hook.add(base,tip);hook.rotation.y=side*Math.PI+chain*.8;joint.add(hook);hooks.push(hook);
    }
    stems.push({joint,wood,crack,hooks,index,chain});
  }
  for(let i=0;i<11;i++) {
    const mesh=new THREE.Mesh(leafGeometry,leaf),a=i*2.39996;
    mesh.position.set(Math.cos(a)*.55,.2+i%3*.17,Math.sin(a)*.55);mesh.scale.set(.18,.05,.53);mesh.rotation.set(.3,a,.3);body.add(mesh);
  }
  const spores=new THREE.Group(), sporeMaterial=new THREE.MeshBasicMaterial({color:0x95a84b,transparent:true,opacity:.28,depthWrite:false});body.add(spores);
  for(let i=0;i<15;i++){const m=new THREE.Mesh(leafGeometry,sporeMaterial);m.scale.setScalar(.025+i%3*.012);spores.add(m);}
  let attackStart=-Infinity,hurtStart=-Infinity,downStart=Infinity;
  const target=new THREE.Vector3(-6,1,0);
  const point=(chain:number,u:number,t:number,reduced:boolean,reach:number,windup:number)=>{
    const a=chain*2.39996,sway=reduced?0:Math.sin(t*1.8+u*3+chain)*.09*u;
    if(chain===0)return new THREE.Vector3(-Math.sin(u*4.8)*.8*(1-reach)+target.x*u*reach+windup*u*.9,
      .25*(1-reach)+Math.sin(u*2.1)*1.85*(1-reach)+target.y*u*reach+sway,Math.sin(u*5)*.42*(1-reach)+target.z*u*reach);
    const radius=.25+u*(chain<4?1.15:.85);
    return new THREE.Vector3(Math.cos(a+u*1.3)*radius+sway,.12+Math.sin(u*Math.PI*.87)*(chain<4?1.9:1.3),Math.sin(a+u*1.3)*radius);
  };
  return {root,
    attack(now:number,localTarget:THREE.Vector3){attackStart=now;target.copy(localTarget).multiplyScalar(2.5/height);},
    hurt(now:number){hurtStart=now;},defeat(now:number){downStart=now;},
    reset(){attackStart=-Infinity;hurtStart=-Infinity;downStart=Infinity;},
    busy(now:number){return now<attackStart+.62||now<hurtStart+.45||(now>=downStart&&now<downStart+1.25);},
    update(now:number,reduced:boolean,options:KhadWeedOptions={girth:1,sway:1}){
      const phase=sampleThornWhip(now-attackStart),collapse=Math.max(0,Math.min(1,(now-downStart)/(reduced?.12:1)));
      attackActive=phase.active&&!reduced;
      body.scale.set(height/2.5,height/2.5*(1-collapse*.92),height/2.5);
      const hurtAge=now-hurtStart;
      body.rotation.z=reduced||hurtAge>.45?0:Math.sin(hurtAge*35)*(1-hurtAge/.45)*.13;
      whip.scale.copy(body.scale);whip.rotation.copy(body.rotation);
      for(const s of stems){
        const u=s.index/14,a=point(s.chain,u,now*options.sway,reduced,reduced?0:phase.reach,reduced?0:phase.windup),b=point(s.chain,(s.index+1)/14,now*options.sway,reduced,reduced?0:phase.reach,reduced?0:phase.windup);
        direction.copy(b).sub(a);const length=direction.length();s.joint.position.copy(a).add(b).multiplyScalar(.5);s.joint.quaternion.setFromUnitVectors(up,direction.normalize());
        const radius=(.11*(1-u)**.8+.012)*(1+Math.sin(u*23+s.chain)*.18)*options.girth;
        s.wood.scale.set(radius,length*1.06,radius);s.crack.scale.set(.008,length*.57,.008);s.crack.position.set(radius*.55,0,radius*.75);
        s.hooks.forEach((hook,i)=>{hook.position.set(0,(i?-.2:.2)*length,0);hook.scale.setScalar((1-u*.65)*options.girth);});
      }
      bark.color.set(hurtAge<.12?0xa65e68:0x422531);spores.visible=!reduced&&collapse<1;
      spores.children.forEach((m,i)=>{const a=i*2.39996,p=(now*.24+i/15)%1;m.position.set(Math.cos(a+p)*(.7+p*.8),p*2.5,Math.sin(a+p)*(.7+p*.8));});
    },
    /** Bake only this actor, with a snapped orthographic camera. Never capture
     * scenery/UI or the attacking vine; its endpoint stays in world space. */
    present(renderer:THREE.WebGLRenderer,camera:THREE.Camera,options:KhadWeedOptions){
      if(options.spriteFaces===false){root.add(body,whip);card.visible=false;root.userData.spriteFace=null;return;}
      const count=options.faceCount??8;
      if(count!==previousCount){face=undefined;previousCount=count;}
      camera.getWorldPosition(cameraPosition);root.getWorldPosition(worldPosition);cameraPosition.sub(worldPosition);
      const yaw=Math.atan2(cameraPosition.x,cameraPosition.z),elevation=Math.atan2(cameraPosition.y-1.25,Math.hypot(cameraPosition.x,cameraPosition.z));
      face=selectKhadFace(yaw,elevation,count,face);
      lens.position.set(Math.sin(face.yaw)*Math.cos(face.elevation)*10,1.25+Math.sin(face.elevation)*10,Math.cos(face.yaw)*Math.cos(face.elevation)*10);
      lens.lookAt(0,1.25,0);lens.updateMatrixWorld();
      capture.add(body);
      if(attackActive)root.add(whip);else capture.add(whip);
      const previousTarget=renderer.getRenderTarget(),alpha=renderer.getClearAlpha();renderer.getClearColor(clearColor);
      try{renderer.setRenderTarget(targetTexture);renderer.setClearColor(0,0);renderer.clear();renderer.render(capture,lens);}
      finally{renderer.setRenderTarget(previousTarget);renderer.setClearColor(clearColor,alpha);}
      card.visible=true;camera.getWorldQuaternion(card.quaternion);
      root.userData.spriteFace={...face,count,whipWorldSpace:attackActive};
    },
    dispose(){[cylinder,cone,leafGeometry,bark,thorn,seam,leaf,sporeMaterial,targetTexture,cardGeometry,cardMaterial].forEach(r=>r.dispose());}
  };
}
