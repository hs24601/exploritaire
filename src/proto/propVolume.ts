/** Small, sprite-derived voxel solids. X/Z are ground axes; Y is height.
 * Keep this independent of DOM/WebGL so the same model can supply views,
 * shadows and future world renderers. Source colours wrap around the solid. */
export type PropVolumeRecipe = { bands: readonly number[]; depth: number; trim: boolean; heightScale?: number; shape?: 'cave' | 'berry-bush'; symmetry?: 'asymmetric'; facing?: 'north' | 'east' | 'south' | 'west' };
export const propVolumeHeading = (recipe?: PropVolumeRecipe) => ({ north: 180, east: 90, south: 0, west: 270 }[recipe?.facing ?? 'south']);
export const PROP_VOLUME_RECIPES: Readonly<Record<string, PropVolumeRecipe>> = {
  'small_woods_pines.png': { bands: [0, .44, 1], depth: .85, trim: true },
  'woods_side.svg': { bands: [0, 1], depth: .9, trim: false },
  'woods_front.svg': { bands: [0, .55, 1], depth: .85, trim: false },
  'mountain_standee.svg': { bands: [0, .4, .76, 1], depth: .9, trim: true },
  // Neighbour-aware single-peak pieces of the same range (terrainAutotile.ts).
  'mountain_standee_peak.svg': { bands: [0, 1], depth: .9, trim: true },
  'mountain_standee_spur.svg': { bands: [0, 1], depth: .9, trim: true },
  // Seam saddles: long and shallow, the _ns copy turned to run north-south.
  'mountain_standee_ridge.svg': { bands: [0, .5, 1], depth: .5, trim: true },
  'mountain_standee_ridge_ns.svg': { bands: [0, .5, 1], depth: .5, trim: true, facing: 'east' },
  // Fixed world-north mouth, away from the mountains south of the den.
  'hero-den-standee-v2.png': { bands: [0, 1], depth: .95, trim: true, heightScale: .5, shape: 'cave', symmetry: 'asymmetric', facing: 'north' },
  'hero-den-standee-v3.png': { bands: [0, 1], depth: .95, trim: true, heightScale: .5, shape: 'cave', symmetry: 'asymmetric', facing: 'north' },
  'berry-bush.svg': { bands: [0, 1], depth: 1, trim: true, heightScale: .3, shape: 'berry-bush' },
};
export function propVolumeRecipe(src?: string) {
  return src ? PROP_VOLUME_RECIPES[src.split('/').pop()!.split('?')[0]] : undefined;
}
type Point = readonly [number, number, number];
export type VolumeFace = { vertices: readonly Point[]; normal: Point; color: readonly [number, number, number] };
export type PropVolume = { faces: VolumeFace[]; width: number; height: number; depth: number };
const SIDES: readonly { normal: Point; corners: readonly Point[] }[] = [
  { normal: [1,0,0], corners: [[1,0,0],[1,1,0],[1,1,1],[1,0,1]] },
  { normal: [-1,0,0], corners: [[0,0,1],[0,1,1],[0,1,0],[0,0,0]] },
  { normal: [0,1,0], corners: [[0,1,0],[0,1,1],[1,1,1],[1,1,0]] },
  { normal: [0,-1,0], corners: [[0,0,1],[0,0,0],[1,0,0],[1,0,1]] },
  { normal: [0,0,1], corners: [[1,0,1],[1,1,1],[0,1,1],[0,0,1]] },
  { normal: [0,0,-1], corners: [[0,0,0],[0,1,0],[1,1,0],[1,0,0]] },
];

/** Compress height about the ground without narrowing the footprint. The same
 * solid supplies camera projections and shadows; normals follow the transform. */
function scaleVolumeHeight(volume: PropVolume, scale = 1): PropVolume {
  if (scale === 1) return volume;
  return { ...volume, height: volume.height * scale, faces: volume.faces.map(face => {
    const [x, y, z] = face.normal, length = Math.hypot(x, y / scale, z);
    return { ...face, normal: [x / length, y / scale / length, z / length],
      vertices: face.vertices.map(([x, y, z]) => [x, y * scale, z] as Point) };
  }) };
}

/** Sweep each authored tree/peak's horizontal silhouette into an elliptical
 * cross section, including narrow trunks and the canopy's stepped branches.
 * Bands keep neighbouring trees/peaks independent instead of making a barrel. */
