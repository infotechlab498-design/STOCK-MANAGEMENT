import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './app/AuthContext';
import { NavigationProvider } from './app/NavigationContext';
import { AppRoutes } from './routes/AppRoutes';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <NavigationProvider>
          <AppRoutes />
        </NavigationProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
