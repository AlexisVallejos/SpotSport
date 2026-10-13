import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { freshDb, asUser } from './harness';
import { leerCSV, type FilaCatalogo } from '../../scripts/catalogo/csv';

let db: Awaited<ReturnType<typeof freshDb>>;
const A = '20000000-0000-4000-8000-000000000001';
const B = '20000000-0000-4000-8000-000000000002';
let muestra: FilaCatalogo;
type Resultado = { ok: boolean; filas_aplicadas: number; importacion_id: string; error?: string };
const file = (ruta: string) => readFileSync(new URL(ruta, import.meta.url), 'utf8');
async function cargar(filas: unknown, fuente = A) {
  return (await db.query<{ resultado: Resultado }>(
    'select public.importar_catalogo($1::uuid, $2::jsonb, $3) as resultado',
    [fuente, JSON.stringify(filas), 'prueba.csv'],
  )).rows[0].resultado;
}
async function conteos() {
  return (await db.query(`select
    (select count(*)::int from catalogo.productos) productos,
    (select count(*)::int from catalogo.variantes) variantes,
    (select count(*)::int from catalogo.ofertas) ofertas,
    (select count(*)::int from catalogo.historial_precios) historial`)).rows[0];
}

beforeAll(async () => {
  db = await freshDb();
  await db.exec(file('../seeds/catalogo_demo.sql'));
  muestra = leerCSV(file('../../data/catalogo/demo-a.csv'))[0];
}, 60_000);
afterAll(async () => { await db?.close(); });

describe('3.1 y 3.2: esquema y demo', () => {
  it('carga veinte artículos y cuarenta ofertas de variantes equivalentes', async () => {
    expect(await conteos()).toEqual({ productos: 20, variantes: 20, ofertas: 40, historial: 40 });
    const r = await db.query<{ variantes: number }>(`select count(*)::int variantes from
      (select variante_id from catalogo.ofertas group by variante_id having count(distinct fuente_id) = 2) x`);
    expect(r.rows[0].variantes).toBe(20);
    const fuentes = await db.query('select es_demo, evidencia_permiso from catalogo.fuentes');
    expect(fuentes.rows).toHaveLength(2);
    expect(fuentes.rows.every((x) => x.es_demo === true && String(x.evidencia_permiso).includes('ficticio'))).toBe(true);
  });
  it('las dos fixtures CSV reproducen el seed sin duplicar datos', async () => {
    for (const [fuente, ruta] of [[A, '../../data/catalogo/demo-a.csv'], [B, '../../data/catalogo/demo-b.csv']]) {
      expect(await cargar(leerCSV(file(ruta)), fuente)).toMatchObject({ ok: true, filas_aplicadas: 0 });
    }
    await db.exec(file('../seeds/catalogo_demo.sql'));
    expect(await conteos()).toEqual({ productos: 20, variantes: 20, ofertas: 40, historial: 40 });
  });
  it('las FK y la unicidad protegen las relaciones', async () => {
    await expect(db.query(`insert into catalogo.variantes (producto_id) values ('99999999-0000-4000-8000-000000000001')`)).rejects.toThrow(/foreign key/);
    await expect(db.query(`insert into catalogo.variantes (producto_id,talle,color)
      select producto_id,talle,color from catalogo.variantes limit 1`)).rejects.toThrow(/unique/);
  });
});

