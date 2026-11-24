// Lab-only asset recipes. Paint is unchanged; depth is independent metadata.
export const DEPTH_ASSETS = {
  pine: {
    label: 'Pine',
    layers: [{ id: 'tree', path: 'environment/watercolor/v1/pine-relief-v1.png', depth: 0, height: 3.4 }],
    volume: true,
  },
  cir: {
    label: 'Cir + wind',
    layers: [
      { id: 'rear', path: 'keru/cir/windstorm/v1/cir-wind-rear.png', depth: -.45, height: 3.2 },
      { id: 'subject', path: 'keru/cir/cir-phoenix-gather-still-v5.png', depth: 0, height: 2.8 },
      { id: 'front', path: 'keru/cir/windstorm/v1/cir-wind-front.png', depth: .45, height: 3.2 },
    ],
    volume: false,
  },
} as const;
