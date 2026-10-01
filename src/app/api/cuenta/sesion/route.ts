import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { preflight, responder } from "@/lib/nodos/cuentaApi";

export const OPTIONS = preflight;

/** ¿Hay sesión NODOS abierta en este navegador? Sin datos sensibles (no devuelve el email). */
export async function GET(request: Request) {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return responder(request, 200, { logueado: false });
    const { data } = await supabase
      .from("profiles")
      .select("nombre, usuario, is_admin, acceso_finanzas, acceso_empresas, suspendido")
      .eq("id", user.id)
      .maybeSingle();
    return responder(request, 200, {
      logueado: true,
      nombre: data?.nombre ?? (user.user_metadata?.nombre as string | undefined) ?? null,
      usuario: data?.usuario ?? null,
      is_admin: !!data?.is_admin,
      acceso_finanzas: data?.acceso_finanzas !== false && data?.suspendido !== true,
      acceso_empresas: data?.acceso_empresas !== false && data?.suspendido !== true,
    });
  } catch {
    return responder(request, 200, { logueado: false });
  }
}
