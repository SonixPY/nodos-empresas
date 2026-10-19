-- ═════════════════════════════════════════════════════════════════════════
-- NODOS · Suscripciones (planes, suscripciones, pagos, registro de eventos).
-- Idempotente: se puede correr más de una vez. Correr en el proyecto Supabase
-- compartido ("Finanzas"), después de 000–010 de Empresas y 021–024 de Finanzas.
--
-- Independiente del procesador de pagos: hoy Polar (tarjeta, Merchant of
-- Record) y pagos manuales (transferencia o QR que registra un admin);
-- mañana se puede sumar Pagopar sin cambiar las tablas.
--
-- Principios de seguridad (instrucción del dueño):
--   · Los datos de tarjeta NUNCA pasan por NODOS: se paga en el checkout de
--     Polar. Acá solo se guardan identificadores (suscripción, cliente, orden).
--   · Suscripciones, pagos y eventos los escribe SOLO el servidor (service
--     role, a través de funciones). Cada cuenta LEE solo lo suyo; los admins
--     leen todo. No hay políticas de insert/update/delete para el navegador.
--   · Los productos y precios salen de la tabla `planes`, nunca del navegador.
--   · Cada evento de pago queda en `eventos_pago`, que no se puede editar ni
--     borrar (ni con service role). El id del evento del proveedor es único:
--     un webhook repetido no se procesa dos veces.
--
-- Mientras la variable SUSCRIPCIONES_ACTIVAS no sea "true" en Vercel, las
-- apps NO cortan el acceso a nadie: esta migración solo prepara los datos.
-- ═════════════════════════════════════════════════════════════════════════

-- 0. Restos de un borrador anterior (nunca corrido) ---------------------------
drop trigger if exists on_profile_crear_prueba on public.profiles;
drop function if exists public.crear_prueba_suscripcion();
drop function if exists public.estado_acceso();
drop function if exists public.confirmar_pago(uuid, text, uuid, jsonb);
drop function if exists public.anular_pago(uuid, uuid, jsonb);

-- Fecha de hoy en Paraguay (las vigencias se cuentan por día local).
create or replace function public.hoy_py()
returns date
language sql
stable
as $$
  select (now() at time zone 'America/Asuncion')::date;
$$;

-- 1. Perfiles: cortesía y términos -------------------------------------------
-- Cortesía: acceso sin pagar a las dos apps hasta esa fecha (inclusive). Es
-- una columna nueva y no se reusan acceso_finanzas / acceso_empresas porque
-- esos flags significan lo contrario: "un admin le quitó el acceso" (valen
-- true por defecto y false bloquea siempre, con o sin plan).
alter table public.profiles add column if not exists acceso_cortesia_hasta date;
-- Aceptación de Términos y Privacidad al crear la cuenta (lo escribe el servidor).
alter table public.profiles add column if not exists terminos_aceptados_el timestamptz;
alter table public.profiles add column if not exists terminos_version text;

