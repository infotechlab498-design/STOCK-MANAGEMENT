import React, { ReactNode } from 'react';

export interface StatCardProps {
  label: string;
  value: string | number;
  icon?: ReactNode;
  meta?: ReactNode;
  accent?: 'orange' | 'charcoal' | 'success' | 'transit';
  className?: string;
}

export const StatCard: React.FC<StatCardProps> = ({
  label,
  value,
  icon,
  meta,
  accent = 'charcoal',
  className = '',
}) => {
  return (
    <div className={`stat-card accent-${accent} ${className}`.trim()}>
      <div className="stat-header">
        <span className="stat-label">{label}</span>
        {icon && <div className="stat-icon">{icon}</div>}
      </div>
      <div className="stat-value">{value}</div>
      {meta && <div className="stat-meta">{meta}</div>}
    </div>
  );
};
