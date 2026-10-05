type CardProgressOutlineProps = {
  /** Number of completed gates, from 0 through totalSections. */
  completedSections: number;
  totalSections?: number;
  label?: string;
};

const segments = [
  [8, 3, 27, 3], [31, 3, 50, 3], [54, 3, 73, 3], [77, 3, 92, 3],
  [97, 8, 97, 37], [97, 41, 97, 70], [97, 74, 97, 103], [97, 107, 97, 132],
  [92, 137, 73, 137], [69, 137, 50, 137], [46, 137, 27, 137], [23, 137, 8, 137],
  [3, 132, 3, 103], [3, 99, 3, 70], [3, 66, 3, 37], [3, 33, 3, 8],
] as const;

const cardinalSegments = [
  [7, 3, 93, 3],      // north
  [97, 7, 97, 133],   // east
  [93, 137, 7, 137],  // south
  [3, 133, 3, 7],     // west
] as const;

function perimeterSegments(totalSections: number) {
  if (totalSections === 4) return cardinalSegments;
  const perSide = Math.max(1, Math.ceil(totalSections / 4));
  const edge = 94;
  return Array.from({ length: totalSections }, (_, index) => {
    const side = Math.floor(index / perSide);
    const offset = (index % perSide) / perSide;
    const next = Math.min(1, (index % perSide + 1) / perSide);
    if (side === 0) return [3 + edge * offset, 3, 3 + edge * next - 2, 3] as const;
    if (side === 1) return [97, 3 + 134 * offset, 97, 3 + 134 * next - 2] as const;
    if (side === 2) return [97 - edge * offset, 137, 97 - edge * next + 2, 137] as const;
    return [3, 137 - 134 * offset, 3, 137 - 134 * next + 2] as const;
  });
}

/** A lightweight, reusable segmented outline for progress-gated cards. */
export function CardProgressOutline({ completedSections, totalSections = 16, label = 'Card progress' }: CardProgressOutlineProps) {
  const completed = Math.max(0, Math.min(completedSections, totalSections));
  // Four-gate cards use one complete rail per cardinal edge. Larger gate
  // counts are distributed proportionally around the same perimeter.
  const displayedSegments = totalSections <= 16
    ? (totalSections === 4 ? cardinalSegments : Array.from({ length: totalSections }, (_, index) => segments[Math.floor(index * segments.length / totalSections)]))
    : perimeterSegments(totalSections);
  return <svg className="card-progress-outline" viewBox="0 0 100 140" role="img" aria-label={`${label}: ${completed} of ${totalSections}`}>
    {displayedSegments.map(([x1, y1, x2, y2], index) => <line key={index} className={`progress-segment ${index < completed ? 'is-active' : ''} ${index === completed - 1 ? 'is-current' : ''}`} x1={x1} y1={y1} x2={x2} y2={y2} />)}
  </svg>;
}
