import { createContext, useContext, type Dispatch, type SetStateAction } from 'react';

export interface PerspectiveContextValue {
  perspectiveEnabled: boolean;
  setPerspectiveEnabled: Dispatch<SetStateAction<boolean>>;
}

export const PerspectiveContext = createContext<PerspectiveContextValue>({
  perspectiveEnabled: false,
  setPerspectiveEnabled: () => {},
});

export function usePerspective(): PerspectiveContextValue {
  return useContext(PerspectiveContext);
}
