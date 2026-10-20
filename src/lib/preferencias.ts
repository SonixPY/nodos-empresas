"use client";

/**
 * Preferencias de NODOS Empresas guardadas en este navegador (comodidades de
 * cada persona, no datos: si se borran, todo sigue funcionando igual).
 */
export interface PreferenciasEmpresas {
  /** Empresa que se elige sola en Documentos y Vencimientos. */
  empresaPorDefecto: string | null;
  vistaVencimientos: "calendario" | "lista";
}

const CLAVE = "nodos-empresas:preferencias";
const BASE: PreferenciasEmpresas = { empresaPorDefecto: null, vistaVencimientos: "calendario" };

export function leerPreferencias(): PreferenciasEmpresas {
  try {
    const raw = localStorage.getItem(CLAVE);
    return raw ? { ...BASE, ...(JSON.parse(raw) as Partial<PreferenciasEmpresas>) } : BASE;
  } catch {
    return BASE;
  }
}

export function guardarPreferencias(p: PreferenciasEmpresas) {
  try {
    localStorage.setItem(CLAVE, JSON.stringify(p));
  } catch {
    /* sin almacenamiento */
  }
}
