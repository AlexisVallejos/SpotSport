import { defineConfig } from 'vite';

// Empaqueta la API de precios (server/main.ts) en un solo archivo para Node, sin node_modules.
export default defineConfig({
  publicDir: false,
  ssr: { noExternal: true },
  build: {
    ssr: 'server/main.ts',
    outDir: 'dist-server',
    emptyOutDir: true,
    target: 'node20',
    rollupOptions: { output: { entryFileNames: 'main.mjs' } },
  },
});
