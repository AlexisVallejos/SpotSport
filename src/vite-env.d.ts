/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** URL del proyecto de Supabase (https://xxxx.supabase.co). */
  readonly VITE_SUPABASE_URL?: string;
  /** Clave pública (anon / publishable) del proyecto. Es seguro que viaje en el navegador: los permisos están en la base. */
  readonly VITE_SUPABASE_ANON_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
