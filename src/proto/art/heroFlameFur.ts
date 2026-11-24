/** Registration only: source pixels are reused verbatim from the approved composite.
 * Rectangles use actual source PNG dimensions, not the screenshot/checkerboard. */
export const HERO_FLAME_FUR = {
 'hero-shoulder-left': {
  source:[105,478,250,300],target:[0,550,280,345],
  shape:'M0 5 L57 0 L84 12 L100 36 L94 69 L78 100 L5 97 L0 76 Z',
  topcoat:'M73 0 L100 0 L100 100 L69 100 L81 88 L66 80 L82 68 L69 59 L85 47 L73 38 L87 25 L77 16 Z',
 },
 'hero-shoulder-right': {
  source:[742,486,228,300],target:[740,610,270,330],
  shape:'M8 0 L95 0 L100 26 L100 78 L87 100 L16 98 L0 75 L0 22 Z',
  topcoat:'M0 0 L27 0 L23 14 L37 25 L20 36 L32 47 L17 59 L32 70 L19 82 L33 93 L28 100 L0 100 Z',
 },
 'hero-paw': {
  source:[235,880,180,230],target:[100,960,240,250],
  // End the sample above the composite's toes: its differently registered paw
  // anatomy must never become part of the optional flame overlay.
  shape:'M0 18 L15 22 L11 6 L32 0 L60 4 L86 14 L100 32 L86 43 L66 42 L49 51 L29 55 L10 49 L0 54 Z',
  topcoat:'M61 0 L100 0 L100 100 L61 100 L74 87 L57 78 L73 67 L61 56 L79 45 L66 34 L82 23 L68 13 Z',
 },
} as const;
