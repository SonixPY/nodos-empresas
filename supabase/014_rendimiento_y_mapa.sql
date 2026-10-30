-- ═══════════════════════════════════════════════════════════════════════════
-- NODOS · Rendimiento de la base y mapa de módulos (Finanzas 028 = Empresas 014)
--
-- Qué hace (no cambia datos ni permisos, se puede correr más de una vez):
--   1. Índices por user_id en las 14 tablas que no tenían y en las claves
--      foráneas que se usan para filtrar o para borrar en cascada.
--   2. RLS: las MISMAS reglas, escritas para que Postgres calcule
--      auth.uid() e is_admin() una vez por consulta y no una vez por fila
--      (recomendación de Supabase). En las tablas de Empresas, el dueño entra
--      sin llamar a puede_acceder() fila por fila.
--   3. Descripción de cada tabla con su módulo (NODOS · Cuentas, Finanzas,
--      Empresas, Panel, Práctica, Cobros), visible en Supabase → Table Editor.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1. Índices ─────────────────────────────────────────────────────────────
create index if not exists trades_user_id_idx               on public.trades (user_id);
create index if not exists portfolio_purchases_user_id_idx  on public.portfolio_purchases (user_id);
create index if not exists tarjeta_ciclos_user_id_idx       on public.tarjeta_ciclos (user_id);
create index if not exists trackers_user_id_idx             on public.trackers (user_id);
create index if not exists investment_income_user_id_idx    on public.investment_income (user_id);
create index if not exists learn_xp_log_user_id_idx         on public.learn_xp_log (user_id);
create index if not exists empresas_user_id_idx             on public.empresas (user_id);
create index if not exists accionistas_user_id_idx          on public.accionistas (user_id);
create index if not exists movimientos_acciones_user_id_idx on public.movimientos_acciones (user_id);
create index if not exists documentos_user_id_idx           on public.documentos (user_id);
create index if not exists perfil_seprelad_user_id_idx      on public.perfil_seprelad (user_id);
create index if not exists eventos_entidad_user_id_idx      on public.eventos_entidad (user_id);
create index if not exists ro_generaciones_user_id_idx      on public.ro_generaciones (user_id);
create index if not exists ro_reglas_empresa_user_id_idx    on public.ro_reglas_empresa (user_id);

-- Claves foráneas usadas en filtros (espacio de un movimiento, socio
-- vinculado, eventos por accionista, espacio de una empresa) y en cascadas.
create index if not exists expenses_espacio_id_idx                 on public.expenses (espacio_id);
create index if not exists ingresos_espacio_id_idx                 on public.ingresos (espacio_id);
create index if not exists espacios_empresa_id_idx                 on public.espacios (empresa_id);
create index if not exists accionistas_usuario_vinculado_idx       on public.accionistas (usuario_vinculado);
create index if not exists eventos_entidad_accionista_id_idx       on public.eventos_entidad (accionista_id);
create index if not exists movimientos_acciones_de_accionista_idx  on public.movimientos_acciones (de_accionista_id);
create index if not exists movimientos_acciones_a_accionista_idx   on public.movimientos_acciones (a_accionista_id);
create index if not exists beneficiarios_finales_accionista_id_idx on public.beneficiarios_finales (accionista_id);
create index if not exists invitaciones_accionista_empresa_id_idx  on public.invitaciones_accionista (empresa_id);
create index if not exists poderes_documento_id_idx                on public.poderes (documento_id);
create index if not exists poderes_obligacion_id_idx               on public.poderes (obligacion_id);
create index if not exists administradores_obligacion_id_idx       on public.administradores (obligacion_id);
create index if not exists pagos_plan_id_idx                       on public.pagos (plan_id);
create index if not exists suscripciones_plan_id_idx               on public.suscripciones (plan_id);

-- ─── 2. RLS: mismas reglas, evaluadas una vez por consulta ──────────────────
-- Reescribe solo el texto de USING / WITH CHECK de las políticas de public:
--   auth.uid()             → (select auth.uid())
--   is_admin()             → (select is_admin())
--   puede_acceder(user_id) → ((select auth.uid()) = user_id or puede_acceder(user_id))
--     (puede_acceder ya devuelve true para el dueño: es la misma regla).
-- Las expresiones ya reescritas no se vuelven a tocar (correr dos veces no
-- cambia nada). ALTER POLICY conserva el nombre, el comando y los roles.
create or replace function pg_temp.nodos_rls_optimizada(e text) returns text
language sql immutable as $$
  select regexp_replace(
           regexp_replace(
             regexp_replace(e,
               '(?<!SELECT )auth\.uid\(\)', '( SELECT auth.uid() AS uid)', 'g'),
             '(?<!SELECT )(?<!SELECT public\.)(public\.)?is_admin\(\)', '( SELECT public.is_admin() AS is_admin)', 'g'),
           '(?<!OR )puede_acceder\(user_id\)', '((( SELECT auth.uid() AS uid) = user_id) OR puede_acceder(user_id))', 'g')
$$;

do $$
declare
  p record;
  usar text;
  chequear text;
  n int := 0;
begin
  for p in
    select c.relname tabla, pol.polname nombre,
           pg_get_expr(pol.polqual, pol.polrelid) q,
           pg_get_expr(pol.polwithcheck, pol.polrelid) w
    from pg_policy pol
    join pg_class c on c.oid = pol.polrelid
    join pg_namespace ns on ns.oid = c.relnamespace
    where ns.nspname = 'public'
  loop
    usar := case when p.q is null then null else pg_temp.nodos_rls_optimizada(p.q) end;
    chequear := case when p.w is null then null else pg_temp.nodos_rls_optimizada(p.w) end;
    if usar is distinct from p.q or chequear is distinct from p.w then
      -- format() con un nulo devuelve '', no nulo: se arma cada parte aparte.
      execute format('alter policy %I on public.%I', p.nombre, p.tabla)
        || case when usar is null then '' else format(' using (%s)', usar) end
        || case when chequear is null then '' else format(' with check (%s)', chequear) end;
      n := n + 1;
    end if;
  end loop;
  raise notice 'Políticas optimizadas: %', n;
