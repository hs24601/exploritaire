import * as THREE from 'three';
import { heroFaceAttachment } from './heroFaceAttachments';
import type { FaceAttachment } from './heroFaceAttachments';
import { getHeroBobtail } from './heroBobtail';
import { createFlameTail, flameTailAnchor, getHeroFlameTail } from './heroFlameTail';
import { sampleSpritePose } from './actorSpriteLibrary';
import { sampleQuadrupedPose } from './quadrupedSprite';
import { selectSpriteView, type DirectionalPart, type DirectionalFrame, type DirectionalSpriteDefinition, type SpriteView } from './directionalSprites';

export type BattleSpriteTextures = Readonly<Record<string,THREE.Texture>>;

/** Bound the patch to its registered face rectangle; shader keeps the body silhouette. */
export function attachedFaceGeometry(part: DirectionalPart, attachment: FaceAttachment, faceImage: {width:number;height:number}, bodyImage: {width:number;height:number}) {
  const [x,y,w,h] = attachment.target;
  // The head/torso artwork overlaps at the neck. Its joint clip can bisect the
  // original mouth, so clip to the face registration, then the source alpha.
  let polygon: number[][] = [[0,0],[1,0],[1,1],[0,1]];
  for (const [axis,bound,sign] of [[0,x,1],[0,x+w,-1],[1,y,1],[1,y+h,-1]]) {
    const next: number[][] = [];
    for (let i=0;i<polygon.length;i++) {
      const a=polygon[i], b=polygon[(i+1)%polygon.length];
      const insideA=(a[axis]-bound)*sign>=0, insideB=(b[axis]-bound)*sign>=0;
      if (insideA) next.push(a);
      if (insideA !== insideB) {
        const t=(bound-a[axis])/(b[axis]-a[axis]);
        next.push([a[0]+t*(b[0]-a[0]),a[1]+t*(b[1]-a[1])]);
      }
    }
    polygon=next;
  }
  const shape=new THREE.Shape();
  polygon.forEach(([px,py],i) => i ? shape.lineTo(px-.5,.5-py) : shape.moveTo(px-.5,.5-py));
  const geometry=new THREE.ShapeGeometry(shape), positions=geometry.getAttribute('position');
  const uv=geometry.getAttribute('uv'), patch: number[]=[], body: number[]=[];
  const [sx,sy,sw,sh]=attachment.rect, [bx,by,bw,bh]=part.rect;
  for(let i=0;i<positions.count;i++) {
    const px=positions.getX(i)+.5, py=.5-positions.getY(i), u=(px-x)/w, v=(py-y)/h;
    uv.setXY(i,(sx+u*sw)/faceImage.width,1-(sy+v*sh)/faceImage.height);
    patch.push(u,1-v); body.push((bx+px*bw)/bodyImage.width,1-(by+py*bh)/bodyImage.height);
  }
  geometry.setAttribute('facePatchUv',new THREE.Float32BufferAttribute(patch,2));
  geometry.setAttribute('faceBodyUv',new THREE.Float32BufferAttribute(body,2));
  return geometry;
}

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
export function createDirectionalSpriteLibrary(textures: BattleSpriteTextures, definition: DirectionalSpriteDefinition,
  poses: Readonly<Record<string, DirectionalSpriteDefinition>> = {},
  archivedEffects: { heroFlameTail?: boolean } = {}) {
  const geometries = new Map<DirectionalFrame, THREE.BufferGeometry[]>();
  const bobtailGeometries = new Map<DirectionalFrame, THREE.BufferGeometry>();
  const definitions: Readonly<Record<string, DirectionalSpriteDefinition>> = { standing: definition, ...poses };
  for (const pose of Object.values(definitions)) {
    if (pose.animation && (!pose.animation.frames.length || !Number.isFinite(pose.animation.fps) || pose.animation.fps <= 0)) throw new Error('Sprite animation needs phases and a positive frame rate');
  }
  const signature = (frame: DirectionalFrame) => frame.parts.map(part => `${part.id}:${part.parent ?? ''}`).join(',');
  // Authored gait phases reuse the same materials, joints and directional selection.
  const allDefinitions = Object.values(definitions).flatMap(pose => [pose, ...(pose.animation?.frames ?? [])]);
  const frames = allDefinitions.flatMap(pose => [...pose.low, ...pose.high, ...(pose.lowOpposite??[]), ...(pose.highOpposite??[]), pose.top]);
  if (frames.some(frame => signature(frame) !== signature(definition.low[0]))) throw new Error('Sprite poses must share joint IDs, order and parents');
  for (const frame of frames) {
    if (geometries.has(frame)) continue;
    const image = textures[frame.source].image as {width: number; height: number};
    geometries.set(frame, frame.parts.map(part => directionalPartGeometry(part,image)));
    const hind = frame.parts.find(part => part.id === 'hind');
    if (hind && textures[frame.source + 'Bobtail']) bobtailGeometries.set(frame, directionalPartGeometry({...hind, clip: undefined}, image));
  }
  return {
    create(height: number, tint = 0xffffff) {
      const root = new THREE.Group(), billboard = new THREE.Group(), facing = new THREE.Group();
      root.add(billboard); billboard.add(facing);
      // A hit flash blends every joint toward one colour (white on a defeat, red on a flinch).
      const flash = { amount: { value: 0 }, color: { value: new THREE.Color(1, 1, 1) } };
      const environment = { value: new THREE.Color(1, 1, 1) };
      const headCut = { value: new THREE.Vector4(0,0,0,0) };
      const headCutEnabled = { value: 0 };
      const parts = definition.low[0].parts.map((part,i) => {
        const pivot = new THREE.Group(); pivot.name = part.id;
        // Painted washes and spectral tails retain partial alpha; legacy pixel
        // cutouts keep their opaque joint-underlap behavior.
        const painted = Boolean(textures[definition.low[0].source].userData.watercolor);
        const material = new THREE.MeshBasicMaterial({map: textures[definition.low[0].source], color: tint, transparent: painted, alphaTest: painted ? .01 : .45, depthWrite: !painted, side: THREE.DoubleSide, forceSinglePass: true});
        material.customProgramCacheKey = () => `actor-expression-body-${part.id === 'head' ? 'head' : 'body'}`;
        material.onBeforeCompile = shader => {
          shader.uniforms.headCut = headCut; shader.uniforms.headCutEnabled = headCutEnabled;
          shader.fragmentShader = 'uniform vec4 headCut; uniform float headCutEnabled;\n'+shader.fragmentShader;
          // Feather the anatomical head region across the overlapping joints;
          // a rectangular discard leaves straight shoulder/back seams.
          shader.fragmentShader = shader.fragmentShader.replace('#include <alphatest_fragment>', 'if (headCutEnabled > 0.5) { vec2 headUv = (vMapUv - headCut.xy) / headCut.zw; float headMask = 1.0 - smoothstep(0.85, 1.0, length(headUv)); diffuseColor.a *= 1.0 - headMask; }\n#include <alphatest_fragment>');
          shader.uniforms.actorEnvironment = environment;
          shader.uniforms.flashAmount = flash.amount; shader.uniforms.flashColor = flash.color;
          shader.fragmentShader = `uniform vec3 actorEnvironment;\nuniform float flashAmount;\nuniform vec3 flashColor;\n${shader.fragmentShader}`
            .replace('#include <opaque_fragment>', 'outgoingLight *= actorEnvironment;\n#include <opaque_fragment>')
            .replace('#include <dithering_fragment>', '#include <dithering_fragment>\n\tgl_FragColor.rgb = mix(gl_FragColor.rgb, flashColor, flashAmount);');
        };
        const mesh = new THREE.Mesh(geometries.get(definition.low[0])![i], material);
        pivot.add(mesh); facing.add(pivot);
        return { part, pivot, mesh, material, x: 0, y: 0, width: 0, height: 0 };
      });
      const byId = new Map(parts.map(joint => [joint.part.id,joint]));
      const headJoint = byId.get('head');
      const faceMaterial = headJoint && textures.heroSittingLowSadFace ? headJoint.material.clone() : undefined;
      if(faceMaterial) faceMaterial.customProgramCacheKey=()=> 'actor-expression-head-v2';
      const faceBodyMask = { value: textures[definition.low[0].source] };
      if (faceMaterial) faceMaterial.onBeforeCompile = (shader, renderer) => {
        headJoint!.material.onBeforeCompile(shader, renderer);
        shader.fragmentShader = shader.fragmentShader.replace('if (headCutEnabled > 0.5) { vec2 headUv = (vMapUv - headCut.xy) / headCut.zw; float headMask = 1.0 - smoothstep(0.85, 1.0, length(headUv)); diffuseColor.a *= 1.0 - headMask; }', '');
        shader.uniforms.faceBodyMask = faceBodyMask;
        shader.vertexShader = 'attribute vec2 facePatchUv; attribute vec2 faceBodyUv; varying vec2 vFacePatchUv; varying vec2 vFaceBodyUv;\n' + shader.vertexShader;
        shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvFacePatchUv = facePatchUv; vFaceBodyUv = faceBodyUv;');
        shader.fragmentShader = 'uniform sampler2D faceBodyMask; varying vec2 vFacePatchUv; varying vec2 vFaceBodyUv;\n' + shader.fragmentShader;
      };
      const faceGeometries = new Map<DirectionalFrame, THREE.BufferGeometry>();
      const faceSources = new Map<DirectionalFrame, string>();
      const neutralGeometries = new Map<DirectionalFrame, THREE.BufferGeometry>();
      const curiousGeometries = new Map<DirectionalFrame, THREE.BufferGeometry>();
      const happyGeometries = new Map<DirectionalFrame, THREE.BufferGeometry>();
      if (faceMaterial) for (const frame of frames) {
        if (faceGeometries.has(frame)) continue;
        const opening = Boolean(textures[frame.source + 'Joyful']);
        const attachment = heroFaceAttachment(frame, 'sad', opening);
        const neutral = heroFaceAttachment(frame, 'neutral');
        const curious = heroFaceAttachment(frame, 'curious', opening);
        const happy = heroFaceAttachment(frame, 'happy');
        if(happy && textures[happy.source]) happyGeometries.set(frame, attachedFaceGeometry(frame.parts[0], happy, textures[happy.source].image, textures[frame.source].image));
        if(curious && textures[curious.source]) curiousGeometries.set(frame, attachedFaceGeometry(frame.parts[0], curious, textures[curious.source].image, textures[frame.source].image));
        if(neutral && textures[neutral.source]) neutralGeometries.set(frame, attachedFaceGeometry(frame.parts[0], neutral, textures[neutral.source].image, textures[frame.source].image));
        if (attachment && textures[attachment.source]) {
          const geometry = attachedFaceGeometry(frame.parts[0], attachment, textures[attachment.source].image, textures[frame.source].image);
          faceGeometries.set(frame, geometry); faceSources.set(frame, attachment.source);
        } else if (textures[frame.source + 'SadFace']) {
          faceGeometries.set(frame, directionalPartGeometry({ ...frame.parts[0], clip: undefined }, textures[frame.source].image));
          faceGeometries.get(frame)!.setAttribute('facePatchUv', new THREE.Float32BufferAttribute([.5,.5,.5,.5,.5,.5,.5,.5],2));
          faceGeometries.get(frame)!.setAttribute('faceBodyUv', faceGeometries.get(frame)!.getAttribute('uv').clone());
          faceSources.set(frame, frame.source + 'SadFace');
        }
      }
      const faceLayer = faceMaterial ? new THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>(new THREE.PlaneGeometry(), faceMaterial) : undefined;
      const emptyFaceGeometry = faceLayer?.geometry;
      if (faceLayer) { faceLayer.name = 'painted-face'; faceLayer.visible = false; headJoint!.pivot.add(faceLayer); }
      let expression: string | undefined;
      for(const joint of parts) if(joint.part.parent) byId.get(joint.part.parent)!.pivot.add(joint.pivot);
      const hindJoint = byId.get('hind');
      const bobtailMaterial = hindJoint && bobtailGeometries.size ? hindJoint.material.clone() : undefined;
      if (bobtailMaterial) bobtailMaterial.onBeforeCompile = hindJoint!.material.onBeforeCompile;
      const bobtail = bobtailMaterial ? new THREE.Mesh(bobtailGeometries.values().next().value!, bobtailMaterial) : undefined;
      if (bobtail) { bobtail.name = 'natural-bobtail'; hindJoint!.pivot.add(bobtail); }
      let bobtailVisible: boolean | undefined;
      // Gameplay never opts into this preserved archival effect.
      const flameTail = archivedEffects.heroFlameTail && definition.id.startsWith('hero') && textures.heroFlameTail
        ? createFlameTail(textures.heroFlameTail) : undefined;
      if (flameTail) byId.get('hind')!.pivot.add(flameTail.root);
      let flameVisible: boolean | undefined, opacity = 1;
      let view: SpriteView | undefined, active: DirectionalFrame | undefined;
      let poseName = 'standing', currentDefinition = definition;
      let animationFrame = 0;
      return {
        root, billboard, facing, parts,
        /** Shared by every joint; independent of gameplay tint and hit flashes. */
        environmentLight: environment.value,
        flameTail,
        bobtail,
        faceLayer,
        setExpression(value: string | undefined) {
          if (value !== expression) active = undefined;
          expression = value;
        },
        setBobtailVisible(visible: boolean | undefined) { bobtailVisible = visible; },
        setFlameTailVisible(visible: boolean | undefined) { flameVisible = visible; },
        get frame() { return active?.id ?? ''; },
        get view() { return view; },
        get pose() { return poseName; },
        get animationFrame() { return animationFrame; },
        hasPose(name: string) { return Boolean(definitions[name]); },
        setPose(name: string) {
          const next = definitions[name];
          if (!next) throw new Error(`Unknown sprite pose: ${name}`);
          if (poseName === name) return;
          poseName = name; currentDefinition = next; active = undefined;
        },
        update(camera: THREE.Camera, heading: number, time: number, reduced: boolean, phase = 0, action = 0, effectTime = time) {
          const animation = currentDefinition.animation;
          animationFrame = animation && !reduced ? ((Math.floor((time + phase) * animation.fps) % animation.frames.length) + animation.frames.length) % animation.frames.length : 0;
          const artwork = animation ? animation.frames[animationFrame] : currentDefinition;
          const dx = camera.position.x-root.position.x, dz = camera.position.z-root.position.z;
          const elevation = Math.atan2(camera.position.y-root.position.y, Math.hypot(dx,dz));
          const yaw = Math.atan2(dx,dz);
          view = selectSpriteView(heading,yaw,elevation,view);
          const opposite = view.elevation === 'low' ? artwork.lowOpposite : artwork.highOpposite;
          const authoredOpposite = view.elevation !== 'top' && view.flip<0 && opposite;
          const frame = view.elevation === 'top' ? artwork.top : (authoredOpposite || artwork[view.elevation])[view.direction];
          if (frame !== active) {
            active = frame;
            parts.forEach((joint,i) => {
              const part = frame.parts[i], h = part.height*height, w = h*part.rect[2]/part.rect[3];
              const [px,py] = part.pivot ?? [.5,.5];
              joint.part = part; joint.height = h; joint.width = w;
              joint.x = part.x*height+(px-.5)*w; joint.y = part.y*height+(py-.5)*h;
              joint.mesh.geometry = geometries.get(frame)![i]; joint.mesh.material.map = textures[expression === 'joyful' && textures[frame.source + 'Joyful'] ? frame.source + 'Joyful' : frame.source];
              joint.mesh.scale.set(w,h,1); joint.mesh.position.set((.5-px)*w,(.5-py)*h,0);
            });
            if (bobtail) {
              const hind = byId.get('hind')!;
              bobtail.geometry = bobtailGeometries.get(frame)!;
              bobtail.material.map = textures[frame.source + 'Bobtail'];
              bobtail.scale.copy(hind.mesh.scale);
              bobtail.position.copy(hind.mesh.position); bobtail.position.z += .002;
            }
          }
          if (bobtail) bobtail.visible = (bobtailVisible ?? getHeroBobtail()) && Boolean(textures[frame.source + 'Bobtail']) && (!textures[frame.source + 'Joyful'] || expression === 'joyful');
          if (faceLayer && headJoint) {
            const selectedGeometries=expression==='happy'?happyGeometries:expression==='curious'?curiousGeometries:expression==='neutral'?neutralGeometries:faceGeometries;
            const texture = textures[expression === 'happy' ? 'heroHappyHeads' : expression === 'curious' ? 'heroCuriousHeads' : expression === 'neutral' ? 'heroNeutralHeads' : faceSources.get(frame) ?? ''];
            // Happy is painted into the bespoke full bodies; preserve their
            // coherent face/neck silhouette. Legacy bodies use the new heads.
            faceLayer.visible = (expression === 'sad' || expression === 'neutral' || expression === 'curious' || expression === 'happy' && !textures[frame.source + 'Joyful']) && Boolean(texture) && selectedGeometries.has(frame) && view.elevation !== 'top' && view.direction !== 4;
            headCutEnabled.value = 0;
            if (faceLayer.visible) {
              faceLayer.geometry = selectedGeometries.get(frame)!; faceLayer.material.map = texture;
              const attachment=heroFaceAttachment(frame,expression === 'happy' ? 'happy' : expression === 'curious' ? 'curious' : expression === 'neutral' ? 'neutral' : 'sad', Boolean(textures[frame.source + 'Joyful']));
              if(attachment && textures.heroSadHeads) {
                const [x,y,w,h]=attachment.replaceTarget ?? attachment.target, [bx,by,bw,bh]=frame.parts[0].rect;
                const image=textures[frame.source].image;
                headCut.value.set((bx+(x+w*.5)*bw)/image.width,1-(by+(y+h*.30)*bh)/image.height,w*.68*bw/image.width,h*.65*bh/image.height);
                headCutEnabled.value=1;
              }
              faceBodyMask.value = textures[frame.source];
              faceLayer.scale.copy(headJoint.mesh.scale); faceLayer.position.copy(headJoint.mesh.position);
              faceLayer.position.z += .004;
            }
          }
          // The overhead image's nose points along local +Y. Lie it on the ground,
          // then rotate it into the WORLD heading rather than mirroring screen-left/right.
          billboard.rotation.set(view.elevation === 'top' ? -Math.PI/2 : -Math.max(0,elevation)*.75, view.elevation === 'top' ? 0 : yaw, 0, 'YXZ');
          if (view.elevation === 'top') billboard.rotation.y = heading+Math.PI;
          billboard.position.y = view.elevation === 'top' ? .10 : .03;
          // Overhead art describes a footprint, centred on the actor's ground anchor.
          // Scale the whole joint hierarchy together and recenter its footprint.
          // Reset on every view/pose change so elevated artwork keeps its anatomy.
          const lengthScale = view.elevation === 'top' ? currentDefinition.overheadLengthScale ?? 1 : 1;
          facing.scale.y = lengthScale;
          facing.position.y = view.elevation === 'top' ? -height*.5*lengthScale : 0;
          facing.scale.x = authoredOpposite ? 1 : view.flip;
          parts.forEach(joint => {
            const pose = currentDefinition.motion==='quadruped'?sampleQuadrupedPose(joint.part.id,time,phase,action,reduced,currentDefinition.motionProfile):sampleSpritePose(joint.part.id,time,phase,action,reduced);
            const squash = currentDefinition.motion === 'slime' && !reduced ? 1+Math.sin(time*3.8+phase)*.065 : pose.scaleY;
            const parent = joint.part.parent ? byId.get(joint.part.parent) : undefined;
            joint.pivot.position.set(joint.x-(parent?.x ?? 0)+pose.x*height,joint.y-(parent?.y ?? 0)+pose.y*height,joint.part.depth-(parent?.part.depth ?? 0));
            joint.pivot.rotation.z = pose.angle;
            // A quadruped breathes as one uniformly scaled hierarchy, rather
            // than stretching its torso independently of the attached parts.
            joint.pivot.scale.set(currentDefinition.motion === 'slime' ? 1/Math.sqrt(squash) : squash,squash,1);
          });
          if (flameTail) {
            const hind = byId.get('hind')!, [x,y] = flameTailAnchor(view,poseName);
            // Authored opposite views have their own source-image orientation.
            const anchorX = authoredOpposite ? 1-x : x;
            flameTail.root.position.set((anchorX-.5)*hind.width-hind.x, (.5-y)*hind.height+hind.part.y*height-hind.y, .003);
            flameTail.root.scale.setScalar(height*.29);
            flameTail.root.rotation.z = view.elevation === 'top' ? Math.PI : 0;
            flameTail.update(effectTime+phase,reduced,flameVisible ?? getHeroFlameTail(),opacity);
          }
        },
        setOpacity(value: number) { opacity = value; if (faceMaterial) { faceMaterial.opacity = value; faceMaterial.alphaTest = .01 * value; } if (bobtailMaterial) { bobtailMaterial.opacity = value; bobtailMaterial.alphaTest = .01 * value; } parts.forEach(({material}) => {
          const painted=Boolean(material.map?.userData.watercolor);
          const translucent=painted || opacity<1;
          if(material.transparent!==translucent){material.transparent=translucent;material.needsUpdate=true;}
          material.opacity=opacity;material.alphaTest=(painted ? .01 : .45)*opacity;material.depthWrite=!translucent;
        }); },
        setColor(color: THREE.ColorRepresentation) { parts.forEach(({material}) => material.color.set(color)); bobtailMaterial?.color.set(color); faceMaterial?.color.set(color); },
        setFlash(amount: number, color: THREE.ColorRepresentation = 0xffffff) { flash.amount.value = Math.max(0, Math.min(1, amount)); flash.color.value.set(color); },
        dispose() { flameTail?.dispose(); bobtailMaterial?.dispose(); faceMaterial?.dispose(); emptyFaceGeometry?.dispose(); faceGeometries.forEach(g => g.dispose()); neutralGeometries.forEach(g => g.dispose()); curiousGeometries.forEach(g => g.dispose()); happyGeometries.forEach(g => g.dispose()); parts.forEach(({material}) => material.dispose()); },
      };
    },
    dispose() { geometries.forEach(group => group.forEach(geometry => geometry.dispose())); bobtailGeometries.forEach(geometry => geometry.dispose()); },
  };
}

export type DirectionalSpriteInstance = ReturnType<ReturnType<typeof createDirectionalSpriteLibrary>['create']>;
