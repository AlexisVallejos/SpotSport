import { beforeAll, describe, expect, it } from 'vitest';
import { asUser, makeWorld, newUser } from './harness';

type W = Awaited<ReturnType<typeof makeWorld>>;
let w: W;

beforeAll(async () => {
  w = await makeWorld();
}, 60_000);

const shipping = { name: 'Cliente Prueba', address: 'Calle 123', city: 'Mar del Plata', phone: '2235550000' };
const items = (...rows: [string, number][]) => JSON.stringify(rows.map(([variant_id, quantity]) => ({ variant_id, quantity })));

async function stockOf(variant: string) {
  return Number((await w.db.query<{ stock: number }>(`select stock from public.product_variants where id = $1`, [variant])).rows[0].stock);
}

async function restock(variant: string, stock = 20) {
  await w.db.query(`update public.product_variants set stock = $2 where id = $1`, [variant, stock]);
}

async function placeOrder(uid: string | null, itemList: string, payment = 'cash_on_delivery', ship: object = shipping) {
  return asUser(w.db, uid, async () => {
    const r = await w.db.query<{ place_order: string }>(`select public.place_order($1::jsonb, $2::jsonb, $3::public.payment_method) as place_order`, [itemList, JSON.stringify(ship), payment]);
    return r.rows[0].place_order;
  });
}

describe('cuentas y perfiles', () => {
  it('crea el perfil al registrarse', async () => {
    const id = await newUser(w.db, 'nueva@spot.test', 'Nueva Persona');
    const r = await w.db.query<{ full_name: string; is_admin: boolean }>(`select full_name, is_admin from public.profiles where id = $1`, [id]);
    expect(r.rows[0]).toEqual({ full_name: 'Nueva Persona', is_admin: false });
  });

  it('nadie se hace admin solo', async () => {
    await expect(asUser(w.db, w.customer, () => w.db.query(`update public.profiles set is_admin = true where id = $1`, [w.customer]))).rejects.toThrow(/No autorizado/);
    const r = await w.db.query<{ is_admin: boolean }>(`select is_admin from public.profiles where id = $1`, [w.customer]);
    expect(r.rows[0].is_admin).toBe(false);
  });

  it('un admin sí puede promover a otra cuenta', async () => {
    const id = await newUser(w.db, 'segundo-admin@spot.test');
    await asUser(w.db, w.admin, () => w.db.query(`update public.profiles set is_admin = true where id = $1`, [id]));
    const r = await w.db.query<{ is_admin: boolean }>(`select is_admin from public.profiles where id = $1`, [id]);
    expect(r.rows[0].is_admin).toBe(true);
  });

  it('cada cuenta edita su perfil pero no el email', async () => {
    await asUser(w.db, w.customer, () => w.db.query(`update public.profiles set full_name = 'Nombre Nuevo', phone = '123' where id = $1`, [w.customer]));
    await expect(asUser(w.db, w.customer, () => w.db.query(`update public.profiles set email = 'otro@x.com' where id = $1`, [w.customer]))).rejects.toThrow(/email/);
  });

  it('cada cuenta ve solo su perfil; el admin ve todos; sin sesión no se ve nada', async () => {
    const own = await asUser(w.db, w.customer, () => w.db.query(`select id from public.profiles`));
    expect(own.rows).toHaveLength(1);
    const all = await asUser(w.db, w.admin, () => w.db.query(`select id from public.profiles`));
    expect(all.rows.length).toBeGreaterThan(4);
    await expect(asUser(w.db, null, () => w.db.query(`select id from public.profiles`))).rejects.toThrow();
  });
});

