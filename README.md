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

## Cuentas NODOS (compartidas)

Finanzas y Empresas usan **el mismo proyecto de Supabase** (el de Finanzas):
una sola cuenta sirve para las dos apps, y en producción la sesión se guarda
en una cookie de `.nodoscompliance.com`, así que ingresar en una deja la otra
abierta. El panel `/admin` (igual en las dos apps) maneja rol de
administrador, acceso por app, suspensión, email y recuperación de clave.

## Puesta en marcha

1. En el SQL Editor del proyecto Supabase compartido, correr en orden:
   `000_cuentas_nodos.sql` → `001_schema.sql` → `002_seprelad.sql`
   (todos idempotentes). Finanzas además corre su `021_nodos_v18.sql`.
2. Variables de entorno (Vercel y `.env.local`): `NEXT_PUBLIC_SUPABASE_URL`,
   `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (o los
   nombres de la integración Supabase–Vercel) y, opcional,
   `NEXT_PUBLIC_SOPORTE_EMAIL`.
3. En Supabase → Authentication → URL Configuration, agregar
   `https://empresas.nodoscompliance.com/**` y
   `https://finanzas.nodoscompliance.com/**` a las Redirect URLs.
4. `npm install && npm run dev`.

## Cómo está organizado

| Carpeta | Qué hay |
|---|---|
| `src/lib/seprelad.ts` | Módulo SEPRELAD: sectores, reglas de calendario, hechos con plazo y principios, con su resolución |
| `src/lib/nodos/` | Código compartido con Finanzas (sitios, cuentas, admin) |
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
