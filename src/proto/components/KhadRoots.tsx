import { useEffect, useId, useMemo, useState } from 'react';
import type { TravelCard } from '../travelJourney';
import { khadRootGeometry as grownRoots, khadBridgeGeometry as grownBridge } from '../khadRootGeometry';
import { khadRootGeometry as baselineRoots, khadBridgeGeometry as baselineBridge } from '../khadRootGeometryBaseline';
import { KHAD_PAINT_FRAME, KHAD_PAINT_VERSION, paintKhadBridge, paintKhadRoots } from '../khadRootPainter';

/** Which growth to draw. `v2` (grown) is the default; `?khad-geometry=v1`
 * shows the frozen first version in place, for comparison during review. */
export type KhadGeometryVersion = 'v1' | 'v2';
export const khadGeometryFromUrl = (): KhadGeometryVersion => new URLSearchParams(globalThis.location?.search ?? '').get('khad-geometry') === 'v1' ? 'v1' : 'v2';
/** How the bark is painted. `painted` (the game default, Eric 2026-10-20) is
 * the bark-plate raster painter on grown v2 geometry; `?khad-paint=svg` shows
 * the vector pigment instead, which also covers the moment before a bake lands. */
export type KhadPaintMode = 'svg' | 'painted';
export const khadPaintFromUrl = (): KhadPaintMode => new URLSearchParams(globalThis.location?.search ?? '').get('khad-paint') === 'svg' ? 'svg' : 'painted';
type Raster = { width: number; height: number; data: Uint8ClampedArray<ArrayBuffer> };
const painted = new Map<string, Promise<string>>();
/** Bakes once per key off the render path and caches an object URL (bounded). */
function bake(key: string, paint: () => Raster): Promise<string> {
  const hit = painted.get(key); if (hit) { painted.delete(key); painted.set(key, hit); return hit; }
  const job = new Promise<string>((resolve, reject) => setTimeout(() => {
    try {
      const raster = paint(), canvas = document.createElement('canvas'); canvas.width = raster.width; canvas.height = raster.height;
      canvas.getContext('2d')!.putImageData(new ImageData(raster.data, raster.width, raster.height), 0, 0);
      canvas.toBlob(blob => blob ? resolve(URL.createObjectURL(blob)) : reject(new Error('Khad Roots bake failed.')), 'image/png');
    } catch (error) { reject(error); }
  }, 0));
  painted.set(key, job);
  if (painted.size > 48) { const [oldest, url] = painted.entries().next().value!; painted.delete(oldest); void url.then(u => URL.revokeObjectURL(u), () => {}); }
  return job;
}
/** The painted image once ready; until then (or on failure) callers keep the SVG. */
function usePainted(key: string | null, paint: () => Raster) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!key) { setUrl(null); return; }
    let live = true; setUrl(null);
    void bake(key, paint).then(u => { if (live) setUrl(u); }, () => {});
    return () => { live = false; };
  // The key fully identifies the bake.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return url;
}

const geometryFor = (version: KhadGeometryVersion) => version === 'v1' ? { roots: baselineRoots, bridge: baselineBridge } : { roots: grownRoots, bridge: grownBridge };
import './KhadRoots.css';

