import React, { ReactNode } from 'react';

export type BadgeVariant = 'success' | 'warning' | 'danger' | 'transit' | 'neutral' | 'orange';

export interface BadgeProps {
  variant?: BadgeVariant;
  children: ReactNode;
  showDot?: boolean;
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  variant = 'neutral',
  children,
  showDot = true,
  className = '',
}) => {
  return (
    <span className={`badge badge-${variant} ${className}`.trim()}>
      {showDot && <span className="badge-dot" aria-hidden="true" />}
      {children}
    </span>
  );
};
