-- Cupones · estadísticas, ventas generadas y comisión de SPOT
-- El comercio ve cuánta gente movilizamos hacia su web. Cuando una persona compra con su voucher, el comercio
-- registra la venta (código + monto) y SPOT se queda con un porcentaje, que queda congelado en esa venta.

-- ───────────────────────── Comisión ─────────────────────────

alter table public.merchants
  add column commission_percent numeric(5, 2)
  check (commission_percent is null or (commission_percent >= 0 and commission_percent <= 50));

insert into public.site_settings (key, value) values ('commission', '{"percent": 5}')
on conflict (key) do nothing;

/** El comercio no se cambia su propia comisión (todo lo demás de esta ayuda queda igual que antes). */
create or replace function public.guard_merchant_update() returns trigger language plpgsql set search_path = '' as $$
begin
  if auth.uid() is not null and not public.is_admin() then
    if new.owner_id is distinct from old.owner_id
       or new.reviewed_by is distinct from old.reviewed_by
       or new.reviewed_at is distinct from old.reviewed_at
       or new.rejection_reason is distinct from old.rejection_reason
       or new.commission_percent is distinct from old.commission_percent then
      raise exception 'No autorizado';
    end if;
    -- Único cambio de estado permitido: volver a pedir la afiliación tras un rechazo.
    if new.status is distinct from old.status and not (old.status = 'rejected' and new.status = 'pending') then
      raise exception 'Solo un administrador puede cambiar el estado del comercio';
    end if;
  end if;
  return new;
end $$;

/** El porcentaje que se le cobra a un comercio: el suyo si tiene uno propio, si no el general (5 % por defecto). */
create function public.commission_rate(p_merchant uuid) returns numeric
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select commission_percent from public.merchants where id = p_merchant),
    (select (value ->> 'percent')::numeric from public.site_settings where key = 'commission'),
    5
  )
$$;

-- ───────────────────────── Clicks y ventas ─────────────────────────

/** Un click por fila: sirve para graficar por día y para saber cuántas personas distintas llegaron. */
create table public.voucher_clicks (
  id bigint generated always as identity primary key,
  voucher_id uuid not null references public.vouchers (id) on delete cascade,
  coupon_id uuid not null references public.coupons (id) on delete cascade,
  created_at timestamptz not null default now()
);
create index voucher_clicks_coupon_idx on public.voucher_clicks (coupon_id, created_at);
alter table public.voucher_clicks enable row level security;
revoke all on public.voucher_clicks from anon, authenticated;

/**
 * Una venta hecha con un voucher. Guarda su propia foto (código, título, porcentaje) para que borrar el cupón
 * no borre lo que el comercio le debe a SPOT.
 */
create table public.voucher_sales (
  id uuid primary key default gen_random_uuid(),
  voucher_id uuid unique references public.vouchers (id) on delete set null,
  coupon_id uuid references public.coupons (id) on delete set null,
  merchant_id uuid not null references public.merchants (id) on delete cascade,
  code text not null,
  coupon_title text not null,
  amount_cents bigint not null check (amount_cents between 1 and 100000000000),
  commission_percent numeric(5, 2) not null check (commission_percent between 0 and 50),
  commission_cents bigint not null check (commission_cents >= 0),
  status text not null default 'pending' check (status in ('pending', 'paid', 'void')),
  reported_at timestamptz not null default now(),
  settled_at timestamptz
);
create index voucher_sales_merchant_idx on public.voucher_sales (merchant_id, reported_at desc);
alter table public.voucher_sales enable row level security;

create policy voucher_sales_select on public.voucher_sales for select to authenticated
  using (merchant_id = public.my_any_merchant_id() or public.is_admin());

revoke all on public.voucher_sales from anon;
revoke insert, update, delete on public.voucher_sales from authenticated;

-- Ahora cada click del voucher queda registrado con su fecha.
create or replace function public.voucher_redirect(p_voucher uuid) returns text
language plpgsql security definer set search_path = public as $$
declare
  v public.vouchers;
  c public.coupons;
begin
  if auth.uid() is null then
    raise exception 'Iniciá sesión' using errcode = '28000';
  end if;
  select * into v from public.vouchers where id = p_voucher and user_id = auth.uid();
  if not found then
    raise exception 'No encontramos ese cupón';
  end if;
  if v.expires_at <= now() then
    raise exception 'Este cupón venció';
  end if;
  select * into c from public.coupons where id = v.coupon_id;
  if not public.merchant_is_approved(c.merchant_id) then
    raise exception 'Este comercio ya no está disponible';
  end if;
  update public.vouchers set clicks = clicks + 1, last_clicked_at = now() where id = v.id;
  insert into public.voucher_clicks (voucher_id, coupon_id) values (v.id, c.id);
  return replace(c.destination_url, '{codigo}', v.code);
