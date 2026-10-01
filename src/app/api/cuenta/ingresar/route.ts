import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { hashIp, leerJson, origenValido, preflight, responder, texto } from "@/lib/nodos/cuentaApi";

const MAX_FALLIDOS = 10; // por conexión, cada 15 minutos
const VENTANA_MS = 15 * 60 * 1000;
const ERROR_GENERICO = "Usuario, email o contraseña incorrectos.";

export const OPTIONS = preflight;

/** Ingreso con email o nombre de usuario. Deja la sesión en las cookies compartidas. */
export async function POST(request: Request) {
  if (!origenValido(request)) return responder(request, 403, { message: "Origen no permitido." });
  const b = await leerJson(request);
  const identificador = texto(b?.identificador, 160).toLowerCase();
  const clave = typeof b?.clave === "string" ? b.clave : "";
  if (!identificador || !clave) return responder(request, 400, { message: "Completá tu usuario (o email) y tu contraseña." });

  let admin;
  try {
    admin = createSupabaseAdminClient();
  } catch {
    admin = null;
  }

  // Freno a la fuerza bruta: intentos fallidos recientes desde esta conexión.
  const ip_hash = hashIp(request);
  if (admin) {
    const desde = new Date(Date.now() - VENTANA_MS).toISOString();
    const { count, error } = await admin
      .from("intentos_ingreso")
      .select("id", { count: "exact", head: true })
      .eq("ip_hash", ip_hash)
      .gte("created_at", desde);
    if (!error && (count ?? 0) >= MAX_FALLIDOS) {
      return responder(request, 429, { message: "Demasiados intentos. Esperá unos minutos y probá de nuevo." });
    }
  }
  const fallo = async () => {
    if (admin) await admin.from("intentos_ingreso").insert({ ip_hash });
    return responder(request, 401, { message: ERROR_GENERICO });
  };

  // Usuario → email, del lado del servidor (el email nunca viaja al navegador).
  let email = identificador;
  if (!identificador.includes("@")) {
    if (!admin) return responder(request, 500, { message: "El ingreso con usuario no está disponible. Probá con tu email." });
    const { data } = await admin.from("profiles").select("email").eq("usuario", identificador).maybeSingle();
    if (!data?.email) return fallo();
    email = data.email;
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password: clave });
  if (error || !data.user) {
    if (error?.message?.toLowerCase().includes("not confirmed")) {
      return responder(request, 401, { message: "Todavía no confirmaste tu email. Revisá tu bandeja de entrada." });
    }
    return fallo();
  }
  return responder(request, 200, { ok: true });
}
