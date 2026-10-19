-- ═════════════════════════════════════════════════════════════════════════
-- NODOS Empresas · Correcciones de la auditoría del 01/10/2026. Idempotente:
-- se puede correr más de una vez. Correr después de 009_seguridad.sql.
--
-- 1. Vencimientos SEPRELAD que nacieron atrasados. El calendario SEPRELAD
--    generaba el año completo aunque el perfil se cargara en octubre:
--    quedaban obligaciones con fecha anterior al día en que se crearon
--    (p. ej. "4.º trim. 2025"), que se veían como "atrasados". La app ya no
--    las genera (solo desde hoy, o desde la inscripción si es posterior).
--
--    Por qué se borran en vez de cambiarles el estado: `estado` solo admite
--    'pendiente' o 'hecho', y marcarlas 'hecho' registraría un cumplimiento
--    que nunca existió (inadmisible en una herramienta de compliance).
--    Se borran solo las que cumplen TODO esto:
--      · categoría 'seprelad' y origen 'calendario' (las crea el generador
--        automático y siempre llevan `regla`);
--      · estado 'pendiente' (lo que alguien marcó como hecho no se toca);
--      · fecha anterior al día en que se creó la fila (hora de Paraguay) o
--        anterior a la fecha de inscripción en SEPRELAD, si es posterior.
--    Nunca toca vencimientos cargados a mano (origen 'manual') ni los que
--    crea un hecho registrado (origen 'evento').
--
--    Antes de borrar, cada fila se copia a `obligaciones_descartadas_010`
--    (sin acceso desde la app: RLS sin políticas, solo SQL Editor o service
--    role). Si hiciera falta recuperar alguna, está ahí. Se borra sola si se
--    elimina la empresa o la cuenta.
--
-- 2. Archivos huérfanos en Storage: desde esta versión la app borra la
--    carpeta del bucket `archivo` al eliminar una empresa o una cuenta. Los
--    que quedaron de antes NO se borran desde SQL (Supabase no permite borrar
--    archivos tocando storage.objects). Consulta de solo lectura al final.
-- ═════════════════════════════════════════════════════════════════════════

-- 1. Vencimientos SEPRELAD nacidos atrasados ---------------------------------
do $$
declare
  copiadas integer;
  borradas integer;
begin
  if to_regclass('public.obligaciones') is null then
    raise notice 'No existe la tabla obligaciones: nada que limpiar.';
    return;
  end if;

  -- Respaldo con la misma forma que obligaciones + cuándo se descartó.
  if to_regclass('public.obligaciones_descartadas_010') is null then
    execute 'create table public.obligaciones_descartadas_010 as
               select o.*, now() as descartada_el from public.obligaciones o where false';
    execute 'alter table public.obligaciones_descartadas_010 add primary key (id)';
    execute 'alter table public.obligaciones_descartadas_010
               add foreign key (user_id) references auth.users(id) on delete cascade';
    execute 'alter table public.obligaciones_descartadas_010
               add foreign key (empresa_id) references public.empresas(id) on delete cascade';
  end if;
  execute 'alter table public.obligaciones_descartadas_010 enable row level security';
  execute 'revoke all on public.obligaciones_descartadas_010 from anon, authenticated';

  create temporary table _a_descartar on commit drop as
  select o.id
  from public.obligaciones o
  left join public.perfil_seprelad p on p.empresa_id = o.empresa_id
  where o.categoria = 'seprelad'
    and o.origen = 'calendario'
    and o.regla is not null
    and o.estado = 'pendiente'
    and o.fecha < greatest(
          (o.created_at at time zone 'America/Asuncion')::date,
          coalesce(p.fecha_inscripcion, '-infinity'::date)
        );

  insert into public.obligaciones_descartadas_010
  select o.*, now()
  from public.obligaciones o
  join _a_descartar d on d.id = o.id
  on conflict (id) do nothing;
  get diagnostics copiadas = row_count;

  delete from public.obligaciones o
  using _a_descartar d
  where d.id = o.id;
  get diagnostics borradas = row_count;

  raise notice 'Vencimientos SEPRELAD nacidos atrasados: % copiados al respaldo, % borrados.', copiadas, borradas;
end $$;

-- 2. Archivos huérfanos (solo lectura, opcional) ------------------------------
-- Descomentá y corré por separado para listar archivos del bucket `archivo`
-- cuya empresa ya no existe; se borran desde Storage en el panel:
--
-- select o.name, o.created_at
-- from storage.objects o
-- where o.bucket_id = 'archivo'
--   and not exists (
--     select 1 from public.empresas e
--     where e.id::text = (storage.foldername(o.name))[2]
--   )
-- order by o.name;

notify pgrst, 'reload schema';
