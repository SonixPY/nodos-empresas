"use client";

import { useEffect, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

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
  const [minimizada, setMinimizada] = useState(false);

  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (localStorage.getItem(CLAVE) === "1") setMinimizada(true);
    } catch {
      /* sin almacenamiento: queda abierta */
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
  const boton = (
    <button
      type="button"
      onClick={alternar}
      aria-expanded={!minimizada}
      className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-marfil/10 px-3 py-1.5 text-xs font-medium text-marfil transition hover:bg-marfil/20"
    >
      {minimizada ? <ChevronDown size={14} aria-hidden /> : <ChevronUp size={14} aria-hidden />}
      {minimizada ? `Ver ${etiqueta}` : "Minimizar"}
    </button>
  );

  if (minimizada) {
    return (
      <section className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-musgo px-5 py-3.5 text-marfil sm:px-6">
        <p className="min-w-0 flex-1 text-sm">
          <span className="font-semibold">{titulo}</span>
          <span className="text-marfil/70"> · {subtitulo}</span>
        </p>
        {boton}
      </section>
    );
  }

  return (
    <section className="relative mb-6 overflow-hidden rounded-2xl bg-musgo px-5 py-7 text-marfil sm:px-8">
      <div className="relative z-10">
        <div className="flex items-start justify-between gap-3">
          <p className="t-caption uppercase tracking-[0.14em] text-cobre" suppressHydrationWarning>
            {fechaLarga()}
          </p>
          {boton}
        </div>
        <h1 className="mt-1 !text-marfil">{titulo}</h1>
        <p className="t-body-lg mt-1 max-w-xl text-marfil/75">{subtitulo}</p>
        {children}
      </div>
      <svg aria-hidden="true" viewBox="0 0 220 220" className="pointer-events-none absolute -right-10 -top-10 h-56 w-56 opacity-10">
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
