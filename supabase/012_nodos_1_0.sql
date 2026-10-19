-- ═════════════════════════════════════════════════════════════════════════
-- NODOS 1.0 · Vínculo Empresas + Finanzas, generador del RO y NODOS Práctica.
-- Idempotente: se puede correr más de una vez. Correr en el proyecto Supabase
-- compartido ("Finanzas"), después de 000–011 de Empresas y 021–025 de
-- Finanzas. Archivo idéntico en nodos-empresas (012_nodos_1_0.sql) y
-- finanzas-app (026_nodos_1_0.sql).
--
-- Qué agrega:
--   1. Empresas: tipos "unipersonal" y "RUC personal", régimen tributario y
--      sector SEPRELAD "transportadora de caudales".
--   2. Finanzas: espacios (la plata de cada entidad separada de la personal)
--      e ingresos detallados.
--   3. Vínculo: accionistas conectados a su cuenta NODOS (solo por invitación
--      aceptada), eventos que Empresas publica (dividendos, aportes, cesiones)
--      y que Finanzas recibe, y "Mis empresas".
--   4. Preferencias de Finanzas (módulo de trading visible u oculto).
--   5. RO SEPRELAD: auditoría de cada archivo generado (sin su contenido) y
--      reglas por empresa.
--   6. NODOS Práctica: partidas de cada usuario y contenido editable desde el
--      Panel.
--
-- Seguridad:
--   · Los datos personales de Finanzas siguen siendo solo de su dueño. Un
--     espacio de entidad también es de su dueño: la empresa no lo ve.
--   · Un accionista se conecta a una cuenta SOLO cuando esa persona acepta la
--     invitación (función aceptar_invitacion_accionista). Nadie puede escribir
--     usuario_vinculado a mano.
--   · Los eventos los publica el equipo de la empresa; quien los recibe solo
--     puede aplicarlos o descartarlos, a través de funciones.
--   · La auditoría del RO no se puede editar ni borrar desde el navegador.
-- ═════════════════════════════════════════════════════════════════════════

-- 1. Empresas: tipos, régimen y sector caudales -------------------------------
alter table public.empresas drop constraint if exists empresas_tipo_check;
alter table public.empresas add constraint empresas_tipo_check
  check (tipo in ('sa', 'eas', 'srl', 'unipersonal', 'ruc_personal'));

-- Régimen tributario declarado por el usuario (informativo: la app no
-- liquida impuestos).
alter table public.empresas add column if not exists regimen_tributario text;
alter table public.empresas drop constraint if exists empresas_regimen_valido;
alter table public.empresas add constraint empresas_regimen_valido
  check (regimen_tributario is null or regimen_tributario in
    ('ire_general', 'ire_simple', 'ire_resimple', 'irp_rsp', 'irp_rgc', 'otro'));

alter table public.perfil_seprelad drop constraint if exists perfil_seprelad_sectores_check;
alter table public.perfil_seprelad add constraint perfil_seprelad_sectores_check
  check (sectores <@ array['inmobiliaria', 'osfl', 'remesas', 'caudales']::text[]);
-- Las Notas NODOS también se pueden dirigir al sector nuevo.
do $$
begin
  if to_regclass('public.notas_nodos') is not null then
    alter table public.notas_nodos drop constraint if exists notas_nodos_sectores_seprelad_check;
    alter table public.notas_nodos add constraint notas_nodos_sectores_seprelad_check
      check (sectores_seprelad <@ array['inmobiliaria', 'osfl', 'remesas', 'caudales']::text[]);
  end if;
end $$;

-- 2. Espacios de Finanzas ------------------------------------------------------
-- El espacio personal no tiene fila: es "espacio_id nulo". Cada fila es el
-- espacio de una entidad (empresa, unipersonal o RUC personal) de su dueño.
create table if not exists public.espacios (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  empresa_id uuid references public.empresas(id) on delete set null,
  nombre text not null,
  archivado boolean not null default false,
  created_at timestamptz not null default now(),
  constraint espacios_nombre_valido check (length(btrim(nombre)) between 1 and 80)
);
create unique index if not exists espacios_usuario_empresa on public.espacios (user_id, empresa_id) where empresa_id is not null;
create index if not exists espacios_usuario_idx on public.espacios (user_id);

