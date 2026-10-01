-- ═════════════════════════════════════════════════════════════════════════
-- NODOS Empresas: registro de poderes + archivo de documentos de la empresa.
-- Correr después de 005_equipo.sql (usa public.puede_acceder). Idempotente.
--
--   1. Tabla `poderes`: registro de poderes otorgados por cada empresa. Si el
--      poder tiene fecha de vencimiento (y está vigente), un trigger crea /
--      actualiza / borra su vencimiento en `obligaciones` ("Vence poder de …").
--   2. Tabla `archivos`: metadatos de los documentos reales que sube el
--      usuario (estatutos, actas, constancias…). El archivo vive en Storage.
--   3. Bucket privado `archivo` en Storage, con rutas
--      <user_id dueño>/<empresa_id>/<nombre del archivo>, y sus políticas.
-- ═════════════════════════════════════════════════════════════════════════

-- 0. El dueño (user_id) de la fila es siempre el dueño de la empresa ---------
-- Así, si un admin del equipo carga algo en una empresa de otro admin, la
-- fila (y el archivo en Storage) quedan bajo el mismo dueño que la empresa.
-- Corre con los permisos de quien llama: si no puede ver la empresa, falla.
create or replace function public.dueno_desde_empresa()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  d uuid;
begin
  select e.user_id into d from public.empresas e where e.id = new.empresa_id;
  if d is null then
    raise exception 'La empresa no existe o no tenés acceso a ella.' using errcode = '42501';
  end if;
  new.user_id := d;
  return new;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────
-- 1. Poderes
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists public.poderes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  apoderado text not null check (length(btrim(apoderado)) > 0),
  apoderado_documento text,                 -- C.I. o RUC
  tipo text not null default 'especial'
    check (tipo in ('general', 'especial', 'judicial', 'administrativo', 'otro')),
  facultades text,
  fecha_otorgamiento date not null,
  instrumento text,                         -- "Escritura pública N° …" / "Carta poder simple"
  escribano text,
  fecha_inscripcion date,                   -- solo si aplica
  registro text,                            -- p. ej. Registro de Poderes (DGRP)
  fecha_vencimiento date,
  duracion_texto text,                      -- p. ej. "hasta su revocación"
  -- 'vencido' no se guarda: se calcula en la app comparando fecha_vencimiento con hoy.
  estado text not null default 'vigente' check (estado in ('vigente', 'revocado')),
  revocado_el date,
  notas text,
  -- Vencimiento sincronizado por trigger; la app no lo escribe.
  obligacion_id uuid references public.obligaciones(id) on delete set null,
  -- Documento generado desde el que se registró (carta poder), si existe.
  documento_id uuid references public.documentos(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint poderes_vencimiento_valido check (fecha_vencimiento is null or fecha_vencimiento >= fecha_otorgamiento)
);

create index if not exists poderes_empresa_idx on public.poderes (empresa_id, estado, fecha_vencimiento);
create index if not exists poderes_user_idx on public.poderes (user_id);

alter table public.poderes enable row level security;
drop policy if exists "poderes: dueño o equipo" on public.poderes;
create policy "poderes: dueño o equipo" on public.poderes
  for all using (public.puede_acceder(user_id)) with check (public.puede_acceder(user_id));

-- Sincroniza el vencimiento del poder con `obligaciones`.
--   · vigente + fecha_vencimiento → crea o actualiza UNA obligación (sin duplicar al editar).
--   · sin fecha, o revocado      → borra la obligación.
--   · borrar el poder            → borra la obligación.
-- Corre con los permisos de quien llama (RLS de `obligaciones` aplica), y la
-- columna obligacion_id no se puede fijar desde la app: el trigger la pisa.
-- El borrado va en un trigger AFTER: si se hiciera en el BEFORE, el
-- "on delete set null" de la FK tocaría la misma fila que se está editando.
create or replace function public.poderes_sincronizar_vencimiento()
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
    -- El usuario borró el vencimiento desde la agenda: la FK pone la columna
    -- en null (en cascada, profundidad > 1). Se respeta y no se recrea
    -- hasta que se vuelva a editar el poder.
    if old.obligacion_id is not null and new.obligacion_id is null and pg_trigger_depth() > 1 then
      return new;
    end if;
    new.obligacion_id := old.obligacion_id;
    new.updated_at := now();
  end if;

  if new.fecha_vencimiento is null or new.estado <> 'vigente' then
    -- el trigger AFTER borra la obligación anterior
    new.obligacion_id := null;
    return new;
  end if;

  v_titulo := 'Vence poder de ' || btrim(new.apoderado);
  v_desc := 'Poder ' || new.tipo
    || coalesce(' · ' || nullif(btrim(new.instrumento), ''), '')
    || '. Renovalo o dejá constancia de su extinción antes de esta fecha (Documentos → Poderes).';

  if new.obligacion_id is not null then
    update public.obligaciones o
       set titulo = v_titulo,
           descripcion = v_desc,
           empresa_id = new.empresa_id,
           user_id = new.user_id,
           -- si cambió la fecha, vuelve a quedar pendiente
           estado = case when o.fecha is distinct from new.fecha_vencimiento then 'pendiente' else o.estado end,
           completado_en = case when o.fecha is distinct from new.fecha_vencimiento then null else o.completado_en end,
           fecha = new.fecha_vencimiento
     where o.id = new.obligacion_id;
    if found then
      return new;
    end if;
  end if;

  insert into public.obligaciones (user_id, empresa_id, titulo, descripcion, categoria, fecha, origen, regla, anio, plantilla)
  values (new.user_id, new.empresa_id, v_titulo, v_desc, 'societario', new.fecha_vencimiento, 'evento', null, null, null)
  returning id into new.obligacion_id;
  return new;
