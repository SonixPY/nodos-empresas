import { createHash } from "node:crypto";
import { cookies, headers } from "next/headers";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { hashIp, leerJson, origenValido, preflight, responder, texto } from "@/lib/nodos/cuentaApi";
import { cookieDomainFor, supabaseAnonKey, supabaseUrl } from "@/lib/nodos/sitios";
import { BUCKET_ARCHIVOS_EMPRESAS, borrarCarpeta } from "@/lib/nodos/storage";
import { mensajeError } from "@/lib/nodos/errores";

const MAX_FALLIDOS = 5; // por cuenta y por conexión, cada 15 minutos
const VENTANA_MS = 15 * 60 * 1000;

export const OPTIONS = preflight;

/**
 * "Eliminar mi cuenta": borra la cuenta NODOS y todos sus datos en las tres
 * páginas. Pide escribir el usuario (o el email) y volver a poner la
 * contraseña. Después borra los archivos subidos (Storage) y la cuenta de
 * Supabase Auth; el `on delete cascade` borra sus datos de Finanzas y Empresas.
 */
export async function POST(request: Request) {
  if (!origenValido(request)) return responder(request, 403, { message: "Origen no permitido." });

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !user.email) return responder(request, 401, { message: "Tu sesión venció. Volvé a ingresar." });

  let admin;
  try {
    admin = createSupabaseAdminClient();
  } catch {
    return responder(request, 500, { message: "Falta configurar el servidor (service role)." });
  }

  // Freno a los intentos: por conexión y por cuenta (misma tabla que el ingreso).
  const claves = [hashIp(request), createHash("sha256").update(`eliminar:${user.id}`).digest("hex").slice(0, 32)];
  const desde = new Date(Date.now() - VENTANA_MS).toISOString();
  for (const ip_hash of claves) {
    const { count, error } = await admin
      .from("intentos_ingreso")
      .select("id", { count: "exact", head: true })
      .eq("ip_hash", ip_hash)
      .gte("created_at", desde);
    if (!error && (count ?? 0) >= MAX_FALLIDOS) {
      return responder(request, 429, { message: "Demasiados intentos. Esperá unos minutos y probá de nuevo." });
    }
  }
  const fallo = async (message: string, status = 400) => {
    await admin.from("intentos_ingreso").insert(claves.map((ip_hash) => ({ ip_hash })));
    return responder(request, status, { message });
  };

  const b = await leerJson(request);
  const confirmacion = texto(b?.confirmacion, 160).toLowerCase().replace(/^@/, "");
  const clave = typeof b?.clave === "string" ? b.clave : "";
  if (!confirmacion || !clave) return responder(request, 400, { message: "Escribí tu usuario (o tu email) y tu contraseña para confirmar." });

  const { data: perfil } = await admin.from("profiles").select("usuario, is_admin").eq("id", user.id).maybeSingle();
  const validos = [user.email.toLowerCase(), perfil?.usuario?.toLowerCase()].filter(Boolean);
  if (!validos.includes(confirmacion)) return fallo("Lo que escribiste no coincide con tu usuario ni con tu email.");

  // Una cuenta de administrador no se puede borrar si es la última.
  if (perfil?.is_admin) {
    const { count, error } = await admin
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("is_admin", true)
      .neq("id", user.id)
      .or("suspendido.is.null,suspendido.eq.false");
    if (error) return responder(request, 500, { message: "No pudimos verificar los administradores. Probá de nuevo." });
    if (!count) {
      return responder(request, 400, {
        message: "Sos el único administrador de NODOS. Antes de eliminar tu cuenta, nombrá a otro administrador desde Administración.",
      });
    }
  }

  // Contraseña: se verifica con un cliente aparte, sin tocar las cookies de la sesión.
  const verificador = createClient(supabaseUrl(), supabaseAnonKey(), {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
  const { error: errClave } = await verificador.auth.signInWithPassword({ email: user.email, password: clave });
  if (errClave) return fallo("La contraseña no es correcta.", 401);
  await verificador.auth.signOut({ scope: "local" }).catch(() => null);

  try {
    await borrarCarpeta(admin, BUCKET_ARCHIVOS_EMPRESAS, user.id);
  } catch (e) {
    return responder(request, 500, {
      message: `No pudimos borrar tus archivos subidos: ${mensajeError(e)} Tu cuenta no se eliminó; probá de nuevo o escribinos a soporte.`,
    });
  }

  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) {
    return responder(request, 500, { message: "No pudimos eliminar la cuenta. Probá de nuevo o escribinos a soporte." });
  }

  // Cierra la sesión en este navegador (la cuenta ya no existe).
  await supabase.auth.signOut({ scope: "local" }).catch(() => null);
  const res = responder(request, 200, { ok: true });
  const domain = cookieDomainFor((await headers()).get("host"));
  for (const c of (await cookies()).getAll()) {
    if (c.name.startsWith("sb-")) res.cookies.set(c.name, "", { path: "/", maxAge: 0, ...(domain ? { domain } : {}) });
  }
  return res;
}