end $$;

-- ─── 3. Mapa de módulos (descripción de cada tabla) ─────────────────────────
do $$
declare
  m record;
begin
  for m in
    select * from (values
      -- Cuentas (las tres páginas)
      ('profiles', 'NODOS · Cuentas: perfil, rol y acceso por app (solo lo escribe el servidor).'),
      ('intentos_ingreso', 'NODOS · Cuentas: intentos fallidos de ingreso (freno a la fuerza bruta).'),
      ('preferencias', 'NODOS · Cuentas: preferencias de la cuenta.'),
      -- Cobros
      ('planes', 'NODOS · Cobros: planes y precios.'),
      ('suscripciones', 'NODOS · Cobros: plan vigente de cada cuenta.'),
      ('pagos', 'NODOS · Cobros: pagos (Polar y manuales).'),
      ('eventos_pago', 'NODOS · Cobros: bitácora inmutable de eventos de pago.'),
      -- Finanzas
      ('trades', 'NODOS · Finanzas: bitácora de trading.'),
      ('portfolio_purchases', 'NODOS · Finanzas: compras y ventas del portafolio digital.'),
      ('portfolio_layout', 'NODOS · Finanzas: orden del portafolio.'),
      ('digital_distributions', 'NODOS · Finanzas: distribuciones de inversiones digitales.'),
      ('expenses', 'NODOS · Finanzas: gastos (personales o de un espacio de entidad).'),
      ('ingresos', 'NODOS · Finanzas: ingresos (personales o de un espacio de entidad).'),
      ('monthly_income', 'NODOS · Finanzas: sueldo mensual.'),
      ('espacios', 'NODOS · Finanzas: espacios de movimientos (personal y por entidad).'),
      ('tarjeta_ciclos', 'NODOS · Finanzas: ciclos de tarjeta de crédito.'),
      ('investment_income', 'NODOS · Finanzas: rentas de inversiones.'),
      ('trackers', 'NODOS · Finanzas: inversiones tradicionales (tablas editables).'),
      ('tracker_columns', 'NODOS · Finanzas: columnas de cada tracker.'),
      ('tracker_rows', 'NODOS · Finanzas: filas de cada tracker.'),
      ('tracker_templates', 'NODOS · Finanzas: plantillas de trackers.'),
      ('config_lists', 'NODOS · Finanzas: listas configurables (activos, categorías, sesiones).'),
      ('config_lists_sembradas', 'NODOS · Finanzas: marca de listas iniciales ya creadas.'),
      ('calculator_prefs', 'NODOS · Finanzas: preferencias de las calculadoras.'),
      ('resumen_layout', 'NODOS · Finanzas: orden del Resumen.'),
      ('trading_layout', 'NODOS · Finanzas: orden de Trading.'),
      -- Práctica
      ('practica_contenido', 'NODOS · Práctica: contenido editable desde el Panel.'),
      ('practica_partidas', 'NODOS · Práctica: partidas del simulador.'),
      ('learn_progress', 'NODOS · Práctica: progreso de lecciones.'),
      ('learn_xp_log', 'NODOS · Práctica: puntos ganados (liga semanal).'),
      -- Empresas
      ('empresas', 'NODOS · Empresas: sociedades, unipersonales y RUC personal.'),
      ('accionistas', 'NODOS · Empresas: accionistas y socios.'),
      ('movimientos_acciones', 'NODOS · Empresas: aportes y cesiones de acciones.'),
      ('beneficiarios_finales', 'NODOS · Empresas: beneficiarios finales (SIARA).'),
      ('administradores', 'NODOS · Empresas: administradores (SIARA).'),
      ('poderes', 'NODOS · Empresas: poderes otorgados.'),
      ('documentos', 'NODOS · Empresas: documentos generados.'),
      ('archivos', 'NODOS · Empresas: archivos subidos (Storage).'),
      ('obligaciones', 'NODOS · Empresas: vencimientos y obligaciones.'),
      ('perfil_seprelad', 'NODOS · Empresas: perfil SEPRELAD de cada empresa.'),
      ('ro_generaciones', 'NODOS · Empresas: auditoría de generaciones del RO.'),
      ('ro_reglas_empresa', 'NODOS · Empresas: reglas del RO por empresa.'),
      ('invitaciones_accionista', 'NODOS · Empresas ↔ Finanzas: invitaciones para vincular socios.'),
      ('eventos_entidad', 'NODOS · Empresas ↔ Finanzas: dividendos y eventos publicados a socios.'),
      -- Panel (solo administradores)
      ('leads', 'NODOS · Panel: consultas y leads.'),
      ('lead_actividades', 'NODOS · Panel: actividad de cada lead.'),
      ('contenido', 'NODOS · Panel: calendario de contenido.'),
      ('notas_nodos', 'NODOS · Panel: notas NODOS.'),
      ('obligaciones_descartadas_010', 'NODOS · Respaldo de la migración Empresas 010 (se puede borrar cuando no haga falta).')
    ) as t(tabla, texto)
  loop
    if to_regclass('public.' || m.tabla) is not null then
      execute format('comment on table public.%I is %L', m.tabla, m.texto);
    end if;
  end loop;
end $$;

notify pgrst, 'reload schema';
