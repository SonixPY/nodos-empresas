// Series de videos de nodoscompliance.com: se editan en Panel → Series y el
// sitio las lee por /api/public/series. Funciones puras (sin Supabase) para
// poder probarlas: limpian lo que llega y explican qué falta.

export type EstadoSerie = "borrador" | "publicado";

export interface Episodio {
  titulo: string;
  /** Vacío = todavía no publicado ("Próximamente" en el sitio). */
  url: string;
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

export const LIMITES = { titulo: 120, descripcion: 600, duracion: 40, episodios: 60, tituloEpisodio: 140, url: 300 } as const;

export const SERIE_NUEVA: Serie = {
  numero: 1,
  titulo: "",
  descripcion: "",
  duracion: "10 min aprox.",
  url: "",
  episodios: Array.from({ length: 10 }, () => ({ titulo: "", url: "" })),
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
      return { titulo: texto(o.titulo, LIMITES.tituloEpisodio), url: texto(o.url, LIMITES.url) };
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
      episodios: s.episodios.map((ep) => ({ titulo: ep.titulo, url: urlValida(ep.url) ? ep.url : "" })),
    }));
}
