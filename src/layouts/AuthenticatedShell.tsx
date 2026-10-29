import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { TopHeader } from './TopHeader';
import { useAuth } from '../app/useAuth';
import { isJwtTokenValid } from '../services/api/apiClient';
import { LoadingSpinner } from '../components/common/EmptyState';
import { ErrorBoundary } from '../components/common/ErrorBoundary';

/**
 * Shared authenticated chrome: Sidebar + TopHeader for every protected page.
 * Page-level errors stay inside main content so Sidebar remains usable.
 */
export const AuthenticatedShell: React.FC = () => {
  const { user, token, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div style={{ padding: '4rem', display: 'flex', justifyContent: 'center' }}>
        <LoadingSpinner label="Verifying authentication session..." />
      </div>
    );
  }

  if (!token || !user || !isJwtTokenValid(token)) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return (
    <div className="app-shell">
      <Sidebar />
      <div className="app-main">
        <TopHeader />
        <main className="app-content" id="main-content">
          <ErrorBoundary key={location.pathname} fallbackTitle="Page failed to render">
            <Outlet />
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
};