export function buildPropVolume(width: number, height: number, rgba: ArrayLike<number>, recipe: PropVolumeRecipe): PropVolume {
  if (recipe.shape === 'berry-bush') return scaleVolumeHeight(buildBerryBushVolume(), recipe.heightScale);
  let left = width, right = -1, top = height, bottom = -1;
  for (let y=0; y<height; y++) for (let x=0; x<width; x++) if (rgba[(y*width+x)*4+3] > 100) {
    left=Math.min(left,x); right=Math.max(right,x); top=Math.min(top,y); bottom=Math.max(bottom,y);
  }
  if (right < left) return { faces: [], width: 0, height: 0, depth: 0 };
  if (!recipe.trim) { left=0; right=width-1; top=0; bottom=height-1; }
  const w=right-left+1, h=bottom-top+1, d=Math.max(3,Math.ceil(w*recipe.depth));
  // Ground width sets scale, so tall art no longer leaves a tiny footprint.
  const unit=.92/w, voxels=new Int32Array(w*h*d).fill(-1);
  const at=(x:number,y:number,z:number) => (y*d+z)*w+x;
  const caveHollow=(x:number,y:number,z:number)=>recipe.shape==='cave'&&z>d*.32
    && ((x+.5-w/2)/(w*.32))**2+((h-y-.5)/(h*.68))**2<1;
  recipe.bands.slice(0,-1).forEach((start,band) => {
    const from=Math.floor(start*w), to=Math.min(w,Math.ceil(recipe.bands[band+1]*w));
    for (let y=0;y<h;y++) {
      let a=to,b=from-1;
      for(let x=from;x<to;x++) if(rgba[((y+top)*width+x+left)*4+3]>100) { a=Math.min(a,x); b=Math.max(b,x); }
      if(b<a)continue;
      const cx=(a+b+1)/2, rx=(b-a+1)/2;
      // Offset separate crowns/peaks slightly in depth, fixed in world space.
      // Each peak/crown uses the tile's depth budget; splitting a cluster
      // into horizontal bands must not make its side view wafer-thin.
      const cz=d/2+(band%2 ? .04 : -.04)*d, rz=Math.max(.6,rx*recipe.depth*w/Math.max(1,to-from));
      // Project each exposed axis onto the source row. Extruding X colours
      // through Z stretched the sprite's dark outline into entire side slabs.
      // Resolve holes once per row, then use the same palette on both axes.
      const rowSamples=Array.from({length:b-a+1},(_,offset)=>{
        const x=a+offset;
        for(let step=0;step<=b-a;step++)for(const candidate of [x-step,x+step]) {
          if(candidate>=a&&candidate<=b&&rgba[((y+top)*width+candidate+left)*4+3]>100)
            return ((y+top)*width+candidate+left)*4;
        }
        return -1;
      });
      for(let x=a;x<=b;x++) for(let z=0;z<d;z++) {
        if(((x+.5-cx)/rx)**2+((z+.5-cz)/rz)**2>1)continue;
        // Carve a front-facing arch into the cave, with a thick roof, side
        // walls and a closed rear. Never sweep the entrance into a solid rock.
        if(caveHollow(x,y,z))continue;
        // Some source rows have holes. Sample their nearest opaque texel;
        // closed geometry must never contain black/transparent texture gutters.
        // Wrap one continuous material around the solid's perimeter. A voxel
        // carries the same ink on its side and horizontal ledges, avoiding
        // dark contour rings at the steps between sprite rows. Quadrant signs
        // join the projections at corners; only geometry supplies the outline.
        const px=(x+.5-cx)/rx,pz=(z+.5-cz)/rz;
        let sample=recipe.symmetry==='asymmetric' ? x : Math.max(a,Math.min(b,Math.floor(
          cx+(Math.abs(px)>Math.abs(pz) ? Math.sign(px)*pz : Math.sign(pz)*px)*rx)));
        if(recipe.shape === 'cave' && z < d*.32) sample=Math.min(b,a+Math.max(1,Math.floor((b-a)*.12)));
        voxels[at(x,y,z)]=rowSamples[sample-a];
      }
    }
  });
  const faces:VolumeFace[]=[];
  for(let y=0;y<h;y++)for(let z=0;z<d;z++)for(let x=0;x<w;x++) {
    const sample=voxels[at(x,y,z)];if(sample<0)continue;
    for(const {normal,corners} of SIDES) {
      const nx=x+normal[0],ny=y-normal[1],nz=z+normal[2];
      if(nx>=0&&nx<w&&ny>=0&&ny<h&&nz>=0&&nz<d&&voxels[at(nx,ny,nz)]>=0)continue;
      // Interior faces need their own dark material; exterior stone colours
      // on the alcove's back wall made the carved mouth read as filled rock.
      const inside=nx>=0&&nx<w&&ny>=0&&ny<h&&nz>=0&&nz<d&&caveHollow(nx,ny,nz);
      const ink=inside?((y+top)*width+x+left)*4:sample;
      const shade=inside ? .35 : 1;
      faces.push({ normal, color:[rgba[ink]*shade,rgba[ink+1]*shade,rgba[ink+2]*shade],
        vertices:corners.map(([a,b,c])=>[(x+a-w/2)*unit,(h-y-1+b)*unit,(z+c-d/2)*unit] as Point) });
    }
  }
  // Bake authored heading into the solid once, including normals and shadows.
  // Camera orbit must never mirror or turn an asymmetric landmark's entrance.
  const angle=propVolumeHeading(recipe)*Math.PI/180,c=Math.cos(angle),s=Math.sin(angle);
  if(angle)for(const face of faces) {
    const rotate=([x,y,z]:Point):Point=>[c*x+s*z,y,-s*x+c*z];
    face.normal=rotate(face.normal);face.vertices=face.vertices.map(rotate);
  }
  return scaleVolumeHeight({ faces, width:w*unit, height:h*unit, depth:d*unit }, recipe.heightScale);
}

