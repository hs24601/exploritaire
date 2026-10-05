import React from 'react';
import './golf-components.css';

export type TableauProps = React.HTMLAttributes<HTMLDivElement> & {
  /** The source columns make every tableau instance explicit and inspectable. */
  columns: readonly unknown[];
};

/** Shared semantic wrapper for tableau layouts and future scene variants. */
export const Tableau = ({ columns: _columns, className = '', children, ...props }: TableauProps) => (
  <div {...props} data-component="tableau" className={`tableau ${className}`}>
    {children}
  </div>
);
