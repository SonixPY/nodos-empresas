import { createClient } from "@supabase/supabase-js";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { leerJson, origenValido, preflight, responder, texto } from "@/lib/nodos/cuentaApi";
import { supabaseAnonKey, supabaseUrl } from "@/lib/nodos/sitios";

export const OPTIONS = preflight;

/** Email para elegir una contraseña nueva. Acepta email o usuario. */
export async function POST(request: Request) {
  if (!origenValido(request)) return responder(request, 403, { message: "Origen no permitido." });
  const b = await leerJson(request);
  const identificador = texto(b?.identificador, 160).toLowerCase();
  if (!identificador) return responder(request, 400, { message: "Escribí tu email o tu usuario." });

  let email: string | null = identificador.includes("@") ? identificador : null;
  if (!email) {
    try {
      const { data } = await createSupabaseAdminClient().from("profiles").select("email").eq("usuario", identificador).maybeSingle();
      email = data?.email ?? null;
    } catch {
      email = null;
    }
  }

  // Misma respuesta exista o no la cuenta: no revela quién está registrado.
  if (email) {
    const publico = createClient(supabaseUrl(), supabaseAnonKey(), {
      auth: { flowType: "implicit", persistSession: false, autoRefreshToken: false },
    });
    await publico.auth.resetPasswordForEmail(email, { redirectTo: `${new URL(request.url).origin}/nueva-clave` });
  }
  return responder(request, 200, { ok: true });
}
