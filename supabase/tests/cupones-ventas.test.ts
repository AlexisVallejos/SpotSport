import { beforeAll, describe, expect, it } from 'vitest';
import { asUser, makeWorld, newUser } from './harness';

type W = Awaited<ReturnType<typeof makeWorld>>;
let w: W;
let couponA: string;
let couponB: string;
let buyer: string;

beforeAll(async () => {
  w = await makeWorld();
  couponA = await insertCoupon(w.merchantA, 'RUN10');
  couponB = await insertCoupon(w.merchantB, 'FUT15');
  buyer = await newUser(w.db, 'comprador@spot.test', 'Comprador');
}, 60_000);

async function insertCoupon(merchant: string, prefix: string): Promise<string> {
  const r = await w.db.query<{ id: string }>(
    `insert into public.coupons (merchant_id, title, discount_label, code_prefix, destination_url, valid_hours)
     values ($1, 'Cupón ' || $2, '10% OFF', $2, 'https://tienda.test/?c={codigo}', 24) returning id`,
    [merchant, prefix],
  );
  return r.rows[0].id;
}

type Voucher = { id: string; code: string };
const claim = (uid: string, coupon: string) => asUser(w.db, uid, async () => (await w.db.query<Voucher>(`select * from public.claim_coupon($1)`, [coupon])).rows[0]);
const visit = (uid: string, voucher: string) => asUser(w.db, uid, () => w.db.query(`select public.voucher_redirect($1)`, [voucher]));
const sell = (uid: string | null, code: string, cents: number) =>
  asUser(w.db, uid, async () =>
    (await w.db.query<{ id: string; amount_cents: string; commission_percent: string; commission_cents: string; status: string }>(`select * from public.register_voucher_sale($1, $2)`, [code, cents])).rows[0],
  );
const stats = (uid: string) => asUser(w.db, uid, async () => (await w.db.query<{ s: any }>(`select public.merchant_coupon_stats(7) as s`)).rows[0].s);

describe('comisión', () => {
  it('por defecto es 5 % y el comercio la ve', async () => {
    const r = await asUser(w.db, w.ownerA, () => w.db.query<{ p: string }>(`select public.commission_rate($1) as p`, [w.merchantA]));
    expect(Number(r.rows[0].p)).toBe(5);
  });

  it('el comercio no puede cambiarse su propio porcentaje, el admin sí', async () => {
    await expect(asUser(w.db, w.ownerA, () => w.db.query(`update public.merchants set commission_percent = 0 where id = $1`, [w.merchantA]))).rejects.toThrow(/No autorizado/);
    await asUser(w.db, w.admin, () => w.db.query(`update public.merchants set commission_percent = 8.5 where id = $1`, [w.merchantB]));
    const r = await w.db.query<{ p: string }>(`select public.commission_rate($1) as p`, [w.merchantB]);
    expect(Number(r.rows[0].p)).toBe(8.5);
    await w.db.query(`update public.merchants set commission_percent = null where id = $1`, [w.merchantB]);
  });

  it('el porcentaje tiene que estar entre 0 y 50', async () => {
    await expect(w.db.query(`update public.merchants set commission_percent = 60 where id = $1`, [w.merchantA])).rejects.toThrow(/commission_percent/);
  });
});

