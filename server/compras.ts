import { randomInt, randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { SIZES, type Buyer, type Purchase, type PurchaseRequest, type PurchaseStart, type PurchaseStatus } from '../shared/compras';
import { STORES, type ProductSummary, type StoreId } from '../shared/precios';
import { findBranch } from '../shared/sucursales';
import { normalizeEmail } from './suscripciones';

// Compras con SPOT: el comprador elige tienda, sucursal y talle, paga con Mercado Pago (Checkout Pro)
// y se lleva un ticket con QR para retirar en el local. Sin MP_ACCESS_TOKEN la API queda en modo prueba:
// el pago se aprueba solo y el ticket lo dice.

const MP_API = 'https://api.mercadopago.com';
const CODE_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'; // Sin 0/O ni 1/I: se dicta en el mostrador.
const ID = /^[0-9a-f-]{36}$/;

type MpPayment = { id: number; status: string; external_reference: string | null; payment_method_id?: string; installments?: number; date_approved?: string | null };

export type PurchasesOptions = {
  file: string;
  /** Access token de Mercado Pago (Tus integraciones → Credenciales). Vacío = modo prueba. */
  accessToken?: string;
  findProduct: (id: string) => ProductSummary | null;
  fetchImpl?: typeof fetch;
};

const text = (value: unknown, max: number) => (typeof value === 'string' ? value.trim().replace(/\s+/g, ' ').slice(0, max) : '');

function newCode() {
  const pick = () => Array.from({ length: 4 }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join('');
  return `SPOT-${pick()}-${pick()}`;
}

/** Revisa lo que manda el formulario de compra. Devuelve el pedido limpio o el error para mostrar. */
export function validatePurchase(input: unknown): PurchaseRequest | string {
  const body = (input ?? {}) as Record<string, unknown>;
  const buyer = (body.buyer ?? {}) as Record<string, unknown>;
  const store = body.store as StoreId;
  if (!(store in STORES)) return 'Elegí en qué tienda lo comprás.';
  const branchId = text(body.branchId, 60);
  if (!findBranch(store, branchId)) return 'Elegí la sucursal donde lo vas a retirar.';
  const size = text(body.size, 5);
  if (!SIZES.includes(size)) return 'Elegí tu talle.';
  const clean: Buyer = {
    name: text(buyer.name, 80),
    dni: text(buyer.dni, 12).replace(/\D/g, ''),
    email: normalizeEmail(buyer.email) ?? '',
    phone: text(buyer.phone, 25),
  };
  if (clean.name.length < 3 || !clean.name.includes(' ')) return 'Escribí tu nombre y apellido.';
  if (!/^\d{7,8}$/.test(clean.dni)) return 'Revisá el DNI: son 7 u 8 números.';
  if (!clean.email) return 'Revisá el mail: no parece válido.';
  if (clean.phone.replace(/\D/g, '').length < 8) return 'Revisá el teléfono.';
  return { productId: text(body.productId, 80), store, branchId, size, buyer: clean };
}

export class Purchases {
  private items = new Map<string, Purchase>();
  private ready: Promise<void>;
  private fetchImpl: typeof fetch;

  constructor(private options: PurchasesOptions) {
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.ready = this.load();
  }

  get demo() {
    return !this.options.accessToken;
  }

  private async load() {
    try {
      const saved = JSON.parse(await readFile(this.options.file, 'utf8')) as Purchase[];
      this.items = new Map(saved.map((purchase) => [purchase.id, purchase]));
    } catch {
      // Primera vez: todavía no hay archivo.
    }
  }

  private async save() {
    await mkdir(path.dirname(this.options.file), { recursive: true });
    const temporary = `${this.options.file}.tmp`;
    await writeFile(temporary, JSON.stringify([...this.items.values()]));
    await rename(temporary, this.options.file);
  }

  private async mp<T>(pathname: string, init?: RequestInit): Promise<T> {
    const response = await this.fetchImpl(`${MP_API}${pathname}`, {
      ...init,
      headers: { Authorization: `Bearer ${this.options.accessToken}`, 'Content-Type': 'application/json', ...init?.headers },
      signal: AbortSignal.timeout(20_000),
    });
    const body = (await response.json().catch(() => null)) as { message?: string } | null;
    if (!response.ok) throw new Error(`Mercado Pago respondió ${response.status}: ${body?.message ?? 'sin detalle'}`);
    return body as T;
  }

  /** Crea la compra con el precio que tiene hoy la tienda (nunca el que manda el navegador). */
  async create(input: unknown, baseUrl: string): Promise<PurchaseStart | string> {
    await this.ready;
    const request = validatePurchase(input);
    if (typeof request === 'string') return request;
    const product = this.options.findProduct(request.productId);
    if (!product) return 'No encontramos ese producto.';
    if (product.type !== 'Zapatillas') return 'Por ahora con SPOT se compran sólo zapatillas.';
    const offer = product.offers.find((item) => item.store === request.store);
    if (!offer) return `${STORES[request.store].name} ya no lo tiene publicado.`;

    const now = new Date().toISOString();
    const purchase: Purchase = {
      id: randomUUID(),
      code: newCode(),
      createdAt: now,
      paidAt: null,
      status: 'pendiente',
      payment: { provider: this.demo ? 'demo' : 'mercadopago', paymentId: null, method: null, installments: null },
      product: { id: product.id, name: product.name, brand: product.brand, type: product.type, thumb: product.thumb, size: request.size, url: offer.url },
      store: request.store,
      branch: findBranch(request.store, request.branchId)!,
      price: offer.price,
      listPrice: offer.listPrice,
      buyer: request.buyer,
      checkoutUrl: null,
    };
    const ticketUrl = `${baseUrl}/ticket/${purchase.id}`;

    if (this.demo) {
      purchase.status = 'pagado';
      purchase.paidAt = now;
      this.items.set(purchase.id, purchase);
      await this.save();
      return { id: purchase.id, checkoutUrl: `/ticket/${purchase.id}` };
    }

    const [first, ...rest] = request.buyer.name.split(' ');
    const secure = baseUrl.startsWith('https://');
    const preference = await this.mp<{ init_point: string; sandbox_init_point: string }>('/checkout/preferences', {
      method: 'POST',
      body: JSON.stringify({
        items: [{ id: product.id, title: `${product.name} · talle ${request.size}`, description: `Retiro en ${purchase.branch.name}`, picture_url: product.thumb, category_id: 'fashion', quantity: 1, currency_id: 'ARS', unit_price: offer.price }],
        payer: { name: first, surname: rest.join(' '), email: request.buyer.email, identification: { type: 'DNI', number: request.buyer.dni } },
        external_reference: purchase.id,
        back_urls: { success: ticketUrl, pending: ticketUrl, failure: ticketUrl },
        // Mercado Pago sólo vuelve solo (auto_return) y avisa por webhook a direcciones https.
        ...(secure ? { auto_return: 'approved', notification_url: `${baseUrl}/api/compras/webhook` } : {}),
        statement_descriptor: 'SPOT',
      }),
    }).catch((error: Error) => {
      console.error('[compras] no se pudo crear el pago', error.message);
      return null;
    });
    if (!preference) return 'No pudimos conectar con Mercado Pago. Probá de nuevo en un rato.';
    purchase.checkoutUrl = this.options.accessToken!.startsWith('TEST-') ? preference.sandbox_init_point : preference.init_point;
    this.items.set(purchase.id, purchase);
    await this.save();
    return { id: purchase.id, checkoutUrl: purchase.checkoutUrl };
  }

  /** La compra; si sigue pendiente, le pregunta a Mercado Pago cómo está el pago. */
  async get(id: string, paymentId?: string | null): Promise<Purchase | null> {
    await this.ready;
    if (!ID.test(id)) return null;
    const purchase = this.items.get(id);
    if (!purchase) return null;
    if (purchase.status !== 'pagado' && !this.demo) {
      try {
        if (paymentId && /^\d{1,20}$/.test(paymentId)) await this.notify(paymentId);
        else {
          const found = await this.mp<{ results: MpPayment[] }>(`/v1/payments/search?external_reference=${id}&sort=date_created&criteria=desc`);
          const payment = found.results.find((item) => item.status === 'approved') ?? found.results[0];
          if (payment) await this.apply(payment);
        }
      } catch (error) {
        console.error('[compras] no pudimos consultar el pago', error);
      }
    }
    return this.items.get(id) ?? null;
  }

  /** Aviso de Mercado Pago (webhook) o vuelta del checkout con ?payment_id=. */
  async notify(paymentId: string) {
    await this.ready;
    if (this.demo || !/^\d{1,20}$/.test(paymentId)) return;
    await this.apply(await this.mp<MpPayment>(`/v1/payments/${paymentId}`));
  }

  private async apply(payment: MpPayment) {
    const purchase = payment.external_reference ? this.items.get(payment.external_reference) : undefined;
    if (!purchase || purchase.status === 'pagado') return;
    const status: PurchaseStatus = payment.status === 'approved' ? 'pagado' : payment.status === 'rejected' || payment.status === 'cancelled' ? 'rechazado' : 'pendiente';
    purchase.status = status;
    purchase.payment = { provider: 'mercadopago', paymentId: String(payment.id), method: payment.payment_method_id ?? null, installments: payment.installments ?? null };
    if (status === 'pagado') purchase.paidAt = payment.date_approved ?? new Date().toISOString();
    await this.save();
  }
}
