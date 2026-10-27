import React, { ReactNode } from 'react';
import { Sidebar } from './Sidebar';
import { TopHeader } from './TopHeader';
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
    <div className={`app-shell ${className}`.trim()}>
      <Sidebar />
      <div className="app-main">
        <TopHeader />
        <main className="app-content" id="main-content">
          <ContentContainer maxWidth={maxWidth}>
            {breadcrumbs && breadcrumbs.length > 0 && (
              <Breadcrumbs items={breadcrumbs} />
            )}

            {(title || actions) && (
              <PageHeader
                title={title}
                description={description}
                badge={badge}
                actions={actions}
              />
            )}

            {children}
          </ContentContainer>
        </main>
      </div>
    </div>
  );
};
