// Building and feature art slots. Placeholders for now: a painted wash disc with a line
// icon. Eric's authored files (docs/art/village-art-assets.md) go in
// public/assets/runtime/village/<group>/v1/ and get wired in here.
import type { BuildingId } from '../rules/village';
import type { IconName } from './icons';

export const BUILDING_ICON: Record<BuildingId, IconName> = {
  leanto: 'bed', burrow: 'burrow', campfire: 'flame', bench: 'bench', stall: 'stall', rack: 'rack', woodshed: 'woodshed', lantern: 'lamp', well: 'well',
};

/** Expected runtime path for each authored building painting (not used until the files exist). */
export const BUILDING_ART: Record<BuildingId, string> = Object.fromEntries(
  (Object.keys(BUILDING_ICON) as BuildingId[]).map(id => [id, `/assets/runtime/village/buildings/v1/building-${id}-v1.png`]),
) as Record<BuildingId, string>;
