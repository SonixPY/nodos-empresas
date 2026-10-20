"use client";

import BandaResumen from "@/components/nodos/BandaResumen";
import { SkeletonStatTiles } from "@/components/Skeleton";

/** Banda de saludo del Resumen: la compartida, minimizable. */
export function ResumenBanner({ nombre, subtitulo, children }: { nombre: string | null; subtitulo: string; children?: React.ReactNode }) {
  return (
    <BandaResumen nombre={nombre} subtitulo={subtitulo} etiqueta="novedades">
      {children}
    </BandaResumen>
  );
}

export interface ResumenStatsData {
  empresas: number;
  proximos30: number;
  atrasados: number;
  hechosMes: number;
}

const MES_ACTUAL = () => new Date().toLocaleDateString("es-PY", { month: "long" });

/** Tiles con las cifras clave de vencimientos. */
export function ResumenStatTiles({ data, loading }: { data: ResumenStatsData; loading?: boolean }) {
  if (loading) return <SkeletonStatTiles count={4} />;
  const plural = (n: number, s: string, p: string) => (n === 1 ? s : p);
  const tiles: { label: string; value: string; hint: string; color?: string }[] = [
    { label: "Empresas", value: String(data.empresas), hint: plural(data.empresas, "Cargada en NODOS", "Cargadas en NODOS") },
    {
      label: "Próximos 30 días",
      value: String(data.proximos30),
      hint: data.proximos30 ? plural(data.proximos30, "Vencimiento pendiente", "Vencimientos pendientes") : "Nada por vencer",
      color: data.proximos30 ? "var(--color-cobre-hover)" : undefined,
    },
    {
      label: "Atrasados",
      value: String(data.atrasados),
      hint: data.atrasados ? "Conviene resolverlos primero" : "Nada atrasado",
      color: data.atrasados ? "var(--color-bad)" : "var(--color-good)",
    },
    { label: "Hechos este mes", value: String(data.hechosMes), hint: `Marcados como hechos en ${MES_ACTUAL()}` },
  ];
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {tiles.map((t) => (
        <div key={t.label} className="stat-tile min-w-0 !p-3 sm:!p-4">
          <div className="stat-label leading-tight">{t.label}</div>
          <div className="stat-value !text-[19px] tabular-nums sm:!text-[24px]" style={t.color ? { color: t.color } : undefined}>
            {t.value}
          </div>
          <div className="mt-0.5 text-[11px] leading-snug text-carbon/45" suppressHydrationWarning>
            {t.hint}
          </div>
        </div>
      ))}
    </div>
  );
}
