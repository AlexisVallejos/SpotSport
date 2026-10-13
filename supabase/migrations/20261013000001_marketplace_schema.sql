-- Marketplace SPOT · esquema base
-- Cuentas (auth.users) → perfiles → comercios (opcional, con aprobación) → productos y variantes → pedidos.

-- ───────────────────────── Tipos ─────────────────────────

create type public.merchant_status as enum ('pending', 'approved', 'rejected', 'suspended');
create type public.order_status as enum ('pending', 'preparing', 'shipped', 'delivered', 'cancelled');
create type public.payment_method as enum ('cash_on_delivery', 'pickup', 'mercado_pago');
create type public.payment_status as enum ('unpaid', 'paid', 'refunded');
create type public.announcement_placement as enum ('topbar', 'hero', 'strip');

-- ───────────────────────── Tablas ─────────────────────────

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text not null default '',
  phone text not null default '',
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.merchants (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null unique references public.profiles (id) on delete cascade,
  name text not null check (char_length(name) between 2 and 80),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  description text not null default '',
  logo_url text,
  contact_email text not null default '',
  contact_phone text not null default '',
  city text not null default '',
  status public.merchant_status not null default 'pending',
  rejection_reason text not null default '',
  reviewed_by uuid references public.profiles (id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null,
  image_url text,
  sort integer not null default 0
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.merchants (id) on delete cascade,
  category_id uuid references public.categories (id) on delete set null,
  name text not null check (char_length(name) between 2 and 120),
  description text not null default '',
  brand text not null default '',
  images text[] not null default '{}',
  is_active boolean not null default true,
  featured boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index products_merchant_idx on public.products (merchant_id);
create index products_category_idx on public.products (category_id);

create table public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  size text not null default '',
  color text not null default '',
  sku text not null default '',
  price_cents integer not null check (price_cents >= 0),
  stock integer not null default 0 check (stock >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (product_id, size, color)
);
create index variants_product_idx on public.product_variants (product_id);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  checkout_id uuid not null,
  customer_id uuid not null references public.profiles (id),
  merchant_id uuid not null references public.merchants (id),
  status public.order_status not null default 'pending',
  payment_method public.payment_method not null,
  payment_status public.payment_status not null default 'unpaid',
  total_cents integer not null default 0 check (total_cents >= 0),
  shipping_name text not null default '',
  shipping_address text not null default '',
  shipping_city text not null default '',
  shipping_phone text not null default '',
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index orders_customer_idx on public.orders (customer_id, created_at desc);
create index orders_merchant_idx on public.orders (merchant_id, created_at desc);
create index orders_checkout_idx on public.orders (checkout_id);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  product_id uuid references public.products (id) on delete set null,
  variant_id uuid references public.product_variants (id) on delete set null,
  product_name text not null,
  variant_label text not null default '',
  image_url text,
  unit_price_cents integer not null check (unit_price_cents >= 0),
  quantity integer not null check (quantity > 0),
  line_total_cents integer not null check (line_total_cents >= 0)
);
create index order_items_order_idx on public.order_items (order_id);

create table public.announcements (
  id uuid primary key default gen_random_uuid(),
  placement public.announcement_placement not null default 'topbar',
  title text not null check (char_length(title) between 1 and 140),
  body text not null default '',
  link_url text not null default '',
  link_label text not null default '',
  image_url text,
  is_active boolean not null default true,
  starts_at timestamptz,
  ends_at timestamptz,
  sort integer not null default 0,
  created_at timestamptz not null default now()
);

create table public.site_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- ───────────────────────── Ayudas de permisos ─────────────────────────
-- Son SECURITY DEFINER para poder consultar tablas protegidas sin recursión de políticas.

create function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false)
$$;

/** El comercio aprobado de la cuenta actual (null si no tiene o no está aprobado). */
create function public.my_merchant_id() returns uuid
language sql stable security definer set search_path = public as $$
  select id from public.merchants where owner_id = auth.uid() and status = 'approved'
$$;

/** El comercio de la cuenta actual en cualquier estado (para ver sus propios pedidos). */
create function public.my_any_merchant_id() returns uuid
language sql stable security definer set search_path = public as $$
  select id from public.merchants where owner_id = auth.uid()
$$;

create function public.merchant_is_approved(p_merchant uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.merchants where id = p_merchant and status = 'approved')
$$;

