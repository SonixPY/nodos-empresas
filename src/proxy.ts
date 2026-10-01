import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { APP_ID } from "@/lib/nodos/app";
import { SSO_FLAG, cookieDomainFor, urlIngreso } from "@/lib/nodos/sitios";
import { supabaseAnonKey as supabaseAnonKey_, supabaseUrl as supabaseUrlLimpia } from "@/lib/nodos/sitios";

// Rutas que se ven sin sesión.
const PUBLICAS = ["/login", "/signup", "/recuperar", "/nueva-clave", "/auth/callback", "/soporte", "/sin-acceso"];
// Rutas de ingreso: con sesión abierta no tienen sentido.
const INGRESO = ["/login", "/signup", "/recuperar"];

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

  if (pathname.startsWith("/api/")) return response; // cada endpoint valida por su cuenta

  if (!user) {
    // En producción hay una sola pantalla de ingreso, la del sitio principal.
    // URL pública de esta app (detrás del proxy de Vercel request.url puede no traer el host real).
    const publica = `https://${request.headers.get("host")}`;
    if (domain && empiezaCon(pathname, INGRESO)) {
      const volver = request.nextUrl.searchParams.get("next");
      const vista = pathname.startsWith("/signup") ? "crear" : pathname.startsWith("/recuperar") ? "recuperar" : undefined;
      const destinoApp = volver && volver.startsWith("/") && !volver.startsWith("//") ? new URL(volver, publica).toString() : null;
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
    .select(`acceso_${APP_ID}, suspendido`)
    .eq("id", user.id)
    .maybeSingle<Record<string, boolean | null>>();
  // Si la migración de cuentas todavía no corrió, no bloqueamos a nadie.
  if (!error && perfil && (perfil.suspendido === true || perfil[`acceso_${APP_ID}`] === false)) {
    return redirigir("/sin-acceso");
  }

  return marcarSso(response);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|apple-icon.png|isotipo.svg|robots.txt).*)"],
};
