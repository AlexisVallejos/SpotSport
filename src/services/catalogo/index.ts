import { fail, guard, supabase } from '../../lib/supabase';
import type { FiltrosCatalogo, OfertaCatalogo, PrecioHistorico } from '../../../shared/catalogo';
export type * from '../../../shared/catalogo';

const CAMPOS = 'ofertaId,productoId,varianteId,nombre,marca,modelo,categoria,talle,color,precio,moneda,comercio,comercioId,urlOrigen,fuenteId,fechaActualizacion,disponible,esDemo';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function idValido(id: string) {
  if (!UUID.test(id)) throw new Error('Identificador inválido.');
}
function pagina(limite: number, desde: number) {
  if (!Number.isSafeInteger(limite) || limite < 1 || limite > 200
    || !Number.isSafeInteger(desde) || desde < 0 || !Number.isSafeInteger(desde + limite)) {
    throw new Error('Página inválida: usar entre 1 y 200 resultados y un inicio no negativo.');
  }
}

/** Comparar precios únicamente dentro de la misma variante y moneda. */
export async function listarOfertas(filtros: FiltrosCatalogo = {}): Promise<OfertaCatalogo[]> {
  guard();
  const { limite = 100, desde = 0 } = filtros;
  pagina(limite, desde);
  for (const id of [filtros.varianteId, filtros.comercioId]) if (id !== undefined) idValido(id);
  for (const precio of [filtros.precioMin, filtros.precioMax]) {
    if (precio !== undefined && !/^(0|[1-9][0-9]{0,9})(\.[0-9]{1,2})?$/.test(precio)) {
      throw new Error('Precio inválido: usar un decimal no negativo con hasta dos decimales.');
    }
  }
  if (filtros.precioMin !== undefined && filtros.precioMax !== undefined
    && Number(filtros.precioMin) > Number(filtros.precioMax)) throw new Error('El precio mínimo supera al máximo.');
  if (filtros.moneda !== undefined && !['ARS', 'USD'].includes(filtros.moneda)) throw new Error('Moneda inválida.');
  if ((filtros.precioMin !== undefined || filtros.precioMax !== undefined) && !filtros.moneda) {
    throw new Error('Elegí una moneda para filtrar por precio.');
  }
  let query = supabase.from('catalogo_ofertas').select(CAMPOS);
  if (filtros.texto?.trim()) {
    if (filtros.texto.length > 120) throw new Error('La búsqueda admite hasta 120 caracteres.');
    const literal = filtros.texto.trim().replace(/[\\%_*]/g, '\\$&');
    query = query.ilike('busqueda', `%${literal}%`);
  }
  if (filtros.marca) query = query.eq('marca', filtros.marca.trim().toLowerCase());
  if (filtros.categoria) query = query.eq('categoria', filtros.categoria.trim().toLowerCase());
  if (filtros.talle) query = query.eq('talle', filtros.talle.trim().toUpperCase());
  if (filtros.varianteId) query = query.eq('varianteId', filtros.varianteId);
  if (filtros.comercioId) query = query.eq('comercioId', filtros.comercioId);
  if (filtros.moneda) query = query.eq('moneda', filtros.moneda);
  if (filtros.precioMin !== undefined) query = query.gte('precioOrden', filtros.precioMin);
  if (filtros.precioMax !== undefined) query = query.lte('precioOrden', filtros.precioMax);
  if (filtros.incluirDemo !== true) query = query.eq('esDemo', false);
  const { data, error } = await query.order('varianteId').order('moneda').order('precioOrden')
    .order('fechaActualizacion', { ascending: false }).order('ofertaId').range(desde, desde + limite - 1);
  if (error) fail(error);
  return (data ?? []) as unknown as OfertaCatalogo[];
}

export async function historialPrecios(ofertaId: string, limite = 20): Promise<PrecioHistorico[]> {
  guard();
  idValido(ofertaId);
  pagina(limite, 0);
  const { data, error } = await supabase.from('catalogo_historial').select('*')
    .eq('ofertaId', ofertaId).order('fecha', { ascending: false }).order('id').limit(limite);
  if (error) fail(error);
  return (data ?? []) as PrecioHistorico[];
}