create function public.product_is_public(p_product uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.products p
    join public.merchants m on m.id = p.merchant_id
    where p.id = p_product and p.is_active and m.status = 'approved'
  )
$$;

create function public.product_is_mine(p_product uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.products p
    where p.id = p_product and p.merchant_id = public.my_merchant_id()
  )
$$;

-- ───────────────────────── Triggers ─────────────────────────

create function public.touch_updated_at() returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger products_touch before update on public.products
  for each row execute function public.touch_updated_at();
create trigger orders_touch before update on public.orders
  for each row execute function public.touch_updated_at();

/** Crea el perfil al registrarse. */
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, coalesce(new.email, ''), coalesce(new.raw_user_meta_data ->> 'full_name', ''));
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

/**
 * Nadie se hace admin solo ni cambia su email desde la app. Las llamadas sin sesión de usuario
 * (consola SQL, service role) sí pueden: así se crea el primer admin.
 */
create function public.guard_profile_update() returns trigger language plpgsql as $$
begin
  if auth.uid() is not null and not public.is_admin() then
    if new.is_admin is distinct from old.is_admin then
      raise exception 'No autorizado para cambiar el rol';
    end if;
    if new.email is distinct from old.email or new.id is distinct from old.id then
      raise exception 'No se puede cambiar el email desde acá';
    end if;
  end if;
  return new;
end $$;

create trigger profiles_guard before update on public.profiles
  for each row execute function public.guard_profile_update();

/** El dueño edita los datos de su comercio, pero no su estado ni quién lo revisó. */
create function public.guard_merchant_update() returns trigger language plpgsql as $$
begin
  if auth.uid() is not null and not public.is_admin() then
    if new.owner_id is distinct from old.owner_id
       or new.reviewed_by is distinct from old.reviewed_by
       or new.reviewed_at is distinct from old.reviewed_at
       or new.rejection_reason is distinct from old.rejection_reason then
      raise exception 'No autorizado';
    end if;
    -- Único cambio de estado permitido: volver a pedir la afiliación tras un rechazo.
    if new.status is distinct from old.status and not (old.status = 'rejected' and new.status = 'pending') then
      raise exception 'Solo un administrador puede cambiar el estado del comercio';
    end if;
  end if;
  return new;
end $$;

create trigger merchants_guard before update on public.merchants
  for each row execute function public.guard_merchant_update();

/** Solo el admin destaca productos y ningún comercio mueve un producto a otro comercio. */
create function public.guard_product_write() returns trigger language plpgsql as $$
begin
  if auth.uid() is not null and not public.is_admin() then
    if tg_op = 'INSERT' and new.featured then
      raise exception 'Solo un administrador puede destacar productos';
    end if;
    if tg_op = 'UPDATE' then
      if new.featured is distinct from old.featured then
        raise exception 'Solo un administrador puede destacar productos';
      end if;
      if new.merchant_id is distinct from old.merchant_id then
        raise exception 'No autorizado';
      end if;
    end if;
  end if;
  return new;
end $$;

create trigger products_guard before insert or update on public.products
  for each row execute function public.guard_product_write();

-- ───────────────────────── Operaciones de negocio ─────────────────────────

/**
 * Confirma una compra. Los precios y el stock salen de la base: el cliente solo manda qué variante y cuántas.
 * Crea un pedido por comercio, todos con el mismo checkout_id, y devuelve ese id.
 * p_items: [{ "variant_id": uuid, "quantity": int }]
 * p_shipping: { "name", "address", "city", "phone", "notes" }
 */
create function public.place_order(p_items jsonb, p_shipping jsonb, p_payment public.payment_method)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_checkout uuid := gen_random_uuid();
  v_item jsonb;
  v_row record;
  v_qty integer;
  v_orders jsonb := '{}'::jsonb;
  v_order uuid;
  v_label text;