-- 2. Planes -------------------------------------------------------------------
create table if not exists public.planes (
  id text primary key,
  nombre text not null,
  descripcion text,
  apps text[] not null default '{}',
  precio_mensual_gs bigint not null default 0,
  precio_anual_gs bigint not null default 0,
  activo boolean not null default false,
  orden integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- Productos de Polar (uno por período). No son secretos: aparecen en el checkout.
alter table public.planes add column if not exists polar_producto_mensual text;
alter table public.planes add column if not exists polar_producto_anual text;

alter table public.planes drop constraint if exists planes_id_formato;
alter table public.planes add constraint planes_id_formato check (id ~ '^[a-z0-9_-]{2,30}$');
alter table public.planes drop constraint if exists planes_apps_validas;
alter table public.planes add constraint planes_apps_validas
  check (cardinality(apps) > 0 and apps <@ array['finanzas', 'empresas']::text[]);
alter table public.planes drop constraint if exists planes_precios_positivos;
alter table public.planes add constraint planes_precios_positivos
  check (precio_mensual_gs >= 0 and precio_anual_gs >= 0);
-- Un plan activo tiene que tener al menos un precio cargado.
alter table public.planes drop constraint if exists planes_activo_con_precio;
alter table public.planes add constraint planes_activo_con_precio
  check (not activo or precio_mensual_gs > 0 or precio_anual_gs > 0);
alter table public.planes drop constraint if exists planes_productos_distintos;
alter table public.planes add constraint planes_productos_distintos
  check (polar_producto_mensual is null or polar_producto_anual is null or polar_producto_mensual <> polar_producto_anual);
create unique index if not exists planes_polar_mensual_unico on public.planes (polar_producto_mensual) where polar_producto_mensual is not null;
create unique index if not exists planes_polar_anual_unico on public.planes (polar_producto_anual) where polar_producto_anual is not null;

-- Planes iniciales: INACTIVOS y con precio 0. El dueño carga precios y
-- productos de Polar y los activa desde NODOS Panel → Suscripciones.
insert into public.planes (id, nombre, descripcion, apps, orden) values
  ('finanzas', 'NODOS Finanzas', 'Inversiones digitales y tradicionales, trading y gastos.', array['finanzas'], 1),
  ('empresas', 'NODOS Empresas', 'Vencimientos, accionistas, SIARA, poderes, documentos y SEPRELAD.', array['empresas'], 2),
  ('combo', 'NODOS Combo', 'Finanzas y Empresas con una sola suscripción.', array['finanzas', 'empresas'], 3)
on conflict (id) do nothing;

alter table public.planes enable row level security;
drop policy if exists "planes: ver activos" on public.planes;
-- Cuentas logueadas ven los planes activos; los admins, todos.
create policy "planes: ver activos" on public.planes
  for select to authenticated using (activo or public.is_admin());

-- 3. Suscripciones (una fila por cuenta) --------------------------------------
-- estado:
--   prueba     → prueba gratis hasta prueba_hasta
--   activa     → pagada hasta activa_hasta (+5 días de gracia)
--   impaga     → el proveedor no pudo cobrar la renovación (+5 días de gracia)
--   cancelada  → la cuenta pidió cancelar: acceso hasta activa_hasta
--   vencida    → sin acceso (prueba o plan vencido, revocada, anulada)
create table if not exists public.suscripciones (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  plan_id text not null references public.planes(id),
  periodo text,
  estado text not null default 'prueba',
  prueba_hasta date,
  activa_hasta date,
  cancelada_el timestamptz,
  proveedor text not null default 'prueba',
  notas_admin text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.suscripciones add column if not exists proveedor text not null default 'prueba';
alter table public.suscripciones add column if not exists proveedor_cliente_id text;
alter table public.suscripciones add column if not exists proveedor_suscripcion_id text;
-- Momento del último evento del proveedor aplicado (descarta eventos viejos que lleguen tarde).
alter table public.suscripciones add column if not exists proveedor_actualizado_el timestamptz;

alter table public.suscripciones drop constraint if exists suscripciones_periodo_check;
alter table public.suscripciones add constraint suscripciones_periodo_check
  check (periodo is null or periodo in ('mensual', 'anual'));
alter table public.suscripciones drop constraint if exists suscripciones_estado_check;
alter table public.suscripciones add constraint suscripciones_estado_check
  check (estado in ('prueba', 'activa', 'impaga', 'cancelada', 'vencida'));
alter table public.suscripciones drop constraint if exists suscripciones_origen_check;
alter table public.suscripciones drop constraint if exists suscripciones_proveedor_check;
alter table public.suscripciones add constraint suscripciones_proveedor_check
  check (proveedor in ('prueba', 'manual', 'polar', 'pagopar'));

create index if not exists suscripciones_activa_hasta_idx on public.suscripciones (activa_hasta);
create index if not exists suscripciones_prueba_hasta_idx on public.suscripciones (prueba_hasta);
create unique index if not exists suscripciones_proveedor_sub_unico
  on public.suscripciones (proveedor, proveedor_suscripcion_id) where proveedor_suscripcion_id is not null;

alter table public.suscripciones enable row level security;
drop policy if exists "suscripciones: ver propia" on public.suscripciones;
create policy "suscripciones: ver propia" on public.suscripciones
  for select to authenticated using (auth.uid() = user_id or public.is_admin());

-- 4. Pagos --------------------------------------------------------------------
-- monto en la unidad mínima de la moneda: guaraníes para PYG, centavos para USD.
create table if not exists public.pagos (
  id uuid primary key default gen_random_uuid(),
  -- Correlativo (sirve como número de pedido para procesadores que lo piden).
  numero bigint generated always as identity unique,
  -- Si la cuenta se elimina, el pago queda (registro contable) sin dueño.
  user_id uuid references auth.users(id) on delete set null,
  plan_id text references public.planes(id),
  periodo text,
  monto bigint not null default 0,
  moneda text not null default 'PYG',
  estado text not null default 'pendiente',
  proveedor text not null,
  referencia_proveedor text,
  forma_pago text,
  fecha_pago date,
  periodo_desde date,
  periodo_hasta date,
  reembolsado bigint not null default 0,
  registrado_por uuid references auth.users(id) on delete set null,
  nota text,
  created_at timestamptz not null default now(),
  confirmado_el timestamptz
);
alter table public.pagos add column if not exists monto bigint not null default 0;
alter table public.pagos add column if not exists moneda text not null default 'PYG';
alter table public.pagos add column if not exists fecha_pago date;
alter table public.pagos add column if not exists reembolsado bigint not null default 0;
alter table public.pagos alter column plan_id drop not null;
alter table public.pagos alter column periodo drop not null;

alter table public.pagos drop constraint if exists pagos_periodo_check;
alter table public.pagos add constraint pagos_periodo_check check (periodo is null or periodo in ('mensual', 'anual'));
alter table public.pagos drop constraint if exists pagos_estado_check;
alter table public.pagos add constraint pagos_estado_check
  check (estado in ('pendiente', 'pagado', 'reembolsado', 'reembolso_parcial', 'anulado'));
alter table public.pagos drop constraint if exists pagos_proveedor_check;
alter table public.pagos add constraint pagos_proveedor_check check (proveedor in ('polar', 'manual', 'pagopar'));
alter table public.pagos drop constraint if exists pagos_monto_positivo;
alter table public.pagos add constraint pagos_monto_positivo check (monto >= 0 and reembolsado >= 0);
alter table public.pagos drop constraint if exists pagos_moneda_formato;
alter table public.pagos add constraint pagos_moneda_formato check (moneda ~ '^[A-Z]{3}$');
alter table public.pagos drop constraint if exists pagos_referencia_unica;
alter table public.pagos add constraint pagos_referencia_unica unique (proveedor, referencia_proveedor);

create index if not exists pagos_user_idx on public.pagos (user_id, created_at desc);
create index if not exists pagos_confirmado_idx on public.pagos (confirmado_el) where estado = 'pagado';

alter table public.pagos enable row level security;
drop policy if exists "pagos: ver propios" on public.pagos;
create policy "pagos: ver propios" on public.pagos
  for select to authenticated using (auth.uid() = user_id or public.is_admin());

-- 5. Registro de eventos de pago (solo agregar) -------------------------------
create table if not exists public.eventos_pago (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  tipo text not null,
  referencia text,
  user_id uuid,
  registrado_por uuid,
  ip_hash text,
  -- Datos saneados del evento: ids, estados, montos y fechas. Nunca datos de
  -- tarjeta (NODOS no los recibe) ni emails o direcciones.
  payload jsonb,
  resultado text
);
alter table public.eventos_pago add column if not exists proveedor text not null default 'manual';
-- Id del evento del proveedor (en Polar, el encabezado webhook-id).
alter table public.eventos_pago add column if not exists evento_id text;
create unique index if not exists eventos_pago_evento_unico
  on public.eventos_pago (proveedor, evento_id) where evento_id is not null;
create index if not exists eventos_pago_ref_idx on public.eventos_pago (referencia);
create index if not exists eventos_pago_user_idx on public.eventos_pago (user_id, created_at desc);
drop index if exists public.eventos_pago_ip_idx;

alter table public.eventos_pago enable row level security;
drop policy if exists "eventos_pago: admins" on public.eventos_pago;
create policy "eventos_pago: admins" on public.eventos_pago
  for select to authenticated using (public.is_admin());

create or replace function public.eventos_pago_solo_agregar()
returns trigger
language plpgsql
as $$
begin
  raise exception 'eventos_pago es un registro de auditoría: no se puede modificar ni borrar.';
end;
$$;
drop trigger if exists eventos_pago_inmutable on public.eventos_pago;
create trigger eventos_pago_inmutable
  before update or delete on public.eventos_pago
  for each row execute function public.eventos_pago_solo_agregar();
drop trigger if exists eventos_pago_sin_truncate on public.eventos_pago;
create trigger eventos_pago_sin_truncate
  before truncate on public.eventos_pago
  for each statement execute function public.eventos_pago_solo_agregar();

-- Tabla del borrador anterior que no se usa (los avisos por email llegan
-- cuando haya SMTP configurado). Solo se borra si está vacía.
do $$
declare
  v_hay boolean;
begin
  if to_regclass('public.notificaciones_enviadas') is not null then
    execute 'select exists (select 1 from public.notificaciones_enviadas)' into v_hay;
    if not v_hay then
      execute 'drop table public.notificaciones_enviadas';
    end if;
  end if;
end $$;

-- Defensa extra: el navegador no puede escribir en estas tablas aunque
-- alguien agregara por error una política permisiva.
revoke insert, update, delete, truncate on public.planes, public.suscripciones, public.pagos,
  public.eventos_pago from anon, authenticated;
revoke all on public.planes, public.suscripciones, public.pagos, public.eventos_pago from anon;
grant select on public.planes, public.suscripciones, public.pagos, public.eventos_pago to authenticated;

-- 6. updated_at automático ----------------------------------------------------
create or replace function public.suscripciones_touch()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
drop trigger if exists suscripciones_touch on public.suscripciones;
create trigger suscripciones_touch before update on public.suscripciones
  for each row execute function public.suscripciones_touch();
drop trigger if exists planes_touch on public.planes;
create trigger planes_touch before update on public.planes
  for each row execute function public.suscripciones_touch();

-- 7. Hasta qué día da acceso una suscripción (incluye 5 días de gracia) -------
-- La gracia solo corre para planes pagos (activa o impaga): la prueba vence
-- en su día y una cancelación pedida por la cuenta termina al fin del período.
create or replace function public.suscripcion_acceso_hasta(p_estado text, p_prueba_hasta date, p_activa_hasta date)
returns date
language sql
immutable
as $$
  select case
    when p_estado = 'prueba' then p_prueba_hasta
    when p_estado in ('activa', 'impaga') then p_activa_hasta + 5
    when p_estado = 'cancelada' then p_activa_hasta
    else null
  end;
$$;

-- 8. ¿La cuenta que llama puede usar esta app? --------------------------------
-- Orden de reglas:
--   1) sin sesión, app desconocida o sin perfil → no
--   2) cuenta suspendida o acceso a la app quitado por un admin → no
--   3) administrador → sí
--   4) cortesía vigente (acceso_cortesia_hasta >= hoy) → sí
--   5) suscripción cuyo plan incluye la app y sigue vigente → sí
-- Las apps solo aplican esta regla con SUSCRIPCIONES_ACTIVAS=true.
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
  if coalesce(p.suspendido, false)
     or (p_app = 'finanzas' and p.acceso_finanzas = false)
     or (p_app = 'empresas' and p.acceso_empresas = false) then
    return false;
  end if;
  if coalesce(p.is_admin, false) then
    return true;
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

