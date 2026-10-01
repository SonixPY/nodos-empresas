import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { origenValido, preflight, responder } from "@/lib/nodos/cuentaApi";

export const OPTIONS = preflight;

/** Cierra la sesión NODOS (en las tres páginas a la vez). */
export async function POST(request: Request) {
  if (!origenValido(request)) return responder(request, 403, { message: "Origen no permitido." });
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut({ scope: "local" });
  return responder(request, 200, { ok: true });
}
