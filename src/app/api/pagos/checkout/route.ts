import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { hashIp, leerJson, pedidoSeguro, preflight, responder } from "@/lib/nodos/cuentaApi";
import { clientePolar, polarConfigurado } from "@/lib/pagos/polar";
import { demasiadosIntentos, urlApp } from "@/lib/pagos/limites";
import { hoyPy } from "@/lib/nodos/suscripciones";

export const OPTIONS = preflight;

const MAX_CHECKOUTS = 5; // por cuenta, cada 10 minutos

/**
 * Crea un checkout de Polar para la cuenta logueada. El navegador solo dice
 * qué plan y período quiere: el producto (y con él el precio) sale de la
 * tabla `planes` en el servidor. La cuenta queda atada al checkout por
 * external_customer_id = id de la cuenta NODOS, que es lo único que el
 * webhook usa para saber de quién es el pago.
 */
export async function POST(request: Request) {
  if (!pedidoSeguro(request)) return responder(request, 403, { message: "Origen no permitido." });
  if (!polarConfigurado()) return responder(request, 503, { message: "El pago con tarjeta todavía no está disponible. Podés pagar por transferencia o QR." });

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return responder(request, 401, { message: "Ingresá a tu cuenta para elegir un plan." });

  const b = await leerJson(request);
  const planId = typeof b?.plan === "string" ? b.plan : "";
  const periodo = b?.periodo === "anual" ? "anual" : b?.periodo === "mensual" ? "mensual" : null;
  if (!/^[a-z0-9_-]{2,30}$/.test(planId) || !periodo) return responder(request, 400, { message: "Elegí un plan y un período." });

  let admin;
  try {
    admin = createSupabaseAdminClient();
  } catch {
    return responder(request, 503, { message: "El pago no está disponible ahora. Probá más tarde." });
  }

  if (await demasiadosIntentos(admin, user.id, "checkout_creado", MAX_CHECKOUTS)) {
    return responder(request, 429, { message: "Abriste varios pagos seguidos. Esperá unos minutos y probá de nuevo." });
  }

  const { data: plan } = await admin
    .from("planes")
    .select("id, activo, polar_producto_mensual, polar_producto_anual")
    .eq("id", planId)
    .maybeSingle<{ id: string; activo: boolean; polar_producto_mensual: string | null; polar_producto_anual: string | null }>();
  const producto = periodo === "anual" ? plan?.polar_producto_anual : plan?.polar_producto_mensual;
  if (!plan?.activo || !producto) return responder(request, 400, { message: "Ese plan no está disponible con tarjeta." });

  // Una sola suscripción con tarjeta por cuenta: si ya hay una vigente, se
  // gestiona (cambio de plan, cancelación) desde el portal de Polar.
  const { data: actual } = await admin
    .from("suscripciones")
    .select("proveedor, estado, activa_hasta")
    .eq("user_id", user.id)
    .maybeSingle<{ proveedor: string; estado: string; activa_hasta: string | null }>();
  if (
    actual?.proveedor === "polar" &&
    ["activa", "impaga", "cancelada"].includes(actual.estado) &&
    (actual.estado !== "cancelada" || (actual.activa_hasta ?? "") >= hoyPy())
  ) {
    return responder(request, 409, { message: "Ya tenés una suscripción con tarjeta. Gestionala con el botón Gestionar o cancelar." });
  }

  const app = urlApp(request);
  try {
    const checkout = await clientePolar().checkouts.create({
      products: [producto],
      external_customer_id: user.id,
      customer_email: user.email ?? null,
      allow_trial: false,
      success_url: `${app}/plan?pago=ok`,
      return_url: `${app}/plan`,
      // Solo informativo (aparece en el panel de Polar): el webhook NO lo usa
      // para decidir nada.
      metadata: { plan: plan.id, periodo },
    });
    if (typeof checkout?.url !== "string" || !checkout.url.startsWith("https://")) throw new Error("checkout sin url");

    await admin.from("eventos_pago").insert({
      proveedor: "polar",
      tipo: "checkout_creado",
      referencia: checkout.id,
      user_id: user.id,
      ip_hash: hashIp(request),
      payload: { plan: plan.id, periodo },
      resultado: "ok",
    });
    return responder(request, 200, { url: checkout.url });
  } catch (e) {
    // Sin el mensaje completo: puede repetir datos de la cuenta (email).
    console.error("checkout polar: no se pudo crear", (e as Error).name, (e as { statusCode?: number }).statusCode ?? "");
    return responder(request, 502, { message: "No pudimos abrir el pago. Probá de nuevo en un rato." });
  }
}
