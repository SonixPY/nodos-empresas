import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { requireAdmin } from "@/lib/nodos/adminApi";
import { leerJson, pedidoSeguro } from "@/lib/nodos/cuentaApi";
import { MENSAJE_PAGO_MANUAL, validarPagoManual } from "@/lib/nodos/suscripciones";

/**
 * Registra un pago por transferencia, QR o efectivo y extiende el plan.
 * Solo administradores. La base vuelve a verificar que quien registra sea
 * admin y deja la constancia en eventos_pago (con el id de quien lo cargó).
 */
export async function POST(request: Request) {
  if (!pedidoSeguro(request)) return NextResponse.json({ message: "Origen no permitido." }, { status: 403 });
  const check = await requireAdmin();
  if (!check.ok) return NextResponse.json({ message: check.message }, { status: check.status });

  const pedido = validarPagoManual(await leerJson(request));
  if (typeof pedido === "string") return NextResponse.json({ message: pedido }, { status: 400 });

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.rpc("registrar_pago_manual", {
    p_user: pedido.user_id,
    p_plan: pedido.plan,
    p_periodo: pedido.periodo,
    p_monto_gs: pedido.monto_gs,
    p_forma: pedido.forma,
    p_referencia: pedido.referencia,
    p_fecha: pedido.fecha,
    p_actor: check.callerId,
    p_nota: pedido.nota,
  });
  if (error) {
    console.error("pago manual: error de base", error.code);
    return NextResponse.json({ message: "No se pudo registrar el pago." }, { status: 500 });
  }
  const r = data as { resultado: string; desde?: string; hasta?: string };
  if (r.resultado !== "ok") {
    return NextResponse.json({ message: MENSAJE_PAGO_MANUAL[r.resultado] ?? "No se pudo registrar el pago." }, { status: 400 });
  }
  return NextResponse.json({ ok: true, desde: r.desde, hasta: r.hasta });
}
