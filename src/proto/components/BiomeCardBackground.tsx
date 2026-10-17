import { gameTime } from '../../gameTime';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useArtStyle } from '../artStyle';
import { biomeCardKind, cardBackgroundFallback, cardViewIndex, CARD_VIEW_COUNT, loadBiomeCardBackground, type CardBiome, type TableauCardBackground } from '../biomeCardArt';

const BackgroundContext = createContext<{ kind: string; style: 'paint' | 'pixel' } | undefined>(undefined);

export function BiomeCardBackgroundProvider({ biome, children }: { biome?: CardBiome; children: ReactNode }) {
  const style = useArtStyle(), kind = biomeCardKind(biome);
  useEffect(() => {
    let active = true, timer = 0, view = 0;
    const warm = () => {
      if (!active || view >= CARD_VIEW_COUNT) return;
      void loadBiomeCardBackground(kind, style, view++).then(() => { if (active) timer = gameTime.setTimeout(warm, 40); });
    };
    // Visible card effects request their views first. Warm the bounded pool
    // between interactions so new infinifill cards reuse existing compositions.
    timer = gameTime.setTimeout(warm, 100);
    return () => { active = false; gameTime.clearTimeout(timer); };
  }, [kind, style]);
  return <BackgroundContext.Provider value={{ kind, style }}>{children}</BackgroundContext.Provider>;
}

export function BiomeCardBackground({ background, cardId = '', buried = false }: { background?: TableauCardBackground; cardId?: string; buried?: boolean }) {
  const shared = useContext(BackgroundContext);
  const kind = shared?.kind ?? 'unexplored', style = shared?.style ?? 'paint', view = cardViewIndex(cardId);
  const fallback = cardBackgroundFallback(kind, style, view);
  const [loaded, setLoaded] = useState<TableauCardBackground>();
  useEffect(() => {
    if (background) return;
    let active = true;
    const load = () => { void loadBiomeCardBackground(kind, style, view).then(value => { if (active) setLoaded(value); }); };
    const timer = gameTime.setTimeout(load, buried ? 80 : 0);
    return () => { active = false; gameTime.clearTimeout(timer); };
  }, [kind, style, view, background, buried]);
  const appearance = background ?? (loaded?.key === fallback.key ? loaded : fallback);
  return <span className="proto-card-tableau-background" data-biome-card={appearance.kind} data-card-art-style={appearance.artStyle}
    data-card-view={appearance.view ?? view}
    data-card-art-ready={Boolean(appearance.src)} style={{ backgroundColor: appearance.color }} aria-hidden="true">
    {appearance.src && <img src={appearance.src} alt="" draggable={false} />}
  </span>;
}

/** Snapshot the actual displayed face for portal flights (including fallback).
 * A biome or Paint/Pixel change after pickup cannot recolor a card mid-flight. */
export function snapshotCardBackground(card: HTMLElement): TableauCardBackground | undefined {
  const layer = card.querySelector<HTMLElement>('[data-biome-card]');
  if (!layer) return undefined;
  const kind = layer.dataset.biomeCard!, artStyle = layer.dataset.cardArtStyle === 'pixel' ? 'pixel' : 'paint';
  const view = Number(layer.dataset.cardView ?? 0);
  return { key: `${kind}:${artStyle}:${view}`, kind, artStyle, view, color: layer.style.backgroundColor, src: layer.querySelector('img')?.src };
}
