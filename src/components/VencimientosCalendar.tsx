"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Check, ChevronLeft, ChevronRight, FileText, RotateCcw } from "lucide-react";
import { buildMonthWeeks, DOW_LABELS } from "@/lib/calendario";
import { daysUntil, formatFechaLarga, MESES, todayIso } from "@/lib/dates";
import { getPlantilla } from "@/lib/plantillas";
import { EstadoFecha, useToggleObligacion } from "@/components/ObligacionesLista";
import { CATEGORIA_COLOR, CATEGORIA_LABELS, type CategoriaObligacion, type Empresa, type Obligacion } from "@/lib/types";

type TonoDia = "atrasado" | "proximo" | "pendiente" | "hecho";

/** Fondo y texto de la celda según el estado más urgente del día. */
const TONO: Record<TonoDia, { bg: string; color: string; label: string }> = {
  atrasado: { bg: "rgba(178, 59, 59, 0.16)", color: "var(--color-bad)", label: "Atrasado" },
  proximo: { bg: "rgba(184, 115, 74, 0.22)", color: "var(--color-cobre-hover)", label: "Vence en ≤ 7 días" },
  pendiente: { bg: "#fff", color: "var(--color-carbon)", label: "Pendiente" },
  hecho: { bg: "rgba(63, 107, 82, 0.13)", color: "rgba(36, 37, 34, 0.55)", label: "Hecho" },
};

function tonoDe(lista: Obligacion[], hoy: string): TonoDia {
  const pendientes = lista.filter((o) => o.estado === "pendiente");
  if (pendientes.length === 0) return "hecho";
  if (pendientes.some((o) => o.fecha < hoy)) return "atrasado";
  if (pendientes.some((o) => daysUntil(o.fecha, hoy) <= 7)) return "proximo";
  return "pendiente";
}

/**
 * Calendario mensual de Vencimientos (mismo diseño que el "PnL diario" de
 * NODOS Finanzas): cada día se colorea por su obligación más urgente y lleva
 * un punto por obligación, del color de su categoría. Pasá el mouse o tocá
 * un día para ver el detalle; tocá para fijarlo y marcar tareas como hechas.
 */
