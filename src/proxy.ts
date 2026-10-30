import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { APP_ID } from "@/lib/nodos/app";
import { SSO_FLAG, cookieDomainFor, rutaInterna, urlIngreso } from "@/lib/nodos/sitios";
import { supabaseAnonKey as supabaseAnonKey_, supabaseUrl as supabaseUrlLimpia } from "@/lib/nodos/sitios";

// Rutas que se ven sin sesión.
// /vincular: aceptar la invitación de una empresa (la página pide ingresar si hace falta).
const PUBLICAS = ["/login", "/signup", "/recuperar", "/nueva-clave", "/auth/callback", "/soporte", "/sin-acceso", "/vincular"];
// Con sesión, pero sin pedir acceso a la app ni plan: NODOS Práctica es
// gratis para cualquier cuenta NODOS (las cuentas suspendidas no entran).
const LIBRES = ["/practica"];
// Rutas de ingreso: con sesión abierta no tienen sentido.
const INGRESO = ["/login", "/signup", "/recuperar"];
// Con sesión pero sin plan vigente, solo se puede llegar a estas (si no, el
// cobro no tendría salida: elegir plan, ver la cuenta, pedir ayuda).
const SIN_PLAN = ["/plan", "/cuenta", "/soporte", "/sin-acceso"];

const empiezaCon = (pathname: string, rutas: string[]) =>
  rutas.some((r) => pathname === r || pathname.startsWith(`${r}/`));

