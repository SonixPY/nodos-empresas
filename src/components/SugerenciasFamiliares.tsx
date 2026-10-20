"use client";

import { useMemo, useState } from "react";
import { Lightbulb, Loader2, Plus } from "lucide-react";
import { sugerenciasAnuales } from "@/lib/calendario";
import { agregarSugerencia } from "@/lib/data";
import { formatFecha } from "@/lib/dates";
import { useToast } from "@/components/ToastProvider";
import { esSociedad, type Empresa, type Obligacion } from "@/lib/types";

/**
 * Buenas prácticas de empresa familiar que NO son obligaciones legales
 * (revisión de libros, de poderes, reunión de gobierno y sucesión). Antes se
 * cargaban solas; ahora el usuario elige cuáles sumar a su calendario.
 */
export default function SugerenciasFamiliares({
  empresas,
  obligaciones,
  onAgregada,
}: {
  empresas: Empresa[];
  obligaciones: Obligacion[];
  onAgregada: (o: Obligacion) => void;
}) {
  const { showToast } = useToast();
  const [abierto, setAbierto] = useState(false);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const anio = new Date().getFullYear();

  const lista = useMemo(() => {
    const ya = new Set(obligaciones.map((o) => `${o.empresa_id}|${o.regla}|${o.anio}`));
    return empresas
      .filter((e) => esSociedad(e.tipo))
      .flatMap((e) => [...sugerenciasAnuales(e, anio), ...sugerenciasAnuales(e, anio + 1)].map((o) => ({ o, empresa: e })))
      .filter(({ o }) => !ya.has(`${o.empresa_id}|${o.regla}|${o.anio}`))
      .slice(0, 12);
  }, [empresas, obligaciones, anio]);

  if (lista.length === 0) return null;

  async function agregar(clave: string, o: (typeof lista)[number]["o"]) {
    setOcupado(clave);
    const r = await agregarSugerencia(o);
    setOcupado(null);
    if (r.error) return showToast(`No se pudo agregar: ${r.error}`, "error");
    if (r.obligacion) onAgregada(r.obligacion);
    showToast("Agregado a tu calendario.");
  }

  return (
    <section className="card mb-5">
      <button type="button" className="flex w-full items-center justify-between gap-3 text-left" onClick={() => setAbierto((v) => !v)} aria-expanded={abierto}>
        <span className="flex items-center gap-2">
          <Lightbulb size={17} className="text-cobre" aria-hidden />
          <span>
            <span className="block font-semibold text-musgo">Sugerencias para empresas familiares</span>
            <span className="block text-xs text-carbon/55">Buenas prácticas, no obligaciones legales: sumá las que te sirvan ({lista.length}).</span>
          </span>
        </span>
        <span className="text-xs font-medium text-cobre-hover">{abierto ? "Ocultar" : "Ver"}</span>
      </button>
      {abierto && (
        <ul className="mt-3 divide-y divide-[var(--line)]">
          {lista.map(({ o, empresa }) => {
            const clave = `${o.empresa_id}|${o.regla}|${o.anio}`;
            return (
              <li key={clave} className="flex flex-wrap items-start gap-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-carbon">{o.titulo}</p>
                  <p className="text-xs text-carbon/55">
                    {formatFecha(o.fecha)} · {empresa.denominacion}
                  </p>
                  <p className="mt-0.5 text-xs leading-snug text-carbon/60">{o.descripcion}</p>
                </div>
                <button type="button" className="btn btn-ghost shrink-0" disabled={ocupado === clave} onClick={() => agregar(clave, o)}>
                  {ocupado === clave ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Agregar
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
