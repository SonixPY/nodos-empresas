"use client";

import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import { useToggleObligacion } from "@/components/ObligacionesLista";
import { daysUntil, MESES, parseIso } from "@/lib/dates";
import type { Empresa, Obligacion } from "@/lib/types";

function cuando(o: Obligacion): { texto: string; clase: string } {
  if (o.estado === "hecho") return { texto: "Hecha", clase: "text-good" };
  const n = daysUntil(o.fecha);
  if (n < 0) return { texto: `Atrasado ${-n} día${n === -1 ? "" : "s"}`, clase: "font-medium text-bad" };
  if (n === 0) return { texto: "Vence hoy", clase: "font-medium text-cobre-hover" };
  if (n === 1) return { texto: "Vence mañana", clase: "font-medium text-cobre-hover" };
  return { texto: `En ${n} días`, clase: n <= 15 ? "font-medium text-cobre-hover" : "text-carbon/55" };
}

/** Lista corta de lo que vence (atrasados primero) con el check "Hecha".
 * Usa el mismo helper optimista que la lista completa de Vencimientos. */
export default function ProximosVencimientos({
  obligaciones,
  empresas,
  onChange,
  pie,
}: {
  obligaciones: Obligacion[];
  empresas: Empresa[];
  onChange: (id: string, patch: Partial<Obligacion> | null) => void;
  /** Línea opcional al pie de la lista (p. ej. actualizar calendarios). */
  pie?: React.ReactNode;
}) {
  const toggle = useToggleObligacion(onChange);
  const nombres = new Map(empresas.map((e) => [e.id, e.denominacion]));

  return (
    <section aria-labelledby="proximos-titulo">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 id="proximos-titulo">Próximos vencimientos</h2>
        <Link href="/vencimientos" className="group inline-flex shrink-0 items-center gap-1 whitespace-nowrap text-xs font-medium text-cobre-hover hover:underline">
          Ver calendario <ArrowRight size={12} className="transition group-hover:translate-x-0.5" />
        </Link>
      </div>

      {obligaciones.length === 0 ? (
        <div className="rounded-[var(--radius-md)] border border-dashed bg-white/60 p-6 text-center text-sm text-carbon/60" style={{ borderColor: "var(--line)" }}>
          No tenés vencimientos pendientes.
          {pie && <div className="mt-2">{pie}</div>}
        </div>
      ) : (
        <div className="overflow-hidden rounded-[var(--radius-md)] border bg-white" style={{ borderColor: "var(--line)" }}>
          <ul className="divide-y" style={{ borderColor: "var(--line)" }}>
            {obligaciones.map((o) => {
              const d = parseIso(o.fecha);
              const hecha = o.estado === "hecho";
              const atrasada = !hecha && daysUntil(o.fecha) < 0;
              const c = cuando(o);
              return (
                <li
                  key={o.id}
                  className="animate-row-in flex items-center gap-3 px-3 py-3 sm:px-4"
                  style={{ borderColor: "var(--line)", background: atrasada ? "rgba(178,59,59,0.045)" : undefined }}
                >
                  <div
                    className={`flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-[var(--radius-md)] leading-none ${
                      atrasada ? "bg-bad/10 text-bad" : hecha ? "bg-marfil text-carbon/40" : "bg-marfil text-musgo"
                    }`}
                    aria-hidden="true"
                  >
                    <span className="font-display text-[17px] font-semibold tabular-nums">{d.getDate()}</span>
                    <span className="mt-0.5 text-[10px] font-semibold uppercase tracking-wider opacity-70">{MESES[d.getMonth()].slice(0, 3)}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/empresas/${o.empresa_id}?tab=vencimientos`}
                      className={`line-clamp-2 text-sm font-medium leading-snug hover:underline ${hecha ? "text-carbon/45 line-through" : "text-carbon"}`}
                    >
                      {o.titulo}
                    </Link>
                    <p className="mt-0.5 flex min-w-0 items-center gap-1.5 text-xs">
                      <span className={`shrink-0 ${c.clase}`}>{c.texto}</span>
                      {nombres.get(o.empresa_id) && (
                        <>
                          <span className="text-carbon/30" aria-hidden="true">
                            ·
                          </span>
                          <span className="truncate text-carbon/55">{nombres.get(o.empresa_id)}</span>
                        </>
                      )}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => toggle(o)}
                    aria-pressed={hecha}
                    title={hecha ? "Volver a pendiente" : "Marcar como hecha"}
                    className={`inline-flex h-8 w-8 shrink-0 items-center justify-center gap-1 rounded-full border text-xs font-medium transition sm:h-auto sm:w-auto sm:px-2.5 sm:py-1 ${
                      hecha ? "border-good bg-good text-white" : "border-[var(--line)] text-carbon/65 hover:border-good hover:text-good"
                    }`}
                  >
                    <Check size={14} className={hecha ? "animate-check-pop" : undefined} />
                    <span className="max-sm:sr-only">Hecha</span>
                  </button>
                </li>
              );
            })}
          </ul>
          {pie && (
            <div className="border-t px-3 py-2.5 text-xs text-carbon/55 sm:px-4" style={{ borderColor: "var(--line)" }}>
              {pie}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
