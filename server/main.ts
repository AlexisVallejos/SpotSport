// API de precios de SPOT. En producción corre detrás de nginx (ver nginx.conf): nginx sirve la web y le pasa /api/.
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import path from 'node:path';
import { parseQuery } from './precios/search';
import { PriceService } from './precios/service';

const PORT = Number(process.env.PORT ?? 8787);
const HOST = process.env.HOST ?? '127.0.0.1';

const service = new PriceService({
  dataDir: path.resolve(process.env.DATA_DIR ?? 'data'),
  refreshHours: Number(process.env.PRICE_REFRESH_HOURS ?? 6),
  delayMs: Number(process.env.PRICE_DELAY_MS ?? 1500),
  userAgent: process.env.PRICE_USER_AGENT ?? 'Mozilla/5.0 (compatible; SPOTPrecios/1.0; comparador de precios de zapatillas)',
});

const PRODUCT = /^\/api\/precios\/([a-z0-9-]{3,80})$/;
const REVIEWS = /^\/api\/precios\/([a-z0-9-]{3,80})\/resenas$/;
const REVIEWS_PER_HOUR = 5;
const posted = new Map<string, number[]>();

function send(response: ServerResponse, status: number, body: unknown, cache = 'no-cache') {
  const json = typeof body === 'string' ? body : JSON.stringify(body);
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': cache });
  response.end(json);
}

function clientIp(request: IncomingMessage) {
  const forwarded = request.headers['x-forwarded-for'];
  return (Array.isArray(forwarded) ? forwarded[0] : forwarded)?.split(',')[0].trim() || request.socket.remoteAddress || 'desconocido';
}

/** Hasta cinco reseñas por hora desde la misma conexión. */
function allowReview(ip: string) {
  const hourAgo = Date.now() - 60 * 60 * 1000;
  const recent = (posted.get(ip) ?? []).filter((time) => time > hourAgo);
  if (recent.length >= REVIEWS_PER_HOUR) return false;
  posted.set(ip, [...recent, Date.now()]);
  return true;
}

async function readBody(request: IncomingMessage, limit = 4096): Promise<unknown> {
  let size = 0;
  const parts: Buffer[] = [];
  for await (const part of request) {
    size += (part as Buffer).length;
    if (size > limit) throw new Error('demasiado grande');
    parts.push(part as Buffer);
  }
  return JSON.parse(Buffer.concat(parts).toString('utf8'));
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url ?? '/', 'http://localhost');
  const { pathname } = url;
  try {
    if (request.method === 'GET' && pathname === '/api/precios') return send(response, 200, service.statusJson, 'public, max-age=30');
    if (request.method === 'GET' && pathname === '/api/precios/buscar') return send(response, 200, service.search(parseQuery(url.searchParams)), 'public, max-age=30');

    const product = PRODUCT.exec(pathname);
    if (request.method === 'GET' && product) {
      const detail = service.detail(product[1]);
      return detail ? send(response, 200, detail) : send(response, 404, { error: 'No encontramos ese producto.' });
    }

    const reviews = REVIEWS.exec(pathname);
    if (request.method === 'GET' && reviews) {
      const found = await service.storeReviews(reviews[1]);
      return found ? send(response, 200, found, 'public, max-age=600') : send(response, 404, { error: 'No encontramos ese producto.' });
    }
    if (request.method === 'POST' && reviews) {
      if (!service.has(reviews[1])) return send(response, 404, { error: 'No encontramos ese producto.' });
      if (!allowReview(clientIp(request))) return send(response, 429, { error: 'Ya dejaste varias reseñas. Probá de nuevo en un rato.' });
      const result = await service.addReview(reviews[1], await readBody(request).catch(() => null));
      return typeof result === 'string' ? send(response, 400, { error: result }) : send(response, 201, result);
    }

    if (pathname === '/api/salud') return send(response, 200, { ok: true });
    send(response, 404, { error: 'No existe.' });
  } catch (error) {
    console.error('[api]', error);
    send(response, 500, { error: 'Algo falló de nuestro lado.' });
  }
});

server.listen(PORT, HOST, () => console.log(`[api] escuchando en http://${HOST}:${PORT}`));
void service.start();
