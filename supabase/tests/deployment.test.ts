import { afterAll, beforeAll, expect, it } from 'vitest';
import { freshDb } from './harness';

let db: Awaited<ReturnType<typeof freshDb>>;
beforeAll(async () => { db = await freshDb(); }, 60_000);
afterAll(async () => { await db?.close(); });

it('mantiene RLS en todas las tablas de la aplicación desplegada', async () => {
  const r = await db.query<{ relrowsecurity: boolean }>(`select c.relrowsecurity from pg_class c
    join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('public','catalogo') and c.relkind='r'`);
  expect(r.rows).toHaveLength(23);
  expect(r.rows.every((x) => x.relrowsecurity)).toBe(true);
});

it('no expone triggers por RPC y fija su contexto de resolución', async () => {
  const r = await db.query<{ anon: boolean; usuario: boolean; proconfig: string[] }>(`select
    has_function_privilege('anon',p.oid,'execute') anon,
    has_function_privilege('authenticated',p.oid,'execute') usuario,p.proconfig
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname in
      ('touch_updated_at','guard_profile_update','guard_merchant_update','guard_product_write')`);
  expect(r.rows).toHaveLength(4);
  for (const row of r.rows) {
    expect(row.anon).toBe(false);
    expect(row.usuario).toBe(false);
    expect(row.proconfig).toContain('search_path=""');
  }
  const trigger = await db.query<{ acceso: boolean }>(`select has_function_privilege('anon',
    'public.handle_new_user()','execute') acceso`);
  expect(trigger.rows[0].acceso).toBe(false);
});
