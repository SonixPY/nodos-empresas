-- NODOS · Series de videos de nodoscompliance.com (Empresas 016)
-- Idempotente: se puede correr más de una vez sin cambiar nada.
-- Se editan desde Panel → Series (solo administradores). El sitio las lee por
-- empresas.nodoscompliance.com/api/public/series, que entrega solo lo publicado.
-- Los episodios viven en un JSON ordenado: [{"titulo": "...", "url": "https://..."}].

create table if not exists public.series (
  id uuid primary key default gen_random_uuid(),
  numero integer not null,
  titulo text not null,
  descripcion text not null default '',
  duracion text not null default '10 min aprox.',
  url text,
  episodios jsonb not null default '[]'::jsonb,
  estado text not null default 'borrador',
  actualizado_por uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint series_numero check (numero between 1 and 999),
  constraint series_titulo check (char_length(titulo) between 2 and 120),
  constraint series_descripcion check (char_length(descripcion) <= 600),
  constraint series_duracion check (char_length(duracion) <= 40),
  constraint series_url check (url is null or url ~ '^https://'),
  constraint series_estado check (estado in ('borrador', 'publicado')),
  constraint series_episodios check (jsonb_typeof(episodios) = 'array' and jsonb_array_length(episodios) <= 60),
  constraint series_tamano check (pg_column_size(episodios) < 60000)
);
comment on table public.series is 'NODOS · Series de videos del sitio, editables desde el Panel.';
create unique index if not exists series_numero_unico on public.series (numero);

alter table public.series enable row level security;
drop policy if exists "series: leer publicado" on public.series;
create policy "series: leer publicado" on public.series
  for select using (estado = 'publicado' or public.is_admin());
drop policy if exists "series: admin escribe" on public.series;
create policy "series: admin escribe" on public.series
  for insert with check (public.is_admin());
drop policy if exists "series: admin edita" on public.series;
create policy "series: admin edita" on public.series
  for update using (public.is_admin()) with check (public.is_admin());
drop policy if exists "series: admin borra" on public.series;
create policy "series: admin borra" on public.series
  for delete using (public.is_admin());

drop trigger if exists series_touch on public.series;
create trigger series_touch before update on public.series
  for each row execute function public.touch_updated_at();

revoke all on public.series from anon;
grant select, insert, update, delete on public.series to authenticated;

-- Serie 01, tal como está hoy en el sitio (10 episodios por publicar).
-- Solo se crea si todavía no existe: nunca pisa lo que se edite en el Panel.
insert into public.series (numero, titulo, descripcion, duracion, url, episodios, estado)
select 1,
       'Opciones de ahorro en Paraguay',
       'Qué opciones de ahorro existen en Paraguay, cómo funciona cada una y qué conviene preguntar antes de elegir.',
       '10 min aprox.',
       'https://www.youtube.com/@NodosCompliance',
       (select jsonb_agg(jsonb_build_object('titulo', '', 'url', '')) from generate_series(1, 10)),
       'publicado'
where not exists (select 1 from public.series where numero = 1);
