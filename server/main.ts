// API de precios de SPOT. En producción corre detrás de nginx (ver nginx.conf): nginx sirve la web y le pasa /api/.
import { createServer } from 'node:http';
import path from 'node:path';
import { createApi } from './app';

const PORT = Number(process.env.PORT ?? 8787);
const HOST = process.env.HOST ?? '127.0.0.1';

const api = createApi({
  dataDir: path.resolve(process.env.DATA_DIR ?? 'data'),
  refreshHours: Number(process.env.PRICE_REFRESH_HOURS ?? 6),
});

createServer(api.handle).listen(PORT, HOST, () => console.log(`[api] escuchando en http://${HOST}:${PORT}`));
void api.start();
