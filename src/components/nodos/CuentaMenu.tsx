"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AtSign, ChevronDown, ChevronRight, Gauge, LifeBuoy, LogOut, UserRound } from "lucide-react";
import { SITIOS, nombreVisible } from "@/lib/nodos/sitios";
import { PANEL_SECCIONES, panelEsLocal, panelHref, panelSeccionActiva } from "@/lib/nodos/panel";
import { cerrarSesion } from "@/lib/nodos/usePerfil";
import type { PerfilVisible } from "@/lib/nodos/usePerfil";
import { useDesplegable } from "@/lib/nodos/useDesplegable";

/** Clase de un ítem del menú de cuenta (la usan también las herramientas propias de cada app). */
export const MENU_ITEM =
  "flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm text-carbon transition hover:bg-marfil focus-visible:bg-marfil focus-visible:outline-none disabled:cursor-wait disabled:opacity-60";

/** Encabezado de un grupo desplegable dentro del menú (NODOS Panel, Descargar). */
export function GrupoMenu({
  icon,
  label,
  abierto,
  onToggle,
  id,
  children,
}: {
  icon: ReactNode;
  label: string;
  abierto: boolean;
  onToggle: () => void;
  id: string;
  children: ReactNode;
}) {
  return (
    <div>
      <button type="button" role="menuitem" aria-expanded={abierto} aria-controls={id} onClick={onToggle} className={MENU_ITEM}>
        {icon}
        <span className="flex-1 font-medium">{label}</span>
        <ChevronDown size={15} aria-hidden className={`shrink-0 text-carbon/45 transition-transform duration-150 ${abierto ? "rotate-180" : ""}`} />
      </button>
      {abierto && (
        <div id={id} role="group" aria-label={label} className="mb-1 ml-[1.15rem] border-l border-[var(--line)] pl-1.5">
          {children}
        </div>
      )}
    </div>
  );
}

/**
 * Menú de cuenta del header: Mi cuenta, herramientas propias de la app (slot),
 * Soporte, NODOS Panel para administradores y Salir.
 */
export default function CuentaMenu({
  perfil,
  herramientas,
}: {
  perfil: PerfilVisible | null;
  /** Ítems propios de la app (Configuración, Importar, Descargar...). Recibe `cerrar`. */
  herramientas?: (cerrar: () => void) => ReactNode;
}) {
  const { open, cerrar: cerrarMenu, rootRef, triggerRef, panelRef, onTriggerClick, onTriggerKeyDown, onBlur, onPanelClick } = useDesplegable();
  const pathname = usePathname();
  const enPanel = !!panelSeccionActiva(pathname);
  const [panelAbierto, setPanelAbierto] = useState(enPanel);
  const cerrar = () => cerrarMenu();
  const nombre = nombreVisible(perfil);

  return (
    <div ref={rootRef} className="relative" onBlur={onBlur}>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls="nodos-cuenta"
        aria-label={`Cuenta y opciones (${nombre})`}
        title="Cuenta y opciones"
        onClick={onTriggerClick}
        onKeyDown={onTriggerKeyDown}
        className={`flex max-w-[12rem] items-center gap-1.5 rounded-full p-2 text-sm text-marfil transition sm:px-3 sm:py-1.5 ${
          open ? "bg-marfil/20" : "bg-marfil/10 hover:bg-marfil/15"
        }`}
      >
        <UserRound size={16} aria-hidden className="shrink-0" />
        <span className="hidden truncate sm:inline">{nombre}</span>
        <ChevronDown size={14} aria-hidden className={`hidden shrink-0 text-marfil/60 transition-transform duration-150 sm:block ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div
          ref={panelRef}
          id="nodos-cuenta"
          role="menu"
          aria-label="Cuenta y opciones"
          onClick={onPanelClick}
          className="absolute right-0 top-full z-30 mt-2 max-h-[calc(100dvh-5.5rem)] w-[min(19rem,calc(100vw-2rem))] overflow-y-auto overscroll-contain rounded-lg border border-[var(--line)] bg-white text-carbon shadow-lg"
        >
          <Link
            href="/cuenta"
            role="menuitem"
            className="flex items-center gap-3 border-b border-[var(--line)] bg-marfil/60 px-4 py-3 transition hover:bg-marfil focus-visible:bg-marfil focus-visible:outline-none"
          >
            <UserRound size={18} aria-hidden className="shrink-0 text-cobre" />
            <span className="min-w-0 flex-1">
              <span className="t-caption block text-carbon/55">Cuenta NODOS</span>
              <span className="block truncate text-sm font-medium text-musgo">{nombre}</span>
              {perfil && !perfil.usuario && (
                <span className="mt-0.5 flex items-center gap-1 text-xs text-cobre-hover">
                  <AtSign size={12} aria-hidden /> Elegí tu nombre de usuario
                </span>
              )}
            </span>
            <span className="flex shrink-0 items-center gap-0.5 text-xs text-carbon/55">
              Mi cuenta <ChevronRight size={14} aria-hidden />
            </span>
          </Link>

          {herramientas && <div className="border-b border-[var(--line)] p-1.5">{herramientas(cerrar)}</div>}

          <div className="p-1.5">
            <Link href="/soporte" role="menuitem" className={MENU_ITEM}>
              <LifeBuoy size={16} aria-hidden className="shrink-0 text-musgo" /> Soporte
            </Link>
            {perfil?.isAdmin && (
              <GrupoMenu
                id="nodos-panel-grupo"
                icon={<Gauge size={16} aria-hidden className="shrink-0 text-musgo" />}
                label="NODOS Panel"
                abierto={panelAbierto}
                onToggle={() => setPanelAbierto((v) => !v)}
              >
                {PANEL_SECCIONES.map((s) => {
                  const Icon = s.icon;
                  const activo = panelSeccionActiva(pathname)?.ruta === s.ruta;
                  const contenido = (
                    <>
                      <Icon size={15} aria-hidden className="shrink-0 text-cobre" />
                      <span className="flex-1">{s.label}</span>
                    </>
                  );
                  const clase = `${MENU_ITEM} py-1.5 ${activo ? "bg-marfil font-medium text-musgo" : ""}`;
                  return panelEsLocal(s.ruta) ? (
                    <Link key={s.ruta} href={s.ruta} role="menuitem" aria-current={activo ? "page" : undefined} className={clase}>
                      {contenido}
                    </Link>
                  ) : (
                    <a key={s.ruta} href={panelHref(s.ruta)} role="menuitem" className={clase} title={`Se abre en ${SITIOS.empresas.nombre}`}>
                      {contenido}
                    </a>
                  );
                })}
              </GrupoMenu>
            )}
          </div>

          <div className="border-t border-[var(--line)] p-1.5">
            <button type="button" role="menuitem" onClick={cerrarSesion} className={`${MENU_ITEM} text-cobre-hover`}>
              <LogOut size={16} aria-hidden className="shrink-0" /> Salir
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
