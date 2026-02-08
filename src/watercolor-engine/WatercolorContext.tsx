/**
 * WatercolorEngineContext - React context for watercolor engine API
 *
 * Provides access to the watercolor engine throughout the component tree,
 * enabling any component to trigger splashes and paint marks.
 */

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import type { WatercolorEngineAPI, SplashConfig } from './types';

interface WatercolorEngineContextValue {
  /** Engine API (null if not ready) */
  api: WatercolorEngineAPI | null;
  /** Whether the engine is initialized */
  ready: boolean;
  /** Register the engine API (called by WatercolorCanvas) */
  setApi: (api: WatercolorEngineAPI) => void;
}

const WatercolorEngineContext = createContext<WatercolorEngineContextValue | null>(null);
let globalWatercolorApi: WatercolorEngineAPI | null = null;

export function WatercolorProvider({ children }: { children: ReactNode }) {
  const [api, setApiState] = useState<WatercolorEngineAPI | null>(null);
  const [ready, setReady] = useState(false);

  const setApi = useCallback((newApi: WatercolorEngineAPI) => {
    setApiState(newApi);
    setReady(true);
    globalWatercolorApi = newApi;
  }, []);

  const value: WatercolorEngineContextValue = {
    api,
    ready,
    setApi,
  };

  return (
    <WatercolorEngineContext.Provider value={value}>
      {children}
    </WatercolorEngineContext.Provider>
  );
}

/**
 * Hook to register the watercolor engine (called by WatercolorCanvas)
 */
export function useRegisterWatercolorEngine() {
  const context = useContext(WatercolorEngineContext);
  return context?.setApi ?? (() => {});
}

/**
 * Hook to access the watercolor engine API
 */
export function useWatercolorEngine(): WatercolorEngineAPI | null {
  const context = useContext(WatercolorEngineContext);
  if (!context) {
    console.warn('useWatercolorEngine must be used within a WatercolorProvider');
    return globalWatercolorApi;
  }
  return context.api ?? globalWatercolorApi;
}

/**
 * Hook to trigger a watercolor splash
 */
export function useWatercolorSplash() {
  const api = useWatercolorEngine();

  return useCallback((config: SplashConfig) => {
    if (api) {
      api.splash(config);
    }
  }, [api]);
}

/**
 * Hook to check if watercolor engine is ready
 */
export function useWatercolorReady(): boolean {
  const context = useContext(WatercolorEngineContext);
  return context?.ready ?? false;
}

export { WatercolorEngineContext };
