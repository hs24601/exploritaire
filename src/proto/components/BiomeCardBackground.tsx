import { createContext, useContext, type ReactNode } from 'react';
import { useArtStyle } from '../artStyle';
import { biomeCardKind, cardViewIndex, type CardBiome, type TableauCardBackground } from '../biomeCardArt';

const BackgroundContext = createContext<{ kind: string; style: 'paint' | 'pixel' } | undefined>(undefined);
const CARD_WASH = 'rgba(16, 25, 35, 0.14)';

export function BiomeCardBackgroundProvider({ biome, children }: { biome?: CardBiome; children: ReactNode }) {
  const style = useArtStyle(), kind = biomeCardKind(biome);
  return <BackgroundContext.Provider value={{ kind, style }}>{children}</BackgroundContext.Provider>;
}

/** A light wash lets the actual tableau scenery show through the card.
 * Keep biome metadata for flights without generating per-card illustrations. */
export function BiomeCardBackground({ background, cardId = '' }: { background?: TableauCardBackground; cardId?: string; buried?: boolean }) {
  const shared = useContext(BackgroundContext);
  return <span className="proto-card-tableau-background" data-biome-card={background?.kind ?? shared?.kind ?? 'unexplored'}
    data-card-art-style={background?.artStyle ?? shared?.style ?? 'paint'}
    data-card-view={background?.view ?? cardViewIndex(cardId)}
    style={{ backgroundColor: CARD_WASH }} aria-hidden="true" />;
}

/** Snapshot the displayed wash and biome identity for portal flights. */
export function snapshotCardBackground(card: HTMLElement): TableauCardBackground | undefined {
  const layer = card.querySelector<HTMLElement>('[data-biome-card]');
  if (!layer) return undefined;
  const kind = layer.dataset.biomeCard!, artStyle = layer.dataset.cardArtStyle === 'pixel' ? 'pixel' : 'paint';
  const view = Number(layer.dataset.cardView ?? 0);
  return { key: `${kind}:${artStyle}:${view}`, kind, artStyle, view, color: layer.style.backgroundColor };
}
