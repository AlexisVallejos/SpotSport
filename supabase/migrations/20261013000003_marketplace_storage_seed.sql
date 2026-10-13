-- Marketplace SPOT · imágenes y datos iniciales

-- Buckets públicos de lectura. Cada comercio escribe solo en la carpeta con el id de su comercio;
-- el bucket "site" (banners y anuncios) lo escribe solo el admin.
insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true), ('site', 'site', true)
on conflict (id) do nothing;

create policy storage_public_read on storage.objects for select to anon, authenticated
  using (bucket_id in ('product-images', 'site'));

create policy storage_merchant_insert on storage.objects for insert to authenticated
  with check (
    bucket_id = 'product-images'
    and (public.is_admin() or (storage.foldername(name))[1] = public.my_merchant_id()::text)
  );
create policy storage_merchant_update on storage.objects for update to authenticated
  using (
    bucket_id = 'product-images'
    and (public.is_admin() or (storage.foldername(name))[1] = public.my_merchant_id()::text)
  );
create policy storage_merchant_delete on storage.objects for delete to authenticated
  using (
    bucket_id = 'product-images'
    and (public.is_admin() or (storage.foldername(name))[1] = public.my_merchant_id()::text)
  );

create policy storage_site_admin_write on storage.objects for all to authenticated
  using (bucket_id = 'site' and public.is_admin())
  with check (bucket_id = 'site' and public.is_admin());

-- Categorías iniciales (las del sitio actual).
insert into public.categories (slug, name, sort) values
  ('running', 'Running', 1),
  ('entrenamiento', 'Entrenamiento', 2),
  ('futbol', 'Fútbol', 3),
  ('sportstyle', 'Sportstyle', 4),
  ('indumentaria', 'Indumentaria', 5),
  ('accesorios', 'Accesorios', 6)
on conflict (slug) do nothing;

insert into public.site_settings (key, value) values
  ('store', '{"name": "SPOT", "tagline": "Todo el deporte en un solo lugar", "whatsapp": ""}')
on conflict (key) do nothing;
