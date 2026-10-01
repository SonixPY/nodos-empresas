-- ═════════════════════════════════════════════════════════════════════════
-- NODOS Empresas: base compartida del equipo NODOS. Idempotente.
-- Correr después de 004_usuario.sql.
--
-- Antes: cada cuenta veía lo suyo y un admin podía LEER todo (también lo de
-- los clientes, mezclado en sus listas) pero no editar lo de otro admin.
-- Ahora:
--   · Los datos cargados por cualquier administrador forman una sola base del
--     equipo: todos los admins la ven y la editan.
--   · Los datos de cada cliente (cuenta no admin) los ve y edita solo ese
--     cliente. Los admins gestionan cuentas y permisos desde /admin.
-- El Panel (leads, actividades, contenido) ya era una sola base para admins.
-- ═════════════════════════════════════════════════════════════════════════

-- ¿Quien llama puede ver/editar una fila cuyo dueño es `dueno`?
create or replace function public.puede_acceder(dueno uuid)
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select auth.uid() = dueno
      or (
        public.is_admin()
        and coalesce((select p.is_admin from public.profiles p where p.id = dueno), false)
      );
$$;

grant execute on function public.puede_acceder(uuid) to authenticated;

do $$
declare
  t text;
begin
  foreach t in array array['empresas', 'accionistas', 'movimientos_acciones', 'obligaciones', 'documentos', 'perfil_seprelad']
  loop
    if to_regclass('public.' || t) is not null then
      execute format('drop policy if exists %I on %I', t || ': dueño', t);
      execute format('drop policy if exists %I on %I', t || ': dueño o equipo', t);
      execute format(
        'create policy %I on %I for all using (public.puede_acceder(user_id)) with check (public.puede_acceder(user_id))',
        t || ': dueño o equipo', t
      );
    end if;
  end loop;
end $$;

notify pgrst, 'reload schema';
