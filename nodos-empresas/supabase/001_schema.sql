-- ═════════════════════════════════════════════════════════════════════════
-- Nodos Empresas — esquema inicial (proyecto de Supabase NUEVO)
--
-- Correr UNA sola vez, entero, desde Supabase → SQL Editor → New query.
-- Después: registrate en /signup y corré la sección "ADMIN" del final
-- (con tu email) para marcarte como administrador.
-- ═════════════════════════════════════════════════════════════════════════

create extension if not exists pgcrypto;

-- ─────────────────────────────────────────────────────────────────────────
-- 1. Perfiles (uno por usuario de auth.users) + admin
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);

alter table profiles enable row level security;

create or replace function public.is_admin()
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false);
$$;

-- Cada usuario ve su propio perfil; el admin ve todos. Nadie edita perfiles
-- desde el cliente (el panel de admin usa la service role key en el servidor).
drop policy if exists "profiles: select propio o admin" on profiles;
create policy "profiles: select propio o admin" on profiles
  for select using (auth.uid() = id or public.is_admin());

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ─────────────────────────────────────────────────────────────────────────
-- 2. Empresas
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists empresas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  denominacion text not null,
  tipo text not null check (tipo in ('sa', 'eas', 'srl')),
  ruc text,
  domicilio text,
  ciudad text,
  fecha_constitucion date,
  -- Mes de cierre del ejercicio (1-12). En Paraguay casi siempre 12.
  cierre_mes smallint not null default 12 check (cierre_mes between 1 and 12),
  -- Fecha en que vence el mandato del Directorio / órgano de administración.
  vencimiento_mandato date,
  tiene_sindico boolean not null default true,
  capital_integrado numeric,
  notas text,
  created_at timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────────────────
-- 3. Libro de accionistas
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists accionistas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  empresa_id uuid not null references empresas(id) on delete cascade,
  nombre text not null,
  documento text,
  tipo_persona text not null default 'fisica' check (tipo_persona in ('fisica', 'juridica')),
  -- Rama o vínculo familiar (ej. "Fundador", "Hijo — rama López").
  vinculo text,
  acciones numeric not null default 0 check (acciones >= 0),
  votos_por_accion numeric not null default 1 check (votos_por_accion >= 0),
  -- Cargo en el órgano de administración, si tiene (ej. "Presidente").
  cargo text,
  email text,
  telefono text,
  activo boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists accionistas_empresa_idx on accionistas (empresa_id);

create table if not exists movimientos_acciones (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  empresa_id uuid not null references empresas(id) on delete cascade,
  fecha date not null,
  tipo text not null check (tipo in ('transferencia', 'herencia', 'donacion', 'suscripcion', 'ajuste')),
  de_accionista_id uuid references accionistas(id) on delete set null,
  a_accionista_id uuid references accionistas(id) on delete set null,
  de_nombre text,
  a_nombre text,
  cantidad numeric not null check (cantidad > 0),
  precio_total numeric,
  notas text,
  created_at timestamptz not null default now()
);

create index if not exists movimientos_empresa_idx on movimientos_acciones (empresa_id, fecha desc);

-- ─────────────────────────────────────────────────────────────────────────
-- 4. Obligaciones / vencimientos
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists obligaciones (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  empresa_id uuid not null references empresas(id) on delete cascade,
  titulo text not null,
  descripcion text,
  categoria text not null default 'societario'
    check (categoria in ('societario', 'registros', 'tributario', 'laboral', 'interno')),
  fecha date not null,
  estado text not null default 'pendiente' check (estado in ('pendiente', 'hecho')),
  completado_en timestamptz,
  origen text not null default 'manual' check (origen in ('calendario', 'manual', 'evento')),
  -- Clave de la regla del calendario automático + año, para no duplicar al
  -- volver a generar el calendario de un mismo año.
  regla text,
  anio integer,
  plantilla text,
  created_at timestamptz not null default now()
);

