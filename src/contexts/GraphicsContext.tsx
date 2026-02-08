import { createContext, useContext } from 'react';

export const GraphicsContext = createContext(false);

export function useGraphics(): boolean {
  return useContext(GraphicsContext);
}
