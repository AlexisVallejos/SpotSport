import type { CouponInput } from '../coupons';
import { fail, guard, supabase } from '../supabase';
import type { Coupon, CouponOverview, CouponStats, SaleStatus, Voucher, VoucherSale } from '../types';

const WITH_MERCHANT = '*, merchant:merchants(name,slug,logo_url)';

/** Cupones que se pueden obtener ahora (la base ya filtra activos, vigentes y de comercios aprobados). */
export async function listPublicCoupons(): Promise<Coupon[]> {
  guard();
  const { data, error } = await supabase.from('coupons').select(WITH_MERCHANT).order('created_at', { ascending: false });
  if (error) fail(error);
  return (data ?? []) as unknown as Coupon[];
}

/** Obtiene el cupón: devuelve el voucher vigente o crea uno nuevo. */
export async function claimCoupon(couponId: string): Promise<Voucher> {
  guard();
  const { data, error } = await supabase.rpc('claim_coupon', { p_coupon: couponId });
  if (error) fail(error);
  return data as Voucher;
}

export async function listMyVouchers(): Promise<Voucher[]> {
  guard();
  const { data, error } = await supabase
    .from('vouchers')
    .select(`*, coupon:coupons(${WITH_MERCHANT})`)
    .order('created_at', { ascending: false });
  if (error) fail(error);
  return (data ?? []) as unknown as Voucher[];
}

/** La web del comercio con el código aplicado (la base cuenta el click y verifica que no haya vencido). */
export async function voucherRedirect(voucherId: string): Promise<string> {
  guard();
  const { data, error } = await supabase.rpc('voucher_redirect', { p_voucher: voucherId });
  if (error) fail(error);
  return data as string;
}

// ── Comercio ──

export async function listMyCoupons(merchantId: string): Promise<Coupon[]> {
  guard();
  const { data, error } = await supabase.from('coupons').select('*').eq('merchant_id', merchantId).order('created_at', { ascending: false });
  if (error) fail(error);
  return (data ?? []) as Coupon[];
}

/** Clicks por cupón, sumando los vouchers que salieron de cada uno. */
export async function couponClicks(couponIds: string[]): Promise<Record<string, number>> {
  guard();
  if (couponIds.length === 0) return {};
  const { data, error } = await supabase.from('vouchers').select('coupon_id, clicks').in('coupon_id', couponIds);
  if (error) fail(error);
  const totals: Record<string, number> = {};
  for (const row of (data ?? []) as { coupon_id: string; clicks: number }[]) totals[row.coupon_id] = (totals[row.coupon_id] ?? 0) + row.clicks;
  return totals;
}

export async function createCoupon(merchantId: string, input: CouponInput): Promise<void> {
  guard();
  const { error } = await supabase.from('coupons').insert({ ...input, merchant_id: merchantId });
  if (error) fail(error);
}

export async function setCouponActive(id: string, isActive: boolean): Promise<void> {
  guard();
  const { error } = await supabase.from('coupons').update({ is_active: isActive }).eq('id', id);
  if (error) fail(error);
}

export async function deleteCoupon(id: string): Promise<void> {
  guard();
  const { error } = await supabase.from('coupons').delete().eq('id', id);
  if (error) fail(error);
}

// ── Estadísticas, ventas y comisión ──

/** Los números de cupones del comercio de la cuenta (últimos `days` días). */
export async function merchantCouponStats(days = 30): Promise<CouponStats> {
  guard();
  const { data, error } = await supabase.rpc('merchant_coupon_stats', { p_days: days });
  if (error) fail(error);
  return data as CouponStats;
}

export async function listMySales(): Promise<VoucherSale[]> {
  guard();
  const { data, error } = await supabase.from('voucher_sales').select('*').order('reported_at', { ascending: false }).limit(200);
  if (error) fail(error);
  return (data ?? []) as VoucherSale[];
}

/** El comercio registra una venta hecha con un voucher. La comisión la calcula la base. */
export async function registerSale(code: string, amountCents: number): Promise<VoucherSale> {
  guard();
  const { data, error } = await supabase.rpc('register_voucher_sale', { p_code: code, p_amount_cents: amountCents });
  if (error) fail(error);
  return data as VoucherSale;
}

export async function adminCouponOverview(days = 30): Promise<CouponOverview> {
  guard();
  const { data, error } = await supabase.rpc('admin_coupon_overview', { p_days: days });
  if (error) fail(error);
  return data as CouponOverview;
}

export async function adminListSales(): Promise<VoucherSale[]> {
  guard();
  const { data, error } = await supabase.from('voucher_sales').select('*, merchant:merchants(name)').order('reported_at', { ascending: false }).limit(200);
  if (error) fail(error);
  return (data ?? []) as unknown as VoucherSale[];
}

export async function setSaleStatus(saleId: string, status: SaleStatus): Promise<void> {
  guard();
  const { error } = await supabase.rpc('admin_set_sale_status', { p_sale: saleId, p_status: status });
  if (error) fail(error);
}

/** Marca como cobradas todas las comisiones pendientes de un comercio. Devuelve cuántas. */
export async function settleMerchant(merchantId: string): Promise<number> {
  guard();
  const { data, error } = await supabase.rpc('admin_settle_merchant', { p_merchant: merchantId });
  if (error) fail(error);
  return data as number;
}

/** Porcentaje propio de un comercio (null: usa el general). */
export async function setMerchantCommission(merchantId: string, percent: number | null): Promise<void> {
  guard();
  const { error } = await supabase.from('merchants').update({ commission_percent: percent }).eq('id', merchantId);
  if (error) fail(error);
}

export async function setDefaultCommission(percent: number): Promise<void> {
  guard();
  const { error } = await supabase.from('site_settings').upsert({ key: 'commission', value: { percent }, updated_at: new Date().toISOString() });
  if (error) fail(error);
}
