import { createContext, useContext } from 'react';

export const WatercolorContext = createContext(false);

export function useWatercolorEnabled(): boolean {
  return useContext(WatercolorContext);
}
