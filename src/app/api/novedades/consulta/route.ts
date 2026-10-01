import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";

/**
 * POST /api/novedades/consulta  { notaId, confirmado: true }
 * "Consultar sobre esto" en una Nota NODOS → lead en el Panel.
 *
 * Privacidad:
 * - Solo se llama después de que el usuario confirma en la app el aviso
 *   "Vamos a enviar tu nombre y email a NODOS para responderte"
 *   (`confirmado: true`; sin eso, 400).
 * - Se guardan solo el nombre del perfil, el email de la cuenta y el título
 *   de la nota. Ningún dato de sus empresas. El lead queda en la base de
 *   NODOS (no sale a terceros) y lo ven solo los administradores (RLS de 003).
 * - No se registra (log) nada del pedido.
 *
 * Límite: 3 consultas por hora por usuario; la misma nota no se duplica en 24 h.
 */

const MAX_POR_HORA = 3;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const responder = (status: number, body: object) => Response.json(body, { status });

export async function POST(request: Request) {
  let supabase;
  let user = null;
  try {
    supabase = await createSupabaseServerClient();
    user = (await supabase.auth.getUser()).data.user;
  } catch {
    user = null;
  }
  if (!supabase || !user) return responder(401, { message: "Iniciá sesión para enviar la consulta." });

  const b = (await request.json().catch(() => null)) as { notaId?: unknown; confirmado?: unknown } | null;
  const notaId = typeof b?.notaId === "string" ? b.notaId : "";
  if (!UUID.test(notaId)) return responder(400, { message: "Pedido inválido." });
  if (b?.confirmado !== true) return responder(400, { message: "Falta tu confirmación para enviar la consulta." });

  // Con el cliente del usuario: RLS garantiza que la nota esté publicada (o que sea admin).
  const [{ data: nota }, { data: perfil }] = await Promise.all([
    supabase.from("notas_nodos").select("id, titulo").eq("id", notaId).maybeSingle(),
    supabase.from("profiles").select("nombre, usuario").eq("id", user.id).maybeSingle(),
  ]);
  if (!nota) return responder(404, { message: "Esa nota ya no está disponible." });

  const email = (user.email ?? "").trim().toLowerCase();
  if (!email) return responder(400, { message: "Tu cuenta no tiene un email para responderte." });
  const nombre =
    ((perfil?.nombre as string | null) ?? "").trim().slice(0, 120) ||
    ((perfil?.usuario as string | null) ?? "").trim() ||
    email.split("@")[0];
  const mensaje = `Consulta sobre la nota: ${String(nota.titulo).slice(0, 200)}`;

  let admin;
  try {
    admin = createSupabaseAdminClient();
  } catch {
    return responder(500, { message: "No pudimos enviar la consulta ahora. Escribinos a contacto@nodoscompliance.com." });
  }

  const desdeHora = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const desdeDia = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const [{ count: recientes, error: e1 }, { count: repetida, error: e2 }] = await Promise.all([
    admin.from("leads").select("id", { count: "exact", head: true }).eq("creado_por", user.id).eq("origen", "app").gte("created_at", desdeHora),
    admin
      .from("leads")
      .select("id", { count: "exact", head: true })
      .eq("creado_por", user.id)
      .eq("origen", "app")
      .eq("mensaje", mensaje)
      .gte("created_at", desdeDia),
  ]);
  if (e1 || e2) return responder(500, { message: "No pudimos enviar la consulta ahora. Probá de nuevo en un rato." });
  if ((repetida ?? 0) > 0) return responder(200, { ok: true, repetida: true });
  if ((recientes ?? 0) >= MAX_POR_HORA) return responder(429, { message: "Ya enviaste varias consultas en la última hora. Probá de nuevo más tarde." });

  const { data, error } = await admin
    .from("leads")
    .insert({
      nombre,
      email,
      tema: "empresa-familiar",
      mensaje,
      origen: "app",
      consentimiento: true,
      creado_por: user.id,
    })
    .select("id")
    .single();
  if (error) return responder(500, { message: "No pudimos enviar la consulta ahora. Probá de nuevo en un rato." });

  await admin.from("lead_actividades").insert({
    lead_id: data.id,
    tipo: "sistema",
    texto: "Consulta enviada desde NODOS Empresas (Novedades), con confirmación del usuario para compartir nombre y email.",
    autor: null,
  });
  return responder(200, { ok: true });
}
