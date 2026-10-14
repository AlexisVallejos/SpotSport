-- 3.2: datos FICTICIOS. Ejecutar explícitamente después de las migraciones.
-- 20 modelos, 20 variantes y 40 ofertas comparables en dos comercios ficticios.
-- .invalid es un dominio reservado: estos enlaces no representan tiendas reales.
insert into catalogo.comercios (id, nombre, sitio_web, estado, es_demo) values
  ('10000000-0000-4000-8000-000000000001', 'Comercio Demo A (ficticio)', 'https://demo-a.invalid', 'activo', true),
  ('10000000-0000-4000-8000-000000000002', 'Comercio Demo B (ficticio)', 'https://demo-b.invalid', 'activo', true)
on conflict (id) do nothing;
insert into catalogo.fuentes
  (id, comercio_id, nombre, tipo, url_base, permiso_verificado, evidencia_permiso, es_demo) values
  ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001',
   'CSV Demo A', 'csv', 'https://demo-a.invalid', true, 'Dataset ficticio creado por el equipo; sin catálogo externo.', true),
  ('20000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000002',
   'CSV Demo B', 'csv', 'https://demo-b.invalid', true, 'Dataset ficticio creado por el equipo; sin catálogo externo.', true)
on conflict (id) do nothing;

do $$
declare
  f record;
  filas jsonb;
  resultado jsonb;
begin
  for f in select * from catalogo.fuentes where id in
    ('20000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000002') order by id loop
    select jsonb_agg(jsonb_build_object(
      'codigo_externo', modelo, 'marca', 'SPOT Demo', 'categoria', categoria,
      'modelo', modelo, 'nombre', nombre || ' (demo)', 'talle', talle, 'color', color,
      'precio', (precio + case when f.nombre = 'CSV Demo B' then ajuste else 0 end)::numeric(12,2)::text,
      'moneda', 'ARS', 'url_producto', f.url_base || '/productos/' || lower(modelo),
      'fecha_observacion', '2026-10-11T00:00:00Z', 'disponible', true, 'es_demo', true
    ) order by modelo) into filas from (values
      ('RUTA-01', 'running', 'Zapatilla Ruta', '42', 'negro', 80000, -3000),
      ('RUTA-02', 'running', 'Zapatilla Fondo', '40', 'blanco', 95000, 2000),
      ('RUTA-03', 'running', 'Zapatilla Ritmo', '41', 'azul', 72000, -2500),
      ('RUTA-04', 'running', 'Zapatilla Pista', '43', 'gris', 110000, 4000),
      ('TRAIN-01', 'entrenamiento', 'Zapatilla Base', '42', 'negro', 78000, -1800),
      ('TRAIN-02', 'entrenamiento', 'Zapatilla Fuerza', '39', 'gris', 85000, 1500),
      ('FUT-01', 'futbol', 'Botín Cancha', '42', 'negro', 90000, -4000),
      ('FUT-02', 'futbol', 'Botín Césped', '41', 'blanco', 105000, 3000),
      ('FUT-03', 'futbol', 'Pelota Partido', '5', 'blanco', 32000, -1000),
      ('FUT-04', 'futbol', 'Canillera Campo', 'M', 'negro', 14000, 500),
      ('ROPA-01', 'indumentaria', 'Remera Aire', 'M', 'azul', 24000, -700),
      ('ROPA-02', 'indumentaria', 'Short Ritmo', 'L', 'negro', 28000, 1000),
      ('ROPA-03', 'indumentaria', 'Campera Movimiento', 'M', 'gris', 65000, -2000),
      ('ROPA-04', 'indumentaria', 'Calza Entrenamiento', 'S', 'negro', 35000, 500),
      ('ROPA-05', 'indumentaria', 'Buzo Abrigo', 'L', 'azul', 47000, -1200),
      ('ACC-01', 'accesorios', 'Gorra Deporte', 'UNICO', 'negro', 16000, 600),
      ('ACC-02', 'accesorios', 'Botella Hidratación', '750ML', 'azul', 18000, -500),
      ('ACC-03', 'accesorios', 'Medias Running', '40-43', 'blanco', 9000, 300),
      ('ACC-04', 'accesorios', 'Colchoneta Fitness', 'UNICO', 'gris', 27000, -900),
      ('ACC-05', 'accesorios', 'Bolso Entrenamiento', 'UNICO', 'negro', 39000, 1200)
    ) as datos(modelo, categoria, nombre, talle, color, precio, ajuste);
    resultado := public.importar_catalogo(f.id, filas, 'seed/catalogo_demo.sql');
    if not (resultado ->> 'ok')::boolean then
      raise exception 'No se pudo cargar la demo: %', resultado ->> 'error';
    end if;
  end loop;
end $$;

-- Publicación explícita de fixtures ficticias revisadas por el equipo.
update catalogo.ofertas o set publicada = true,
  evidencia_revision = 'Fixture ficticia revisada; sin verificación HTTP', fecha_revision = now()
from catalogo.fuentes f
where o.fuente_id = f.id and f.id in
  ('20000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000002')
  and f.es_demo and f.permiso_verificado;
