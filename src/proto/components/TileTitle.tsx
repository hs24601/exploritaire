import { useLayoutEffect, useRef } from 'react';
import { fitTileTitle, tileLabelFacing, TILE_TITLE_TRACKING_EM } from '../tileLabels';

/** Surface ink faces the nearest tile edge in whole quarter turns. Between
 * those snaps, its layout is fixed and the tile supplies all perspective. */
export function TileTitle({ biome, text, width, height, align = 'bottom', maxLines, clearCenter, getCamera, onCameraFrame, onTextBox }: {
  biome?: string;
  text: string; width: number; height: number;
  align?: 'center' | 'top' | 'bottom'; maxLines?: number;
  /** Fixed local clearance for an occupied central square. */
  clearCenter?: number;
  getCamera?: () => { yaw?: number };
  onCameraFrame?: (listener: () => void) => () => void;
  onTextBox?: (box: { left: number; top: number; width: number; height: number; pivot: { x: number; y: number }; rotation: number }) => void;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const rasterScale = 8;
  const callback = useRef(onTextBox);
  callback.current = onTextBox;
  useLayoutEffect(() => {
    const frame = ref.current;
    if (!frame) return;
    let disposed = false;
    const canvas = document.createElement('canvas').getContext('2d');
    if (!canvas) return;
    const style = getComputedStyle(frame);
    let previousFacing = -1;
    const fit = (force = false) => {
      if (disposed) return;
      const facing = tileLabelFacing(getCamera?.().yaw ?? 0);
      if (!force && facing === previousFacing) return;
      previousFacing = facing;
      frame.style.rotate = `${-facing}deg`;
      const measure = (value: string, size: number) => {
        canvas.font = `${style.fontWeight} ${size}px ${style.fontFamily}`;
        return canvas.measureText(value).width + value.length * size * TILE_TITLE_TRACKING_EM;
      };
      // Fit against the selected tile edge only. Zoom, tilt and movement
      // inside the same 90-degree sector never change wrapping or font size.
      const layout = fitTileTitle(text.toUpperCase(), Math.max(1, width - 8), Math.max(1, height - 8), facing, measure, 18, 6, align, maxLines);
      if (clearCenter && layout.lines.length) {
        const shift = Math.max(0, clearCenter + 2 - layout.lines[0].y);
        for (const line of layout.lines) line.y += shift;
      }
      frame.dataset.labelOverflow = String(!layout.fits);
      frame.dataset.labelFontSize = String(layout.fontSize);
      frame.dataset.labelYaw = String(facing);
      while (frame.children.length > layout.lines.length) frame.lastElementChild?.remove();
      for (const [index, line] of layout.lines.entries()) {
        const span = frame.children[index] as HTMLElement | undefined ?? document.createElement('span');
        span.className = 'proto-tile-title__line';
        if (span.textContent !== line.text) span.textContent = line.text;
        Object.assign(span.style, { left: `${line.x}px`, top: `${line.y}px`, width: `${measure(line.text, layout.fontSize) * rasterScale}px`, fontSize: `${layout.fontSize * rasterScale}px`, letterSpacing: `${TILE_TITLE_TRACKING_EM}em`, lineHeight: `${layout.lineHeight * rasterScale}px`, transform: `scale(${1 / rasterScale}) translateX(-50%)`, transformOrigin: '0 0' });
        if (!span.parentElement) frame.append(span);
      }
      if (layout.lines.length) {
        const left = Math.min(...layout.lines.map(line => line.x - measure(line.text, layout.fontSize) / 2));
        const right = Math.max(...layout.lines.map(line => line.x + measure(line.text, layout.fontSize) / 2));
        const top = layout.lines[0].y, bottom = layout.lines[layout.lines.length - 1].y + layout.lineHeight;
        callback.current?.({ left: width / 2 + left, top: height / 2 + top, width: right - left, height: bottom - top, pivot: { x: width / 2, y: height / 2 }, rotation: -facing });
      }
    };
    fit();
    const fontsChanged = () => fit(true);
    document.fonts.ready.then(fontsChanged);
    document.fonts.addEventListener('loadingdone', fontsChanged);
    const unsubscribe = onCameraFrame?.(() => fit());
    return () => { disposed = true; unsubscribe?.(); document.fonts.removeEventListener('loadingdone', fontsChanged); };
  }, [text, width, height, align, maxLines, clearCenter, getCamera, onCameraFrame]);
  return <span ref={ref} className="proto-tile-title" data-label-biome={biome ?? "neutral"} data-label-raster={rasterScale} data-label-surface="tile" data-title-align={align} aria-label={text} title={text} />;
}
