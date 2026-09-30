"use client";

import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { useEmpresas, useObligaciones } from "@/lib/data";
import { MESES, parseIso, todayIso } from "@/lib/dates";
import ObligacionesLista, { aplicarCambio } from "@/components/ObligacionesLista";
import ObligacionForm from "@/components/ObligacionForm";
import { SkeletonTable } from "@/components/Skeleton";
import { CATEGORIA_LABELS, type CategoriaObligacion, type Obligacion } from "@/lib/types";

type Estado = "pendientes" | "atrasados" | "hechas" | "todas";

export default function VencimientosPage() {
  const empresas = useEmpresas();
  const obligaciones = useObligaciones(null);
  const [empresa, setEmpresa] = useState("todas");
  const [categoria, setCategoria] = useState<CategoriaObligacion | "todas">("todas");
  const [estado, setEstado] = useState<Estado>("pendientes");
  const [nueva, setNueva] = useState(false);

  const filtradas = useMemo(() => {
    const hoy = todayIso();
    return obligaciones.data.filter((o) => {
      if (empresa !== "todas" && o.empresa_id !== empresa) return false;
      if (categoria !== "todas" && o.categoria !== categoria) return false;
      if (estado === "pendientes") return o.estado === "pendiente";
      if (estado === "atrasados") return o.estado === "pendiente" && o.fecha < hoy;
      if (estado === "hechas") return o.estado === "hecho";
      return true;
    });
  }, [obligaciones.data, empresa, categoria, estado]);

  // Agrupadas por mes, para leer el año como un calendario.
  const grupos = useMemo(() => {
    const m = new Map<string, Obligacion[]>();
    for (const o of filtradas) {
      const d = parseIso(o.fecha);
      const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      m.set(k, [...(m.get(k) ?? []), o]);
    }
    const arr = Array.from(m.entries()).sort(([a], [b]) => a.localeCompare(b));
    return estado === "hechas" ? arr.reverse() : arr;
  }, [filtradas, estado]);

  const loading = empresas.loading || obligaciones.loading;

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1>Vencimientos</h1>
          <p className="mt-1 text-sm text-carbon/60">Calendario de cumplimiento de todas tus empresas, mes por mes.</p>
        </div>
        {empresas.data.length > 0 && !nueva && (
          <button type="button" className="btn btn-primary" onClick={() => setNueva(true)}>
            <Plus size={15} /> Vencimiento
          </button>
        )}
      </header>

      {nueva && (
        <div className="mb-6">
          <ObligacionForm
            empresas={empresas.data}
            onCreated={(o) => {
              setNueva(false);
              obligaciones.setData((prev) => [...prev, o].sort((a, b) => a.fecha.localeCompare(b.fecha)));
            }}
            onCancel={() => setNueva(false)}
          />
        </div>
      )}

      <div className="mb-5 flex flex-wrap items-center gap-2">
        <div className="segmented">
          {(["pendientes", "atrasados", "hechas", "todas"] as Estado[]).map((e) => (
            <button key={e} type="button" className={estado === e ? "active" : ""} onClick={() => setEstado(e)}>
              {e[0].toUpperCase() + e.slice(1)}
            </button>
          ))}
        </div>
        {empresas.data.length > 1 && (
          <select className="input w-auto py-1.5" value={empresa} onChange={(e) => setEmpresa(e.target.value)}>
            <option value="todas">Todas las empresas</option>
            {empresas.data.map((e) => (
              <option key={e.id} value={e.id}>
                {e.denominacion}
              </option>
            ))}
          </select>
        )}
        <select className="input w-auto py-1.5" value={categoria} onChange={(e) => setCategoria(e.target.value as CategoriaObligacion | "todas")}>
          <option value="todas">Todas las categorías</option>
          {(Object.keys(CATEGORIA_LABELS) as CategoriaObligacion[]).map((c) => (
            <option key={c} value={c}>
              {CATEGORIA_LABELS[c]}
            </option>
          ))}
        </select>
      </div>

      {obligaciones.error && <p className="mb-4 text-sm text-bad">Error: {obligaciones.error}</p>}

      {loading ? (
        <SkeletonTable rows={5} cols={3} />
      ) : grupos.length === 0 ? (
        <ObligacionesLista
          obligaciones={[]}
          onChange={() => {}}
          vacio={empresas.data.length === 0 ? "Cargá una empresa para generar su calendario." : "No hay vencimientos con estos filtros."}
        />
      ) : (
        <div className="space-y-6">
          {grupos.map(([k, lista]) => {
            const [y, m] = k.split("-").map(Number);
            return (
              <section key={k}>
                <h3 className="mb-2 capitalize">
                  {MESES[m - 1]} {y} <span className="font-sans text-xs font-normal text-carbon/50">· {lista.length}</span>
                </h3>
                <ObligacionesLista
                  obligaciones={lista}
                  empresas={empresas.data}
                  mostrarEmpresa={empresas.data.length > 1}
                  onChange={(id, patch) => obligaciones.setData((prev) => aplicarCambio(prev, id, patch))}
                />
              </section>
            );
          })}
        </div>
      )}
    </main>
  );
}
