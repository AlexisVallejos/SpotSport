-- Cupones y vouchers
-- Un comercio aprobado publica cupones (con su link de destino). Quien compra "obtiene" el cupón y se le
-- genera SU voucher: código único con vencimiento. Desde el voucher se lo redirige a la web del comercio
-- con el código aplicado.

create table public.coupons (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.merchants (id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 3 and 80),
  description text not null default '' check (char_length(description) <= 300),
  /** Lo que se ve en la tarjeta: "20% OFF", "2x1", "$5.000 de descuento". */
  discount_label text not null check (char_length(btrim(discount_label)) between 1 and 40),
  /** El voucher queda PREFIJO-A1B2C3. */
  code_prefix text not null check (code_prefix ~ '^[A-Z0-9]{3,12}$'),
  /** Web del comercio. {codigo} se reemplaza por el código del voucher: https://tienda.com/?cupon={codigo} */
  destination_url text not null check (destination_url ~ '^https://[^[:space:]]+$' and char_length(destination_url) <= 500),
  /** Cuánto dura cada voucher desde que se obtiene. */
  valid_hours integer not null check (valid_hours between 1 and 720),
  /** Ventana en la que se puede obtener el cupón. */
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  max_claims integer check (max_claims is null or max_claims > 0),
  claims_count integer not null default 0 check (claims_count >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  check (ends_at is null or ends_at > starts_at)
);
create index coupons_merchant_idx on public.coupons (merchant_id);

create table public.vouchers (
  id uuid primary key default gen_random_uuid(),
  coupon_id uuid not null references public.coupons (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  code text not null unique,
  expires_at timestamptz not null,
  clicks integer not null default 0,
  last_clicked_at timestamptz,
  created_at timestamptz not null default now()
);
create index vouchers_user_idx on public.vouchers (user_id, expires_at desc);
create index vouchers_coupon_idx on public.vouchers (coupon_id);

-- ───────────────────────── Triggers ─────────────────────────

/**
 * El comercio no inventa su propio contador de cupones emitidos ni mueve un cupón a otro comercio.
 * Solo frena a quien llega como usuario de la app (rol authenticated o anon): claim_coupon corre con los
 * permisos de su dueño y sí puede sumar al contador.
 */
create function public.guard_coupon_write() returns trigger language plpgsql set search_path = '' as $$
begin
  if current_user in ('authenticated', 'anon') and not public.is_admin() then
    if tg_op = 'INSERT' and new.claims_count <> 0 then
      raise exception 'No autorizado';
    end if;
    if tg_op = 'UPDATE' and (new.claims_count is distinct from old.claims_count or new.merchant_id is distinct from old.merchant_id) then
      raise exception 'No autorizado';
    end if;
  end if;
  return new;
end $$;

create trigger coupons_guard before insert or update on public.coupons
  for each row execute function public.guard_coupon_write();

revoke execute on function public.guard_coupon_write() from public, anon, authenticated;

-- ───────────────────────── Permisos (RLS) ─────────────────────────

alter table public.coupons enable row level security;
alter table public.vouchers enable row level security;

/** Si la cuenta tiene un voucher de ese cupón (SECURITY DEFINER: evita que las políticas se llamen entre sí). */
create function public.has_voucher_for(p_coupon uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.vouchers where coupon_id = p_coupon and user_id = auth.uid())
$$;

-- Se ven los cupones que se pueden obtener ahora; quien ya obtuvo uno lo sigue viendo (aunque termine la campaña),
-- el comercio ve todos los suyos y el admin todos.
create policy coupons_select on public.coupons for select to anon, authenticated
  using (
    (is_active and starts_at <= now() and (ends_at is null or ends_at > now()) and public.merchant_is_approved(merchant_id))
    or public.has_voucher_for(id)
    or merchant_id = public.my_any_merchant_id()
    or public.is_admin()
  );
create policy coupons_insert_mine on public.coupons for insert to authenticated
  with check (merchant_id = public.my_merchant_id() or public.is_admin());
create policy coupons_update_mine on public.coupons for update to authenticated
  using (merchant_id = public.my_merchant_id() or public.is_admin())
  with check (merchant_id = public.my_merchant_id() or public.is_admin());
create policy coupons_delete_mine on public.coupons for delete to authenticated
  using (merchant_id = public.my_merchant_id() or public.is_admin());

-- Cada persona ve sus vouchers; el comercio ve los que salieron de sus cupones (para validar códigos).
create policy vouchers_select on public.vouchers for select to authenticated
  using (
    user_id = auth.uid()
    or exists (select 1 from public.coupons c where c.id = coupon_id and c.merchant_id = public.my_any_merchant_id())
    or public.is_admin()
  );

-- Los vouchers se crean y se usan solo con claim_coupon / voucher_redirect.
revoke all on public.vouchers from anon;
revoke insert, update, delete on public.vouchers from authenticated;

-- ───────────────────────── Operaciones ─────────────────────────

/**
 * Obtiene el cupón: devuelve el voucher vigente de esta persona o crea uno nuevo.
 * Si ya tiene uno que no venció, devuelve ese (no se acumulan).
 */
create function public.claim_coupon(p_coupon uuid) returns public.vouchers
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  c public.coupons;
  v public.vouchers;
  v_try integer := 0;
begin
  if v_uid is null then
    raise exception 'Iniciá sesión para obtener el cupón' using errcode = '28000';
  end if;

  select * into c from public.coupons where id = p_coupon for update;
  if not found
     or not c.is_active
     or c.starts_at > now()
     or (c.ends_at is not null and c.ends_at <= now())
     or not public.merchant_is_approved(c.merchant_id) then
    raise exception 'Este cupón ya no está disponible';
  end if;
  if exists (select 1 from public.merchants where id = c.merchant_id and owner_id = v_uid) then
    raise exception 'No podés usar cupones de tu propio comercio';
  end if;

  select * into v from public.vouchers
   where coupon_id = c.id and user_id = v_uid and expires_at > now()
   order by created_at desc limit 1;
  if found then
    return v;
  end if;

  if c.max_claims is not null and c.claims_count >= c.max_claims then
    raise exception 'Se agotaron los cupones';
  end if;

  loop
    begin
      insert into public.vouchers (coupon_id, user_id, code, expires_at)
      values (
        c.id,
        v_uid,
        c.code_prefix || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6)),
        now() + make_interval(hours => c.valid_hours)
      )
      returning * into v;
      exit;
    exception when unique_violation then
      v_try := v_try + 1;
      if v_try >= 5 then
        raise exception 'No pudimos generar el código, intentá de nuevo';
      end if;
    end;
  end loop;

  update public.coupons set claims_count = claims_count + 1 where id = c.id;
  return v;
end $$;

/**
 * Devuelve la web del comercio con el código aplicado y cuenta el click.
 * Solo funciona para el dueño del voucher y mientras no haya vencido.
 */
create function public.voucher_redirect(p_voucher uuid) returns text
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
  return replace(c.destination_url, '{codigo}', v.code);
end $$;

revoke execute on function public.has_voucher_for(uuid) from public;
grant execute on function public.has_voucher_for(uuid) to anon, authenticated;
revoke execute on function public.claim_coupon(uuid) from public, anon;
revoke execute on function public.voucher_redirect(uuid) from public, anon;
grant execute on function public.claim_coupon(uuid) to authenticated;
grant execute on function public.voucher_redirect(uuid) to authenticated;
