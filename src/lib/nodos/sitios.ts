// Datos compartidos de las tres páginas NODOS. Este archivo es idéntico en
// finanzas-app y nodos-empresas: si lo cambiás, cambialo en los dos.

export type AppId = "finanzas" | "empresas";

export const DOMINIO_RAIZ = "nodoscompliance.com";

export const SITIOS = {
  inicio: {
    nombre: "NODOS",
    url: "https://nodoscompliance.com",
    descripcion: "El punto de encuentro entre finanzas, proyectos y ley.",
  },
  finanzas: {
    nombre: "NODOS Finanzas",
    corto: "Finanzas",
    url: "https://finanzas.nodoscompliance.com",
    descripcion: "Inversiones digitales y tradicionales, trading y gastos en un solo lugar.",
  },
  empresas: {
    nombre: "NODOS Empresas",
    corto: "Empresas",
    url: "https://empresas.nodoscompliance.com",
    descripcion: "Actas, vencimientos, libro de accionistas y cumplimiento SEPRELAD.",
  },
} as const;

/** Correo del departamento de IT al que llegan los pedidos de soporte. */
export const SOPORTE_EMAIL = process.env.NEXT_PUBLIC_SOPORTE_EMAIL || "soporte@nodoscompliance.com";

/** Cookie que marca que el navegador ya pasó al inicio de sesión compartido. */
export const SSO_FLAG = "nodos_sso";

/**
 * Dominio de las cookies de sesión. En producción es ".nodoscompliance.com",
 * así una sola sesión sirve para finanzas.* y empresas.*. En localhost o en
 * las URLs de preview de Vercel queda undefined (cookie del propio host).
 */
export function cookieDomainFor(host?: string | null): string | undefined {
  if (!host) return undefined;
  const h = host.split(":")[0].toLowerCase();
  return h === DOMINIO_RAIZ || h.endsWith(`.${DOMINIO_RAIZ}`) ? `.${DOMINIO_RAIZ}` : undefined;
}