alter table public.espacios enable row level security;
drop policy if exists "espacios: dueño" on public.espacios;
-- La empresa vinculada tiene que ser una que el usuario puede ver (la
-- subconsulta corre con los permisos de quien escribe).
create policy "espacios: dueño" on public.espacios
  for all using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and (empresa_id is null or exists (select 1 from public.empresas e where e.id = empresa_id))
  );
revoke all on public.espacios from anon;
grant select, insert, update, delete on public.espacios to authenticated;

-- Un movimiento solo puede ir a un espacio del mismo dueño.
create or replace function public.espacio_del_dueno()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.espacio_id is not null and not exists (
    select 1 from public.espacios s where s.id = new.espacio_id and s.user_id = new.user_id
  ) then
    raise exception 'El espacio no existe o no es tuyo.' using errcode = '42501';
  end if;
  return new;
end;
$$;

alter table public.expenses add column if not exists espacio_id uuid references public.espacios(id);
create index if not exists expenses_espacio_idx on public.expenses (user_id, espacio_id);
drop trigger if exists expenses_10_espacio on public.expenses;
create trigger expenses_10_espacio before insert or update of espacio_id, user_id on public.expenses
  for each row execute function public.espacio_del_dueno();

-- 3. Vínculo: accionistas conectados a su cuenta -------------------------------
alter table public.accionistas add column if not exists usuario_vinculado uuid references auth.users(id) on delete set null;
-- Residencia fiscal del accionista, para estimar la retención del IDU al
-- distribuir utilidades (8 % residentes, 15 % no residentes).
alter table public.accionistas add column if not exists residente boolean not null default true;
create unique index if not exists accionistas_usuario_unico
  on public.accionistas (empresa_id, usuario_vinculado) where usuario_vinculado is not null;

-- usuario_vinculado solo cambia a través de las funciones de invitación.
create or replace function public.accionistas_vinculo_protegido()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if coalesce(current_setting('nodos.vinculando', true), '') = '1' then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.usuario_vinculado := null;
  elsif new.usuario_vinculado is distinct from old.usuario_vinculado then
    raise exception 'La cuenta NODOS de un accionista se conecta solo con una invitación aceptada.' using errcode = '42501';
  end if;
  return new;
end;
$$;
drop trigger if exists accionistas_05_vinculo on public.accionistas;
create trigger accionistas_05_vinculo before insert or update on public.accionistas
  for each row execute function public.accionistas_vinculo_protegido();

