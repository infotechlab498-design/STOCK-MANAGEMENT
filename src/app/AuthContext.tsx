/**
 * Compatibility re-exports.
 * Prefer importing AuthProvider from './AuthProvider' and useAuth from './useAuth'
 * so Vite Fast Refresh stays compatible.
 */
export { AuthProvider } from './AuthProvider';
export { useAuth } from './useAuth';
export type { AuthContextType } from './auth-context';
