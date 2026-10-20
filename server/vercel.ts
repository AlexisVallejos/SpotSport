// Función de Vercel: la misma API que main.ts, pero con una foto fija de los precios.
// Vercel no tiene disco persistente ni procesos que queden corriendo: no se vuelven a leer las
// tiendas y lo que se guarda (reseñas, newsletter, compras) vive en /tmp hasta que la función se recicla.
// Se arma con scripts/vercel-output.mjs.
import { cp, mkdir } from 'node:fs/promises';
import type { IncomingMessage, ServerResponse } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApi } from './app';

const SNAPSHOT = path.join(path.dirname(fileURLToPath(import.meta.url)), 'data');
const DATA_DIR = '/tmp/spot-data';

let ready: Promise<ReturnType<typeof createApi>> | null = null;
const boot = async () => {
  await mkdir(DATA_DIR, { recursive: true });
  await cp(SNAPSHOT, DATA_DIR, { recursive: true, force: false, errorOnExist: false });
  const api = createApi({ dataDir: DATA_DIR, refreshHours: Number.POSITIVE_INFINITY });
  await api.start();
  return api;
};

export default async function handler(request: IncomingMessage, response: ServerResponse) {
  ready ??= boot().catch((error) => {
    ready = null;
    throw error;
  });
  const api = await ready;
  // La ruta llega reescrita como /api?__path=/api/precios/…; se restituye la original.
  const url = new URL(request.url ?? '/', 'http://localhost');
  const original = url.searchParams.get('__path');
  if (original) {
    url.searchParams.delete('__path');
    request.url = original + (url.search || '');
  }
  return api.handle(request, response);
}
