import type { Coupon } from './types';

export const CODE_PLACEHOLDER = '{codigo}';

/** Duraciones que puede elegir un comercio para cada voucher. */
export const VALIDITY_OPTIONS = [
  { hours: 1, label: '1 hora' },
  { hours: 6, label: '6 horas' },
  { hours: 24, label: '24 horas' },
  { hours: 48, label: '2 días' },
  { hours: 72, label: '3 días' },
  { hours: 168, label: '7 días' },
  { hours: 720, label: '30 días' },
] as const;

/** La web del comercio con el código aplicado. Sin {codigo} en el link, queda tal cual. */
export function couponUrl(template: string, code: string): string {
  return template.split(CODE_PLACEHOLDER).join(encodeURIComponent(code));
}

export const hasPlaceholder = (template: string) => template.includes(CODE_PLACEHOLDER);

/** Mayúsculas y solo letras/números, hasta 12 (lo que acepta la base). */
export function normalizePrefix(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12);
}

export type TimeLeft = { expired: boolean; ms: number; label: string };

/** Cuánto le queda a un voucher, en el formato más corto que se entienda. */
export function timeLeft(expiresAt: string, now = Date.now()): TimeLeft {
  const ms = new Date(expiresAt).getTime() - now;
  if (!Number.isFinite(ms) || ms <= 0) return { expired: true, ms: 0, label: 'Venció' };
  const totalSeconds = Math.floor(ms / 1000);
  const days = Math.floor(totalSeconds / 86_400);
  const hours = Math.floor((totalSeconds % 86_400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const label =
    days > 0 ? `${days} d ${hours} h` : hours > 0 ? `${hours} h ${String(minutes).padStart(2, '0')} min` : `${minutes} min ${String(seconds).padStart(2, '0')} s`;
  return { expired: false, ms, label: `Quedan ${label}` };
}

export type CouponInput = {
  title: string;
  description: string;
  discount_label: string;
  code_prefix: string;
  destination_url: string;
  valid_hours: number;
  starts_at: string;
  ends_at: string | null;
  max_claims: number | null;
};

/** Devuelve el primer problema del formulario, o null si está todo bien. */
export function validateCoupon(input: CouponInput): string | null {
  if (input.title.trim().length < 3) return 'Poné un título de al menos 3 letras.';
  if (!input.discount_label.trim()) return 'Escribí el descuento que se ve en la tarjeta (por ejemplo, 20% OFF).';
  if (!/^[A-Z0-9]{3,12}$/.test(input.code_prefix)) return 'El código base necesita entre 3 y 12 letras o números.';
  let url: URL;
  try {
    url = new URL(input.destination_url);
  } catch {
    return 'El link de tu tienda no es válido.';
  }
  if (url.protocol !== 'https:' || /\s/.test(input.destination_url)) return 'El link de tu tienda tiene que empezar con https://';
  if (!Number.isInteger(input.valid_hours) || input.valid_hours < 1 || input.valid_hours > 720) return 'Elegí cuánto dura cada cupón.';
  if (input.ends_at && new Date(input.ends_at) <= new Date(input.starts_at)) return 'La campaña tiene que terminar después de empezar.';
  if (input.max_claims !== null && (!Number.isInteger(input.max_claims) || input.max_claims < 1)) return 'El límite de cupones tiene que ser un número mayor a 0.';
  return null;
}

/** Texto corto de la campaña para mostrar en la tarjeta. */
export function campaignLabel(coupon: Pick<Coupon, 'ends_at' | 'max_claims' | 'claims_count'>): string {
  const parts: string[] = [];
  if (coupon.ends_at) parts.push(`hasta el ${new Date(coupon.ends_at).toLocaleDateString('es-AR', { day: '2-digit', month: 'short' })}`);
  if (coupon.max_claims !== null) parts.push(`quedan ${Math.max(0, coupon.max_claims - coupon.claims_count)}`);
  return parts.join(' · ');
}
