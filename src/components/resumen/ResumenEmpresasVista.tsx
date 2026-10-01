"use client";

import Link from "next/link";
import { Building2 } from "lucide-react";
import { daysUntil, todayIso } from "@/lib/dates";
import { ResumenAccionesRapidas, ResumenBanner, ResumenStatTiles } from "@/components/resumen/ResumenBanner";
import ProximosVencimientos from "@/components/resumen/ProximosVencimientos";
import type { Empresa, Obligacion } from "@/lib/types";

const MAX_PROXIMOS = 6;

const s = (n: number, sing: string, plur: string) => `${n} ${n === 1 ? sing : plur}`;

/** Línea de estado de la banda, enfocada en vencimientos. */
function estadoVencimientos(proximos30: number, atrasados: number): string {
  if (proximos30 === 0 && atrasados === 0) return "Todo al día en tus empresas.";
  const partes: string[] = [];
  if (proximos30 > 0) partes.push(`${s(proximos30, "vencimiento", "vencimientos")} en los próximos 30 días`);
  if (atrasados > 0) partes.push(proximos30 > 0 ? s(atrasados, "atrasado", "atrasados") : s(atrasados, "vencimiento atrasado", "vencimientos atrasados"));
  return partes.join(" · ") + ".";
}

/**
 * Resumen de Empresas (sin carga de datos): banda con saludo, estado de
 * vencimientos y novedades; debajo cifras clave, lo próximo que vence y
 * accesos rápidos. Mismo formato que el Resumen de NODOS Finanzas.
 */
export default function ResumenEmpresasVista({
  nombre,
  empresas,
  obligaciones,
  loading,
  error,
  novedades,
  recientes,
  onChange,
  pie,
}: {
  nombre: string | null;
  empresas: Empresa[];
  obligaciones: Obligacion[];
  loading: boolean;
  error?: string | null;
  /** Tira de novedades para la banda. */
  novedades?: React.ReactNode;
  /** Ids marcados como hechos en esta visita: siguen en la lista para poder deshacer. */
  recientes: Set<string>;
  onChange: (id: string, patch: Partial<Obligacion> | null) => void;
  pie?: React.ReactNode;
}) {
  const hoy = todayIso();
  const mes = hoy.slice(0, 7);
  const pendientes = obligaciones.filter((o) => o.estado === "pendiente");
  const atrasados = pendientes.filter((o) => o.fecha < hoy).length;
  const proximos30 = pendientes.filter((o) => o.fecha >= hoy && daysUntil(o.fecha) <= 30).length;
  const hechosMes = obligaciones.filter((o) => o.estado === "hecho" && (o.completado_en ?? "").slice(0, 7) === mes).length;
  const lista = obligaciones
    .filter((o) => o.estado === "pendiente" || recientes.has(o.id))
    .sort((a, b) => a.fecha.localeCompare(b.fecha))
    .slice(0, MAX_PROXIMOS);

  const sinEmpresas = !loading && empresas.length === 0;

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <ResumenBanner
        nombre={nombre}
        subtitulo={
          loading
            ? "Cargando tus empresas..."
            : sinEmpresas
              ? "Ordená la parte legal de tu empresa familiar en un solo lugar."
              : estadoVencimientos(proximos30, atrasados)
        }
      >
        {!sinEmpresas && novedades}
      </ResumenBanner>

      {error && (
        <div className="mb-6 rounded-sm border p-4 text-sm text-bad" style={{ borderColor: "var(--color-bad)", background: "rgba(178,59,59,0.06)" }}>
          Error cargando datos: {error}
        </div>
      )}

      {sinEmpresas ? (
        <div className="card mx-auto max-w-xl text-center">
          <Building2 className="mx-auto mb-3 text-cobre" size={28} />
          <h2>Empezá cargando tu primera empresa</h2>
          <p className="mt-2 text-sm text-carbon/65">
            Con el tipo de sociedad y el mes de cierre armamos el calendario de vencimientos del año. Después cargás el libro de accionistas y ya
            podés generar actas con los datos precargados.
          </p>
          <Link href="/empresas?nueva=1" className="btn btn-primary mt-5">
            Cargar empresa
          </Link>
        </div>
      ) : (
        <div className="space-y-6">
          <ResumenStatTiles loading={loading} data={{ empresas: empresas.length, proximos30, atrasados, hechosMes }} />
          {!loading && (
            <div className="animate-fade-in">
              <ProximosVencimientos obligaciones={lista} empresas={empresas} onChange={onChange} pie={pie} />
            </div>
          )}
          <ResumenAccionesRapidas />
        </div>
      )}
    </main>
  );
}
