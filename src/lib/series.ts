// Series de videos de nodoscompliance.com: se editan en Panel → Series y el
// sitio las lee por /api/public/series. Funciones puras (sin Supabase) para
// poder probarlas: limpian lo que llega y explican qué falta.

export type EstadoSerie = "borrador" | "publicado";

export interface Fuente {
  titulo: string;
  url: string;
}

export interface Episodio {
  titulo: string;
  /** Vacío = todavía no publicado ("Próximamente" en el sitio). */
  url: string;
  /** Estreno (ISO 8601 con zona). Vacío = sin fecha. */
  fecha?: string;
  /** Duración en minutos. 0 = sin dato (se usa la duración de la serie). */
  minutos?: number;
  /** Fuentes del episodio (solo https). */
  fuentes?: Fuente[];
}

export interface Serie {
  id?: string;
  numero: number;
  titulo: string;
  descripcion: string;
  duracion: string;
  /** Lista de reproducción o canal. */
  url: string;
  episodios: Episodio[];
  estado: EstadoSerie;
  updated_at?: string;
}

export const LIMITES = { titulo: 120, descripcion: 600, duracion: 40, episodios: 60, tituloEpisodio: 140, url: 300, fuentes: 12, tituloFuente: 160, minutos: 180 } as const;

export const SERIE_NUEVA: Serie = {
  numero: 1,
  titulo: "",
  descripcion: "",
  duracion: "10 min aprox.",
  url: "",
  episodios: Array.from({ length: 10 }, () => ({ titulo: "", url: "", fecha: "", minutos: 0, fuentes: [] })),
  estado: "borrador",
};

const texto = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

/** Solo enlaces https (YouTube, Instagram, TikTok, etc.). */
export function urlValida(u: string): boolean {
  if (!u) return true;
  try {
    const x = new URL(u);
    return x.protocol === "https:" && !!x.hostname && u.length <= LIMITES.url;
  } catch {
    return false;
  }
}

/** Fecha ISO que el navegador entiende (vacía también vale). */
export function fechaValida(f: string): boolean {
  if (!f) return true;
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(f) && !Number.isNaN(Date.parse(f));
}

/** Próximo episodio sin publicar con fecha futura (o el primero con fecha si ya pasó todo). */
export function proximoEstreno(eps: Episodio[], ahora = Date.now()): { indice: number; fecha: string } | null {
  let mejor: { indice: number; fecha: string } | null = null;
  eps.forEach((e, i) => {
    if (e.url || !e.fecha) return;
    const t = Date.parse(e.fecha);
    if (Number.isNaN(t) || t < ahora - 6 * 3600_000) return;
    if (!mejor || t < Date.parse(mejor.fecha)) mejor = { indice: i, fecha: e.fecha };
  });
  return mejor;
}

/** Ordena y recorta lo que llega de la base o del formulario. */
export function limpiarSerie(s: Partial<Serie> & Record<string, unknown>): Serie {
  const eps = Array.isArray(s.episodios) ? (s.episodios as unknown[]) : [];
  return {
    ...(typeof s.id === "string" ? { id: s.id } : {}),
    numero: Math.trunc(Number(s.numero)) || 0,
    titulo: texto(s.titulo, LIMITES.titulo),
    descripcion: texto(s.descripcion, LIMITES.descripcion),
    duracion: texto(s.duracion, LIMITES.duracion),
    url: texto(s.url, LIMITES.url),
    episodios: eps.slice(0, LIMITES.episodios).map((e) => {
      const o = (e && typeof e === "object" ? e : {}) as Record<string, unknown>;
      const fuentes = (Array.isArray(o.fuentes) ? (o.fuentes as unknown[]) : []).slice(0, LIMITES.fuentes).map((f) => {
        const x = (f && typeof f === "object" ? f : {}) as Record<string, unknown>;
        return { titulo: texto(x.titulo, LIMITES.tituloFuente), url: texto(x.url, LIMITES.url) };
      });
      const min = Math.trunc(Number(o.minutos));
      return {
        titulo: texto(o.titulo, LIMITES.tituloEpisodio),
        url: texto(o.url, LIMITES.url),
        fecha: fechaValida(texto(o.fecha, 40)) ? texto(o.fecha, 40) : "",
        minutos: min > 0 && min <= LIMITES.minutos ? min : 0,
        fuentes,
      };
    }),
    estado: s.estado === "publicado" ? "publicado" : "borrador",
    ...(typeof s.updated_at === "string" ? { updated_at: s.updated_at } : {}),
  };
}

/** Errores en lenguaje simple; lista vacía = se puede guardar. */
export function validarSerie(s: Serie, numerosUsados: number[] = []): string[] {
  const e: string[] = [];
  if (!Number.isInteger(s.numero) || s.numero < 1 || s.numero > 999) e.push("El número de serie va de 1 a 999.");
  else if (numerosUsados.includes(s.numero)) e.push(`Ya hay una serie con el número ${s.numero}.`);
  if (s.titulo.length < 2) e.push("Poné un título de al menos 2 letras.");
  if (!urlValida(s.url)) e.push("El link de la serie tiene que empezar con https://.");
  if (s.episodios.length > LIMITES.episodios) e.push(`Máximo ${LIMITES.episodios} episodios.`);
  s.episodios.forEach((ep, i) => {
    if (!urlValida(ep.url)) e.push(`Episodio ${i + 1}: el link tiene que empezar con https://.`);
    if (ep.fecha && !fechaValida(ep.fecha)) e.push(`Episodio ${i + 1}: la fecha de estreno no es válida.`);
    (ep.fuentes ?? []).forEach((f, j) => {
      if (!f.url) e.push(`Episodio ${i + 1}, fuente ${j + 1}: falta el link.`);
      else if (!urlValida(f.url)) e.push(`Episodio ${i + 1}, fuente ${j + 1}: el link tiene que empezar con https://.`);
      if (f.url && f.titulo.length < 2) e.push(`Episodio ${i + 1}, fuente ${j + 1}: poné de dónde es (por ejemplo, "BCP, tasas de interés").`);
    });
  });
  if (s.estado === "publicado" && s.episodios.length === 0) e.push("Para publicarla, sumá al menos un episodio.");
  return e;
}

export const publicados = (s: Pick<Serie, "episodios">) => s.episodios.filter((e) => e.url && urlValida(e.url)).length;

/** Lo que ve el sitio: solo series publicadas, en orden, sin datos internos. */
export function paraSitio(filas: Record<string, unknown>[]) {
  return filas
    .map((f) => limpiarSerie(f))
    .filter((s) => s.estado === "publicado")
    .sort((a, b) => a.numero - b.numero)
    .map((s) => ({
      numero: String(s.numero).padStart(2, "0"),
      titulo: s.titulo,
      descripcion: s.descripcion,
      duracion: s.duracion,
      url: urlValida(s.url) ? s.url : "",
      episodios: s.episodios.map((ep) => ({
        titulo: ep.titulo,
        url: urlValida(ep.url) ? ep.url : "",
        fecha: ep.fecha ?? "",
        minutos: ep.minutos ?? 0,
        fuentes: (ep.fuentes ?? []).filter((f) => f.url && urlValida(f.url)),
      })),
    }));
}
