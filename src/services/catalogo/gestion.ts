import { fail, guard, supabase } from '../../lib/supabase';
import type { ConfiguracionFuente, FilaCatalogo, FuenteGestion, OfertaGestion, ResultadoImportacion } from '../../../shared/catalogo';

export async function listarFuentesGestion(): Promise<FuenteGestion[]> {
  guard();
  const { data, error } = await supabase.from('catalogo_fuentes_gestion').select('*').order('nombre').order('id');
  if (error) fail(error);
  return (data ?? []) as FuenteGestion[];
}

export async function listarOfertasGestion(fuenteId: string, desde = 0): Promise<OfertaGestion[]> {
  guard();
  if (!Number.isSafeInteger(desde) || desde < 0 || !Number.isSafeInteger(desde + 100)) throw new Error('Página inválida.');
  const { data, error } = await supabase.from('catalogo_ofertas_gestion').select('*')
    .eq('fuente_id', fuenteId).order('codigo_externo').order('id').range(desde, desde + 99);
  if (error) fail(error);
  return (data ?? []) as OfertaGestion[];
}

/** Carga manual o CSV ya parseado; las modificaciones quedan pendientes de moderación. */
export async function cargarOfertas(fuenteId: string, filas: FilaCatalogo[], archivo = 'manual'): Promise<ResultadoImportacion> {
  guard();
  const { data, error } = await supabase.rpc('cargar_ofertas_catalogo', { p_fuente: fuenteId, p_filas: filas, p_archivo: archivo });
  if (error) fail(error);
  const resultado = data as ResultadoImportacion;
  if (!resultado?.ok) throw new Error(resultado?.error ?? 'No se pudo importar el lote.');
  return resultado;
}

export async function asignarOperador(comercioId: string, perfilId: string, rol: 'titular' | 'operador' | null): Promise<void> {
  guard();
  const { error } = await supabase.rpc('asignar_operador_catalogo', { p_comercio: comercioId, p_perfil: perfilId, p_rol: rol });
  if (error) fail(error);
}

export async function moderarOferta(ofertaId: string, publicada: boolean, vigenteHasta: string | null = null, evidencia: string | null = null): Promise<void> {
  guard();
  const { error } = await supabase.rpc('moderar_oferta_catalogo', { p_oferta: ofertaId, p_publicada: publicada, p_vigente_hasta: vigenteHasta, p_evidencia: evidencia });
  if (error) fail(error);
}

export async function configurarFuente(input: ConfiguracionFuente): Promise<{ comercio_id: string; fuente_id: string }> {
  guard();
  const { data, error } = await supabase.rpc('configurar_fuente_catalogo', {
    p_comercio: input.comercioId ?? null, p_fuente: input.fuenteId ?? null,
    p_nombre: input.nombreComercio, p_sitio: input.sitioWeb, p_estado: input.estado,
    p_nombre_fuente: input.nombreFuente, p_tipo: input.tipo, p_url_base: input.urlBase,
    p_permiso: input.permisoVerificado, p_evidencia: input.evidenciaPermiso, p_demo: input.esDemo,
  });
  if (error) fail(error);
  return data as { comercio_id: string; fuente_id: string };
}
