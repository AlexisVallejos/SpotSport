import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import type { Purchase } from '../shared/compras';
import type { ProductSummary } from '../shared/precios';
import { Purchases, validatePurchase } from './compras';

const shoe: ProductSummary = {
  id: 'dr2660008',
  name: 'Nike Invincible 3',
  brand: 'Nike',
  title: 'Invincible 3',
  category: 'calzado',
  type: 'Zapatillas',
  sports: ['Running'],
  genders: ['Mujer'],
  thumb: 'https://example.com/foto.jpg',
  offers: [
    { store: 'opensports', url: 'https://www.opensports.com.ar/x.html', price: 179999, listPrice: 349999, installments: null },
    { store: 'dexter', url: 'https://www.dexter.com.ar/x.html', price: 384999, listPrice: null, installments: null },
  ],
  best: 179999,
  worst: 384999,
  savings: 205000,
  discount: 49,
  firstSeen: '2026-10-13',
};

const request = {
  productId: 'dr2660008',
  store: 'opensports',
  branchId: 'os-mar-del-plata-central',
  size: '40',
  buyer: { name: 'Ana Pérez', dni: '30.123.456', email: 'Ana@Mail.com', phone: '223 555-1234' },
};

const file = async () => path.join(await mkdtemp(path.join(tmpdir(), 'spot-compras-')), 'compras.json');

describe('validatePurchase', () => {
  it('limpia DNI y mail', () => {
    expect(validatePurchase(request)).toMatchObject({ buyer: { dni: '30123456', email: 'ana@mail.com' } });
  });

  it('rechaza tienda, sucursal, talle y datos que no sirven', () => {
    expect(validatePurchase({ ...request, store: 'otra' })).toMatch(/tienda/);
    expect(validatePurchase({ ...request, branchId: 'dx-184' })).toMatch(/sucursal/); // es de Dexter, no de Open Sports
    expect(validatePurchase({ ...request, size: '60' })).toMatch(/talle/);
    expect(validatePurchase({ ...request, buyer: { ...request.buyer, name: 'Ana' } })).toMatch(/apellido/);
    expect(validatePurchase({ ...request, buyer: { ...request.buyer, dni: '123' } })).toMatch(/DNI/);
    expect(validatePurchase(null)).toMatch(/tienda/);
  });
});

describe('compras', () => {
  it('en modo prueba aprueba el pago, usa el precio de la tienda y guarda en disco', async () => {
    const saved = await file();
    const purchases = new Purchases({ file: saved, findProduct: (id) => (id === shoe.id ? shoe : null) });
    const started = await purchases.create({ ...request, price: 1 }, 'http://localhost:5173');
    if (typeof started === 'string') throw new Error(started);
    expect(started.checkoutUrl).toBe(`/ticket/${started.id}`);

    const ticket = (await new Purchases({ file: saved, findProduct: () => null }).get(started.id))!;
    expect(ticket).toMatchObject({ status: 'pagado', price: 179999, store: 'opensports', payment: { provider: 'demo' }, branch: { city: 'Mar del Plata' } });
    expect(ticket.code).toMatch(/^SPOT-[2-9A-HJ-NP-Z]{4}-[2-9A-HJ-NP-Z]{4}$/);
    expect(JSON.parse(await readFile(saved, 'utf8'))).toHaveLength(1);
  });

  it('no vende lo que no son zapatillas ni en una tienda que no lo tiene', async () => {
    const purchases = new Purchases({ file: await file(), findProduct: () => ({ ...shoe, type: 'Remera' }) });
    expect(await purchases.create(request, 'http://x')).toMatch(/zapatillas/);
    const only = new Purchases({ file: await file(), findProduct: () => ({ ...shoe, offers: [shoe.offers[1]] }) });
    expect(await only.create(request, 'http://x')).toMatch(/Open Sports ya no lo tiene/);
  });

  it('con Mercado Pago crea la preferencia y confirma el pago al volver', async () => {
    const calls: { url: string; body?: Record<string, unknown> }[] = [];
    const fakeFetch = (async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      calls.push({ url, body: init?.body ? JSON.parse(String(init.body)) : undefined });
      if (url.endsWith('/checkout/preferences')) return Response.json({ init_point: 'https://mp.com/pagar', sandbox_init_point: 'https://sandbox.mp.com/pagar' });
      if (url.includes('/v1/payments/987')) return Response.json({ id: 987, status: 'approved', external_reference: calls[0].body?.external_reference, payment_method_id: 'visa', installments: 3, date_approved: '2026-10-19T20:00:00.000Z' });
      return Response.json({ results: [] });
    }) as typeof fetch;
    const purchases = new Purchases({ file: await file(), accessToken: 'APP_USR-123', findProduct: () => shoe, fetchImpl: fakeFetch });

    const started = await purchases.create(request, 'https://spot.com.ar');
    if (typeof started === 'string') throw new Error(started);
    expect(started.checkoutUrl).toBe('https://mp.com/pagar');
    expect(calls[0].body).toMatchObject({
      external_reference: started.id,
      items: [{ unit_price: 179999, currency_id: 'ARS', quantity: 1 }],
      back_urls: { success: `https://spot.com.ar/ticket/${started.id}` },
      notification_url: 'https://spot.com.ar/api/compras/webhook',
      auto_return: 'approved',
    });

    expect((await purchases.get(started.id))?.status).toBe('pendiente');
    const paid = (await purchases.get(started.id, '987')) as Purchase;
    expect(paid).toMatchObject({ status: 'pagado', paidAt: '2026-10-19T20:00:00.000Z', payment: { provider: 'mercadopago', paymentId: '987', method: 'visa', installments: 3 } });
  });
});
