/**
 * Generic row management component for editors with add/remove/edit row patterns
 * Eliminates code duplication between abilities editor, orim editor, and reward editor
 */

import React, { ReactNode } from 'react';

export interface RowManagerProps<T extends { id: string | number }> {
  /** Current rows */
  rows: T[];
  /** Render a single row, with the row data and its index */
  renderRow: (row: T, index: number) => ReactNode;
  /** Called when user clicks "add row" */
  onAdd: () => void;
  /** Called when user clicks remove for a row */
  onRemove: (id: string | number) => void;
  /** Optional: header row (column labels, etc) */
  renderHeader?: () => ReactNode;
  /** Optional: empty state message */
  renderEmpty?: () => ReactNode;
  /** Optional: container class name */
  containerClassName?: string;
  /** Optional: add button label */
  addButtonLabel?: string;
  /** Optional: add button class name */
  addButtonClassName?: string;
  /** Minimum rows to allow (defaults to 0, but rewards editor may require 1) */
  minRows?: number;
}

export function RowManager<T extends { id: string | number }>({
  rows,
  renderRow,
  onAdd,
  onRemove,
  renderHeader,
  renderEmpty,
  containerClassName = 'space-y-3',
  addButtonLabel = '+ Add Row',
  addButtonClassName = 'text-[9px] px-2 py-0.5 rounded border border-game-teal/40 text-game-teal/70 hover:border-game-teal hover:text-game-teal transition-colors',
  minRows = 0,
}: RowManagerProps<T>) {
  const canRemove = rows.length > minRows;

  return (
    <div className={containerClassName}>
      {renderHeader && renderHeader()}

      {rows.length === 0 && renderEmpty ? (
        renderEmpty()
      ) : (
        rows.map((row, index) => (
          <div key={row.id}>
            {renderRow(row, index)}
          </div>
        ))
      )}

      <button
        type="button"
        onClick={onAdd}
        className={addButtonClassName}
      >
        {addButtonLabel}
      </button>
    </div>
  );
}
