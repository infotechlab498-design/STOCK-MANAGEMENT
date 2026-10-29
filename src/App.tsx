import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './app/AuthProvider';
import { NavigationProvider } from './app/NavigationContext';
import { RealtimeProvider } from './app/RealtimeProvider';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { AppRoutes } from './routes/AppRoutes';

export default function App() {
  return (
    <BrowserRouter>
      <ErrorBoundary fallbackTitle="Application error">
        <AuthProvider>
          <RealtimeProvider>
            <NavigationProvider>
              <AppRoutes />
            </NavigationProvider>
          </RealtimeProvider>
        </AuthProvider>
      </ErrorBoundary>
    </BrowserRouter>
  );
}