-- 9. Prueba gratis de 14 días, una vez por cuenta -----------------------------
-- La crea el servidor la primera vez que la cuenta entra a una app con el
-- cobro activado (no al registrarse: así las cuentas creadas antes de activar
-- el cobro no encuentran la prueba vencida). Solo inserta si la cuenta no
-- tiene NINGUNA fila: como el navegador no puede borrar ni editar
-- suscripciones, la prueba no se puede repetir. Hoy cuenta como día 1.
create or replace function public.asegurar_prueba()
returns boolean
language plpgsql
security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_filas integer;
begin
  if v_uid is null then
    return false;
  end if;
  if not exists (select 1 from public.profiles where id = v_uid and not coalesce(suspendido, false)) then
    return false;
  end if;
  insert into public.suscripciones (user_id, plan_id, estado, prueba_hasta, proveedor)
  values (v_uid, 'combo', 'prueba', public.hoy_py() + 13, 'prueba')
  on conflict (user_id) do nothing;
  get diagnostics v_filas = row_count;
  if v_filas > 0 then
    insert into public.eventos_pago (proveedor, tipo, referencia, user_id, payload, resultado)
    values ('manual', 'prueba_iniciada', v_uid::text, v_uid,
            jsonb_build_object('hasta', public.hoy_py() + 13), 'ok');
  end if;
  return v_filas > 0;
