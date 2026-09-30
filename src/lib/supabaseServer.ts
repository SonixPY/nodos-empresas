import { cookies, headers } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { cookieDomainFor } from "@/lib/nodos/sitios";
import { supabaseAnonKey as supabaseAnonKey_, supabaseUrl as supabaseUrlLimpia } from "@/lib/nodos/sitios";

const supabaseUrl = supabaseUrlLimpia();
const supabaseAnonKey = supabaseAnonKey_();

/**
 * Cliente de Supabase para Server Components y Route Handlers: lee la sesión
 * de las cookies de la request (compartidas entre las apps NODOS).
 */
export async function createSupabaseServerClient() {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Faltan las variables de entorno NEXT_PUBLIC_SUPABASE_URL y/o NEXT_PUBLIC_SUPABASE_ANON_KEY.");
  }
  const cookieStore = await cookies();
  const domain = cookieDomainFor((await headers()).get("host"));
  return createServerClient(supabaseUrl, supabaseAnonKey, {
    ...(domain ? { cookieOptions: { domain, path: "/", sameSite: "lax" as const, secure: true } } : {}),
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Desde un Server Component no se pueden escribir cookies; el proxy
          // ya se encarga de refrescar la sesión.
        }
      },
    },
  });
}
