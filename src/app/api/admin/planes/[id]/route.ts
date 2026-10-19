import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { requireAdmin } from "@/lib/nodos/adminApi";
import { leerJson, pedidoSeguro } from "@/lib/nodos/cuentaApi";
import { validarCambiosPlan } from "@/lib/nodos/suscripciones";

/**
 * Edita un plan: nombre, descripción, precios en Gs, productos de Polar y si
 * está activo. Solo administradores; cada cambio queda en eventos_pago con el
 * antes y el después.
 */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!pedidoSeguro(request)) return NextResponse.json({ message: "Origen no permitido." }, { status: 403 });
  const { id } = await params;
  if (!/^[a-z0-9_-]{2,30}$/.test(id)) return NextResponse.json({ message: "Plan inválido." }, { status: 400 });
  const check = await requireAdmin();
  if (!check.ok) return NextResponse.json({ message: check.message }, { status: check.status });

  const cambios = validarCambiosPlan(await leerJson(request));
  if (typeof cambios === "string") return NextResponse.json({ message: cambios }, { status: 400 });

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.rpc("admin_editar_plan", { p_plan: id, p_datos: cambios, p_actor: check.callerId });
  if (error) {
    if (error.code === "23505") return NextResponse.json({ message: "Ese producto de Polar ya está asignado a otro plan." }, { status: 409 });
    if (error.code === "23514") {
      return NextResponse.json(
        { message: "Un plan activo necesita al menos un precio, y el producto mensual y el anual tienen que ser distintos." },
        { status: 400 }
      );
    }
    console.error("editar plan: error de base", error.code);
    return NextResponse.json({ message: "No se pudo guardar el plan." }, { status: 500 });
  }
  if (data !== "ok") return NextResponse.json({ message: "Ese plan no existe." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
