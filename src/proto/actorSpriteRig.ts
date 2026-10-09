import * as THREE from 'three';
import { billboardFacing } from './actorOrientation';
import { sampleSpritePose, type SpriteRigDefinition, type SpritePart } from './actorSpriteLibrary';

/** Shared source and masked textures are owned by the library, instances own transforms/materials. */
export function createSpriteRigLibrary(source: THREE.Texture, definition: SpriteRigDefinition) {
  const image = source.image as CanvasImageSource & { width: number; height: number };
  const scan = document.createElement('canvas'); scan.width = image.width; scan.height = image.height;
  const ink = scan.getContext('2d')!; ink.drawImage(image, 0, 0);
  const rgba = ink.getImageData(0, 0, image.width, image.height).data;
  let bottom = image.height - 1;
  outer: for (; bottom >= 0; bottom--) for (let x = 0; x < image.width; x++) if (rgba[(bottom * image.width + x) * 4 + 3] > 38) break outer;
  const foot = (bottom + 1) / image.height;
  const textures = definition.parts.map(part => {
    if (!part.region && !part.exclude) return source;
    const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height;
    const ctx = canvas.getContext('2d')!;
    const polygon = (points: NonNullable<SpritePart['region']>) => {
      ctx.beginPath(); points.forEach(([x,y], i) => i ? ctx.lineTo(x * image.width, y * image.height) : ctx.moveTo(x * image.width, y * image.height)); ctx.closePath();
    };
    ctx.fillStyle = '#fff';
    if (part.region) {
      polygon(part.region); ctx.fill();
      // One source-art pixel of concealed overlap lets joints move without opening cracks.
      ctx.lineWidth = Math.max(1, image.width * .012); ctx.strokeStyle = '#fff'; ctx.stroke();
    } else ctx.fillRect(0, 0, image.width, image.height);
    ctx.globalCompositeOperation = 'destination-out';
    part.exclude?.forEach(points => { polygon(points); ctx.fill(); });
    ctx.globalCompositeOperation = 'source-in'; ctx.drawImage(image, 0, 0);
    const texture = new THREE.CanvasTexture(canvas);
    texture.magFilter = texture.minFilter = THREE.NearestFilter; texture.generateMipmaps = false; texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  });
  const geometry = new THREE.PlaneGeometry(1, 1);
  return {
    create(height: number, tint = 0xffffff) {
      const root = new THREE.Group(), billboard = new THREE.Group(), facing = new THREE.Group();
      root.add(billboard); billboard.add(facing);
      const width = height * image.width / image.height;
      const parts = definition.parts.map((part, i) => {
        const pivot = new THREE.Group(); pivot.name = part.id;
        // Flat cut-outs need one transparent pass; drawing both faces separately doubles actor draw calls.
        const material = new THREE.MeshBasicMaterial({ map: textures[i], color: tint, transparent: true, alphaTest: .15, side: THREE.DoubleSide, forceSinglePass: true });
        const mesh = new THREE.Mesh(geometry, material); mesh.scale.set(width, height, 1);
        const x = (part.pivot[0] - .5) * width, y = (foot - part.pivot[1]) * height;
        pivot.position.set(x, y, part.depth); mesh.position.set(-x, (foot - .5) * height - y, 0);
        pivot.add(mesh); facing.add(pivot);
        return { part, pivot, material, x, y };
      });
      let flip = 1;
      return {
        root, billboard, facing, parts,
        update(camera: THREE.Camera, heading: number, time: number, reduced: boolean, phase = 0, action = 0) {
          billboard.rotation.y = Math.atan2(camera.position.x - root.position.x, camera.position.z - root.position.z);
          flip = billboardFacing(heading, billboard.rotation.y, definition.authoredFacing, flip);
          facing.scale.x = flip;
          parts.forEach(({part, pivot, x, y}) => {
            const pose = sampleSpritePose(part.id, time, phase, action, reduced);
            pivot.position.set(x + pose.x * width, y + pose.y * height, part.depth);
            pivot.rotation.z = pose.angle; pivot.scale.y = pose.scaleY;
          });
        },
        setOpacity(opacity: number) { parts.forEach(({material}) => { material.opacity = opacity; material.depthWrite = false; }); },
        setColor(color: THREE.ColorRepresentation) { parts.forEach(({material}) => material.color.set(color)); },
        dispose() { parts.forEach(({material}) => material.dispose()); },
      };
    },
    dispose() { textures.forEach(texture => { if (texture !== source) texture.dispose(); }); geometry.dispose(); },
  };
}