end;
$$;

-- 10. Estado visible para la cuenta que llama (página "Mi plan") -------------
create or replace function public.estado_suscripcion()
returns jsonb
language plpgsql
security definer set search_path = public
stable
as $$
declare
  v_uid uuid := auth.uid();
  v_hoy date := public.hoy_py();
  p record;
  s record;
  v_hasta date;
  v_estado text;
begin
  if v_uid is null then
    return jsonb_build_object('logueado', false);
  end if;
  select pr.is_admin, pr.acceso_cortesia_hasta into p from public.profiles pr where pr.id = v_uid;
  select su.plan_id, su.periodo, su.estado, su.prueba_hasta, su.activa_hasta, su.proveedor, su.cancelada_el,
         pl.nombre as plan_nombre, pl.apps
    into s
  from public.suscripciones su join public.planes pl on pl.id = su.plan_id
  where su.user_id = v_uid;

  if found then
    v_hasta := public.suscripcion_acceso_hasta(s.estado, s.prueba_hasta, s.activa_hasta);
    v_estado := case
      when v_hasta is null or v_hasta < v_hoy then 'vencida'
      when s.estado in ('activa', 'impaga') and s.activa_hasta < v_hoy then 'gracia'
      else s.estado
    end;
  else
    v_estado := 'sin_suscripcion';
  end if;

  return jsonb_build_object(
    'logueado', true,
    'admin', coalesce(p.is_admin, false),
    'cortesia_hasta', case when p.acceso_cortesia_hasta >= v_hoy then p.acceso_cortesia_hasta end,
    'estado', v_estado,
    'plan_id', s.plan_id,
    'plan_nombre', s.plan_nombre,
    'apps', coalesce(to_jsonb(s.apps), '[]'::jsonb),
    'periodo', s.periodo,
    'proveedor', s.proveedor,
    'prueba_hasta', s.prueba_hasta,
    'activa_hasta', s.activa_hasta,
    'acceso_hasta', v_hasta,
    'dias_restantes', case when v_hasta >= v_hoy then v_hasta - v_hoy end,
    'cancelacion_pedida', s.cancelada_el is not null and s.estado = 'cancelada',
    'acceso', jsonb_build_object(
      'finanzas', public.tiene_acceso_app('finanzas'),
      'empresas', public.tiene_acceso_app('empresas')
    )
  );
