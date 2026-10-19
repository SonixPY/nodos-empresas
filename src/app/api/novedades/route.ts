/**
 * GET /api/novedades?t=dnit&t=seprelad&t=rubro-agro
 * Titulares para "Novedades para tus empresas", desde los feeds RSS que los
 * medios ofrecen para sindicación (lista fija en src/lib/novedadesRss.ts).
 *
 * ─── Garantías de privacidad (no aflojar sin revisar con el responsable) ───
 * 1. Solo se aceptan ids de tema del catálogo fijo del servidor
 *    (src/lib/novedades.ts → filtrarTemas). No se acepta texto libre: un id
 *    desconocido se descarta. Nunca llegan acá nombres de empresas, RUC,
 *    personas ni ningún otro dato de clientes.
 * 2. Este servidor baja SIEMPRE la misma lista fija de feeds, sin parámetros
 *    ni datos del usuario, y filtra acá con las palabras clave fijas de cada
 *    tema: los medios no ven qué temas pide nadie. No se monitorean nombres
 *    de empresas ni de personas (fuera de alcance a propósito).
 * 3. Los pedidos a los medios los hace este servidor, no el navegador, sin
 *    cookies. La caché es compartida entre usuarios.
 * 4. Requiere sesión iniciada (401 si no). No se registra (log) nada del
 *    usuario ni de los temas que pidió.
 * 5. El cruce "¿a qué empresa le afecta?" se hace en el navegador, con los
 *    datos propios del usuario bajo RLS; no pasa por acá.
 * 6. Los titulares se devuelven como texto plano y solo con links http(s);
 *    el cliente los muestra como texto (sin dangerouslySetInnerHTML) y abre
 *    los links con rel="noopener noreferrer" (sin referrer hacia los medios).
 *
 * Caché en memoria: cada feed 30 min (5 min si falló; lo ya bajado se
 * acumula, porque los feeds traen solo lo último) y el resultado por tema
 * normativa 3 h, rubro 30 min. No se usa el Data Cache de `fetch` porque
 * guardaría también las respuestas de error durante toda la ventana.
 */

import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { filtrarTemas, type Novedad, type Tema } from "@/lib/novedades";
import { agregarNovedades, filtrarItems, recortarTema, todosLosFeeds, type RssItem } from "@/lib/novedadesRss";

const TTL_MS = { normativa: 3 * 60 * 60 * 1000, rubro: 30 * 60 * 1000 } as const;
/** Si algún feed falló, el resultado del tema se recalcula en 5 min. */
const TTL_ERROR_MS = 5 * 60 * 1000;
/** Antigüedad máxima de un titular: la normativa sigue siendo útil por más tiempo. */
const MAX_EDAD_DIAS = { normativa: 180, rubro: 45 } as const;
const MAX_POR_TEMA = 8;
const MAX_TOTAL = 60;

const cache = new Map<string, { expira: number; items: RssItem[] }>();

type Feeds = Awaited<ReturnType<typeof todosLosFeeds>>;

/** `feeds` se llama solo si el tema no está en caché. */
async function novedadesDe(tema: Tema, feeds: () => Promise<Feeds>): Promise<RssItem[]> {
  const hit = cache.get(tema.id);
  if (hit && hit.expira > Date.now()) return hit.items;
  const f = await feeds();
  const items = recortarTema(filtrarItems(f, tema.filtro), MAX_POR_TEMA, MAX_EDAD_DIAS[tema.tipo]);
  const ok = f.every((x) => x.ok);
  cache.set(tema.id, { expira: Date.now() + (ok ? TTL_MS[tema.tipo] : TTL_ERROR_MS), items });
  return items;
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

  // Los feeds se piden una sola vez por request (y solo si algún tema no
  // está en caché); cada feed tiene su propia caché y falla por separado.
  let feeds: Promise<Feeds> | null = null;
  const lazyFeeds = () => (feeds ??= todosLosFeeds());
  const porTema = await Promise.all(temas.map(async (t) => ({ tema: t.id, items: await novedadesDe(t, lazyFeeds) })));
  const items: Novedad[] = agregarNovedades(porTema, MAX_TOTAL);

  return Response.json({ items, temas: temas.map((t) => t.id) }, { headers: { "Cache-Control": "private, max-age=600" } });
}
