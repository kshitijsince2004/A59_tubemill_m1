import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  // Operator APK: no PWA service worker — Capacitor owns the shell.
  define: {
    __OPERATOR_BUILD__: JSON.stringify(true),
  },
  build: {
    outDir: 'dist-operator',
    emptyOutDir: true,
    rollupOptions: {
      input: path.resolve(__dirname, 'operator.html'),
    },
  },
  server: {
    port: 5174,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
});
