"use client";

import { useEffect, useState } from "react";
import { CircleHelp, X } from "lucide-react";

/**
 * Guía corta de una pantalla (idéntica en las dos apps): tres o cuatro
 * pasos de cómo se usa. Se cierra con "Entendido" y queda un botón "Cómo
 * funciona" para volver a verla. Se recuerda en este navegador.
 */
export default function GuiaPagina({ id, titulo, pasos }: { id: string; titulo: string; pasos: string[] }) {
  const clave = `nodos:guia:${id}`;
  const [abierta, setAbierta] = useState<boolean | null>(null);

  useEffect(() => {
    let vista = false;
    try {
      vista = localStorage.getItem(clave) === "1";
    } catch {
      /* sin almacenamiento: se muestra */
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAbierta(!vista);
  }, [clave]);

  function cerrar() {
    setAbierta(false);
    try {
      localStorage.setItem(clave, "1");
    } catch {
      /* sin almacenamiento */
    }
  }

  if (abierta === null) return null;
  if (!abierta) {
    return (
      <button type="button" onClick={() => setAbierta(true)} className="mb-4 inline-flex items-center gap-1.5 text-xs font-medium text-carbon/55 hover:text-cobre-hover">
        <CircleHelp size={14} aria-hidden /> Cómo funciona esta pantalla
      </button>
    );
  }
  return (
    <section className="animate-fade-in mb-5 rounded-lg border p-4 sm:p-5" style={{ borderColor: "rgba(184,115,74,0.4)", background: "rgba(184,115,74,0.05)" }} aria-label={titulo}>
      <div className="flex items-start justify-between gap-3">
        <p className="flex items-center gap-2 font-semibold text-musgo">
          <CircleHelp size={17} className="shrink-0 text-cobre" aria-hidden /> {titulo}
        </p>
        <button type="button" onClick={cerrar} className="-m-1 grid h-8 w-8 shrink-0 place-items-center rounded-md text-carbon/45 hover:bg-marfil hover:text-carbon" aria-label="Cerrar la guía">
          <X size={16} />
        </button>
      </div>
      <ol className="mt-3 grid gap-2 sm:grid-cols-2">
        {pasos.map((p, i) => (
          <li key={i} className="flex items-start gap-2.5 text-sm text-carbon/75">
            <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-cobre text-[12px] font-semibold text-white" aria-hidden>
              {i + 1}
            </span>
            <span className="pt-0.5 leading-snug">{p}</span>
          </li>
        ))}
      </ol>
      <button type="button" onClick={cerrar} className="btn btn-ghost mt-3 !px-3 !py-1.5 text-[13px]">
        Entendido
      </button>
    </section>
  );
}
