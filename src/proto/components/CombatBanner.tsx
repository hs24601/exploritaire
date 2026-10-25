import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import './CombatBanner.css';

/** Shared fighting-game announcement, rendered above the fitted combat stage. */
export function CombatBanner({title,subtitle,paused=false,children,kind='challenger',position='center'}:{title:string;subtitle?:string;paused?:boolean;children?:ReactNode;kind?:'challenger'|'party'|'enemy';position?:'center'|'upper'}) {
 return createPortal(<div className="combat-banner" data-kind={kind} data-position={position} data-paused={paused || undefined} role="status" aria-live="polite" aria-atomic="true">
  {children}<strong>{title}</strong>{subtitle && <em>{subtitle}</em>}
 </div>,document.body);
}
