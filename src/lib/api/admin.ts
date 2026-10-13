import { fail, guard, supabase } from '../supabase';
import type { AdminStats, Announcement, AnnouncementPlacement, Category, Merchant, MerchantStatus, Order, Product, Profile } from '../types';

export async function adminStats(): Promise<AdminStats> {
  guard();
  const { data, error } = await supabase.rpc('admin_stats');
  if (error) fail(error);
  return data as AdminStats;
}

export type MerchantWithOwner = Merchant & { owner?: Pick<Profile, 'full_name' | 'email'> | null };

export async function listMerchants(status?: MerchantStatus): Promise<MerchantWithOwner[]> {
  guard();
  let request = supabase.from('merchants').select('*, owner:profiles!merchants_owner_id_fkey(full_name,email)').order('created_at', { ascending: false });
  if (status) request = request.eq('status', status);
  const { data, error } = await request;
  if (error) fail(error);
  return (data ?? []) as unknown as MerchantWithOwner[];
}

export async function reviewMerchant(id: string, status: MerchantStatus, reason = ''): Promise<void> {
  guard();
  const { error } = await supabase.rpc('review_merchant', { p_merchant: id, p_status: status, p_reason: reason });
  if (error) fail(error);
}

export async function listUsers(): Promise<Profile[]> {
  guard();
  const { data, error } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
  if (error) fail(error);
  return (data ?? []) as Profile[];
}

export async function setAdmin(userId: string, isAdmin: boolean): Promise<void> {
  guard();
  const { error } = await supabase.from('profiles').update({ is_admin: isAdmin }).eq('id', userId);
  if (error) fail(error);
}

export async function listAllProducts(): Promise<Product[]> {
  guard();
  const { data, error } = await supabase
    .from('products')
    .select('*, merchant:merchants(id,name,slug,logo_url,city), category:categories(id,slug,name), variants:product_variants(*)')
    .order('created_at', { ascending: false });
  if (error) fail(error);
  return (data ?? []) as unknown as Product[];
}

export async function setProductFlags(id: string, flags: { featured?: boolean; is_active?: boolean }): Promise<void> {
  guard();
  const { error } = await supabase.from('products').update(flags).eq('id', id);
  if (error) fail(error);
}

export async function listAllOrders(): Promise<Order[]> {
  guard();
  const { data, error } = await supabase
    .from('orders')
    .select('*, items:order_items(*), merchant:merchants(name,slug), customer:profiles!orders_customer_id_fkey(full_name,email)')
    .order('created_at', { ascending: false })
    .limit(200);
  if (error) fail(error);
  return (data ?? []) as unknown as Order[];
}

export async function listAllAnnouncements(): Promise<Announcement[]> {
  guard();
  const { data, error } = await supabase.from('announcements').select('*').order('sort').order('created_at', { ascending: false });
  if (error) fail(error);
  return (data ?? []) as Announcement[];
}

export type AnnouncementInput = {
  id?: string;
  placement: AnnouncementPlacement;
  title: string;
  body: string;
  link_url: string;
  link_label: string;
  image_url: string | null;
  is_active: boolean;
  starts_at: string | null;
  ends_at: string | null;
  sort: number;
};

export async function saveAnnouncement(input: AnnouncementInput): Promise<void> {
  guard();
  const { id, ...row } = input;
  const { error } = id ? await supabase.from('announcements').update(row).eq('id', id) : await supabase.from('announcements').insert(row);
  if (error) fail(error);
}

export async function deleteAnnouncement(id: string): Promise<void> {
  guard();
  const { error } = await supabase.from('announcements').delete().eq('id', id);
  if (error) fail(error);
}

export async function saveCategory(input: { id?: string; slug: string; name: string; sort: number }): Promise<void> {
  guard();
  const { id, ...row } = input;
  const { error } = id ? await supabase.from('categories').update(row).eq('id', id) : await supabase.from('categories').insert(row);
  if (error) fail(error);
}

export async function deleteCategory(id: string): Promise<void> {
  guard();
  const { error } = await supabase.from('categories').delete().eq('id', id);
  if (error) fail(error);
}

export type { Category };
