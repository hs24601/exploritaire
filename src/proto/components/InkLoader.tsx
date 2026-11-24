import {HeroLoaderArt} from '../../ui/HeroLoader';
import { useId } from 'react';
import './InkLoader.css';

/** Procedural cloth and displaced pigment need no artwork downloads themselves. */
export function InkLoader({ done, total, cover = false }: { done: number; total: number; cover?: boolean }) {
  const id = useId().replace(/:/g, '');
  const fraction = Math.max(0, Math.min(1, done / Math.max(1, total)));
  return <div className={cover ? 'ink-loader ink-loader--cover' : 'ink-loader'} data-media-loading="true">
    <div className="ink-loader__content">
      <HeroLoaderArt className="ink-loader__hero"/>
      <p className="ink-loader__title" role="status">Finding Hero so we can assemble...</p>
      <svg className="ink-loader__bar" viewBox="0 0 600 56" role="progressbar"
        aria-label="Loading game assets" aria-valuemin={0} aria-valuemax={total} aria-valuenow={done}
        aria-valuetext={`${Math.floor(fraction * 100)}% of opening artwork prepared`}>
        <defs>
          <filter id={`${id}-cloth`} x="0" y="0" width="100%" height="100%">
            <feTurbulence type="fractalNoise" baseFrequency=".72 .36" numOctaves="3" seed="8" />
            <feDiffuseLighting lightingColor="#efe4ce" surfaceScale="2.4" diffuseConstant="1.1"><feDistantLight azimuth="45" elevation="55" /></feDiffuseLighting>
          </filter>
          <filter id={`${id}-bleed`} x="-20%" y="-100%" width="140%" height="300%">
            <feTurbulence type="fractalNoise" baseFrequency=".035 .15" numOctaves="3" seed="12" result="grain" />
            <feDisplacementMap in="SourceGraphic" in2="grain" scale="12" xChannelSelector="R" yChannelSelector="G" />
          </filter>
          <linearGradient id={`${id}-ink`} x2="1" y2=".3">
            <stop stopColor="#182f3d" /><stop offset=".55" stopColor="#305c69" /><stop offset="1" stopColor="#659491" />
          </linearGradient>
          <clipPath id={`${id}-bounds`}><rect x="8" y="8" width="584" height="40" rx="4" /></clipPath>
        </defs>
        <g clipPath={`url(#${id}-bounds)`}>
          <path fill="#d9cbb1" d="M0 0h600v56H0z" />
          <path filter={`url(#${id}-cloth)`} opacity=".55" d="M0 0h600v56H0z" />
          {/* The edge follows completed work; only pigment pooling breathes. */}
          <svg x="8" y="0" width={584 * fraction} height="56" overflow="hidden">
            <g filter={`url(#${id}-bleed)`}>
              <rect x="-12" y="3" width={584 * fraction + 8} height="50" fill={`url(#${id}-ink)`} />
              <rect className="ink-loader__pool" x={584 * fraction - 19} y="0" width="22" height="56" fill="#122d3d" opacity=".4" />
            </g>
            <path filter={`url(#${id}-cloth)`} opacity=".22" style={{ mixBlendMode: 'multiply' }} d="M0 0h600v56H0z" />
          </svg>
        </g>
        <rect x="8.5" y="8.5" width="583" height="39" rx="4" fill="none" stroke="#ae9974" strokeOpacity=".6" />
      </svg>
      <div className="ink-loader__details" aria-hidden="true"><span>Gathering the world</span><span>{Math.floor(fraction * 100)}%</span></div>
    </div>
  </div>;
}
