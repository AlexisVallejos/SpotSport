import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

/** False hasta que se cargan VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY (ver README). */
export const isConfigured = Boolean(url && key);

export const supabase = createClient(url ?? 'http://localhost:54321', key ?? 'sin-configurar', {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});

export class NotConfiguredError extends Error {
  constructor() {
    super('La tienda todavía no está conectada a una base de datos.');
  }
}

const FRIENDLY: Record<string, string> = {
  '23505': 'Ya existe un registro con esos datos.',
  '23514': 'Algún dato no es válido.',
  '23503': 'Ese dato está en uso o no existe.',
  '42501': 'No tenés permiso para hacer esto.',
  PGRST301: 'Tu sesión venció. Volvé a ingresar.',
};

/** Lanza un Error con un mensaje para mostrar a la persona. */
export function fail(error: { message: string; code?: string } | null): never {
  const message = error?.message ?? 'Algo salió mal.';
  // Los mensajes de nuestras funciones ya están en español; los técnicos se traducen.
  const known = error?.code ? FRIENDLY[error.code] : undefined;
  throw new Error(/[áéíóúñ¿¡]|No |Iniciá|Completá|Cantidad|stock|carrito|Pedido/.test(message) ? message : (known ?? message));
}

export function guard() {
  if (!isConfigured) throw new NotConfiguredError();
}
