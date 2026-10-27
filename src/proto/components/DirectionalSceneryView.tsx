import type { ReactNode } from 'react';
import { useDirectionalScenery } from './useDirectionalScenery';

type Camera = { yaw?: number };
type View = { src: string; flip: boolean; direction: number };

/** Follows the live camera for a directional scenery piece, re-rendering only
 * its own subtree when the authored view changes. Selecting the view in the
 * map re-rendered the whole table several times per orbit. `settled` keeps
 * the piece drawn until the live view is ready. */
export function DirectionalSceneryView({ src, settled, getCamera, onCameraFrame, children }: {
  src: string | undefined; settled: View | null;
  getCamera: () => Camera; onCameraFrame: (draw: (camera: Camera) => void) => () => void;
  children: (view: View | null) => ReactNode;
}) {
  const live = useDirectionalScenery(src, true, getCamera, onCameraFrame);
  return <>{children(live ?? settled)}</>;
}
