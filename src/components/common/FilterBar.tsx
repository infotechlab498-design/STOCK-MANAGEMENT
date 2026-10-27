import React, { ReactNode } from 'react';

export interface FilterBarProps {
  children: ReactNode;
  rightActions?: ReactNode;
  className?: string;
  onReset?: () => void;
  hasActiveFilters?: boolean;
}

export const FilterBar: React.FC<FilterBarProps> = ({
  children,
  rightActions,
  className = '',
  onReset,
  hasActiveFilters = false,
}) => {
  return (
    <div className={`filter-bar ${className}`.trim()} role="search" aria-label="Filter records">
      <div className="filter-bar-group">
        {children}
        {hasActiveFilters && onReset && (
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={onReset}
            style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-orange-600)' }}
          >
            Clear Filters
          </button>
        )}
      </div>
      {rightActions && <div className="filter-bar-group">{rightActions}</div>}
    </div>
  );
};
