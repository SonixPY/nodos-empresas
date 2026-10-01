// Secciones de NODOS Panel (solo administradores). El Panel de control, Leads,
// Contenido y Notas viven en NODOS Empresas; la Administración de cuentas
// existe en las dos apps (cada una usa la suya).
import { CalendarDays, LayoutDashboard, Newspaper, ShieldCheck, Users } from "lucide-react";
import { APP_ID } from "@/lib/nodos/app";
import { SITIOS } from "@/lib/nodos/sitios";

export const PANEL_SECCIONES = [
  { ruta: "/panel", label: "Panel de control", corto: "Resumen", icon: LayoutDashboard },
  { ruta: "/panel/leads", label: "Leads", corto: "Leads", icon: Users },
  { ruta: "/panel/contenido", label: "Contenido", corto: "Contenido", icon: CalendarDays },
  { ruta: "/panel/notas", label: "Notas", corto: "Notas", icon: Newspaper },
  { ruta: "/admin", label: "Administración de cuentas", corto: "Cuentas", icon: ShieldCheck },
] as const;

/** ¿La sección está en esta misma app? (si no, se abre en NODOS Empresas). */
export function panelEsLocal(ruta: string): boolean {
  return ruta === "/admin" || APP_ID === "empresas";
}

export function panelHref(ruta: string): string {
  return panelEsLocal(ruta) ? ruta : `${SITIOS.empresas.url}${ruta}`;
}

/** Sección activa según la ruta actual (solo cuenta para las secciones locales). */
export function panelSeccionActiva(pathname: string) {
  return PANEL_SECCIONES.find(
    (s) => panelEsLocal(s.ruta) && (s.ruta === "/panel" ? pathname === "/panel" : pathname === s.ruta || pathname.startsWith(`${s.ruta}/`)),
  );
}
