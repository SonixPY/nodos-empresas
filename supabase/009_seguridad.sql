-- ═════════════════════════════════════════════════════════════════════════
-- NODOS · Arreglos de seguridad (01/10/2026). Idempotente. Archivo idéntico
-- en finanzas-app (023_seguridad.sql) y nodos-empresas (009_seguridad.sql).
--
-- 1. Perfiles: nadie puede modificar su propio perfil desde el navegador
--    (evita que un usuario se haga administrador) ni listar los perfiles
--    de los demás (evita ver emails ajenos). Los cambios de perfil pasan por
--    el servidor (API de cuenta y de administración).
-- 2. Finanzas: los datos personales (gastos, portafolio, trading, trackers,
--    aprender, layouts...) los ve solo su dueño. Antes un admin los leía y
--    podía borrarlos, mezclados con los suyos. La administración de cuentas
--    no se ve afectada (usa el servidor).
-- 3. Empresas: accionistas, movimientos, vencimientos, documentos y perfil
--    SEPRELAD quedan siempre a nombre del dueño de la empresa, y solo se
--    pueden cargar en empresas a las que quien carga tiene acceso.
-- ═════════════════════════════════════════════════════════════════════════

-- 1. Perfiles ---------------------------------------------------------------
drop policy if exists "profiles: update propio" on public.profiles;
drop policy if exists "profiles: select logueados" on public.profiles;
drop policy if exists "profiles: select propio o admin" on public.profiles;
create policy "profiles: select propio o admin" on public.profiles
  for select using (auth.uid() = id or public.is_admin());

-- Cualquier otra política de UPDATE/INSERT/DELETE sobre profiles que haya
-- quedado de versiones viejas se elimina: solo escribe el servidor.
do $$
declare
  p record;
begin
  for p in
    select policyname from pg_policies
    where schemaname = 'public' and tablename = 'profiles' and cmd in ('UPDATE', 'INSERT', 'DELETE', 'ALL')
  loop
    execute format('drop policy if exists %I on public.profiles', p.policyname);
  end loop;
end $$;

-- 2. Finanzas: datos personales solo para su dueño -----------------------------
do $$
declare
  p record;
begin
  for p in
    select tablename, policyname, cmd
    from pg_policies
    where schemaname = 'public'
      and tablename not in ('profiles', 'tracker_columns', 'tracker_rows')
      and qual ilike '%is_admin()%'
      and qual ilike '%user_id%'
      and qual not ilike '%puede_acceder%'
  loop
    execute format('drop policy if exists %I on public.%I', p.policyname, p.tablename);
    if p.cmd = 'SELECT' then
      execute format('create policy %I on public.%I for select using (auth.uid() = user_id)', p.policyname, p.tablename);
    elsif p.cmd = 'INSERT' then
      execute format('create policy %I on public.%I for insert with check (auth.uid() = user_id)', p.policyname, p.tablename);
    else
      execute format(
        'create policy %I on public.%I for %s using (auth.uid() = user_id) with check (auth.uid() = user_id)',
        p.policyname, p.tablename, lower(p.cmd)
      );
    end if;
  end loop;
end $$;

do $$
begin
  if to_regclass('public.tracker_columns') is not null then
    drop policy if exists "tracker_columns: dueño" on public.tracker_columns;
    create policy "tracker_columns: dueño" on public.tracker_columns
      for all using (
        exists (select 1 from public.trackers t where t.id = tracker_columns.tracker_id and t.user_id = auth.uid())
      ) with check (
        exists (select 1 from public.trackers t where t.id = tracker_columns.tracker_id and t.user_id = auth.uid())
      );
  end if;
  if to_regclass('public.tracker_rows') is not null then
    drop policy if exists "tracker_rows: dueño" on public.tracker_rows;
    create policy "tracker_rows: dueño" on public.tracker_rows
      for all using (
        exists (select 1 from public.trackers t where t.id = tracker_rows.tracker_id and t.user_id = auth.uid())
      ) with check (
        exists (select 1 from public.trackers t where t.id = tracker_rows.tracker_id and t.user_id = auth.uid())
      );
  end if;
end $$;

-- 3. Empresas: el dueño de cada fila es el dueño de la empresa ---------------
-- dueno_desde_empresa() (creada en 006_documentos.sql) lee la empresa con los
-- permisos de quien carga: si no la puede ver, la carga se rechaza.
do $$
declare
  t text;
begin
  if to_regprocedure('public.dueno_desde_empresa()') is null then
    raise notice 'Falta 006_documentos.sql: se omite el paso 3.';
    return;
  end if;
  foreach t in array array['accionistas', 'movimientos_acciones', 'obligaciones', 'documentos', 'perfil_seprelad']
  loop
    if to_regclass('public.' || t) is not null then
      -- Datos existentes: pasan a nombre del dueño de la empresa.
      execute format(
        'update public.%I x set user_id = e.user_id from public.empresas e where e.id = x.empresa_id and x.user_id <> e.user_id',
        t
      );
      execute format('drop trigger if exists %I on public.%I', t || '_00_dueno', t);
      execute format(
        'create trigger %I before insert or update of empresa_id, user_id on public.%I for each row execute function public.dueno_desde_empresa()',
        t || '_00_dueno', t
      );
    end if;
  end loop;
end $$;

notify pgrst, 'reload schema';
