import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {defineConfig} from 'vite';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
      port: 5173,
      // Discourage browsers from caching a broken SW during local Vite sessions.
      headers: {
        'Cache-Control': 'no-store',
      },
      proxy: {
        // Pin IPv4: Node resolves "localhost" to ::1 on Windows, which causes
        // ECONNREFUSED ::1:5080 when Kestrel is bound to 127.0.0.1 only.
        '/api': {
          target: 'http://127.0.0.1:5080',
          changeOrigin: true,
        },
        '/hubs': {
          target: 'http://127.0.0.1:5080',
          changeOrigin: true,
          ws: true,
        },
      },
    },
  };
});
