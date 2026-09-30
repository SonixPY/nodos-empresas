# Nodos Empresas

Gobierno corporativo para empresas familiares de Paraguay: el orden legal de
la empresa en un solo lugar. Parte de la marca **Nodos**.

- **Resumen**: próximos vencimientos, atrasados y alertas por empresa
  (calendario sin generar, mandato de autoridades por vencer).
- **Empresas**: S.A., EAS y S.R.L. con tipo societario, RUC, domicilio, mes de
  cierre y vencimiento del mandato.
- **Libro de accionistas**: tenencias, % de capital y de votos, alerta de
  posibles beneficiarios finales (≥10% del capital o >25% de los votos, Ley
  6446/2019) y registro de movimientos (compraventa, herencia, donación,
  suscripción). Cada transferencia descuenta y suma acciones en una sola
  operación y crea los vencimientos de comunicación.
- **Vencimientos**: calendario anual automático según el tipo de sociedad y el
  mes de cierre (asamblea, edicto, comunicación a la DGPEJBF, actualización de
  beneficiarios finales al 30 de junio, etc.) + tareas propias.
- **Documentos**: generador con las plantillas de Nodos Empresas (actas de
  Directorio y Asamblea, edicto, registro de asistencia, carta poder, EAS,
  contratación de familiares). Datos precargados desde la empresa y el libro
  de accionistas, vista previa en vivo, descarga en Word y PDF, historial.
- **Admin**: listado y baja de cuentas (solo administradores).

Todo documento lleva el aviso de que es material informativo y no reemplaza
el asesoramiento profesional.

## Stack

Next.js 16 (App Router) · Supabase (Postgres + Auth + RLS) · Tailwind CSS 4 ·
Vercel. Paleta y tipografías de nodoscompliance.com.

## Puesta en marcha

### 1. Supabase (proyecto nuevo)

1. Creá un proyecto nuevo en [supabase.com](https://supabase.com/). No uses el
   de la app de finanzas: el esquema es distinto.
2. **SQL Editor → New query**: pegá y corré entero
   [`supabase/001_schema.sql`](./supabase/001_schema.sql).
3. **Project Settings → API**: copiá Project URL, anon key y service_role key.
4. (Opcional) **Authentication → Providers → Email**: desactivá "Confirm email"
   si querés que las cuentas nuevas entren sin confirmar el correo.

### 2. Variables de entorno

```bash
cp .env.local.example .env.local
```

Completá `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` y
`SUPABASE_SERVICE_ROLE_KEY`.

### 3. Local

```bash
npm install
npm run dev
```

Abrí `http://localhost:3000`, creá tu cuenta en `/signup` y después corré en
el SQL Editor la sección **ADMIN** del final de `001_schema.sql` con tu email
para marcarte como administrador.

### 4. Deploy en Vercel

1. Subí esta carpeta a un repositorio **nuevo** de GitHub.
2. Vercel → Add New → Project → importá el repo.
3. Cargá las 3 variables de entorno de producción.
4. Deploy. En Settings → Domains podés usar, por ejemplo,
   `empresas.nodoscompliance.com`.

## Cómo está organizado

| Carpeta | Qué hay |
|---|---|
| `src/lib/calendario.ts` | Reglas del calendario anual y vencimientos por transferencia de acciones, con su base legal |
| `src/lib/plantillas.ts` | Las plantillas del generador (campos + texto) |
| `src/lib/accionistas.ts` | Cálculo de participaciones y alerta de beneficiarios finales |
| `src/lib/letras.ts` | Números y fechas en letras para actas |
| `src/lib/dates.ts` | Fechas sin corrimientos de zona horaria y días hábiles (fines de semana, feriados fijos y Semana Santa) |
| `src/lib/data.ts` | Consultas a Supabase |
| `supabase/001_schema.sql` | Tablas, RLS por usuario y función de transferencia atómica |

### Agregar una plantilla

En `src/lib/plantillas.ts`, definí un objeto `Plantilla` (campos + `render`) y
sumalo a `PLANTILLAS`. Para que aparezca como acceso directo desde un
vencimiento, poné su `key` en la propiedad `plantilla` de la regla en
`calendario.ts`.

## Límites conocidos (v1)

- Los días hábiles descuentan fines de semana, feriados fijos y Semana Santa,
  pero no los feriados trasladables: los plazos son una referencia.
- La alerta de beneficiario final aplica solo criterios objetivos de
  participación; no evalúa control ni cadenas societarias.
- Si cambiás el tipo societario o el mes de cierre de una empresa, borrá los
  vencimientos automáticos pendientes y volvé a generar el calendario.
- Las plantillas son la versión v1, pendiente de revisión profesional.
