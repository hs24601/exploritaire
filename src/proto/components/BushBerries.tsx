import { ManaberryBlob } from './ManaberryBlob';
/** Independent fruit elements registered to the foliage canvas. */
export function BushBerries({ sprite, visible, overhead = false, layout }: { sprite: string; visible: boolean; overhead?: boolean; layout?: { size: string; position: string } }) {
  if (!visible || !/berry|bush/.test(sprite)) return null;
  const sparse = sprite.includes('sparse');
  const points = sparse ? [[.59, overhead ? .49 : .47]] : overhead
    ? [[.18,.23],[.35,.2],[.31,.35],[.7,.3],[.85,.2],[.87,.36],[.52,.51],[.2,.76],[.32,.68],[.75,.76],[.86,.86]]
    : [[.09,.36],[.13,.43],[.25,.4],[.41,.33],[.56,.3],[.6,.38],[.75,.35],[.9,.42],[.33,.65],[.42,.72],[.71,.64],[.77,.72]];
  const [width, height] = layout?.size.split(' ').map(parseFloat) ?? [100,100];
  const [left, top] = layout?.position.split(' ').map(parseFloat) ?? [0,0];
  return <span data-bush-berries={sparse ? 'sparse' : 'dense'} aria-hidden="true" style={{ position:'absolute', inset:0, pointerEvents:'none' }}>
    {points.map(([x,y], index) => <span key={index} style={{ position:'absolute', left:layout ? left+width*x : `${x*100}%`, top:layout ? top+height*y : `${y*100}%`, width:layout ? width*(sparse ? .13 : .035) : sparse?'13%':'3.5%', aspectRatio:'1', transform:'translate(-50%, -50%)' }}><ManaberryBlob /><img data-bush-berry="true" alt="" draggable={false}
      src={`${import.meta.env.BASE_URL}assets/runtime/items/manaberry/manaberry-fruit-v1.svg`}
      style={{ position:'relative', width:'100%', height:'auto', filter:'drop-shadow(0 0 1px #9fddff)' }} /></span>)}
  </span>;
}
