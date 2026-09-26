import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  define: {
    __OPERATOR_BUILD__: JSON.stringify(false),
  },
  server: {
    port: 5173,
    proxy: {
      // Forward /api intact — Express mounts process routers at /api only (audit F23).
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
});
