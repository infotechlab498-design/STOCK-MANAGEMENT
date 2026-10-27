import React, { ReactNode } from 'react';
import { Badge, BadgeVariant } from './Badge';

export interface StatusBadgeProps {
  status:
    | 'active'
    | 'inactive'
    | 'disabled'
    | 'posted'
    | 'pending'
    | 'approved'
    | 'rejected'
    | 'in-transit'
    | 'draft'
    | 'warning'
    | string;
  label?: string;
  children?: ReactNode;
  showDot?: boolean;
  className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  label,
  children,
  showDot = true,
  className = '',
}) => {
  const normalized = status.toLowerCase();
  let variant: BadgeVariant = 'neutral';

  switch (normalized) {
    case 'active':
    case 'posted':
    case 'approved':
    case 'success':
    case 'completed':
    case 'received':
      variant = 'success';
      break;

    case 'pending':
    case 'warning':
    case 'awaiting':
    case 'low-stock':
      variant = 'warning';
      break;

    case 'danger':
    case 'rejected':
    case 'disabled':
    case 'inactive':
    case 'cancelled':
    case 'critical':
      variant = 'danger';
      break;

    case 'in-transit':
    case 'intransit':
    case 'dispatched':
    case 'transit':
      variant = 'transit';
      break;

    case 'issue':
    case 'highlight':
    case 'action-required':
      variant = 'orange';
      break;

    case 'draft':
    case 'neutral':
    default:
      variant = 'neutral';
      break;
  }

  const displayText = children || label || status;

  return (
    <Badge variant={variant} showDot={showDot} className={className}>
      {displayText}
    </Badge>
  );
};
