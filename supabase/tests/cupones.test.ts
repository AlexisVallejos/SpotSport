import { beforeAll, describe, expect, it } from 'vitest';
import { asUser, makeWorld, newUser } from './harness';

type W = Awaited<ReturnType<typeof makeWorld>>;
let w: W;
let couponA: string;

beforeAll(async () => {
  w = await makeWorld();
  couponA = await insertCoupon(w.merchantA, { title: 'Cupón de bienvenida' });
}, 60_000);

type Fields = Partial<{ title: string; code_prefix: string; valid_hours: number; max_claims: number | null; is_active: boolean; starts_at: string; ends_at: string | null }>;

/** Inserta como administrador de base (sin sesión), para armar escenarios. */
async function insertCoupon(merchant: string, fields: Fields = {}): Promise<string> {
  const f = { title: 'Cupón', code_prefix: 'SPOT20', valid_hours: 24, max_claims: null, is_active: true, starts_at: new Date(Date.now() - 3_600_000).toISOString(), ends_at: null, ...fields };
  const r = await w.db.query<{ id: string }>(
    `insert into public.coupons (merchant_id, title, discount_label, code_prefix, destination_url, valid_hours, max_claims, is_active, starts_at, ends_at)
     values ($1, $2, '20% OFF', $3, 'https://tienda.test/?cupon={codigo}', $4, $5, $6, $7, $8) returning id`,
    [merchant, f.title, f.code_prefix, f.valid_hours, f.max_claims, f.is_active, f.starts_at, f.ends_at],
  );
  return r.rows[0].id;
}

type Voucher = { id: string; code: string; expires_at: string; user_id: string };
const claim = (uid: string | null, coupon: string) =>
  asUser(w.db, uid, async () => (await w.db.query<Voucher>(`select * from public.claim_coupon($1)`, [coupon])).rows[0]);
const redirect = (uid: string | null, voucher: string) =>
  asUser(w.db, uid, async () => (await w.db.query<{ voucher_redirect: string }>(`select public.voucher_redirect($1) as voucher_redirect`, [voucher])).rows[0].voucher_redirect);
const visibleCoupons = (uid: string | null) =>
  asUser(w.db, uid, async () => (await w.db.query<{ id: string }>(`select id from public.coupons`)).rows.map((row) => row.id));

describe('quién publica cupones', () => {
  it('un comercio aprobado crea cupones para sí mismo', async () => {
    const r = await asUser(w.db, w.ownerA, () =>
      w.db.query(
        `insert into public.coupons (merchant_id, title, discount_label, code_prefix, destination_url, valid_hours)
         values ($1, 'Mi cupón', '10% OFF', 'MIO10', 'https://runningshop.test/?c={codigo}', 12) returning id`,
        [w.merchantA],
      ),
    );
    expect(r.rows).toHaveLength(1);
  });

  it('no puede crear cupones a nombre de otro comercio', async () => {
    await expect(
      asUser(w.db, w.ownerA, () =>
        w.db.query(`insert into public.coupons (merchant_id, title, discount_label, code_prefix, destination_url, valid_hours) values ($1, 'Ajeno', '5%', 'AJENO5', 'https://x.test/{codigo}', 1)`, [w.merchantB]),
      ),
    ).rejects.toThrow(/row-level security/);
  });

  it('un cliente o un comercio sin aprobar no publican', async () => {
    for (const [uid, merchant] of [[w.customer, w.merchantA], [w.ownerPending, w.merchantPending]] as const) {
      await expect(
        asUser(w.db, uid, () =>
          w.db.query(`insert into public.coupons (merchant_id, title, discount_label, code_prefix, destination_url, valid_hours) values ($1, 'Nada', '5%', 'NADA5', 'https://x.test/{codigo}', 1)`, [merchant]),
        ),
      ).rejects.toThrow(/row-level security/);
    }
  });

  it('el link de destino debe ser https y sin espacios', async () => {
    for (const url of ['http://inseguro.test/{codigo}', 'javascript:alert(1)', 'https://con espacio.test/{codigo}']) {
      await expect(
        asUser(w.db, w.ownerA, () =>
          w.db.query(`insert into public.coupons (merchant_id, title, discount_label, code_prefix, destination_url, valid_hours) values ($1, 'Url', '5%', 'URL5', $2, 1)`, [w.merchantA, url]),
        ),
      ).rejects.toThrow(/destination_url/);
    }
  });

  it('el comercio no puede tocar el contador de cupones emitidos', async () => {
    await expect(asUser(w.db, w.ownerA, () => w.db.query(`update public.coupons set claims_count = 99 where id = $1`, [couponA]))).rejects.toThrow(/No autorizado/);
  });
});

describe('quién ve los cupones', () => {
  it('cualquiera ve los activos de comercios aprobados; no ve inactivos, vencidos, futuros ni de comercios sin aprobar', async () => {
    const inactive = await insertCoupon(w.merchantA, { is_active: false });
    const expired = await insertCoupon(w.merchantA, { ends_at: new Date(Date.now() - 1000).toISOString(), starts_at: new Date(Date.now() - 7_200_000).toISOString() });
    const future = await insertCoupon(w.merchantA, { starts_at: new Date(Date.now() + 3_600_000).toISOString() });
    const pending = await insertCoupon(w.merchantPending);

    const anon = await visibleCoupons(null);
    expect(anon).toContain(couponA);
    for (const hidden of [inactive, expired, future, pending]) expect(anon).not.toContain(hidden);

    // El dueño sí ve los suyos aunque no estén publicados.
    const own = await visibleCoupons(w.ownerA);
    for (const mine of [inactive, expired, future]) expect(own).toContain(mine);
    // Otro comercio no.
    expect(await visibleCoupons(w.ownerB)).not.toContain(inactive);
  });
});

