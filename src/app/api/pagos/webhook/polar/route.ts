import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
import {
  PolarWebhookError,
  PolarWebhookUnknownTypeError,
  PolarWebhookVerificationError,
  secretoWebhookPolar,
  validarEventoPolar,
} from "@/lib/pagos/polar";
import { mapearEventoPolar } from "@/lib/pagos/mapeo";

// Webhook de Polar. Orden estricto:
//   1. leer el cuerpo CRUDO (la firma se calcula sobre los bytes exactos);
//   2. verificar la firma con POLAR_WEBHOOK_SECRET ANTES de interpretar nada
//      (firma inválida → 403, sin tocar la base);
//   3. guardar y aplicar el evento en una sola transacción, idempotente por
//      webhook-id (un reenvío responde 202 sin hacer nada);
//   4. responder rápido: Polar corta a los 10 s y recomienda < 2 s.
// Un error de la base responde 500 para que Polar reintente: el evento no se
// pierde y, como todo es una transacción, no queda nada a medias.

const MAX_BYTES = 512 * 1024;

const json = (status: number, body: object) =>
  NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });

export async function POST(request: Request) {
  const secreto = secretoWebhookPolar();
  if (!secreto) {
    console.error("webhook polar: falta POLAR_WEBHOOK_SECRET; evento rechazado (Polar reintenta).");
    return json(500, { message: "Webhook no configurado." });
  }

  const largo = Number(request.headers.get("content-length") ?? "0");
  if (largo > MAX_BYTES) return json(413, { message: "Demasiado grande." });
  const cuerpo = await request.text();
  if (cuerpo.length > MAX_BYTES) return json(413, { message: "Demasiado grande." });

  const encabezados = {
    "webhook-id": request.headers.get("webhook-id") ?? "",
    "webhook-timestamp": request.headers.get("webhook-timestamp") ?? "",
    "webhook-signature": request.headers.get("webhook-signature") ?? "",
  };

  let evento: unknown;
  try {
    evento = await validarEventoPolar(cuerpo, encabezados, secreto);
  } catch (e) {
    if (e instanceof PolarWebhookVerificationError) {
      console.warn("webhook polar: firma inválida", (e as Error).message);
      return json(403, { message: "Firma inválida." });
    }
    // Firma válida pero tipo de evento que esta versión del SDK no conoce:
    // se acusa para que Polar no reintente.
    if (e instanceof PolarWebhookUnknownTypeError) return json(202, { ok: true, ignorado: true });
    if (e instanceof PolarWebhookError) return json(400, { message: "Evento inválido." });
    throw e;
  }

  const mapeado = mapearEventoPolar(evento);
  if (!mapeado) return json(202, { ok: true, ignorado: true });

  try {
    const admin = createSupabaseAdminClient();
    const { data, error } = await admin.rpc("polar_aplicar_evento", {
      p_evento_id: encabezados["webhook-id"],
      p_tipo: mapeado.tipo,
      p_ocurrido: mapeado.ocurrido,
      p_user: mapeado.userId,
      p_cliente_id: mapeado.clienteId,
      p_datos: mapeado.datos,
    });
    if (error) {
      console.error("webhook polar: no se pudo aplicar", mapeado.tipo, error.code, error.message);
      return json(500, { message: "No se pudo procesar." });
    }
    if (typeof data === "string" && !data.startsWith("ok") && data !== "duplicado") {
      // Evento guardado pero sin efecto (cuenta o producto desconocido): queda
      // en eventos_pago para revisarlo desde el Panel.
      console.warn("webhook polar:", mapeado.tipo, data);
    }
    return json(202, { ok: true });
  } catch (e) {
    console.error("webhook polar: error inesperado", (e as Error).message);
    return json(500, { message: "No se pudo procesar." });
  }
}
