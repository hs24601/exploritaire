/** Static pigment grain and uneven brush edges, clipped to the painted shapes. */
export function ElementBrushTexture({ id, seed }: { id: string; seed: number }) {
  return <defs>
    <filter id={id} filterUnits="userSpaceOnUse" x="-12" y="-12" width="124" height="164" colorInterpolationFilters="sRGB">
      <feTurbulence type="fractalNoise" baseFrequency=".24 .4" numOctaves={2} seed={seed} result="edgeGrain" />
      <feDisplacementMap in="SourceGraphic" in2="edgeGrain" scale=".55" xChannelSelector="R" yChannelSelector="G" result="brushed" />
      <feTurbulence type="fractalNoise" baseFrequency=".65 .95" numOctaves={2} seed={seed + 7} result="pigment" />
      <feColorMatrix in="pigment" type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  .12 0 0 0 .88" result="pigmentAlpha" />
      <feComposite in="brushed" in2="pigmentAlpha" operator="in" result="dryBrush" />
    </filter>
  </defs>;
}
