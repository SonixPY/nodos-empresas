import { createClient } from "@supabase/supabase-js";

/**
 * Cliente con la Service Role key — solo para usar en Route Handlers
 * server-only (nunca importar desde un componente de cliente). Hace falta
 * para operaciones de administración de Supabase Auth (como borrar un
 * usuario), que la clave anónima no puede hacer.
 */
export function createSupabaseAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "Faltan las variables de entorno NEXT_PUBLIC_SUPABASE_URL y/o SUPABASE_SERVICE_ROLE_KEY."
    );
  }
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
