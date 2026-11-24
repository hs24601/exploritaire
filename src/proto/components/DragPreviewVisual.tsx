import type { RefObject } from 'react';
import './ActorDragPreview.css';

/** One shared hand, ghost-card host and target cue for gesture tutorials. */
export function DragPreviewVisual({ layerRef, className = '' }: { layerRef: RefObject<HTMLDivElement | null>; className?: string }) {
  return <div ref={layerRef} className={`actor-drag-preview ${className}`} hidden aria-hidden="true" inert>
    <svg className="actor-drag-preview__target"><circle className="actor-drag-preview__destination" r="24" /></svg>
    <div className="actor-drag-preview__card" />
    <svg className="actor-drag-preview__hand" viewBox="0 0 64 76"><path d="M24 40V12c0-8 11-8 11 0v21-9c0-7 10-7 10 0v12-5c0-6 10-6 10 0v8c9-3 10 4 8 12l-5 17c-2 6-6 9-13 9H30c-5 0-9-3-12-7L5 46c-4-7 3-12 8-7l11 11" /></svg>
  </div>;
}
