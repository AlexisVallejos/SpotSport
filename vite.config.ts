import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // En desarrollo la API de precios corre aparte (npm run api).
  server: { proxy: { '/api': 'http://127.0.0.1:8787' } },
});