end;
$$;

-- 11. Aplicar un evento de Polar (solo servidor, desde el webhook) -----------
-- Recibe datos ya verificados (firma) y saneados por el servidor. Atómica:
-- si algo falla no queda nada escrito y Polar reintenta. Idempotente: el id
-- del evento (webhook-id) se guarda una sola vez; un reenvío devuelve
-- 'duplicado' sin tocar nada. La cuenta se identifica SOLO por el
-- external_id que el servidor de NODOS puso al crear el checkout; el plan,
-- SOLO por el producto (tabla planes).
create or replace function public.polar_aplicar_evento(
  p_evento_id text,
  p_tipo text,
  p_ocurrido timestamptz,
  p_user uuid,
  p_cliente_id text,
  p_datos jsonb
)
returns text
language plpgsql
security definer set search_path = public
as $$
declare
  v_hoy date := public.hoy_py();
  v_user uuid;
  v_res text;
  v_plan text;
  v_periodo text;
  v_prod text := p_datos ->> 'producto_id';
  v_sid text;
  v_status text;
  v_estado text;
  v_hasta date;
  v_cancelada timestamptz;
  su record;
begin
  if p_evento_id is null or length(p_evento_id) < 4 or length(p_evento_id) > 200 then
    raise exception 'evento_id inválido';
  end if;
  -- Serializa entregas simultáneas del mismo evento.
  perform pg_advisory_xact_lock(hashtextextended('polar:' || p_evento_id, 0));
  if exists (select 1 from public.eventos_pago where proveedor = 'polar' and evento_id = p_evento_id) then
    return 'duplicado';
  end if;

  if p_user is not null and exists (select 1 from auth.users where id = p_user) then
    v_user := p_user;
  end if;

  if v_prod is not null then
    select id, 'mensual' into v_plan, v_periodo from public.planes where polar_producto_mensual = v_prod;
    if v_plan is null then
      select id, 'anual' into v_plan, v_periodo from public.planes where polar_producto_anual = v_prod;
    end if;
  end if;

  if v_user is null then
    v_res := 'sin_cuenta';

  elsif p_tipo like 'subscription.%' then
    v_sid := p_datos ->> 'suscripcion_id';
    v_status := p_datos ->> 'status';
    select * into su from public.suscripciones where user_id = v_user for update;

    if v_plan is null then
      v_res := 'producto_desconocido';
    elsif v_sid is null or v_status is null then
      v_res := 'datos_incompletos';
    elsif su.user_id is not null and su.proveedor = 'polar' and su.proveedor_suscripcion_id = v_sid
          and su.proveedor_actualizado_el is not null and p_ocurrido < su.proveedor_actualizado_el then
      v_res := 'ignorado_evento_viejo';
    elsif su.user_id is not null and su.proveedor = 'polar' and su.proveedor_suscripcion_id is distinct from v_sid
          and su.estado in ('activa', 'impaga', 'cancelada')
          and v_status not in ('active', 'trialing') then
      -- Evento de otra suscripción vieja: no pisa la vigente.
      v_res := 'ignorado_otra_suscripcion';
    elsif v_status = 'incomplete' then
      v_res := 'ignorado_incompleta';
    else
      v_cancelada := null;
      if v_status in ('active', 'trialing') then
        v_hasta := ((p_datos ->> 'period_end')::timestamptz at time zone 'America/Asuncion')::date;
        if coalesce((p_datos ->> 'cancel_at_period_end')::boolean, false) then
          v_estado := 'cancelada';
          v_cancelada := coalesce((p_datos ->> 'canceled_at')::timestamptz, p_ocurrido);
        else
          v_estado := 'activa';
        end if;
      elsif v_status = 'past_due' then
        -- El período nuevo ya empezó pero no se cobró: la gracia corre desde
        -- el inicio del período impago, no desde su fin.
        v_estado := 'impaga';
        v_hasta := ((p_datos ->> 'period_start')::timestamptz at time zone 'America/Asuncion')::date;
      else
        -- canceled (revocada), unpaid, incomplete_expired, paused: sin acceso.
        v_estado := 'vencida';
        v_hasta := coalesce(((p_datos ->> 'ended_at')::timestamptz at time zone 'America/Asuncion')::date, v_hoy);
        v_cancelada := coalesce((p_datos ->> 'canceled_at')::timestamptz, p_ocurrido);
      end if;

      insert into public.suscripciones as s (user_id, plan_id, periodo, estado, activa_hasta, cancelada_el, proveedor,
                                             proveedor_cliente_id, proveedor_suscripcion_id, proveedor_actualizado_el)
      values (v_user, v_plan, v_periodo, v_estado, v_hasta, v_cancelada, 'polar', p_cliente_id, v_sid, p_ocurrido)
      on conflict (user_id) do update
        set plan_id = excluded.plan_id, periodo = excluded.periodo, estado = excluded.estado,
            activa_hasta = excluded.activa_hasta, cancelada_el = excluded.cancelada_el, proveedor = 'polar',
            proveedor_cliente_id = coalesce(excluded.proveedor_cliente_id, s.proveedor_cliente_id),
            proveedor_suscripcion_id = excluded.proveedor_suscripcion_id,
            proveedor_actualizado_el = excluded.proveedor_actualizado_el;
      v_res := 'ok:' || v_estado;
    end if;

  elsif p_tipo in ('order.paid', 'order.refunded') and p_datos ->> 'orden_id' is null then
    v_res := 'datos_incompletos';

  elsif p_tipo = 'order.paid' then
    insert into public.pagos (user_id, plan_id, periodo, monto, moneda, estado, proveedor, referencia_proveedor,
                              forma_pago, fecha_pago, confirmado_el, nota)
    values (v_user, v_plan, v_periodo, greatest(coalesce((p_datos ->> 'total')::bigint, 0), 0),
            upper(coalesce(nullif(p_datos ->> 'moneda', ''), 'USD')), 'pagado', 'polar', p_datos ->> 'orden_id',
            'tarjeta', v_hoy, now(), left(p_datos ->> 'motivo', 60))
    on conflict (proveedor, referencia_proveedor) do update
      set estado = 'pagado', confirmado_el = coalesce(pagos.confirmado_el, now())
      where pagos.estado = 'pendiente';
    v_res := case when v_plan is null then 'ok:pago_sin_plan' else 'ok:pago' end;

  elsif p_tipo = 'order.refunded' then
    update public.pagos
       set estado = case when p_datos ->> 'status' = 'refunded' then 'reembolsado' else 'reembolso_parcial' end,
           reembolsado = greatest(coalesce((p_datos ->> 'reembolsado')::bigint, 0), 0)
     where proveedor = 'polar' and referencia_proveedor = p_datos ->> 'orden_id';
    v_res := case when found then 'ok:reembolso' else 'pago_no_encontrado' end;

  else
    v_res := 'ignorado';
  end if;

  insert into public.eventos_pago (proveedor, evento_id, tipo, referencia, user_id, payload, resultado)
  values ('polar', p_evento_id, left(p_tipo, 60),
          coalesce(p_datos ->> 'suscripcion_id', p_datos ->> 'orden_id'), v_user,
          coalesce(p_datos, '{}'::jsonb) || jsonb_build_object('ocurrido', p_ocurrido, 'plan', v_plan, 'periodo', v_periodo),
          v_res);
  return v_res;
