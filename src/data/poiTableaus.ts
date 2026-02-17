import type { Card } from '../engine/types';
import { ELEMENT_TO_SUIT } from '../engine/constants';

export type PoiTableauPresetId =
  | 'oasis_a_tutorial'
  | 'initial_actions_00'
  | 'initial_actions_01'
  | 'initial_actions_02';

const OASIS_A_ROW_FRONT: number[] = [1, 2, 3, 4, 5, 6, 7];
const OASIS_A_ROW_MID: number[] = [8, 7, 6, 5, 4, 3, 2];
const OASIS_A_ROW_BACK: number[] = [1, 2, 1, 2, 1, 13, 12];

function createPresetCard(
  presetId: PoiTableauPresetId,
  rank: number,
  rowIndex: number,
  columnIndex: number
): Card {
  const element = 'N';
  return {
    id: `${presetId}-r${rowIndex}-c${columnIndex}-rk${rank}`,
    rank,
    element,
    suit: ELEMENT_TO_SUIT[element],
  };
}

function createOasisATutorialTableaus(): Card[][] {
  return OASIS_A_ROW_FRONT.map((frontRank, columnIndex) => {
    const midRank = OASIS_A_ROW_MID[columnIndex] ?? frontRank;
    const backRank = OASIS_A_ROW_BACK[columnIndex] ?? frontRank;
    // Stack order is back -> front (top card is last item in array).
    return [
      createPresetCard('oasis_a_tutorial', backRank, 2, columnIndex),
      createPresetCard('oasis_a_tutorial', midRank, 1, columnIndex),
      createPresetCard('oasis_a_tutorial', frontRank, 0, columnIndex),
    ];
  });
}

function createSingleRowTableaus(
  presetId: PoiTableauPresetId,
  ranks: number[]
): Card[][] {
  return ranks.map((rank, columnIndex) => [
    createPresetCard(presetId, rank, 0, columnIndex),
  ]);
}

export function createPoiTableauPreset(presetId: PoiTableauPresetId): Card[][] {
  switch (presetId) {
    case 'initial_actions_00':
      return createSingleRowTableaus('initial_actions_00', [1, 2, 3, 4, 5, 6, 7]);
    case 'initial_actions_01':
      return createSingleRowTableaus('initial_actions_01', [9, 8, 7, 6, 5, 4, 3]);
    case 'initial_actions_02':
      return createSingleRowTableaus('initial_actions_02', [1, 2, 1, 2, 1, 13, 12]);
    case 'oasis_a_tutorial':
    default:
      return createOasisATutorialTableaus();
  }
}
