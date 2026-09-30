"use client";

import { useState, type ReactNode } from "react";

/** Sección plegable reutilizada por las listas de toda la app (historial de
 * movimientos de acciones, historial de documentos,
 * etc.) — para que la página no muestre todo abierto de entrada y se sienta
 * más limpia. El contenido "principal" de cada pantalla arranca abierto
 * (`defaultOpen`); lo secundario/histórico arranca cerrado. */
export default function Accordion({
  title,
  subtitle,
  defaultOpen = false,
  badge,
  icon,
  iconAccent,
  children,
}: {
  title: string;
  subtitle?: string;
  defaultOpen?: boolean;
  /** Texto corto a la derecha del título (ej. cantidad de filas), visible
   * incluso con la sección cerrada. */
  badge?: string;
  /** Ícono opcional a la izquierda del título, en un círculo de color —
   * usado en Configuración para que cada sección se distinga de un
   * vistazo. Opcional para no romper el resto de los usos del componente. */
  icon?: ReactNode;
  iconAccent?: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="card">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 text-left"
        aria-expanded={open}
      >
        <span className="flex items-center gap-3">
          {icon && (
            <span
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
              style={{ background: iconAccent ? `${iconAccent}1a` : "rgba(184,115,74,0.1)", color: iconAccent ?? "var(--color-cobre)" }}
            >
              {icon}
            </span>
          )}
          <span>
            <span className="text-sm">{title}</span>
            {subtitle && <span className="mt-0.5 block text-xs text-carbon/60">{subtitle}</span>}
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-2">
          {badge && <span className="text-xs text-carbon/50">{badge}</span>}
          <svg
            width="14"
            height="14"
            viewBox="0 0 16 16"
            fill="none"
            className={`text-carbon/50 transition-transform ${open ? "rotate-180" : ""}`}
          >
            <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      </button>
      {open && <div className="mt-4 animate-fade-in">{children}</div>}
    </div>
  );
}
