-- Marketplace SPOT · políticas de acceso (RLS)
-- Todo está cerrado por defecto: solo entra lo que una política permite.

alter table public.profiles enable row level security;
alter table public.merchants enable row level security;
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.product_variants enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.announcements enable row level security;
alter table public.site_settings enable row level security;

-- ── profiles ──
create policy profiles_select_own on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_admin());
create policy profiles_update_own on public.profiles for update to authenticated
  using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());

-- ── merchants ──
create policy merchants_select on public.merchants for select to anon, authenticated
  using (status = 'approved' or owner_id = auth.uid() or public.is_admin());
create policy merchants_insert_own on public.merchants for insert to authenticated
  with check (owner_id = auth.uid() and status = 'pending');
create policy merchants_update on public.merchants for update to authenticated
  using (owner_id = auth.uid() or public.is_admin())
  with check (owner_id = auth.uid() or public.is_admin());
create policy merchants_delete_admin on public.merchants for delete to authenticated
  using (public.is_admin());

-- ── categories ──
create policy categories_select on public.categories for select to anon, authenticated using (true);
create policy categories_admin_write on public.categories for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ── products ──
create policy products_select on public.products for select to anon, authenticated
  using (
    (is_active and public.merchant_is_approved(merchant_id))
    or merchant_id = public.my_any_merchant_id()
    or public.is_admin()
  );
create policy products_insert_mine on public.products for insert to authenticated
  with check (merchant_id = public.my_merchant_id() or public.is_admin());
create policy products_update_mine on public.products for update to authenticated
  using (merchant_id = public.my_merchant_id() or public.is_admin())
  with check (merchant_id = public.my_merchant_id() or public.is_admin());
create policy products_delete_mine on public.products for delete to authenticated
  using (merchant_id = public.my_merchant_id() or public.is_admin());

-- ── product_variants ──
create policy variants_select on public.product_variants for select to anon, authenticated
  using (
    (is_active and public.product_is_public(product_id))
    or exists (select 1 from public.products p where p.id = product_id and p.merchant_id = public.my_any_merchant_id())
    or public.is_admin()
  );
create policy variants_insert_mine on public.product_variants for insert to authenticated
  with check (public.product_is_mine(product_id) or public.is_admin());
create policy variants_update_mine on public.product_variants for update to authenticated
  using (public.product_is_mine(product_id) or public.is_admin())
  with check (public.product_is_mine(product_id) or public.is_admin());
create policy variants_delete_mine on public.product_variants for delete to authenticated
  using (public.product_is_mine(product_id) or public.is_admin());

-- ── orders: se crean y cambian solo con place_order / set_order_status ──
create policy orders_select on public.orders for select to authenticated
  using (customer_id = auth.uid() or merchant_id = public.my_any_merchant_id() or public.is_admin());

-- ── order_items: se ven si se ve el pedido ──
create policy order_items_select on public.order_items for select to authenticated
  using (exists (select 1 from public.orders o where o.id = order_id));

-- ── announcements ──
create policy announcements_select on public.announcements for select to anon, authenticated
  using (
    public.is_admin()
    or (is_active
        and (starts_at is null or starts_at <= now())
        and (ends_at is null or ends_at >= now()))
  );
create policy announcements_admin_write on public.announcements for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ── site_settings ──
create policy settings_select on public.site_settings for select to anon, authenticated using (true);
create policy settings_admin_write on public.site_settings for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Las tablas con datos personales no se leen sin sesión ni se escriben a mano.
revoke all on public.profiles, public.orders, public.order_items from anon;
revoke insert, update, delete on public.orders, public.order_items from authenticated;
revoke insert, delete on public.profiles from authenticated;