describe('registrar una venta', () => {
  it('calcula la comisión en la base y la congela', async () => {
    const v = await claim(buyer, couponA);
    const sale = await sell(w.ownerA, v.code, 2_500_000); // $ 25.000
    expect(Number(sale.amount_cents)).toBe(2_500_000);
    expect(Number(sale.commission_percent)).toBe(5);
    expect(Number(sale.commission_cents)).toBe(125_000); // $ 1.250
    expect(sale.status).toBe('pending');

    // Cambiar el porcentaje después no toca lo ya vendido.
    await w.db.query(`update public.site_settings set value = '{"percent": 12}' where key = 'commission'`);
    const again = await w.db.query<{ commission_percent: string; commission_cents: string }>(`select commission_percent, commission_cents from public.voucher_sales where id = $1`, [sale.id]);
    expect(Number(again.rows[0].commission_percent)).toBe(5);
    expect(Number(again.rows[0].commission_cents)).toBe(125_000);
    await w.db.query(`update public.site_settings set value = '{"percent": 5}' where key = 'commission'`);
  });

  it('acepta el código sin importar mayúsculas ni espacios', async () => {
    const other = await newUser(w.db, 'otro-comprador@spot.test');
    const v = await claim(other, couponA);
    const sale = await sell(w.ownerA, `  ${v.code.toLowerCase()} `, 100_000);
    expect(sale.status).toBe('pending');
  });

  it('una venta por voucher', async () => {
    const other = await newUser(w.db, 'doble@spot.test');
    const v = await claim(other, couponA);
    await sell(w.ownerA, v.code, 100_000);
    await expect(sell(w.ownerA, v.code, 100_000)).rejects.toThrow(/ya se registró/);
  });

  it('un comercio no registra ventas de cupones de otro', async () => {
    const other = await newUser(w.db, 'cruzado@spot.test');
    const v = await claim(other, couponA);
    await expect(sell(w.ownerB, v.code, 100_000)).rejects.toThrow(/No encontramos ese código/);
  });

  it('solo comercios aprobados; el monto tiene que ser válido', async () => {
    const other = await newUser(w.db, 'monto@spot.test');
    const v = await claim(other, couponA);
    await expect(sell(w.customer, v.code, 100_000)).rejects.toThrow(/comercio aprobado/);
    await expect(sell(w.ownerPending, v.code, 100_000)).rejects.toThrow(/comercio aprobado/);
    await expect(sell(null, v.code, 100_000)).rejects.toThrow(/permission denied/);
    await expect(sell(w.ownerA, v.code, 0)).rejects.toThrow(/monto/);
    await expect(sell(w.ownerA, v.code, -5)).rejects.toThrow(/monto/);
  });

  it('se acepta hasta 3 días después del vencimiento, no más', async () => {
    const other = await newUser(w.db, 'tarde@spot.test');
    const v = await claim(other, couponA);
    await w.db.query(`update public.vouchers set expires_at = now() - interval '2 days' where id = $1`, [v.id]);
    expect((await sell(w.ownerA, v.code, 100_000)).status).toBe('pending');

    const late = await newUser(w.db, 'muy-tarde@spot.test');
    const v2 = await claim(late, couponA);
    await w.db.query(`update public.vouchers set expires_at = now() - interval '4 days' where id = $1`, [v2.id]);
    await expect(sell(w.ownerA, v2.code, 100_000)).rejects.toThrow(/venció hace más de 3 días/);
  });

  it('borrar el cupón no borra la venta ni la comisión', async () => {
    const tmp = await insertCoupon(w.merchantA, 'TMP5');
    const other = await newUser(w.db, 'borrar@spot.test');
    const v = await claim(other, tmp);
    const sale = await sell(w.ownerA, v.code, 1_000_000);
    await asUser(w.db, w.ownerA, () => w.db.query(`delete from public.coupons where id = $1`, [tmp]));
    const r = await w.db.query<{ coupon_id: string | null; code: string; commission_cents: string }>(`select coupon_id, code, commission_cents from public.voucher_sales where id = $1`, [sale.id]);
    expect(r.rows[0].coupon_id).toBeNull();
    expect(r.rows[0].code).toBe(v.code);
    expect(Number(r.rows[0].commission_cents)).toBe(50_000);
  });

  it('nadie escribe ventas ni clicks a mano', async () => {
    await expect(asUser(w.db, w.ownerA, () => w.db.query(`update public.voucher_sales set commission_cents = 0`))).rejects.toThrow(/permission denied/);
    await expect(asUser(w.db, w.ownerA, () => w.db.query(`insert into public.voucher_clicks (voucher_id, coupon_id) select id, coupon_id from public.vouchers limit 1`))).rejects.toThrow(/permission denied/);
    await expect(asUser(w.db, w.ownerA, () => w.db.query(`select * from public.voucher_clicks`))).rejects.toThrow(/permission denied/);
  });
});

describe('quién ve las ventas', () => {
  it('el comercio ve las suyas, otro no, el admin todas', async () => {
    const mineSeen = await asUser(w.db, w.ownerA, async () => (await w.db.query(`select merchant_id from public.voucher_sales`)).rows);
    expect(mineSeen.length).toBeGreaterThan(0);
    expect(mineSeen.every((row) => row.merchant_id === w.merchantA)).toBe(true);
    const others = await asUser(w.db, w.ownerB, async () => (await w.db.query(`select 1 from public.voucher_sales`)).rows);
    expect(others).toHaveLength(0);
    const buyerSeen = await asUser(w.db, buyer, async () => (await w.db.query(`select 1 from public.voucher_sales`)).rows);
    expect(buyerSeen).toHaveLength(0);
    const adminSeen = await asUser(w.db, w.admin, async () => (await w.db.query(`select 1 from public.voucher_sales`)).rows);
    expect(adminSeen.length).toBeGreaterThanOrEqual(mineSeen.length);
  });
});

