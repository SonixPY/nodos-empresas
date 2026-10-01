-- ═════════════════════════════════════════════════════════════════════════
-- NODOS Empresas: ficha "estilo SIARA" (Registro Administrativo de Personas y
-- Estructuras Jurídicas y de Beneficiarios Finales — Ley N° 6446/2019,
-- Decreto N° 3241/2020; sistema SIARA del Ministerio de Economía y Finanzas,
-- DGPEJBF).
-- Correr después de 006_documentos.sql (usa public.puede_acceder,
-- public.dueno_desde_empresa y public.poderes_borrar_vencimiento).
-- Idempotente.
--
--   1. Columnas nuevas en `empresas`: datos de la persona jurídica que pide
--      SIARA (correo institucional, web, departamento, barrio, domicilio
--      comercial, actividad, inscripción registral, valor nominal) y el
--      seguimiento de la última declaración presentada.
--   2. Tabla `beneficiarios_finales` (Ley 6446/2019 arts. 4 y 6; Decreto
--      3241/2020 art. 6).
--   3. Tabla `administradores` (Decreto 3241/2020 art. 4): si el cargo tiene
--      vencimiento de mandato (y está activo), un trigger crea / actualiza /
--      borra su vencimiento en `obligaciones`, igual que `poderes` (006).
-- ═════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────
-- 1. Empresas: datos de la persona jurídica para SIARA
-- ─────────────────────────────────────────────────────────────────────────
alter table public.empresas add column if not exists email_institucional text;
alter table public.empresas add column if not exists pagina_web text;
alter table public.empresas add column if not exists departamento text;
alter table public.empresas add column if not exists barrio text;
alter table public.empresas add column if not exists domicilio_comercial text;   -- si difiere del social
alter table public.empresas add column if not exists actividad_principal text;
alter table public.empresas add column if not exists inscripcion_registral text; -- "Registro Público de Comercio, matrícula/serie/folio …"
alter table public.empresas add column if not exists fecha_inscripcion date;
alter table public.empresas add column if not exists valor_nominal_accion numeric;
alter table public.empresas add column if not exists siara_ultima_declaracion date;
alter table public.empresas add column if not exists siara_numero_solicitud text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'empresas_valor_nominal_valido') then
    alter table public.empresas add constraint empresas_valor_nominal_valido
      check (valor_nominal_accion is null or valor_nominal_accion >= 0);
  end if;
end $$;

-- ─────────────────────────────────────────────────────────────────────────
-- 2. Beneficiarios finales
-- ─────────────────────────────────────────────────────────────────────────
-- condiciones: literales del art. 4 de la Ley 6446/2019 que lo hacen BF.
--   a) participación ≥ 10% del capital
--   b) control de más del 25% del derecho de voto
--   c) gerentes, administradores o quienes usen o se beneficien de los activos
--   d) derecho a designar o cesar parte de los órganos de administración
--   e) control en virtud de estatutos, reglamentos u otros instrumentos
create table if not exists public.beneficiarios_finales (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  accionista_id uuid references public.accionistas(id) on delete set null,
  nombre text not null check (length(btrim(nombre)) > 0),   -- nombres y apellidos
  tipo_documento text not null default 'ci' check (tipo_documento in ('ci', 'pasaporte', 'otro')),
  documento text,
  ruc text,
  nacionalidad text,
  fecha_nacimiento date,
  pais_residencia text,
  departamento text,
  ciudad text,
  barrio text,
  domicilio text,                                           -- calle principal, número
  profesion text,
  ocupacion text,
  email text,
  telefono text,
  participacion_directa numeric not null default 0 check (participacion_directa between 0 and 100),
  participacion_indirecta numeric not null default 0 check (participacion_indirecta between 0 and 100),
  porcentaje_votos numeric check (porcentaje_votos is null or porcentaje_votos between 0 and 100),
  condiciones text[] not null default '{}'
    check (condiciones <@ array['a', 'b', 'c', 'd', 'e']::text[]),
  cadena_control text,                                      -- sociedades intermedias, si es indirecto
  es_pep boolean not null default false,
  cargo_pep text,
  fecha_desde date,                                         -- "fecha de constitución como BF"
  fecha_hasta date,                                         -- dejó de serlo
  notas text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint bf_fechas_validas check (fecha_hasta is null or fecha_desde is null or fecha_hasta >= fecha_desde)
);

create index if not exists bf_empresa_idx on public.beneficiarios_finales (empresa_id);
create index if not exists bf_user_idx on public.beneficiarios_finales (user_id);

alter table public.beneficiarios_finales enable row level security;
drop policy if exists "beneficiarios_finales: dueño o equipo" on public.beneficiarios_finales;
create policy "beneficiarios_finales: dueño o equipo" on public.beneficiarios_finales
  for all using (public.puede_acceder(user_id)) with check (public.puede_acceder(user_id));

create or replace function public.siara_tocar_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists bf_10_dueno on public.beneficiarios_finales;
create trigger bf_10_dueno
  before insert or update of empresa_id on public.beneficiarios_finales
  for each row execute function public.dueno_desde_empresa();

drop trigger if exists bf_20_updated on public.beneficiarios_finales;
create trigger bf_20_updated
  before update on public.beneficiarios_finales
  for each row execute function public.siara_tocar_updated_at();

