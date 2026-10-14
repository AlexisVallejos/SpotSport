-- 3.4–3.6: lectura pública con RLS y operaciones autorizadas del comparador.
alter table catalogo.ofertas add column publicada boolean not null default false;
alter table catalogo.ofertas add column evidencia_revision text;
alter table catalogo.ofertas add column revisada_por uuid references public.profiles(id);
alter table catalogo.ofertas add column fecha_revision timestamptz;
alter table catalogo.importaciones add column actor_id uuid references public.profiles(id) default auth.uid();
create index importaciones_actor_idx on catalogo.importaciones(actor_id);
create index membresias_perfil_idx on catalogo.membresias(perfil_id);
create index ofertas_importacion_idx on catalogo.ofertas(importacion_id);
create index ofertas_revisor_idx on catalogo.ofertas(revisada_por);
create index historial_importacion_idx on catalogo.historial_precios(importacion_id);

-- La demo existente fue revisada por el equipo. Las futuras cargas requieren moderación.
update catalogo.ofertas o set publicada = true, evidencia_revision = 'Fixture ficticia revisada; sin verificación HTTP',
  fecha_revision = now() from catalogo.fuentes f, catalogo.comercios c
where o.fuente_id = f.id and f.comercio_id = c.id and f.es_demo
  and f.permiso_verificado and c.estado = 'activo';