export default function VencimientosCalendar({
  obligaciones,
  empresas,
  mostrarEmpresa = false,
  onChange,
  title = "Calendario de vencimientos",
}: {
  obligaciones: Obligacion[];
  empresas?: Empresa[];
  mostrarEmpresa?: boolean;
  onChange: (id: string, patch: Partial<Obligacion> | null) => void;
  title?: string;
}) {
  const toggle = useToggleObligacion(onChange);
  const [active, setActive] = useState<string | null>(null);
  const [pinned, setPinned] = useState<string | null>(null);
  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth() };
  });

  const hoy = todayIso();
  const nombres = useMemo(() => new Map((empresas ?? []).map((e) => [e.id, e.denominacion])), [empresas]);
  const byDate = useMemo(() => {
    const m = new Map<string, Obligacion[]>();
    for (const o of obligaciones) {
      const k = o.fecha.slice(0, 10);
      m.set(k, [...(m.get(k) ?? []), o]);
    }
    return m;
  }, [obligaciones]);

  const weeks = useMemo(() => buildMonthWeeks(cursor.year, cursor.month), [cursor]);
  const prefix = `${cursor.year}-${String(cursor.month + 1).padStart(2, "0")}`;
  const resumen = useMemo(() => {
    const delMes = obligaciones.filter((o) => o.fecha.startsWith(prefix));
    return {
      pendientes: delMes.filter((o) => o.estado === "pendiente" && o.fecha >= hoy).length,
      atrasadas: delMes.filter((o) => o.estado === "pendiente" && o.fecha < hoy).length,
      hechas: delMes.filter((o) => o.estado === "hecho").length,
    };
  }, [obligaciones, prefix, hoy]);

  // Categorías presentes en la lista filtrada (la leyenda no muestra ruido).
  const categorias = useMemo(() => {
    const presentes = new Set(obligaciones.map((o) => o.categoria));
    const keys = Object.keys(CATEGORIA_LABELS) as CategoriaObligacion[];
    const filtradas = keys.filter((k) => presentes.has(k));
    return filtradas.length > 0 ? filtradas : keys;
  }, [obligaciones]);

  const esMesActual = cursor.year === new Date().getFullYear() && cursor.month === new Date().getMonth();
  const shown = pinned ?? active;
  const shownList = shown ? byDate.get(shown) ?? [] : [];

  function goMonth(delta: number) {
    setPinned(null);
    setActive(null);
    setCursor((c) => {
      const d = new Date(c.year, c.month + delta, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });
  }

  function goToday() {
    const d = new Date();
    setPinned(null);
    setActive(null);
    setCursor({ year: d.getFullYear(), month: d.getMonth() });
  }

  return (
    <div className="card p-3! sm:p-5!">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <h3>{title}</h3>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-carbon/55">
          {(["atrasado", "proximo", "hecho"] as TonoDia[]).map((t) => (
            <span key={t} className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ background: TONO[t].bg, boxShadow: `inset 0 0 0 1px ${TONO[t].color}` }} />
              {TONO[t].label}
            </span>
          ))}
        </div>
      </div>

      <div className="mb-3 flex items-center justify-between gap-2">
        <button type="button" onClick={() => goMonth(-1)} className="rounded-sm p-1 text-carbon/60 hover:bg-carbon/5" aria-label="Mes anterior">
          <ChevronLeft size={16} />
        </button>
        <div className="flex min-w-0 flex-wrap items-baseline justify-center gap-x-2 gap-y-0.5 text-center">
          <span className="whitespace-nowrap text-sm font-medium capitalize text-carbon">
            {MESES[cursor.month]} {cursor.year}
          </span>
          {resumen.atrasadas > 0 && (
            <span className="whitespace-nowrap text-xs font-medium text-bad">
              {resumen.atrasadas} atrasada{resumen.atrasadas === 1 ? "" : "s"}
            </span>
          )}
          {resumen.pendientes > 0 && (
            <span className="whitespace-nowrap text-xs font-medium text-cobre-hover">
              {resumen.pendientes} pendiente{resumen.pendientes === 1 ? "" : "s"}
            </span>
          )}
          {resumen.hechas > 0 && (
            <span className="whitespace-nowrap text-xs font-medium text-good">
              {resumen.hechas} hecha{resumen.hechas === 1 ? "" : "s"}
            </span>
          )}
          {!esMesActual && (
            <button type="button" onClick={goToday} className="whitespace-nowrap text-xs font-medium text-cobre-hover hover:underline">
              Hoy
            </button>
          )}
        </div>
        <button type="button" onClick={() => goMonth(1)} className="rounded-sm p-1 text-carbon/60 hover:bg-carbon/5" aria-label="Mes siguiente">
          <ChevronRight size={16} />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center">
        {DOW_LABELS.map((label, i) => (
          <span key={i} className="text-[11px] text-carbon/40">
            {label}
          </span>
        ))}
        {weeks.flat().map((d) => {
          const lista = byDate.get(d.date);
          const has = !!lista && lista.length > 0;
          const tono = has ? TONO[tonoDe(lista, hoy)] : null;
          const isToday = d.date === hoy;
          const ring =
            pinned === d.date
              ? "inset 0 0 0 2px var(--color-carbon)"
              : isToday
                ? "inset 0 0 0 1.5px var(--color-cobre)"
                : has
                  ? "inset 0 0 0 1px rgba(52, 72, 58, 0.4)"
                  : "none";
          return (
            <button
              key={d.date}
              type="button"
              onMouseEnter={() => has && setActive(d.date)}
              onMouseLeave={() => setActive(null)}
              onClick={() => has && setPinned((p) => (p === d.date ? null : d.date))}
              aria-label={has ? `${formatFechaLarga(d.date)}: ${lista.length} vencimiento${lista.length === 1 ? "" : "s"}` : undefined}
              aria-pressed={has ? pinned === d.date : undefined}
              tabIndex={has ? 0 : -1}
              className="relative flex aspect-square min-w-0 flex-col items-center justify-center gap-1 overflow-hidden text-xs transition sm:aspect-auto sm:h-16 lg:h-[72px]"
              style={{
                borderRadius: "var(--radius-md)",
                background: tono ? tono.bg : d.inMonth ? "rgba(52, 72, 58, 0.05)" : "transparent",
                color: tono ? tono.color : d.inMonth ? "var(--color-carbon)" : "rgba(36,37,34,0.25)",
                boxShadow: ring,
                cursor: has ? "pointer" : "default",
                opacity: d.inMonth ? 1 : 0.4,
                fontWeight: has ? 600 : 400,
              }}
            >
              <span className="leading-none">{d.day}</span>
              {has &&
                (lista.length > 3 ? (
                  <span className="flex items-center gap-0.5 leading-none">
                    <span className="h-1.5 w-1.5 rounded-full" style={{ background: CATEGORIA_COLOR[lista[0].categoria] }} />
                    <span className="text-[9px] font-semibold tabular-nums">{lista.length}</span>
                  </span>
                ) : (
                  <span className="flex items-center gap-0.5">
                    {lista.map((o) => (
                      <span
                        key={o.id}
                        className="h-1.5 w-1.5 rounded-full sm:h-2 sm:w-2"
                        style={{ background: CATEGORIA_COLOR[o.categoria], opacity: o.estado === "hecho" ? 0.45 : 1 }}
                      />
                    ))}
                  </span>
                ))}
            </button>
          );
        })}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-carbon/55">
        {categorias.map((c) => (
          <span key={c} className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ background: CATEGORIA_COLOR[c] }} />
            {CATEGORIA_LABELS[c]}
          </span>
        ))}
      </div>

      <div className="mt-3 min-h-16 border-t pt-3 text-xs text-carbon/70" style={{ borderColor: "var(--line)" }}>
        {shown && shownList.length > 0 ? (
          <div className="animate-fade-in">
            <div className="mb-2 flex items-baseline justify-between gap-2">
              <span className="text-sm font-medium text-carbon">{formatFechaLarga(shown)}</span>
              {!pinned && <span className="hidden text-[11px] text-carbon/45 sm:inline">Hacé click para fijar el día</span>}
              {pinned && (
                <button type="button" onClick={() => setPinned(null)} className="text-[11px] text-carbon/50 hover:underline">
                  Cerrar
                </button>
              )}
            </div>
            <ul className="space-y-2">
              {shownList.map((o) => {
                const plantilla = getPlantilla(o.plantilla);
                const hecho = o.estado === "hecho";
                return (
                  <li key={o.id} className="flex items-start gap-2.5">
                    <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full" style={{ background: CATEGORIA_COLOR[o.categoria] }} />
                    <div className="min-w-0 flex-1">
                      <span className={`block text-sm ${hecho ? "text-carbon/45 line-through" : "text-carbon"}`}>{o.titulo}</span>
                      <span className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5">
                        <EstadoFecha o={o} />
                        {mostrarEmpresa && <span className="text-xs text-carbon/55">{nombres.get(o.empresa_id) ?? ""}</span>}
                        <span className="text-xs text-carbon/55">{CATEGORIA_LABELS[o.categoria]}</span>
                        {plantilla && (
                          <Link
                            href={`/documentos?empresa=${o.empresa_id}&plantilla=${plantilla.key}`}
                            className="inline-flex items-center gap-1 text-xs font-medium text-cobre-hover hover:underline"
                          >
                            <FileText size={12} /> Generar documento
                          </Link>
                        )}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => toggle(o)}
                      className={`inline-flex shrink-0 items-center gap-1 rounded-sm border px-2 py-1 text-xs font-medium transition ${
                        hecho ? "text-carbon/60 hover:bg-carbon/5" : "border-good text-good hover:bg-good hover:text-white"
                      }`}
                      style={hecho ? { borderColor: "var(--line)" } : undefined}
                    >
                      {hecho ? (
                        <>
                          <RotateCcw size={12} /> Reabrir
                        </>
                      ) : (
                        <>
                          <Check size={12} /> Hecha
                        </>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : obligaciones.length === 0 ? (
          <span>No hay vencimientos con estos filtros.</span>
        ) : (
          <span>Pasá el mouse (o tocá) un día para ver el detalle.</span>
        )}
      </div>
    </div>
  );
}