end $$;

/** El comercio registra que una persona compró con su voucher. La comisión se calcula acá, no en la app. */
create function public.register_voucher_sale(p_code text, p_amount_cents bigint) returns public.voucher_sales
language plpgsql security definer set search_path = public as $$
declare
  v_merchant uuid := public.my_merchant_id();
  v public.vouchers;
  c public.coupons;
  v_rate numeric;
  s public.voucher_sales;
begin
  if v_merchant is null then
    raise exception 'Solo un comercio aprobado puede registrar ventas';
  end if;
  if p_amount_cents is null or p_amount_cents < 1 or p_amount_cents > 100000000000 then
    raise exception 'Ingresá el monto de la venta';
  end if;

  select vo.* into v
    from public.vouchers vo
    join public.coupons co on co.id = vo.coupon_id
   where upper(vo.code) = upper(btrim(p_code)) and co.merchant_id = v_merchant;
  if not found then
    raise exception 'No encontramos ese código entre tus cupones';
  end if;
  if exists (select 1 from public.voucher_sales where voucher_id = v.id) then
    raise exception 'Ese cupón ya se registró como venta';
  end if;
  -- Se acepta unos días después del vencimiento: la persona pudo pagar justo antes y el comercio cargar la venta después.
  if v.expires_at + interval '3 days' < now() then
    raise exception 'Ese cupón venció hace más de 3 días';
  end if;

  select * into c from public.coupons where id = v.coupon_id;
  v_rate := public.commission_rate(v_merchant);

  insert into public.voucher_sales (voucher_id, coupon_id, merchant_id, code, coupon_title, amount_cents, commission_percent, commission_cents)
  values (v.id, c.id, v_merchant, v.code, c.title, p_amount_cents, v_rate, round(p_amount_cents * v_rate / 100))
  returning * into s;
  return s;
end $$;

-- ───────────────────────── Administración de comisiones ─────────────────────────

create function public.admin_set_sale_status(p_sale uuid, p_status text) returns public.voucher_sales
language plpgsql security definer set search_path = public as $$
declare
  s public.voucher_sales;
begin
  if not public.is_admin() then
    raise exception 'No autorizado';
  end if;
  if p_status not in ('pending', 'paid', 'void') then
    raise exception 'Estado inválido';
  end if;
  update public.voucher_sales
     set status = p_status, settled_at = case when p_status = 'paid' then now() else null end
   where id = p_sale
  returning * into s;
  if not found then
    raise exception 'No encontramos esa venta';
  end if;
  return s;
end $$;

/** Marca como cobradas todas las comisiones pendientes de un comercio. Devuelve cuántas. */
create function public.admin_settle_merchant(p_merchant uuid) returns integer
language plpgsql security definer set search_path = public as $$
declare
  v_count integer;
begin
  if not public.is_admin() then
    raise exception 'No autorizado';
  end if;
  update public.voucher_sales set status = 'paid', settled_at = now() where merchant_id = p_merchant and status = 'pending';
  get diagnostics v_count = row_count;
  return v_count;
end $$;

-- ───────────────────────── Estadísticas ─────────────────────────

/**
 * Números de cupones. p_merchant = null suma todos los comercios. Uso interno: lo llaman las dos funciones de abajo,
 * que son las que verifican quién pregunta.
 */
