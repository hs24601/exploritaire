import { useLayoutEffect } from 'react';

/** Escape camera clipping and 3D depth while the original retains pointer capture. */
export function useHeldVisual(getSource: () => HTMLElement | null, active: boolean) {
  useLayoutEffect(() => {
    const source = active ? getSource() : null;
    if (!source) return;
    const rect = source.getBoundingClientRect();
    if (!rect.width || !source.offsetWidth) return;
    const scale = Math.min(rect.width / source.offsetWidth, (innerWidth - 16) / source.offsetWidth, (innerHeight - 16) / source.offsetHeight);
    const halfWidth = source.offsetWidth * scale / 2, halfHeight = source.offsetHeight * scale / 2;
    const x = Math.max(8 + halfWidth, Math.min(innerWidth - 8 - halfWidth, rect.left + rect.width / 2));
    const y = Math.max(8 + halfHeight, Math.min(innerHeight - 8 - halfHeight, rect.top + rect.height / 2));
    const face = source.cloneNode(true) as HTMLElement;
    // This surface must never intercept inspection or drop hit tests.
    for (const node of [face, ...face.querySelectorAll<HTMLElement>('*')]) {
      for (const name of node.getAttributeNames()) {
        if (['id', 'data-board-piece', 'data-camera-ignore', 'data-table-quest', 'data-biome-id', 'data-resource'].includes(name)) node.removeAttribute(name);
      }
    }
    face.dataset.heldVisual = 'true';
    face.setAttribute('aria-hidden', 'true');
    face.inert = true;
    const computed = getComputedStyle(source);
    for (const name of computed) {
      if (name.startsWith('--')) face.style.setProperty(name, computed.getPropertyValue(name));
    }
    Object.assign(face.style, {
      position: 'fixed', left: `${x}px`, top: `${y}px`,
      width: `${source.offsetWidth}px`, height: `${source.offsetHeight}px`, margin: '0',
      transform: `translate(-50%, -50%) scale(${scale})`,
      transformOrigin: 'center', zIndex: '100000', pointerEvents: 'none', opacity: '1',
      transition: 'none', animation: 'none', font: computed.font, color: computed.color,
      padding: computed.padding, border: computed.border, borderRadius: computed.borderRadius,
      background: computed.background, boxSizing: computed.boxSizing,
    });
    document.body.appendChild(face);
    const opacity = source.style.opacity;
    source.style.opacity = '0';
    return () => { source.style.opacity = opacity; face.remove(); };
  });
}