describe('afiliación de comercios', () => {
  it('un cliente pide afiliarse y queda pendiente', async () => {
    const id = await newUser(w.db, 'quiere-vender@spot.test');
    await asUser(w.db, id, () => w.db.query(`insert into public.merchants (owner_id, name, slug) values ($1, 'Mi Tienda', 'mi-tienda')`, [id]));
    const r = await w.db.query<{ status: string }>(`select status from public.merchants where owner_id = $1`, [id]);
    expect(r.rows[0].status).toBe('pending');
  });

  it('no puede crearse ya aprobado ni a nombre de otro', async () => {
    const id = await newUser(w.db, 'tramposo@spot.test');
    await expect(asUser(w.db, id, () => w.db.query(`insert into public.merchants (owner_id, name, slug, status) values ($1, 'Trampa', 'trampa', 'approved')`, [id]))).rejects.toThrow();
    await expect(asUser(w.db, id, () => w.db.query(`insert into public.merchants (owner_id, name, slug) values ($1, 'Ajeno', 'ajeno')`, [w.customer]))).rejects.toThrow();
  });

  it('una cuenta no puede tener dos comercios', async () => {
    await expect(asUser(w.db, w.ownerA, () => w.db.query(`insert into public.merchants (owner_id, name, slug) values ($1, 'Otro', 'otro-a')`, [w.ownerA]))).rejects.toThrow();
  });

  it('el dueño no se auto-aprueba, pero sí edita sus datos', async () => {
    await expect(asUser(w.db, w.ownerPending, () => w.db.query(`update public.merchants set status = 'approved' where id = $1`, [w.merchantPending]))).rejects.toThrow(/administrador/);
    await asUser(w.db, w.ownerPending, () => w.db.query(`update public.merchants set description = 'Vendemos de todo' where id = $1`, [w.merchantPending]));
    const r = await w.db.query<{ description: string }>(`select description from public.merchants where id = $1`, [w.merchantPending]);
    expect(r.rows[0].description).toBe('Vendemos de todo');
  });

  it('solo el admin aprueba, rechaza y suspende', async () => {
    await expect(asUser(w.db, w.ownerPending, () => w.db.query(`select public.review_merchant($1, 'approved')`, [w.merchantPending]))).rejects.toThrow(/No autorizado/);
    await asUser(w.db, w.admin, () => w.db.query(`select public.review_merchant($1, 'rejected', 'Falta información')`, [w.merchantPending]));
    const r = await w.db.query<{ status: string; rejection_reason: string; reviewed_by: string }>(`select status, rejection_reason, reviewed_by from public.merchants where id = $1`, [w.merchantPending]);
    expect(r.rows[0]).toMatchObject({ status: 'rejected', rejection_reason: 'Falta información', reviewed_by: w.admin });
  });

  it('un comercio rechazado puede volver a pedir la afiliación', async () => {
    await asUser(w.db, w.ownerPending, () => w.db.query(`update public.merchants set status = 'pending' where id = $1`, [w.merchantPending]));
    const r = await w.db.query<{ status: string }>(`select status from public.merchants where id = $1`, [w.merchantPending]);
    expect(r.rows[0].status).toBe('pending');
  });

  it('el público ve solo comercios aprobados', async () => {
    const r = await asUser(w.db, null, () => w.db.query<{ slug: string }>(`select slug from public.merchants order by slug`));
    expect(r.rows.map((row) => row.slug)).toEqual(['futbol-total', 'running-shop']);
  });
});

