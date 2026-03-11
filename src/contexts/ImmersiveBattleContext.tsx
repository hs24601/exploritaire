import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

export interface ImmersiveBattleContextValue {
  isImmersive: boolean;
  setIsImmersive: (value: boolean) => void;
  cameraOrbit: number; // 0 to 1
  setCameraOrbit: (value: number) => void;
}

export const ImmersiveBattleContext = createContext<ImmersiveBattleContextValue>({
  isImmersive: false,
  setIsImmersive: () => {},
  cameraOrbit: 0.5,
  setCameraOrbit: () => {},
});

export function ImmersiveBattleProvider({ children }: { children: ReactNode }) {
  const [isImmersive, setIsImmersive] = useState(false);
  const [cameraOrbit, setCameraOrbit] = useState(0.5);

  const value = useMemo(() => ({
    isImmersive,
    setIsImmersive,
    cameraOrbit,
    setCameraOrbit,
  }), [isImmersive, cameraOrbit]);

  return (
    <ImmersiveBattleContext.Provider value={value}>
      {children}
    </ImmersiveBattleContext.Provider>
  );
}

export function useImmersiveBattle() {
  return useContext(ImmersiveBattleContext);
}
