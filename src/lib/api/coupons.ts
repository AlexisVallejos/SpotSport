import type { CouponInput } from '../coupons';
import { fail, guard, supabase } from '../supabase';
import type { Coupon, Voucher } from '../types';

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
