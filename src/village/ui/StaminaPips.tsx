import { KIN_STAMINA_MAX } from '../rules/aspen';

export function StaminaPips({ value, max = KIN_STAMINA_MAX }: { value: number; max?: number }) {
  return <span className="vg-stamina" role="meter" aria-label="Stamina" aria-valuemin={0}
    aria-valuemax={max} aria-valuenow={value}>
    {Array.from({ length: max }, (_, index) =>
      <span key={index} className={index < value ? 'is-filled' : undefined} aria-hidden="true" />)}
  </span>;
}