describe('catálogo', () => {
  it('el público ve productos de comercios aprobados, no los de pendientes', async () => {
    const r = await asUser(w.db, null, () => w.db.query<{ name: string }>(`select name from public.products order by name`));
    expect(r.rows.map((row) => row.name)).toEqual(['Botín Cancha', 'Zapatilla Ruta']);
    const v = await asUser(w.db, null, () => w.db.query(`select id from public.product_variants`));
    expect(v.rows).toHaveLength(2);
  });

  it('un comercio suspendido desaparece del catálogo y se recupera al reabrirse', async () => {
    await asUser(w.db, w.admin, () => w.db.query(`select public.review_merchant($1, 'suspended', 'Reclamos')`, [w.merchantB]));
    const hidden = await asUser(w.db, null, () => w.db.query(`select id from public.products`));
    expect(hidden.rows).toHaveLength(1);
    await asUser(w.db, w.admin, () => w.db.query(`select public.review_merchant($1, 'approved')`, [w.merchantB]));
    const back = await asUser(w.db, null, () => w.db.query(`select id from public.products`));
    expect(back.rows).toHaveLength(2);
  });

  it('un producto desactivado no se ve en la tienda pero sí en el panel del comercio', async () => {
    const extra = await w.product(w.merchantA, 'Producto Pausado', 100, 1);
    await w.db.query(`update public.products set is_active = false where id = $1`, [extra.product]);
    const publicView = await asUser(w.db, null, () => w.db.query(`select id from public.products where id = $1`, [extra.product]));
    expect(publicView.rows).toHaveLength(0);
    const owner = await asUser(w.db, w.ownerA, () => w.db.query(`select id from public.products where id = $1`, [extra.product]));
    expect(owner.rows).toHaveLength(1);
  });

  it('el comercio aprobado crea productos y variantes propios', async () => {
    await asUser(w.db, w.ownerA, async () => {
      const p = await w.db.query<{ id: string }>(`insert into public.products (merchant_id, name) values ($1, 'Remera Aire') returning id`, [w.merchantA]);
      await w.db.query(`insert into public.product_variants (product_id, size, color, price_cents, stock) values ($1, 'M', 'Blanco', 8000, 4)`, [p.rows[0].id]);
    });
  });

  it('no puede publicar en otro comercio ni tocar sus variantes', async () => {
    await expect(asUser(w.db, w.ownerA, () => w.db.query(`insert into public.products (merchant_id, name) values ($1, 'Intruso')`, [w.merchantB]))).rejects.toThrow();
    await asUser(w.db, w.ownerA, () => w.db.query(`update public.product_variants set price_cents = 1 where id = $1`, [w.b.variant]));
    const r = await w.db.query<{ price_cents: number }>(`select price_cents from public.product_variants where id = $1`, [w.b.variant]);
    expect(r.rows[0].price_cents).toBe(25000);
    await expect(asUser(w.db, w.ownerA, () => w.db.query(`insert into public.product_variants (product_id, size, color, price_cents) values ($1, 'X', 'Y', 1)`, [w.b.product]))).rejects.toThrow();
  });

  it('un comercio pendiente no puede publicar', async () => {
    await expect(asUser(w.db, w.ownerPending, () => w.db.query(`insert into public.products (merchant_id, name) values ($1, 'Aún no')`, [w.merchantPending]))).rejects.toThrow();
  });

  it('solo el admin destaca productos', async () => {
    await expect(asUser(w.db, w.ownerA, () => w.db.query(`update public.products set featured = true where id = $1`, [w.a.product]))).rejects.toThrow(/destacar/);
    await asUser(w.db, w.admin, () => w.db.query(`update public.products set featured = true where id = $1`, [w.a.product]));
    const r = await w.db.query<{ featured: boolean }>(`select featured from public.products where id = $1`, [w.a.product]);
    expect(r.rows[0].featured).toBe(true);
  });

  it('precio y stock no pueden ser negativos', async () => {
    await expect(w.db.query(`update public.product_variants set stock = -1 where id = $1`, [w.a.variant])).rejects.toThrow();
    await expect(w.db.query(`update public.product_variants set price_cents = -5 where id = $1`, [w.a.variant])).rejects.toThrow();
  });
});

