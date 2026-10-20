import { useSyncExternalStore } from 'react';
import type { Purchase, PurchaseRequest, PurchaseStart } from '../../shared/compras';

export type { Buyer, Purchase, PurchaseRequest, PurchaseStatus } from '../../shared/compras';
export { SIZES } from '../../shared/compras';
export { BRANCHES, type Branch } from '../../shared/sucursales';

async function json<T>(response: Response): Promise<T> {
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(body?.error ?? `La API respondió ${response.status}.`);
  return body as T;
}

export const startPurchase = (request: PurchaseRequest) =>
  fetch('/api/compras', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(request), signal: AbortSignal.timeout(30_000) }).then((response) =>
    json<PurchaseStart>(response),
  );

/** paymentId: el que agrega Mercado Pago al volver del checkout (?payment_id=), para confirmar el pago enseguida. */
export const loadPurchase = (id: string, paymentId?: string | null) =>
  fetch(`/api/compras/${encodeURIComponent(id)}${paymentId ? `?payment_id=${encodeURIComponent(paymentId)}` : ''}`, { signal: AbortSignal.timeout(30_000) }).then((response) => json<Purchase>(response));

/** Link público del ticket: es lo que lleva el QR y lo que ve la tienda al escanearlo. */
export const ticketUrl = (purchase: Pick<Purchase, 'id'>) => `${window.location.origin}/ticket/${purchase.id}`;

// Los tickets de este navegador ("Mis tickets"). El id es largo y al azar: tenerlo es tener el ticket.
const KEY = 'spot:tickets';
const listeners = new Set<() => void>();
let cache: string[] | null = null;

function read(): string[] {
  if (cache) return cache;
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    cache = Array.isArray(saved) ? saved.filter((id): id is string => typeof id === 'string') : [];
  } catch {
    cache = [];
  }
  return cache;
}

export function rememberTicket(id: string) {
  if (read().includes(id)) return;
  cache = [id, ...read()].slice(0, 100);
  try {
    localStorage.setItem(KEY, JSON.stringify(cache));
  } catch {
    // Sin almacenamiento el ticket sigue disponible por su link.
  }
  listeners.forEach((listener) => listener());
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const useTicketIds = () => useSyncExternalStore(subscribe, read, () => []);

export const paymentLabel = (purchase: Purchase) => {
  if (purchase.payment.provider === 'demo') return 'Pago de prueba (sin Mercado Pago)';
  const method = purchase.payment.method ? ` · ${purchase.payment.method.replace(/_/g, ' ')}` : '';
  const installments = purchase.payment.installments && purchase.payment.installments > 1 ? ` · ${purchase.payment.installments} cuotas` : '';
  return `Mercado Pago${method}${installments}`;
};

export const formatDateTime = (iso: string) =>
  new Date(iso).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'America/Argentina/Buenos_Aires' });