create table if not exists public.invitaciones_accionista (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  accionista_id uuid not null references public.accionistas(id) on delete cascade,
  token_hash text not null unique,
  creada_por uuid references auth.users(id) on delete set null,
  expira_el timestamptz not null default now() + interval '14 days',
  aceptada_por uuid references auth.users(id) on delete set null,
  aceptada_el timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists invitaciones_accionista_idx on public.invitaciones_accionista (accionista_id);
alter table public.invitaciones_accionista enable row level security;
drop policy if exists "invitaciones_accionista: equipo lee" on public.invitaciones_accionista;
create policy "invitaciones_accionista: equipo lee" on public.invitaciones_accionista
  for select using (
    exists (select 1 from public.empresas e where e.id = empresa_id and public.puede_acceder(e.user_id))
  );
revoke all on public.invitaciones_accionista from anon;
revoke insert, update, delete, truncate on public.invitaciones_accionista from authenticated;
grant select on public.invitaciones_accionista to authenticated;

-- 4. Eventos que Empresas publica para Finanzas --------------------------------
create table if not exists public.eventos_entidad (
  id uuid primary key default gen_random_uuid(),
  -- Dueño de la empresa (lo fija dueno_desde_empresa).
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  accionista_id uuid references public.accionistas(id) on delete set null,
  -- Cuenta que lo recibe: siempre la vinculada al accionista (la fija la base).
  destinatario uuid references auth.users(id) on delete set null,
  tipo text not null,
  fecha date not null,
  cantidad numeric,
  monto_bruto numeric,
  retencion numeric,
  monto_neto numeric,
  moneda text not null default 'PYG',
  detalle text,
  estado text not null default 'pendiente',
  creado_por uuid default auth.uid() references auth.users(id) on delete set null,
  aplicado_el timestamptz,
  created_at timestamptz not null default now(),
  constraint eventos_entidad_tipo check (tipo in ('dividendo', 'aporte', 'cesion_entrada', 'cesion_salida')),
  constraint eventos_entidad_estado check (estado in ('pendiente', 'aplicado', 'descartado', 'informativo')),
  constraint eventos_entidad_moneda check (moneda in ('PYG')),
  constraint eventos_entidad_montos check (
    coalesce(monto_bruto, 0) >= 0 and coalesce(retencion, 0) >= 0 and coalesce(monto_neto, 0) >= 0 and coalesce(cantidad, 0) >= 0
  ),
  constraint eventos_entidad_detalle check (detalle is null or length(detalle) <= 300)
);
create index if not exists eventos_entidad_empresa_idx on public.eventos_entidad (empresa_id, fecha desc);
create index if not exists eventos_entidad_destinatario_idx on public.eventos_entidad (destinatario, estado);

create or replace function public.eventos_entidad_preparar()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_vinculado uuid;
begin
  if new.accionista_id is not null then
    select a.usuario_vinculado into v_vinculado
    from public.accionistas a
    where a.id = new.accionista_id and a.empresa_id = new.empresa_id;
    if not found then
      raise exception 'El accionista no pertenece a esa empresa.' using errcode = '42501';
    end if;
  end if;
  new.destinatario := v_vinculado;
  new.creado_por := auth.uid();
  if tg_op = 'INSERT' then
    new.aplicado_el := null;
    if new.tipo = 'dividendo' then
      new.estado := 'pendiente';
    else
      new.estado := 'informativo';
    end if;
  end if;
  return new;
end;
$$;

alter table public.eventos_entidad enable row level security;
drop trigger if exists eventos_entidad_00_dueno on public.eventos_entidad;
create trigger eventos_entidad_00_dueno before insert or update of empresa_id, user_id on public.eventos_entidad
  for each row execute function public.dueno_desde_empresa();
drop trigger if exists eventos_entidad_10_preparar on public.eventos_entidad;
create trigger eventos_entidad_10_preparar before insert on public.eventos_entidad
  for each row execute function public.eventos_entidad_preparar();

drop policy if exists "eventos_entidad: ver" on public.eventos_entidad;
create policy "eventos_entidad: ver" on public.eventos_entidad
  for select using (public.puede_acceder(user_id) or destinatario = auth.uid());
drop policy if exists "eventos_entidad: equipo publica" on public.eventos_entidad;
create policy "eventos_entidad: equipo publica" on public.eventos_entidad
  for insert with check (public.puede_acceder(user_id));
-- Solo se borra lo que todavía no se aplicó en Finanzas.
drop policy if exists "eventos_entidad: equipo borra pendientes" on public.eventos_entidad;
create policy "eventos_entidad: equipo borra pendientes" on public.eventos_entidad
  for delete using (public.puede_acceder(user_id) and estado in ('pendiente', 'informativo'));
revoke all on public.eventos_entidad from anon;
revoke update, truncate on public.eventos_entidad from authenticated;
grant select, insert, delete on public.eventos_entidad to authenticated;

-- Aportes y cesiones quedan en el historial de "Mis empresas" de cada socio.
create or replace function public.movimientos_acciones_publicar_evento()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_det text := left(coalesce(new.notas, ''), 300);
begin
  if new.tipo = 'suscripcion' and new.a_accionista_id is not null then
    insert into public.eventos_entidad (empresa_id, accionista_id, tipo, fecha, cantidad, monto_bruto, detalle)
    values (new.empresa_id, new.a_accionista_id, 'aporte', new.fecha, new.cantidad, new.precio_total, nullif(v_det, ''));
  elsif new.tipo in ('transferencia', 'herencia', 'donacion') then
    if new.a_accionista_id is not null then
      insert into public.eventos_entidad (empresa_id, accionista_id, tipo, fecha, cantidad, monto_bruto, detalle)
      values (new.empresa_id, new.a_accionista_id, 'cesion_entrada', new.fecha, new.cantidad, new.precio_total, nullif(v_det, ''));
    end if;
    if new.de_accionista_id is not null then
      insert into public.eventos_entidad (empresa_id, accionista_id, tipo, fecha, cantidad, monto_bruto, detalle)
      values (new.empresa_id, new.de_accionista_id, 'cesion_salida', new.fecha, new.cantidad, new.precio_total, nullif(v_det, ''));
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists movimientos_acciones_20_evento on public.movimientos_acciones;
create trigger movimientos_acciones_20_evento after insert on public.movimientos_acciones
  for each row execute function public.movimientos_acciones_publicar_evento();

-- 5. Ingresos detallados de Finanzas -------------------------------------------
create table if not exists public.ingresos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  espacio_id uuid references public.espacios(id),
  fecha date not null,
  categoria text not null default 'Otros',
  descripcion text,
  monto_pyg numeric not null,
  evento_id uuid unique references public.eventos_entidad(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint ingresos_monto_positivo check (monto_pyg > 0),
  constraint ingresos_textos check (length(categoria) between 1 and 60 and (descripcion is null or length(descripcion) <= 200))
);
create index if not exists ingresos_usuario_idx on public.ingresos (user_id, espacio_id, fecha desc);
alter table public.ingresos enable row level security;
drop policy if exists "ingresos: dueño" on public.ingresos;
create policy "ingresos: dueño" on public.ingresos
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop trigger if exists ingresos_10_espacio on public.ingresos;
create trigger ingresos_10_espacio before insert or update of espacio_id, user_id on public.ingresos
  for each row execute function public.espacio_del_dueno();
revoke all on public.ingresos from anon;
grant select, insert, update, delete on public.ingresos to authenticated;

-- 6. Funciones del vínculo -------------------------------------------------------
-- Crea (o renueva) la invitación de un accionista. Devuelve el token una sola
-- vez: en la base queda solo su hash.
create or replace function public.crear_invitacion_accionista(p_accionista uuid)
returns text
language plpgsql
security definer set search_path = public
as $$
declare
  v_empresa uuid;
  v_dueno uuid;
  v_token text;
begin
  if auth.uid() is null then
    raise exception 'Ingresá a tu cuenta.' using errcode = '42501';
  end if;
  select a.empresa_id, e.user_id into v_empresa, v_dueno
  from public.accionistas a join public.empresas e on e.id = a.empresa_id
  where a.id = p_accionista;
  if v_empresa is null or not public.puede_acceder(v_dueno) then
    raise exception 'No tenés acceso a ese accionista.' using errcode = '42501';
  end if;
  if exists (select 1 from public.accionistas where id = p_accionista and usuario_vinculado is not null) then
    raise exception 'Ese accionista ya está conectado a una cuenta NODOS.';
  end if;
  delete from public.invitaciones_accionista where accionista_id = p_accionista and aceptada_el is null;
  v_token := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
  insert into public.invitaciones_accionista (empresa_id, accionista_id, token_hash, creada_por)
  values (v_empresa, p_accionista, encode(sha256(convert_to(v_token, 'UTF8')), 'hex'), auth.uid());
  return v_token;
end;
$$;

-- Lo que ve quien abre el link antes de aceptar (sin datos de otros socios).
create or replace function public.ver_invitacion_accionista(p_token text)
returns table (empresa text, accionista text, vence timestamptz)
language sql
stable
security definer set search_path = public
as $$
  select e.denominacion, a.nombre, i.expira_el
  from public.invitaciones_accionista i
  join public.accionistas a on a.id = i.accionista_id
  join public.empresas e on e.id = i.empresa_id
  where auth.uid() is not null
    and i.token_hash = encode(sha256(convert_to(coalesce(p_token, ''), 'UTF8')), 'hex')
    and i.aceptada_el is null
    and i.expira_el > now()
    and a.usuario_vinculado is null;
$$;

create or replace function public.aceptar_invitacion_accionista(p_token text)
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_inv public.invitaciones_accionista%rowtype;
begin
  if v_uid is null then
    raise exception 'Ingresá a tu cuenta para aceptar la invitación.' using errcode = '42501';
  end if;
  select * into v_inv from public.invitaciones_accionista
  where token_hash = encode(sha256(convert_to(coalesce(p_token, ''), 'UTF8')), 'hex')
  for update;
  if not found or v_inv.aceptada_el is not null or v_inv.expira_el <= now() then
    raise exception 'La invitación no es válida o ya venció. Pedí una nueva.';
  end if;
  if exists (select 1 from public.accionistas where id = v_inv.accionista_id and usuario_vinculado is not null) then
    raise exception 'Ese accionista ya está conectado a una cuenta NODOS.';
  end if;
  if exists (select 1 from public.accionistas where empresa_id = v_inv.empresa_id and usuario_vinculado = v_uid) then
    raise exception 'Tu cuenta ya está conectada a otro accionista de esta empresa.';
  end if;
  perform set_config('nodos.vinculando', '1', true);
  update public.accionistas set usuario_vinculado = v_uid where id = v_inv.accionista_id;
  perform set_config('nodos.vinculando', '', true);
  update public.invitaciones_accionista set aceptada_por = v_uid, aceptada_el = now() where id = v_inv.id;
  -- Lo publicado antes de aceptar le llega ahora.
  update public.eventos_entidad set destinatario = v_uid
  where accionista_id = v_inv.accionista_id and destinatario is null and estado in ('pendiente', 'informativo');
  return v_inv.empresa_id;
end;
$$;

-- Desconecta un accionista: lo puede hacer el equipo de la empresa o la
-- persona conectada. Lo pendiente deja de llegarle; lo aplicado se queda.
create or replace function public.desvincular_accionista(p_accionista uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_dueno uuid;
  v_vinculado uuid;
begin
  select e.user_id, a.usuario_vinculado into v_dueno, v_vinculado
  from public.accionistas a join public.empresas e on e.id = a.empresa_id
  where a.id = p_accionista;
  if v_dueno is null or auth.uid() is null
     or not (public.puede_acceder(v_dueno) or v_vinculado = auth.uid()) then
    raise exception 'No tenés acceso a ese accionista.' using errcode = '42501';
  end if;
  perform set_config('nodos.vinculando', '1', true);
  update public.accionistas set usuario_vinculado = null where id = p_accionista;
  perform set_config('nodos.vinculando', '', true);
  update public.eventos_entidad set destinatario = null
  where accionista_id = p_accionista and estado in ('pendiente', 'informativo');
  delete from public.invitaciones_accionista where accionista_id = p_accionista and aceptada_el is null;
end;
$$;

-- "Mis empresas": solo la parte propia de cada socio conectado.
create or replace function public.mis_participaciones()
returns table (
  accionista_id uuid,
  empresa_id uuid,
  denominacion text,
  tipo text,
  acciones numeric,
  total_acciones numeric,
  porcentaje numeric,
  valor_nominal_accion numeric,
  cargo text
)
language sql
stable
security definer set search_path = public
as $$
  select a.id, e.id, e.denominacion, e.tipo, a.acciones,
         t.total,
         case when t.total > 0 then round(a.acciones * 100 / t.total, 4) else 0 end,
         e.valor_nominal_accion, a.cargo
  from public.accionistas a
  join public.empresas e on e.id = a.empresa_id
  cross join lateral (
    select coalesce(sum(x.acciones), 0) as total from public.accionistas x where x.empresa_id = a.empresa_id and x.activo
  ) t
  where auth.uid() is not null and a.usuario_vinculado = auth.uid() and a.activo
  order by e.denominacion;
$$;

-- Registra un dividendo recibido como ingreso del espacio personal.
create or replace function public.aplicar_evento(p_evento uuid)
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  v_ev public.eventos_entidad%rowtype;
  v_empresa text;
  v_id uuid;
begin
  select * into v_ev from public.eventos_entidad where id = p_evento for update;
  if not found or auth.uid() is null or v_ev.destinatario is distinct from auth.uid() then
    raise exception 'Ese movimiento no es tuyo.' using errcode = '42501';
  end if;
  if v_ev.tipo <> 'dividendo' or v_ev.estado <> 'pendiente' then
    raise exception 'Ese movimiento ya se registró o no se puede registrar.';
  end if;
  if coalesce(v_ev.monto_neto, 0) <= 0 then
    raise exception 'El dividendo no tiene monto.';
  end if;
  select denominacion into v_empresa from public.empresas where id = v_ev.empresa_id;
  insert into public.ingresos (user_id, espacio_id, fecha, categoria, descripcion, monto_pyg, evento_id)
  values (auth.uid(), null, v_ev.fecha, 'Dividendos', left('Dividendo de ' || coalesce(v_empresa, 'empresa'), 200), v_ev.monto_neto, v_ev.id)
  returning id into v_id;
  update public.eventos_entidad set estado = 'aplicado', aplicado_el = now() where id = v_ev.id;
  return v_id;
end;
$$;

create or replace function public.descartar_evento(p_evento uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  update public.eventos_entidad set estado = 'descartado'
  where id = p_evento and destinatario = auth.uid() and auth.uid() is not null and estado = 'pendiente';
  if not found then
    raise exception 'Ese movimiento no es tuyo o ya no está pendiente.' using errcode = '42501';
  end if;
end;
$$;

revoke all on function public.crear_invitacion_accionista(uuid) from public, anon;
revoke all on function public.ver_invitacion_accionista(text) from public, anon;
revoke all on function public.aceptar_invitacion_accionista(text) from public, anon;
revoke all on function public.desvincular_accionista(uuid) from public, anon;
revoke all on function public.mis_participaciones() from public, anon;
revoke all on function public.aplicar_evento(uuid) from public, anon;
revoke all on function public.descartar_evento(uuid) from public, anon;
grant execute on function public.crear_invitacion_accionista(uuid) to authenticated;
grant execute on function public.ver_invitacion_accionista(text) to authenticated;
grant execute on function public.aceptar_invitacion_accionista(text) to authenticated;
grant execute on function public.desvincular_accionista(uuid) to authenticated;
grant execute on function public.mis_participaciones() to authenticated;
grant execute on function public.aplicar_evento(uuid) to authenticated;
grant execute on function public.descartar_evento(uuid) to authenticated;

-- 7. Preferencias de Finanzas ----------------------------------------------------
create table if not exists public.preferencias (
  user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  -- Módulo de trading: nulo = automático (visible si ya hay operaciones).
  trading_visible boolean,
  updated_at timestamptz not null default now()
);
alter table public.preferencias enable row level security;
drop policy if exists "preferencias: dueño" on public.preferencias;
create policy "preferencias: dueño" on public.preferencias
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
revoke all on public.preferencias from anon;
grant select, insert, update, delete on public.preferencias to authenticated;

-- 8. RO SEPRELAD ------------------------------------------------------------------
-- Cada archivo generado deja constancia de quién, cuándo, qué período y la
-- huella SHA-256 del archivo. Nunca el contenido: la planilla se procesa en
-- el navegador y no se guarda.
create table if not exists public.ro_generaciones (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  generado_por uuid default auth.uid() references auth.users(id) on delete set null,
  regimen text not null,
  periodo text not null,
  presentacion text not null,
  cantidad integer not null,
  hash_sha256 text not null,
  created_at timestamptz not null default now(),
  constraint ro_generaciones_regimen check (regimen in ('inmobiliarias', 'caudales')),
  constraint ro_generaciones_periodo check (periodo ~ '^[0-9]{4}-T[1-4]$'),
  constraint ro_generaciones_presentacion check (presentacion in ('registro', 'rectificacion', 'complementario')),
  constraint ro_generaciones_cantidad check (cantidad between 0 and 1000000),
  constraint ro_generaciones_hash check (hash_sha256 ~ '^[0-9a-f]{64}$')
);
create index if not exists ro_generaciones_empresa_idx on public.ro_generaciones (empresa_id, created_at desc);

create or replace function public.ro_generaciones_autor()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.generado_por := auth.uid();
  new.created_at := now();
  return new;
end;
$$;

alter table public.ro_generaciones enable row level security;
drop trigger if exists ro_generaciones_00_dueno on public.ro_generaciones;
create trigger ro_generaciones_00_dueno before insert or update of empresa_id, user_id on public.ro_generaciones
  for each row execute function public.dueno_desde_empresa();
drop trigger if exists ro_generaciones_10_autor on public.ro_generaciones;
create trigger ro_generaciones_10_autor before insert on public.ro_generaciones
  for each row execute function public.ro_generaciones_autor();
drop policy if exists "ro_generaciones: equipo lee" on public.ro_generaciones;
create policy "ro_generaciones: equipo lee" on public.ro_generaciones
  for select using (public.puede_acceder(user_id));
drop policy if exists "ro_generaciones: equipo registra" on public.ro_generaciones;
create policy "ro_generaciones: equipo registra" on public.ro_generaciones
  for insert with check (public.puede_acceder(user_id));
revoke all on public.ro_generaciones from anon;
revoke update, delete, truncate on public.ro_generaciones from authenticated;
grant select, insert on public.ro_generaciones to authenticated;

-- Reglas de cada sujeto obligado para el RO (las configura el usuario).
create table if not exists public.ro_reglas_empresa (
  empresa_id uuid primary key references public.empresas(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  -- Ciudad para todas las ciudades del archivo (por pedido del cliente).
  ciudad_fija integer,
  -- Ciudad que se usa cuando viene vacía o no existe en la tabla oficial.
  ciudad_por_defecto integer not null default 1,
  -- Teléfono que se usa cuando viene vacío o en cero.
  telefono_por_defecto text not null default '99999999',
  notas text,
  updated_at timestamptz not null default now(),
  constraint ro_reglas_telefono check (telefono_por_defecto ~ '^[0-9]{8,12}$'),
  constraint ro_reglas_ciudades check (ciudad_por_defecto > 0 and (ciudad_fija is null or ciudad_fija > 0)),
  constraint ro_reglas_notas check (notas is null or length(notas) <= 500)
);
alter table public.ro_reglas_empresa enable row level security;
drop trigger if exists ro_reglas_empresa_00_dueno on public.ro_reglas_empresa;
create trigger ro_reglas_empresa_00_dueno before insert or update of empresa_id, user_id on public.ro_reglas_empresa
  for each row execute function public.dueno_desde_empresa();
drop policy if exists "ro_reglas_empresa: dueño o equipo" on public.ro_reglas_empresa;
create policy "ro_reglas_empresa: dueño o equipo" on public.ro_reglas_empresa
  for all using (public.puede_acceder(user_id)) with check (public.puede_acceder(user_id));
revoke all on public.ro_reglas_empresa from anon;
grant select, insert, update, delete on public.ro_reglas_empresa to authenticated;

-- 9. NODOS Práctica ----------------------------------------------------------------
-- Partidas: todo es ficticio. El estado de la partida vive en un JSON chico.
create table if not exists public.practica_partidas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  modo text not null,
  clave text not null,
  estado jsonb not null default '{}'::jsonb,
  terminada boolean not null default false,
  resultado jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint practica_partidas_modo check (modo in ('mision', 'anio')),
  constraint practica_partidas_clave check (clave ~ '^[a-z0-9-]{2,60}$'),
  constraint practica_partidas_tamano check (pg_column_size(estado) < 200000 and (resultado is null or pg_column_size(resultado) < 50000))
);
create index if not exists practica_partidas_usuario_idx on public.practica_partidas (user_id, clave, updated_at desc);
alter table public.practica_partidas enable row level security;
drop policy if exists "practica_partidas: dueño" on public.practica_partidas;
create policy "practica_partidas: dueño" on public.practica_partidas
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop trigger if exists practica_partidas_touch on public.practica_partidas;
create trigger practica_partidas_touch before update on public.practica_partidas
  for each row execute function public.touch_updated_at();
revoke all on public.practica_partidas from anon;
grant select, insert, update, delete on public.practica_partidas to authenticated;

-- Contenido: tarjetas y misiones que se agregan o corrigen desde el Panel.
-- Las que vienen con la app viven en el código; una fila con el mismo id
-- las reemplaza. Solo lo publicado llega a los usuarios.
create table if not exists public.practica_contenido (
  id text primary key,
  tipo text not null,
  datos jsonb not null,
  estado text not null default 'borrador',
  actualizado_por uuid default auth.uid() references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  constraint practica_contenido_id check (id ~ '^[a-z0-9-]{3,60}$'),
  constraint practica_contenido_tipo check (tipo in ('tarjeta', 'mision')),
  constraint practica_contenido_estado check (estado in ('borrador', 'revisado', 'publicado')),
  constraint practica_contenido_tamano check (pg_column_size(datos) < 60000)
);
alter table public.practica_contenido enable row level security;
drop policy if exists "practica_contenido: leer publicado" on public.practica_contenido;
create policy "practica_contenido: leer publicado" on public.practica_contenido
  for select using (estado = 'publicado' or public.is_admin());
drop policy if exists "practica_contenido: admin escribe" on public.practica_contenido;
create policy "practica_contenido: admin escribe" on public.practica_contenido
  for insert with check (public.is_admin());
drop policy if exists "practica_contenido: admin edita" on public.practica_contenido;
create policy "practica_contenido: admin edita" on public.practica_contenido
  for update using (public.is_admin()) with check (public.is_admin());
drop policy if exists "practica_contenido: admin borra" on public.practica_contenido;
create policy "practica_contenido: admin borra" on public.practica_contenido
  for delete using (public.is_admin());
drop trigger if exists practica_contenido_touch on public.practica_contenido;
create trigger practica_contenido_touch before update on public.practica_contenido
  for each row execute function public.touch_updated_at();
revoke all on public.practica_contenido from anon;
grant select, insert, update, delete on public.practica_contenido to authenticated;

notify pgrst, 'reload schema';
