"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { PANEL_SECCIONES, panelEsLocal, panelHref, panelSeccionActiva } from "@/lib/nodos/panel";

/**
 * Encabezado de NODOS Panel (solo administradores): ruta "NODOS Panel ·
 * sección" y pestañas con todas las secciones, incluida la Administración de
 * cuentas. Lo usan las páginas del Panel (Empresas) y /admin (las dos apps).
 */
export default function PanelNav() {
  const pathname = usePathname();
  const actual = panelSeccionActiva(pathname);

  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3 border-b border-[var(--line)] pb-4">
      <div className="min-w-0">
        <p className="t-caption uppercase tracking-[0.14em] text-cobre-hover">Centro de comandos · solo administradores</p>
        <p className="font-display text-xl font-bold text-musgo">
          <span className="wordmark">NODOS</span> <span className="font-normal">Panel</span>
          {actual && (
            <span className="text-base font-normal text-carbon/60">
              <span aria-hidden className="mx-1.5 text-carbon/35">
                ·
              </span>
              {actual.label}
            </span>
          )}
        </p>
      </div>
      <nav
        className="segmented max-w-full overflow-x-auto [scrollbar-width:none] [&>a]:flex [&>a]:shrink-0 [&>a]:items-center [&>a]:gap-1.5 [&>a]:whitespace-nowrap"
        aria-label="Secciones de NODOS Panel"
      >
        {PANEL_SECCIONES.map((s) => {
          const activo = actual?.ruta === s.ruta;
          const Icon = s.icon;
          const contenido = (
            <>
              <Icon size={14} aria-hidden />
              <span className="sm:hidden">{s.corto}</span>
              <span className="hidden sm:inline">{s.ruta === "/admin" ? s.label : s.corto}</span>
            </>
          );
          return panelEsLocal(s.ruta) ? (
            <Link key={s.ruta} href={s.ruta} aria-current={activo ? "page" : undefined} className={activo ? "active" : ""}>
              {contenido}
            </Link>
          ) : (
            <a key={s.ruta} href={panelHref(s.ruta)}>
              {contenido}
            </a>
          );
        })}
      </nav>
    </div>
  );
}
