// Postgres real (PGlite, en WASM) con lo mínimo de Supabase simulado: roles, auth.uid(), auth.users y storage.
// Corre las migraciones tal cual están en supabase/migrations.
import { PGlite } from '@electric-sql/pglite';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const MIGRATIONS = fileURLToPath(new URL('../migrations/', import.meta.url));

const SUPABASE_STUBS = `
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin;

  create schema auth;
  create table auth.users (
    id uuid primary key default gen_random_uuid(),
    email text,
    raw_user_meta_data jsonb not null default '{}'::jsonb
  );
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
  $$;

  create schema storage;
  create table storage.buckets (id text primary key, name text not null, public boolean not null default false);
  create table storage.objects (
    id uuid primary key default gen_random_uuid(),
    bucket_id text not null references storage.buckets (id),
    name text not null,
    owner uuid
  );
  alter table storage.objects enable row level security;
  create function storage.foldername(name text) returns text[] language sql immutable as $$
    select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1]
  $$;

  grant usage on schema public, auth, storage to anon, authenticated;
  grant select on auth.users to authenticated;
  grant all on storage.buckets, storage.objects to anon, authenticated;
  alter default privileges in schema public grant all on tables to anon, authenticated;
  alter default privileges in schema public grant all on sequences to anon, authenticated;
`;

export type World = ReturnType<typeof makeWorld> extends Promise<infer T> ? T : never;

export async function freshDb(): Promise<PGlite> {
  const db = new PGlite();
  await db.exec(SUPABASE_STUBS);
  for (const file of readdirSync(MIGRATIONS).filter((name) => name.endsWith('.sql')).sort()) {
    await db.exec(readFileSync(join(MIGRATIONS, file), 'utf8'));
  }
  return db;
}

/** Ejecuta `fn` como una sesión de esa cuenta (o sin sesión si `uid` es null). */
export async function asUser<T>(db: PGlite, uid: string | null, fn: () => Promise<T>): Promise<T> {
  await db.exec(`reset role; select set_config('request.jwt.claim.sub', '${uid ?? ''}', false); set role ${uid ? 'authenticated' : 'anon'};`);
  try {
    return await fn();
  } finally {
    await db.exec(`reset role; select set_config('request.jwt.claim.sub', '', false);`);
  }
}

export async function newUser(db: PGlite, email: string, fullName = ''): Promise<string> {
  const result = await db.query<{ id: string }>(
    `insert into auth.users (email, raw_user_meta_data) values ($1, jsonb_build_object('full_name', $2::text)) returning id`,
    [email, fullName],
  );
  return result.rows[0].id;
}

/** Un escenario base: un admin, un cliente, dos comercios aprobados con un producto cada uno y uno pendiente. */
export async function makeWorld() {
  const db = await freshDb();
  const admin = await newUser(db, 'admin@spot.test', 'Admin');
  await db.query(`update public.profiles set is_admin = true where id = $1`, [admin]);
  const customer = await newUser(db, 'cliente@spot.test', 'Cliente');
  const ownerA = await newUser(db, 'a@spot.test', 'Dueña A');
  const ownerB = await newUser(db, 'b@spot.test', 'Dueño B');
  const ownerPending = await newUser(db, 'p@spot.test', 'Dueño Pendiente');

  const merchant = async (owner: string, name: string, slug: string, status: string) =>
    (await db.query<{ id: string }>(
      `insert into public.merchants (owner_id, name, slug, status) values ($1, $2, $3, $4::public.merchant_status) returning id`,
      [owner, name, slug, status],
    )).rows[0].id;
  const merchantA = await merchant(ownerA, 'Running Shop', 'running-shop', 'approved');
  const merchantB = await merchant(ownerB, 'Fútbol Total', 'futbol-total', 'approved');
  const merchantPending = await merchant(ownerPending, 'Nuevo Comercio', 'nuevo-comercio', 'pending');

  const category = (await db.query<{ id: string }>(`select id from public.categories where slug = 'running'`)).rows[0].id;

  const product = async (merchantId: string, name: string, price: number, stock: number) => {
    const p = (await db.query<{ id: string }>(
      `insert into public.products (merchant_id, category_id, name) values ($1, $2, $3) returning id`,
      [merchantId, category, name],
    )).rows[0].id;
    const v = (await db.query<{ id: string }>(
      `insert into public.product_variants (product_id, size, color, price_cents, stock) values ($1, '42', 'Negro', $2, $3) returning id`,
      [p, price, stock],
    )).rows[0].id;
    return { product: p, variant: v };
  };
  const a = await product(merchantA, 'Zapatilla Ruta', 10000, 5);
  const b = await product(merchantB, 'Botín Cancha', 25000, 3);
  const pending = await product(merchantPending, 'Producto Oculto', 5000, 9);

  return { db, admin, customer, ownerA, ownerB, ownerPending, merchantA, merchantB, merchantPending, category, a, b, pending, product };
}
