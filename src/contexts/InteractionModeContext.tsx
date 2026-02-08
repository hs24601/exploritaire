import { createContext, useContext } from 'react';
import type { InteractionMode } from '../engine/types';

export const InteractionModeContext = createContext<InteractionMode>('click');

export function useInteractionMode(): InteractionMode {
  return useContext(InteractionModeContext);
}
