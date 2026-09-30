"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Building2, CalendarPlus, FileText } from "lucide-react";
import { useDocumentos, useEmpresas, useObligaciones, generarCalendario } from "@/lib/data";
import { daysUntil, formatFecha, todayIso } from "@/lib/dates";
import { useToast } from "@/components/ToastProvider";
import ObligacionesLista, { aplicarCambio } from "@/components/ObligacionesLista";
import { SkeletonStatTiles } from "@/components/Skeleton";
import { TIPO_CORTO, type Empresa, type Obligacion } from "@/lib/types";

function alertasEmpresa(e: Empresa, obligaciones: Obligacion[], anio: number): string[] {
  const out: string[] = [];
  const propias = obligaciones.filter((o) => o.empresa_id === e.id);
  if (!propias.some((o) => o.origen === "calendario" && o.anio === anio)) out.push(`Falta generar el calendario ${anio}`);
  const vencidas = propias.filter((o) => o.estado === "pendiente" && daysUntil(o.fecha) < 0).length;
  if (vencidas > 0) out.push(`${vencidas} vencimiento${vencidas === 1 ? "" : "s"} atrasado${vencidas === 1 ? "" : "s"}`);
  if (e.vencimiento_mandato) {
    const d = daysUntil(e.vencimiento_mandato);
    if (d < 0) out.push(`El mandato de las autoridades venció el ${formatFecha(e.vencimiento_mandato)}`);
    else if (d <= 120) out.push(`El mandato de las autoridades vence el ${formatFecha(e.vencimiento_mandato)}`);
  } else if (e.tipo !== "srl") out.push("Sin fecha de vencimiento del mandato cargada");
  return out;
}

export default function ResumenPage() {
  const { showToast } = useToast();
  const empresas = useEmpresas();
  const obligaciones = useObligaciones(null);
  const documentos = useDocumentos(null);
  const [generando, setGenerando] = useState(false);
  const anio = new Date().getFullYear();

  const pendientes = useMemo(() => obligaciones.data.filter((o) => o.estado === "pendiente"), [obligaciones.data]);
  const vencidas = pendientes.filter((o) => o.fecha < todayIso());
  const proximas30 = pendientes.filter((o) => o.fecha >= todayIso() && daysUntil(o.fecha) <= 30);
  const proximas = pendientes.slice(0, 8);

  const loading = empresas.loading || obligaciones.loading || documentos.loading;
  const error = empresas.error || obligaciones.error || documentos.error;

  async function generarTodos() {
    setGenerando(true);
    let nuevas = 0;
    for (const e of empresas.data) {
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
          <h1 className="text-2xl">Resumen</h1>
          <p className="mt-1 text-sm text-carbon/60">Lo que vence y lo que falta ordenar en tus empresas.</p>
        </div>
        {empresas.data.length > 0 && (
          <button type="button" className="btn btn-ghost" onClick={generarTodos} disabled={generando}>
            <CalendarPlus size={15} /> {generando ? "Generando..." : `Actualizar calendarios ${anio}–${anio + 1}`}
          </button>
        )}
      </header>

      {error && (
        <div className="mb-6 rounded-sm border p-4 text-sm text-bad" style={{ borderColor: "var(--color-bad)", background: "rgba(178,59,59,0.06)" }}>
          Error cargando datos: {error}
        </div>
      )}

      {loading ? (
        <SkeletonStatTiles count={4} />
      ) : empresas.data.length === 0 ? (
        <div className="card mx-auto max-w-xl text-center">
          <Building2 className="mx-auto mb-3 text-cobre" size={28} />
          <h2 className="text-lg">Empezá cargando tu primera empresa</h2>
          <p className="mt-2 text-sm text-carbon/65">
            Con el tipo de sociedad y el mes de cierre armamos el calendario de vencimientos del año. Después cargás el libro de accionistas y ya
            podés generar actas con los datos precargados.
          </p>
          <Link href="/empresas?nueva=1" className="btn btn-primary mt-5">
            Cargar empresa
          </Link>
        </div>
      ) : (
        <div className="animate-fade-in space-y-6">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="stat-tile">
              <div className="stat-label">Empresas</div>
              <div className="stat-value">{empresas.data.length}</div>
            </div>
            <div className="stat-tile">
              <div className="stat-label">Vencen en 30 días</div>
              <div className="stat-value" style={{ color: proximas30.length ? "var(--color-cobre)" : undefined }}>
                {proximas30.length}
              </div>
            </div>
            <div className="stat-tile">
              <div className="stat-label">Atrasados</div>
              <div className="stat-value" style={{ color: vencidas.length ? "var(--color-bad)" : "var(--color-good)" }}>
                {vencidas.length}
              </div>
            </div>
            <div className="stat-tile">
              <div className="stat-label">Documentos generados</div>
              <div className="stat-value">{documentos.data.length}</div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
            <section>
              <div className="mb-2 flex items-baseline justify-between">
                <h2 className="text-lg">Próximos vencimientos</h2>
                <Link href="/vencimientos" className="text-xs font-medium text-cobre hover:underline">
                  Ver todos
                </Link>
              </div>
              <ObligacionesLista
                obligaciones={proximas}
                empresas={empresas.data}
                mostrarEmpresa={empresas.data.length > 1}
                onChange={(id, patch) => obligaciones.setData((prev) => aplicarCambio(prev, id, patch))}
                vacio="No hay vencimientos pendientes. Tocá “Actualizar calendarios” para generar los del año."
              />
            </section>

            <section className="space-y-3">
              <h2 className="text-lg">Tus empresas</h2>
              {empresas.data.map((e) => {
                const alertas = alertasEmpresa(e, obligaciones.data, anio);
                return (
                  <Link key={e.id} href={`/empresas/${e.id}`} className="card card-hover block">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-serif text-base font-semibold text-musgo">{e.denominacion}</div>
                        <div className="text-xs text-carbon/55">
                          {TIPO_CORTO[e.tipo]}
                          {e.ruc ? ` · RUC ${e.ruc}` : ""}
                        </div>
                      </div>
                      {alertas.length === 0 && <span className="text-xs text-good">Al día</span>}
                    </div>
                    {alertas.length > 0 && (
                      <ul className="mt-2 space-y-1">
                        {alertas.map((a) => (
                          <li key={a} className="flex items-start gap-1.5 text-xs text-carbon/70">
                            <AlertTriangle size={12} className="mt-0.5 shrink-0 text-cobre" /> {a}
                          </li>
                        ))}
                      </ul>
                    )}
                  </Link>
                );
              })}
              <Link href="/documentos" className="card card-hover flex items-center gap-3 text-sm">
                <FileText size={18} className="text-cobre" />
                <span>
                  <span className="font-medium">Generar un documento</span>
                  <span className="block text-xs text-carbon/60">Actas, edictos, cartas poder y más, con los datos ya cargados.</span>
                </span>
              </Link>
            </section>
          </div>
        </div>
      )}
    </main>
  );
}