/** Authored low shrubs, rather than a forest silhouette swept into a cylinder.
 * Fruit is actual geometry on all sides, so orbit reveals different clusters. */
function buildBerryBushVolume(): PropVolume {
  const w=32,h=23,d=32,unit=.92/w;
  const cells=new Int16Array(w*h*d).fill(-1), at=(x:number,y:number,z:number)=>(y*d+z)*w+x;
  const palette: readonly (readonly [number,number,number])[] = [
    [56,37,29],[34,69,42],[46,91,48],[65,113,54],[90,137,64],
    [81,35,74],[148,50,97],[212,87,132],[246,158,181],
  ];
  const sphere=(cx:number,cy:number,cz:number,rx:number,ry:number,rz:number,fruit=false)=>{
    for(let y=0;y<h;y++)for(let z=0;z<d;z++)for(let x=0;x<w;x++) {
      if(((x+.5-cx)/rx)**2+((y+.5-cy)/ry)**2+((z+.5-cz)/rz)**2>1)continue;
      const variation=(x*13+y*7+z*11)%9;
      cells[at(x,y,z)]=fruit ? (y>=cy&&x<cx ? 8 : y>=cy ? 7 : y<cy-1 ? 5 : 6)
        : 1+Math.min(3,Math.floor(y/7)+(variation<2 ? 1 : 0));
    }
  };
  // Separate crowns and stems leave real ground gaps, including on orbit.
  for(const [x,z] of [[6,6],[25,7],[16,16],[7,25],[25,25]]) {
    for(let y=0;y<7;y++){cells[at(x,y,z)]=0;cells[at(x+1,y,z)]=0;}
    sphere(x,12,z,5,8,5);
    sphere(x-1,16,z,3.8,6,3.8);
    // Fruit belongs to each shrub, with clusters on every exposed side.
    for(const [dx,dy,dz] of [[0,13,-4],[4,11,0],[0,12,4],[-4,14,0],[1,20,0]]) {
      sphere(x+dx,dy,z+dz,1.1,1.4,1.1,true);
      sphere(x+dx+.8,dy-2,z+dz+.4,1,1.2,1,true);
    }
  }
  const faces:VolumeFace[]=[];
  for(let y=0;y<h;y++)for(let z=0;z<d;z++)for(let x=0;x<w;x++) {
    const material=cells[at(x,y,z)];if(material<0)continue;
    for(const {normal,corners} of SIDES) {
      const nx=x+normal[0],ny=y+normal[1],nz=z+normal[2];
      if(nx>=0&&nx<w&&ny>=0&&ny<h&&nz>=0&&nz<d&&cells[at(nx,ny,nz)]>=0)continue;
      faces.push({normal,color:palette[material],vertices:corners.map(([a,b,c])=>[(x+a-w/2)*unit,(y+b)*unit,(z+c-d/2)*unit] as Point)});
    }
  }
  return {faces,width:w*unit,height:h*unit,depth:d*unit};
}

