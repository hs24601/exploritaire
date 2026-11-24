import { memo } from 'react';
import { peripheralDarknessBackground, type PeripheralDarkness as Config } from '../peripheralDarkness';

/** Mount inside an untransformed, clipped scene viewport; UI stays above 44. */
export const PeripheralDarkness = memo(function PeripheralDarkness({ config, enabled = true }: { config?: Config; enabled?: boolean }) {
  if (!enabled || !config || config.strength === 0) return null;
  return <div aria-hidden="true" data-peripheral-darkness="true" style={{
    position: 'absolute', inset: 0, zIndex: 44, pointerEvents: 'none',
    background: peripheralDarknessBackground(config),
  }} />;
});