create function public._coupon_stats(p_merchant uuid, p_days integer) returns jsonb
language sql stable security definer set search_path = public as $$
  with
  cps as (select id, title from public.coupons where p_merchant is null or merchant_id = p_merchant),
  vo as (select v.id, v.created_at, v.coupon_id from public.vouchers v join cps on cps.id = v.coupon_id),
  ck as (select k.voucher_id, k.coupon_id, k.created_at from public.voucher_clicks k join cps on cps.id = k.coupon_id),
  sl as (
    select * from public.voucher_sales
     where status <> 'void' and (p_merchant is null or merchant_id = p_merchant)
  ),
  days as (
    select d::date as day
      from generate_series(
        (now() at time zone 'America/Argentina/Buenos_Aires')::date - (p_days - 1),
        (now() at time zone 'America/Argentina/Buenos_Aires')::date,
        interval '1 day'
      ) d
  )
  select jsonb_build_object(
    'totals', jsonb_build_object(
      'claims', (select count(*) from vo),
      'clicks', (select count(*) from ck),
      'unique_clickers', (select count(distinct voucher_id) from ck),
      'sales', (select count(*) from sl),
      'sales_cents', (select coalesce(sum(amount_cents), 0) from sl),
      'commission_cents', (select coalesce(sum(commission_cents), 0) from sl),
      'commission_pending_cents', (select coalesce(sum(commission_cents), 0) from sl where status = 'pending'),
      'commission_paid_cents', (select coalesce(sum(commission_cents), 0) from sl where status = 'paid')
    ),
    'daily', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'day', to_char(days.day, 'YYYY-MM-DD'),
        'claims', (select count(*) from vo where (vo.created_at at time zone 'America/Argentina/Buenos_Aires')::date = days.day),
        'clicks', (select count(*) from ck where (ck.created_at at time zone 'America/Argentina/Buenos_Aires')::date = days.day),
        'sales_cents', (select coalesce(sum(sl.amount_cents), 0) from sl where (sl.reported_at at time zone 'America/Argentina/Buenos_Aires')::date = days.day)
      ) order by days.day), '[]'::jsonb)
      from days
    ),
    'coupons', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', cps.id,
        'title', cps.title,
        'claims', (select count(*) from vo where vo.coupon_id = cps.id),
        'clicks', (select count(*) from ck where ck.coupon_id = cps.id),
        'unique_clickers', (select count(distinct voucher_id) from ck where ck.coupon_id = cps.id),
        'sales', (select count(*) from sl where sl.coupon_id = cps.id),
        'sales_cents', (select coalesce(sum(sl.amount_cents), 0) from sl where sl.coupon_id = cps.id)
      ) order by cps.title), '[]'::jsonb)
      from cps
    )
  )
$$;

/** Las estadísticas del comercio de la cuenta actual. */
create function public.merchant_coupon_stats(p_days integer default 30) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_merchant uuid := public.my_any_merchant_id();
begin
  if v_merchant is null then
    raise exception 'No tenés un comercio';
  end if;
  return public._coupon_stats(v_merchant, least(greatest(coalesce(p_days, 30), 1), 90))
    || jsonb_build_object('commission_percent', public.commission_rate(v_merchant));
end $$;

/** Resumen de toda la plataforma y de cada comercio, para el administrador. */
create function public.admin_coupon_overview(p_days integer default 30) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then
    raise exception 'No autorizado';
  end if;
  return jsonb_build_object(
    'overall', public._coupon_stats(null, least(greatest(coalesce(p_days, 30), 1), 90)),
    'default_percent', (select (value ->> 'percent')::numeric from public.site_settings where key = 'commission'),
    'merchants', (
      select coalesce(jsonb_agg(row_to_json(m) order by m.sales_cents desc, m.name), '[]'::jsonb)
      from (
        select
          mer.id,
          mer.name,
          mer.commission_percent,
          public.commission_rate(mer.id) as effective_percent,
          (select count(*) from public.vouchers v join public.coupons c on c.id = v.coupon_id where c.merchant_id = mer.id) as claims,
          (select count(*) from public.voucher_clicks k join public.coupons c on c.id = k.coupon_id where c.merchant_id = mer.id) as clicks,
          (select count(*) from public.voucher_sales s where s.merchant_id = mer.id and s.status <> 'void') as sales,
          (select coalesce(sum(s.amount_cents), 0) from public.voucher_sales s where s.merchant_id = mer.id and s.status <> 'void') as sales_cents,
          (select coalesce(sum(s.commission_cents), 0) from public.voucher_sales s where s.merchant_id = mer.id and s.status = 'pending') as commission_pending_cents,
          (select coalesce(sum(s.commission_cents), 0) from public.voucher_sales s where s.merchant_id = mer.id and s.status = 'paid') as commission_paid_cents
        from public.merchants mer
        where mer.status = 'approved'
      ) m
    )
  );
end $$;

-- ───────────────────────── Permisos de ejecución ─────────────────────────

revoke execute on function public._coupon_stats(uuid, integer) from public, anon, authenticated;
revoke execute on function public.commission_rate(uuid) from public, anon;
revoke execute on function public.register_voucher_sale(text, bigint) from public, anon;
revoke execute on function public.admin_set_sale_status(uuid, text) from public, anon;
revoke execute on function public.admin_settle_merchant(uuid) from public, anon;
revoke execute on function public.merchant_coupon_stats(integer) from public, anon;
revoke execute on function public.admin_coupon_overview(integer) from public, anon;
revoke execute on function public.voucher_redirect(uuid) from public, anon;
grant execute on function public.commission_rate(uuid) to authenticated;
grant execute on function public.register_voucher_sale(text, bigint) to authenticated;
grant execute on function public.admin_set_sale_status(uuid, text) to authenticated;
grant execute on function public.admin_settle_merchant(uuid) to authenticated;
grant execute on function public.merchant_coupon_stats(integer) to authenticated;
grant execute on function public.admin_coupon_overview(integer) to authenticated;
grant execute on function public.voucher_redirect(uuid) to authenticated;
