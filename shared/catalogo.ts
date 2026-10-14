/** Precio decimal en unidades monetarias; nunca convertir a centavos por truncamiento. */
export interface OfertaCatalogo {
  ofertaId: string;
  productoId: string;
  varianteId: string;
  nombre: string;
  marca: string;
  modelo: string;
  categoria: string;
  talle: string;
  color: string;
  precio: string;
  moneda: 'ARS' | 'USD';
  comercio: string;
  comercioId: string;
  urlOrigen: string;
  fuenteId: string;
  fechaActualizacion: string;
  disponible: boolean;
  esDemo: boolean;
}

export interface FiltrosCatalogo {
  texto?: string;
  marca?: string;
  categoria?: string;
  talle?: string;
  varianteId?: string;
  comercioId?: string;
  moneda?: 'ARS' | 'USD';
  precioMin?: string;
  precioMax?: string;
  incluirDemo?: boolean;
  limite?: number;
  desde?: number;
}

export interface PrecioHistorico {
  id: string;
  ofertaId: string;
  precio: string;
  moneda: 'ARS' | 'USD';
  fecha: string;
  disponible: boolean;
  urlOrigen: string;
}

export interface FilaCatalogo {
  codigo_externo: string;
  marca: string;
  categoria: string;
  modelo: string;
  nombre: string;
  talle: string;
  color: string;
  precio: string;
  moneda: string;
  url_producto: string;
  fecha_observacion: string;
  disponible: boolean;
  es_demo: boolean;
}

export interface ResultadoImportacion {
  ok: boolean;
  importacion_id: string;
  filas_aplicadas: number;
  error?: string;
}

export interface FuenteGestion {
  id: string;
  comercio_id: string;
  comercio: string;
  estado: 'pendiente' | 'activo' | 'suspendido';
  nombre: string;
  tipo: 'manual' | 'csv' | 'api';
  url_base: string;
  permiso_verificado: boolean;
  es_demo: boolean;
  ultima_sincronizacion: string | null;
}

export interface OfertaGestion extends FilaCatalogo {
  id: string;
  fuente_id: string;
  publicada: boolean;
  vigente_hasta: string | null;
}

export interface ConfiguracionFuente {
  comercioId?: string;
  fuenteId?: string;
  nombreComercio: string;
  sitioWeb: string;
  estado: FuenteGestion['estado'];
  nombreFuente: string;
  tipo: FuenteGestion['tipo'];
  urlBase: string;
  permisoVerificado: boolean;
  evidenciaPermiso: string;
  esDemo: boolean;
}
