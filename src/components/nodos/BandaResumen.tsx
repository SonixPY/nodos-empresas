"use client";

import { useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";

const CLAVE = "nodos:banda-minimizada";

function fechaLarga(): string {
  const s = new Date().toLocaleDateString("es-PY", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Banda verde del Resumen (idéntica en las dos apps): fecha, "Hola, <nombre>",
 * una línea de estado y, debajo, la tira de noticias o novedades. Se puede
 * minimizar; queda como la dejaste (se recuerda en este navegador).
 */
export default function BandaResumen({ nombre, subtitulo, etiqueta, children }: { nombre: string | null; subtitulo: string; etiqueta: string; children?: React.ReactNode }) {
  // Minimizada por defecto: se abre con un toque y queda como la dejaste.
  const [minimizada, setMinimizada] = useState(true);

  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (localStorage.getItem(CLAVE) === "0") setMinimizada(false);
    } catch {
      /* sin almacenamiento: queda minimizada */
    }
  }, []);

  function alternar() {
    setMinimizada((v) => {
      try {
        localStorage.setItem(CLAVE, v ? "0" : "1");
      } catch {
        /* sin almacenamiento */
      }
      return !v;
    });
  }

  const titulo = nombre ? `Hola, ${nombre}` : "Resumen";

  return (
    <section
      className={`relative mb-6 overflow-hidden rounded-2xl bg-musgo text-marfil transition-[padding] duration-300 ease-out ${minimizada ? "px-5 py-3.5 sm:px-6" : "px-5 py-7 sm:px-8"}`}
    >
      <div className="relative z-10">
        <div className="flex items-center justify-between gap-3">
          <button type="button" onClick={alternar} className="min-w-0 flex-1 text-left" aria-expanded={!minimizada} tabIndex={-1}>
            <span
              className={`block overflow-hidden text-sm transition-all duration-300 ${minimizada ? "max-h-12 opacity-100" : "max-h-0 opacity-0"}`}
              aria-hidden={!minimizada}
            >
              <span className="font-semibold">{titulo}</span>
              <span className="text-marfil/70"> · {subtitulo}</span>
            </span>
            <span
              className={`t-caption block overflow-hidden uppercase tracking-[0.14em] text-cobre transition-all duration-300 ${minimizada ? "max-h-0 opacity-0" : "max-h-8 opacity-100"}`}
              suppressHydrationWarning
            >
              {fechaLarga()}
            </span>
          </button>
          <button
            type="button"
            onClick={alternar}
            aria-expanded={!minimizada}
            className="group inline-flex shrink-0 items-center gap-1.5 rounded-full bg-marfil/10 px-3 py-1.5 text-xs font-medium text-marfil transition hover:bg-marfil/20"
          >
            <ChevronDown size={14} aria-hidden className={`transition-transform duration-300 ${minimizada ? "" : "rotate-180"}`} />
            {minimizada ? `Ver ${etiqueta}` : "Minimizar"}
          </button>
        </div>
        <div className={`grid transition-[grid-template-rows,opacity] duration-300 ease-out ${minimizada ? "grid-rows-[0fr] opacity-0" : "grid-rows-[1fr] opacity-100"}`}>
          <div className="min-h-0 overflow-hidden" aria-hidden={minimizada}>
            <h1 className="mt-1 !text-marfil">{titulo}</h1>
            <p className="t-body-lg mt-1 max-w-xl text-marfil/75">{subtitulo}</p>
            {children}
          </div>
        </div>
      </div>
      <svg
        aria-hidden="true"
        viewBox="0 0 220 220"
        className={`pointer-events-none absolute -right-10 -top-10 h-56 w-56 transition-opacity duration-300 ${minimizada ? "opacity-0" : "opacity-10"}`}
      >
        <g fill="none" stroke="#b8734a" strokeWidth="6" strokeLinejoin="round">
          <polyline points="110,118 66,118 54,106 54,64" />
          <polyline points="110,118 64,118 50,132" />
          <polyline points="110,118 110,74 122,62 157,62" />
        </g>
        <circle cx="110" cy="118" r="24" fill="#b8734a" />
      </svg>
    </section>
  );
}
