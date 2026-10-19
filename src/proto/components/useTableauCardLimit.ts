import { useLayoutEffect, useState, type RefObject } from 'react';
import { PLAYING_CARD_RATIO } from './PlayingCardStack';

/** Cap both dimensions against the actual foundation faces, excluding badges. */
export function useTableauCardLimit(ref: RefObject<HTMLElement | null>) {
  const [limit, setLimit] = useState(Infinity);
  useLayoutEffect(() => {
    const area = ref.current;
    const field = area?.closest('.battle-field') ?? area?.closest('.proto-tableau-field') ?? area?.closest('.travel-tableau');
    if (!field) return;
    const resize = new ResizeObserver(measure);
    function measure() {
      const dock = document.querySelector<HTMLElement>('[data-map-actor-card]');
      const faces = field!.querySelectorAll<HTMLElement>('.proto-occupied-foundation-face, .proto-empty-foundation-face, .battle-field__actor-card, .travel-foundation-actor');
      let next = Infinity;
      if (dock) { resize.observe(dock); if (dock.offsetWidth && dock.offsetHeight) next = Math.min(dock.offsetWidth, dock.offsetHeight * PLAYING_CARD_RATIO); }
      faces.forEach(face => {
        resize.observe(face);
        if (face.offsetWidth && face.offsetHeight) next = Math.min(next, face.offsetWidth, face.offsetHeight * PLAYING_CARD_RATIO);
      });
      setLimit(previous => previous === next ? previous : next);
    }
    measure();
    const mutation = new MutationObserver(measure);
    mutation.observe(field, {childList: true, subtree: true});
    return () => { resize.disconnect(); mutation.disconnect(); };
  }, [ref]);
  return limit;
}
