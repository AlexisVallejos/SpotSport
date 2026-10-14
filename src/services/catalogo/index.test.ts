import { beforeEach, expect, it, vi } from 'vitest';

const { fetcher, guardMock } = vi.hoisted(() => ({ fetcher: vi.fn(), guardMock: vi.fn() }));
vi.mock('../../lib/supabase', async () => {
  const { createClient } = await import('@supabase/supabase-js');
  return {
    supabase: createClient('https://catalogo.test', 'public-test-key', {
      global: { fetch: fetcher }, auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    }),
    guard: guardMock,
    fail: (error: { message: string }) => { throw new Error(error.message); },
  };
});
import { historialPrecios, listarOfertas } from './index';
import { asignarOperador, cargarOfertas, configurarFuente, listarFuentesGestion, listarOfertasGestion, moderarOferta } from './gestion';

const id = '10000000-0000-4000-8000-000000000001';
beforeEach(() => {
  fetcher.mockReset();
  guardMock.mockReset();
  fetcher.mockImplementation(async () => new Response('[]', { headers: { 'Content-Type': 'application/json' } }));
});
const url = () => new URL(String(fetcher.mock.calls[0][0]));

it('usa la clave pública y excluye demo por defecto, sin campos auxiliares en el DTO', async () => {
  expect(await listarOfertas()).toEqual([]);
  expect(url().pathname).toBe('/rest/v1/catalogo_ofertas');
  expect(url().searchParams.get('esDemo')).toBe('eq.false');
  expect(url().searchParams.get('select')).toContain('precio,moneda');
  expect(url().searchParams.get('select')).not.toMatch(/precioOrden|busqueda/);
  expect(url().searchParams.get('order')).toBe('varianteId.asc,moneda.asc,precioOrden.asc,fechaActualizacion.desc,ofertaId.asc');
});

it('construye filtros y paginación con el SDK real, conservando precisión decimal', async () => {
  await listarOfertas({ incluirDemo: true, texto: 'ruta,modelo.eq.x', varianteId: id, comercioId: id,
    marca: ' SPOT Demo ', categoria: ' Running ', talle: ' unico ', moneda: 'ARS',
    precioMin: '0.00', precioMax: '9999999999.99', limite: 20, desde: 40 });
  const params = url().searchParams;
  expect(params.has('esDemo')).toBe(false);
  expect(params.get('busqueda')).toBe('ilike.%ruta,modelo.eq.x%');
  expect(params.has('or')).toBe(false);
  expect(params.get('marca')).toBe('eq.spot demo');
  expect(params.get('categoria')).toBe('eq.running');
  expect(params.get('talle')).toBe('eq.UNICO');
  expect(params.get('varianteId')).toBe(`eq.${id}`);
  expect(params.getAll('precioOrden')).toEqual(['gte.0.00', 'lte.9999999999.99']);
  expect(params.get('offset')).toBe('40');
  expect(params.get('limit')).toBe('20');
});

it('no interpreta comodines ingresados como filtros adicionales', async () => {
  await listarOfertas({ texto: '100%_*' });
  expect(url().searchParams.get('busqueda')).toBe('ilike.%100\\%\\_\\*%');
});

it.each([
  { limite: 0 }, { limite: 201 }, { desde: -1 }, { desde: 1.5 }, { varianteId: 'x' },
  { precioMin: '-1', moneda: 'ARS' as const }, { precioMax: 'NaN', moneda: 'ARS' as const },
  { precioMin: '1.234', moneda: 'ARS' as const }, { precioMin: '1' },
  { precioMin: '100', precioMax: '20', moneda: 'ARS' as const }, { texto: 'x'.repeat(121) },
])('rechaza filtros inválidos sin hacer peticiones: %j', async (filter) => {
  await expect(listarOfertas(filter)).rejects.toThrow();
  expect(fetcher).not.toHaveBeenCalled();
});

it('propaga problemas de conexión/permisos en lugar de ocultarlos como catálogo vacío', async () => {
  fetcher.mockResolvedValue(new Response(JSON.stringify({ message: 'No tenés permiso', code: '42501' }), { status: 403 }));
  await expect(listarOfertas()).rejects.toThrow(/permiso/);
  guardMock.mockImplementation(() => { throw new Error('Sin conexión configurada'); });
  await expect(listarOfertas()).rejects.toThrow(/configurada/);
});

it('consulta historial de una oferta con un orden estable y límite', async () => {
  await historialPrecios(id, 10);
  expect(url().pathname).toBe('/rest/v1/catalogo_historial');
  expect(url().searchParams.get('ofertaId')).toBe(`eq.${id}`);
  expect(url().searchParams.get('order')).toBe('fecha.desc,id.asc');
  await expect(historialPrecios('incorrecto')).rejects.toThrow(/inválido/);
});

it('mantiene los límites de gestión y solo expone las operaciones RPC autorizadas', async () => {
  expect(await listarFuentesGestion()).toEqual([]);
  expect(url().pathname).toBe('/rest/v1/catalogo_fuentes_gestion');
  fetcher.mockClear();
  expect(await listarOfertasGestion(id, 100)).toEqual([]);
  expect(url().searchParams.get('fuente_id')).toBe(`eq.${id}`);
  expect(url().searchParams.get('offset')).toBe('100');
  await expect(listarOfertasGestion(id, -1)).rejects.toThrow(/Página/);
  fetcher.mockClear();
  await asignarOperador(id, id, null);
  expect(url().pathname).toBe('/rest/v1/rpc/asignar_operador_catalogo');
  expect(JSON.parse(fetcher.mock.calls[0][1].body)).toMatchObject({ p_rol: null });
  fetcher.mockClear();
  await moderarOferta(id, false);
  expect(JSON.parse(fetcher.mock.calls[0][1].body)).toMatchObject({ p_publicada: false, p_vigente_hasta: null });
  fetcher.mockClear();
  await configurarFuente({ nombreComercio: 'Ejemplo', sitioWeb: 'https://ejemplo.test', estado: 'pendiente',
    nombreFuente: 'Manual', tipo: 'manual', urlBase: 'https://ejemplo.test', permisoVerificado: false,
    evidenciaPermiso: '', esDemo: false });
  expect(JSON.parse(fetcher.mock.calls[0][1].body)).toMatchObject({ p_comercio: null, p_fuente: null, p_permiso: false });
});

it('rechaza lotes inválidos aunque el RPC responda HTTP 200, y devuelve el id del lote exitoso', async () => {
  fetcher.mockResolvedValueOnce(new Response(JSON.stringify({ ok: false, error: 'Fila 2: Precio inválido' })));
  await expect(cargarOfertas(id, [])).rejects.toThrow(/Fila 2/);
  fetcher.mockResolvedValueOnce(new Response(JSON.stringify({ ok: true, importacion_id: id, filas_aplicadas: 1 })));
  expect(await cargarOfertas(id, [])).toMatchObject({ ok: true, filas_aplicadas: 1 });
});
