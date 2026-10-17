import type { ReactNode } from 'react';
import './TableCardLayers.css';

/** Physical card stock above a contact shadow. Depth is in table world units,
 * so orbit and zoom project the face and edges together without screen offsets. */
export function TableCardLayers({ children }: { children: ReactNode }) {
  return <div className="table-card-layers">
    <span className="table-card-layers__shadow" aria-hidden="true" />
    {[0, 1, 2, 3].map(layer => <span key={layer} className="table-card-layers__stock" aria-hidden="true"
      style={{ transform: `translateZ(${.4 + layer * .5}px)` }} />)}
    <div className="table-card-layers__face">{children}</div>
  </div>;
}
