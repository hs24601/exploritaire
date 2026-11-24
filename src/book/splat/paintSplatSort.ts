// Back-to-front ordering for alpha-blended splats. A 16-bit counting sort over
// view depth is linear in the splat count and fast enough for a worker at
// camera-motion rates (antimatter15/splat and most WebGL viewers do the same).

/** Sorts visible splats far-to-near into `out`, returning how many were kept.
 * `view` is the camera's column-major view matrix and `viewProjection` its
 * column-major projection·view matrix. Only indices below `budget` are drawn,
 * so a shuffled cloud can be thinned uniformly without rebuilding it. */
export function sortSplats(centers:Float32Array,view:ArrayLike<number>,viewProjection:ArrayLike<number>,budget:number,out:Float32Array,depths:Float32Array=new Float32Array(budget),order:Uint32Array=new Uint32Array(budget),counts:Uint32Array=new Uint32Array(65536)):number{
  const v=view,m=viewProjection,n=Math.min(budget,centers.length/3);
  let kept=0,near=Infinity,far=-Infinity;
  for(let i=0;i<n;i++){
    const x=centers[i*3],y=centers[i*3+1],z=centers[i*3+2];
    const w=m[3]*x+m[7]*y+m[11]*z+m[15];
    if(w<=.01)continue;
    // Generous margins: large near splats overhang the frustum edges.
    const cx=m[0]*x+m[4]*y+m[8]*z+m[12],cy=m[1]*x+m[5]*y+m[9]*z+m[13],limit=w*1.35+2;
    if(cx<-limit||cx>limit||cy<-limit||cy>limit)continue;
    const depth=-(v[2]*x+v[6]*y+v[10]*z+v[14]);
    depths[kept]=depth;order[kept]=i;kept++;
    if(depth<near)near=depth;if(depth>far)far=depth;
  }
  if(!kept)return 0;
  counts.fill(0);
  const scale=far>near?65535/(far-near):0;
  for(let k=0;k<kept;k++){const bucket=(far-depths[k])*scale|0;depths[k]=bucket;counts[bucket]++;}
  for(let b=1;b<65536;b++)counts[b]+=counts[b-1];
  // Stable placement: farthest bucket (0) first.
  for(let k=kept-1;k>=0;k--)out[--counts[depths[k]]]=order[k];
  return kept;
}
