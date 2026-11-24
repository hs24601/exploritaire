import type { ReactNode } from 'react';
import { useArtStyle } from '../artStyle';
import { abilityCardArt } from '../art/abilityCardArt';

/** Shared by playable, held, compact inspection and jumbo ability cards. */
export function AbilityArtwork({name, fallback, fire = false}: {name: string; fallback: ReactNode; fire?: boolean}) {
  const style = useArtStyle(), src = abilityCardArt(name);
  if (style !== 'paint' || !src) return <>{fallback}</>;
  return <span data-ability-art={name} style={{position:'absolute',inset:0,display:'block',overflow:'hidden'}}>
    <img src={src} alt="" draggable={false} style={{width:'100%',height:'100%',objectFit:'cover',imageRendering:'auto'}} />
    {fire && <span aria-hidden="true" style={{position:'absolute',inset:0,background:'radial-gradient(ellipse at 55% 45%, #ff984533, transparent 65%)',mixBlendMode:'screen'}} />}
  </span>;
}