end;
$$;

-- 12. Pago manual (transferencia, QR, efectivo) registrado por un admin -------
-- Extiende el acceso 1 mes o 1 año desde el último día ya cubierto (o desde
-- la fecha del pago si no hay nada vigente). La referencia (n.º de
-- transferencia) es única: el mismo comprobante no se carga dos veces.
create or replace function public.registrar_pago_manual(
  p_user uuid,
  p_plan text,
  p_periodo text,
  p_monto_gs bigint,
  p_forma text,
  p_referencia text,
  p_fecha date,
  p_actor uuid,
  p_nota text default null
)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  v_hoy date := public.hoy_py();
  su record;
  v_cubre date;
  v_desde date;
  v_hasta date;
  v_pago uuid;
  v_ref text := nullif(trim(p_referencia), '');
begin
  if not exists (select 1 from public.profiles where id = p_actor and is_admin) then
    raise exception 'Solo un administrador puede registrar pagos.';
  end if;
  if not exists (select 1 from auth.users where id = p_user) then
    return jsonb_build_object('resultado', 'sin_cuenta');
  end if;
  if not exists (select 1 from public.planes where id = p_plan) then
    return jsonb_build_object('resultado', 'plan_invalido');
  end if;
  if p_periodo is null or p_periodo not in ('mensual', 'anual') then
    return jsonb_build_object('resultado', 'periodo_invalido');
  end if;
  if p_monto_gs is null or p_monto_gs <= 0 or p_monto_gs > 1000000000 then
    return jsonb_build_object('resultado', 'monto_invalido');
  end if;
  if p_forma is null or p_forma not in ('transferencia', 'qr', 'efectivo', 'otro') then
    return jsonb_build_object('resultado', 'forma_invalida');
  end if;
  if v_ref is null or length(v_ref) < 3 or length(v_ref) > 120 then
    return jsonb_build_object('resultado', 'referencia_invalida');
  end if;
  if p_fecha is null or p_fecha > v_hoy or p_fecha < v_hoy - 90 then
    return jsonb_build_object('resultado', 'fecha_invalida');
  end if;
  if exists (select 1 from public.pagos where proveedor = 'manual' and referencia_proveedor = v_ref) then
    return jsonb_build_object('resultado', 'referencia_repetida');
  end if;

  select * into su from public.suscripciones where user_id = p_user for update;
  if su.user_id is not null and su.proveedor = 'polar' and su.estado in ('activa', 'impaga', 'cancelada')
     and coalesce(su.activa_hasta, v_hoy) >= v_hoy then
    return jsonb_build_object('resultado', 'tiene_polar_activa');
  end if;

  v_cubre := case
    when su.estado = 'prueba' then su.prueba_hasta
    when su.estado in ('activa', 'impaga', 'cancelada') then su.activa_hasta
  end;
  v_desde := greatest(p_fecha, coalesce(v_cubre + 1, p_fecha));
  v_hasta := (v_desde + case p_periodo when 'anual' then interval '1 year' else interval '1 month' end)::date - 1;

  insert into public.pagos (user_id, plan_id, periodo, monto, moneda, estado, proveedor, referencia_proveedor,
                            forma_pago, fecha_pago, periodo_desde, periodo_hasta, registrado_por, nota, confirmado_el)
  values (p_user, p_plan, p_periodo, p_monto_gs, 'PYG', 'pagado', 'manual', v_ref, p_forma, p_fecha,
          v_desde, v_hasta, p_actor, left(nullif(trim(p_nota), ''), 500), now())
  returning id into v_pago;

  insert into public.suscripciones as s (user_id, plan_id, periodo, estado, activa_hasta, proveedor)
  values (p_user, p_plan, p_periodo, 'activa', v_hasta, 'manual')
  on conflict (user_id) do update
    set plan_id = excluded.plan_id, periodo = excluded.periodo, estado = 'activa',
        activa_hasta = excluded.activa_hasta, cancelada_el = null, proveedor = 'manual',
        proveedor_suscripcion_id = null, proveedor_actualizado_el = null;

  insert into public.eventos_pago (proveedor, tipo, referencia, user_id, registrado_por, payload, resultado)
  values ('manual', 'pago_manual', v_pago::text, p_user, p_actor,
          jsonb_build_object('plan', p_plan, 'periodo', p_periodo, 'monto_gs', p_monto_gs, 'forma', p_forma,
                             'referencia', v_ref, 'fecha', p_fecha, 'desde', v_desde, 'hasta', v_hasta),
          'ok');
  return jsonb_build_object('resultado', 'ok', 'pago_id', v_pago, 'desde', v_desde, 'hasta', v_hasta);
