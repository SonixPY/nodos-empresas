import type { Novedad } from "@/lib/novedades";

/**
 * Titulares de feeds RSS/Atom que los propios medios publican para
 * sindicación (titular + link + fecha). Solo servidor: lo usa /api/novedades.
 * Mismo motor que NODOS Finanzas (src/lib/noticiasRss.ts), con otra lista
 * de feeds.
 *
 * Privacidad: el servidor pide SIEMPRE la misma lista fija de feeds (FEEDS),
 * sin parámetros, cookies ni datos del usuario; el filtrado por tema se hace
 * acá, después de bajar el feed. Ningún tercero ve qué temas, empresas ni
 * rubros tiene nadie. No se usa Google News (su RSS es para uso personal).
 *
 * Solo se extrae texto plano: los titulares se muestran como texto (nunca
 * HTML) y los links se aceptan solo si son http(s).
 */

// ── Fuentes ──────────────────────────────────────────────────────────────

export interface Feed {
  id: string;
  /** Nombre del medio: es lo que se muestra como fuente. */
  nombre: string;
  url: string;
}

/** Feeds verificados el 2026-10-15 (respondían RSS 2.0 válido). Ofrecidos
 * públicamente por cada medio como RSS. */
export const FEEDS = [
  { id: "lanacion", nombre: "La Nación", url: "https://www.lanacion.com.py/arc/outboundfeeds/rss/?outputType=xml" },
  { id: "lanacion-negocios", nombre: "La Nación", url: "https://www.lanacion.com.py/arc/outboundfeeds/rss/category/negocios/?outputType=xml" },
  { id: "abc-nacionales", nombre: "ABC Color", url: "https://www.abc.com.py/arc/outboundfeeds/rss/nacionales/?outputType=xml" },
  { id: "abc", nombre: "ABC Color", url: "https://www.abc.com.py/arc/outboundfeeds/rss/noticias-del-dia/?outputType=xml" },
] as const satisfies readonly Feed[];

export type FeedId = (typeof FEEDS)[number]["id"];

// ── Parser ───────────────────────────────────────────────────────────────

/** Item de un feed. `texto` (titular + resumen normalizados) solo sirve
 * para filtrar en el servidor: nunca se devuelve al cliente. */
