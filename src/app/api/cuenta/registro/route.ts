import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { TERMINOS_VERSION, leerJson, origenValido, preflight, responder, texto } from "@/lib/nodos/cuentaApi";
import { SITIOS, USUARIO_REGEX } from "@/lib/nodos/sitios";
import { mensajeErrorAuth } from "@/lib/nodos/errores";

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
  if (b?.acepta_terminos !== true) {
    return responder(request, 400, { message: "Para crear la cuenta tenés que aceptar los Términos y la Política de privacidad." });
  }

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
  if (error) {
    // Mensajes de Supabase (en inglés) traducidos; nunca se devuelve el texto crudo.
    const status = error.status === 429 || /rate_limit/.test(error.code ?? "") ? 429 : 400;
    return responder(request, status, { message: mensajeErrorAuth(error, "No pudimos crear la cuenta. Probá de nuevo.") });
  }

  // Constancia de la aceptación, escrita por el servidor (el navegador no
  // puede tocar profiles). Si el email ya tenía cuenta, Supabase devuelve un
  // usuario sin identidades: no se toca nada.
  if (data.user && (data.user.identities?.length ?? 0) > 0) {
    try {
      const admin = createSupabaseAdminClient();
      const { error: errTerminos } = await admin
        .from("profiles")
        .update({ terminos_aceptados_el: new Date().toISOString(), terminos_version: TERMINOS_VERSION })
        .eq("id", data.user.id);
      if (errTerminos) console.error("registro: no se guardó la aceptación de términos", errTerminos.code);
    } catch {
      console.error("registro: sin service role para guardar la aceptación de términos");
    }
  }
  return responder(request, 200, { ok: true, confirmar: !data.session });
}
