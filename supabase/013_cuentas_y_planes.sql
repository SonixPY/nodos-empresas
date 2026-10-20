-- ═════════════════════════════════════════════════════════════════════════
-- NODOS · Cuentas y planes (20/10/2026)
-- Idempotente: se puede correr más de una vez. Proyecto Supabase "Finanzas"
-- (compartido). Va después de la 1.0 (Empresas 012 = Finanzas 026).
-- Archivo idéntico en nodos-empresas (013_cuentas_y_planes.sql) y
-- finanzas-app (027_cuentas_y_planes.sql).
--
-- Qué cambia:
--   1. Los administradores tienen acceso a todo, sin suscripción y aunque
--      tengan apagado el acceso a una app (solo los frena una suspensión).
--   2. Avatar de la cuenta: un ícono de la marca y un color ("icono:color").
--      Se escribe solo desde el servidor, como el resto del perfil.
--   3. Planes: lista de beneficios editable desde Panel → Suscripciones y
--      que muestra nodoscompliance.com en la sección Planes.
-- ═════════════════════════════════════════════════════════════════════════

-- 1. Administradores: acceso total ------------------------------------------
create or replace function public.tiene_acceso_app(p_app text)
returns boolean
language plpgsql
security definer set search_path = public
stable
as $$
declare
  v_uid uuid := auth.uid();
  v_hoy date := public.hoy_py();
  p record;
begin
  if v_uid is null or p_app is null or p_app not in ('finanzas', 'empresas') then
    return false;
  end if;
  select pr.is_admin, pr.suspendido, pr.acceso_finanzas, pr.acceso_empresas, pr.acceso_cortesia_hasta into p
  from public.profiles pr where pr.id = v_uid;
  if not found then
    return false;
  end if;
  if coalesce(p.suspendido, false) then
    return false;
  end if;
  -- Antes de mirar permisos por app o planes: un admin entra a todo.
  if coalesce(p.is_admin, false) then
    return true;
  end if;
  if (p_app = 'finanzas' and p.acceso_finanzas = false)
     or (p_app = 'empresas' and p.acceso_empresas = false) then
    return false;
  end if;
  if p.acceso_cortesia_hasta is not null and p.acceso_cortesia_hasta >= v_hoy then
    return true;
  end if;
  return exists (
    select 1
    from public.suscripciones su
    join public.planes pl on pl.id = su.plan_id
    where su.user_id = v_uid
      and p_app = any (pl.apps)
      and public.suscripcion_acceso_hasta(su.estado, su.prueba_hasta, su.activa_hasta) >= v_hoy
  );
end;
$$;

revoke all on function public.tiene_acceso_app(text) from public, anon;
grant execute on function public.tiene_acceso_app(text) to authenticated;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.tiene_acceso_app(text) to service_role;
  end if;
end $$;

-- 2. Avatar --------------------------------------------------------------------
alter table public.profiles add column if not exists avatar text;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_avatar_formato') then
    alter table public.profiles add constraint profiles_avatar_formato
      check (avatar is null or avatar ~ '^[a-z]{2,20}:[a-z]{2,20}$');
  end if;
end $$;

-- 3. Beneficios de cada plan ---------------------------------------------------
alter table public.planes add column if not exists beneficios text[] not null default '{}';
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'planes_beneficios_cantidad') then
    alter table public.planes add constraint planes_beneficios_cantidad check (cardinality(beneficios) <= 10);
  end if;
end $$;

-- Textos iniciales (solo si el plan todavía no tiene beneficios cargados).
update public.planes set beneficios = array[
  'Inversiones digitales y tradicionales',
  'Ingresos y gastos, personales y de un negocio',
  'Vencimientos impositivos y trading opcional',
  'Importación desde exchanges y extractos',
  'Noticias según lo que tenés'
] where id = 'finanzas' and cardinality(beneficios) = 0;
update public.planes set beneficios = array[
  'Ficha por empresa: datos, accionistas, poderes y documentos',
  'Vencimientos legales con calendario',
  'Generador de documentos con plantillas',
  'SEPRELAD con el generador del Reporte de Operaciones'
] where id = 'empresas' and cardinality(beneficios) = 0;
update public.planes set beneficios = array[
  'Todo lo de NODOS Finanzas',
  'Todo lo de NODOS Empresas',
  'Socios conectados: ven su parte y sus dividendos, en solo lectura',
  'Dividendos, aportes y vencimientos conectados',
  'Soporte por formulario y email'
] where id = 'combo' and cardinality(beneficios) = 0;

create or replace function public.admin_editar_plan(p_plan text, p_datos jsonb, p_actor uuid)
returns text
language plpgsql
security definer set search_path = public
as $$
declare
  antes jsonb;
begin
  if not exists (select 1 from public.profiles where id = p_actor and is_admin) then
    raise exception 'Solo un administrador puede editar planes.';
  end if;
  select to_jsonb(pl) into antes from public.planes pl where id = p_plan for update;
  if antes is null then
    return 'no_existe';
  end if;
  update public.planes set
    nombre = case when p_datos ? 'nombre' then p_datos ->> 'nombre' else nombre end,
    descripcion = case when p_datos ? 'descripcion' then p_datos ->> 'descripcion' else descripcion end,
    precio_mensual_gs = case when p_datos ? 'precio_mensual_gs' then (p_datos ->> 'precio_mensual_gs')::bigint else precio_mensual_gs end,
    precio_anual_gs = case when p_datos ? 'precio_anual_gs' then (p_datos ->> 'precio_anual_gs')::bigint else precio_anual_gs end,
    polar_producto_mensual = case when p_datos ? 'polar_producto_mensual' then p_datos ->> 'polar_producto_mensual' else polar_producto_mensual end,
    polar_producto_anual = case when p_datos ? 'polar_producto_anual' then p_datos ->> 'polar_producto_anual' else polar_producto_anual end,
    activo = case when p_datos ? 'activo' then (p_datos ->> 'activo')::boolean else activo end,
    beneficios = case
      when p_datos ? 'beneficios' and jsonb_typeof(p_datos -> 'beneficios') = 'array'
        then array(select jsonb_array_elements_text(p_datos -> 'beneficios'))
      else beneficios end,
    updated_at = now()
  where id = p_plan;
  insert into public.eventos_pago (proveedor, tipo, referencia, registrado_por, payload, resultado)
  values ('manual', 'plan_editado', p_plan, p_actor, jsonb_build_object('antes', antes, 'cambios', p_datos), 'ok');
  return 'ok';
end;
$$;

revoke all on function public.admin_editar_plan(text, jsonb, uuid) from public, anon, authenticated;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.admin_editar_plan(text, jsonb, uuid) to service_role;
  end if;
end $$;

notify pgrst, 'reload schema';