/** Fixed pigment texture: the roots never crawl or shimmer while reading cards. */
function RootPigment({id}:{id:string}) {
  return <defs>
    <linearGradient id={`${id}-wood`} x1="0" y1="0" x2="1" y2=".35">
      <stop stopColor="#180a18" /><stop offset=".3" stopColor="#67233d" /><stop offset=".48" stopColor="#a64356" />
      <stop offset=".64" stopColor="#441526" /><stop offset="1" stopColor="#160c1b" />
    </linearGradient>
    <filter id={`${id}-haze`} x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="3.1" /></filter>
    <radialGradient id={`${id}-ember`}><stop stopColor="#eb3249" stopOpacity=".85" /><stop offset=".25" stopColor="#b91838" stopOpacity=".7" /><stop offset="1" stopColor="#790b2e" stopOpacity="0" /></radialGradient><filter id={id} x="-25%" y="-30%" width="150%" height="160%" colorInterpolationFilters="sRGB">
    <feTurbulence type="fractalNoise" baseFrequency=".065 .18" numOctaves={3} seed={17} result="grain" />
    <feDisplacementMap in="SourceGraphic" in2="grain" scale={.9} xChannelSelector="R" yChannelSelector="G" result="ragged" />
    <feColorMatrix in="grain" type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 .2 .8" result="paper" />
    <feComposite in="ragged" in2="paper" operator="in" result="paint" />
    <feColorMatrix in="grain" type="matrix" values=".6 0 0 0 .35  .6 0 0 0 .30  .6 0 0 0 .32  0 0 0 0 1" result="bark" />
    <feBlend in="paint" in2="bark" mode="multiply" result="deposited" />
    <feComposite in="deposited" in2="paint" operator="in" />
  </filter></defs>;
}

function RootWood({stems,id}:{stems:ReturnType<typeof baselineRoots>['stems'];id:string}) {
  return <>
    <g className="khad-roots__haze" filter={`url(#${id}-haze)`}>
      {stems.map((s,i)=><path key={i} d={s.moonEdges.join(' ')} />)}
    </g>
    <g filter={`url(#${id})`}>
      {stems.map((s,i)=><g key={i}>
        <path className="khad-roots__wood" fill={`url(#${id}-wood)`} d={s.ribbon} />
        <g className="khad-roots__thorns" fill={`url(#${id}-wood)`}>{s.thorns.map((d,j)=><path key={j} d={d} />)}</g>
        <g className="khad-roots__bark">{s.ridges.map((d,j)=><path key={j} d={d} />)}</g>
        <g className="khad-roots__seam-glow" filter={`url(#${id}-haze)`}>{s.moonEdges.map((d,j)=><path key={j} d={d} />)}</g>
        <g className="khad-roots__fissures">{s.moonEdges.map((d,j)=><path key={j} d={d} />)}</g>
      </g>)}
    </g>
  </>;
}

/** Static, scalable painted vines: no animation clock and no input interception. */
export function KhadRoots({groupId,cardId,obscureValue=false,version=khadGeometryFromUrl(),paint=khadPaintFromUrl(),density=2.4}:{groupId:string;cardId:string;obscureValue?:boolean;version?:KhadGeometryVersion;paint?:KhadPaintMode;
  /** Painted pixels per card unit (a card is 100 units wide). */ density?:number}) {
  const growth=useMemo(()=>geometryFor(version).roots(cardId,obscureValue),[cardId,obscureValue,version]);
  // The painter draws grown geometry only.
  const image=usePainted(paint==='painted'&&version==='v2'?`${KHAD_PAINT_VERSION}:${cardId}:${obscureValue}:${density}`:null,()=>paintKhadRoots(cardId,obscureValue,density));
  const pigmentId=`khad-pigment-${useId().replace(/:/g,'')}`;
  return <svg className="khad-roots" viewBox="0 0 100 140" aria-hidden="true" data-khad-group={groupId} data-obscure-value={obscureValue} data-khad-geometry={version} data-khad-paint={image?'painted':'svg'}>
    <RootPigment id={pigmentId} />
    <defs><mask id={`${pigmentId}-clearance`} x="-25" y="-30" width="150" height="200" maskUnits="userSpaceOnUse">
      <rect x="-25" y="-30" width="150" height="200" fill="white" />
      {/* Reserve the reward icon and, by default, the central value window.
          All paint and particles share these holes, including future root paths. */}
      <rect x="65" y="0" width="33" height="36" rx="5" fill="black" />
      {!obscureValue && <rect data-khad-value-clearance="true" x="17" y="39" width="66" height="67" rx="10" fill="black" />}
    </mask></defs>
    <g mask={`url(#${pigmentId}-clearance)`}>
    {image ? <image href={image} x={KHAD_PAINT_FRAME.x} y={KHAD_PAINT_FRAME.y} width={KHAD_PAINT_FRAME.size} height={KHAD_PAINT_FRAME.size} preserveAspectRatio="none" /> : <RootWood stems={growth.stems} id={pigmentId} />}
    {/* Moon response stays on the bark; no free-floating red emission. */}
    </g>
  </svg>;
}

