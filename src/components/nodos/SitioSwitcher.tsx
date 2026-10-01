"use client";

import Link from "next/link";
import { Building2, ChevronDown, Globe, Wallet } from "lucide-react";
import { APP_ID } from "@/lib/nodos/app";
import { SITIOS } from "@/lib/nodos/sitios";
import { useDesplegable } from "@/lib/nodos/useDesplegable";

const PAGINAS = [
  { id: "inicio", icon: Globe, nombre: "NODOS", detalle: "Sitio principal. El punto de encuentro entre finanzas, proyectos y ley.", url: SITIOS.inicio.url },
  { id: "finanzas", icon: Wallet, nombre: SITIOS.finanzas.nombre, detalle: SITIOS.finanzas.descripcion, url: SITIOS.finanzas.url },
  { id: "empresas", icon: Building2, nombre: SITIOS.empresas.nombre, detalle: SITIOS.empresas.descripcion, url: SITIOS.empresas.url },
] as const;

/**
 * Logo + nombre de la app en el header. Al pasar el mouse o tocarlo despliega
 * las páginas NODOS (sitio principal, Finanzas, Empresas) con la misma sesión.
 */
export default function SitioSwitcher() {
  const { open, rootRef, triggerRef, panelRef, onTriggerClick, onTriggerKeyDown, onPointerEnter, onPointerLeave, onBlur, onPanelClick } =
    useDesplegable({ hover: true });
  const actual = SITIOS[APP_ID];

  return (
    <div ref={rootRef} className="relative min-w-0" onPointerEnter={onPointerEnter} onPointerLeave={onPointerLeave} onBlur={onBlur}>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls="nodos-sitios"
        aria-label={`${actual.nombre}: cambiar de página NODOS`}
        onClick={onTriggerClick}
        onKeyDown={onTriggerKeyDown}
        className={`-ml-1.5 flex min-w-0 items-center gap-2 rounded-full py-1 pl-1.5 pr-2 text-base text-marfil transition sm:text-lg ${
          open ? "bg-marfil/10" : "hover:bg-marfil/10"
        }`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/isotipo.svg" alt="" width={28} height={28} className="h-7 w-7 shrink-0" />
        <span className="whitespace-nowrap leading-none">
          <span className="wordmark">NODOS</span> <span className="font-display font-normal">{actual.corto}</span>
        </span>
        <ChevronDown size={15} aria-hidden className={`shrink-0 text-marfil/60 transition-transform duration-150 ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        // pt-2 en vez de margen: el mouse pasa del nombre al panel sin "hueco".
        <div className="absolute left-0 top-full z-30 pt-2">
          <div
            ref={panelRef}
            id="nodos-sitios"
            role="menu"
            aria-label="Páginas NODOS"
            onClick={onPanelClick}
            className="w-[min(20rem,calc(100vw-2rem))] overflow-hidden rounded-lg border border-[var(--line)] bg-white p-1.5 text-carbon shadow-lg"
          >
            <p className="t-caption px-3 pb-1 pt-1.5 uppercase tracking-[0.12em] text-carbon/45">Páginas NODOS</p>
            <ul>
              {PAGINAS.map((p) => {
                const esActual = p.id === APP_ID;
                const Icon = p.icon;
                const contenido = (
                  <>
                    <Icon size={18} className="mt-0.5 shrink-0 text-cobre" aria-hidden />
                    <span className="min-w-0">
                      <span className="flex flex-wrap items-baseline gap-x-2 text-sm font-medium text-musgo">
                        {p.nombre}
                        {esActual && <span className="t-caption text-carbon/45">estás acá</span>}
                      </span>
                      <span className="block text-xs leading-snug text-carbon/55">{p.detalle}</span>
                    </span>
                  </>
                );
                const clase = `flex items-start gap-3 rounded-md px-3 py-2.5 transition hover:bg-marfil focus-visible:bg-marfil focus-visible:outline-none ${
                  esActual ? "bg-marfil" : ""
                }`;
                return (
                  <li key={p.id} role="none">
                    {esActual ? (
                      <Link href="/" role="menuitem" aria-current="page" className={clase}>
                        {contenido}
                      </Link>
                    ) : (
                      <a href={p.url} role="menuitem" className={clase}>
                        {contenido}
                      </a>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
