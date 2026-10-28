import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './app/AuthContext';
import { NavigationProvider } from './app/NavigationContext';
import { RealtimeProvider } from './app/RealtimeContext';
import { AppRoutes } from './routes/AppRoutes';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <RealtimeProvider>
          <NavigationProvider>
            <AppRoutes />
          </NavigationProvider>
        </RealtimeProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