describe('cupones de campañas terminadas', () => {
  it('quien ya obtuvo el voucher sigue viendo el cupón aunque la campaña haya terminado', async () => {
    const id = await insertCoupon(w.merchantB, { code_prefix: 'FIN10' });
    const holder = await newUser(w.db, 'holder@spot.test');
    await claim(holder, id);
    await w.db.query(`update public.coupons set ends_at = now() - interval '1 second', starts_at = now() - interval '2 hours' where id = $1`, [id]);
    expect(await visibleCoupons(holder)).toContain(id);
    expect(await visibleCoupons(w.customer)).not.toContain(id);
    expect(await visibleCoupons(null)).not.toContain(id);
  });
});

describe('obtener el cupón (voucher)', () => {
  it('genera un voucher personal con código y vencimiento', async () => {
    const before = Date.now();
    const v = await claim(w.customer, couponA);
    expect(v.code).toMatch(/^SPOT20-[A-F0-9]{6}$/);
    const hours = (new Date(v.expires_at).getTime() - before) / 3_600_000;
    expect(hours).toBeGreaterThan(23.9);
    expect(hours).toBeLessThan(24.1);
    const count = await w.db.query<{ claims_count: number }>(`select claims_count from public.coupons where id = $1`, [couponA]);
    expect(count.rows[0].claims_count).toBe(1);
  });

  it('si ya tiene uno vigente, devuelve el mismo y no suma', async () => {
    const first = await claim(w.customer, couponA);
    const second = await claim(w.customer, couponA);
    expect(second.id).toBe(first.id);
    const count = await w.db.query<{ claims_count: number }>(`select claims_count from public.coupons where id = $1`, [couponA]);
    expect(count.rows[0].claims_count).toBe(1);
  });

  it('cuando venció, puede obtener uno nuevo', async () => {
    const old = await claim(w.customer, couponA);
    await w.db.query(`update public.vouchers set expires_at = now() - interval '1 minute' where id = $1`, [old.id]);
    const fresh = await claim(w.customer, couponA);
    expect(fresh.id).not.toBe(old.id);
    expect(fresh.code).not.toBe(old.code);
  });

  it('sin sesión no se puede', async () => {
    await expect(claim(null, couponA)).rejects.toThrow(/permission denied|Iniciá sesión/);
  });

  it('no se puede obtener un cupón del propio comercio', async () => {
    await expect(claim(w.ownerA, couponA)).rejects.toThrow(/propio comercio/);
  });

  it('no se obtiene un cupón inactivo, de un comercio sin aprobar ni agotado', async () => {
    const inactive = await insertCoupon(w.merchantA, { is_active: false });
    const pending = await insertCoupon(w.merchantPending);
    await expect(claim(w.customer, inactive)).rejects.toThrow(/ya no está disponible/);
    await expect(claim(w.customer, pending)).rejects.toThrow(/ya no está disponible/);

    const limited = await insertCoupon(w.merchantB, { code_prefix: 'LIMIT1', max_claims: 1 });
    const other = await newUser(w.db, 'otro@spot.test');
    await claim(other, limited);
    await expect(claim(w.admin, limited)).rejects.toThrow(/Se agotaron/);
    // Quien ya lo tiene sigue viéndolo aunque se haya agotado.
    expect((await claim(other, limited)).code).toMatch(/^LIMIT1-/);
  });
});

describe('ir a la web del comercio', () => {
  it('arma el link con el código y cuenta el click', async () => {
    const v = await claim(w.customer, couponA);
    const url = await redirect(w.customer, v.id);
    expect(url).toBe(`https://tienda.test/?cupon=${v.code}`);
    await redirect(w.customer, v.id);
    const r = await w.db.query<{ clicks: number }>(`select clicks from public.vouchers where id = $1`, [v.id]);
    expect(r.rows[0].clicks).toBe(2);
  });

  it('no sirve con un voucher vencido ni con el de otra persona', async () => {
    const v = await claim(w.customer, couponA);
    await expect(redirect(w.admin, v.id)).rejects.toThrow(/No encontramos/);
    await w.db.query(`update public.vouchers set expires_at = now() - interval '1 second' where id = $1`, [v.id]);
    await expect(redirect(w.customer, v.id)).rejects.toThrow(/venció/);
  });
});

describe('quién ve los vouchers', () => {
  it('cada persona ve los suyos; el comercio dueño del cupón también; otro comercio no', async () => {
    const mine = await claim(w.customer, couponA);
    const ids = (uid: string | null) => asUser(w.db, uid, async () => (await w.db.query<{ id: string }>(`select id from public.vouchers`)).rows.map((row) => row.id));

    expect(await ids(w.customer)).toContain(mine.id);
    expect(await ids(w.ownerA)).toContain(mine.id);
    expect(await ids(w.ownerB)).not.toContain(mine.id);
    expect(await ids(w.admin)).toContain(mine.id);
    await expect(ids(null)).rejects.toThrow(/permission denied/);
  });

  it('nadie crea ni edita vouchers a mano', async () => {
    await expect(
      asUser(w.db, w.customer, () => w.db.query(`insert into public.vouchers (coupon_id, user_id, code, expires_at) values ($1, $2, 'FALSO-000000', now() + interval '1 day')`, [couponA, w.customer])),
    ).rejects.toThrow(/permission denied/);
    await expect(asUser(w.db, w.customer, () => w.db.query(`update public.vouchers set expires_at = now() + interval '1 year'`))).rejects.toThrow(/permission denied/);
  });
});
