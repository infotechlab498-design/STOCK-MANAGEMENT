import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

/**
 * Dev / localhost: purge leftover service workers and block re-registration so
 * SPA routes (/material-issues, /stock, …) and /api proxy calls are never
 * intercepted by a FetchEvent that rejects with "Failed to fetch".
 */
async function clearBlockingServiceWorkers() {
  if (!('serviceWorker' in navigator)) return;

  const host = window.location.hostname;
  const isLocal =
    host === 'localhost' || host === '127.0.0.1' || host === '[::1]' || host.endsWith('.local');
  const isDev = import.meta.env.DEV;

  if (!isLocal && !isDev) return;

  try {
    // Prevent any late register() from tooling / PWA helpers.
    navigator.serviceWorker.register = async () =>
      ({
        unregister: async () => true,
        update: async () => undefined,
        active: null,
        installing: null,
        waiting: null,
        scope: `${window.location.origin}/`,
        addEventListener() {},
        removeEventListener() {},
        dispatchEvent: () => false,
        navigationPreload: {
          enable: async () => undefined,
          disable: async () => undefined,
          setHeaderValue: async () => undefined,
          getState: async () => undefined,
        },
        pushManager: {} as PushManager,
      }) as unknown as ServiceWorkerRegistration;

    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map((registration) => registration.unregister()));
    if (navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({ type: 'SKIP_WAITING' });
    }
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key)));
    }
  } catch (err) {
    console.warn('[StructStock] Failed to clear service workers', err);
  }
}

void clearBlockingServiceWorkers().finally(() => {
  createRoot(document.getElementById('root')!).render(<App />);
});
