import { toOrderItems, type CartLine } from '../cart';
import { slugify } from '../catalog';
import { fail, guard, supabase } from '../supabase';
import type { Merchant, Order, PaymentMethod, Profile, Shipping } from '../types';

/** Confirma la compra. Devuelve el checkout_id (un pedido por comercio). */
export async function placeOrder(lines: CartLine[], shipping: Shipping, payment: PaymentMethod): Promise<string> {
  guard();
  const { data, error } = await supabase.rpc('place_order', { p_items: toOrderItems(lines), p_shipping: shipping, p_payment: payment });
  if (error) fail(error);
  return data as string;
}

export async function listMyOrders(): Promise<Order[]> {
  guard();
  const { data, error } = await supabase
    .from('orders')
    .select('*, items:order_items(*), merchant:merchants(name,slug)')
    .order('created_at', { ascending: false });
  if (error) fail(error);
  return (data ?? []) as unknown as Order[];
}

export async function cancelOrder(orderId: string): Promise<void> {
  guard();
  const { error } = await supabase.rpc('set_order_status', { p_order: orderId, p_status: 'cancelled' });
  if (error) fail(error);
}

export async function updateProfile(id: string, patch: Pick<Profile, 'full_name' | 'phone'>): Promise<void> {
  guard();
  const { error } = await supabase.from('profiles').update(patch).eq('id', id);
  if (error) fail(error);
}

export type MerchantRequest = { name: string; description: string; city: string; contact_email: string; contact_phone: string };

/** Pide la afiliación como comercio. Queda "en revisión" hasta que un admin la apruebe. */
export async function requestMerchant(ownerId: string, input: MerchantRequest): Promise<Merchant> {
  guard();
  const base = slugify(input.name) || 'comercio';
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const slug = attempt === 0 ? base : `${base}-${Math.random().toString(36).slice(2, 6)}`;
    const { data, error } = await supabase.from('merchants').insert({ ...input, owner_id: ownerId, slug }).select('*').single();
    if (!error) return data as Merchant;
    // Si el nombre ya existe como dirección, se prueba con una variante; cualquier otro error se informa.
    if (error.code !== '23505' || !/slug/.test(error.message)) fail(error);
  }
  throw new Error('No pudimos generar una dirección única para tu comercio. Probá con otro nombre.');
}

export async function updateMerchant(id: string, patch: Partial<Pick<Merchant, 'name' | 'description' | 'city' | 'contact_email' | 'contact_phone' | 'logo_url' | 'status'>>): Promise<void> {
  guard();
  const { error } = await supabase.from('merchants').update(patch).eq('id', id);
  if (error) fail(error);
}