begin
  if v_uid is null then
    raise exception 'Iniciá sesión para comprar' using errcode = '28000';
  end if;
  if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'El carrito está vacío';
  end if;
  if jsonb_array_length(p_items) > 100 then
    raise exception 'El carrito es demasiado grande';
  end if;
  if p_payment = 'mercado_pago' then
    raise exception 'Mercado Pago todavía no está disponible';
  end if;
  if coalesce(btrim(p_shipping ->> 'name'), '') = ''
     or coalesce(btrim(p_shipping ->> 'phone'), '') = '' then
    raise exception 'Completá nombre y teléfono';
  end if;
  if p_payment = 'cash_on_delivery'
     and (coalesce(btrim(p_shipping ->> 'address'), '') = '' or coalesce(btrim(p_shipping ->> 'city'), '') = '') then
    raise exception 'Completá la dirección de entrega';
  end if;

  -- Orden fijo por variante: dos compras simultáneas no se bloquean entre sí.
  for v_item in
    select value from jsonb_array_elements(p_items) order by value ->> 'variant_id'
  loop
    v_qty := (v_item ->> 'quantity')::integer;
    if v_qty is null or v_qty < 1 or v_qty > 99 then
      raise exception 'Cantidad inválida';
    end if;

    select v.id as variant_id, v.product_id, v.size, v.color, v.price_cents, v.stock, v.is_active as variant_active,
           p.name as product_name, p.merchant_id, p.images, p.is_active as product_active,
           m.status as merchant_status, m.owner_id
      into v_row
      from public.product_variants v
      join public.products p on p.id = v.product_id
      join public.merchants m on m.id = p.merchant_id
     where v.id = (v_item ->> 'variant_id')::uuid
       for update of v;

    if not found or not v_row.variant_active or not v_row.product_active or v_row.merchant_status <> 'approved' then
      raise exception 'Un producto del carrito ya no está disponible';
    end if;
    if v_row.owner_id = v_uid then
      raise exception 'No podés comprar productos de tu propio comercio';
    end if;
    if v_row.stock < v_qty then
      raise exception 'No hay stock suficiente de %', v_row.product_name;
    end if;

    v_order := (v_orders ->> v_row.merchant_id::text)::uuid;
    if v_order is null then
      insert into public.orders (checkout_id, customer_id, merchant_id, payment_method,
                                 shipping_name, shipping_address, shipping_city, shipping_phone, notes)
      values (v_checkout, v_uid, v_row.merchant_id, p_payment,
              btrim(p_shipping ->> 'name'), coalesce(btrim(p_shipping ->> 'address'), ''),
              coalesce(btrim(p_shipping ->> 'city'), ''), btrim(p_shipping ->> 'phone'),
              coalesce(btrim(p_shipping ->> 'notes'), ''))
      returning id into v_order;
      v_orders := v_orders || jsonb_build_object(v_row.merchant_id::text, v_order);
    end if;

    update public.product_variants set stock = stock - v_qty where id = v_row.variant_id;

    v_label := concat_ws(' · ', nullif(v_row.size, ''), nullif(v_row.color, ''));
    insert into public.order_items (order_id, product_id, variant_id, product_name, variant_label, image_url,
                                    unit_price_cents, quantity, line_total_cents)
    values (v_order, v_row.product_id, v_row.variant_id, v_row.product_name, v_label, v_row.images[1],
            v_row.price_cents, v_qty, v_row.price_cents * v_qty);

    update public.orders set total_cents = total_cents + v_row.price_cents * v_qty where id = v_order;
  end loop;

  return v_checkout;
end $$;

/**
 * Cambia el estado de un pedido. El comercio y el admin avanzan el flujo; el cliente solo puede cancelar
 * mientras el pedido siga pendiente. Al cancelar se devuelve el stock.
 */
create function public.set_order_status(p_order uuid, p_status public.order_status)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  o public.orders;
  v_is_owner boolean;
  v_is_customer boolean;
begin
  if v_uid is null then
    raise exception 'Iniciá sesión' using errcode = '28000';
  end if;
  select * into o from public.orders where id = p_order for update;
  if not found then
    raise exception 'Pedido inexistente';
  end if;

  v_is_owner := exists (select 1 from public.merchants where id = o.merchant_id and owner_id = v_uid);
  v_is_customer := o.customer_id = v_uid;

  if not (v_is_owner or public.is_admin())
     and not (v_is_customer and p_status = 'cancelled' and o.status = 'pending') then
    raise exception 'No autorizado';
  end if;

  if not (
       (o.status = 'pending' and p_status in ('preparing', 'cancelled'))
    or (o.status = 'preparing' and p_status in ('shipped', 'cancelled'))
    or (o.status = 'shipped' and p_status = 'delivered')
  ) then
    raise exception 'No se puede pasar de % a %', o.status, p_status;
  end if;

  if p_status = 'cancelled' then
    update public.product_variants v
       set stock = v.stock + i.quantity
      from public.order_items i
     where i.order_id = o.id and i.variant_id = v.id;
  end if;

  update public.orders set status = p_status where id = o.id;