-- Helpers internos: consultan filas protegidas sin recursión entre políticas.
create function catalogo.puede_gestionar(p_comercio uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and (public.is_admin() or exists (
    select 1 from catalogo.membresias where comercio_id = p_comercio and perfil_id = auth.uid()))
$$;
create function catalogo.es_publicable(p_oferta uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from catalogo.ofertas o
    join catalogo.fuentes f on f.id = o.fuente_id
    join catalogo.comercios c on c.id = f.comercio_id
    where o.id = p_oferta and o.publicada and o.disponible and f.permiso_verificado
      and c.estado = 'activo' and o.fecha_observacion <= now()
      and (o.vigente_hasta is null or o.vigente_hasta > now()))
$$;
revoke all on function catalogo.puede_gestionar(uuid), catalogo.es_publicable(uuid) from public;
grant usage on schema catalogo to anon, authenticated;
grant execute on function catalogo.puede_gestionar(uuid), catalogo.es_publicable(uuid) to anon, authenticated;

-- Solo columnas del contrato; no evidencia privada, actor ni identificadores de importaciones.
grant select(id,nombre,estado,es_demo) on catalogo.comercios to anon, authenticated;
grant select(id,comercio_id,nombre,tipo,url_base,permiso_verificado,es_demo,ultima_sincronizacion)
  on catalogo.fuentes to anon, authenticated;
grant select(id,nombre) on catalogo.marcas, catalogo.categorias to anon, authenticated;
grant select(id,marca_id,categoria_id,nombre,modelo) on catalogo.productos to anon, authenticated;
grant select(id,producto_id,talle,color) on catalogo.variantes to anon, authenticated;
grant select(id,fuente_id,variante_id,codigo_externo,precio,moneda,url_producto,disponible,
  fecha_observacion,vigente_hasta,publicada) on catalogo.ofertas to anon, authenticated;
grant select(id,oferta_id,precio,moneda,fecha_observacion,disponible,url_producto)
  on catalogo.historial_precios to anon, authenticated;
grant select on catalogo.membresias to authenticated;

create policy lectura on catalogo.comercios for select to anon, authenticated
using (estado = 'activo' or catalogo.puede_gestionar(id));
create policy lectura on catalogo.fuentes for select to anon, authenticated
using (catalogo.puede_gestionar(comercio_id) or (permiso_verificado and exists (
  select 1 from catalogo.comercios c where c.id = comercio_id and c.estado = 'activo')));
create policy lectura on catalogo.ofertas for select to anon, authenticated
using (catalogo.es_publicable(id) or exists (select 1 from catalogo.fuentes f
  where f.id = fuente_id and catalogo.puede_gestionar(f.comercio_id)));
create policy lectura on catalogo.variantes for select to anon, authenticated
using (exists (select 1 from catalogo.ofertas o where o.variante_id = catalogo.variantes.id));
create policy lectura on catalogo.productos for select to anon, authenticated
using (exists (select 1 from catalogo.variantes v where v.producto_id = catalogo.productos.id));
create policy lectura on catalogo.marcas for select to anon, authenticated
using (exists (select 1 from catalogo.productos p where p.marca_id = catalogo.marcas.id));
create policy lectura on catalogo.categorias for select to anon, authenticated
using (exists (select 1 from catalogo.productos p where p.categoria_id = catalogo.categorias.id));
create policy lectura on catalogo.historial_precios for select to anon, authenticated
using (exists (select 1 from catalogo.ofertas o where o.id = oferta_id));
create policy lectura on catalogo.membresias for select to authenticated
using (perfil_id = (select auth.uid()) or (select public.is_admin()));

create view public.catalogo_ofertas with (security_invoker = true) as
select o.id as "ofertaId", p.id as "productoId", v.id as "varianteId", p.nombre,
  m.nombre as marca, p.modelo, cat.nombre as categoria, v.talle, v.color,
  o.precio::text as precio, o.moneda, c.nombre as comercio, c.id as "comercioId",
  o.url_producto as "urlOrigen", f.id as "fuenteId", o.fecha_observacion as "fechaActualizacion",
  o.disponible, f.es_demo as "esDemo", o.precio as "precioOrden",
  concat_ws(' ', p.nombre, p.modelo, m.nombre, cat.nombre) as busqueda
from catalogo.ofertas o
join catalogo.variantes v on v.id = o.variante_id
join catalogo.productos p on p.id = v.producto_id
join catalogo.marcas m on m.id = p.marca_id
join catalogo.categorias cat on cat.id = p.categoria_id
join catalogo.fuentes f on f.id = o.fuente_id
join catalogo.comercios c on c.id = f.comercio_id
where catalogo.es_publicable(o.id);

create view public.catalogo_historial with (security_invoker = true) as
select h.id, h.oferta_id as "ofertaId", h.precio::text as precio, h.moneda,
  h.fecha_observacion as fecha, h.disponible, h.url_producto as "urlOrigen"
from catalogo.historial_precios h where catalogo.es_publicable(h.oferta_id);

create view public.catalogo_fuentes_gestion with (security_invoker = true) as
select f.id, f.comercio_id, c.nombre as comercio, c.estado, f.nombre, f.tipo,
  f.url_base, f.permiso_verificado, f.es_demo, f.ultima_sincronizacion
from catalogo.fuentes f join catalogo.comercios c on c.id = f.comercio_id
where catalogo.puede_gestionar(c.id);

create view public.catalogo_ofertas_gestion with (security_invoker = true) as
select o.id, o.fuente_id, o.codigo_externo, p.nombre, p.modelo, m.nombre as marca,
  cat.nombre as categoria, v.talle, v.color, o.precio::text as precio, o.moneda,
  o.url_producto, o.fecha_observacion, o.disponible, o.publicada, o.vigente_hasta, f.es_demo
from catalogo.ofertas o join catalogo.fuentes f on f.id = o.fuente_id
join catalogo.variantes v on v.id = o.variante_id join catalogo.productos p on p.id = v.producto_id
join catalogo.marcas m on m.id = p.marca_id join catalogo.categorias cat on cat.id = p.categoria_id
where catalogo.puede_gestionar(f.comercio_id);

revoke all on public.catalogo_ofertas, public.catalogo_historial,
  public.catalogo_fuentes_gestion, public.catalogo_ofertas_gestion from public, anon, authenticated;
grant select on public.catalogo_ofertas, public.catalogo_historial to anon, authenticated;
grant select on public.catalogo_fuentes_gestion, public.catalogo_ofertas_gestion to authenticated;

-- Privilegios elevados quedan en funciones privadas con autorización explícita.
create function catalogo.cargar(p_fuente uuid, p_filas jsonb, p_archivo text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_resultado jsonb;
begin
  -- Se bloquea la fuente durante autorización/importación/moderación.
  perform 1 from catalogo.fuentes where id = p_fuente for update;
  if auth.uid() is null or not exists (select 1 from catalogo.fuentes
    where id = p_fuente and catalogo.puede_gestionar(comercio_id)) then
    raise exception 'No tenés permiso para cargar esta fuente' using errcode = '42501';
  end if;
  v_resultado := public.importar_catalogo(p_fuente, p_filas, p_archivo);
  return v_resultado;
end $$;

create function catalogo.asignar_operador(p_comercio uuid, p_perfil uuid, p_rol text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'No tenés permiso de administrador' using errcode = '42501';
  end if;
  if p_rol is null then
    delete from catalogo.membresias where comercio_id = p_comercio and perfil_id = p_perfil;
  else
    insert into catalogo.membresias(comercio_id,perfil_id,rol) values (p_comercio,p_perfil,p_rol)
      on conflict (comercio_id,perfil_id) do update set rol = excluded.rol;
  end if;
end $$;

create function catalogo.moderar_oferta(p_oferta uuid, p_publicada boolean, p_vigente_hasta timestamptz, p_evidencia text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'No tenés permiso de administrador' using errcode = '42501';
  end if;
  if p_publicada and exists (select 1 from catalogo.ofertas o join catalogo.fuentes f on f.id=o.fuente_id
    where o.id=p_oferta and not f.es_demo) and
    (length(btrim(coalesce(p_evidencia,''))) < 10 or p_vigente_hasta is null or p_vigente_hasta <= now()) then
    raise exception 'Para publicar datos reales registrá la revisión del enlace/precio y una vigencia futura'
      using errcode = '23514';
  end if;
  -- Ocultar debe funcionar incluso después de suspender un comercio o retirar un permiso.
  -- El trigger de validación se ejecuta solo para cambios de datos observados (ver abajo).
  update catalogo.ofertas set publicada = p_publicada, vigente_hasta = p_vigente_hasta,
    evidencia_revision = case when p_publicada then coalesce(nullif(btrim(p_evidencia),''),
      'Fixture ficticia revisada; sin verificación HTTP') else evidencia_revision end,
    revisada_por = auth.uid(), fecha_revision = now() where id = p_oferta;
  if not found then raise exception 'Oferta inexistente' using errcode = 'P0002'; end if;
  if p_publicada and not catalogo.es_publicable(p_oferta) then
    raise exception 'La oferta no cumple las condiciones de publicación' using errcode = '23514';
  end if;
end $$;

-- Una operación admin para alta/edición y moderación del comercio y su fuente autorizada.
create function catalogo.configurar_fuente(p_comercio uuid, p_fuente uuid, p_nombre text,
  p_sitio text, p_estado text, p_nombre_fuente text, p_tipo text, p_url_base text,
  p_permiso boolean, p_evidencia text, p_demo boolean) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_comercio uuid := coalesce(p_comercio, gen_random_uuid());
  v_fuente uuid := coalesce(p_fuente, gen_random_uuid());
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'No tenés permiso de administrador' using errcode = '42501';
  end if;
  if exists (select 1 from catalogo.fuentes where id = v_fuente and comercio_id <> v_comercio) then
    raise exception 'No se puede transferir una fuente a otro comercio' using errcode = '23514';
  end if;
  insert into catalogo.comercios(id,nombre,sitio_web,estado,es_demo)
    values (v_comercio,p_nombre,p_sitio,p_estado,p_demo)
    on conflict(id) do update set nombre=excluded.nombre,sitio_web=excluded.sitio_web,
      estado=excluded.estado,es_demo=excluded.es_demo;
  insert into catalogo.fuentes(id,comercio_id,nombre,tipo,url_base,permiso_verificado,evidencia_permiso,es_demo)
    values (v_fuente,v_comercio,p_nombre_fuente,p_tipo,p_url_base,p_permiso,p_evidencia,p_demo)
    on conflict(id) do update set nombre=excluded.nombre,tipo=excluded.tipo,
      permiso_verificado=excluded.permiso_verificado,evidencia_permiso=excluded.evidencia_permiso;
  -- El origen y el rótulo de una fuente existente son inmutables: evitan relabelar el historial.
  if exists (select 1 from catalogo.fuentes where id=v_fuente
    and (url_base,es_demo) is distinct from (p_url_base,p_demo)) then
    raise exception 'Crear otra fuente para cambiar origen o rótulo demo' using errcode='23514';
  end if;
  return jsonb_build_object('comercio_id',v_comercio,'fuente_id',v_fuente);
end $$;

revoke all on function catalogo.cargar(uuid,jsonb,text),catalogo.asignar_operador(uuid,uuid,text),
  catalogo.moderar_oferta(uuid,boolean,timestamptz,text),
  catalogo.configurar_fuente(uuid,uuid,text,text,text,text,text,text,boolean,text,boolean) from public, anon;
grant execute on function catalogo.cargar(uuid,jsonb,text),catalogo.asignar_operador(uuid,uuid,text),
  catalogo.moderar_oferta(uuid,boolean,timestamptz,text),
  catalogo.configurar_fuente(uuid,uuid,text,text,text,text,text,text,boolean,text,boolean) to authenticated;

create function public.cargar_ofertas_catalogo(p_fuente uuid, p_filas jsonb, p_archivo text default 'manual')
returns jsonb language sql security invoker set search_path = '' as $$ select catalogo.cargar(p_fuente,p_filas,p_archivo) $$;
create function public.asignar_operador_catalogo(p_comercio uuid, p_perfil uuid, p_rol text)
returns void language sql security invoker set search_path = '' as $$ select catalogo.asignar_operador(p_comercio,p_perfil,p_rol) $$;
create function public.moderar_oferta_catalogo(p_oferta uuid, p_publicada boolean,
  p_vigente_hasta timestamptz default null, p_evidencia text default null)
returns void language sql security invoker set search_path = '' as $$ select catalogo.moderar_oferta(p_oferta,p_publicada,p_vigente_hasta,p_evidencia) $$;
create function public.configurar_fuente_catalogo(p_comercio uuid, p_fuente uuid, p_nombre text,
  p_sitio text, p_estado text, p_nombre_fuente text, p_tipo text, p_url_base text,
  p_permiso boolean, p_evidencia text, p_demo boolean)
returns jsonb language sql security invoker set search_path = '' as $$
  select catalogo.configurar_fuente(p_comercio,p_fuente,p_nombre,p_sitio,p_estado,p_nombre_fuente,
    p_tipo,p_url_base,p_permiso,p_evidencia,p_demo)
$$;
revoke all on function public.cargar_ofertas_catalogo(uuid,jsonb,text),public.asignar_operador_catalogo(uuid,uuid,text),
  public.moderar_oferta_catalogo(uuid,boolean,timestamptz,text),
  public.configurar_fuente_catalogo(uuid,uuid,text,text,text,text,text,text,boolean,text,boolean) from public,anon;
grant execute on function public.cargar_ofertas_catalogo(uuid,jsonb,text),public.asignar_operador_catalogo(uuid,uuid,text),
  public.moderar_oferta_catalogo(uuid,boolean,timestamptz,text),
  public.configurar_fuente_catalogo(uuid,uuid,text,text,text,text,text,text,boolean,text,boolean) to authenticated;

-- Moderar no es una nueva observación ni debe depender del permiso actual de la fuente.
drop trigger oferta_validar on catalogo.ofertas;
create trigger oferta_validar before insert or update of fuente_id,variante_id,codigo_externo,
  precio,moneda,url_producto,disponible,fecha_observacion,importacion_id on catalogo.ofertas
  for each row execute function catalogo.validar_oferta();

create function catalogo.despublicar_cambio() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  new.publicada := false;
  new.evidencia_revision := null;
  new.revisada_por := null;
  new.fecha_revision := null;
  return new;
end $$;
revoke all on function catalogo.despublicar_cambio() from public, anon, authenticated;
create trigger oferta_despublicar before insert or update of fuente_id,variante_id,codigo_externo,
  precio,moneda,url_producto,disponible,fecha_observacion,importacion_id on catalogo.ofertas
  for each row execute function catalogo.despublicar_cambio();

notify pgrst, 'reload schema';