end;
$$;

create or replace function public.poderes_borrar_vencimiento()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.obligacion_id is not null
     and (tg_op = 'DELETE' or new.obligacion_id is distinct from old.obligacion_id) then
    delete from public.obligaciones where id = old.obligacion_id;
  end if;
  return null;
end;
$$;

-- Los triggers BEFORE corren en orden alfabético: primero el dueño, después el vencimiento.
drop trigger if exists poderes_10_dueno on public.poderes;
create trigger poderes_10_dueno
  before insert or update of empresa_id on public.poderes
  for each row execute function public.dueno_desde_empresa();

drop trigger if exists poderes_20_vencimiento on public.poderes;
create trigger poderes_20_vencimiento
  before insert or update on public.poderes
  for each row execute function public.poderes_sincronizar_vencimiento();

drop trigger if exists poderes_30_borrar_vencimiento on public.poderes;
create trigger poderes_30_borrar_vencimiento
  after update or delete on public.poderes
  for each row execute function public.poderes_borrar_vencimiento();

-- ─────────────────────────────────────────────────────────────────────────
-- 2. Archivo: metadatos de los documentos subidos
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists public.archivos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  tipo_documento text not null check (tipo_documento in (
    'estatuto', 'acta_asamblea', 'acta_directorio', 'poder', 'constancia_ruc',
    'certificado_tributario', 'libro_accionistas', 'balance', 'contrato',
    'identidad', 'comprobante_inscripcion', 'otro'
  )),
  detalle text,
  titulo text not null,                     -- la parte "DOCUMENTO" del nombre
  fecha_documento date not null,
  storage_path text not null unique,
  nombre_archivo text not null,             -- "EMPRESA - DOCUMENTO (FECHA).ext"
  mime text,
  tamano bigint check (tamano is null or tamano >= 0),
  subido_por uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  -- La ruta en Storage siempre es <dueño>/<empresa>/…, igual que la que
  -- validan las políticas del bucket.
  constraint archivos_ruta_valida check (storage_path like user_id::text || '/' || empresa_id::text || '/%')
);

create index if not exists archivos_empresa_idx on public.archivos (empresa_id, fecha_documento desc);
create index if not exists archivos_user_idx on public.archivos (user_id);

alter table public.archivos enable row level security;
drop policy if exists "archivos: dueño o equipo" on public.archivos;
create policy "archivos: dueño o equipo" on public.archivos
  for all using (public.puede_acceder(user_id)) with check (public.puede_acceder(user_id));

drop trigger if exists archivos_10_dueno on public.archivos;
create trigger archivos_10_dueno
  before insert or update of empresa_id on public.archivos
  for each row execute function public.dueno_desde_empresa();

-- ─────────────────────────────────────────────────────────────────────────
-- 3. Storage: bucket privado `archivo`
-- ─────────────────────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'archivo',
  'archivo',
  false,
  20971520, -- 20 MB
  array[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ]
)
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- ¿Quien llama puede acceder al objeto `nombre` del bucket? La primera
-- carpeta es el user_id del dueño: se aplica public.puede_acceder sobre ella.
-- Si la carpeta no es un uuid devuelve false (en vez de fallar el cast).
create or replace function public.archivo_puede_acceder(nombre text)
returns boolean
language sql
stable
set search_path = public
as $$
  select case
    when (storage.foldername(nombre))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then public.puede_acceder(((storage.foldername(nombre))[1])::uuid)
    else false
  end;
$$;

-- Al subir, además, la segunda carpeta tiene que ser una empresa de ese dueño.
create or replace function public.archivo_puede_subir(nombre text)
returns boolean
language sql
stable
set search_path = public
as $$
  select public.archivo_puede_acceder(nombre)
     and exists (
       select 1 from public.empresas e
        where e.id::text = (storage.foldername(nombre))[2]
          and e.user_id::text = (storage.foldername(nombre))[1]
     );
$$;

grant execute on function public.archivo_puede_acceder(text) to authenticated;
grant execute on function public.archivo_puede_subir(text) to authenticated;

drop policy if exists "archivo: leer" on storage.objects;
create policy "archivo: leer" on storage.objects
  for select to authenticated
  using (bucket_id = 'archivo' and public.archivo_puede_acceder(name));

drop policy if exists "archivo: subir" on storage.objects;
create policy "archivo: subir" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'archivo' and public.archivo_puede_subir(name));

drop policy if exists "archivo: modificar" on storage.objects;
create policy "archivo: modificar" on storage.objects
  for update to authenticated
  using (bucket_id = 'archivo' and public.archivo_puede_acceder(name))
  with check (bucket_id = 'archivo' and public.archivo_puede_subir(name));

drop policy if exists "archivo: borrar" on storage.objects;
create policy "archivo: borrar" on storage.objects
  for delete to authenticated
  using (bucket_id = 'archivo' and public.archivo_puede_acceder(name));

notify pgrst, 'reload schema';
