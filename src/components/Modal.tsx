"use client";

import { useEffect } from "react";
import { X } from "lucide-react";

/** Diálogo modal de la marca: hoja desde abajo en celular, centrado desde sm. Cierra con Escape. */
export default function Modal({
  titulo,
  subtitulo,
  onClose,
  children,
  ancho = "max-w-3xl",
}: {
  titulo: string;
  subtitulo?: string;
  onClose: () => void;
  children: React.ReactNode;
  ancho?: string;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-carbon/40 p-0 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label={titulo}>
      <div className={`animate-slide-up max-h-[92vh] w-full ${ancho} overflow-y-auto rounded-t-[16px] bg-marfil p-4 shadow-xl sm:rounded-[16px] sm:p-6`}>
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="[overflow-wrap:anywhere]">{titulo}</h2>
            {subtitulo && <p className="mt-1 text-sm text-carbon/65">{subtitulo}</p>}
          </div>
          <button type="button" onClick={onClose} className="shrink-0 rounded-full p-1.5 text-carbon/50 hover:bg-white hover:text-carbon" title="Cerrar">
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
