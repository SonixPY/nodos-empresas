import type { Novedad } from "@/lib/novedades";

/**
 * Parser mínimo de RSS 2.0 para Google News (adaptado de NODOS Finanzas,
 * src/lib/noticiasRss.ts). Solo extrae texto plano: los titulares se
 * muestran como texto, nunca como HTML.
 */

/** Item crudo de un feed RSS de Google News. */
export interface RssItem {
  titulo: string;
  fuente: string;
  url: string;
  fecha: string;
}

const ENTIDADES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

export function decodificarEntidades(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === "#") {
      const cp = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(cp) && cp > 0 && cp <= 0x10ffff ? String.fromCodePoint(cp) : "";
    }
    return ENTIDADES[e.toLowerCase()] ?? m;
  });
}

/** Contenido de texto de un elemento: saca CDATA, tags internos y decodifica
 * entidades. Las entidades se decodifican DESPUÉS de sacar tags, y el
 * resultado se renderiza como texto en React, así que un "&lt;script&gt;"
 * termina como texto visible, nunca como HTML. */
function texto(raw: string | undefined): string {
  if (!raw) return "";
  const sinCdata = raw.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1");
  return decodificarEntidades(sinCdata.replace(/<[^>]+>/g, " "))
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tag(bloque: string, nombre: string): string | undefined {
  const m = bloque.match(new RegExp(`<${nombre}(?:\\s[^>]*)?>([\\s\\S]*?)</${nombre}>`, "i"));
  return m?.[1];
}

const MAX_TITULO = 300;
const MAX_FUENTE = 80;
const MAX_URL = 2000;

/** En Google News el título viene como "Titular - Fuente": si hay <source>,
 * se le saca ese sufijo. Descarta items sin título o con link que no sea
 * http(s). */
export function parsearRss(xml: string): RssItem[] {
  const out: RssItem[] = [];
  const items = xml.match(/<item(?:\s[^>]*)?>[\s\S]*?<\/item>/gi) ?? [];
  for (const it of items) {
    let titulo = texto(tag(it, "title"));
    const fuente = texto(tag(it, "source")).slice(0, MAX_FUENTE);
    const url = texto(tag(it, "link"));
    const pub = texto(tag(it, "pubDate"));
    if (!titulo || url.length > MAX_URL || !/^https?:\/\/[^\s]+$/i.test(url)) continue;
    if (fuente && titulo.endsWith(` - ${fuente}`)) titulo = titulo.slice(0, -(fuente.length + 3)).trim();
    const t = Date.parse(pub);
    out.push({ titulo: titulo.slice(0, MAX_TITULO), fuente, url, fecha: Number.isNaN(t) ? "" : new Date(t).toISOString() });
  }
  return out;
}

function claveTitulo(t: string): string {
  return t
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const porFechaDesc = (a: { fecha: string }, b: { fecha: string }) => (b.fecha || "").localeCompare(a.fecha || "");

/** Junta los items de varias búsquedas de UN tema: deduplica (URL y titular
 * normalizado), descarta los más viejos que `maxEdadDias` (los sin fecha se
 * conservan al final), ordena del más nuevo al más viejo y corta en `max`. */
export function combinarBusquedas(listas: RssItem[][], max: number, maxEdadDias: number, ahora = Date.now()): RssItem[] {
  const limite = ahora - maxEdadDias * 86_400_000;
  const vistos = new Set<string>();
  const out: RssItem[] = [];
  for (const it of listas.flat().sort(porFechaDesc)) {
    if (it.fecha && Date.parse(it.fecha) < limite) continue;
    const kT = claveTitulo(it.titulo);
    if (vistos.has(it.url) || vistos.has(kT)) continue;
    vistos.add(it.url);
    vistos.add(kT);
    out.push(it);
    if (out.length >= max) break;
  }
  return out;
}

/** Junta varios temas: deduplica entre temas (el primero en la lista se
 * queda con el titular, por eso el catálogo pone lo específico antes que lo
 * general) y ordena del más nuevo al más viejo. */
export function agregarNovedades(porTema: { tema: string; items: RssItem[] }[], maxTotal: number): Novedad[] {
  const vistos = new Set<string>();
  const out: Novedad[] = [];
  for (const { tema, items } of porTema) {
    for (const it of items) {
      const kT = claveTitulo(it.titulo);
      if (vistos.has(it.url) || vistos.has(kT)) continue;
      vistos.add(it.url);
      vistos.add(kT);
      out.push({ ...it, tema });
    }
  }
  return out.sort(porFechaDesc).slice(0, maxTotal);
}

export function urlGoogleNews(query: string): string {
  return `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=es-419&gl=PY&ceid=PY:es-419`;
}
