-- ═════════════════════════════════════════════════════════════════════════
-- NODOS Panel (centro de comandos): leads/CRM, actividades y calendario de
-- contenido. Solo lo ven y editan los administradores.
-- Orden: 000 → 001 → 002 → este archivo. Idempotente.
-- ═════════════════════════════════════════════════════════════════════════

-- 1. Leads ----------------------------------------------------------------
create table if not exists leads (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  nombre text not null,
  email text,
  telefono text,
  empresa text,
  tema text not null default 'otro'
    check (tema in ('cripto-compliance', 'empresa-familiar', 'finanzas', 'apps', 'otro')),
  mensaje text,
  origen text not null default 'sitio'
    check (origen in ('sitio', 'whatsapp', 'instagram', 'tiktok', 'youtube', 'email', 'referido', 'evento', 'otro')),
  etapa text not null default 'nuevo'
    check (etapa in ('nuevo', 'contactado', 'calificado', 'propuesta', 'cliente', 'descartado')),
  prioridad smallint not null default 2 check (prioridad between 1 and 3),
  proximo_seguimiento date,
  valor_estimado numeric,
  consentimiento boolean not null default false,
  -- Hash del IP (no el IP) para frenar spam del formulario público.
  ip_hash text,
  creado_por uuid references auth.users(id) on delete set null default auth.uid()
);
create index if not exists leads_etapa_idx on leads (etapa, created_at desc);
create index if not exists leads_seguimiento_idx on leads (proximo_seguimiento) where proximo_seguimiento is not null;
create index if not exists leads_ip_idx on leads (ip_hash, created_at desc);

-- 2. Actividades de cada lead (notas, llamadas, cambios de etapa) -----------
create table if not exists lead_actividades (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references leads(id) on delete cascade,
  created_at timestamptz not null default now(),
  tipo text not null default 'nota'
    check (tipo in ('nota', 'llamada', 'email', 'whatsapp', 'reunion', 'etapa', 'sistema')),
  texto text not null,
  autor uuid references auth.users(id) on delete set null default auth.uid()
);
create index if not exists lead_actividades_lead_idx on lead_actividades (lead_id, created_at desc);

-- 3. Calendario de contenido ----------------------------------------------
create table if not exists contenido (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  titulo text not null,
  pilar text not null check (pilar in ('zona-gris', 'decodificado', 'bajo-lupa', 'otro')),
  -- Los cortes (Decodificado, Bajo Lupa) apuntan al episodio de Zona Gris del que salen.
  episodio_id uuid references contenido(id) on delete set null,
  estado text not null default 'idea'
    check (estado in ('idea', 'guion', 'grabado', 'editado', 'programado', 'publicado')),
  fecha date,
  redes text[] not null default '{}',
  links jsonb not null default '{}'::jsonb,
  notas text,
  creado_por uuid references auth.users(id) on delete set null default auth.uid()
);
create index if not exists contenido_fecha_idx on contenido (fecha);

-- 4. updated_at automático ------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
drop trigger if exists leads_touch on leads;
create trigger leads_touch before update on leads for each row execute procedure public.touch_updated_at();
drop trigger if exists contenido_touch on contenido;
create trigger contenido_touch before update on contenido for each row execute procedure public.touch_updated_at();

-- 5. RLS: solo administradores (el formulario público entra por el servidor) --
do $$
declare t text;
begin
  foreach t in array array['leads', 'lead_actividades', 'contenido']
  loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists %I on %I', t || ': admin', t);
    execute format('create policy %I on %I for all using (public.is_admin()) with check (public.is_admin())', t || ': admin', t);
  end loop;
end $$;

grant select, insert, update, delete on leads, lead_actividades, contenido to authenticated;

notify pgrst, 'reload schema';
