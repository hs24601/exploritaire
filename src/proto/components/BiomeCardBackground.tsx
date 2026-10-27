import { createContext, useContext, useEffect, useRef, type ReactNode } from 'react';
import { registerSceneryWindow } from '../sceneryCardWindows';
import { useArtStyle } from '../artStyle';
import { biomeCardKind, cardViewIndex, type CardBiome, type TableauCardBackground } from '../biomeCardArt';

const BackgroundContext = createContext<{ kind: string; style: 'paint' | 'pixel' } | undefined>(undefined);
const CARD_WASH = '#23302d';

export function BiomeCardBackgroundProvider({ biome, children }: { biome?: CardBiome; children: ReactNode }) {
  const style = useArtStyle(), kind = biomeCardKind(biome);
  return <BackgroundContext.Provider value={{ kind, style }}>{children}</BackgroundContext.Provider>;
}

/** Opaque scenery windows exclude other cards; a light pigment wash softens detail. */
export function BiomeCardBackground({ background, cardId = '' }: { background?: TableauCardBackground; cardId?: string; buried?: boolean }) {
  const shared = useContext(BackgroundContext);
  const layer = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (background?.src || !layer.current) return;
    return registerSceneryWindow(layer.current.querySelector('canvas')!, Array.from(layer.current.querySelectorAll<HTMLElement>('[data-window-probe]')));
  }, [background?.src, cardId]);
  return <span ref={layer} className="proto-card-tableau-background" data-biome-card={background?.kind ?? shared?.kind ?? 'unexplored'}
    data-card-art-style={background?.artStyle ?? shared?.style ?? 'paint'}
    data-card-view={background?.view ?? cardViewIndex(cardId)}
    style={{ backgroundColor: CARD_WASH, backgroundImage:background?.src ? `url(${background.src})` : undefined, backgroundSize:'100% 100%' }} aria-hidden="true">
    {!background?.src && <><canvas className="proto-card-scenery-window" />
      <i data-window-probe="origin" style={{left:0,top:0}}/><i data-window-probe="x" style={{left:'100%',top:0}}/><i data-window-probe="y" style={{left:0,top:'100%'}}/>
    </>}
    <span className="proto-card-watercolor-wash" />
  </span>;
}

/** Snapshot the displayed wash and biome identity for portal flights. */
export function snapshotCardBackground(card: HTMLElement): TableauCardBackground | undefined {
  const layer = card.querySelector<HTMLElement>('[data-biome-card]');
  if (!layer) return undefined;
  const kind = layer.dataset.biomeCard!, artStyle = layer.dataset.cardArtStyle === 'pixel' ? 'pixel' : 'paint';
  const view = Number(layer.dataset.cardView ?? 0);
  const canvas=layer.querySelector('canvas');
  let src: string | undefined;
  try { src=canvas?.toDataURL(); } catch { /* Retain opaque fallback for uncapturable assets. */ }
  return { key: `${kind}:${artStyle}:${view}`, kind, artStyle, view, color: layer.style.backgroundColor, src };
}