-- ─────────────────────────────────────────────────────────────────────────
-- 3. Administradores y representantes
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists public.administradores (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  nombre text not null check (length(btrim(nombre)) > 0),
  tipo_documento text not null default 'ci' check (tipo_documento in ('ci', 'pasaporte', 'otro')),
  documento text,
  cargo text not null default 'director_titular' check (cargo in (
    'presidente', 'vicepresidente', 'director_titular', 'director_suplente',
    'sindico_titular', 'sindico_suplente', 'gerente', 'administrador',
    'representante_legal', 'apoderado', 'otro'
  )),
  cargo_detalle text,                                       -- texto libre si cargo = 'otro'
  es_representante_legal boolean not null default false,
  nacionalidad text,
  profesion text,
  ocupacion text,
  domicilio text,
  ciudad text,
  email text,
  telefono text,
  fecha_designacion date,                                   -- "fecha de asunción"
  fecha_asamblea date,                                      -- última asamblea de designación
  vencimiento_mandato date,                                 -- "vigencia del cargo"
  instrumento text,                                         -- "Acta de Asamblea N° …", "Escritura N° …"
  inscripto boolean not null default false,
  activo boolean not null default true,
  notas text,
  -- Vencimiento sincronizado por trigger; la app no lo escribe.
  obligacion_id uuid references public.obligaciones(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint administradores_mandato_valido
    check (vencimiento_mandato is null or fecha_designacion is null or vencimiento_mandato >= fecha_designacion)
);

create index if not exists administradores_empresa_idx on public.administradores (empresa_id, activo, vencimiento_mandato);
create index if not exists administradores_user_idx on public.administradores (user_id);

alter table public.administradores enable row level security;
drop policy if exists "administradores: dueño o equipo" on public.administradores;
create policy "administradores: dueño o equipo" on public.administradores
  for all using (public.puede_acceder(user_id)) with check (public.puede_acceder(user_id));

create or replace function public.siara_cargo_label(c text, detalle text)
returns text
language sql
immutable
as $$
  select case c
    when 'presidente' then 'Presidente'
    when 'vicepresidente' then 'Vicepresidente'
    when 'director_titular' then 'Director titular'
    when 'director_suplente' then 'Director suplente'
    when 'sindico_titular' then 'Síndico titular'
    when 'sindico_suplente' then 'Síndico suplente'
    when 'gerente' then 'Gerente'
    when 'administrador' then 'Administrador'
    when 'representante_legal' then 'Representante legal'
    when 'apoderado' then 'Apoderado'
    else coalesce(nullif(btrim(detalle), ''), 'Otro cargo')
  end;
$$;

-- Mismo esquema que poderes_sincronizar_vencimiento (006):
--   · activo + vencimiento_mandato → crea o actualiza UNA obligación.
--   · sin fecha, o inactivo        → la borra (trigger AFTER).
--   · borrar el administrador      → la borra (trigger AFTER).
create or replace function public.administradores_sincronizar_vencimiento()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_titulo text;
  v_desc text;
begin
  if tg_op = 'INSERT' then
    new.obligacion_id := null;
  else
    -- El usuario borró el vencimiento desde la agenda: se respeta y no se
    -- recrea hasta que se vuelva a editar el administrador.
    if old.obligacion_id is not null and new.obligacion_id is null and pg_trigger_depth() > 1 then
      return new;
    end if;
    new.obligacion_id := old.obligacion_id;
    new.updated_at := now();
  end if;

  if new.vencimiento_mandato is null or not new.activo then
    new.obligacion_id := null;
    return new;
  end if;

  v_titulo := 'Vence mandato de ' || btrim(new.nombre) || ' (' || public.siara_cargo_label(new.cargo, new.cargo_detalle) || ')';
  v_desc := 'Incluí la designación en el orden del día de la asamblea'
    || coalesce(' · Designado por ' || nullif(btrim(new.instrumento), ''), '')
    || '. Después del cambio, comunicalo en SIARA dentro de los 15 días hábiles (Ley 6446/2019, art. 7; Decreto 3241/2020, art. 10).';

  if new.obligacion_id is not null then
    update public.obligaciones o
       set titulo = v_titulo,
           descripcion = v_desc,
           empresa_id = new.empresa_id,
           user_id = new.user_id,
           estado = case when o.fecha is distinct from new.vencimiento_mandato then 'pendiente' else o.estado end,
           completado_en = case when o.fecha is distinct from new.vencimiento_mandato then null else o.completado_en end,
           fecha = new.vencimiento_mandato
     where o.id = new.obligacion_id;
    if found then
      return new;
    end if;
  end if;

  insert into public.obligaciones (user_id, empresa_id, titulo, descripcion, categoria, fecha, origen, regla, anio, plantilla)
  values (new.user_id, new.empresa_id, v_titulo, v_desc, 'societario', new.vencimiento_mandato, 'evento', null, null, null)
  returning id into new.obligacion_id;
  return new;
end;
$$;

-- Los triggers BEFORE corren en orden alfabético: primero el dueño, después el vencimiento.
drop trigger if exists administradores_10_dueno on public.administradores;
create trigger administradores_10_dueno
  before insert or update of empresa_id on public.administradores
  for each row execute function public.dueno_desde_empresa();

drop trigger if exists administradores_20_vencimiento on public.administradores;
create trigger administradores_20_vencimiento
  before insert or update on public.administradores
  for each row execute function public.administradores_sincronizar_vencimiento();

-- El borrado reutiliza la función genérica de 006 (solo mira obligacion_id).
drop trigger if exists administradores_30_borrar_vencimiento on public.administradores;
create trigger administradores_30_borrar_vencimiento
  after update or delete on public.administradores
  for each row execute function public.poderes_borrar_vencimiento();

notify pgrst, 'reload schema';
