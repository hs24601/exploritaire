import type { MegaHandAbilityDefinition, MegaHandAbilityRangeDefinition } from './megahandAbilityData';

export type KinHandAbilityRange = MegaHandAbilityRangeDefinition & {
  litColor: string;
  unlitColor: string;
};

const DEFAULT_RANGE_COLORS = {
  litColor: 'rgba(122,214,255,0.98)',
  unlitColor: 'rgba(42,72,104,0.58)',
  dividerColor: 'rgba(214,238,255,0.52)',
};

const uniqueSortedSegments = (segments: number[]) => (
  [...new Set(segments.map((value) => Math.max(1, Math.floor(value))))].sort((left, right) => left - right)
);

const getRangeSegments = (range: MegaHandAbilityRangeDefinition) => {
  if (range.apSegments && range.apSegments.length > 0) {
    return uniqueSortedSegments(range.apSegments);
  }
  const start = Math.max(1, Math.min(range.startAp, range.endAp));
  const end = Math.max(start, Math.max(range.startAp, range.endAp));
  return Array.from({ length: end - start + 1 }, (_, index) => start + index);
};

const rangeIncludesAp = (range: MegaHandAbilityRangeDefinition, ap: number) => (
  getRangeSegments(range).includes(ap)
);

const formatRangeLabel = (range: MegaHandAbilityRangeDefinition) => {
  const segments = getRangeSegments(range);
  if (segments.length === 0) return '1 AP';
  if (segments.length === 1) return `${segments[0]} AP`;
  const sequential = segments.every((value, index) => index === 0 || value === segments[index - 1] + 1);
  return sequential ? `${segments[0]}-${segments[segments.length - 1]} AP` : `${segments.join(', ')} AP`;
};

const normalizeRange = (range: MegaHandAbilityRangeDefinition): KinHandAbilityRange => {
  const segments = getRangeSegments(range);
  return {
    key: range.key,
    startAp: segments[0] ?? range.startAp,
    endAp: segments[segments.length - 1] ?? range.endAp,
    apSegments: segments,
    name: range.name,
    description: range.description,
    litColor: range.litColor ?? DEFAULT_RANGE_COLORS.litColor,
    unlitColor: range.unlitColor ?? DEFAULT_RANGE_COLORS.unlitColor,
    dividerColor: range.dividerColor ?? DEFAULT_RANGE_COLORS.dividerColor,
  };
};

const normalizeAbilityRanges = (abilities: Pick<MegaHandAbilityDefinition, 'abilityRanges'>[]) => (
  abilities.flatMap((ability) => (ability.abilityRanges ?? []).map(normalizeRange))
);

export const getKinHandActorAbilityRanges = (
  actorName: string,
  abilityDefinitions?: Array<Pick<MegaHandAbilityDefinition, 'abilityRanges'>> | null,
): KinHandAbilityRange[] => {
  const normalizedRanges = normalizeAbilityRanges(abilityDefinitions ?? []);
  if (normalizedRanges.length > 0) {
    return normalizedRanges;
  }

  return [{
    key: `${actorName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-empty`,
    startAp: 1,
    endAp: 5,
    apSegments: [1, 2, 3, 4, 5],
    name: 'No ability mapped',
    description: 'Author a basic ability or an Orim assignment for this actor.',
    ...DEFAULT_RANGE_COLORS,
  }];
};

export const getKinHandActorRangesForAp = (
  actorName: string,
  ap: number,
  abilityDefinitions?: Array<Pick<MegaHandAbilityDefinition, 'abilityRanges'>> | null,
) => {
  const clampedAp = Math.max(1, Math.floor(ap));
  return getKinHandActorAbilityRanges(actorName, abilityDefinitions).filter((range) => rangeIncludesAp(range, clampedAp));
};

export const kinhandAbilityRangeHelpers = {
  getRangeSegments,
  rangeIncludesAp,
  formatRangeLabel,
};
