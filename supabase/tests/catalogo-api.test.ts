import { afterAll, beforeAll, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { asUser, freshDb, newUser } from './harness';
import { leerCSV } from '../../scripts/catalogo/csv';
import type { FilaCatalogo, ResultadoImportacion } from '../../shared/catalogo';

let db: Awaited<ReturnType<typeof freshDb>>;
let admin: string, ownerA: string, ownerB: string, customer: string, offer: string;
const A = '20000000-0000-4000-8000-000000000001';
const B = '20000000-0000-4000-8000-000000000002';
const CA = '10000000-0000-4000-8000-000000000001';
const CB = '10000000-0000-4000-8000-000000000002';
const file = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');
let row: FilaCatalogo;
async function count(uid: string | null = null) {
  return asUser(db, uid, async () => (await db.query<{ n: number }>('select count(*)::int n from public.catalogo_ofertas')).rows[0].n);
}
async function load(uid: string | null, source = A, filas: unknown = [row]) {
  return asUser(db, uid, async () => (await db.query<{ r: ResultadoImportacion }>(
    'select public.cargar_ofertas_catalogo($1,$2::jsonb,$3) r', [source, JSON.stringify(filas), 'test.csv'],
  )).rows[0].r);
}
async function moderate(published: boolean, until: string | null = null, uid = admin) {
  return asUser(db, uid, () => db.query('select public.moderar_oferta_catalogo($1,$2,$3)', [offer, published, until]));
}
async function config(uid: string, overrides: Record<string, unknown> = {}) {
  const values = { c: CA, f: A, nombre: 'SPOT Demo A', sitio: 'https://demo-a.invalid', estado: 'activo',
    fuente: 'CSV Demo A', tipo: 'csv', base: 'https://demo-a.invalid', permiso: true,
    evidencia: 'Dataset ficticio creado por el equipo', demo: true, ...overrides };
  return asUser(db, uid, () => db.query(`select public.configurar_fuente_catalogo($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) r`, Object.values(values)));
}

beforeAll(async () => {
  db = await freshDb();
  await db.exec(file('../seeds/catalogo_demo.sql'));
  admin = await newUser(db, 'admin@catalogo.test');
  ownerA = await newUser(db, 'a@catalogo.test');
  ownerB = await newUser(db, 'b@catalogo.test');
  customer = await newUser(db, 'cliente@catalogo.test');
  await db.query('update public.profiles set is_admin=true where id=$1', [admin]);
  for (const [commerce, user] of [[CA, ownerA], [CB, ownerB]]) {
    await asUser(db, admin, () => db.query(`select public.asignar_operador_catalogo($1,$2,'operador')`, [commerce, user]));
  }
  row = leerCSV(file('../../data/catalogo/demo-a.csv'))[0];
  offer = (await db.query<{ id: string }>('select id from catalogo.ofertas where fuente_id=$1 and codigo_externo=$2', [A, row.codigo_externo])).rows[0].id;
}, 60_000);
afterAll(async () => { await db?.close(); });

it('publica 40 DTO, precios decimales y orden numérico dentro de una variante/moneda', async () => {
  expect(await count()).toBe(40);
  await asUser(db, null, async () => {
    const r = await db.query(`select "ofertaId",precio,"esDemo","fechaActualizacion" from public.catalogo_ofertas
      where modelo='RUTA-01' and talle='42' and moneda='ARS' order by "precioOrden"`);
    expect(r.rows.map((x) => x.precio)).toEqual(['77000.00', '80000.00']);
    expect(r.rows.every((x) => x.esDemo === true && x.fechaActualizacion)).toBe(true);
    expect((await db.query('select * from public.catalogo_ofertas where categoria=$1', ['inexistente'])).rows).toEqual([]);
  });
});

it('ni el anónimo ni un cliente pueden escribir/importar ni leer columnas privadas', async () => {
  for (const user of [null, customer]) {
    await expect(load(user)).rejects.toThrow(/permission|permiso/);
    await expect(asUser(db, user, () => db.query('update catalogo.ofertas set publicada=true'))).rejects.toThrow(/permission/);
    await expect(asUser(db, user, () => db.query('select evidencia_permiso from catalogo.fuentes'))).rejects.toThrow(/permission/);
    await expect(asUser(db, user, () => db.query('select * from catalogo.importaciones'))).rejects.toThrow(/permission/);
    await expect(asUser(db, user, () => db.query('select public.importar_catalogo($1,$2::jsonb)', [A, '[]']))).rejects.toThrow(/permission/);
    await expect(asUser(db, user, () => db.query('delete from catalogo.historial_precios'))).rejects.toThrow(/permission/);
  }
});

it('ejecuta las tres consultas de defensa con permisos públicos', async () => {
  await asUser(db, null, async () => {
    const results = await db.exec(file('../queries/defensa_catalogo.sql'));
    expect(results[0].rows).toHaveLength(20);
    expect(results[1].rows).toHaveLength(1);
    expect(results[2].rows.map((x) => x.cantidad_ofertas)).toEqual([20, 20]);
  });
});

it('filtra gestión por membresía y niega escalada/carga cruzada', async () => {
  await asUser(db, ownerA, async () => {
    expect((await db.query('select * from public.catalogo_fuentes_gestion')).rows.map((x) => x.id)).toEqual([A]);
    expect((await db.query('select id from public.catalogo_ofertas_gestion')).rows).toHaveLength(20);
  });
  await asUser(db, customer, async () => expect((await db.query('select id from public.catalogo_ofertas_gestion')).rows).toEqual([]));
  await expect(load(ownerA, B)).rejects.toThrow(/permiso/);
  await expect(load(ownerB, A)).rejects.toThrow(/permiso/);
  await expect(moderate(true, null, ownerA)).rejects.toThrow(/administrador/);
  await expect(config(ownerA)).rejects.toThrow(/administrador/);
  await expect(asUser(db, ownerA, () => db.query(`select public.asignar_operador_catalogo($1,$2,'titular')`, [CB, ownerA]))).rejects.toThrow(/administrador/);
  await expect(asUser(db, ownerA, () => db.query('insert into catalogo.membresias values ($1,$2,$3)', [CB, ownerA, 'titular']))).rejects.toThrow(/permission/);
});

it('despublica una edición, conserva historial y solo un admin puede volver a aprobarla', async () => {
  const changed = { ...row, precio: '12345.67', fecha_observacion: '2026-10-12T00:00:00Z' };
  const r = await load(ownerA, A, [changed]);
  expect(r).toMatchObject({ ok: true, filas_aplicadas: 1 });
  expect(await count()).toBe(39);
  expect(await count(admin)).toBe(39); // La vista pública no filtra distinto para admin.
  const log = await db.query('select actor_id from catalogo.importaciones where id=$1', [r.importacion_id]);
  expect(log.rows[0].actor_id).toBe(ownerA);
  await asUser(db, null, async () => {
    expect((await db.query('select id from public.catalogo_historial where "ofertaId"=$1', [offer])).rows).toEqual([]);
    expect((await db.query('select id from catalogo.ofertas where id=$1', [offer])).rows).toEqual([]);
  });
  expect(await load(ownerA, A, [changed])).toMatchObject({ ok: true, filas_aplicadas: 0 });
  expect(await count()).toBe(39); // Repetir no saltea la moderación.
  await moderate(true);
  expect(await count()).toBe(40);
  await asUser(db, null, async () => {
    const history = await db.query('select precio from public.catalogo_historial where "ofertaId"=$1 order by fecha', [offer]);
    expect(history.rows.map((x) => x.precio)).toEqual([row.precio, '12345.67']);
  });
  // Incluso una carga técnica por service_role debe volver a moderarse.
  await db.exec('set role service_role');
  try {
    await db.query('select public.importar_catalogo($1,$2::jsonb)', [A, JSON.stringify([{ ...changed, fecha_observacion: '2026-10-12T01:00:00Z' }])]);
  } finally { await db.exec('reset role'); }
  expect(await count()).toBe(39);
  await moderate(true);
});

it('oculta vencidas, no disponibles, sin permiso y comercios suspendidos, incluso en el historial', async () => {
  await expect(moderate(true, '2026-10-12T02:00:00Z')).rejects.toThrow(/publicación/);
  expect(await count()).toBe(40); // Rechazo de aprobación vencida es atómico.
  await moderate(false);
  expect(await count()).toBe(39);
  await moderate(true);
  await db.query(`update catalogo.ofertas set vigente_hasta='2026-10-12T02:00:00Z' where id=$1`, [offer]);
  expect(await count()).toBe(39);
  await moderate(true);
  await config(admin, { estado: 'suspendido' });
  expect(await count()).toBe(20);
  await expect(moderate(true)).rejects.toThrow(/publicación/);
  await moderate(false); // Retirar una oferta no requiere fuente activa.
  await config(admin);
  expect(await count()).toBe(39);
  await moderate(true);
  await config(admin, { permiso: false, evidencia: '' });
  expect(await count()).toBe(20);
  expect(await load(ownerA)).toMatchObject({ ok: false });
  await config(admin);
  await load(ownerA, A, [{ ...row, fecha_observacion: '2026-10-12T03:00:00Z', disponible: false }]);
  await expect(moderate(true)).rejects.toThrow(/publicación/);
  expect(await count()).toBe(39);
});

it('rechaza precio inválido y revierte el lote con log persistente sin perder la aprobación anterior', async () => {
  const initial = await db.query('select count(*)::int n from catalogo.historial_precios');
  const result = await load(ownerB, B, [
    { ...row, url_producto: 'https://demo-b.invalid/productos/ruta-01', fecha_observacion: '2026-10-12T04:00:00Z' },
    { ...row, codigo_externo: 'INVALIDO', precio: '-1' },
  ]);
  expect(result).toMatchObject({ ok: false, filas_aplicadas: 0 });
  expect(await db.query('select count(*)::int n from catalogo.historial_precios')).toEqual(initial);
  expect(await count()).toBe(39);
});

it('admin da de alta fuentes, restringe orígenes/permiso y revoca operadores', async () => {
  await expect(config(admin, { base: 'https://otro.invalid' })).rejects.toThrow(/origen/);
  await expect(config(admin, { evidencia: '' })).rejects.toThrow(/check constraint/);
  const created = await config(admin, { c: null, f: null, nombre: 'Fuente nueva', sitio: 'https://nueva.invalid',
    base: 'https://nueva.invalid', demo: false, estado: 'pendiente', permiso: false, evidencia: '' });
  expect(created.rows[0].r).toHaveProperty('fuente_id');
  await asUser(db, admin, () => db.query('select public.asignar_operador_catalogo($1,$2,null)', [CA, ownerA]));
  await expect(load(ownerA)).rejects.toThrow(/permiso/);
  await asUser(db, ownerA, async () => expect((await db.query('select * from public.catalogo_fuentes_gestion')).rows).toEqual([]));
});

it('una oferta real exige revisión manual documentada y caducidad; una FK faltante no se acepta', async () => {
  const created = await config(admin, { c: null, f: null, nombre: 'Real prueba', sitio: 'https://real.test',
    base: 'https://real.test', demo: false, permiso: true, evidencia: 'Autorización ficticia para el test local' });
  const source = (created.rows[0].r as { fuente_id: string }).fuente_id;
  const r = await load(admin, source, [{ ...row, es_demo: false, url_producto: 'https://real.test/producto' }]);
  expect(r.ok).toBe(true);
  const real = (await db.query<{ id: string }>('select id from catalogo.ofertas where fuente_id=$1', [source])).rows[0].id;
  await expect(asUser(db, admin, () => db.query('select public.moderar_oferta_catalogo($1,true)', [real]))).rejects.toThrow(/revisión/);
  const until = new Date(Date.now() + 86400_000).toISOString();
  await asUser(db, admin, () => db.query('select public.moderar_oferta_catalogo($1,true,$2,$3)', [real, until, 'Enlace y precio revisados en prueba local, sin solicitud externa']));
  const approved = await db.query('select evidencia_revision,revisada_por from catalogo.ofertas where id=$1', [real]);
  expect(approved.rows[0].revisada_por).toBe(admin);
  await expect(db.query(`update catalogo.ofertas set variante_id='99999999-0000-4000-8000-000000000001' where id=$1`, [real])).rejects.toThrow(/identidad|foreign key|variante/);
  await expect(db.query(`insert into catalogo.fuentes(comercio_id,nombre,tipo,url_base)
    values ('99999999-0000-4000-8000-000000000001','Sin comercio','csv','https://sin.test')`)).rejects.toThrow(/foreign key/);
});
