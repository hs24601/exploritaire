import { Reveal } from './Reveal';

/** Printed overhead sprites belong to the tabletop only. Exploration uses
 * the same reveal as immersive scenery, without light, relief or cast shadows. */
export function BiomeTopDownArt({ terrain = 'woods', danger = false, exploration, width, height }: {
  terrain?: 'woods' | 'water'; danger?: boolean; exploration: number; width: number; height: number;
}) {
  const theme = danger ? 'dark-woods' : terrain === 'water' ? 'pond' : 'woods';
  return <span aria-hidden="true" className="proto-biome-topdown" data-biome-topdown={theme}>
    <Reveal fraction={exploration} width={width} height={height}
      shade={<img className="proto-biome-topdown__art proto-biome-topdown__art--unexplored" src={`/assets/biomes/${theme}_topdown.svg`} alt="" draggable={false} />}>
      <img className="proto-biome-topdown__art" src={`/assets/biomes/${theme}_topdown.svg`} alt="" draggable={false} />
    </Reveal>
    {danger ? <span className="proto-biome-topdown__danger" title="Danger">!</span> : null}
  </span>;
}
