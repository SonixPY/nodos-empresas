"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { useCarrera } from "./CarreraProvider";
import { LeccionNodo, gs } from "./piezas";

/** Resumen que aparece al cerrar el mes, con las lecciones de NODO. */
export default function ResumenMesModal() {
  const { resumen, verResumen, contenido, carrera, nuevaCarreraTrasFin } = useCarrera();
  const cerrarRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!resumen) return;
    cerrarRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && verResumen(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [resumen, verResumen]);

  if (!resumen) return null;
  const diferencia = resumen.patrimonioDespues - resumen.patrimonioAntes;
  const termino = carrera && carrera.estado !== "activa";
  const filas = [...resumen.ingresos, ...resumen.movimientos, ...resumen.gastos];

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-carbon/60 p-0 sm:items-center sm:p-6" onClick={() => verResumen(null)}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="resumen-titulo"
        className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-t-2xl bg-marfil p-5 shadow-2xl sm:rounded-2xl sm:p-7"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="t-caption uppercase tracking-[0.1em] text-carbon/60">Cierre del mes {resumen.mes}</p>
            <h2 id="resumen-titulo">{termino ? "La carrera terminó" : "Así cerró tu mes"}</h2>
          </div>
          <button ref={cerrarRef} type="button" onClick={() => verResumen(null)} className="btn btn-ghost !px-3" aria-label="Cerrar el resumen">
            <X size={18} aria-hidden />
          </button>
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-3 sm:gap-3">
          <div className="flex items-baseline justify-between gap-3 rounded-lg border border-[var(--line)] bg-[var(--superficie)] px-3 py-2 sm:block sm:p-3">
            <p className="text-xs text-carbon/65">Patrimonio</p>
            <p className="font-display text-lg font-semibold">{gs(resumen.patrimonioDespues)}</p>
          </div>
          <div className="flex items-baseline justify-between gap-3 rounded-lg border border-[var(--line)] bg-[var(--superficie)] px-3 py-2 sm:block sm:p-3">
            <p className="text-xs text-carbon/65">Cambio del mes</p>
            <p className={`font-display text-lg font-semibold ${diferencia < 0 ? "text-bad" : "text-good"}`}>{gs(diferencia, true)}</p>
          </div>
          <div className="flex items-baseline justify-between gap-3 rounded-lg border border-[var(--line)] bg-[var(--superficie)] px-3 py-2 sm:block sm:p-3">
            <p className="text-xs text-carbon/65">Salud financiera</p>
            <p className="font-display text-lg font-semibold">{resumen.indiceSalud} / 100</p>
          </div>
        </div>

        {resumen.avisos.length > 0 && (
          <ul className="mt-4 space-y-1.5">
            {resumen.avisos.map((a, i) => (
              <li key={i} className="rounded-md border border-cobre/50 bg-cobre/10 px-3 py-2 text-sm">
                {a}
              </li>
            ))}
          </ul>
        )}

        <details className="mt-4 rounded-lg border border-[var(--line)] bg-[var(--superficie)] px-4 py-2">
          <summary className="cursor-pointer py-1 text-sm font-medium">Movimientos del mes ({filas.length})</summary>
          <ul className="mt-2 divide-y divide-[var(--line)] text-sm">
            {filas.map((f, i) => (
              <li key={i} className="flex justify-between gap-3 py-1.5">
                <span>{f.concepto}</span>
                <span className={f.monto < 0 ? "text-bad" : "text-good"}>{gs(f.monto, true)}</span>
              </li>
            ))}
          </ul>
        </details>

        {resumen.lecciones.length > 0 && (
          <div className="mt-6 space-y-4">
            {resumen.lecciones.map((l) => (
              <LeccionNodo key={l.situacion} l={l} aviso={contenido?.situaciones.get(l.situacion)?.aviso} />
            ))}
          </div>
        )}

        <div className="mt-6 flex flex-wrap gap-2">
          {termino ? (
            <button type="button" className="btn btn-primary" onClick={nuevaCarreraTrasFin}>
              Empezar otra carrera
            </button>
          ) : (
            <button type="button" className="btn btn-primary" onClick={() => verResumen(null)}>
              Seguir al mes {carrera?.mes}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
