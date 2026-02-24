export const CARD_WATERCOLOR_FILTER_ID = 'card-watercolor-filter';

export function WatercolorSvgFilterDefs() {
  return (
    <svg width="0" height="0" className="absolute pointer-events-none" aria-hidden="true">
      <defs>
        <filter id={CARD_WATERCOLOR_FILTER_ID}>
          <feTurbulence result="noise-lg" type="fractalNoise" baseFrequency=".0125" numOctaves="2" seed="1222" />
          <feTurbulence result="noise-md" type="fractalNoise" baseFrequency=".12" numOctaves="3" seed="11413" />
          <feComposite result="BaseGraphic" in="SourceGraphic" in2="noise-lg" operator="arithmetic" k1="0.3" k2="0.45" k4="-.07" />
          <feMorphology result="layer-1" in="BaseGraphic" operator="dilate" radius="0.5" />
          <feDisplacementMap result="layer-1" in="layer-1" in2="noise-lg" xChannelSelector="R" yChannelSelector="B" scale="2" />
          <feDisplacementMap result="layer-1" in="layer-1" in2="noise-md" xChannelSelector="R" yChannelSelector="B" scale="3" />
          <feDisplacementMap result="mask" in="layer-1" in2="noise-lg" xChannelSelector="A" yChannelSelector="A" scale="4" />
          <feGaussianBlur result="mask" in="mask" stdDeviation="6" />
          <feComposite result="layer-1" in="layer-1" in2="mask" operator="arithmetic" k1="1" k2=".25" k3="-.25" k4="0" />
          <feDisplacementMap result="layer-2" in="BaseGraphic" in2="noise-lg" xChannelSelector="G" yChannelSelector="R" scale="2" />
          <feDisplacementMap result="layer-2" in="layer-2" in2="noise-md" xChannelSelector="A" yChannelSelector="G" scale="3" />
          <feDisplacementMap result="glow" in="BaseGraphic" in2="noise-lg" xChannelSelector="R" yChannelSelector="A" scale="5" />
          <feMorphology result="glow-diff" in="glow" operator="erode" radius="2" />
          <feComposite result="glow" in="glow" in2="glow-diff" operator="out" />
          <feGaussianBlur result="glow" in="glow" stdDeviation=".5" />
          <feComposite result="layer-2" in="layer-2" in2="glow" operator="arithmetic" k1="1.2" k2="0.55" k3=".3" k4="-0.2" />
          <feComposite result="watercolor" in="layer-1" in2="layer-2" operator="over" />
        </filter>
      </defs>
    </svg>
  );
}
