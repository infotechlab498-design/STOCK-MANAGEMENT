import React, { ReactNode } from 'react';
import { LoadingSpinner, EmptyState } from './EmptyState';

export interface ColumnDef<T> {
  key: string;
  header: ReactNode;
  width?: string | number;
  align?: 'left' | 'center' | 'right';
  mono?: boolean;
  render?: (item: T, index: number) => ReactNode;
}

export interface DataTableProps<T> {
  columns: ColumnDef<T>[];
  data: T[];
  keyExtractor: (item: T) => string;
  isLoading?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: ReactNode;
  minWidth?: number;
  caption?: string;
  className?: string;
}

export function DataTable<T>({
  columns,
  data,
  keyExtractor,
  isLoading = false,
  emptyTitle = 'No records found',
  emptyDescription = 'There are no items matching the selected criteria.',
  emptyAction,
  minWidth = 640,
  caption,
  className = '',
}: DataTableProps<T>) {
  if (isLoading) {
    return (
      <div className="table-container" style={{ padding: 'var(--space-8)' }}>
        <LoadingSpinner label="Loading ledger data..." />
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="table-container">
        <EmptyState
          title={emptyTitle}
          description={emptyDescription}
          action={emptyAction}
        />
      </div>
    );
  }

  return (
    <div className={`table-container ${className}`.trim()}>
      <table className="data-table" style={{ minWidth }}>
        {caption && <caption className="sr-only">{caption}</caption>}
        <thead>
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                style={{
                  width: col.width,
                  textAlign: col.align || 'left',
                }}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((item, rowIndex) => (
            <tr key={keyExtractor(item)}>
              {columns.map((col) => {
                const cellContent = col.render
                  ? col.render(item, rowIndex)
                  : (item as any)[col.key];

                const isNumeric = col.align === 'right';
                const cellClass = [
                  col.mono ? 'td-mono' : '',
                  isNumeric ? 'td-numeric' : '',
                ]
                  .filter(Boolean)
                  .join(' ');

                return (
                  <td
                    key={col.key}
                    className={cellClass}
                    style={{ textAlign: col.align || 'left' }}
                  >
                    {cellContent}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
