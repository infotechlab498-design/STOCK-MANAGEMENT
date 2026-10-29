import React, { ReactNode } from 'react';
import { Breadcrumbs, BreadcrumbItem } from '../components/common/Breadcrumbs';
import { PageHeader } from '../components/common/PageHeader';
import { ContentContainer } from '../components/common/ContentContainer';

export interface AppLayoutProps {
  breadcrumbs?: BreadcrumbItem[];
  title?: ReactNode;
  description?: ReactNode;
  badge?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  maxWidth?: number | string;
  className?: string;
}

/**
 * Page content chrome (breadcrumbs / title / actions).
 * Sidebar and top header come from AuthenticatedShell so every route shares one nav.
 */
export const AppLayout: React.FC<AppLayoutProps> = ({
  breadcrumbs,
  title,
  description,
  badge,
  actions,
  children,
  maxWidth,
  className = '',
}) => {
  return (
    <ContentContainer maxWidth={maxWidth} className={className}>
      {breadcrumbs && breadcrumbs.length > 0 && <Breadcrumbs items={breadcrumbs} />}

      {(title || actions) && (
        <PageHeader title={title} description={description} badge={badge} actions={actions} />
      )}

      {children}
    </ContentContainer>
  );
};
