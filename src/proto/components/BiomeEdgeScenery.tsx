import { berryScenerySprite } from '../berryPresentation';
import { BushBerries } from './BushBerries';
import { sceneryHeightScale, sceneryWidthScale } from '../sceneryHeight';
import { populationOwner, sceneryReliefRise } from '../sceneryPopulation';
import { spriteLayout, useSpriteBounds } from './spriteBounds';
import type { StandeeLighting } from '../protoLighting';
import { Fragment, type CSSProperties } from 'react';
import type { EdgeProp } from '../biomeEdgeScenery';
import { standeeLighting, type TableLight } from '../protoLighting';
import type { FxQuality } from '../atmosphere';
import { LightWash, Oversample, SpriteStandeeShadows } from './SpriteStandee';
import { Reveal } from './Reveal';
import { SilhouetteRelief } from './SilhouetteRelief';
import { walkableSceneryOwner, fitSceneryFootprint, fitSceneryVolumeFootprint } from '../sceneryFootprint';
import { propVolumeRecipe } from '../propVolume';
import { PropVolumeArt, PropVolumeShadows, type PropVolumeCamera } from './PropVolume';
import { isPaintedScenerySprite } from '../sceneryArt';
import { TileDiscoveryArt } from './TileDiscoveryArt';
import { ManaberryGlow } from './ManaberryGlow';

/** Tilted camera only: the scenery lining a biome tile's edges, laid out
 * with its neighbours' (layoutTableScenery in biomeEdgeScenery.ts), each prop
 * standing upright on the table like the tile's pop-up and never covering a
 * label. Each prop is lit where it stands: shaded by the light reaching it,
 * washed in the colour of the nearest lamp on the side facing it and, on the
 * high tier, casting its own shadows away from the sun or moon and each lamp.
 * Pixel props reveal color with exploration. Discovered painted trees keep
 * their original color and alpha throughout the orbit. */
