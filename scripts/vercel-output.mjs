// Arma .vercel/output (Build Output API v3) para subir a Vercel ya construido:
//   npm run build && node scripts/vercel-output.mjs && npx vercel deploy --prebuilt --prod
// - static/: la web (dist/).
// - functions/api.func/: la API (server/vercel.ts) en un solo archivo + una foto fija de los precios.
// Ojo: no incluye compras.json ni suscriptores.json (datos de personas) y en Vercel los precios no se actualizan solos.
import { cp, mkdir, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { build } from 'vite';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const out = path.join(root, '.vercel/output');
const fn = path.join(out, 'functions/api.func');
const SNAPSHOT = ['tiendas-v2.json', 'historial.json', 'resenas.json'];

await stat(path.join(root, 'dist/index.html')).catch(() => {
  throw new Error('Falta dist/: corré primero npm run build');
});
await rm(out, { recursive: true, force: true });
await mkdir(fn, { recursive: true });

// 1. Web estática
await cp(path.join(root, 'dist'), path.join(out, 'static'), { recursive: true });

// 2. API en un solo .mjs, sin node_modules
await build({
  root,
  configFile: false,
  logLevel: 'warn',
  publicDir: false,
  ssr: { noExternal: true },
  build: {
    ssr: 'server/vercel.ts',
    outDir: fn,
    emptyOutDir: false,
    target: 'node22',
    rollupOptions: { output: { entryFileNames: 'index.mjs', format: 'es' } },
  },
});
await mkdir(path.join(fn, 'data'), { recursive: true });
for (const file of SNAPSHOT) {
  await cp(path.join(root, 'data', file), path.join(fn, 'data', file)).catch(() => console.warn(`(sin data/${file})`));
}
await writeFile(path.join(fn, 'package.json'), JSON.stringify({ type: 'module' }));
await writeFile(
  path.join(fn, '.vc-config.json'),
  JSON.stringify({ runtime: 'nodejs22.x', handler: 'index.mjs', launcherType: 'Nodejs', shouldAddHelpers: false, maxDuration: 30, memory: 1024 }, null, 2),
);

// 3. Rutas: /api/* → función; archivos tal cual; el resto (rutas de React) → index.html
const security = { 'x-content-type-options': 'nosniff', 'referrer-policy': 'strict-origin-when-cross-origin' };
await writeFile(
  path.join(out, 'config.json'),
  JSON.stringify(
    {
      version: 3,
      routes: [
        { src: '^/assets/(.*)$', headers: { 'cache-control': 'public, max-age=31536000, immutable', ...security }, continue: true },
        { src: '^/.*\\.(mp4|webm|jpg|jpeg|png|webp|avif|gif|svg|ico|ttf|woff2?|wasm|task|wav|mp3)$', headers: { 'cache-control': 'public, max-age=604800', ...security }, continue: true },
        { src: '^/healthz$', dest: '/api?__path=/api/salud' },
        { src: '^(/api/.*)$', dest: '/api?__path=$1' },
        { handle: 'filesystem' },
        // Un archivo que no existe (con extensión) es 404, no la página.
        { src: '^/.*\\.[a-zA-Z0-9]+$', status: 404, dest: '/404-no-existe' },
        { src: '^/(.*)$', dest: '/index.html', headers: { 'cache-control': 'no-cache', ...security } },
      ],
    },
    null,
    2,
  ),
);
console.log('Listo: .vercel/output');
