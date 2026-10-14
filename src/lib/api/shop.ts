import { fail, guard, supabase } from '../supabase';
import type { Announcement, Category, Product } from '../types';

const PRODUCT_SELECT = '*, merchant:merchants(id,name,slug,logo_url,city), category:categories(id,slug,name), variants:product_variants(*)';

export async function listCategories(): Promise<Category[]> {
  guard();
  const { data, error } = await supabase.from('categories').select('*').order('sort').order('name');
  if (error) fail(error);
  return (data ?? []) as Category[];
}

export type ProductQuery = { categoryId?: string; q?: string; merchantId?: string; featured?: boolean; limit?: number };

/** Productos activos de comercios aprobados (la base ya filtra el resto). */
export async function listProducts(query: ProductQuery = {}): Promise<Product[]> {
  guard();
  let request = supabase.from('products').select(PRODUCT_SELECT).eq('is_active', true).order('created_at', { ascending: false }).limit(query.limit ?? 60);
  if (query.categoryId) request = request.eq('category_id', query.categoryId);
  if (query.merchantId) request = request.eq('merchant_id', query.merchantId);
  if (query.featured) request = request.eq('featured', true);
  if (query.q?.trim()) request = request.ilike('name', `%${query.q.trim().replace(/[%_]/g, '')}%`);
  const { data, error } = await request;
  if (error) fail(error);
  return (data ?? []) as unknown as Product[];
}

export async function getProduct(id: string): Promise<Product | null> {
  guard();
  const { data, error } = await supabase.from('products').select(PRODUCT_SELECT).eq('id', id).maybeSingle();
  if (error) fail(error);
  return (data as unknown as Product | null) ?? null;
}

/** Anuncios vigentes (la base descarta los inactivos y los que no están en fecha). */
export async function listAnnouncements(): Promise<Announcement[]> {
  guard();
  const { data, error } = await supabase.from('announcements').select('*').order('sort').order('created_at', { ascending: false });
  if (error) fail(error);
  return (data ?? []) as Announcement[];
}
