import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { pedidoSeguro, preflight, responder } from "@/lib/nodos/cuentaApi";
import { clientePolar, polarConfigurado } from "@/lib/pagos/polar";
import { demasiadosIntentos, urlApp } from "@/lib/pagos/limites";

export const OPTIONS = preflight;

const MAX_PORTALES = 10; // por cuenta, cada 10 minutos

/**
 * Abre el portal de cliente de Polar (cambiar tarjeta, ver facturas,
 * cancelar) para la cuenta logueada. La sesión de portal se pide por
 * external_customer_id = id de la cuenta: nadie puede abrir el portal de otro.
 */
export async function POST(request: Request) {
  if (!pedidoSeguro(request)) return responder(request, 403, { message: "Origen no permitido." });
  if (!polarConfigurado()) return responder(request, 503, { message: "La gestión con tarjeta todavía no está disponible." });

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return responder(request, 401, { message: "Ingresá a tu cuenta." });

  let admin;
  try {
    admin = createSupabaseAdminClient();
  } catch {
    return responder(request, 503, { message: "No disponible ahora. Probá más tarde." });
  }
  if (await demasiadosIntentos(admin, user.id, "portal_creado", MAX_PORTALES)) {
    return responder(request, 429, { message: "Demasiados intentos. Esperá unos minutos." });
  }

  try {
    const sesion = await clientePolar().customerSessions.create({
      external_customer_id: user.id,
      return_url: `${urlApp(request)}/plan`,
    });
    if (typeof sesion?.customer_portal_url !== "string" || !sesion.customer_portal_url.startsWith("https://")) {
      throw new Error("portal sin url");
    }
    await admin.from("eventos_pago").insert({
      proveedor: "polar",
      tipo: "portal_creado",
      user_id: user.id,
      resultado: "ok",
    });
    return responder(request, 200, { url: sesion.customer_portal_url });
  } catch (e) {
    const err = e as Error & { statusCode?: number };
    const estado = err.statusCode;
    if (estado === 404 || estado === 422) {
      return responder(request, 404, { message: "Todavía no tenés pagos con tarjeta para gestionar." });
    }
    console.error("portal polar: no se pudo crear", err.name, estado ?? "");
    return responder(request, 502, { message: "No pudimos abrir el portal. Probá de nuevo en un rato." });
  }
}