end;
$$;

-- 13. Cortesía (acceso sin pagar hasta una fecha; null la quita) --------------
create or replace function public.admin_cortesia(p_user uuid, p_hasta date, p_actor uuid, p_nota text default null)
returns text
language plpgsql
security definer set search_path = public
as $$
begin
  if not exists (select 1 from public.profiles where id = p_actor and is_admin) then
    raise exception 'Solo un administrador puede dar cortesías.';
  end if;
  if p_hasta is not null and (p_hasta < public.hoy_py() or p_hasta > public.hoy_py() + 3660) then
    return 'fecha_invalida';
  end if;
  update public.profiles set acceso_cortesia_hasta = p_hasta where id = p_user;
  if not found then
    return 'sin_cuenta';
  end if;
  insert into public.eventos_pago (proveedor, tipo, referencia, user_id, registrado_por, payload, resultado)
  values ('manual', case when p_hasta is null then 'cortesia_quitada' else 'cortesia' end, p_user::text, p_user, p_actor,
          jsonb_build_object('hasta', p_hasta, 'nota', left(nullif(trim(p_nota), ''), 500)), 'ok');
  return 'ok';
end;
$$;

-- 14. Cancelar (prueba o plan manual). Las de Polar se cancelan en Polar y el
-- cambio llega por webhook: si se tocaran acá, el próximo evento las pisaría.
create or replace function public.admin_cancelar_suscripcion(p_user uuid, p_actor uuid, p_motivo text default null)
returns text
language plpgsql
security definer set search_path = public
as $$
declare
  su record;
