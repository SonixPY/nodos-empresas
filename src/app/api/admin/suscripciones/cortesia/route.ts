import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { requireAdmin } from "@/lib/nodos/adminApi";
import { leerJson, pedidoSeguro } from "@/lib/nodos/cuentaApi";
import { UUID_REGEX, esFecha } from "@/lib/nodos/suscripciones";

const MENSAJES: Record<string, string> = {
  fecha_invalida: "La fecha tiene que ser de hoy en adelante (hasta 10 años).",
  sin_cuenta: "Esa cuenta no existe.",
};

/** Da (o quita, con hasta = null) acceso de cortesía a las dos apps hasta una fecha. */
export async function POST(request: Request) {
  if (!pedidoSeguro(request)) return NextResponse.json({ message: "Origen no permitido." }, { status: 403 });
  const check = await requireAdmin();
  if (!check.ok) return NextResponse.json({ message: check.message }, { status: check.status });

  const b = await leerJson(request);
  if (typeof b?.user_id !== "string" || !UUID_REGEX.test(b.user_id)) return NextResponse.json({ message: "Elegí la cuenta." }, { status: 400 });
  if (b.hasta !== null && !esFecha(b.hasta)) return NextResponse.json({ message: "Fecha inválida." }, { status: 400 });
  const nota = typeof b.nota === "string" ? b.nota.trim().slice(0, 500) : null;

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.rpc("admin_cortesia", {
    p_user: b.user_id,
    p_hasta: b.hasta,
    p_actor: check.callerId,
    p_nota: nota,
  });
  if (error) {
    console.error("cortesía: error de base", error.code);
    return NextResponse.json({ message: "No se pudo guardar la cortesía." }, { status: 500 });
  }
  if (data !== "ok") return NextResponse.json({ message: MENSAJES[data as string] ?? "No se pudo guardar." }, { status: 400 });
  return NextResponse.json({ ok: true });
}