end $$;

/** El comercio (o el admin) registra que cobró un pedido. */
create function public.mark_order_paid(p_order uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  o public.orders;
begin
  select * into o from public.orders where id = p_order for update;
  if not found then
    raise exception 'Pedido inexistente';
  end if;
  if not (public.is_admin()
          or exists (select 1 from public.merchants where id = o.merchant_id and owner_id = auth.uid())) then
    raise exception 'No autorizado';
  end if;
  if o.status = 'cancelled' then
    raise exception 'El pedido está cancelado';
  end if;
  update public.orders set payment_status = 'paid' where id = o.id;
end $$;

/** El admin aprueba, rechaza, suspende o reabre un comercio. */
create function public.review_merchant(p_merchant uuid, p_status public.merchant_status, p_reason text default '')
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then
    raise exception 'No autorizado';
  end if;
  update public.merchants
     set status = p_status,
         rejection_reason = case when p_status in ('rejected', 'suspended') then coalesce(p_reason, '') else '' end,
         reviewed_by = auth.uid(),
         reviewed_at = now()
   where id = p_merchant;
  if not found then
    raise exception 'Comercio inexistente';
  end if;
end $$;

/** Métricas del panel de administración. */
create function public.admin_stats() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then
    raise exception 'No autorizado';
  end if;
  return jsonb_build_object(
    'users', (select count(*) from public.profiles),
    'merchants_pending', (select count(*) from public.merchants where status = 'pending'),
    'merchants_approved', (select count(*) from public.merchants where status = 'approved'),
    'merchants_suspended', (select count(*) from public.merchants where status = 'suspended'),
    'products', (select count(*) from public.products),
    'orders_total', (select count(*) from public.orders),
    'orders_30d', (select count(*) from public.orders where created_at > now() - interval '30 days' and status <> 'cancelled'),
    'sales_30d_cents', (select coalesce(sum(total_cents), 0) from public.orders where created_at > now() - interval '30 days' and status <> 'cancelled'),
    'sales_total_cents', (select coalesce(sum(total_cents), 0) from public.orders where status <> 'cancelled')
  );
end $$;

/** Métricas del panel del comercio. */
create function public.merchant_stats() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_merchant uuid := public.my_any_merchant_id();
begin
  if v_merchant is null then
    raise exception 'No tenés un comercio';
  end if;
  return jsonb_build_object(
    'products', (select count(*) from public.products where merchant_id = v_merchant),
    'low_stock', (
      select count(*) from public.product_variants v
      join public.products p on p.id = v.product_id
      where p.merchant_id = v_merchant and v.is_active and v.stock <= 3
    ),
    'orders_pending', (select count(*) from public.orders where merchant_id = v_merchant and status = 'pending'),
    'orders_30d', (select count(*) from public.orders where merchant_id = v_merchant and created_at > now() - interval '30 days' and status <> 'cancelled'),
    'sales_30d_cents', (select coalesce(sum(total_cents), 0) from public.orders where merchant_id = v_merchant and created_at > now() - interval '30 days' and status <> 'cancelled'),
    'sales_total_cents', (select coalesce(sum(total_cents), 0) from public.orders where merchant_id = v_merchant and status <> 'cancelled')
  );
end $$;

-- Las operaciones sensibles solo las puede llamar una cuenta con sesión.
revoke execute on function public.place_order(jsonb, jsonb, public.payment_method) from public, anon;
revoke execute on function public.set_order_status(uuid, public.order_status) from public, anon;
revoke execute on function public.mark_order_paid(uuid) from public, anon;
revoke execute on function public.review_merchant(uuid, public.merchant_status, text) from public, anon;
revoke execute on function public.admin_stats() from public, anon;
revoke execute on function public.merchant_stats() from public, anon;
grant execute on function public.place_order(jsonb, jsonb, public.payment_method) to authenticated;
grant execute on function public.set_order_status(uuid, public.order_status) to authenticated;
grant execute on function public.mark_order_paid(uuid) to authenticated;
grant execute on function public.review_merchant(uuid, public.merchant_status, text) to authenticated;
grant execute on function public.admin_stats() to authenticated;
grant execute on function public.merchant_stats() to authenticated;
