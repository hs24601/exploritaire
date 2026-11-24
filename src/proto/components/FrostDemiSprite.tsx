import { useId } from 'react';
import './FrostDemiSprite.css';

/** The existing adult atlas and actual cub painting, rather than a scaled adult. */
export function FrostDemiSprite({ dark = false, cub = false }: { dark?: boolean; cub?: boolean }) {
  const id = useId().replace(/:/g, '');
  if (cub) return <img className="frost-demi-sprite frost-demi-cub" src="/assets/runtime/characters/dem/dem-partycomp.png" alt="Demi cub" draggable={false}/>;
  return <span className="frost-demi-sprite" data-dark-demi={dark || undefined}>
    <svg viewBox="88 24 335 464" role="img" aria-label={dark ? 'Dark Demi' : 'Demi'}>
      <defs><filter id={id} filterUnits="userSpaceOnUse" x="76" y="12" width="359" height="488" colorInterpolationFilters="sRGB">
        <feTurbulence type="fractalNoise" baseFrequency=".018" numOctaves="2" seed="7" result="mist"><animate attributeName="baseFrequency" values=".018;.025;.018" dur="6s" repeatCount="indefinite"/></feTurbulence>
        <feDisplacementMap in="SourceGraphic" in2="mist" scale="3" xChannelSelector="R" yChannelSelector="G"/>
        <feColorMatrix type="matrix" values=".33 .12 .08 0 .015  .015 .025 .01 0 0  .025 .01 .035 0 .005  0 0 0 1 0"/>
      </filter></defs>
      <image href="/assets/runtime/characters/dem/rig/watercolor/v2/dem-standing-low-v2.png" width="1536" height="1024" filter={dark ? `url(#${id})` : undefined}/>
    </svg>
    {dark && <><i className="demi-miasma"/><i className="demi-miasma demi-miasma--second"/></>}
  </span>;
}
