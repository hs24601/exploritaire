import { useCallback, useEffect, useLayoutEffect, useRef, type RefObject } from 'react';
import { fitSceneryFootprint, fitSceneryVolumeFootprint } from '../sceneryFootprint';
import type { CameraState } from '../../hooks/useCameraControls';
import { tableBillboardVisible, type TableTilt } from '../tableTilt';

/** One footprint rule for scenery planes and billboards. No layout reads or React
 * updates are needed to keep its ground footprint inside its owner during spin. */
export function useEnvironmentFootprints(root: RefObject<HTMLDivElement | null>,
  onFrame: (listener: (camera: CameraState) => void) => () => void, active: boolean,
  getCamera: () => CameraState, getTilt: (camera: CameraState) => TableTilt) {
    const lastYaw=useRef<number|null>(null);
    const draw = useCallback((camera: CameraState,force=false) => {
      const tilt = getTilt(camera);
      root.current?.querySelectorAll<HTMLElement>('[data-environment-prop], [data-board-piece="actor"], .travel-world-station').forEach(el => {
        const coordinate = (value: string) => { const match = value.match(/50%\s*([+-])\s*([-\d.]+)px/); return match ? Number(match[2]) * (match[1] === '-' ? -1 : 1) : Number.parseFloat(value)||0; };
        const point = { x: coordinate(el.style.left), y: coordinate(el.style.top) };
        const visible = tableBillboardVisible(point, camera, tilt);
        if (visible === !el.hasAttribute('data-camera-clipped')) return;
        el.toggleAttribute('data-camera-clipped', !visible);
      });
      const yaw=camera.yaw??0;if(!force&&yaw===lastYaw.current)return;lastYaw.current=yaw;
      root.current?.querySelectorAll<HTMLElement>('[data-environment-prop]').forEach(el => {
        const d = el.dataset, number = (key: string) => Number(d[key]);
        const width = number('sceneryWidth'), height = number('sceneryHeight');
        const foot = { x: number('sceneryX'), y: number('sceneryY') }, desiredWidth = d.sceneryDesiredWidth ? number('sceneryDesiredWidth') : width,
          desiredHeight = d.sceneryDesiredHeight ? number('sceneryDesiredHeight') : height,
          owner = { x: number('ownerX'), y: number('ownerY'), width: number('ownerWidth'), height: number('ownerHeight') };
        // Painted billboards reserve every orbit's foot line up front, so a
        // camera turn cannot slide their trunks around within the tile.
        const fit = d.sceneryVolume || d.sceneryBillboard ? fitSceneryVolumeFootprint(foot, desiredWidth, desiredHeight, owner)
          : fitSceneryFootprint(foot, desiredWidth, desiredHeight, owner, d.sceneryHeading !== undefined ? number('sceneryHeading') * 180 / Math.PI : camera.yaw ?? 0);
        el.style.left = `calc(50% + ${fit.position.x}px)`;
        el.style.top = `calc(50% + ${fit.position.y}px)`;
        el.style.setProperty('--scenery-fit-scale', String(fit.width / Math.max(width, 1e-6)));
      });
    }, [root, getTilt]);
    // A settled React render can change the billboard's base dimensions.
    // Reapply its live fit before paint, including newly mounted scenery.
    useLayoutEffect(() => { if (active) draw(getCamera(),true); });
    useEffect(() => active ? onFrame(draw) : undefined, [onFrame, active, draw]);
    useLayoutEffect(() => { if (!active) root.current?.querySelectorAll('[data-camera-clipped]').forEach(el => el.removeAttribute('data-camera-clipped')); }, [root, active]);
}
