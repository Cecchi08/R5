import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  plugins: [react()],
  publicDir: fileURLToPath(new URL('../frontend/public', import.meta.url)),
  resolve: { dedupe: ['react', 'react-dom'] },
  server: { port: 5174, strictPort: true },
});
