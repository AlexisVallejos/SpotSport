import { afterAll, beforeAll, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { asUser, freshDb } from './harness';

let db: Awaited<ReturnType<typeof freshDb>>;
const file = (ruta: string) => readFileSync(new URL(ruta, import.meta.url), 'utf8');

beforeAll(async () => {
  db = await freshDb();
  await db.exec(file('../seeds/catalogo_demo.sql'));
  await db.exec(file('../seeds/tienda_demo.sql'));
}, 60_000);
afterAll(async () => { await db?.close(); });

it('un visitante sin sesión ve los 20 productos demo con precio y categoría', async () => {
  const r = await asUser(db, null, () => db.query<{ name: string; slug: string | null; price_cents: number }>(`
    select p.name, c.slug, v.price_cents from public.products p
    left join public.categories c on c.id = p.category_id
    join public.product_variants v on v.product_id = p.id`));
  expect(r.rows).toHaveLength(20);
  expect(r.rows.every((x) => x.slug && x.price_cents > 0)).toBe(true);
});

it('usa la oferta más baja del catálogo como precio', async () => {
  const r = await db.query<{ price_cents: number }>(`select v.price_cents from public.product_variants v
    join public.products p on p.id = v.product_id where p.name = 'Zapatilla Ruta (demo)'`);
  expect(r.rows[0].price_cents).toBe(7_700_000);
});

it('destaca uno por categoría y no duplica si se ejecuta otra vez', async () => {
  await db.exec(file('../seeds/tienda_demo.sql'));
  const r = await db.query<{ total: number; destacados: number }>(`select count(*)::int total,
    count(*) filter (where featured)::int destacados from public.products`);
  expect(r.rows[0]).toEqual({ total: 20, destacados: 5 });
});
