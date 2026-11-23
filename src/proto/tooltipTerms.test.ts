import { expect, it } from 'vitest';
import { resolveTooltipTerm, tooltipParts } from './tooltipTerms';

it('resolves explicit status and ability links using stable IDs', () => {
  expect(resolveTooltipTerm('status:duskscale')?.name).toBe('Duskscale Armor');
  expect(resolveTooltipTerm('ability:bash')?.description).toBeTruthy();
  expect(resolveTooltipTerm('missing')).toBeNull();
});

it('parses labels and preserves ordinary text without HTML interpretation', () => {
  expect(tooltipParts('Cast [[deep-breath|the breath]] now.')).toEqual([
    { label: 'Cast ' }, { id: 'deep-breath', label: 'the breath' }, { label: ' now.' },
  ]);
  expect(tooltipParts('[[status:duskscale]]')[1].label).toBe('Duskscale Armor');
  expect(tooltipParts('<script>text</script>')).toEqual([{ label: '<script>text</script>' }]);
});