describe('compras', () => {
  it('sin sesión no se puede comprar', async () => {
    await expect(placeOrder(null, items([w.a.variant, 1]))).rejects.toThrow();
  });

  it('descuenta stock, toma el precio de la base y separa un pedido por comercio', async () => {
    const stockA = await stockOf(w.a.variant);
    const stockB = await stockOf(w.b.variant);
    const checkout = await placeOrder(w.customer, items([w.a.variant, 2], [w.b.variant, 1]));

    const orders = await w.db.query<{ merchant_id: string; total_cents: number; status: string; payment_status: string }>(
      `select merchant_id, total_cents, status, payment_status from public.orders where checkout_id = $1 order by total_cents`, [checkout]);
    expect(orders.rows).toHaveLength(2);
    expect(orders.rows.map((o) => o.total_cents)).toEqual([20000, 25000]);
    expect(orders.rows.every((o) => o.status === 'pending' && o.payment_status === 'unpaid')).toBe(true);
    expect(await stockOf(w.a.variant)).toBe(stockA - 2);
    expect(await stockOf(w.b.variant)).toBe(stockB - 1);

    const lines = await w.db.query<{ product_name: string; unit_price_cents: number; quantity: number; line_total_cents: number }>(
      `select i.product_name, i.unit_price_cents, i.quantity, i.line_total_cents from public.order_items i join public.orders o on o.id = i.order_id where o.checkout_id = $1 order by 1`, [checkout]);
    expect(lines.rows).toEqual([
      { product_name: 'Botín Cancha', unit_price_cents: 25000, quantity: 1, line_total_cents: 25000 },
      { product_name: 'Zapatilla Ruta', unit_price_cents: 10000, quantity: 2, line_total_cents: 20000 },
    ]);
  });

  it('rechaza todo el pedido si falta stock y no toca nada', async () => {
    const fresh = await w.product(w.merchantA, 'Edición Limitada', 9000, 2);
    const other = await stockOf(w.a.variant);
    await expect(placeOrder(w.customer, items([w.a.variant, 1], [fresh.variant, 3]))).rejects.toThrow(/stock/);
    expect(await stockOf(fresh.variant)).toBe(2);
    expect(await stockOf(w.a.variant)).toBe(other);
  });

  it('no deja pasarse del stock en dos líneas de la misma variante', async () => {
    const fresh = await w.product(w.merchantA, 'Última Unidad', 4000, 1);
    await expect(placeOrder(w.customer, items([fresh.variant, 1], [fresh.variant, 1]))).rejects.toThrow(/stock/);
    expect(await stockOf(fresh.variant)).toBe(1);
  });

  it('valida cantidades, carrito vacío, datos de entrega y productos no disponibles', async () => {
    await expect(placeOrder(w.customer, items([w.a.variant, 0]))).rejects.toThrow(/Cantidad/);
    await expect(placeOrder(w.customer, '[]')).rejects.toThrow(/vacío/);
    await expect(placeOrder(w.customer, items([w.a.variant, 1]), 'cash_on_delivery', { name: 'X', phone: '1' })).rejects.toThrow(/dirección/);
    await expect(placeOrder(w.customer, items([w.pending.variant, 1]))).rejects.toThrow(/disponible/);
    await expect(placeOrder(w.customer, items([w.a.variant, 1]), 'mercado_pago')).rejects.toThrow(/Mercado Pago/);
  });

  it('retiro en el local no exige dirección', async () => {
    const checkout = await placeOrder(w.customer, items([w.a.variant, 1]), 'pickup', { name: 'Cliente', phone: '123' });
    expect(checkout).toBeTruthy();
  });

  it('un comercio no puede comprarse a sí mismo', async () => {
    await expect(placeOrder(w.ownerA, items([w.a.variant, 1]))).rejects.toThrow(/propio comercio/);
  });

  it('no se puede crear ni editar un pedido a mano', async () => {
    await expect(asUser(w.db, w.customer, () => w.db.query(
      `insert into public.orders (checkout_id, customer_id, merchant_id, payment_method) values (gen_random_uuid(), $1, $2, 'pickup')`, [w.customer, w.merchantA]))).rejects.toThrow();
    await expect(asUser(w.db, w.customer, () => w.db.query(`update public.orders set total_cents = 0`))).rejects.toThrow();
  });
});

