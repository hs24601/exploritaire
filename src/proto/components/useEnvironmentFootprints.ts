import { useCallback, useEffect, useLayoutEffect, type RefObject } from 'react';
import { fitSceneryFootprint, fitSceneryVolumeFootprint } from '../sceneryFootprint';

/** One footprint rule for scenery planes and billboards. No layout reads or React
 * updates are needed to keep its ground footprint inside its owner during spin. */
export function useEnvironmentFootprints(root: RefObject<HTMLDivElement | null>,
  onFrame: (listener: (camera: { yaw?: number }) => void) => () => void, active: boolean,
  getCamera: () => { yaw?: number }) {
    const draw = useCallback((camera: { yaw?: number }) => {
      root.current?.querySelectorAll<HTMLElement>('[data-environment-prop]').forEach(el => {
        const d = el.dataset, number = (key: string) => Number(d[key]);
        const width = number('sceneryWidth'), height = number('sceneryHeight');
        const foot = { x: number('sceneryX'), y: number('sceneryY') }, desiredWidth = d.sceneryDesiredWidth ? number('sceneryDesiredWidth') : width,
          desiredHeight = d.sceneryDesiredHeight ? number('sceneryDesiredHeight') : height,
          owner = { x: number('ownerX'), y: number('ownerY'), width: number('ownerWidth'), height: number('ownerHeight') };
        const fit = d.sceneryVolume ? fitSceneryVolumeFootprint(foot, desiredWidth, desiredHeight, owner)
          : fitSceneryFootprint(foot, desiredWidth, desiredHeight, owner, d.sceneryHeading !== undefined ? number('sceneryHeading') * 180 / Math.PI : camera.yaw ?? 0);
        el.style.left = `calc(50% + ${fit.position.x}px)`;
        el.style.top = `calc(50% + ${fit.position.y}px)`;
        el.style.setProperty('--scenery-fit-scale', String(fit.width / Math.max(width, 1e-6)));
      });
    }, [root]);
    // A settled React render can change the billboard's base dimensions.
    // Reapply its live fit before paint, including newly mounted scenery.
    useLayoutEffect(() => { if (active) draw(getCamera()); });
    useEffect(() => active ? onFrame(draw) : undefined, [onFrame, active, draw]);
}
