import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { requireAdmin } from "@/lib/nodos/adminApi";
import { leerJson, pedidoSeguro } from "@/lib/nodos/cuentaApi";
import { UUID_REGEX } from "@/lib/nodos/suscripciones";

const MENSAJES: Record<string, string> = {
  sin_suscripcion: "Esa cuenta no tiene suscripción.",
  ya_vencida: "La suscripción ya estaba vencida.",
  es_polar:
    "Es una suscripción con tarjeta: cancelala o revocala en el panel de Polar (Customers → la cuenta → Subscription). El cambio llega solo por webhook.",
};

/** Cancela una prueba o un plan manual (queda sin acceso desde ya). */
export async function POST(request: Request) {
  if (!pedidoSeguro(request)) return NextResponse.json({ message: "Origen no permitido." }, { status: 403 });
  const check = await requireAdmin();
  if (!check.ok) return NextResponse.json({ message: check.message }, { status: check.status });

  const b = await leerJson(request);
  if (typeof b?.user_id !== "string" || !UUID_REGEX.test(b.user_id)) return NextResponse.json({ message: "Elegí la cuenta." }, { status: 400 });
  const motivo = typeof b.motivo === "string" ? b.motivo.trim().slice(0, 500) : null;

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.rpc("admin_cancelar_suscripcion", {
    p_user: b.user_id,
    p_actor: check.callerId,
    p_motivo: motivo,
  });
  if (error) {
    console.error("cancelar suscripción: error de base", error.code);
    return NextResponse.json({ message: "No se pudo cancelar." }, { status: 500 });
  }
  if (data !== "ok") return NextResponse.json({ message: MENSAJES[data as string] ?? "No se pudo cancelar." }, { status: 400 });
  return NextResponse.json({ ok: true });
}