describe('3.3: importaciones controladas', () => {
  it('rechaza duplicados de un lote sin escribir datos', async () => {
    expect(await cargar([muestra, muestra])).toMatchObject({ ok: false, filas_aplicadas: 0 });
  });
  it.each([
    ['precio', '-1'], ['precio', 'NaN'], ['precio', '10.123'], ['precio', '100,50'],
    ['url_producto', 'javascript:alert(1)'], ['url_producto', 'https://demo-a.invalid.evil.test/producto'],
    ['url_producto', 'https://otro.invalid/producto'], ['moneda', 'XYZ'],
    ['fecha_observacion', '2026-99-99T00:00:00Z'], ['fecha_observacion', '2026-10-11'],
    ['fecha_observacion', '2999-01-01T00:00:00Z'],
    ['es_demo', false], ['disponible', 'sí'], ['nombre', ''],
  ])('rechaza %s = %s y conserva el estado previo', async (campo, valor) => {
    const antes = await conteos();
    const resultado = await cargar([{ ...muestra, [campo]: valor, codigo_externo: 'INVALIDO' }]);
    expect(resultado.ok).toBe(false);
    expect(await conteos()).toEqual(antes);
    const log = await db.query(`select estado, filas_aplicadas, detalle from catalogo.importaciones where id = $1`, [resultado.importacion_id]);
    expect(log.rows[0]).toMatchObject({ estado: 'error', filas_aplicadas: 0 });
    expect(log.rows[0].detalle).toBeTruthy();
  });
  it('revierte la primera fila si falla la segunda, incluido el historial', async () => {
    const antes = await conteos();
    const futuro = { ...muestra, precio: '12345.67', fecha_observacion: '2026-10-12T00:00:00Z' };
    const resultado = await cargar([futuro, { ...futuro, codigo_externo: 'OTRO', precio: '-1' }]);
    expect(resultado.ok).toBe(false);
    expect(await conteos()).toEqual(antes);
    const oferta = await db.query(`select precio::text from catalogo.ofertas where fuente_id = $1 and codigo_externo = $2`, [A, muestra.codigo_externo]);
    expect(oferta.rows[0].precio).toBe(muestra.precio);
  });
  it('actualiza precio e historial juntos, y no duplica al repetir', async () => {
    const nueva = { ...muestra, precio: '12345.67', fecha_observacion: '2026-10-12T00:00:00Z' };
    expect(await cargar([nueva])).toMatchObject({ ok: true, filas_aplicadas: 1 });
    expect(await cargar([nueva])).toMatchObject({ ok: true, filas_aplicadas: 0 });
    expect(await conteos()).toEqual({ productos: 20, variantes: 20, ofertas: 40, historial: 41 });
    const r = await db.query(`select h.precio::text, h.moneda from catalogo.historial_precios h
      join catalogo.ofertas o on o.id = h.oferta_id where o.fuente_id = $1 and o.codigo_externo = $2
      order by h.fecha_observacion`, [A, muestra.codigo_externo]);
    expect(r.rows.map((x) => x.precio)).toEqual([muestra.precio, '12345.67']);
    const fuente = await db.query('select ultima_sincronizacion from catalogo.fuentes where id = $1', [A]);
    expect(fuente.rows[0].ultima_sincronizacion).toBeTruthy();
  });
  it('rechaza datos viejos, misma fecha con precio distinto y cambios de identidad', async () => {
    for (const fila of [muestra,
      { ...muestra, precio: '99.99', fecha_observacion: '2026-10-12T00:00:00Z' },
      { ...muestra, talle: 'OTRO', fecha_observacion: '2026-10-12T00:00:01Z' },
    ]) expect((await cargar([fila])).ok).toBe(false);
    expect((await conteos()).historial).toBe(41);
  });
  it('distingue talles diferentes como variantes diferentes', async () => {
    const nueva = { ...muestra, talle: '44', codigo_externo: 'OTRO-TALLE' };
    expect(await cargar([nueva])).toMatchObject({ ok: true, filas_aplicadas: 1 });
    expect(await conteos()).toMatchObject({ productos: 20, variantes: 21, ofertas: 41 });
  });
  it('rechaza fuentes inexistentes/sin permiso y comercios suspendidos', async () => {
    expect((await cargar([muestra], '99999999-0000-4000-8000-000000000001')).ok).toBe(false);
    await db.query('update catalogo.fuentes set permiso_verificado = false where id = $1', [A]);
    expect((await cargar([muestra])).ok).toBe(false);
    await db.query('update catalogo.fuentes set permiso_verificado = true where id = $1', [A]);
    await db.query(`update catalogo.comercios set estado = 'suspendido' where id = '10000000-0000-4000-8000-000000000001'`);
    expect((await cargar([muestra])).ok).toBe(false);
    await db.query(`update catalogo.comercios set estado = 'activo' where id = '10000000-0000-4000-8000-000000000001'`);
  });
  it('no expone el importador ni las tablas al navegador', async () => {
    await expect(asUser(db, null, () => cargar([muestra]))).rejects.toThrow(/permission denied/);
    await expect(asUser(db, null, () => db.query('select * from catalogo.ofertas'))).rejects.toThrow(/permission denied/);
    await expect(asUser(db, '11111111-0000-4000-8000-000000000001', () => cargar([muestra]))).rejects.toThrow(/permission denied/);
    await db.exec('set role service_role');
    try {
      expect((await cargar([muestra], B)).ok).toBe(false); // URL de A no corresponde a B.
      const filaB = leerCSV(file('../../data/catalogo/demo-b.csv'))[0];
      expect(await cargar([filaB], B)).toMatchObject({ ok: true, filas_aplicadas: 0 });
    } finally { await db.exec('reset role'); }
  });
  it.each([[], {}, null])('rechaza lotes vacíos o que no son listas (%s)', async (entrada) => {
    const antes = await conteos();
    expect(await cargar(entrada)).toMatchObject({ ok: false, filas_aplicadas: 0 });
    expect(await conteos()).toEqual(antes);
  });
});
