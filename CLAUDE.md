@AGENTS.md

# NODOS · instrucciones del proyecto

Dueño: Mauricio Vaceque (maurivaceque@gmail.com, GitHub SonixPY). Responder siempre en español (Paraguay, voseo), breve y accionable. Estado, decisiones y pendientes: docs del Project "Nodos" en claude.ai (`claude/plataforma-nodos-v18.md`, `claude/auditoria-errores-2026-10-01.md`); leerlos al empezar en lugar de explorar el código a ciegas.

## Las tres páginas
| Sitio | Repo | Deploy |
|---|---|---|
| nodoscompliance.com (hub + `/ingresar`, HTML estático) | SonixPY/nodos | GitHub Pages |
| finanzas.nodoscompliance.com | SonixPY/finanzas-app | Vercel `finanzas-app` |
| empresas.nodoscompliance.com (incluye NODOS Panel `/panel` y API de cuentas `/api/cuenta/*`) | SonixPY/nodos-empresas | Vercel `nodos-empresas` |

- Next.js 16 (App Router, Turbopack, `src/proxy.ts` en lugar de middleware), React 19, Tailwind 4, lucide-react, Supabase con `@supabase/ssr`. Leer AGENTS.md antes de usar APIs de Next.
- **Un solo proyecto Supabase** para las dos apps: "Finanzas", ref `obkbjcaiucakevbcjjfe`. Sesión en cookie de `.nodoscompliance.com` (una cuenta para las tres páginas). En producción el único login es `nodoscompliance.com/ingresar`; `/login` local solo para localhost.
- `profiles`: nombre, usuario, is_admin, acceso_finanzas, acceso_empresas, suspendido. Los perfiles solo se escriben desde el servidor (service role).

## Archivos compartidos (idénticos en finanzas-app y nodos-empresas)
`src/lib/nodos/*` (salvo `app.ts`, que define APP_ID; incluye `practica.ts`), `src/components/nodos/*`, `src/proxy.ts`, `src/lib/supabase{Client,Server,Admin}.ts`, `src/app/api/admin/**`, `src/app/api/cuenta/**`, `src/app/auth/callback`, páginas `login`, `signup`, `recuperar`, `nueva-clave`, `soporte`, `sin-acceso`, `src/app/(app)/admin/*`, `src/app/(app)/cuenta/page.tsx`, `src/app/(app)/plan/page.tsx`, `src/app/api/admin/suscripciones/**`, `src/app/api/admin/planes/**`, `ToastProvider`, `Skeleton`, `Spinner`, `BulkDeleteBar`, `PageTransition`, `EmptyState`, `resumen/PrimerosPasos`, `supabase/000_cuentas_nodos.sql`, la migración de suscripciones (Empresas `011` = Finanzas `025`), la de la 1.0 (Empresas `012` = Finanzas `026`) y la de cuentas y planes (Empresas `013` = Finanzas `027`).
Si cambiás uno, copialo al otro repo y verificá con `cmp`. Nunca dejar que difieran.

## Reglas fijas del dueño
- **Base de datos:** Mauricio corre el SQL. Entregar SIEMPRE **un solo archivo .sql** idempotente, listo para pegar en Supabase → SQL Editor → Run, probado antes dos veces en Postgres local (base de prueba con `createdb -T t1`, que trae un `auth` simulado; stub de `storage` si hace falta). Guardar también la migración numerada en `supabase/` de cada repo afectado.
- **Sin emojis** en ninguna página: solo íconos de línea (lucide / SVG propios) en el estilo de la marca.
- Marca: Space Grotesk (títulos) + Inter (texto). Colores musgo #1e2f25, bosque #34483a, cobre #b8734a, cobre-hover #8c5934, marfil #f2eee6, carbón #242522. Radios 4/8/16.
- Todo contenido de inversión/cripto lleva "no es asesoría de inversión"; todo lo legal, "no constituye asesoramiento legal para tu caso". Nunca inventar normativa (SEPRELAD, GAFI, Ley 6446/2019, etc.): citar solo lo verificado.
- No usar documentos de clientes de Moralez Paoli en los productos. No ingresar contraseñas ni claves; las variables secretas las carga Mauricio en Vercel.
- Privacidad de noticias: a terceros solo se envían IDs de temas de una lista fija; nunca nombres de empresas, RUC ni personas.

## Verificar y publicar
1. `npx eslint src` y `npm run build` (en nodos-empresas sin `.env.local`: `NEXT_PUBLIC_SUPABASE_URL=https://placeholder.supabase.co NEXT_PUBLIC_SUPABASE_ANON_KEY=placeholder npm run build`).
2. UI nueva: capturas con Playwright (Python; Chromium ya instalado en /opt/pw-browsers, no correr `playwright install`) a 360 y 1280 px usando una página temporal bajo `src/app/soporte/` con datos de prueba; borrarla después junto con `.next/dev`. Apagar servidores con `fuser -k <puerto>/tcp`, nunca `pkill -f`.
3. Commit como `Claude <noreply@anthropic.com>` con los trailers de la sesión; push a `main` (Vercel y GitHub Pages publican solos).

## Este repo: NODOS Empresas + NODOS Panel (1.0)
Empresas (tipos S.A., EAS, S.R.L., unipersonal y RUC personal; ficha con Datos, Accionistas y SIARA solo en sociedades, Poderes, Archivo, Documentos, Vencimientos), vencimientos con calendario, generador de documentos (códigos SOC/POD/FAM/SEP, sin descarga Word), SEPRELAD (`/cumplimiento`, sectores inmobiliaria, OSFL, remesas y caudales) con generador del RO en `/cumplimiento/ro` (todo en el navegador, `src/lib/ro/*`, pruebas `npx tsx scripts/probar-ro.ts`; solo se guarda la auditoría en `ro_generaciones`), novedades (`/api/novedades`), Panel (leads, contenido, notas NODOS, suscripciones, Práctica) y la API de cuentas que usa `nodoscompliance.com/ingresar`.
Vínculo con Finanzas: socios conectados por invitación (`/vincular#t=…`, funciones `crear/aceptar_invitacion_accionista`), dividendos con IDU estimado publicados en `eventos_entidad`; aportes y cesiones se publican solos desde `movimientos_acciones`.
Migraciones `supabase/001…013` (012 = Finanzas 026, 013 = Finanzas 027, idénticas). Ficha sin Vencimientos ni Archivo propios: Documentos une lo generado y lo subido; el calendario está solo en `/vencimientos` (`?empresa=`). Planes públicos para el sitio en `/api/public/planes`; conectar socios requiere el Combo; RLS de equipo con `puede_acceder(user_id)` y trigger `dueno_desde_empresa()`.

## Suscripciones (v1)
Cobro con Polar (checkout alojado, webhooks firmados en `empresas…/api/pagos/webhook/polar`) + pagos manuales desde Panel → Suscripciones. Acceso decidido por `tiene_acceso_app(app)`; el proxy solo corta si `SUSCRIPCIONES_ACTIVAS=true` (falla abierto si la base no responde, nunca ante firmas inválidas). Tablas de cobro sin escritura desde el navegador; `eventos_pago` inmutable. Variables: `POLAR_ACCESS_TOKEN`, `POLAR_WEBHOOK_SECRET`, `POLAR_SERVER` (solo Empresas), `SUSCRIPCIONES_ACTIVAS` (ambas).
