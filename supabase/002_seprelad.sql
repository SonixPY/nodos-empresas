-- ═════════════════════════════════════════════════════════════════════════
-- NODOS Empresas — módulo de cumplimiento SEPRELAD (PLA/FT).
-- Orden: 000_cuentas_nodos.sql → 001_schema.sql → este archivo.
-- Idempotente.
-- ═════════════════════════════════════════════════════════════════════════

-- 1. Nueva categoría de vencimiento ----------------------------------------
alter table obligaciones drop constraint if exists obligaciones_categoria_check;
alter table obligaciones add constraint obligaciones_categoria_check
  check (categoria in ('societario', 'registros', 'tributario', 'laboral', 'interno', 'seprelad'));

-- 2. Perfil de sujeto obligado por empresa ---------------------------------
create table if not exists perfil_seprelad (
  empresa_id uuid primary key references empresas(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  sectores text[] not null default '{}'
    check (sectores <@ array['inmobiliaria', 'osfl', 'remesas']::text[]),
  segmento_osfl smallint check (segmento_osfl between 1 and 3),
  inscripta boolean not null default false,
  fecha_inscripcion date,
  -- Datos mínimos del oficial de cumplimiento: los datos completos (documento,
  -- domicilio, CV) van solo en la nota a SEPRELAD, no se guardan acá.
  oc_nombre text,
  oc_cargo text,
  oc_email text,
  oc_designado_el date,
  ultima_autoevaluacion date,
  ultima_metodologia date,
  notas text,
  updated_at timestamptz not null default now()
);

alter table perfil_seprelad enable row level security;
drop policy if exists "perfil_seprelad: dueño" on perfil_seprelad;
create policy "perfil_seprelad: dueño" on perfil_seprelad
  for all using (auth.uid() = user_id or public.is_admin()) with check (auth.uid() = user_id);

grant select, insert, update, delete on perfil_seprelad to authenticated;

notify pgrst, 'reload schema';