export function BiomeEdgeScenery({ tileId, discoveryTileIds, centre, footprint, props, exploration = 1, yaw = 0, billboardYaw = 0, hours, lights, quality, standee, volumeStandee, volumeCamera, oversample = 1, danger = false, berryGlow = false, berriesAvailable = true }: {
  berryGlow?: boolean;
  berriesAvailable?: boolean;
  tileId: string;
  discoveryTileIds?: readonly string[];
  danger?: boolean;
  /** The tile's centre in table px. */
  centre: { x: number; y: number };
  footprint?: { x: number; y: number; width: number; height: number };
  /** The tile's props, from its centre. */
  props: readonly EdgeProp[];
  /** How explored the tile is, 0-1. */
  exploration?: number;
  /** Authored facing frame for placement and lighting. */
  yaw?: number;
  /** Camera heading for painted cutouts; volume geometry stays world-fixed. */
  billboardYaw?: number;
  hours: number;
  lights: readonly TableLight[];
  quality: FxQuality;
  /** The table's upright-standee transform and pop-up motion. */
  standee: CSSProperties | null;
  volumeStandee?: CSSProperties | null;
  volumeCamera?: PropVolumeCamera;
  /** Layout scale the standee transform shrinks back down (STANDEE_OVERSAMPLE). */
  oversample?: number;
}) {
  return <>{props.map((prop) => {
    prop = { ...prop, src: berryScenerySprite(prop.src, false) };
    const authored = { x: centre.x + prop.x, y: centre.y + prop.y };
    const desired = { width: prop.width, height: prop.height };
    const population = prop.id.startsWith('population-');
    const propOwner = footprint ? populationOwner(authored, footprint, population) ?? walkableSceneryOwner(authored, footprint) : undefined;
    const volume = Boolean(volumeCamera && propVolumeRecipe(prop.src));
    const painted = isPaintedScenerySprite(prop.src);
    const rasterBoost = painted ? 4 : 1;
    const naturalTree = population && sceneryReliefRise(prop.src) > 1;
    const facingYaw = painted ? billboardYaw : yaw;
    const sampling=painted||propVolumeRecipe(prop.src)?.surface==='paint'?'auto' as const:undefined;
    const fitted = propOwner ? volume||painted ? fitSceneryVolumeFootprint(authored, prop.width, prop.height, propOwner) : fitSceneryFootprint(authored, prop.width, prop.height, propOwner, yaw) : { position: authored, width: prop.width, height: prop.height };
    prop = { ...prop, width: fitted.width, height: fitted.height };
    const foot = fitted.position;
    const lit = standeeLighting(hours, foot, prop.height, lights, facingYaw);
    const raisedShadows = lit.shadows.map(shadow => ({...shadow, length: shadow.length}));
    const filter = `brightness(${lit.brightness.toFixed(3)}) sepia(${(lit.warmth * 0.45).toFixed(3)})`;
    return <Fragment key={prop.id}>
      {quality === 'high' ? volume ? <PropVolumeShadows sprite={prop.src} position={foot} shadows={raisedShadows} size={Math.max(prop.width,prop.height)} owner="biome-edge" flip={prop.flip} /> : <SpriteStandeeShadows sprite={prop.src} position={foot} shadows={raisedShadows} size={prop.height} width={painted ? prop.width : undefined} height={painted ? prop.height : undefined} owner="biome-edge" yaw={facingYaw} natural={naturalTree} /> : null}
      <div
        aria-hidden="true"
        className="proto-biome-edge"
        data-board-piece="biome-edge"
        data-environment-prop={footprint ? 'true' : undefined}
        data-scenery-heading={painted ? undefined : '0'}
        data-scenery-billboard={painted ? 'paint' : undefined}
        data-scenery-volume={volume ? 'true' : undefined}
        data-scenery-x={authored.x} data-scenery-y={authored.y}
        data-scenery-desired-width={desired.width} data-scenery-desired-height={desired.height}
        data-scenery-width={prop.width} data-scenery-height={prop.height}
        data-owner-x={propOwner?.x} data-owner-y={propOwner?.y}
        data-owner-width={propOwner?.width} data-owner-height={propOwner?.height}
        data-biome-edge={tileId}
        data-edge={prop.edge}
        style={{ left: `calc(50% + ${foot.x}px)`, top: `calc(50% + ${foot.y}px)`, width: prop.width * oversample * rasterBoost, height: prop.height * oversample * rasterBoost, ...(volume||painted ? volumeStandee : standee), transform: `${(volume||painted ? volumeStandee : standee)?.transform ?? ''} scale(${1/rasterBoost})` }}
      >
        <span style={{position:"absolute",inset:0,filter:danger ? "url(#combat-scenery-tint)" : undefined}}><Oversample width={prop.width} height={prop.height} factor={oversample*rasterBoost}>
          <TileDiscoveryArt relief tileId={discoveryTileIds ?? tileId}>
          {volume ? <PropVolumeArt sprite={prop.src} width={prop.width} height={prop.height} lighting={lit} hours={hours} position={foot} camera={volumeCamera!} flip={prop.flip}
            fallback={<span className="proto-biome-edge__art" style={{backgroundImage:`url("${prop.src}")`,filter,imageRendering:sampling}}/>}/> : painted ? <PaintedEdgeArt sprite={prop.src} width={prop.width} height={prop.height} filter={filter} flip={prop.flip} lighting={lit} natural={naturalTree} berryGlow={berryGlow} berriesAvailable={berriesAvailable} /> : <Reveal fraction={exploration} width={prop.width} height={prop.height} shade={<SilhouetteRelief
            sprite={prop.src} width={prop.width} height={prop.height} lighting={lit} hours={hours} position={foot} yaw={yaw} flip={prop.flip} trim={false}
            fallback={<span className="proto-biome-edge__art" style={{ backgroundImage: `url("${prop.src}")`, transform: prop.flip ? 'scaleX(-1)' : undefined }} />} />}>
            <span className="proto-biome-edge__art" style={{ backgroundImage: `url("${prop.src}")`, filter, transform: prop.flip ? 'scaleX(-1)' : undefined }}>
              <LightWash sprite={prop.src} lighting={lit} maskSize="100% 100%" maskPosition="0 0" flip={prop.flip} />
            </span>
          </Reveal>}
          {!painted && <BushBerries sprite={prop.src} visible={berriesAvailable} />}
          </TileDiscoveryArt>
        </Oversample></span>
      </div>
    </Fragment>;
  })}</>;
}

function PaintedEdgeArt({ sprite, width, height, filter, flip, lighting, natural = false, berryGlow = false, berriesAvailable = true }: { berriesAvailable?: boolean; berryGlow?: boolean; natural?: boolean; sprite: string; width: number; height: number; filter: string; flip: boolean; lighting: StandeeLighting }) {
  const state = useSpriteBounds(sprite);
  const layout = state?.status === 'ready' ? spriteLayout(state.bounds, width, height, 1, natural ? 1 : sceneryHeightScale(sprite, width, height, state.bounds.aspect), natural ? 1 : sceneryWidthScale(sprite, width, height, state.bounds.aspect)) : null;
  const glowing = berryGlow && /manaberry-sparse-standee/.test(sprite);
  return <><span className="proto-biome-edge__art" style={{ backgroundImage: `url("${sprite}")`, backgroundSize: layout?.size ?? 'contain', backgroundPosition: layout?.position ?? 'center bottom', filter, imageRendering: 'auto', transform: flip ? 'scaleX(-1)' : undefined }}>
    <LightWash sprite={sprite} lighting={lighting} maskSize={layout?.size ?? 'contain'} maskPosition={layout?.position ?? 'center bottom'} flip={flip} />
  </span>{layout && <span style={{position:"absolute",inset:0,transform:flip ? "scaleX(-1)" : undefined}}><BushBerries sprite={sprite} visible={berriesAvailable} layout={layout} /></span>} {glowing && layout && <ManaberryGlow layout={layout} />}</>;
}
