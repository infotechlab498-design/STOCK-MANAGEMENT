import React, { ReactNode } from 'react';
import { AlertCircle, RefreshCw, PackageOpen } from 'lucide-react';
import { Button } from './Button';

export interface LoadingStateProps {
  label?: string;
  className?: string;
}

export const LoadingState: React.FC<LoadingStateProps> = ({
  label = 'Loading data...',
  className = '',
}) => {
  return (
    <div
      className={`empty-state ${className}`.trim()}
      style={{ padding: 'var(--space-10) var(--space-6)' }}
    >
      <span className="loading-spinner" />
      <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-subtle)' }}>
        {label}
      </span>
    </div>
  );
};

export interface EmptyStateViewProps {
  icon?: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
  className?: string;
}

export const EmptyStateView: React.FC<EmptyStateViewProps> = ({
  icon,
  title,
  description,
  action,
  className = '',
}) => {
  return (
    <div className={`empty-state ${className}`.trim()}>
      <div className="empty-state-icon">
        {icon || <PackageOpen size={24} />}
      </div>
      <div className="empty-state-title">{title}</div>
      <div className="empty-state-text">{description}</div>
      {action && <div style={{ marginTop: 'var(--space-3)' }}>{action}</div>}
    </div>
  );
};

export interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  className?: string;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  title = 'Unable to Load Information',
  message = 'An unexpected network error occurred while communicating with the server.',
  onRetry,
  className = '',
}) => {
  return (
    <div className={`error-state ${className}`.trim()} role="alert">
      <div className="error-state-icon">
        <AlertCircle size={24} />
      </div>
      <div className="empty-state-title" style={{ color: 'var(--color-charcoal-900)' }}>
        {title}
      </div>
      <div className="empty-state-text">
        {message}
      </div>
      {onRetry && (
        <Button
          variant="secondary"
          size="sm"
          icon={<RefreshCw size={14} />}
          onClick={onRetry}
          style={{ marginTop: 'var(--space-2)' }}
        >
          Try Again
        </Button>
      )}
    </div>
  );
};
