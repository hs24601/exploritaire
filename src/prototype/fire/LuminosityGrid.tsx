/** Debug-only coordinate overlay. Distances use the same 0–100 space as scattered-card lighting. */
export function LuminosityGrid({ discoveryRadius, visualRadius }: { discoveryRadius: number; visualRadius: number }) {
  const gridLines = Array.from({ length: 9 }, (_, index) => (index + 1) * 10);
  return <svg className="luminosity-grid" data-testid="luminosity-grid" viewBox="0 0 100 100" preserveAspectRatio="none" aria-label="Luminosity distance grid">
    {gridLines.map((value) => <g key={value}><line x1={value} y1="0" x2={value} y2="100" /><line x1="0" y1={value} x2="100" y2={value} /></g>)}
    {[10, 20, 30, 40, 50, 60].map((radius) => <circle key={radius} className="luminosity-ring" cx="50" cy="50" r={radius} />)}
    <circle className="luminosity-discovery" cx="50" cy="50" r={Math.min(discoveryRadius, 70)} />
    <circle className="luminosity-visual" cx="50" cy="50" r={Math.min(visualRadius, 70)} />
    <circle className="luminosity-origin" cx="50" cy="50" r="1.2" />
  </svg>;
}