create index if not exists obligaciones_fecha_idx on obligaciones (user_id, estado, fecha);
-- Índice único simple (no parcial) para que el "upsert ... on conflict" de la
-- app funcione. Las filas manuales tienen regla nula y nunca chocan entre sí.
create unique index if not exists obligaciones_regla_unica
  on obligaciones (empresa_id, regla, anio);

-- ─────────────────────────────────────────────────────────────────────────
-- 5. Documentos generados
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists documentos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  empresa_id uuid not null references empresas(id) on delete cascade,
  plantilla text not null,
  titulo text not null,
  datos jsonb not null default '{}'::jsonb,
  contenido_html text not null,
  created_at timestamptz not null default now()
);

create index if not exists documentos_empresa_idx on documentos (empresa_id, created_at desc);

-- ─────────────────────────────────────────────────────────────────────────
-- 6. RLS: cada usuario ve y edita solo lo suyo (admin puede leer todo).
-- ─────────────────────────────────────────────────────────────────────────
do $$
declare
  t text;
begin
  foreach t in array array['empresas', 'accionistas', 'movimientos_acciones', 'obligaciones', 'documentos']
  loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists %I on %I', t || ': dueño', t);
    execute format(
      'create policy %I on %I for all using (auth.uid() = user_id or public.is_admin()) with check (auth.uid() = user_id)',
      t || ': dueño', t
    );
  end loop;
end $$;

-- ─────────────────────────────────────────────────────────────────────────
-- 7. Transferencia de acciones atómica (descuenta, suma y registra en una
--    sola operación). Corre con los permisos del usuario (RLS aplica).
-- ─────────────────────────────────────────────────────────────────────────
create or replace function public.registrar_movimiento_acciones(
  p_empresa_id uuid,
  p_fecha date,
  p_tipo text,
  p_de_accionista_id uuid,
  p_a_accionista_id uuid,
  p_cantidad numeric,
  p_precio_total numeric default null,
  p_notas text default null
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_de accionistas%rowtype;
  v_a accionistas%rowtype;
  v_id uuid;
begin
  if p_cantidad is null or p_cantidad <= 0 then
    raise exception 'La cantidad debe ser mayor a cero.';
  end if;

  select * into v_a from accionistas where id = p_a_accionista_id and empresa_id = p_empresa_id for update;
  if not found then
    raise exception 'No se encontró el accionista que recibe las acciones.';
  end if;

  if p_de_accionista_id is not null then
    if p_de_accionista_id = p_a_accionista_id then
      raise exception 'El accionista que transfiere y el que recibe deben ser distintos.';
    end if;
    select * into v_de from accionistas where id = p_de_accionista_id and empresa_id = p_empresa_id for update;
    if not found then
      raise exception 'No se encontró el accionista que transfiere.';
    end if;
    if v_de.acciones < p_cantidad then
      raise exception 'El accionista que transfiere tiene % acciones; no alcanza para transferir %.', v_de.acciones, p_cantidad;
    end if;
    update accionistas set acciones = acciones - p_cantidad where id = v_de.id;
  elsif p_tipo <> 'suscripcion' and p_tipo <> 'ajuste' then
    raise exception 'Indicá qué accionista transfiere las acciones.';
  end if;

  update accionistas set acciones = acciones + p_cantidad, activo = true where id = v_a.id;

  insert into movimientos_acciones
    (empresa_id, fecha, tipo, de_accionista_id, a_accionista_id, de_nombre, a_nombre, cantidad, precio_total, notas)
  values
    (p_empresa_id, p_fecha, p_tipo, p_de_accionista_id, p_a_accionista_id, v_de.nombre, v_a.nombre, p_cantidad, p_precio_total, p_notas)
  returning id into v_id;

  return v_id;
end;
$$;

grant execute on function public.registrar_movimiento_acciones(uuid, date, text, uuid, uuid, numeric, numeric, text) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- 8. ADMIN — correr manualmente después de registrarte en /signup.
--    Reemplazá el email y descomentá.
-- ─────────────────────────────────────────────────────────────────────────
-- update profiles set is_admin = true
-- where id = (select id from auth.users where email = 'tu-email@ejemplo.com');
