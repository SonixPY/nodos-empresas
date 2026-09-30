-- ═════════════════════════════════════════════════════════════════════════
-- Cuentas NODOS: una sola base de usuarios para Finanzas y Empresas.
-- Archivo idéntico en finanzas-app y nodos-empresas. Idempotente: se puede
-- correr más de una vez. Correrlo en el proyecto Supabase COMPARTIDO
-- (el de Finanzas), ANTES que las migraciones de cada app.
-- ═════════════════════════════════════════════════════════════════════════

-- 1. Perfiles ---------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.profiles add column if not exists nombre text;
alter table public.profiles add column if not exists acceso_finanzas boolean not null default true;
alter table public.profiles add column if not exists acceso_empresas boolean not null default true;
alter table public.profiles add column if not exists suspendido boolean not null default false;

alter table public.profiles enable row level security;

create or replace function public.is_admin()
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false);
$$;

-- Privacidad: cada cuenta ve solo su perfil (los admins ven todos). Antes
-- cualquier usuario logueado podía listar los emails de todos.
drop policy if exists "profiles: select logueados" on public.profiles;
drop policy if exists "profiles: select propio o admin" on public.profiles;
create policy "profiles: select propio o admin" on public.profiles
  for select using (auth.uid() = id or public.is_admin());

-- Seguridad: nadie modifica su propio perfil desde el navegador (antes se
-- podía poner is_admin = true a uno mismo). Los cambios los hace el panel de
-- administración del servidor, con la service role.
drop policy if exists "profiles: update propio" on public.profiles;

-- 2. Alta automática del perfil ----------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, nombre, is_admin)
  values (
    new.id,
    new.email,
    nullif(trim(new.raw_user_meta_data ->> 'nombre'), ''),
    lower(new.email) = 'maurivaceque@gmail.com'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Mantiene el email del perfil igual al de auth cuando cambia.
create or replace function public.sync_profile_email()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  update public.profiles set email = new.email where id = new.id;
  return new;
end;
$$;

drop trigger if exists on_auth_user_email_changed on auth.users;
create trigger on_auth_user_email_changed
  after update of email on auth.users
  for each row when (old.email is distinct from new.email)
  execute procedure public.sync_profile_email();

-- Cuentas que ya existían sin perfil.
insert into public.profiles (id, email)
select u.id, u.email from auth.users u
where not exists (select 1 from public.profiles p where p.id = u.id);

update public.profiles set is_admin = true where lower(email) = 'maurivaceque@gmail.com';

-- 3. Nombres públicos para rankings (Aprender) sin exponer emails ------------
create or replace function public.nombres_publicos(ids uuid[])
returns table (id uuid, alias text)
language sql
security definer set search_path = public
stable
as $$
  select p.id,
         coalesce(nullif(split_part(p.nombre, ' ', 1), ''),
                  left(split_part(p.email, '@', 1), 3) || '···')
  from public.profiles p
  where p.id = any(ids) and auth.uid() is not null;
$$;

grant execute on function public.nombres_publicos(uuid[]) to authenticated;

notify pgrst, 'reload schema';
