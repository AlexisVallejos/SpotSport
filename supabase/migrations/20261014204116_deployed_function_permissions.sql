-- Ajustes detectados por los asesores al aplicar el esquema en Supabase.
alter function public.touch_updated_at() set search_path = '';
alter function public.guard_profile_update() set search_path = '';
alter function public.guard_merchant_update() set search_path = '';
alter function public.guard_product_write() set search_path = '';

-- Los triggers se ejecutan automáticamente; no son endpoints RPC para los clientes.
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.touch_updated_at() from public, anon, authenticated;
revoke execute on function public.guard_profile_update() from public, anon, authenticated;
revoke execute on function public.guard_merchant_update() from public, anon, authenticated;
revoke execute on function public.guard_product_write() from public, anon, authenticated;

-- Existe en proyectos alojados recientes, pero no en el Postgres local de pruebas.
do $$
begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
  end if;
end $$;
