import React from 'react';
import { ChevronRight } from 'lucide-react';

export interface BreadcrumbItem {
  label: string;
  onClick?: () => void;
  active?: boolean;
}

export interface BreadcrumbsProps {
  items: BreadcrumbItem[];
}

export const Breadcrumbs: React.FC<BreadcrumbsProps> = ({ items }) => {
  return (
    <nav aria-label="Breadcrumb" className="breadcrumbs">
      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        return (
          <span key={index} className="breadcrumb-item">
            {item.onClick && !isLast ? (
              <button
                type="button"
                onClick={item.onClick}
                className="breadcrumb-link"
              >
                {item.label}
              </button>
            ) : (
              <span className={isLast ? 'breadcrumb-current' : 'breadcrumb-link'}>
                {item.label}
              </span>
            )}
            {!isLast && (
              <ChevronRight
                className="breadcrumb-separator"
                size={14}
                aria-hidden="true"
              />
            )}
          </span>
        );
      })}
    </nav>
  );
};
