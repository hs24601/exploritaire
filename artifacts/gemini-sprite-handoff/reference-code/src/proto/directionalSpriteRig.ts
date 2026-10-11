import * as THREE from 'three';
import { sampleSpritePose } from './actorSpriteLibrary';
import { sampleQuadrupedPose } from './quadrupedSprite';
import { selectSpriteView, type DirectionalPart, type DirectionalFrame, type DirectionalSpriteDefinition, type SpriteView } from './directionalSprites';

export type BattleSpriteTextures = Readonly<Record<string,THREE.Texture>>;

/** Clip in geometry, keeping every joint on the same source-pixel grid. */
export function directionalPartGeometry(part: DirectionalPart, image: {width: number; height: number}): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  part.clip?.forEach(([x,y],i) => { if(i) shape.lineTo(x-.5,.5-y); else shape.moveTo(x-.5,.5-y); });
  const geometry = part.clip ? new THREE.ShapeGeometry(shape) : new THREE.PlaneGeometry(1,1);
  const uv = geometry.getAttribute('uv'), position = geometry.getAttribute('position'), [x,y,w,h] = part.rect;
  for(let i=0;i<uv.count;i++) uv.setXY(i,(x+(position.getX(i)+.5)*w)/image.width,1-(y+(.5-position.getY(i))*h)/image.height);
  return geometry;
}

/** Reuse atlas textures and tiny UV geometries. Each actor owns only joints/materials. */
export function createDirectionalSpriteLibrary(textures: BattleSpriteTextures, definition: DirectionalSpriteDefinition) {
  const geometries = new Map<DirectionalFrame, THREE.BufferGeometry[]>();
  const frames = [...definition.low, ...definition.high, ...(definition.lowOpposite??[]), ...(definition.highOpposite??[]), definition.top];
  for (const frame of frames) {
    if (geometries.has(frame)) continue;
    const image = textures[frame.source].image as {width: number; height: number};
    geometries.set(frame, frame.parts.map(part => directionalPartGeometry(part,image)));
  }
  return {
    create(height: number, tint = 0xffffff) {
      const root = new THREE.Group(), billboard = new THREE.Group(), facing = new THREE.Group();
      root.add(billboard); billboard.add(facing);
      const parts = definition.low[0].parts.map((part,i) => {
        const pivot = new THREE.Group(); pivot.name = part.id;
        // Opaque cutouts avoid double-blending semi-transparent fur where joint
        // regions underlap. Alpha testing still preserves the sprite silhouette.
        const material = new THREE.MeshBasicMaterial({map: textures[definition.low[0].source], color: tint, transparent: false, alphaTest: .45, side: THREE.DoubleSide, forceSinglePass: true});
        const mesh = new THREE.Mesh(geometries.get(definition.low[0])![i], material);
        pivot.add(mesh); facing.add(pivot);
        return { part, pivot, mesh, material, x: 0, y: 0, width: 0, height: 0 };
      });
      const byId = new Map(parts.map(joint => [joint.part.id,joint]));
      for(const joint of parts) if(joint.part.parent) byId.get(joint.part.parent)!.pivot.add(joint.pivot);
      let view: SpriteView | undefined, active: DirectionalFrame | undefined;
      return {
        root, billboard, facing, parts,
        get frame() { return active?.id ?? ''; },
        get view() { return view; },
        update(camera: THREE.Camera, heading: number, time: number, reduced: boolean, phase = 0, action = 0) {
          const dx = camera.position.x-root.position.x, dz = camera.position.z-root.position.z;
          const elevation = Math.atan2(camera.position.y-root.position.y, Math.hypot(dx,dz));
          const yaw = Math.atan2(dx,dz);
          view = selectSpriteView(heading,yaw,elevation,view);
          const opposite = view.elevation === 'low' ? definition.lowOpposite : definition.highOpposite;
          const authoredOpposite = view.elevation !== 'top' && view.flip<0 && opposite;
          const frame = view.elevation === 'top' ? definition.top : (authoredOpposite || definition[view.elevation])[view.direction];
          if (frame !== active) {
            active = frame;
            parts.forEach((joint,i) => {
              const part = frame.parts[i], h = part.height*height, w = h*part.rect[2]/part.rect[3];
              const [px,py] = part.pivot ?? [.5,.5];
              joint.part = part; joint.height = h; joint.width = w;
              joint.x = part.x*height+(px-.5)*w; joint.y = part.y*height+(py-.5)*h;
              joint.mesh.geometry = geometries.get(frame)![i]; joint.mesh.material.map = textures[frame.source];
              joint.mesh.scale.set(w,h,1); joint.mesh.position.set((.5-px)*w,(.5-py)*h,0);
            });
          }
          // The overhead image's nose points along local +Y. Lie it on the ground,
          // then rotate it into the WORLD heading rather than mirroring screen-left/right.
          billboard.rotation.set(view.elevation === 'top' ? -Math.PI/2 : -Math.max(0,elevation)*.75, view.elevation === 'top' ? 0 : yaw, 0, 'YXZ');
          if (view.elevation === 'top') billboard.rotation.y = heading+Math.PI;
          billboard.position.y = view.elevation === 'top' ? .10 : .03;
          // Overhead art describes a footprint, centred on the actor's ground anchor.
          facing.position.y = view.elevation === 'top' ? -height*.5 : 0;
          facing.scale.x = authoredOpposite ? 1 : view.flip;
          parts.forEach(joint => {
            const pose = definition.motion==='quadruped'?sampleQuadrupedPose(joint.part.id,time,phase,action,reduced,definition.motionProfile):sampleSpritePose(joint.part.id,time,phase,action,reduced);
            const squash = definition.motion === 'slime' && !reduced ? 1+Math.sin(time*3.8+phase)*.065 : pose.scaleY;
            const parent = joint.part.parent ? byId.get(joint.part.parent) : undefined;
            joint.pivot.position.set(joint.x-(parent?.x ?? 0)+pose.x*height,joint.y-(parent?.y ?? 0)+pose.y*height,joint.part.depth-(parent?.part.depth ?? 0));
            joint.pivot.rotation.z = pose.angle;
            // A quadruped breathes as one uniformly scaled hierarchy, rather
            // than stretching its torso independently of the attached parts.
            joint.pivot.scale.set(definition.motion === 'slime' ? 1/Math.sqrt(squash) : squash,squash,1);
          });
        },
        setOpacity(opacity: number) { parts.forEach(({material}) => {
          const translucent=opacity<1;
          if(material.transparent!==translucent){material.transparent=translucent;material.needsUpdate=true;}
          material.opacity=opacity;material.alphaTest=.45*opacity;material.depthWrite=!translucent;
        }); },
        setColor(color: THREE.ColorRepresentation) { parts.forEach(({material}) => material.color.set(color)); },
        dispose() { parts.forEach(({material}) => material.dispose()); },
      };
    },
    dispose() { geometries.forEach(group => group.forEach(geometry => geometry.dispose())); },
  };
}