export type VolumeLight = { direction: Point; brightness: number; localDirection: Point; localAmount: number; tint: readonly [number,number,number] };
export const VOLUME_RASTER_WIDTH=128, VOLUME_RASTER_HEIGHT=160;
// Fixed projection bounds and a fixed foot anchor; never fit each view to its
// visible bounds (that would make trees inflate and their feet slide on orbit).
export const VOLUME_VIEW={ left:-.75, top:-1.2, width:1.5, height:1.875, footY:1.2/1.875 };
/** Fixed per solid, never fitted per orbit: allow tall ground-sized scenery. */
export function propVolumeView(volume: PropVolume) {
  const top=Math.min(VOLUME_VIEW.top,-Math.hypot(volume.height,Math.hypot(volume.width,volume.depth)/2)-.1);
  return {...VOLUME_VIEW,top,height:.675-top};
}
export function shadeVolumeFace(face:VolumeFace, light:VolumeLight, monochrome=false) {
  const dot=(a:Point,b:Point)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
  const length=Math.max(.001,Math.hypot(...light.direction)),localLength=Math.max(.001,Math.hypot(...light.localDirection));
  const shade=(.64+.48*Math.max(0,dot(face.normal,light.direction)/length))*light.brightness;
  const local=Math.max(0,dot(face.normal,light.localDirection)/localLength)*light.localAmount*.38;
  return face.color.map((value,i)=>Math.min(255, Math.max(0,(monochrome?[45,60,73][i]:value)*shade+light.tint[i]*local)));
}
export function renderPropVolume(volume:PropVolume, yaw:number, elevation:number, light:VolumeLight, monochrome=false) {
  const bounds=propVolumeView(volume);
  const w=VOLUME_RASTER_WIDTH,h=VOLUME_RASTER_HEIGHT, pixels=new Uint8ClampedArray(w*h*4), depths=new Float32Array(w*h).fill(-Infinity);
  const a=yaw*Math.PI/180,e=elevation*Math.PI/180,c=Math.cos(a),s=Math.sin(a),ce=Math.cos(e),se=Math.sin(e);
  const view:Point=[s*ce,se,c*ce];
  const project=([x,y,z]:Point):Point=>[(c*x-s*z-bounds.left)/bounds.width*w,
    ((s*x+c*z)*se-y*ce-bounds.top)/bounds.height*h, s*x*ce+y*se+c*z*ce];
  const dot=(a:Point,b:Point)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
  for(const face of volume.faces) {
    if(dot(face.normal,view)<=0)continue;
    const vertices=face.vertices.map(project);
    const color=shadeVolumeFace(face,light,monochrome);
    for(const indices of [[0,1,2],[0,2,3]]) {
      const [p,q,r]=indices.map(i=>vertices[i]);
      const area=(q[0]-p[0])*(r[1]-p[1])-(q[1]-p[1])*(r[0]-p[0]);
      if(Math.abs(area)<1e-7)continue;
      const x0=Math.max(0,Math.floor(Math.min(p[0],q[0],r[0]))),x1=Math.min(w-1,Math.ceil(Math.max(p[0],q[0],r[0])));
      const y0=Math.max(0,Math.floor(Math.min(p[1],q[1],r[1]))),y1=Math.min(h-1,Math.ceil(Math.max(p[1],q[1],r[1])));
      for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++) {
        const px=x+.5,py=y+.5;
        const u=((q[0]-px)*(r[1]-py)-(q[1]-py)*(r[0]-px))/area;
        const v=((r[0]-px)*(p[1]-py)-(r[1]-py)*(p[0]-px))/area,t=1-u-v;
        if(u<-.0001||v<-.0001||t<-.0001)continue;
        const depth=u*p[2]+v*q[2]+t*r[2],i=y*w+x;
        if(depth<depths[i])continue;
        depths[i]=depth;pixels[i*4]=color[0];pixels[i*4+1]=color[1];pixels[i*4+2]=color[2];pixels[i*4+3]=255;
      }
    }
  }
  return pixels;
}