export interface RssItem {
  titulo: string;
  fuente: string;
  url: string;
  fecha: string;
  texto: string;
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

const SIN_SCRIPTS = /<(script|style)\b[\s\S]*?<\/\1\s*>/gi;
const SIN_TAGS = /<[^>]*>/g;

/** Texto plano de un elemento: saca CDATA, scripts y tags, y decodifica
 * entidades dos veces (hay feeds que escapan el HTML dos veces, p. ej.
 * Atom type="html"), sacando tags después de cada paso. El resultado se
 * renderiza como texto en React, nunca como HTML. */
export function textoPlano(raw: string | undefined): string {
  if (!raw) return "";
  let t = raw.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1");
  for (let i = 0; i < 2; i++) t = decodificarEntidades(t.replace(SIN_SCRIPTS, " ").replace(SIN_TAGS, " "));
  return t
    .replace(SIN_SCRIPTS, " ")
    .replace(SIN_TAGS, " ")
    .replace(/[\u0000-\u001f\u007f-\u009f​-‏‪-‮⁦-⁩]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tag(bloque: string, nombre: string): string | undefined {
  const m = bloque.match(new RegExp(`<${nombre}(?:\\s[^>]*)?>([\\s\\S]*?)</${nombre}>`, "i"));
  return m?.[1];
}

/** href del <link> de Atom (rel="alternate" o sin rel). */
function linkAtom(bloque: string): string {
  const links = bloque.match(/<link\b[^>]*>/gi) ?? [];
  for (const l of links) {
    const rel = l.match(/\brel\s*=\s*["']([^"']*)["']/i)?.[1];
    const href = l.match(/\bhref\s*=\s*["']([^"']*)["']/i)?.[1];
    if (href && (!rel || rel === "alternate")) return decodificarEntidades(href).trim();
  }
  return "";
}

const MAX_TITULO = 300;
const MAX_FUENTE = 80;
const MAX_URL = 2000;
const MAX_TEXTO = 600;
const MAX_ITEMS_FEED = 100;

/** Minúsculas, sin tildes, solo letras y dígitos separados por un espacio,
 * con espacios en los extremos (para comparar palabras enteras). */
export function normalizar(s: string): string {
  return ` ${s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()} `;
}

/** Solo http(s), sin espacios ni credenciales. Si el link es http y apunta
 * al mismo dominio del feed (que es https), se pasa a https. */
export function urlSegura(raw: string, feedUrl?: string): string | null {
  if (!raw || raw.length > MAX_URL || !/^https?:\/\/[^\s]+$/i.test(raw)) return null;
  try {
    const u = new URL(raw);
    if ((u.protocol !== "https:" && u.protocol !== "http:") || u.username || u.password) return null;
    if (u.protocol === "http:" && feedUrl) {
      const base = new URL(feedUrl).hostname.replace(/^www\./, "");
      if (u.hostname === base || u.hostname.endsWith(`.${base}`)) u.protocol = "https:";
    }
    return u.href;
  } catch {
    return null;
  }
}

/** Parser mínimo de RSS 2.0 y Atom. Tolera feeds cortados (se descarta el
 * último item incompleto). `fuente` es el nombre fijo del medio. */
export function parsearFeed(xml: string, fuente: string, feedUrl?: string, ahora = Date.now()): RssItem[] {
  const out: RssItem[] = [];
  const bloques = xml.match(/<item(?:\s[^>]*)?>[\s\S]*?<\/item>/gi) ?? xml.match(/<entry(?:\s[^>]*)?>[\s\S]*?<\/entry>/gi) ?? [];
  for (const b of bloques) {
    if (out.length >= MAX_ITEMS_FEED) break;
    const atom = /^<entry/i.test(b);
    const titulo = textoPlano(tag(b, "title")).slice(0, MAX_TITULO).trim();
    const crudo = atom ? linkAtom(b) || textoPlano(tag(b, "id")) : textoPlano(tag(b, "link")) || textoPlano(tag(b, "guid"));
    const url = urlSegura(crudo, feedUrl);
    if (!titulo || !url) continue;
    const pub = textoPlano(tag(b, "pubDate") ?? tag(b, "published") ?? tag(b, "updated") ?? tag(b, "dc:date"));
    const t = Date.parse(pub);
    // Fechas inválidas o en el futuro (más de 1 h) quedan sin fecha.
    const fecha = Number.isNaN(t) || t > ahora + 3_600_000 ? "" : new Date(t).toISOString();
    const resumen = textoPlano(tag(b, "description") ?? tag(b, "summary")).slice(0, MAX_TEXTO);
    out.push({ titulo, fuente: fuente.slice(0, MAX_FUENTE), url, fecha, texto: normalizar(`${titulo} ${resumen}`) });
  }
  return out;
}

// ── Filtro por palabras clave ────────────────────────────────────────────

/** Palabras clave: se comparan sin tildes ni mayúsculas, como palabra o
 * frase entera; con "*" al final, como prefijo ("ganad*" → "ganadería"). */
export function coincide(textoNormalizado: string, claves: readonly string[]): boolean {
  for (const c of claves) {
    const prefijo = c.endsWith("*");
    const n = normalizar(prefijo ? c.slice(0, -1) : c);
    if (n.trim() === "") continue;
    if (textoNormalizado.includes(prefijo ? n.slice(0, -1) : n)) return true;
  }
  return false;
}

/** Qué items de qué feeds le corresponden a un tema. */
export interface FiltroTema {
  /** Basta con que aparezca una. Vacío = el tema no trae nada. */
  claves: readonly string[];
  /** Si está, además tiene que aparecer una de estas. */
  y?: readonly string[];
  /** Feeds de los que entra todo, sin mirar claves (secciones temáticas). */
  todoDe?: readonly FeedId[];
}

export function filtrarItems(porFeed: { feed: FeedId; items: RssItem[] }[], f: FiltroTema): RssItem[] {
  const out: RssItem[] = [];
  for (const { feed, items } of porFeed) {
    const todo = f.todoDe?.includes(feed) ?? false;
    for (const it of items) {
      if (todo || (coincide(it.texto, f.claves) && (!f.y || coincide(it.texto, f.y)))) out.push(it);
    }
  }
  return out.sort(porFechaDesc);
}

// ── Descarga con límites y caché ─────────────────────────────────────────

const USER_AGENT = "NODOS-Empresas/1.0 (+https://empresas.nodoscompliance.com; lector de titulares RSS)";
const TIMEOUT_MS = 6000;
const MAX_BYTES = 1_500_000;
const TTL_OK_MS = 30 * 60 * 1000;
const TTL_ERROR_MS = 5 * 60 * 1000;
/** Lo que se acumula por feed entre descargas (los feeds traen solo lo último). */
const MAX_ACUMULADOS = 300;
/** Igual a la edad máxima de la normativa en /api/novedades. */
const MAX_EDAD_ACUMULADO_MS = 180 * 86_400_000;

/** Lee el cuerpo hasta `max` bytes (lo que sobra se descarta: el parser
 * tolera el XML cortado) y lo decodifica según el encoding declarado. */
async function leerAcotado(res: Response, max: number): Promise<string> {
  const reader = res.body?.getReader();
  if (!reader) return "";
  const partes: Uint8Array[] = [];
  let total = 0;
  while (total < max) {
    const { done, value } = await reader.read();
    if (done || !value) break;
    const resto = max - total;
    partes.push(value.length > resto ? value.subarray(0, resto) : value);
    total += Math.min(value.length, resto);
  }
  reader.cancel().catch(() => {});
  const bytes = new Uint8Array(total);
  let off = 0;
  for (const p of partes) {
    bytes.set(p, off);
    off += p.length;
  }
  const cabecera = new TextDecoder("latin1").decode(bytes.subarray(0, 200));
  const enc = cabecera.match(/encoding\s*=\s*["']([\w-]+)["']/i)?.[1]?.toLowerCase();
  const latin = enc === "iso-8859-1" || enc === "latin1" || enc === "windows-1252";
  return new TextDecoder(latin ? "windows-1252" : "utf-8").decode(bytes);
}

async function descargar(feed: Feed): Promise<RssItem[] | null> {
  try {
    const res = await fetch(feed.url, {
      cache: "no-store",
      redirect: "follow",
      signal: AbortSignal.timeout(TIMEOUT_MS),
      // Sin cookies ni datos del usuario.
      headers: { "User-Agent": USER_AGENT, Accept: "application/rss+xml, application/atom+xml, application/xml;q=0.9, text/xml;q=0.8" },
    });
    if (!res.ok) {
      res.body?.cancel().catch(() => {});
      return null;
    }
    return parsearFeed(await leerAcotado(res, MAX_BYTES), feed.nombre, feed.url);
  } catch {
    return null;
  }
}

/** Une lo nuevo con lo acumulado: sin repetidos por URL, sin lo viejo, del
 * más nuevo al más viejo y acotado. */
export function acumular(previos: RssItem[], nuevos: RssItem[], ahora = Date.now()): RssItem[] {
  const vistos = new Set<string>();
  const out: RssItem[] = [];
  for (const it of [...nuevos, ...previos]) {
    if (vistos.has(it.url)) continue;
    if (it.fecha && Date.parse(it.fecha) < ahora - MAX_EDAD_ACUMULADO_MS) continue;
    vistos.add(it.url);
    out.push(it);
  }
  return out.sort(porFechaDesc).slice(0, MAX_ACUMULADOS);
}

interface EstadoFeed {
  items: RssItem[];
  /** false si la última descarga falló (se sirve lo acumulado). */
  ok: boolean;
}

const cache = new Map<string, EstadoFeed & { expira: number }>();
const enCurso = new Map<string, Promise<EstadoFeed>>();

/** Items de un feed: de la caché (compartida entre usuarios) o descargando.
 * Si un feed falla, se sigue con lo acumulado y se reintenta en 5 min; la
 * falla de un feed no afecta a los demás. */
export function itemsDeFeed(feed: Feed): Promise<EstadoFeed> {
  const hit = cache.get(feed.id);
  if (hit && hit.expira > Date.now()) return Promise.resolve(hit);
  let p = enCurso.get(feed.id);
  if (!p) {
    p = descargar(feed)
      .then((nuevos) => {
        const estado = { items: acumular(hit?.items ?? [], nuevos ?? []), ok: nuevos !== null };
        cache.set(feed.id, { ...estado, expira: Date.now() + (estado.ok ? TTL_OK_MS : TTL_ERROR_MS) });
        return estado;
      })
      .finally(() => enCurso.delete(feed.id));
    enCurso.set(feed.id, p);
  }
  return p;
}

export async function todosLosFeeds(): Promise<({ feed: FeedId } & EstadoFeed)[]> {
  return Promise.all(FEEDS.map(async (f) => ({ feed: f.id, ...(await itemsDeFeed(f)) })));
}

// ── Agregado ─────────────────────────────────────────────────────────────

function claveTitulo(t: string): string {
  return normalizar(t).trim();
}

const porFechaDesc = (a: { fecha: string }, b: { fecha: string }) => (b.fecha || "").localeCompare(a.fecha || "");

/** Items de UN tema: descarta los más viejos que `maxEdadDias` (los sin
 * fecha se conservan al final), deduplica por URL y titular, y corta en `max`. */
export function recortarTema(items: RssItem[], max: number, maxEdadDias: number, ahora = Date.now()): RssItem[] {
  const limite = ahora - maxEdadDias * 86_400_000;
  const vistos = new Set<string>();
  const out: RssItem[] = [];
  for (const it of [...items].sort(porFechaDesc)) {
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
      // Campos explícitos: `texto` no sale del servidor.
      out.push({ titulo: it.titulo, fuente: it.fuente, url: it.url, fecha: it.fecha, tema });
    }
  }
  return out.sort(porFechaDesc).slice(0, maxTotal);
}
