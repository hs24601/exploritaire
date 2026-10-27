export function FoundationExitButton({ onExit, disabled, label, everyone = false }: {
  onExit: () => void; disabled: boolean; label: string; everyone?: boolean;
}) {
  return <button type="button" className={`proto-foundation-exit${everyone ? ' proto-foundation-exit--everyone' : ''}`}
    aria-label={label} title={label} disabled={disabled} onClick={event => { event.stopPropagation(); onExit(); }}>
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 4H4v16h6 M8 12h13 M17 8l4 4-4 4" />{everyone && <path d="M7 1H1v16" />}</svg>
  </button>;
}
