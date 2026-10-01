-- ═════════════════════════════════════════════════════════════════════════
-- NODOS Empresas: "Novedades para tus empresas". Idempotente.
-- Correr después de 007_siara.sql.
--
--   1. `empresas.rubro`: sector de la empresa (lista fija) para mostrarle
--      noticias de su rubro. Se usa solo dentro de la app (RLS); a Google
--      News nunca sale nada de la empresa (ver src/app/api/novedades/route.ts).
--   2. `leads.origen` acepta 'app': consultas enviadas desde una nota de
--      NODOS, con confirmación explícita del usuario.
--   3. `notas_nodos`: notas editoriales del equipo NODOS. No contienen datos
--      de clientes. Las lee cualquier cuenta logueada si están publicadas;
--      solo los administradores las crean, editan y borran.
--
-- Las listas de rubros y organismos deben coincidir con src/lib/novedades.ts.
-- ═════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────
-- 1. Rubro de la empresa
-- ─────────────────────────────────────────────────────────────────────────
alter table public.empresas add column if not exists rubro text;

alter table public.empresas drop constraint if exists empresas_rubro_valido;
alter table public.empresas add constraint empresas_rubro_valido check (
  rubro is null or rubro in (
    'agro', 'inmobiliario', 'comercio', 'industria', 'servicios', 'transporte',
    'tecnologia', 'financiero', 'salud', 'educacion', 'osfl'
  )
);

-- ─────────────────────────────────────────────────────────────────────────
-- 2. Leads: origen 'app' + índice para el límite por usuario
-- ─────────────────────────────────────────────────────────────────────────
alter table public.leads drop constraint if exists leads_origen_check;
alter table public.leads add constraint leads_origen_check check (
  origen in ('sitio', 'whatsapp', 'instagram', 'tiktok', 'youtube', 'email', 'referido', 'evento', 'otro', 'app')
);
create index if not exists leads_creado_por_idx on public.leads (creado_por, created_at desc) where creado_por is not null;

-- ─────────────────────────────────────────────────────────────────────────
-- 3. Notas NODOS
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists public.notas_nodos (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  titulo text not null check (length(btrim(titulo)) between 3 and 200),
  -- Resumen corto (se ve siempre) y cuerpo opcional ("Leer más"). Texto plano.
  resumen text not null check (length(btrim(resumen)) between 3 and 600),
  cuerpo text check (cuerpo is null or length(cuerpo) <= 8000),
  link text check (link is null or (link ~* '^https?://[^[:space:]]+$' and length(link) <= 2000)),
  -- Id de tema de normativa del catálogo (src/lib/novedades.ts → ORGANISMOS).
  organismo text check (organismo is null or organismo in (
    'seprelad-inmobiliaria', 'seprelad-osfl', 'seprelad-remesas', 'seprelad',
    'dnit', 'mef-siara', 'registros', 'ips', 'mtess', 'bcp'
  )),
  -- Segmentación: vacío en los dos = para todos.
  rubros text[] not null default '{}' check (rubros <@ array[
    'agro', 'inmobiliario', 'comercio', 'industria', 'servicios', 'transporte',
    'tecnologia', 'financiero', 'salud', 'educacion', 'osfl'
  ]::text[]),
  sectores_seprelad text[] not null default '{}'
    check (sectores_seprelad <@ array['inmobiliaria', 'osfl', 'remesas']::text[]),
  destacada boolean not null default false,
  publicada boolean not null default false,
  publicada_el timestamptz,
  creado_por uuid references auth.users(id) on delete set null default auth.uid()
);

create index if not exists notas_nodos_publicadas_idx
  on public.notas_nodos (destacada desc, publicada_el desc) where publicada;

-- updated_at + fecha de publicación automática (la primera vez que se
-- publica; si se despublica, se conserva para el historial).
create or replace function public.notas_nodos_antes_de_guardar()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' then
    new.updated_at := now();
  end if;
  if new.publicada and new.publicada_el is null then
    new.publicada_el := now();
  end if;
  return new;
end;
$$;

drop trigger if exists notas_nodos_guardar on public.notas_nodos;
create trigger notas_nodos_guardar
  before insert or update on public.notas_nodos
  for each row execute function public.notas_nodos_antes_de_guardar();

alter table public.notas_nodos enable row level security;

drop policy if exists "notas_nodos: leer publicadas" on public.notas_nodos;
create policy "notas_nodos: leer publicadas" on public.notas_nodos
  for select to authenticated using (publicada or public.is_admin());

drop policy if exists "notas_nodos: admin crea" on public.notas_nodos;
create policy "notas_nodos: admin crea" on public.notas_nodos
  for insert to authenticated with check (public.is_admin());

drop policy if exists "notas_nodos: admin edita" on public.notas_nodos;
create policy "notas_nodos: admin edita" on public.notas_nodos
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "notas_nodos: admin borra" on public.notas_nodos;
create policy "notas_nodos: admin borra" on public.notas_nodos
  for delete to authenticated using (public.is_admin());

revoke all on public.notas_nodos from anon;
grant select, insert, update, delete on public.notas_nodos to authenticated;

notify pgrst, 'reload schema';
