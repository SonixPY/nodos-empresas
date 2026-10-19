import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { SITIOS } from "@/lib/nodos/sitios";

/**
 * Freno por cuenta: cuántos eventos de este tipo registró la cuenta en los
 * últimos `minutos` (en eventos_pago, que solo lee el servidor).
 */
export async function demasiadosIntentos(
  admin: SupabaseClient,
  userId: string,
  tipo: string,
  max: number,
  minutos = 10
): Promise<boolean> {
  const desde = new Date(Date.now() - minutos * 60 * 1000).toISOString();
  const { count, error } = await admin
    .from("eventos_pago")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("tipo", tipo)
    .gte("created_at", desde);
  if (error) return false;
  return (count ?? 0) >= max;
}

/**
 * App a la que vuelve la cuenta después de pagar: la que hizo el pedido si es
 * una de las apps NODOS (o localhost en desarrollo); si no, Empresas.
 */
export function urlApp(request: Request): string {
  const origin = request.headers.get("origin");
  if (origin === SITIOS.finanzas.url || origin === SITIOS.empresas.url) return origin;
  if (origin && /^http:\/\/localhost(:\d+)?$/.test(origin)) return origin;
  return SITIOS.empresas.url;
}
