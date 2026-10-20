"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Building2, CalendarClock, CalendarPlus, Plus } from "lucide-react";
import { generarCalendario, useEmpresas, useObligaciones } from "@/lib/data";
import { useToast } from "@/components/ToastProvider";
import { esSociedad } from "@/lib/types";
import { MESES, parseIso, todayIso } from "@/lib/dates";
import ObligacionesLista, { aplicarCambio } from "@/components/ObligacionesLista";
import ObligacionForm from "@/components/ObligacionForm";
import VencimientosCalendar from "@/components/VencimientosCalendar";
import SugerenciasFamiliares from "@/components/SugerenciasFamiliares";
import { SkeletonTable } from "@/components/Skeleton";
import EmptyState from "@/components/EmptyState";
import { marcarPasoVisto } from "@/components/resumen/PrimerosPasos";
import { CATEGORIA_LABELS, type CategoriaObligacion, type Obligacion } from "@/lib/types";
import { mensajeError } from "@/lib/nodos/errores";

type Estado = "pendientes" | "atrasados" | "hechas" | "todas";
type Vista = "calendario" | "lista";

/** Vencimientos: el único calendario de Empresas (todas o una sola empresa). */
function VencimientosContenido() {
  const params = useSearchParams();
  const { showToast } = useToast();
  const empresas = useEmpresas();
  const obligaciones = useObligaciones(null);
  const [empresa, setEmpresa] = useState(params.get("empresa") ?? "todas");
  const [generando, setGenerando] = useState(false);
  const anio = new Date().getFullYear();
  const [categoria, setCategoria] = useState<CategoriaObligacion | "todas">("todas");
  const [estado, setEstado] = useState<Estado>("pendientes");
  // Alta abierta: false, o la fecha elegida en el calendario (true = hoy).
  const [nueva, setNueva] = useState<boolean | string>(false);
  const [vista, setVista] = useState<Vista>("calendario");

  // Primeros pasos del Resumen: "Revisá tus vencimientos" queda hecho al abrir esta página.
  useEffect(() => marcarPasoVisto("vencimientos"), []);

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
  // El calendario automático solo existe para sociedades (S.A., EAS, S.R.L.).
  const sociedades = empresas.data.filter((e) => esSociedad(e.tipo) && (empresa === "todas" || e.id === empresa));

  async function generarCalendarios() {
    setGenerando(true);
    let nuevas = 0;
    for (const e of sociedades) {
      for (const y of [anio, anio + 1]) {
        const r = await generarCalendario(e, y);
        if (r.error) {
          setGenerando(false);
          return showToast(`No se pudo generar: ${r.error}`, "error");
        }
        nuevas += r.nuevas;
      }
    }
    await obligaciones.reload();
    setGenerando(false);
    showToast(nuevas > 0 ? `${nuevas} vencimientos agregados.` : "Los calendarios ya estaban al día.");
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1>Vencimientos</h1>
          <p className="mt-1 text-sm text-carbon/60">Calendario de cumplimiento de todas tus empresas, mes por mes.</p>
        </div>
        {empresas.data.length > 0 && !nueva && (
          <div className="flex flex-wrap gap-2">
            {sociedades.length > 0 && (
              <button type="button" className="btn btn-ghost" onClick={generarCalendarios} disabled={generando || loading}>
                <CalendarPlus size={15} /> {generando ? "Generando..." : `Calendario ${anio}–${anio + 1}`}
              </button>
            )}
            <button type="button" className="btn btn-primary" onClick={() => setNueva(true)}>
              <Plus size={15} /> Vencimiento
            </button>
          </div>
        )}
      </header>

      {nueva && (
        <div className="mb-6">
          <ObligacionForm
            empresas={empresas.data}
            empresaId={empresa !== "todas" ? empresa : undefined}
            fechaInicial={typeof nueva === "string" ? nueva : undefined}
            key={typeof nueva === "string" ? nueva : "hoy"}
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
        <div className="segmented sm:ml-auto" role="group" aria-label="Vista">
          {(["calendario", "lista"] as Vista[]).map((v) => (
            <button key={v} type="button" className={vista === v ? "active" : ""} aria-pressed={vista === v} onClick={() => setVista(v)}>
              {v === "calendario" ? "Calendario" : "Lista"}
            </button>
          ))}
        </div>
      </div>

      {!loading && (
        <SugerenciasFamiliares
          empresas={empresa === "todas" ? empresas.data : empresas.data.filter((e) => e.id === empresa)}
          obligaciones={obligaciones.data}
          onAgregada={(o) => obligaciones.setData((prev) => [...prev, o].sort((a, b) => a.fecha.localeCompare(b.fecha)))}
        />
      )}

      {obligaciones.error && <p className="mb-4 text-sm text-bad">No se pudieron cargar los vencimientos: {mensajeError(obligaciones.error)}</p>}

      {loading ? (
        <SkeletonTable rows={5} cols={3} />
      ) : vista === "calendario" && empresas.data.length > 0 ? (
        <VencimientosCalendar
          onAgregar={(fecha) => {
            setNueva(fecha);
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
          obligaciones={filtradas}
          empresas={empresas.data}
          mostrarEmpresa={empresas.data.length > 1}
          onChange={(id, patch) => obligaciones.setData((prev) => aplicarCambio(prev, id, patch))}
        />
      ) : grupos.length === 0 ? (
        <ObligacionesLista
          obligaciones={[]}
          onChange={() => {}}
          vacio={
            empresas.data.length === 0 ? (
              <EmptyState
                icon={Building2}
                titulo="Tu calendario empieza con una empresa"
                texto="Acá vas a ver mes por mes asambleas, balances, SIARA, mandatos y demás vencimientos. Se arma solo con el tipo de sociedad y el mes de cierre."
                accion={{ label: "Cargar empresa", icon: Plus, href: "/empresas?nueva=1" }}
              />
            ) : obligaciones.data.length === 0 ? (
              <EmptyState
                icon={CalendarClock}
                titulo="Todavía no hay vencimientos"
                texto={
                  sociedades.length > 0
                    ? `Generá el calendario ${anio}–${anio + 1} (asambleas, balance, SIARA y mandatos según el tipo de sociedad y el mes de cierre) o agregá uno a mano.`
                    : "Unipersonales y RUC personal no tienen calendario societario: cargá a mano tus vencimientos de la DNIT, el IPS y lo que pida tu actividad."
                }
                accion={
                  sociedades.length > 0
                    ? { label: `Generar calendario ${anio}–${anio + 1}`, icon: CalendarPlus, onClick: generarCalendarios }
                    : { label: "Agregar vencimiento", icon: Plus, onClick: () => setNueva(true) }
                }
                secundaria={sociedades.length > 0 ? { label: "Agregar a mano", icon: Plus, onClick: () => setNueva(true) } : { label: "Ir a Empresas", href: "/empresas" }}
              />
            ) : (
              "No hay vencimientos con estos filtros."
            )
          }
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

export default function VencimientosPage() {
  return (
    <Suspense fallback={null}>
      <VencimientosContenido />
    </Suspense>
  );
}
