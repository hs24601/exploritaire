import { markerFraction, type ActorMarkerRow } from './actorMarkers';

export const MARKER_CANVAS_WIDTH = 256;
export const MARKER_ROW_HEIGHT = 64;
/** Shared rounded frame treatment for health, future resource meters, and label rows. */
export function paintMarkerRows(context: CanvasRenderingContext2D, rows: readonly ActorMarkerRow[]) {
  const width = MARKER_CANVAS_WIDTH;
  const rounded = (x: number, y: number, w: number, h: number, radius: number) => {
    context.beginPath(); context.roundRect(x, y, w, h, radius);
  };
  const fitText = (value: string) => {
    let text = value;
    while (text.length && context.measureText(text).width > width - 28) text = text.slice(0, -1);
    return text === value ? text : text.slice(0, -1) + '…';
  };
  context.clearRect(0, 0, width, Math.max(1, rows.length) * MARKER_ROW_HEIGHT);
  rows.forEach((row, index) => {
    const y = index * MARKER_ROW_HEIGHT;
    // Rounded dark stock edge and a small contact shadow; no pale rectangular outline.
    context.save();
    context.shadowColor = '#00000080'; context.shadowBlur = 4; context.shadowOffsetY = 3;
    rounded(2, y + 2, width - 4, 56, 12);
    context.fillStyle = '#0a1118'; context.fill();
    context.restore();
    rounded(5, y + 5, width - 10, 50, 9);
    context.fillStyle = '#2b1c29'; context.fill();
    context.save();
    rounded(7, y + 7, width - 14, 46, 7); context.clip();
    if (row.kind === 'meter') {
      const fill = context.createLinearGradient(0, y + 7, 0, y + 53);
      if (row.meter.color) {
        fill.addColorStop(0, row.meter.color); fill.addColorStop(1, row.meter.color);
      } else if (row.id === 'health') {
        fill.addColorStop(0, '#d75b70'); fill.addColorStop(.4, '#c84960'); fill.addColorStop(1, '#a52f48');
      } else {
        fill.addColorStop(0, '#d6ab58'); fill.addColorStop(1, '#a87c35');
      }
      context.fillStyle = fill;
      const filledWidth = (width - 14) * markerFraction(row.meter);
      context.fillRect(7, y + 7, filledWidth, 46);
      context.fillStyle = '#ffffff16'; context.fillRect(7, y + 7, filledWidth, 3);
      if (row.meter.preview !== undefined && row.meter.preview < row.meter.current) {
        const after = (width - 14) * markerFraction({ ...row.meter, current: row.meter.preview });
        context.save();
        context.beginPath(); context.rect(7 + after, y + 7, filledWidth - after, 46); context.clip();
        context.fillStyle = '#ffe2ae88'; context.fillRect(7 + after, y + 7, filledWidth - after, 46);
        context.strokeStyle = '#fff3dfaa'; context.lineWidth = 5;
        context.beginPath();
        for (let x = 7 + after - 46; x < 7 + filledWidth; x += 14) {
          context.moveTo(x, y + 53); context.lineTo(x + 46, y + 7);
        }
        context.stroke(); context.restore();
      }
    }
    context.restore();
    rounded(5, y + 5, width - 10, 50, 9);
    context.lineWidth = 1.5; context.strokeStyle = '#41404c'; context.stroke();
    context.font = 'bold 44px monospace'; context.textAlign = 'center'; context.textBaseline = 'middle';
    const value = row.kind === 'meter' ? ((row.meter.label ?? '') + ' ' + row.meter.current + (row.meter.preview !== undefined ? '→' + row.meter.preview : '/' + row.meter.max)).trim() : row.text;
    const text = fitText(value);
    context.lineWidth = 3; context.strokeStyle = '#160e1c'; context.strokeText(text, width / 2, y + 31);
    context.fillStyle = row.kind === 'label' ? row.color ?? '#fff3df' : '#fff3df'; context.fillText(text, width / 2, y + 31);
  });
}
