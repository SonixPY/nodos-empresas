"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { BriefcaseBusiness, CalendarClock, CheckCircle2, FileText, Plus } from "lucide-react";
import { useEmpresas } from "@/lib/data";
import { PLANTILLAS, grupoDe } from "@/lib/plantillas";
import { leerPreferencias } from "@/lib/preferencias";
import { SkeletonBlock } from "@/components/Skeleton";
import EmptyState from "@/components/EmptyState";

/** Puntos básicos de un empleador. Solo se cita lo verificado en la Ley N.º 213/1993. */
const BASICOS: { titulo: string; texto: string }[] = [
  { titulo: "Contrato por escrito", texto: "Con partes, tarea, salario, jornada, lugar y duración (Código del Trabajo, art. 46). Plantilla LAB-01." },
  { titulo: "Inscripción en el IPS y el MTESS", texto: "Al ingresar cada trabajador: alta en el Instituto de Previsión Social y registro en el Ministerio de Trabajo." },
  { titulo: "Recibo de cada pago", texto: "Un recibo firmado por mes con haberes y descuentos (aporte al IPS y otros). Plantilla LAB-05." },
  { titulo: "Vacaciones avisadas por escrito", texto: "Fechas de inicio, fin y reintegro, según la antigüedad. Plantilla LAB-06." },
  { titulo: "Preaviso según antigüedad", texto: "30, 45, 60 o 90 días en los contratos por tiempo indefinido (art. 87). Plantilla LAB-04." },
  { titulo: "Constancias", texto: "De servicios cuando el trabajador la pide (art. 62 inc. ll) y al terminar el contrato (art. 93). Plantillas LAB-02 y LAB-03." },
];

function LaboralContenido() {
  const params = useSearchParams();
  const empresas = useEmpresas();
  const [elegida, setElegida] = useState<string | null>(params.get("empresa"));
  const plantillas = PLANTILLAS.filter((p) => grupoDe(p) === "laboral");

  if (empresas.loading) return <SkeletonBlock className="h-64" />;
  if (empresas.data.length === 0) {
    return (
      <EmptyState
        icon={BriefcaseBusiness}
        titulo="Primero cargá una empresa"
        texto="Los documentos laborales salen con los datos de la empresa ya precargados: razón social, RUC, domicilio y quien firma."
        accion={{ label: "Cargar empresa", icon: Plus, href: "/empresas?nueva=1" }}
      />
    );
  }
  const preferida = elegida ?? leerPreferencias().empresaPorDefecto;
  const empresa = empresas.data.find((e) => e.id === preferida) ?? empresas.data[0];

  return (
    <div className="space-y-6">
      {empresas.data.length > 1 && (
        <select className="input sm:max-w-md" value={empresa.id} onChange={(e) => setElegida(e.target.value)} aria-label="Empresa">
          {empresas.data.map((e) => (
            <option key={e.id} value={e.id}>
              {e.denominacion}
            </option>
          ))}
        </select>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.2fr_1fr]">
        <section className="card">
          <h2 className="text-xl">Documentos laborales</h2>
          <p className="mb-3 mt-1 text-sm text-carbon/60">Con los datos de {empresa.denominacion} precargados. Se guardan en el Archivo de Documentos.</p>
          <ul className="space-y-1">
            {plantillas.map((p) => (
              <li key={p.key}>
                <Link href={`/documentos?empresa=${empresa.id}&plantilla=${p.key}`} className="flex items-start gap-2 rounded-md px-2 py-2 text-sm hover:bg-marfil">
                  <FileText size={15} className="mt-0.5 shrink-0 text-cobre" aria-hidden />
                  <span>
                    <span className="font-medium text-musgo">
                      {p.numero} · {p.titulo}
                    </span>
                    <span className="block text-xs text-carbon/55">{p.descripcion}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section className="card">
          <h2 className="text-xl">Lo básico de un empleador</h2>
          <ul className="mt-3 space-y-3">
            {BASICOS.map((b) => (
              <li key={b.titulo} className="flex items-start gap-2.5">
                <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-good" aria-hidden />
                <span>
                  <span className="block text-sm font-medium text-carbon">{b.titulo}</span>
                  <span className="block text-xs leading-snug text-carbon/60">{b.texto}</span>
                </span>
              </li>
            ))}
          </ul>
          <Link href={`/vencimientos?empresa=${empresa.id}`} className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-cobre-hover hover:underline">
            <CalendarClock size={14} aria-hidden /> Ver los vencimientos laborales (planillas, aguinaldo)
          </Link>
        </section>
      </div>
    </div>
  );
}

/** Laboral: documentos básicos para tener al personal en regla, como SEPRELAD. */
export default function LaboralPage() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-6">
        <p className="t-caption uppercase tracking-[0.14em] text-cobre-hover">Código del Trabajo (Ley N.º 213/1993)</p>
        <h1>Laboral</h1>
        <p className="mt-1 text-sm text-carbon/60">Contrato, recibos, vacaciones, preaviso y constancias para tu personal, listos para imprimir en PDF.</p>
      </header>
      <Suspense fallback={null}>
        <LaboralContenido />
      </Suspense>
      <p className="mt-8 text-xs text-carbon/50">
        Modelos informativos de referencia: no constituye asesoramiento legal para tu caso. Confirmá salario mínimo, aportes y convenios vigentes antes de firmar.
      </p>
    </main>
  );
}
