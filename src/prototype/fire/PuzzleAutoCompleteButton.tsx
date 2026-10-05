type PuzzleAutoCompleteButtonProps = {
  onClick: () => void;
  disabled?: boolean;
  label?: string;
};

/** Reusable, icon-only control for rapidly completing a puzzle's legal solution path. */
export function PuzzleAutoCompleteButton({ onClick, disabled = false, label = 'Auto-complete puzzle' }: PuzzleAutoCompleteButtonProps) {
  return <button className="puzzle-auto-complete" data-testid="puzzle-auto-complete" type="button" aria-label={label} title={label} disabled={disabled} onClick={onClick}>🪄</button>;
}