describe('estadísticas del comercio', () => {
  it('cuentan clicks, personas distintas y ventas; solo las del propio comercio', async () => {
    const shopper = await newUser(w.db, 'stats@spot.test');
    const v = await claim(shopper, couponB);
    await visit(shopper, v.id);
    await visit(shopper, v.id);
    const other = await newUser(w.db, 'stats2@spot.test');
    await claim(other, couponB); // obtiene pero no entra
    await sell(w.ownerB, v.code, 4_000_000);

    const s = await stats(w.ownerB);
    expect(Number(s.totals.claims)).toBe(2);
    expect(Number(s.totals.clicks)).toBe(2);
    expect(Number(s.totals.unique_clickers)).toBe(1);
    expect(Number(s.totals.sales)).toBe(1);
    expect(Number(s.totals.sales_cents)).toBe(4_000_000);
    expect(Number(s.totals.commission_cents)).toBe(200_000);
    expect(Number(s.totals.commission_pending_cents)).toBe(200_000);
    expect(s.commission_percent).toBe(5);

    expect(s.daily).toHaveLength(7);
    const last = s.daily[s.daily.length - 1];
    expect(Number(last.clicks)).toBe(2);
    expect(Number(last.claims)).toBe(2);
    expect(Number(last.sales_cents)).toBe(4_000_000);

    expect(s.coupons).toHaveLength(1);
    expect(s.coupons[0].title).toBe('Cupón FUT15');
    expect(Number(s.coupons[0].unique_clickers)).toBe(1);
  });

  it('un cliente sin comercio no puede pedirlas', async () => {
    await expect(stats(w.customer)).rejects.toThrow(/No tenés un comercio/);
  });
});

describe('administración', () => {
  it('ve el resumen por comercio y marca comisiones como cobradas', async () => {
    const overview = await asUser(w.db, w.admin, async () => (await w.db.query<{ o: any }>(`select public.admin_coupon_overview(30) as o`)).rows[0].o);
    expect(Number(overview.default_percent)).toBe(5);
    const mine = overview.merchants.find((m: any) => m.id === w.merchantA);
    expect(Number(mine.commission_pending_cents)).toBeGreaterThan(0);
    expect(Number(overview.overall.totals.sales)).toBeGreaterThanOrEqual(2);

    const settled = await asUser(w.db, w.admin, async () => (await w.db.query<{ n: number }>(`select public.admin_settle_merchant($1) as n`, [w.merchantA])).rows[0].n);
    expect(settled).toBeGreaterThan(0);
    const after = await w.db.query<{ n: string }>(`select count(*) as n from public.voucher_sales where merchant_id = $1 and status = 'pending'`, [w.merchantA]);
    expect(Number(after.rows[0].n)).toBe(0);
  });

  it('anular una venta la saca de los totales', async () => {
    const before = await stats(w.ownerB);
    const saleId = (await w.db.query<{ id: string }>(`select id from public.voucher_sales where merchant_id = $1 limit 1`, [w.merchantB])).rows[0].id;
    await asUser(w.db, w.admin, () => w.db.query(`select public.admin_set_sale_status($1, 'void')`, [saleId]));
    const after = await stats(w.ownerB);
    expect(Number(after.totals.sales)).toBe(Number(before.totals.sales) - 1);
    expect(Number(after.totals.commission_cents)).toBe(0);
  });

  it('nada de esto lo puede hacer un comercio ni un cliente', async () => {
    for (const uid of [w.ownerA, w.customer]) {
      await expect(asUser(w.db, uid, () => w.db.query(`select public.admin_coupon_overview(30)`))).rejects.toThrow(/No autorizado/);
      await expect(asUser(w.db, uid, () => w.db.query(`select public.admin_settle_merchant($1)`, [w.merchantA]))).rejects.toThrow(/No autorizado/);
    }
    await expect(asUser(w.db, w.ownerA, () => w.db.query(`select public._coupon_stats(null, 30)`))).rejects.toThrow(/permission denied/);
  });
});
