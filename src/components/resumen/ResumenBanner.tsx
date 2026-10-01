"use client";

import Link from "next/link";
import { ArrowRight, Building2, CalendarClock, FileText, ShieldCheck, type LucideIcon } from "lucide-react";
import { SkeletonStatTiles } from "@/components/Skeleton";

function fechaLarga(): string {
  const s = new Date().toLocaleDateString("es-PY", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Banda de saludo del Resumen (mismo formato que el Resumen de NODOS
 * Finanzas): fecha, "Hola, <nombre>", una línea de estado y, debajo, lo que
 * se pase como `children` (la tira de novedades). */
export function ResumenBanner({ nombre, subtitulo, children }: { nombre: string | null; subtitulo: string; children?: React.ReactNode }) {
  return (
    <section className="relative mb-6 overflow-hidden rounded-2xl bg-musgo px-5 py-7 text-marfil sm:px-8">
      <div className="relative z-10">
        <p className="t-caption uppercase tracking-[0.14em] text-cobre" suppressHydrationWarning>
          {fechaLarga()}
        </p>
        <h1 className="mt-1 !text-marfil">{nombre ? `Hola, ${nombre}` : "Resumen"}</h1>
        <p className="t-body-lg mt-1 max-w-xl text-marfil/75">{subtitulo}</p>
        {children}
      </div>
      <svg aria-hidden="true" viewBox="0 0 220 220" className="pointer-events-none absolute -right-10 -top-10 h-56 w-56 opacity-10">
        <g fill="none" stroke="#b8734a" strokeWidth="6" strokeLinejoin="round">
          <polyline points="110,118 66,118 54,106 54,64" />
          <polyline points="110,118 64,118 50,132" />
          <polyline points="110,118 110,74 122,62 157,62" />
        </g>
        <circle cx="110" cy="118" r="24" fill="#b8734a" />
      </svg>
    </section>
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

/** Accesos rápidos de Empresas. */
export function ResumenAccionesRapidas() {
  const acciones: { href: string; icon: LucideIcon; titulo: string; texto: string }[] = [
    { href: "/empresas?nueva=1", icon: Building2, titulo: "Nueva empresa", texto: "S.A., EAS o S.R.L." },
    { href: "/documentos", icon: FileText, titulo: "Generar documento", texto: "Actas, edictos, poderes" },
    { href: "/vencimientos", icon: CalendarClock, titulo: "Vencimientos", texto: "Todo el año, mes a mes" },
    { href: "/cumplimiento", icon: ShieldCheck, titulo: "SEPRELAD", texto: "Si sos sujeto obligado" },
  ];
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {acciones.map((a) => (
        <Link key={a.titulo} href={a.href} className="card card-hover group flex items-start gap-3 !p-4">
          <a.icon size={18} className="mt-0.5 shrink-0 text-cobre" />
          <span className="min-w-0">
            <span className="flex items-center gap-1 font-medium text-musgo">
              {a.titulo} <ArrowRight size={13} className="opacity-0 transition group-hover:opacity-100" />
            </span>
            <span className="block text-xs text-carbon/55">{a.texto}</span>
          </span>
        </Link>
      ))}
    </div>
  );
}
