import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { preflight, responder } from "@/lib/nodos/cuentaApi";
import { polarConfigurado } from "@/lib/pagos/polar";
import type { EstadoPlan, PlanPublico } from "@/lib/nodos/suscripciones";

export const OPTIONS = preflight;

/**
 * Estado del plan de la cuenta logueada y planes disponibles, para la página
 * "Mi plan" de las dos apps. Todo se lee con la sesión de la cuenta (RLS):
 * solo ve su propia suscripción y los planes activos. Sin datos sensibles:
 * ni email, ni ids de Polar.
 */
export async function GET(request: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return responder(request, 401, { logueado: false });

  const [{ data: estado, error }, { data: planes }] = await Promise.all([
    supabase.rpc("estado_suscripcion"),
    supabase
      .from("planes")
      .select("id, nombre, descripcion, apps, precio_mensual_gs, precio_anual_gs, polar_producto_mensual, polar_producto_anual, orden")
      .eq("activo", true)
      .order("orden"),
  ]);
  if (error || !estado) {
    console.error("pagos/estado: falta la migración 011 o falló la base", error?.code);
    return responder(request, 503, { message: "Los planes todavía no están disponibles." });
  }

  const tarjeta = polarConfigurado();
  const lista: PlanPublico[] = (planes ?? []).map((p) => ({
    id: p.id,
    nombre: p.nombre,
    descripcion: p.descripcion,
    apps: p.apps,
    precio_mensual_gs: Number(p.precio_mensual_gs),
    precio_anual_gs: Number(p.precio_anual_gs),
    tarjeta_mensual: tarjeta && !!p.polar_producto_mensual,
    tarjeta_anual: tarjeta && !!p.polar_producto_anual,
  }));

  const cuerpo: EstadoPlan = {
    ...(estado as EstadoPlan),
    planes: lista,
    cobro_activo: process.env.SUSCRIPCIONES_ACTIVAS === "true",
    tarjeta_disponible: tarjeta,
  };
  return responder(request, 200, cuerpo);
}
