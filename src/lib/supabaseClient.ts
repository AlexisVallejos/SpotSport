/** Carga diferida del cliente de Supabase (≈150 KB): queda fuera del bundle inicial. */
export const getSupabase = () => import('./supabase').then((module) => module.supabase);
