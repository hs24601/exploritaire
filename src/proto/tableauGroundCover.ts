import * as THREE from 'three';

/** Small canvas-authored brush atlas: stable world decoration, never game resources. */
export function createTableauGroundCover(root: THREE.Group, pixel: boolean, palette: 'woodland' | 'dirt' = 'woodland') {
  let seed = 81723;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  const textures: THREE.Texture[] = [];
  const materials: THREE.Material[] = [];
  const geometry = new THREE.PlaneGeometry(1, 1);
  const group = new THREE.Group(); group.name = 'tableau-ground-cover'; root.add(group);
  function surface(draw: (ctx: CanvasRenderingContext2D) => void) {
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 256;
    draw(canvas.getContext('2d')!);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.magFilter = pixel ? THREE.NearestFilter : THREE.LinearFilter;
    textures.push(texture);
    const material = new THREE.MeshLambertMaterial({ map: texture, transparent: true, depthWrite: false, side: THREE.DoubleSide });
    materials.push(material); return material;
  }
  const wash = surface(ctx => {
    for (let i = 0; i < 85; i++) {
      const x = 128 + (random() - .5) * 145, y = 128 + (random() - .5) * 145;
      const radius = 18 + random() * 44;
      const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
      const pigment = palette === 'dirt' ? (i % 3 ? '153,110,67' : '102,77,52') : i % 3 ? '103,116,62' : '113,85,54';
      gradient.addColorStop(0, `rgba(${pigment},.15)`); gradient.addColorStop(1, `rgba(${pigment},0)`);
      ctx.fillStyle = gradient; ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
    }
    // Loose fallen leaves and stones sit within the feathered wash.
    for (let i = 0; i < 36; i++) {
      const x = 128 + (random() - .5) * 160, y = 128 + (random() - .5) * 150;
      ctx.fillStyle = (palette === 'dirt' ? ['#ba966975','#86674788','#8d887b88','#63513d88'] : ['#8b805775', '#55674488', '#78796388', '#63513d88'])[i % 4];
      ctx.beginPath(); ctx.ellipse(x, y, 2 + random() * 6, 1 + random() * 3, random() * 6, 0, Math.PI * 2); ctx.fill();
    }
  });
  const shadow = surface(ctx => {
    const gradient = ctx.createRadialGradient(128, 128, 8, 128, 128, 122);
    gradient.addColorStop(0, '#101811c0'); gradient.addColorStop(.35, '#15201b70'); gradient.addColorStop(1, '#15201b00');
    ctx.fillStyle = gradient; ctx.fillRect(0, 0, 256, 256);
  });
  const grass = surface(ctx => {
    for (let i = 0; i < 24; i++) {
      const x = 76 + random() * 106, tip = x + (random() - .5) * 100, top = 65 + random() * 135;
      ctx.fillStyle = ['#526448b0', '#798052a0', '#384e3fb0', '#8b865879'][i % 4];
      ctx.beginPath(); ctx.moveTo(x - 4, 247); ctx.quadraticCurveTo(x - 10, top + 35, tip, top);
      ctx.quadraticCurveTo(x + 6, top + 50, x + 5, 247); ctx.closePath(); ctx.fill();
    }
  });
  function patch(mat: THREE.Material, x: number, z: number, width: number, depth: number, y: number) {
    const mesh = new THREE.Mesh(geometry, mat); mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(x, y, z); mesh.scale.set(width, depth, 1); group.add(mesh);
  }
  function tuft(x: number, z: number, size: number, y = 0) {
    for (let i = 0; i < 2; i++) {
      const mesh = new THREE.Mesh(geometry, grass);
      mesh.position.set(x, y + size * .47, z); mesh.scale.set(size * 1.5, size, 1);
      mesh.rotation.y = i * Math.PI / 2 + .4; group.add(mesh);
    }
  }
  // Low contrast islands instead of uniformly distributed rectangular flecks.
  for (let i = 0; i < 38; i++) {
    const x = (random() - .5) * 17, z = -12 + random() * 27;
    patch(wash, x, z, 3 + random() * 3, 2 + random() * 3, .018);
    if ((palette !== 'dirt' || i % 5 === 0) && (Math.abs(x) > 1.8 || z < -5 || z > 3)) tuft(x, z, .65 + random() * .6);
  }
  return {
    plant(x: number, z: number, width: number, y: number) {
      patch(wash, x, z, width * 1.5, width, y + .024);
      patch(shadow, x, z, width * .9, width * .48, y + .03);
      // A broken foreground fringe softens the cutout's trunk/ground join.
      for (let i = 0; i < 5; i++) {
        const angle = i / 5 * Math.PI * 2;
        tuft(x + Math.cos(angle) * width * .26, z + Math.sin(angle) * width * .15, width * (.18 + random() * .065), y);
      }
    },
    dispose() { root.remove(group); geometry.dispose(); materials.forEach(m => m.dispose()); textures.forEach(t => t.dispose()); },
  };
}
