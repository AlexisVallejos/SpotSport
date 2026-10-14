import { readFileSync } from 'node:fs';
import { basename } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { leerCSV } from './catalogo/csv';

type Resultado = { ok: boolean; importacion_id: string; filas_aplicadas: number; error?: string };

async function main() {
  const args = process.argv.slice(2);
  const local = args[0] === '--local';
  if (local) args.shift();
  if (args.length !== 2 || !/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(args[0])) {
    throw new Error('Uso: npm run catalogo:importar -- [--local] FUENTE_UUID archivo.csv');
  }
  const [fuente, archivo] = args;
  const filas = leerCSV(readFileSync(archivo, 'utf8'));
  let resultado: Resultado;
  if (local) {
    // Reutiliza el Postgres aislado de pruebas: nunca toca una base remota.
    const { freshDb } = await import('../supabase/tests/harness');
    const db = await freshDb();
    try {
      await db.exec(readFileSync(new URL('../supabase/seeds/catalogo_demo.sql', import.meta.url), 'utf8'));
      const r = await db.query<{ resultado: Resultado }>(
        'select public.importar_catalogo($1::uuid, $2::jsonb, $3) as resultado',
        [fuente, JSON.stringify(filas), basename(archivo)],
      );
      resultado = r.rows[0].resultado;
      const conteo = await db.query('select count(*) as ofertas from catalogo.ofertas');
      console.log('Modo local temporal; ofertas en la base:', conteo.rows[0].ofertas);
    } finally { await db.close(); }
  } else {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new Error('Configurar SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en la terminal, o usar --local.');
    const cliente = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data, error } = await cliente.rpc('importar_catalogo', {
      p_fuente: fuente, p_filas: filas, p_archivo: basename(archivo),
    });
    if (error) throw new Error(`No se pudo llamar al importador (${error.code ?? 'sin código'}). Revisar migraciones y permisos.`);
    resultado = data as Resultado;
  }
  console.log(JSON.stringify(resultado, null, 2));
  if (!resultado.ok) process.exitCode = 1;
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'Error de importación.');
  process.exitCode = 1;
});
