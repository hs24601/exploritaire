export function getTileTitleLayout(
  displayName: string,
  tileSize: number,
  cameraScale: number
) {
  const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
  const splitTitle = (text: string) => {
    const parts = text.split(' ').filter(Boolean);
    if (parts.length <= 1) {
      return { line1: text, line2: '' };
    }
    let bestIndex = 1;
    let bestScore = Number.POSITIVE_INFINITY;
    for (let i = 1; i < parts.length; i += 1) {
      const a = parts.slice(0, i).join(' ');
      const b = parts.slice(i).join(' ');
      const score = Math.max(a.length, b.length);
      if (score < bestScore) {
        bestScore = score;
        bestIndex = i;
      }
    }
    return {
      line1: parts.slice(0, bestIndex).join(' '),
      line2: parts.slice(bestIndex).join(' '),
    };
  };

  const { line1, line2 } = splitTitle(displayName);
  const maxLineLength = Math.max(line1.length, line2.length || 0, 1);
  const availableWidth = tileSize - 14;
  const baseFont = availableWidth / (maxLineLength * 0.9);
  const scaleFactor = Math.min(1, Math.max(0.6, cameraScale));
  const lengthPenalty = Math.max(0, maxLineLength - 8);
  const penaltyFactor = 1 - Math.min(0.35, lengthPenalty * 0.04);
  const squeezeFactor = maxLineLength >= 11 ? 0.82 : maxLineLength >= 9 ? 0.88 : 1;
  const titleFontSize = clamp(baseFont * scaleFactor * penaltyFactor * squeezeFactor, 6, 18);
  const titleLetterSpacing = maxLineLength > 9 ? '0.02em' : '0.06em';

  return {
    line1,
    line2,
    titleFontSize,
    titleLetterSpacing,
  };
}