/** A group bridge disappears independently as individual cards lose their binding. */
export function KhadRootLinks({cards,version=khadGeometryFromUrl(),paint=khadPaintFromUrl(),density=2.4}:{cards:readonly TravelCard[];version?:KhadGeometryVersion;paint?:KhadPaintMode;density?:number}) {
  const {roots}=geometryFor(version);
  const rooted=cards.filter(c=>c.khadRoot && c.pose);
  return <>{rooted.flatMap((card,index)=>{
    const next=rooted.slice(index+1).find(c=>c.khadRoot!.groupId===card.khadRoot!.groupId);
    if(!next)return [];
    // Follow each card's actual rotated, seeded strand endpoint.
    const attach=(c:TravelCard)=>{
      const pose=c.pose!,anchor=roots(c.id).anchor;
      const dx=anchor.x/100-.5,dy=anchor.y/100-.7,r=pose.rotation*Math.PI/180;
      return {x:pose.x+.5+dx*Math.cos(r)-dy*Math.sin(r),y:pose.y+.7+dx*Math.sin(r)+dy*Math.cos(r)};
    };
    return [<KhadRootLink key={card.id} a={attach(card)} b={attach(next)} id={`${card.id}:${next.id}`} version={version} paint={paint} density={density} />];
  })}</>;
}

/** One group link between two attachment points, in card-width units. */
function KhadRootLink({a,b,id,version,paint,density}:{a:{x:number;y:number};b:{x:number;y:number};id:string;version:KhadGeometryVersion;paint:KhadPaintMode;density:number}) {
  const pigmentId=`khad-link-pigment-${useId().replace(/:/g,'')}`;
  const x=Math.min(a.x,b.x)-.25,y=Math.min(a.y,b.y)-.2,w=Math.abs(a.x-b.x)+.85,h=Math.abs(a.y-b.y)+.55;
  const ax=(a.x-x)*100,ay=(a.y-y)*100,bx=(b.x-x)*100,by=(b.y-y)*100;
  const bridge=useMemo(()=>geometryFor(version).bridge({x:ax,y:ay},{x:bx,y:by},id),[version,ax,ay,bx,by,id]);
  // A square frame covering the link's viewBox, with room for thorns and wash.
  const frame={x:-20,y:-20,size:Math.max(w,h)*100+40};
  const key=paint==='painted'&&version==='v2'?`${KHAD_PAINT_VERSION}:link:${id}:${ax.toFixed(1)},${ay.toFixed(1)},${bx.toFixed(1)},${by.toFixed(1)}:${density}`:null;
  // Long links lower their density so the square bake stays within 2048 pixels.
  const image=usePainted(key,()=>paintKhadBridge({x:ax,y:ay},{x:bx,y:by},id,frame,Math.min(density,2040/frame.size)));
  return <svg className="khad-root-link" viewBox={`0 0 ${w*100} ${h*100}`} preserveAspectRatio="none" aria-hidden="true" data-khad-paint={image?'painted':'svg'} style={{left:`calc(var(--classic-card-w) * ${x})`,top:`calc(var(--classic-card-w) * ${y})`,width:`calc(var(--classic-card-w) * ${w})`,height:`calc(var(--classic-card-w) * ${h})`}}>
    <RootPigment id={pigmentId} />
    {image ? <image href={image} x={frame.x} y={frame.y} width={frame.size} height={frame.size} preserveAspectRatio="none" /> : <RootWood stems={[bridge]} id={pigmentId} />}
  </svg>;
}

