"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Check, FileText, Trash2 } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { marcarObligacion } from "@/lib/data";
import { daysUntil, formatFecha, relativo } from "@/lib/dates";
import { getPlantilla } from "@/lib/plantillas";
import { useToast } from "@/components/ToastProvider";
import { CATEGORIA_COLOR, CATEGORIA_LABELS, type Empresa, type Obligacion } from "@/lib/types";

export function EstadoFecha({ o }: { o: Obligacion }) {
  if (o.estado === "hecho") return <span className="text-xs text-good">Hecho</span>;
  const n = daysUntil(o.fecha);
  const color = n < 0 ? "text-bad" : n <= 15 ? "text-cobre" : "text-carbon/55";
  return <span className={`text-xs font-medium ${color}`}>{n < 0 ? `Vencida ${relativo(o.fecha)}` : `Vence ${relativo(o.fecha)}`}</span>;
}

type OnChange = (id: string, patch: Partial<Obligacion> | null) => void;

/**
 * Marca una obligación como hecha o la reabre: actualiza la UI al instante
 * (optimista), guarda en Supabase y revierte si falla. Compartido por la
 * lista y el calendario de Vencimientos.
 */
export function useToggleObligacion(onChange: OnChange) {
  const { showToast } = useToast();
  return async function toggle(o: Obligacion) {
    const hecho = o.estado !== "hecho";
    onChange(o.id, { estado: hecho ? "hecho" : "pendiente", completado_en: hecho ? new Date().toISOString() : null });
    const { error } = await marcarObligacion(o.id, hecho);
    if (error) {
      showToast(`No se pudo actualizar: ${error.message}`, "error");
      onChange(o.id, { estado: o.estado, completado_en: o.completado_en });
    } else if (hecho) showToast("Marcada como hecha.");
  };
}

/**
 * Lista de obligaciones con check para marcar como hecha. Se usa en el
 * Resumen, en la ficha de cada empresa y en Vencimientos.
 */
export default function ObligacionesLista({
  obligaciones,
  empresas,
  onChange,
  mostrarEmpresa = false,
  compacta = false,
  vacio = "No hay vencimientos para mostrar.",
}: {
  obligaciones: Obligacion[];
  empresas?: Empresa[];
  onChange: OnChange;
  mostrarEmpresa?: boolean;
  compacta?: boolean;
  vacio?: string;
}) {
  const { showToast } = useToast();
  const toggle = useToggleObligacion(onChange);
  const [abierta, setAbierta] = useState<string | null>(null);
  const nombres = useMemo(() => new Map((empresas ?? []).map((e) => [e.id, e.denominacion])), [empresas]);

  async function borrar(o: Obligacion) {
    if (!confirm(`¿Eliminar "${o.titulo}"?`)) return;
    const { error } = await supabase.from("obligaciones").delete().eq("id", o.id);
    if (error) {
      showToast(`No se pudo eliminar: ${error.message}`, "error");
      return;
    }
    onChange(o.id, null);
    showToast("Vencimiento eliminado.");
  }

  if (obligaciones.length === 0) {
    return (
      <p className="rounded border border-dashed p-6 text-center text-sm text-carbon/60" style={{ borderColor: "var(--line)" }}>
        {vacio}
      </p>
    );
  }

  return (
    <ul className="divide-y rounded-sm border bg-white" style={{ borderColor: "var(--line)" }}>
      {obligaciones.map((o) => {
        const plantilla = getPlantilla(o.plantilla);
        const open = abierta === o.id;
        return (
          <li key={o.id} className="animate-row-in px-3 py-2.5" style={{ borderColor: "var(--line)" }}>
            <div className="flex items-start gap-3">
              <button
                type="button"
                onClick={() => toggle(o)}
                title={o.estado === "hecho" ? "Marcar como pendiente" : "Marcar como hecha"}
                className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-sm border transition ${
                  o.estado === "hecho" ? "border-good bg-good text-white" : "hover:border-cobre"
                }`}
                style={o.estado === "hecho" ? undefined : { borderColor: "var(--line)" }}
              >
                {o.estado === "hecho" && <Check size={13} className="animate-check-pop" />}
              </button>
              <div className="min-w-0 flex-1">
                <button type="button" onClick={() => setAbierta(open ? null : o.id)} className="block w-full text-left">
                  <span className={`text-sm ${o.estado === "hecho" ? "text-carbon/45 line-through" : "text-carbon"}`}>{o.titulo}</span>
                  <span className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5">
                    <span className="text-xs text-carbon/55">{formatFecha(o.fecha)}</span>
                    <EstadoFecha o={o} />
                    {mostrarEmpresa && <span className="text-xs text-carbon/55">{nombres.get(o.empresa_id) ?? ""}</span>}
                    {!compacta && (
                      <span className="inline-flex items-center gap-1 text-xs text-carbon/55">
                        <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: CATEGORIA_COLOR[o.categoria] }} />
                        {CATEGORIA_LABELS[o.categoria]}
                      </span>
                    )}
                  </span>
                </button>
                {open && (
                  <div className="animate-fade-in mt-2 space-y-2">
                    {o.descripcion && <p className="text-xs leading-relaxed text-carbon/70">{o.descripcion}</p>}
                    <div className="flex flex-wrap gap-3">
                      {plantilla && (
                        <Link
                          href={`/documentos?empresa=${o.empresa_id}&plantilla=${plantilla.key}`}
                          className="inline-flex items-center gap-1 text-xs font-medium text-cobre hover:underline"
                        >
                          <FileText size={13} /> Generar: {plantilla.titulo}
                        </Link>
                      )}
                      <button type="button" onClick={() => borrar(o)} className="inline-flex items-center gap-1 text-xs text-bad hover:underline">
                        <Trash2 size={13} /> Eliminar
                      </button>
                    </div>
                  </div>
                )}
              </div>
              {plantilla && !open && (
                <Link
                  href={`/documentos?empresa=${o.empresa_id}&plantilla=${plantilla.key}`}
                  title={`Generar: ${plantilla.titulo}`}
                  className="shrink-0 rounded-full p-1 text-carbon/40 transition hover:bg-cobre/10 hover:text-cobre-hover"
                >
                  <FileText size={15} />
                </Link>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/** Aplica el patch local que devuelve ObligacionesLista (null = borrada). */
export function aplicarCambio(lista: Obligacion[], id: string, patch: Partial<Obligacion> | null): Obligacion[] {
  if (patch === null) return lista.filter((o) => o.id !== id);
  return lista.map((o) => (o.id === id ? { ...o, ...patch } : o));
}
