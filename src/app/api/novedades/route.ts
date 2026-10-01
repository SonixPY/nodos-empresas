/**
 * GET /api/novedades?t=dnit&t=seprelad&t=rubro-agro
 * Titulares de Google News (RSS) para "Novedades para tus empresas".
 *
 * ─── Garantías de privacidad (no aflojar sin revisar con el responsable) ───
 * 1. Solo se aceptan ids de tema del catálogo fijo del servidor
 *    (src/lib/novedades.ts → filtrarTemas). No se acepta texto libre: un id
 *    desconocido se descarta. Nunca llegan acá nombres de empresas, RUC,
 *    personas ni ningún otro dato de clientes.
 * 2. Las búsquedas que salen a Google News se arman SOLO con las `queries`
 *    fijas de ese catálogo: son idénticas para todos los clientes y no
 *    revelan quién pregunta. No se monitorean nombres de empresas ni de
 *    personas (fuera de alcance a propósito).
 * 3. El pedido a Google lo hace este servidor, no el navegador, sin cookies
 *    ni datos del usuario. La caché es compartida entre usuarios y por id de
 *    tema: mientras está vigente, Google ni siquiera ve un pedido nuevo.
 * 4. Requiere sesión iniciada (401 si no). No se registra (log) nada del
 *    usuario ni de los temas que pidió.
 * 5. El cruce "¿a qué empresa le afecta?" se hace en el navegador, con los
 *    datos propios del usuario bajo RLS; no pasa por acá.
 * 6. Los titulares se devuelven como texto plano y solo con links http(s);
 *    el cliente los muestra como texto (sin dangerouslySetInnerHTML) y abre
 *    los links con rel="noopener noreferrer" (sin referrer hacia los medios).
 *
 * Caché en memoria por tema: normativa 3 h, rubro 30 min, fallas 5 min. No
 * se usa el Data Cache de `fetch` porque guardaría también las respuestas de
 * error de Google (429/503) durante toda la ventana.
 */

import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { filtrarTemas, type Novedad, type Tema } from "@/lib/novedades";
import { agregarNovedades, combinarBusquedas, parsearRss, urlGoogleNews, type RssItem } from "@/lib/novedadesRss";

const TTL_MS = { normativa: 3 * 60 * 60 * 1000, rubro: 30 * 60 * 1000 } as const;
const TTL_ERROR_MS = 5 * 60 * 1000;
/** Antigüedad máxima de un titular: la normativa sigue siendo útil por más tiempo. */
const MAX_EDAD_DIAS = { normativa: 180, rubro: 45 } as const;
const TIMEOUT_MS = 6000;
const MAX_POR_TEMA = 8;
const MAX_TOTAL = 60;

const cache = new Map<string, { expira: number; items: RssItem[] }>();
/** Pedidos en curso por tema: si llegan varios usuarios a la vez, se hace uno solo. */
const enCurso = new Map<string, Promise<RssItem[]>>();

async function buscar(query: string): Promise<RssItem[] | null> {
  try {
    const res = await fetch(urlGoogleNews(query), {
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
      // Sin cookies ni datos del usuario: solo un User-Agent genérico.
      headers: { "User-Agent": "Mozilla/5.0 (compatible; NodosEmpresas/1.0)", Accept: "application/rss+xml, application/xml, text/xml" },
    });
    if (!res.ok) return null;
    return parsearRss(await res.text());
  } catch {
    // Red caída o timeout: se reintenta en unos minutos.
    return null;
  }
}

async function cargarTema(tema: Tema): Promise<RssItem[]> {
  const resultados = await Promise.all(tema.queries.map(buscar));
  const ok = resultados.some((r) => r !== null);
  const items = combinarBusquedas(
    resultados.map((r) => r ?? []),
    MAX_POR_TEMA,
    MAX_EDAD_DIAS[tema.tipo]
  );
  cache.set(tema.id, { expira: Date.now() + (ok ? TTL_MS[tema.tipo] : TTL_ERROR_MS), items });
  return items;
}

async function novedadesDe(tema: Tema): Promise<RssItem[]> {
  const hit = cache.get(tema.id);
  if (hit && hit.expira > Date.now()) return hit.items;
  let p = enCurso.get(tema.id);
  if (!p) {
    p = cargarTema(tema).finally(() => enCurso.delete(tema.id));
    enCurso.set(tema.id, p);
  }
  return p;
}

export async function GET(request: Request) {
  let user = null;
  try {
    const supabase = await createSupabaseServerClient();
    user = (await supabase.auth.getUser()).data.user;
  } catch {
    user = null;
  }
  if (!user) return Response.json({ message: "No autenticado." }, { status: 401 });

  const temas = filtrarTemas(new URL(request.url).searchParams.getAll("t"));
  if (temas.length === 0) return Response.json({ items: [], temas: [] }, { headers: { "Cache-Control": "private, max-age=600" } });

  const porTema = await Promise.all(temas.map(async (t) => ({ tema: t.id, items: await novedadesDe(t) })));
  const items: Novedad[] = agregarNovedades(porTema, MAX_TOTAL);

  return Response.json({ items, temas: temas.map((t) => t.id) }, { headers: { "Cache-Control": "private, max-age=600" } });
}
