// The village map with a view choice: the top-down map (MapView) or the
// isometric map (IsoMapView), sharing every rule and callback. The minimap and
// the ?book spread always use the top-down map (Eric, 2026-11-27: the book keeps
// its current camera for this slice). The toggle sits in the HUD so it never
// covers the map.
//
// The choice is remembered on this device. ?iso opens the isometric view and
// ?iso=0 the top-down one, for links and tests.
import { useState } from 'react';
import { MapView } from './MapView';
import { IsoMapView } from './IsoMapView';
import { BOOK_MODE } from './MapExtras';
import { Icon } from './icons';

type MapProps = Parameters<typeof MapView>[0];
export interface MapViewChoice { iso: boolean; toggle: () => void }

const VIEW_KEY = 'exploritaire.village.view.v1';

function initialIso(): boolean {
  if (BOOK_MODE) return false;
  const q = new URLSearchParams(window.location.search).get('iso');
  if (q !== null) return q !== '0' && q !== 'false';
  try { return localStorage.getItem(VIEW_KEY) === 'iso'; } catch { return false; }
}

export function useMapView(): MapViewChoice {
  const [iso, setIso] = useState(initialIso);
  return { iso, toggle: () => {
    setIso(!iso);
    try { localStorage.setItem(VIEW_KEY, iso ? 'top' : 'iso'); } catch { /* private mode */ }
  } };
}

/** A small isometric cube, for the toggle that switches to the isometric map. */
function CubeIcon({ size = 20 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 3 20.5 7.8v8.4L12 21l-8.5-4.8V7.8z" /><path d="M3.5 7.8 12 12.6l8.5-4.8M12 12.6V21" />
  </svg>;
}

export function MapViewToggle({ view }: { view: MapViewChoice }) {
  if (BOOK_MODE) return null;
  const label = view.iso ? 'Switch to the top-down map' : 'Switch to the isometric map';
  return <button type="button" className="vg-iconbtn vg-iso-toggle" title={label} aria-label={label} onClick={view.toggle}>
    {view.iso ? <Icon name="map" size={20} /> : <CubeIcon />}
  </button>;
}

export function VillageMap({ view, ...props }: MapProps & { view: MapViewChoice }) {
  return view.iso && !BOOK_MODE && !props.mini
    ? <IsoMapView game={props.game} placing={props.placing} aim={props.aim} selected={props.selected} denPlacement={props.denPlacement}
        onTile={props.onTile} onHover={props.onHover} onFeature={props.onFeature} partyTile={props.partyTile} selectedKin={props.selectedKin}
        onParty={props.onParty} onKin={props.onKin} onWanderer={props.onWanderer} baseTile={props.layout.tile} />
    : <MapView {...props} />;
}
