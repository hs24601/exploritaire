import { ManaberryBlob } from './ManaberryBlob';
import { SPARSE_BERRY_POINTS } from '../berryPresentation';
/** Independent fruit elements registered to the foliage canvas. */
export function BushBerries({ sprite, visible, overhead = false, count, layout }: { sprite: string; visible: boolean; count?: number; overhead?: boolean; layout?: { size: string; position: string } }) {
  if (!/berry|bush/.test(sprite) || (!visible && !sprite.includes('sparse'))) return null;
  const sparse = sprite.includes('sparse');
  const defaultPoints = sparse ? SPARSE_BERRY_POINTS.map(({x,y}, index) => [x, overhead ? y + (index === 0 ? .02 : .03) : y]).slice(visible ? 0 : 1) : overhead
    ? [[.18,.23],[.35,.2],[.31,.35],[.7,.3],[.85,.2],[.87,.36],[.52,.51],[.2,.76],[.32,.68],[.75,.76],[.86,.86]]
    : [[.09,.36],[.13,.43],[.25,.4],[.41,.33],[.56,.3],[.6,.38],[.75,.35],[.9,.42],[.33,.65],[.42,.72],[.71,.64],[.77,.72]];
  const points=count===undefined?defaultPoints:[[.59,.47],[.34,.32]].slice(0,count);
  const [width, height] = layout?.size.split(' ').map(parseFloat) ?? [100,100];
  const [left, top] = layout?.position.split(' ').map(parseFloat) ?? [0,0];
  return <span data-bush-berries={sparse ? 'sparse' : 'dense'} aria-hidden="true" style={{ position:'absolute', inset:0, pointerEvents:'none' }}>
    {points.map(([x,y], index) => <span key={index} style={{ position:'absolute', left:layout ? left+width*x : `${x*100}%`, top:layout ? top+height*y : `${y*100}%`, width:layout ? width*(sparse ? .13 : .035) : sparse?'13%':'3.5%', aspectRatio:'1', transform:'translate(-50%, -50%)' }}><ManaberryBlob /><img data-bush-berry="true" alt="" draggable={false}
      src={`${import.meta.env.BASE_URL}assets/runtime/items/manaberry/manaberry-fruit-v1.svg`}
      style={{ position:'relative', width:'100%', height:'auto', filter:'drop-shadow(0 0 1px #9fddff)' }} /></span>)}
  </span>;
}
