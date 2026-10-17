/** Development catalogue: append entries, never renumber existing configurations.
 * Canonical keys still own saved edits and camera triggers. */
export const CALLOUT_REFERENCES: Readonly<Record<string, string>> = {
  'day01.opening': '0001',
  'day01.sparse-patch': '0002',
  'day01.budget': '0003',
  'day01.home': '0004',
  'day01.saved-light': '0005',
  'day02.opening': '0006',
  'day02.scarcity': '0007',
  'day03.opening': '0008',
  'rescue.hope': '0009',
  'rescue.cower': '0010',
  'rescue.banks': '0011',
  'rescue.safe': '0012',
};
/** Uncatalogued callouts retain their canonical identity, never a session counter. */
export const calloutReference = (id: string) => CALLOUT_REFERENCES[id] ? `#${CALLOUT_REFERENCES[id]}` : id;
