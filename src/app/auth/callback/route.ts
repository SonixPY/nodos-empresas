import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { esUrlNodos } from "@/lib/nodos/sitios";

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
    if (error) return NextResponse.redirect(new URL("/login?error=link", url.origin));
  }
  return NextResponse.redirect(new URL(destino, url.origin));
}
