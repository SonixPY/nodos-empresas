import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { leerJson, origenValido, preflight, responder, texto } from "@/lib/nodos/cuentaApi";
import { SITIOS, USUARIO_REGEX } from "@/lib/nodos/sitios";

export const OPTIONS = preflight;

/** Alta de cuenta NODOS (sirve para Finanzas y Empresas). */
export async function POST(request: Request) {
  if (!origenValido(request)) return responder(request, 403, { message: "Origen no permitido." });
  const b = await leerJson(request);
  const nombre = texto(b?.nombre, 80);
  const usuario = texto(b?.usuario, 20).toLowerCase();
  const email = texto(b?.email, 160).toLowerCase();
  const clave = typeof b?.clave === "string" ? b.clave : "";

  if (nombre.length < 2) return responder(request, 400, { message: "Contanos tu nombre." });
  if (!USUARIO_REGEX.test(usuario)) {
    return responder(request, 400, { message: "El usuario lleva de 3 a 20 caracteres: letras minúsculas, números, punto o guion bajo." });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return responder(request, 400, { message: "Ese email no parece válido." });
  if (clave.length < 8) return responder(request, 400, { message: "La contraseña necesita al menos 8 caracteres." });

  try {
    const admin = createSupabaseAdminClient();
    const { data } = await admin.from("profiles").select("id").eq("usuario", usuario).maybeSingle();
    if (data) return responder(request, 409, { message: "Ese usuario ya está tomado. Probá con otro." });
  } catch {
    // Sin service role: el trigger igual descarta un usuario repetido.
  }

  const origen = new URL(request.url).origin;
  const volver = `${SITIOS.inicio.url}/?bienvenida=1`;
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password: clave,
    options: {
      data: { nombre, usuario },
      emailRedirectTo: `${origen}/auth/callback?next=${encodeURIComponent(volver)}`,
    },
  });
  if (error) return responder(request, 400, { message: error.message });
  return responder(request, 200, { ok: true, confirmar: !data.session });
}
