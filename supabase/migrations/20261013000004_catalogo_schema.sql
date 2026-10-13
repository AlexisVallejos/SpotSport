-- 3.1: catálogo del comparador. No modifica las tablas de la tienda existente.
create schema catalogo;
revoke all on schema catalogo from public, anon, authenticated;
grant usage on schema catalogo to service_role;

create table catalogo.comercios (
  id uuid primary key default gen_random_uuid(),
  nombre text not null check (length(btrim(nombre)) between 2 and 100),
  sitio_web text not null unique check (sitio_web ~ '^https://[a-z0-9]+([.-][a-z0-9]+)*(:[0-9]+)?$'),
  estado text not null default 'pendiente' check (estado in ('pendiente', 'activo', 'suspendido')),
  es_demo boolean not null default false,
  unique (id, es_demo)
);

create table catalogo.fuentes (
  id uuid primary key default gen_random_uuid(),
  comercio_id uuid not null,
  nombre text not null,
  tipo text not null check (tipo in ('manual', 'csv', 'api')),
  url_base text not null check (url_base ~ '^https://[a-z0-9]+([.-][a-z0-9]+)*(:[0-9]+)?$'),
  permiso_verificado boolean not null default false,
  evidencia_permiso text not null default '',
  es_demo boolean not null default false,
  ultima_sincronizacion timestamptz,
  foreign key (comercio_id, es_demo) references catalogo.comercios (id, es_demo),
  check (not permiso_verificado or length(btrim(evidencia_permiso)) > 0),
  unique (comercio_id, nombre)
);
create index fuentes_comercio_idx on catalogo.fuentes (comercio_id);

create table catalogo.marcas (
  id uuid primary key default gen_random_uuid(),
  nombre text not null unique check (nombre = lower(btrim(nombre)) and length(nombre) > 0)
);
create table catalogo.categorias (
  id uuid primary key default gen_random_uuid(),
  nombre text not null unique check (nombre = lower(btrim(nombre)) and length(nombre) > 0)
);
create table catalogo.productos (
  id uuid primary key default gen_random_uuid(),
  marca_id uuid not null references catalogo.marcas (id),
  categoria_id uuid not null references catalogo.categorias (id),
  nombre text not null check (length(btrim(nombre)) between 2 and 120),
  modelo text not null check (modelo = upper(btrim(modelo)) and length(modelo) > 0),
  unique (marca_id, modelo)
);
create index productos_categoria_idx on catalogo.productos (categoria_id);

create table catalogo.variantes (
  id uuid primary key default gen_random_uuid(),
  producto_id uuid not null references catalogo.productos (id),
  talle text not null default '' check (talle = upper(btrim(talle))),
  color text not null default '' check (color = lower(btrim(color))),
  unique (producto_id, talle, color)
);

create table catalogo.importaciones (
  id uuid primary key default gen_random_uuid(),
  fuente_id uuid references catalogo.fuentes (id),
  fuente_solicitada uuid not null,
  archivo text not null,
  inicio timestamptz not null default clock_timestamp(),
  fin timestamptz,
  estado text not null default 'procesando' check (estado in ('procesando', 'exito', 'error')),
  filas_recibidas integer not null default 0 check (filas_recibidas >= 0),
  filas_aplicadas integer not null default 0 check (filas_aplicadas >= 0),
  detalle text
);
create index importaciones_fuente_idx on catalogo.importaciones (fuente_id, inicio desc);

create table catalogo.ofertas (
  id uuid primary key default gen_random_uuid(),
  fuente_id uuid not null references catalogo.fuentes (id),
  variante_id uuid not null references catalogo.variantes (id),
  codigo_externo text not null check (codigo_externo = btrim(codigo_externo) and length(codigo_externo) between 1 and 100),
  precio numeric(12,2) not null check (precio >= 0 and precio < 'Infinity'::numeric),
  moneda text not null check (moneda in ('ARS', 'USD')),
  url_producto text not null,
  disponible boolean not null,
  fecha_observacion timestamptz not null,
  vigente_hasta timestamptz,
  importacion_id uuid not null references catalogo.importaciones (id),
  unique (fuente_id, codigo_externo),
  check (vigente_hasta is null or vigente_hasta >= fecha_observacion)
);
create index ofertas_variante_moneda_idx on catalogo.ofertas (variante_id, moneda, precio);
create index ofertas_fecha_idx on catalogo.ofertas (fecha_observacion desc);

