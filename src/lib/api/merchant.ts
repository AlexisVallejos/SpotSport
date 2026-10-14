import type { ProductInput } from '../catalog';
import { fail, guard, supabase } from '../supabase';
import type { MerchantStats, Order, OrderStatus, Product } from '../types';

export async function merchantStats(): Promise<MerchantStats> {
  guard();
  const { data, error } = await supabase.rpc('merchant_stats');
  if (error) fail(error);
  return data as MerchantStats;
}

export async function listMyProducts(merchantId: string): Promise<Product[]> {
  guard();
  const { data, error } = await supabase
    .from('products')
    .select('*, category:categories(id,slug,name), variants:product_variants(*)')
    .eq('merchant_id', merchantId)
    .order('created_at', { ascending: false });
  if (error) fail(error);
  return (data ?? []) as unknown as Product[];
}

export async function getMyProduct(id: string): Promise<Product | null> {
  guard();
  const { data, error } = await supabase.from('products').select('*, variants:product_variants(*)').eq('id', id).maybeSingle();
  if (error) fail(error);
  return (data as unknown as Product | null) ?? null;
}

/** Crea o actualiza un producto con sus variantes. Devuelve el id del producto. */
export async function saveProduct(merchantId: string, input: ProductInput): Promise<string> {
  guard();
  const fields = {
    name: input.name,
    description: input.description,
    brand: input.brand,
    category_id: input.category_id,
    images: input.images,
    is_active: input.is_active,
  };

  let productId = input.id;
  if (productId) {
    const { error } = await supabase.from('products').update(fields).eq('id', productId);
    if (error) fail(error);
  } else {
    const { data, error } = await supabase.from('products').insert({ ...fields, merchant_id: merchantId }).select('id').single();
    if (error) fail(error);
    productId = (data as { id: string }).id;
  }

  // Variantes: se quitan las que ya no están, se actualizan las existentes y se crean las nuevas.
  const keep = input.variants.filter((variant) => variant.id).map((variant) => variant.id as string);
  const existing = await supabase.from('product_variants').select('id').eq('product_id', productId);
  if (existing.error) fail(existing.error);
  const toDelete = (existing.data ?? []).map((row) => row.id as string).filter((id) => !keep.includes(id));
  if (toDelete.length > 0) {
    const { error } = await supabase.from('product_variants').delete().in('id', toDelete);
    if (error) fail(error);
  }
  for (const variant of input.variants) {
    const row = { size: variant.size, color: variant.color, sku: variant.sku, price_cents: variant.price_cents, stock: variant.stock, is_active: variant.is_active };
    const { error } = variant.id
      ? await supabase.from('product_variants').update(row).eq('id', variant.id)
      : await supabase.from('product_variants').insert({ ...row, product_id: productId });
    if (error) {
      if (error.code === '23505') throw new Error('Hay dos variantes con el mismo talle y color.');
      fail(error);
    }
  }
  return productId;
}

export async function setProductActive(id: string, isActive: boolean): Promise<void> {
  guard();
  const { error } = await supabase.from('products').update({ is_active: isActive }).eq('id', id);
  if (error) fail(error);
}

export async function deleteProduct(id: string): Promise<void> {
  guard();
  const { error } = await supabase.from('products').delete().eq('id', id);
  if (error) fail(error);
}

export async function updateStock(variantId: string, stock: number): Promise<void> {
  guard();
  const { error } = await supabase.from('product_variants').update({ stock }).eq('id', variantId);
  if (error) fail(error);
}

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

/** Sube una imagen a la carpeta del comercio y devuelve su URL pública. */
export async function uploadImage(folder: string, file: File, bucket: 'product-images' | 'site' = 'product-images'): Promise<string> {
  guard();
  if (!file.type.startsWith('image/')) throw new Error('El archivo tiene que ser una imagen.');
  if (file.size > MAX_IMAGE_BYTES) throw new Error('La imagen pesa más de 5 MB.');
  const extension = (file.name.split('.').pop() ?? 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 5) || 'jpg';
  const path = `${folder}/${crypto.randomUUID()}.${extension}`;
  const { error } = await supabase.storage.from(bucket).upload(path, file, { cacheControl: '31536000', upsert: false });
  if (error) fail(error);
  return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
}

/** Pedidos del comercio. Los datos de entrega vienen en el propio pedido: el perfil del cliente no es visible para el comercio. */
export async function listMerchantOrders(merchantId: string): Promise<Order[]> {
  guard();
  const { data, error } = await supabase
    .from('orders')
    .select('*, items:order_items(*)')
    .eq('merchant_id', merchantId)
    .order('created_at', { ascending: false });
  if (error) fail(error);
  return (data ?? []) as unknown as Order[];
}

export async function setOrderStatus(orderId: string, status: OrderStatus): Promise<void> {
  guard();
  const { error } = await supabase.rpc('set_order_status', { p_order: orderId, p_status: status });
  if (error) fail(error);
}

export async function markOrderPaid(orderId: string): Promise<void> {
  guard();
  const { error } = await supabase.rpc('mark_order_paid', { p_order: orderId });
  if (error) fail(error);
}
