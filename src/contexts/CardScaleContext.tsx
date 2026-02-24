import { createContext, useContext } from 'react';

export type CardScalePreset = 'table' | 'hand' | 'drag' | 'jumbo';

export interface CardScaleProfile {
  zoom: number;
  table: number;
  hand: number;
  drag: number;
  jumbo: number;
}

const DEFAULT_CARD_SCALE_PROFILE: CardScaleProfile = {
  zoom: 1,
  table: 1,
  hand: 1,
  drag: 1,
  jumbo: 1,
};

const CardScaleContext = createContext<CardScaleProfile>(DEFAULT_CARD_SCALE_PROFILE);

function normalizeCardScaleProfile(value: number | Partial<CardScaleProfile>): CardScaleProfile {
  if (typeof value === 'number') {
    return {
      ...DEFAULT_CARD_SCALE_PROFILE,
      zoom: Number.isFinite(value) ? value : 1,
    };
  }
  return {
    zoom: Number.isFinite(value.zoom ?? NaN) ? Number(value.zoom) : 1,
    table: Number.isFinite(value.table ?? NaN) ? Number(value.table) : 1,
    hand: Number.isFinite(value.hand ?? NaN) ? Number(value.hand) : 1,
    drag: Number.isFinite(value.drag ?? NaN) ? Number(value.drag) : 1,
    jumbo: Number.isFinite(value.jumbo ?? NaN) ? Number(value.jumbo) : 1,
  };
}

export function CardScaleProvider({
  value,
  children,
}: {
  value: number | Partial<CardScaleProfile>;
  children: React.ReactNode;
}) {
  const normalized = normalizeCardScaleProfile(value);
  return (
    <CardScaleContext.Provider value={normalized}>
      {children}
    </CardScaleContext.Provider>
  );
}

export function useCardScale(): number {
  const profile = useContext(CardScaleContext);
  return profile.zoom * profile.table;
}

export function useCardScalePreset(preset: CardScalePreset): number {
  const profile = useContext(CardScaleContext);
  return profile.zoom * profile[preset];
}

export function useCardScaleProfile(): CardScaleProfile {
  return useContext(CardScaleContext);
}
