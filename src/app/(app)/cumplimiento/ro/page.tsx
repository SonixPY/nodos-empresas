"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, Plus, ShieldCheck } from "lucide-react";
import { useEmpresas, usePerfilSeprelad } from "@/lib/data";
import { SkeletonBlock } from "@/components/Skeleton";
import EmptyState from "@/components/EmptyState";
import GeneradorRo from "@/components/ro/GeneradorRo";

function Contenido() {
  const params = useSearchParams();
  const empresas = useEmpresas();
  const [empresaId, setEmpresaId] = useState<string | null>(params.get("empresa"));
  const empresa = empresas.data.find((e) => e.id === empresaId) ?? empresas.data[0] ?? null;
  const perfil = usePerfilSeprelad(empresa?.id ?? null);

  if (empresas.loading) return <SkeletonBlock className="h-64" />;
  if (!empresa)
    return (
      <EmptyState
        icon={ShieldCheck}
        titulo="Primero cargá una empresa"
        texto="El Reporte de Operaciones se arma para un sujeto obligado: una inmobiliaria o una transportadora de caudales."
        accion={{ label: "Cargar empresa", icon: Plus, href: "/empresas?nueva=1" }}
      />
    );
  if (perfil.loading) return <SkeletonBlock className="h-64" />;
  const sectores = perfil.data?.sectores ?? [];
  const regimen = sectores.includes("caudales") && !sectores.includes("inmobiliaria") ? "caudales" : "inmobiliarias";

  return (
    <div className="space-y-4">
      {empresas.data.length > 1 && (
        <select className="input w-auto" value={empresa.id} onChange={(e) => setEmpresaId(e.target.value)} aria-label="Empresa">
          {empresas.data.map((e) => (
            <option key={e.id} value={e.id}>
              {e.denominacion}
            </option>
          ))}
        </select>
      )}
      {!sectores.includes("inmobiliaria") && !sectores.includes("caudales") && (
        <p className="rounded-sm border border-cobre/40 bg-cobre/5 p-3 text-sm text-carbon/75">
          {empresa.denominacion} no está marcada como inmobiliaria ni como transportadora de caudales en su perfil SEPRELAD. Podés armar el reporte igual, o{" "}
          <Link href={`/cumplimiento?empresa=${empresa.id}`} className="font-medium underline">
            completar el perfil
          </Link>
          .
        </p>
      )}
      <GeneradorRo key={`${empresa.id}:${regimen}`} empresa={empresa} regimenInicial={regimen} />
    </div>
  );
}

export default function RoPage() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <Link href="/cumplimiento" className="inline-flex items-center gap-1 text-xs text-carbon/55 hover:text-cobre-hover">
        <ArrowLeft size={13} aria-hidden /> Cumplimiento SEPRELAD
      </Link>
      <header className="mb-6 mt-2">
        <p className="t-caption uppercase tracking-[0.14em] text-cobre-hover">Res. SEPRELAD 201/2020, art. 31</p>
        <h1 className="mt-1">Reporte de Operaciones (RO)</h1>
        <p className="mt-1 max-w-3xl text-carbon/65">
          Subí la planilla del trimestre, revisá lo que hay que completar o verificar y descargá el archivo para la plataforma de la SEPRELAD.
        </p>
      </header>
      <Suspense fallback={null}>
        <Contenido />
      </Suspense>
    </main>
  );
}
