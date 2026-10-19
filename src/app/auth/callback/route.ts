import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { cookieDomainFor, esUrlNodos, urlIngreso } from "@/lib/nodos/sitios";

/** Destino de los links de Supabase (confirmación de email, recuperar contraseña). */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next");
  // Destino: una ruta de esta app o cualquier página NODOS (p. ej. el inicio).
  const destino = next && ((next.startsWith("/") && !next.startsWith("//")) || esUrlNodos(next)) ? next : "/";

  if (code) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      // Link vencido o ya usado. En producción el único ingreso es el del
      // sitio principal, que muestra el aviso; en localhost, el /login local.
      if (cookieDomainFor(request.headers.get("host"))) {
        // Si era un link de recuperar contraseña, abre directo esa pestaña;
        // si no, después de ingresar vuelve al destino original.
        const recuperar = /nueva-clave/.test(next ?? "");
        const volver = recuperar ? null : new URL(destino, `https://${request.headers.get("host")}`).toString();
        return NextResponse.redirect(urlIngreso(volver, recuperar ? "recuperar" : undefined, "link_vencido"));
      }
      return NextResponse.redirect(new URL("/login?error=link", url.origin));
    }
  }
  return NextResponse.redirect(new URL(destino, url.origin));
}
