-- ═════════════════════════════════════════════════════════════════════════
-- Cuentas NODOS: nombre de usuario + ingreso único desde nodoscompliance.com.
-- Archivo idéntico en finanzas-app y nodos-empresas. Idempotente. Correr en
-- el proyecto Supabase COMPARTIDO, después de 000_cuentas_nodos.sql.
-- ═════════════════════════════════════════════════════════════════════════

-- 1. Nombre de usuario (lo que se muestra en lugar del email) ---------------
alter table public.profiles add column if not exists usuario text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_usuario_formato') then
    alter table public.profiles add constraint profiles_usuario_formato
      check (usuario is null or usuario ~ '^[a-z0-9._]{3,20}$');
  end if;
end $$;

create unique index if not exists profiles_usuario_unico on public.profiles (usuario);

-- 2. El alta toma el usuario elegido al registrarse (si es válido y libre) ---
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  u text := lower(trim(coalesce(new.raw_user_meta_data ->> 'usuario', '')));
begin
  if u !~ '^[a-z0-9._]{3,20}$' or exists (select 1 from public.profiles where usuario = u) then
    u := null;
  end if;
  begin
    insert into public.profiles (id, email, nombre, usuario, is_admin)
    values (
      new.id,
      new.email,
      nullif(trim(new.raw_user_meta_data ->> 'nombre'), ''),
      u,
      lower(new.email) = 'maurivaceque@gmail.com'
    )
    on conflict (id) do nothing;
  exception when unique_violation then
    -- Carrera por el mismo usuario: la cuenta se crea igual, sin usuario.
    insert into public.profiles (id, email, nombre, is_admin)
    values (new.id, new.email, nullif(trim(new.raw_user_meta_data ->> 'nombre'), ''), lower(new.email) = 'maurivaceque@gmail.com')
    on conflict (id) do nothing;
  end;
  return new;
end;
$$;

-- 3. ¿Está libre este usuario? (para el formulario de registro) -------------
create or replace function public.usuario_disponible(u text)
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select lower(trim(u)) ~ '^[a-z0-9._]{3,20}$'
     and not exists (select 1 from public.profiles where usuario = lower(trim(u)));
$$;

grant execute on function public.usuario_disponible(text) to anon, authenticated;

-- 4. Rankings: se muestra el usuario (o el primer nombre), nunca el email ---
create or replace function public.nombres_publicos(ids uuid[])
returns table (id uuid, alias text)
language sql
security definer set search_path = public
stable
as $$
  select p.id,
         coalesce(nullif(p.usuario, ''),
                  nullif(split_part(p.nombre, ' ', 1), ''),
                  left(split_part(p.email, '@', 1), 3) || '···')
  from public.profiles p
  where p.id = any(ids) and auth.uid() is not null;
$$;

-- 5. Límite de intentos de ingreso por conexión (lo usa el servidor) --------
create table if not exists public.intentos_ingreso (
  id bigint generated always as identity primary key,
  ip_hash text not null,
  created_at timestamptz not null default now()
);
create index if not exists intentos_ingreso_ip on public.intentos_ingreso (ip_hash, created_at);
alter table public.intentos_ingreso enable row level security;
-- Sin políticas: solo la service role (servidor) lee y escribe.

notify pgrst, 'reload schema';
