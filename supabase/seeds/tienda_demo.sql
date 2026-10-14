-- Datos FICTICIOS para que la tienda pública muestre productos. Ejecutar después de catalogo_demo.sql.
-- Copia los productos de catalogo a public.products bajo un comercio demo aprobado.
-- El precio de cada variante es la oferta ARS más baja del catálogo. Se puede ejecutar varias veces:
-- los ids salen del modelo, así que no duplica. Para quitarlo: delete from auth.users where id = '30000000-0000-4000-8000-000000000001';

-- Cuenta dueña del comercio demo. Sin contraseña: nadie puede iniciar sesión con ella.
-- El trigger on_auth_user_created le crea el perfil.
insert into auth.users (id, email, raw_user_meta_data) values
  ('30000000-0000-4000-8000-000000000001', 'tienda-demo@spot.invalid', '{"full_name": "SPOT Demo (ficticio)"}')
on conflict (id) do nothing;

insert into public.merchants (id, owner_id, name, slug, description, city, status, reviewed_at) values
  ('30000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000001',
   'SPOT Demo (ficticio)', 'spot-demo', 'Comercio de demostración con productos ficticios.', 'Buenos Aires', 'approved', now())
on conflict (id) do nothing;

insert into public.products (id, merchant_id, category_id, name, description, brand, featured)
select
  md5('spot-demo:producto:' || p.modelo)::uuid,
  '30000000-0000-4000-8000-000000000002',
  c.id,
  p.nombre,
  'Producto de demostración (modelo ' || p.modelo || ').',
  initcap(m.nombre),
  -- Uno destacado por categoría, para que la portada tenga qué mostrar.
  row_number() over (partition by cc.nombre order by p.modelo) = 1
from catalogo.productos p
join catalogo.marcas m on m.id = p.marca_id
join catalogo.categorias cc on cc.id = p.categoria_id
left join public.categories c on c.slug = cc.nombre
on conflict (id) do nothing;

insert into public.product_variants (id, product_id, size, color, sku, price_cents, stock)
select
  md5('spot-demo:variante:' || v.id)::uuid,
  md5('spot-demo:producto:' || p.modelo)::uuid,
  v.talle,
  v.color,
  p.modelo || '-' || v.talle,
  (min(o.precio) * 100)::integer,
  10
from catalogo.variantes v
join catalogo.productos p on p.id = v.producto_id
join catalogo.ofertas o on o.variante_id = v.id and o.moneda = 'ARS' and o.disponible
group by v.id, p.modelo, v.talle, v.color
on conflict (id) do nothing;