create table catalogo.historial_precios (
  id uuid primary key default gen_random_uuid(),
  oferta_id uuid not null references catalogo.ofertas (id),
  importacion_id uuid not null references catalogo.importaciones (id),
  precio numeric(12,2) not null check (precio >= 0 and precio < 'Infinity'::numeric),
  moneda text not null check (moneda in ('ARS', 'USD')),
  fecha_observacion timestamptz not null,
  disponible boolean not null,
  url_producto text not null,
  unique (oferta_id, fecha_observacion)
);

-- Se define el modelo complementario; la cámara sigue usando su configuración actual.
create table catalogo.ejercicios (
  id uuid primary key default gen_random_uuid(),
  nombre text not null unique,
  activo boolean not null default false,
  instrucciones text not null default ''
);
create table catalogo.reglas_movimiento (
  id uuid primary key default gen_random_uuid(),
  ejercicio_id uuid not null references catalogo.ejercicios (id),
  metrica text not null,
  minimo numeric(8,3),
  maximo numeric(8,3),
  mensaje text not null,
  validada boolean not null default false,
  check (minimo is null or maximo is null or minimo <= maximo),
  unique (ejercicio_id, metrica)
);
create table catalogo.membresias (
  comercio_id uuid not null references catalogo.comercios (id),
  perfil_id uuid not null references public.profiles (id),
  rol text not null check (rol in ('titular', 'operador')),
  primary key (comercio_id, perfil_id)
);

-- El acceso público/paneles se implementará en 3.4/3.5. Por ahora, solo servidor/SQL.
do $$
declare t text;
begin
  foreach t in array array['comercios','fuentes','marcas','categorias','productos','variantes',
    'importaciones','ofertas','historial_precios','ejercicios','reglas_movimiento','membresias'] loop
    execute format('alter table catalogo.%I enable row level security', t);
    execute format('create policy servidor on catalogo.%I for all to service_role using (true) with check (true)', t);
  end loop;
end $$;
revoke all on all tables in schema catalogo from public, anon, authenticated;
grant select, insert, update on all tables in schema catalogo to service_role;
revoke update on catalogo.historial_precios from service_role;

-- El precio actual y su observación histórica se escriben en la misma transacción.
create function catalogo.validar_oferta() returns trigger
language plpgsql set search_path = '' as $$
declare f record;
begin
  select fuentes.*, comercios.estado into f from catalogo.fuentes fuentes
    join catalogo.comercios comercios on comercios.id = fuentes.comercio_id
    where fuentes.id = new.fuente_id;
  if not found or f.estado <> 'activo' or not f.permiso_verificado then
    raise exception 'Fuente no autorizada o comercio inactivo';
  end if;
  if new.url_producto !~ '^https://[^[:space:]]+$'
     or left(new.url_producto, length(f.url_base) + 1) <> f.url_base || '/' then
    raise exception 'El enlace no pertenece al origen autorizado';
  end if;
  if new.fecha_observacion > clock_timestamp() then
    raise exception 'La fecha de observación no puede estar en el futuro';
  end if;
  if tg_op = 'UPDATE' then
    if new.fuente_id <> old.fuente_id or new.codigo_externo <> old.codigo_externo
       or new.variante_id <> old.variante_id or new.moneda <> old.moneda then
      raise exception 'No se puede cambiar la identidad de una oferta';
    end if;
    if new.fecha_observacion < old.fecha_observacion then
      raise exception 'Observación anterior al precio actual';
    end if;
    if new.fecha_observacion = old.fecha_observacion and
       (new.precio, new.disponible, new.url_producto) is distinct from
       (old.precio, old.disponible, old.url_producto) then
      raise exception 'La misma fecha tiene datos diferentes';
    end if;
  end if;
  return new;
end $$;
create trigger oferta_validar before insert or update on catalogo.ofertas
  for each row execute function catalogo.validar_oferta();

create function catalogo.registrar_precio() returns trigger
language plpgsql set search_path = '' as $$
begin
  insert into catalogo.historial_precios
    (oferta_id, importacion_id, precio, moneda, fecha_observacion, disponible, url_producto)
  values (new.id, new.importacion_id, new.precio, new.moneda, new.fecha_observacion, new.disponible, new.url_producto)
  on conflict (oferta_id, fecha_observacion) do nothing;
  return new;
end $$;
create trigger oferta_historial after insert or update on catalogo.ofertas
  for each row execute function catalogo.registrar_precio();
revoke execute on all functions in schema catalogo from public, anon, authenticated;