describe('pedidos', () => {
  let order: { id: string; merchant: string };

  beforeAll(async () => {
    await restock(w.a.variant);
    const checkout = await placeOrder(w.customer, items([w.a.variant, 1]));
    const r = await w.db.query<{ id: string; merchant_id: string }>(`select id, merchant_id from public.orders where checkout_id = $1`, [checkout]);
    order = { id: r.rows[0].id, merchant: r.rows[0].merchant_id };
  });

  it('cada quien ve solo lo suyo', async () => {
    const mine = await asUser(w.db, w.customer, () => w.db.query(`select id from public.orders where id = $1`, [order.id]));
    expect(mine.rows).toHaveLength(1);
    const merchant = await asUser(w.db, w.ownerA, () => w.db.query(`select id from public.orders where id = $1`, [order.id]));
    expect(merchant.rows).toHaveLength(1);
    const other = await asUser(w.db, w.ownerB, () => w.db.query(`select id from public.orders where id = $1`, [order.id]));
    expect(other.rows).toHaveLength(0);
    const stranger = await asUser(w.db, w.ownerPending, () => w.db.query(`select id from public.orders where id = $1`, [order.id]));
    expect(stranger.rows).toHaveLength(0);
    const lines = await asUser(w.db, w.ownerB, () => w.db.query(`select id from public.order_items where order_id = $1`, [order.id]));
    expect(lines.rows).toHaveLength(0);
    const adminView = await asUser(w.db, w.admin, () => w.db.query(`select id from public.orders where id = $1`, [order.id]));
    expect(adminView.rows).toHaveLength(1);
  });

  it('el cliente no puede preparar su pedido ni otro comercio gestionarlo', async () => {
    await expect(asUser(w.db, w.customer, () => w.db.query(`select public.set_order_status($1, 'preparing')`, [order.id]))).rejects.toThrow(/No autorizado/);
    await expect(asUser(w.db, w.ownerB, () => w.db.query(`select public.set_order_status($1, 'preparing')`, [order.id]))).rejects.toThrow(/No autorizado/);
  });

  it('el comercio avanza el pedido paso a paso y no se puede saltear', async () => {
    await expect(asUser(w.db, w.ownerA, () => w.db.query(`select public.set_order_status($1, 'delivered')`, [order.id]))).rejects.toThrow(/No se puede pasar/);
    for (const status of ['preparing', 'shipped', 'delivered']) {
      await asUser(w.db, w.ownerA, () => w.db.query(`select public.set_order_status($1, $2::public.order_status)`, [order.id, status]));
    }
    const r = await w.db.query<{ status: string }>(`select status from public.orders where id = $1`, [order.id]);
    expect(r.rows[0].status).toBe('delivered');
  });

  it('el comercio registra el cobro; el cliente no', async () => {
    await expect(asUser(w.db, w.customer, () => w.db.query(`select public.mark_order_paid($1)`, [order.id]))).rejects.toThrow(/No autorizado/);
    await asUser(w.db, w.ownerA, () => w.db.query(`select public.mark_order_paid($1)`, [order.id]));
    const r = await w.db.query<{ payment_status: string }>(`select payment_status from public.orders where id = $1`, [order.id]);
    expect(r.rows[0].payment_status).toBe('paid');
  });

  it('el cliente cancela mientras está pendiente y el stock vuelve', async () => {
    await restock(w.a.variant);
    const before = await stockOf(w.a.variant);
    const checkout = await placeOrder(w.customer, items([w.a.variant, 2]));
    const id = (await w.db.query<{ id: string }>(`select id from public.orders where checkout_id = $1`, [checkout])).rows[0].id;
    expect(await stockOf(w.a.variant)).toBe(before - 2);
    await asUser(w.db, w.customer, () => w.db.query(`select public.set_order_status($1, 'cancelled')`, [id]));
    expect(await stockOf(w.a.variant)).toBe(before);
    await expect(asUser(w.db, w.customer, () => w.db.query(`select public.set_order_status($1, 'preparing')`, [id]))).rejects.toThrow();
  });

  it('el cliente ya no puede cancelar cuando el comercio empezó a prepararlo', async () => {
    await restock(w.a.variant);
    const checkout = await placeOrder(w.customer, items([w.a.variant, 1]));
    const id = (await w.db.query<{ id: string }>(`select id from public.orders where checkout_id = $1`, [checkout])).rows[0].id;
    await asUser(w.db, w.ownerA, () => w.db.query(`select public.set_order_status($1, 'preparing')`, [id]));
    await expect(asUser(w.db, w.customer, () => w.db.query(`select public.set_order_status($1, 'cancelled')`, [id]))).rejects.toThrow(/No autorizado/);
  });
});

