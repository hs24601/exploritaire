/** Registered to the single fruit in the sparse watercolor source images.
 * This emissive wash stays independent of the foliage's ambient shading. */
export function ManaberryGlow({ overhead = false, layout }: { overhead?: boolean; layout?: { size: string; position: string } }) {
  const [width, height] = layout?.size.split(' ').map(parseFloat) ?? [18, 18];
  const [left, top] = layout?.position.split(' ').map(parseFloat) ?? [0, 0];
  return <span aria-hidden="true" data-manaberry-glow={overhead ? 'overhead' : 'standee'} style={{
    position: 'absolute', pointerEvents: 'none', left: left + width * (overhead ? .58 : .59),
    top: top + height * (overhead ? .49 : .47), width: width * .29, height: height * .29,
    transform: 'translate(-50%, -50%)', borderRadius: '50%',
    background: 'radial-gradient(ellipse, #b9edff22 0%, #80d5ff18 28%, #57bfff00 74%)',
  }} />;
}
