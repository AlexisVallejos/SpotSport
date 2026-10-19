import { getSupabase } from '../supabaseClient';
import { fail, guard } from '../supabaseConfig';
import type { Announcement, Category, Product } from '../types';

const PRODUCT_SELECT = '*, merchant:merchants(id,name,slug,logo_url,city), category:categories(id,slug,name), variants:product_variants(*)';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Datos que casi no cambian (categorías, anuncios): se piden una vez por minuto y no en cada pantalla. */
const cache = new Map<string, { at: number; value: Promise<unknown> }>();
function cached<T>(key: string, load: () => Promise<T>, ttlMs = 60_000): Promise<T> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < ttlMs) return hit.value as Promise<T>;
  const value = load().catch((error: unknown) => {
    cache.delete(key);
    throw error;
  });
  cache.set(key, { at: Date.now(), value });
  return value;
}

export async function listCategories(): Promise<Category[]> {
  guard();
  const supabase = await getSupabase();
  const { data, error } = await supabase.from('categories').select('*').order('sort').order('name');
  if (error) fail(error);
  return (data ?? []) as Category[];
}

/** Categorías para la tienda (con caché). Los paneles usan listCategories para ver los cambios al instante. */
export const cachedCategories = () => cached('categories', listCategories);

export type ProductQuery = { categoryId?: string; q?: string; merchantId?: string; featured?: boolean; limit?: number };

/** Productos activos de comercios aprobados (la base ya filtra el resto). */
export async function listProducts(query: ProductQuery = {}): Promise<Product[]> {
  guard();
  const supabase = await getSupabase();
  let request = supabase.from('products').select(PRODUCT_SELECT).eq('is_active', true).order('created_at', { ascending: false }).limit(query.limit ?? 60);
  if (query.categoryId) request = request.eq('category_id', query.categoryId);
  if (query.merchantId) {
    if (!UUID.test(query.merchantId)) return [];
    request = request.eq('merchant_id', query.merchantId);
  }
  if (query.featured) request = request.eq('featured', true);
  if (query.q?.trim()) request = request.ilike('name', `%${query.q.trim().replace(/[%_]/g, '')}%`);
  const { data, error } = await request;
  if (error) fail(error);
  return (data ?? []) as unknown as Product[];
}

export async function getProduct(id: string): Promise<Product | null> {
  guard();
  // Un enlace roto o inventado (/producto/abc) es "no disponible", no un error de la base.
  if (!UUID.test(id)) return null;
  const supabase = await getSupabase();
  const { data, error } = await supabase.from('products').select(PRODUCT_SELECT).eq('id', id).maybeSingle();
  if (error) fail(error);
  return (data as unknown as Product | null) ?? null;
}

/** Anuncios vigentes (la base descarta los inactivos y los que no están en fecha). */
export function listAnnouncements(): Promise<Announcement[]> {
  guard();
  return cached('announcements', async () => {
    const supabase = await getSupabase();
    const { data, error } = await supabase.from('announcements').select('*').order('sort').order('created_at', { ascending: false });
    if (error) fail(error);
    return (data ?? []) as Announcement[];
  });
}
