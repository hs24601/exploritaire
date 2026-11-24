import type { PropVolume, PropVolumeRecipe, VolumeFace } from './propVolume';

type Point = readonly [number,number,number];
type Ink = readonly [number,number,number];

/** Sweep a painted silhouette into continuous rounded rings, rather than
 * voxel cubes. The broad source washes wrap periodically around every ring;
 * vertex ink and normals interpolate across the surface. Placement is authored
 * once in world space. This reconstructed material can later be replaced with
 * authored rear/side paint without changing scene integration. */
export function buildPaintedPropVolume(width:number,height:number,rgba:ArrayLike<number>,recipe:PropVolumeRecipe):PropVolume {
  let left=width,right=-1,top=height,bottom=-1;
  for(let y=0;y<height;y++)for(let x=0;x<width;x++)if(rgba[(y*width+x)*4+3]>100){
    left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);
  }
  if(right<left)return {faces:[],width:0,height:0,depth:0,surface:'paint'};
  const unit=.92/(right-left+1),segments=64;
  const rows:Array<{y:number;center:number;radius:number;samples:number[]}>=[];
  for(let y=top;y<=bottom;y++){
    const samples:number[]=[];
    for(let x=left;x<=right;x++)if(rgba[(y*width+x)*4+3]>100)samples.push(x);
    if(!samples.length)continue;
    rows.push({y,center:(samples[0]+samples[samples.length-1])/2,radius:(samples[samples.length-1]-samples[0]+1)/2,samples});
  }
  // Broad silhouette filtering avoids turning every little painted edge into
  // a sculpted shelf. Color stays at source resolution, independent of shape.
  const radii=rows.map((_,i)=>{
    let radius=0,weight=0;
    for(let offset=-4;offset<=4;offset++){const w=5-Math.abs(offset);radius+=rows[Math.max(0,Math.min(rows.length-1,i+offset))].radius*w;weight+=w;}
    return radius/weight;
  });
  // Most of the crown is a connected taper: deep silhouette notches represent
  // lost paint/branch edges, not hollow grooves through the entire tree. Keep
  // their suggestion while filling the continuous body beneath the washes.
  const broadest=radii.indexOf(Math.max(...radii));
  let envelope=0;
  for(let i=0;i<=broadest;i++){envelope=Math.max(envelope,radii[i]);radii[i]=radii[i]*.3+envelope*.7;}
  const faces:VolumeFace[]=[];
  const instances=recipe.instances??[{x:0,z:0,scale:1,heading:0}];
  for(const instance of instances){
    const heading=(instance.heading??0)*Math.PI/180;
    const rings=rows.map((row,i)=>Array.from({length:segments},(_,j)=>{
      const theta=j/segments*Math.PI*2,angle=theta+heading;
      // Broad, fixed lobes keep a hand-painted crown irregular from the rear.
      const lobe=1+.055*Math.sin(theta*5+row.y*.035)+.025*Math.cos(theta*3-row.y*.045);
      const radius=radii[i]*unit*instance.scale*lobe;
      const position:Point=[instance.x+Math.sin(angle)*radius,(bottom-row.y)*unit*instance.scale*(recipe.heightScale??1),instance.z+Math.cos(angle)*radius*recipe.depth];
      // Paint already explains the bough shading. Bound the normal's vertical
      // variation so diffuse world light does not polish each tier into a ring.
      const slope=Math.max(-.3,Math.min(.3,(radii[Math.min(rows.length-1,i+1)]-radii[Math.max(0,i-1)])/2));
      const length=Math.hypot(Math.sin(angle),slope,Math.cos(angle)/recipe.depth);
      const normal:Point=[Math.sin(angle)/length,slope/length,Math.cos(angle)/recipe.depth/length];
      // Stay inside the pigment body; faint transparent bleed must not become
      // black strips extruded onto the opaque solid. Preserve alpha in OTT art.
      const sampleX=row.center+Math.sin(theta)*row.radius*.86;
      let sample=row.samples[0];
      for(const x of row.samples)if(Math.abs(x-sampleX)<Math.abs(sample-sampleX))sample=x;
      const offset=(row.y*width+sample)*4;
      const ink:Ink=[rgba[offset],rgba[offset+1],rgba[offset+2]];
      return {position,normal,ink};
    }));
    for(let i=0;i<rings.length-1;i++)for(let j=0;j<segments;j++){
      const next=(j+1)%segments;
      const corners=[rings[i][j],rings[i+1][j],rings[i+1][next],rings[i][next]];
      const [a,b,c]=corners.map(corner=>corner.position);
      const u=b.map((value,k)=>value-a[k]),v=c.map((value,k)=>value-a[k]);
      const cross:Point=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];
      const length=Math.hypot(...cross)||1;
      faces.push({vertices:corners.map(corner=>corner.position),normal:cross.map(value=>value/length) as unknown as Point,
        color:corners[0].ink,colors:corners.map(corner=>corner.ink),normals:corners.map(corner=>corner.normal)});
    }
    // Close the solid at both ends; the cap shares the source pigment.
    for(const i of [0,rings.length-1])for(let j=0;j<segments;j++){
      const a=rings[i][j],b=rings[i][(j+1)%segments],normal:Point=[0,i===0?1:-1,0];
      const center:Point=[instance.x,a.position[1],instance.z];
      const vertices=i===0?[center,a.position,b.position,center]:[center,b.position,a.position,center];
      faces.push({vertices,normal,color:a.ink});
    }
  }
  // Ground containment is fixed for the whole model, never fitted per orbit.
  let minX=Infinity,maxX=-Infinity,minZ=Infinity,maxZ=-Infinity;
  for(const face of faces)for(const [x,,z] of face.vertices){minX=Math.min(minX,x);maxX=Math.max(maxX,x);minZ=Math.min(minZ,z);maxZ=Math.max(maxZ,z);}
  const scale=Math.min(1,.92/Math.max(maxX-minX,maxZ-minZ));
  const cx=(minX+maxX)/2,cz=(minZ+maxZ)/2;
  for(const face of faces)face.vertices=face.vertices.map(([x,y,z])=>[(x-cx)*scale,y*scale,(z-cz)*scale]);
  return {faces,width:(maxX-minX)*scale,depth:(maxZ-minZ)*scale,height:Math.max(...rows.map(row=>(bottom-row.y)*unit))*Math.max(...instances.map(instance=>instance.scale))*scale*(recipe.heightScale??1),surface:'paint'};
}
