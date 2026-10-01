import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { leerJson, origenValido, preflight, responder, texto } from "@/lib/nodos/cuentaApi";
import { USUARIO_REGEX } from "@/lib/nodos/sitios";

export const OPTIONS = preflight;

/**
 * Cada cuenta edita su nombre y su usuario. Pasa por el servidor porque la
 * tabla profiles no deja modificar el propio perfil desde el navegador.
 */
export async function PATCH(request: Request) {
  if (!origenValido(request)) return responder(request, 403, { message: "Origen no permitido." });
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return responder(request, 401, { message: "Tu sesión venció. Volvé a ingresar." });

  const b = await leerJson(request);
  const cambios: { nombre?: string | null; usuario?: string } = {};
  if (b && "nombre" in b) cambios.nombre = texto(b.nombre, 80) || null;
  if (b && "usuario" in b) {
    const usuario = texto(b.usuario, 20).toLowerCase();
    if (!USUARIO_REGEX.test(usuario)) {
      return responder(request, 400, { message: "El usuario lleva de 3 a 20 caracteres: letras minúsculas, números, punto o guion bajo." });
    }
    cambios.usuario = usuario;
  }
  if (Object.keys(cambios).length === 0) return responder(request, 400, { message: "No hay cambios." });

  let admin;
  try {
    admin = createSupabaseAdminClient();
  } catch {
    return responder(request, 500, { message: "Falta configurar el servidor (service role)." });
  }
  if (cambios.usuario) {
    const { data: tomado } = await admin.from("profiles").select("id").eq("usuario", cambios.usuario).neq("id", user.id).maybeSingle();
    if (tomado) return responder(request, 409, { message: "Ese usuario ya está tomado. Probá con otro." });
  }
  const { data, error } = await admin.from("profiles").update(cambios).eq("id", user.id).select("nombre, usuario").maybeSingle();
  if (error) {
    const msg = error.code === "23505" ? "Ese usuario ya está tomado. Probá con otro." : error.message;
    return responder(request, 400, { message: msg });
  }
  return responder(request, 200, { ok: true, perfil: data });
}
