// Small line icons for the village UI. 24px grid, stroke = currentColor.
import type { ReactNode } from 'react';

export type IconName = 'lumber' | 'food' | 'leaf' | 'stone' | 'sun' | 'moon' | 'appeal' | 'village' | 'forest' | 'berries' | 'quarry' | 'lock' | 'bed' | 'menu' | 'close' | 'chain' | 'clock' | 'flame' | 'lamp' | 'rack' | 'well' | 'burrow' | 'bench' | 'stall' | 'woodshed' | 'map';

const paths: Record<IconName, ReactNode> = {
  lumber: <><ellipse cx="17" cy="12" rx="3" ry="5" /><path d="M17 7H6a3 5 0 0 0 0 10h11" /><path d="M16.2 12h1.6" /></>,
  food: <><circle cx="9" cy="14" r="4" /><circle cx="15.5" cy="15" r="3.5" /><path d="M10 10c0-3 2-5 5-6" /><path d="M13 6c2 0 3.5 1 4 2.5" /></>,
  leaf: <><path d="M6 17C2 10 9 4 20 4c0 11-6 17-13 14M4 21 15 10" /><path d="m10 15 5 1m-4-3-1-4" /></>,
  stone: <><path d="M4 17l3-8 5-3 6 3 2 8z" /><path d="M7 9l5 3 6-3M12 12v8" /></>,
  sun: <><circle cx="12" cy="12" r="4" /><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4L7 17M17 7l1.4-1.4" /></>,
  moon: <path d="M19 15A8 8 0 0 1 9 5a7 7 0 1 0 10 10z" />,
  appeal: <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" />,
  village: <><path d="M3 11l9-7 9 7" /><path d="M5 10v10h14V10" /><path d="M10 20v-5h4v5" /></>,
  forest: <><path d="M12 3l5 7h-3l4 6H6l4-6H7z" /><path d="M12 16v5" /></>,
  berries: <><circle cx="8" cy="15" r="3.2" /><circle cx="15" cy="16" r="3.2" /><circle cx="12" cy="10" r="3.2" /><path d="M12 6.8V4l3-1" /></>,
  quarry: <><path d="M14 4l6 6" /><path d="M17 7L5 19" /><path d="M11 4c4 0 7 2 9 6" /></>,
  lock: <><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></>,
  bed: <><path d="M3 18V7M3 14h18v4M21 14v-2a3 3 0 0 0-3-3h-7v5" /><circle cx="7" cy="11" r="1.6" /></>,
  menu: <><circle cx="12" cy="5" r="1.2" /><circle cx="12" cy="12" r="1.2" /><circle cx="12" cy="19" r="1.2" /></>,
  close: <path d="M6 6l12 12M18 6L6 18" />,
  chain: <><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" /><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" /></>,
  flame: <><path d="M12 3c1 3 5 5 5 10a5 5 0 0 1-10 0c0-2.5 1.5-4 2.5-5 .3 1.5 1 2.5 2 3 .5-3-.5-5.5.5-8z" /><path d="M5 21h14" /></>,
  lamp: <><path d="M12 21V11" /><path d="M9 21h6" /><path d="M9 5h6l1 6H8z" /><path d="M12 3v2" /></>,
  rack: <><path d="M4 20V5M20 20V5M4 8h16M4 13h16" /><path d="M8 8v3M12 8v3M16 8v3M8 13v3M14 13v3" /></>,
  well: <><path d="M5 11h14v9H5z" /><path d="M5 15h14" /><path d="M7 11V5h10v6" /><path d="M4 5h16" /><path d="M12 5v4" /></>,
  burrow: <><path d="M3 19h18" /><path d="M5 19a7 7 0 0 1 14 0" /><path d="M9 19a3 3 0 0 1 6 0" /></>,
  bench: <><path d="M4 11h16M5 15h14" /><path d="M6 15v4M18 15v4M7 11V7M17 11V7" /></>,
  stall: <><path d="M4 9l2-5h12l2 5z" /><path d="M4 9a2 2 0 0 0 4 0 2 2 0 0 0 4 0 2 2 0 0 0 4 0 2 2 0 0 0 4 0" /><path d="M6 11v9h12v-9" /></>,
  woodshed: <><path d="M3 10l9-6 9 6" /><path d="M5 9v11M19 9v11" /><circle cx="9" cy="16" r="2" /><circle cx="15" cy="16" r="2" /><circle cx="12" cy="12.5" r="2" /></>,
  map: <><path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2z" /><path d="M9 4v14M15 6v14" /></>,
  clock: <><circle cx="12" cy="12" r="8" /><path d="M12 8v4l3 2" /></>,
};

export function Icon({ name, size = 20, className }: { name: IconName; size?: number; className?: string }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {paths[name]}
    </svg>
  );
}