describe('métricas', () => {
  it('el admin ve los números de toda la plataforma; nadie más', async () => {
    const r = await asUser(w.db, w.admin, () => w.db.query<{ admin_stats: Record<string, number> }>(`select public.admin_stats() as admin_stats`));
    const stats = r.rows[0].admin_stats;
    expect(stats.merchants_approved).toBe(2);
    expect(stats.orders_total).toBeGreaterThan(0);
    expect(stats.sales_total_cents).toBeGreaterThan(0);
    await expect(asUser(w.db, w.customer, () => w.db.query(`select public.admin_stats()`))).rejects.toThrow(/No autorizado/);
    await expect(asUser(w.db, null, () => w.db.query(`select public.admin_stats()`))).rejects.toThrow();
  });

  it('el comercio ve solo las suyas', async () => {
    const r = await asUser(w.db, w.ownerB, () => w.db.query<{ merchant_stats: Record<string, number> }>(`select public.merchant_stats() as merchant_stats`));
    expect(r.rows[0].merchant_stats.products).toBe(1);
    await expect(asUser(w.db, w.customer, () => w.db.query(`select public.merchant_stats()`))).rejects.toThrow(/comercio/);
  });
});

describe('anuncios y ajustes del sitio', () => {
  it('el público ve los anuncios vigentes y no los inactivos ni los futuros', async () => {
    await w.db.query(`
      insert into public.announcements (title, is_active, starts_at, ends_at) values
        ('Vigente', true, null, null),
        ('En fecha', true, now() - interval '1 day', now() + interval '1 day'),
        ('Pausado', false, null, null),
        ('Futuro', true, now() + interval '2 days', null),
        ('Vencido', true, null, now() - interval '1 day')`);
    const r = await asUser(w.db, null, () => w.db.query<{ title: string }>(`select title from public.announcements order by title`));
    expect(r.rows.map((row) => row.title)).toEqual(['En fecha', 'Vigente']);
    const admin = await asUser(w.db, w.admin, () => w.db.query(`select id from public.announcements`));
    expect(admin.rows).toHaveLength(5);
  });

  it('solo el admin crea y edita anuncios, categorías y ajustes', async () => {
    await expect(asUser(w.db, w.ownerA, () => w.db.query(`insert into public.announcements (title) values ('Spam')`))).rejects.toThrow();
    await expect(asUser(w.db, w.ownerA, () => w.db.query(`insert into public.categories (slug, name) values ('mia', 'Mía')`))).rejects.toThrow();
    await asUser(w.db, w.admin, () => w.db.query(`insert into public.announcements (title, placement) values ('Envío gratis', 'topbar')`));
    await asUser(w.db, w.admin, () => w.db.query(`insert into public.categories (slug, name) values ('natacion', 'Natación')`));
    await asUser(w.db, w.ownerA, () => w.db.query(`update public.site_settings set value = '{"name": "Hackeado"}' where key = 'store'`));
    const r = await w.db.query<{ value: { name: string } }>(`select value from public.site_settings where key = 'store'`);
    expect(r.rows[0].value.name).toBe('SPOT');
  });
});

describe('imágenes (storage)', () => {
  it('cada comercio sube en su carpeta y en ninguna otra', async () => {
    await asUser(w.db, w.ownerA, () => w.db.query(`insert into storage.objects (bucket_id, name) values ('product-images', $1)`, [`${w.merchantA}/zapa.jpg`]));
    await expect(asUser(w.db, w.ownerA, () => w.db.query(`insert into storage.objects (bucket_id, name) values ('product-images', $1)`, [`${w.merchantB}/robo.jpg`]))).rejects.toThrow();
    await expect(asUser(w.db, w.customer, () => w.db.query(`insert into storage.objects (bucket_id, name) values ('product-images', $1)`, [`${w.merchantA}/x.jpg`]))).rejects.toThrow();
  });

  it('el bucket del sitio es solo del admin y todo se puede leer', async () => {
    await expect(asUser(w.db, w.ownerA, () => w.db.query(`insert into storage.objects (bucket_id, name) values ('site', 'banner.jpg')`))).rejects.toThrow();
    await asUser(w.db, w.admin, () => w.db.query(`insert into storage.objects (bucket_id, name) values ('site', 'banner.jpg')`));
    const r = await asUser(w.db, null, () => w.db.query(`select name from storage.objects`));
    expect(r.rows.length).toBeGreaterThanOrEqual(2);
  });
});