/**
 * Gate por sesión de Supabase Auth, compartida entre las apps NODOS:
 * - sin sesión → pantalla única de ingreso en nodoscompliance.com/ingresar
 *   (en localhost o previews de Vercel, el /login local)
 * - con sesión pero sin permiso para esta app (o cuenta suspendida) → /sin-acceso
 * Los datos de cada usuario los protege RLS en la base.
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabaseUrl = supabaseUrlLimpia();
  const supabaseAnonKey = supabaseAnonKey_();
  if (!supabaseUrl || !supabaseAnonKey) return response;

  const { pathname } = request.nextUrl;
  const domain = cookieDomainFor(request.headers.get("host"));

  // Las APIs nunca se redirigen: cada endpoint valida la sesión por su cuenta
  // y responde con sus propios encabezados CORS (una redirección sin CORS
  // impedía que nodoscompliance.com detectara la sesión).
  if (pathname.startsWith("/api/")) return response;

  // Paso único al inicio de sesión compartido: borra las cookies de sesión
  // viejas de este subdominio (sin Domain) y marca el navegador. Quien tenía
  // la sesión abierta vuelve a ingresar una vez, y de ahí en más la sesión
  // sirve para las dos apps.
  // Solo redirige si hay cookies viejas que limpiar: un cliente sin cookies
  // (bots, lectores) nunca entra en un bucle de redirecciones.
  const marcarSso = (res: NextResponse) => {
    if (domain && !request.cookies.has(SSO_FLAG)) {
      res.cookies.set(SSO_FLAG, "1", { domain, path: "/", maxAge: 60 * 60 * 24 * 400, sameSite: "lax", secure: true });
    }
    return res;
  };
  const viejas = request.cookies.getAll().filter((c) => c.name.startsWith("sb-"));
  if (domain && request.method === "GET" && !request.cookies.has(SSO_FLAG) && viejas.length > 0) {
    const res = NextResponse.redirect(request.nextUrl);
    for (const c of viejas) res.cookies.set(c.name, "", { path: "/", maxAge: 0 });
    return marcarSso(res);
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    ...(domain ? { cookieOptions: { domain, path: "/", sameSite: "lax" as const, secure: true } } : {}),
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Redirección que conserva las cookies que Supabase haya refrescado.
  const redirigir = (destino: string) => {
    const res = NextResponse.redirect(new URL(destino, request.url));
    response.cookies.getAll().forEach((c) => res.cookies.set(c));
    return marcarSso(res);
  };

  if (!user) {
    // En producción hay una sola pantalla de ingreso, la del sitio principal.
    // URL pública de esta app (detrás del proxy de Vercel request.url puede no traer el host real).
    const publica = `https://${request.headers.get("host")}`;
    if (domain && empiezaCon(pathname, INGRESO)) {
      const volver = request.nextUrl.searchParams.get("next");
      const vista = pathname.startsWith("/signup") ? "crear" : pathname.startsWith("/recuperar") ? "recuperar" : undefined;
      const ruta = rutaInterna(volver);
      const destinoApp = ruta ? new URL(ruta, publica).toString() : null;
      return redirigir(urlIngreso(destinoApp, vista));
    }
    if (empiezaCon(pathname, PUBLICAS)) return marcarSso(response);
    if (domain) return redirigir(urlIngreso(`${publica}${pathname}${request.nextUrl.search}`));
    const destino = pathname === "/" ? "/login" : `/login?next=${encodeURIComponent(pathname)}`;
    return redirigir(destino);
  }

  if (empiezaCon(pathname, INGRESO)) return redirigir("/");
  if (empiezaCon(pathname, PUBLICAS)) return marcarSso(response);

  // Permisos por app (los define el panel de administración).
  const { data: perfil, error } = await supabase
    .from("profiles")
    .select(`acceso_${APP_ID}, suspendido, is_admin`)
    .eq("id", user.id)
    .maybeSingle<Record<string, boolean | null>>();
  const libre = empiezaCon(pathname, LIBRES);
  // Los administradores entran a todo, sin suscripción ni permiso por app
  // (salvo que la cuenta esté suspendida).
  const esAdmin = !error && perfil?.is_admin === true;
  // Si la migración de cuentas todavía no corrió, no bloqueamos a nadie.
  if (!error && perfil && (perfil.suspendido === true || (!libre && !esAdmin && perfil[`acceso_${APP_ID}`] === false))) {
    return redirigir("/sin-acceso");
  }
  if (libre || esAdmin) return marcarSso(response);

  // Cobro de suscripciones: SOLO con SUSCRIPCIONES_ACTIVAS=true (las dos apps).
  // tiene_acceso_app decide en la base (admin, cortesía, prueba, plan vigente
  // o en gracia). Sin acceso, se crea la prueba de 14 días si la cuenta nunca
  // tuvo una (asegurar_prueba solo inserta si no hay ninguna fila) y, si no
  // corresponde, se manda al plan dentro de Mi cuenta.
  //
  // Si la base falla (p. ej. la migración 011 todavía no corrió, o Supabase
  // está caído) NO se bloquea a nadie: se deja pasar y se registra el error.
  // Es una decisión consciente: un problema de infraestructura no puede dejar
  // afuera a las cuentas que pagan; en el peor caso alguien sin plan usa la
  // app durante la caída. Los datos siguen protegidos por RLS igual. Esto NO
  // aplica a pagos: el webhook rechaza siempre una firma inválida.
  if (process.env.SUSCRIPCIONES_ACTIVAS === "true" && !empiezaCon(pathname, SIN_PLAN)) {
    const { data: acceso, error: errorAcceso } = await supabase.rpc("tiene_acceso_app", { p_app: APP_ID });
    if (errorAcceso) {
      console.error("proxy: no se pudo verificar la suscripción; se deja pasar", errorAcceso.code);
    } else if (acceso !== true) {
      const { data: creada, error: errorPrueba } = await supabase.rpc("asegurar_prueba");
      if (errorPrueba) console.error("proxy: no se pudo iniciar la prueba", errorPrueba.code);
      if (creada !== true) return redirigir("/cuenta#plan");
    }
  }

  return marcarSso(response);
}

// Las precargas de links del menú (next-router-prefetch) no pasan por el
// proxy: antes cada una costaba 2 o 3 viajes a Supabase (10 corridas al abrir
// el Resumen y pasar a Movimientos). Las páginas son cascarones y los datos
// los protege RLS; la navegación real sí pasa por acá. Las APIs tampoco
// entran (ya salían en la primera línea, ahora ni se invoca el proxy).
export const config = {
  matcher: [
    {
      source: "/((?!api/|_next/static|_next/image|favicon.ico|icon.svg|apple-icon.png|isotipo.svg|robots.txt).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
