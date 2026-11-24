import { createContext, useContext, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

/** Ground projections must composite behind complete relief rasters, including
 * pixels depicting geometry on the near side of their billboard foot. */
export const GroundShadowLayer = createContext<HTMLElement | null>(null);

export function GroundShadowPortal({ children }: { children: ReactNode }) {
  const ground = useContext(GroundShadowLayer);
  return ground ? createPortal(children, ground) : <>{children}</>;
}
