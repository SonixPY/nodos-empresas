/**
 * Tabla oficial de ciudades del RO (kit SEPRELAD, 137.571 ciudades del país y
 * del exterior). Para no cargar 7 MB en el navegador se guarda de forma
 * compacta: un código es válido si está entre 1 y `maximo` y no figura entre
 * los `faltantes`. Los nombres se guardan solo para Paraguay, que es donde se
 * busca por nombre.
 */
import codigos from "./datos/ciudades-codigos.json";
import paraguay from "./datos/ciudades-py.json";

const FALTANTES = new Set<number>(codigos.faltantes);
const NOMBRES_PY = paraguay as Record<string, string>;

const clave = (s: string) =>
  s
    .normalize("NFKD")
    .replace(/[^\x00-\x7F]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .trim();

const POR_NOMBRE = new Map<string, number[]>();
for (const [cod, nombre] of Object.entries(NOMBRES_PY)) {
  const k = clave(nombre);
  POR_NOMBRE.set(k, [...(POR_NOMBRE.get(k) ?? []), Number(cod)]);
}

export function ciudadExiste(cod: number): boolean {
  return Number.isInteger(cod) && cod >= 1 && cod <= codigos.maximo && !FALTANTES.has(cod);
}

/** Códigos de las ciudades de Paraguay con ese nombre (clave normalizada). */
export function ciudadesPorNombre(nombreNormalizado: string): number[] {
  return POR_NOMBRE.get(nombreNormalizado) ?? [];
}

/** Nombre de una ciudad de Paraguay, o null si es del exterior o no existe. */
export function nombreCiudadPy(cod: number): string | null {
  return NOMBRES_PY[String(cod)] ?? null;
}

export const CIUDADES_PY = Object.entries(NOMBRES_PY)
  .map(([cod, nombre]) => ({ cod: Number(cod), nombre }))
  .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