begin
  if not exists (select 1 from public.profiles where id = p_actor and is_admin) then
    raise exception 'Solo un administrador puede cancelar suscripciones.';
  end if;
  select * into su from public.suscripciones where user_id = p_user for update;
  if not found then
    return 'sin_suscripcion';
  end if;
  if su.proveedor = 'polar' and su.estado in ('activa', 'impaga', 'cancelada') then
    return 'es_polar';
  end if;
  if su.estado = 'vencida' then
    return 'ya_vencida';
  end if;
  update public.suscripciones
     set estado = 'vencida', cancelada_el = now(),
         notas_admin = left(concat_ws(' · ', notas_admin, nullif(trim(p_motivo), '')), 1000)
   where user_id = p_user;
  insert into public.eventos_pago (proveedor, tipo, referencia, user_id, registrado_por, payload, resultado)
  values ('manual', 'cancelacion_admin', p_user::text, p_user, p_actor,
          jsonb_build_object('estado_anterior', su.estado, 'proveedor', su.proveedor,
                             'motivo', left(nullif(trim(p_motivo), ''), 500)), 'ok');
  return 'ok';
end;
$$;

-- 15. Editar un plan (nombre, descripción, precios, productos, activo) -------
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
    activo = case when p_datos ? 'activo' then (p_datos ->> 'activo')::boolean else activo end
  where id = p_plan;
  insert into public.eventos_pago (proveedor, tipo, referencia, registrado_por, payload, resultado)
  values ('manual', 'plan_editado', p_plan, p_actor, jsonb_build_object('antes', antes, 'cambios', p_datos), 'ok');
  return 'ok';
end;
$$;

-- 16. Permisos de las funciones -----------------------------------------------
-- Las que escriben (webhook, pagos manuales, cortesía, cancelar, planes) solo
-- las ejecuta el servidor. Las de lectura de la cuenta, cualquier logueado.
revoke all on function public.tiene_acceso_app(text) from public, anon;
revoke all on function public.asegurar_prueba() from public, anon;
revoke all on function public.estado_suscripcion() from public, anon;
grant execute on function public.tiene_acceso_app(text) to authenticated;
grant execute on function public.asegurar_prueba() to authenticated;
grant execute on function public.estado_suscripcion() to authenticated;

revoke all on function public.polar_aplicar_evento(text, text, timestamptz, uuid, text, jsonb) from public, anon, authenticated;
revoke all on function public.registrar_pago_manual(uuid, text, text, bigint, text, text, date, uuid, text) from public, anon, authenticated;
revoke all on function public.admin_cortesia(uuid, date, uuid, text) from public, anon, authenticated;
revoke all on function public.admin_cancelar_suscripcion(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.admin_editar_plan(text, jsonb, uuid) from public, anon, authenticated;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.polar_aplicar_evento(text, text, timestamptz, uuid, text, jsonb) to service_role;
    grant execute on function public.registrar_pago_manual(uuid, text, text, bigint, text, text, date, uuid, text) to service_role;
    grant execute on function public.admin_cortesia(uuid, date, uuid, text) to service_role;
    grant execute on function public.admin_cancelar_suscripcion(uuid, uuid, text) to service_role;
    grant execute on function public.admin_editar_plan(text, jsonb, uuid) to service_role;
    grant execute on function public.tiene_acceso_app(text) to service_role;
  end if;
end $$;

notify pgrst, 'reload schema';
