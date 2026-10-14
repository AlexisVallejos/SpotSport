-- 3.3: carga manual/CSV en un solo lote. Los errores quedan registrados sin carga parcial.
create function public.importar_catalogo(p_fuente uuid, p_filas jsonb, p_archivo text default 'manual')
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  v_log uuid;
  v_fuente catalogo.fuentes;
  r jsonb;
  v_marca uuid;
  v_categoria uuid;
  v_producto uuid;
  v_variante uuid;
  v_anterior catalogo.ofertas;
  v_fecha timestamptz;
  v_aplicadas integer := 0;
  v_fila integer := 0;
  v_error text;
  v_codigo text;
begin
  select * into v_fuente from catalogo.fuentes where id = p_fuente for update;
  insert into catalogo.importaciones (fuente_id, fuente_solicitada, archivo, filas_recibidas)
  values (v_fuente.id, p_fuente, p_archivo,
    case when jsonb_typeof(p_filas) = 'array' then jsonb_array_length(p_filas) else 0 end)
  returning id into v_log;

  -- Este bloque revierte SOLO los datos del lote; el registro externo del intento permanece.
  begin
    if v_fuente.id is null then raise exception 'Fuente inexistente'; end if;
    if not v_fuente.permiso_verificado then raise exception 'Fuente sin permiso verificado'; end if;
    if not exists (select 1 from catalogo.comercios where id = v_fuente.comercio_id and estado = 'activo') then
      raise exception 'Comercio inactivo';
    end if;
    if p_filas is null or jsonb_typeof(p_filas) <> 'array' then raise exception 'Se esperaba una lista de filas'; end if;
    if jsonb_array_length(p_filas) not between 1 and 1000 then
      raise exception 'El lote debe contener entre 1 y 1000 filas';
    end if;
    if exists (select 1 from jsonb_array_elements(p_filas) x
      group by btrim(x ->> 'codigo_externo') having count(*) > 1) then
      raise exception 'Hay códigos externos duplicados dentro del lote';
    end if;

    for r in select value from jsonb_array_elements(p_filas) loop
      v_fila := v_fila + 1;
      if jsonb_typeof(r) <> 'object' then raise exception 'Fila inválida'; end if;
      foreach v_codigo in array array['codigo_externo','marca','categoria','modelo','nombre',
        'precio','moneda','url_producto','fecha_observacion'] loop
        if jsonb_typeof(r -> v_codigo) is distinct from 'string'
           or coalesce(btrim(r ->> v_codigo), '') = '' then
          raise exception 'Campo obligatorio inválido: %', v_codigo;
        end if;
      end loop;
      if jsonb_typeof(r -> 'talle') is distinct from 'string'
         or jsonb_typeof(r -> 'color') is distinct from 'string'
         or jsonb_typeof(r -> 'disponible') is distinct from 'boolean'
         or jsonb_typeof(r -> 'es_demo') is distinct from 'boolean' then
        raise exception 'Talle/color deben ser texto y disponible/es_demo booleanos';
      end if;
      if (r ->> 'es_demo')::boolean <> v_fuente.es_demo then
        raise exception 'El rótulo demo no coincide con la fuente';
      end if;
      if (r ->> 'precio') !~ '^(0|[1-9][0-9]{0,9})(\.[0-9]{1,2})?$' then
        raise exception 'Precio inválido: usar decimal no negativo con hasta dos decimales';
      end if;
      if (r ->> 'fecha_observacion') !~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$' then
        raise exception 'Fecha inválida: usar ISO 8601 con zona horaria';
      end if;
      v_fecha := (r ->> 'fecha_observacion')::timestamptz;

      insert into catalogo.marcas (nombre) values (lower(btrim(r ->> 'marca')))
        on conflict (nombre) do update set nombre = excluded.nombre returning id into v_marca;
      insert into catalogo.categorias (nombre) values (lower(btrim(r ->> 'categoria')))
        on conflict (nombre) do update set nombre = excluded.nombre returning id into v_categoria;
      insert into catalogo.productos (marca_id, categoria_id, nombre, modelo)
        values (v_marca, v_categoria, btrim(r ->> 'nombre'), upper(btrim(r ->> 'modelo')))
        on conflict (marca_id, modelo) do nothing;
      select id into v_producto from catalogo.productos
        where marca_id = v_marca and modelo = upper(btrim(r ->> 'modelo')) and categoria_id = v_categoria;
      if v_producto is null then raise exception 'El mismo modelo tiene otra categoría'; end if;
      insert into catalogo.variantes (producto_id, talle, color)
        values (v_producto, upper(btrim(r ->> 'talle')), lower(btrim(r ->> 'color')))
        on conflict (producto_id, talle, color) do update set producto_id = excluded.producto_id
        returning id into v_variante;

      select * into v_anterior from catalogo.ofertas
        where fuente_id = p_fuente and codigo_externo = btrim(r ->> 'codigo_externo');
      if v_anterior.id is not null and v_anterior.fecha_observacion = v_fecha
         and (v_anterior.variante_id, v_anterior.precio, v_anterior.moneda, v_anterior.url_producto, v_anterior.disponible)
             is not distinct from (v_variante, (r ->> 'precio')::numeric, r ->> 'moneda',
                                   r ->> 'url_producto', (r ->> 'disponible')::boolean) then
        continue; -- Reimportar una observación idéntica no duplica ofertas ni historial.
      end if;

      insert into catalogo.ofertas (fuente_id, variante_id, codigo_externo, precio, moneda,
        url_producto, disponible, fecha_observacion, importacion_id)
      values (p_fuente, v_variante, btrim(r ->> 'codigo_externo'), (r ->> 'precio')::numeric,
        r ->> 'moneda', r ->> 'url_producto', (r ->> 'disponible')::boolean, v_fecha, v_log)
      on conflict (fuente_id, codigo_externo) do update set
        variante_id = excluded.variante_id, precio = excluded.precio, moneda = excluded.moneda,
        url_producto = excluded.url_producto, disponible = excluded.disponible,
        fecha_observacion = excluded.fecha_observacion, importacion_id = excluded.importacion_id;
      v_aplicadas := v_aplicadas + 1;
    end loop;

    update catalogo.fuentes set ultima_sincronizacion = clock_timestamp() where id = p_fuente;
  exception when others then
    get stacked diagnostics v_error = message_text, v_codigo = returned_sqlstate;
    update catalogo.importaciones set estado = 'error', fin = clock_timestamp(),
      detalle = format('Fila %s: %s [%s]', v_fila, v_error, v_codigo) where id = v_log;
    return jsonb_build_object('ok', false, 'importacion_id', v_log, 'filas_aplicadas', 0,
      'error', format('Fila %s: %s', v_fila, v_error));
  end;

  update catalogo.importaciones set estado = 'exito', fin = clock_timestamp(),
    filas_aplicadas = v_aplicadas where id = v_log;
  return jsonb_build_object('ok', true, 'importacion_id', v_log, 'filas_aplicadas', v_aplicadas);
end $$;
revoke execute on function public.importar_catalogo(uuid, jsonb, text) from public, anon, authenticated;
grant execute on function public.importar_catalogo(uuid, jsonb, text) to service_role;
