import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [react()],
      define: {
        // 🔒 Security Fix: Use backend API endpoint instead of exposing API key
        'process.env': {},
        'process.env.API_ENDPOINT': JSON.stringify(env.API_ENDPOINT || 'http://localhost:8787'),
        'global': {},
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});