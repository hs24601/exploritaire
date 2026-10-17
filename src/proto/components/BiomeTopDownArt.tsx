import { Reveal } from './Reveal';
import { useArtStyle } from '../artStyle';
import { woodsOverheadSprite } from '../sceneryArt';

/** Printed overhead sprites belong to the tabletop only. Discovered painted
 * woods retain their color; Pixel and pond prints keep exploration's reveal. */
export function BiomeTopDownArt({ terrain = 'woods', danger = false, exploration, width, height, tileId }: {
  terrain?: 'woods' | 'water'; danger?: boolean; exploration: number; width: number; height: number; tileId?: string;
}) {
  const theme = danger ? 'dark-woods' : terrain === 'water' ? 'pond' : 'woods';
  const style=useArtStyle(),paint=style==='paint'&&terrain==='woods';
  const src=tileId==='curious-sapling'?`${import.meta.env.BASE_URL}assets/biomes/watercolor-v1/curious-sapling-overhead-v1.png`:terrain==='woods'?woodsOverheadSprite(style,danger):`/assets/biomes/${theme}_topdown.svg`;
  const artStyle={imageRendering:paint?'auto' as const:'pixelated' as const,objectFit:paint?'contain' as const:'fill' as const,
    filter:paint&&danger?'brightness(.65) saturate(.8)':undefined};
  return <span aria-hidden="true" className="proto-biome-topdown" data-biome-topdown={theme} data-scenery-art-style={paint?'paint':'pixel'}>
    <Reveal fraction={paint?1:exploration} width={width} height={height}
      shade={<img className="proto-biome-topdown__art proto-biome-topdown__art--unexplored" style={{...artStyle,filter:undefined}} src={src} alt="" draggable={false} />}>
      <img className="proto-biome-topdown__art" style={artStyle} src={src} alt="" draggable={false} />
    </Reveal>
    {danger ? <span className="proto-biome-topdown__danger" title="Danger">!</span> : null}
  </span>;
}
