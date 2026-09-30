import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/**
 * Cliente de Supabase para usar en Server Components / Route Handlers: lee
 * la sesión de las cookies de la request en curso. Sirve para saber quién
 * es el usuario logueado del lado del servidor (por ejemplo, para el panel
 * de admin, que necesita confirmar `is_admin` antes de listar/borrar
 * usuarios).
 */
export async function createSupabaseServerClient() {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      "Faltan las variables de entorno NEXT_PUBLIC_SUPABASE_URL y/o NEXT_PUBLIC_SUPABASE_ANON_KEY."
    );
  }
  const cookieStore = await cookies();
  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Se puede llamar desde un Server Component, donde no se pueden
          // escribir cookies — el proxy ya se encarga de refrescar la sesión.
        }
      },
    },
  });
}
