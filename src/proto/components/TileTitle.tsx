import { useLayoutEffect, useRef } from 'react';
import { fitTileTitle } from '../tileLabels';

/** Full titles flow through the actual rotated tile footprint. The upright ink
 * can use several staggered lines across an immutable region, without a box. */
export function TileTitle({ text, width, height, yaw, scale, align = 'center', maxLines, getCamera, onCameraFrame, onTextBox }: {
  text: string; width: number; height: number; yaw: number; scale: number;
  align?: 'center' | 'top' | 'bottom'; maxLines?: number;
  getCamera?: () => { yaw?: number; scale: number };
  onCameraFrame?: (listener: (camera: { yaw?: number; scale: number }) => void) => () => void;
  onTextBox?: (box: { left: number; top: number; width: number; height: number; pivot: { x: number; y: number } }) => void;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const callback = useRef(onTextBox);
  callback.current = onTextBox;
  useLayoutEffect(() => {
    const frame = ref.current;
    if (!frame) return;
    let disposed = false;
    const cache = new Map<string, number>();
    const canvas = document.createElement('canvas').getContext('2d');
    if (!canvas) return;
    const style = getComputedStyle(frame);
    const font = `${style.fontWeight}`;
    const family = style.fontFamily;
    let reportTimer = 0;
    let previousYaw = NaN, previousScale = NaN;
    const fit = (live = getCamera?.() ?? { yaw, scale }, force = false) => {
      if (disposed) return;
      const liveYaw = live.yaw ?? 0;
      if (!force && Math.abs(liveYaw - previousYaw) < 0.05 && Math.abs(live.scale - previousScale) < 0.001) return;
      previousYaw = liveYaw; previousScale = live.scale;
      const measure = (value: string, size: number) => {
        const key = `${size}:${value}`;
        const known = cache.get(key);
        if (known !== undefined) return known;
        canvas.font = `${font} ${size}px ${family}`;
        const measured = canvas.measureText(value).width;
        cache.set(key, measured);
        return measured;
      };
      // Local units are transformed by table zoom. Prefer 16 screen px and
      // retain a bounded compact fit when the footprint cannot hold that size.
      const maximum = Math.max(18, 16 / Math.max(live.scale, 0.1));
      const layout = fitTileTitle(text.toUpperCase(), Math.max(1, width - 8), Math.max(1, height - 8), liveYaw, measure, maximum, 6, align, maxLines);
      frame.dataset.labelOverflow = String(!layout.fits);
      frame.dataset.labelFontSize = String(layout.fontSize);
      frame.dataset.labelYaw = String(liveYaw);
      while (frame.children.length > layout.lines.length) frame.lastElementChild?.remove();
      for (const [index, line] of layout.lines.entries()) {
        const span = frame.children[index] as HTMLElement | undefined ?? document.createElement('span');
        span.className = 'proto-tile-title__line';
        if (span.textContent !== line.text) span.textContent = line.text;
        Object.assign(span.style, { left: `${line.x}px`, top: `${line.y}px`, width: `${line.width}px`, fontSize: `${layout.fontSize}px`, lineHeight: `${layout.lineHeight}px` });
        if (!span.parentElement) frame.append(span);
      }
      if (layout.lines.length) {
        const left = Math.min(...layout.lines.map(line => line.x - measure(line.text, layout.fontSize) / 2));
        const right = Math.max(...layout.lines.map(line => line.x + measure(line.text, layout.fontSize) / 2));
        const top = layout.lines[0].y, bottom = layout.lines[layout.lines.length - 1].y + layout.lineHeight;
        window.clearTimeout(reportTimer);
        // Ink follows every live frame; layout/scenery state catches up once
        // the gesture settles instead of rerendering the whole map per frame.
        reportTimer = window.setTimeout(() => callback.current?.({ left: width / 2 + left, top: height / 2 + top, width: right - left, height: bottom - top, pivot: { x: width / 2, y: height / 2 } }), 100);
      }
    };
    fit();
    const fontsChanged = () => { cache.clear(); fit(undefined, true); };
    document.fonts.ready.then(fontsChanged);
    document.fonts.addEventListener('loadingdone', fontsChanged);
    const unsubscribe = onCameraFrame?.(live => fit(live));
    return () => { disposed = true; window.clearTimeout(reportTimer); unsubscribe?.(); document.fonts.removeEventListener('loadingdone', fontsChanged); };
  }, [text, width, height, align, maxLines, getCamera, onCameraFrame, getCamera ? 0 : yaw, getCamera ? 0 : scale]);
  return <span ref={ref} className="proto-tile-title proto-face-camera" data-title-align={align} aria-label={text} title={text} />;
}
