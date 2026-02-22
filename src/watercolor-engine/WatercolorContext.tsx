/**
 * WatercolorEngineContext - React context for watercolor engine API
 *
 * Provides access to the watercolor engine throughout the component tree,
 * enabling any component to trigger splashes and paint marks.
 */

import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import type { WatercolorEngineAPI, SplashConfig } from './types';

// Global paint-mark subscriber set – lets any component react when a mark is baked
type PaintMarkListener = (count: number) => void;
const paintMarkListeners = new Set<PaintMarkListener>();

/** Called by WatercolorCanvas every time a mark is baked to the persistent layer */
export function notifyPaintMarkAdded(count: number) {
  paintMarkListeners.forEach((fn) => fn(count));
}

/**
 * Returns a reactive paint-mark count that updates whenever a new mark lands.
 * Components can use this as a dependency to re-run effects tied to the paint state.
 */
export function usePaintMarkCount(): number {
  const [count, setCount] = useState(0);
  useEffect(() => {
    const listener: PaintMarkListener = (c) => setCount(c);
    paintMarkListeners.add(listener);
    return () => { paintMarkListeners.delete(listener); };
  }, []);
  return count;
}

interface GodRayState {
  lightPos: [number, number];
  exposure: number;
  decay: number;
  weight: number;
  density: number;
  rayColor: [number, number, number];
  noiseAmount: number;
}

const DEFAULT_GOD_RAY_STATE: GodRayState = {
  lightPos: [0.5, 0.15],
  exposure: 0.10,
  decay: 0.97,
  weight: 0.04,
  density: 0.95,
  rayColor: [0.78, 0.95, 0.55],
  noiseAmount: 0.03,
};

interface WatercolorEngineContextValue {
  /** Engine API (null if not ready) */
  api: WatercolorEngineAPI | null;
  /** Whether the engine is initialized */
  ready: boolean;
  /** Register the engine API (called by WatercolorCanvas) */
  setApi: (api: WatercolorEngineAPI) => void;
  /** God ray state controlled by the editor */
  godRayState: GodRayState;
  /** Setter for god ray state */
  setGodRayState: (next: GodRayState) => void;
}

const WatercolorEngineContext = createContext<WatercolorEngineContextValue | null>(null);
let globalWatercolorApi: WatercolorEngineAPI | null = null;

export function WatercolorProvider({ children }: { children: ReactNode }) {
  const [api, setApiState] = useState<WatercolorEngineAPI | null>(null);
  const [ready, setReady] = useState(false);
  const [godRayState, setGodRayState] = useState<GodRayState>(DEFAULT_GOD_RAY_STATE);

  const setApi = useCallback((newApi: WatercolorEngineAPI) => {
    setApiState(newApi);
    setReady(true);
    globalWatercolorApi = newApi;
  }, []);

  const updateGodRayState = useCallback((next: GodRayState) => setGodRayState(next), []);

  const value: WatercolorEngineContextValue = {
    api,
    ready,
    setApi,
    godRayState,
    setGodRayState: updateGodRayState,
  };

  return (
    <WatercolorEngineContext.Provider value={value}>
      {children}
    </WatercolorEngineContext.Provider>
  );
}

/**
 * Hook to read the active god ray state.
 */
export function useGodRayState(): GodRayState {
  const context = useContext(WatercolorEngineContext);
  return context?.godRayState ?? DEFAULT_GOD_RAY_STATE;
}

/**
 * Hook to update the active god ray state.
 */
export function useSetGodRayState() {
  const context = useContext(WatercolorEngineContext);
  return context?.setGodRayState ?? (() => {});
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
