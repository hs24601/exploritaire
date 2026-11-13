import type { Element } from '../rules/elementSuits';
import type { ReactNode } from 'react';
import './ElementRankBackdrop.css';

/** Authored paint stays behind the live rank, independent of card input. */
export function ElementRankBackdrop({ element, size, children }: { element: Element; size: 'compact' | 'large'; children: ReactNode }) {
 return <span className="element-rank-backdrop" data-element={element} data-size={size}>
  <img src={`${import.meta.env.BASE_URL}assets/runtime/ui/value-backdrops/${element}-${size}-v1.png`} alt="" aria-hidden="true" draggable={false} />
  <span className="element-rank-backdrop__ink">{children}</span>
 </span>;
}
