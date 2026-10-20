"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEmpresas } from "@/lib/data";
import Generador from "@/components/Generador";
import DocumentosNav from "@/components/DocumentosNav";
import { SkeletonBlock } from "@/components/Skeleton";
import { leerPreferencias } from "@/lib/preferencias";
import GuiaPagina from "@/components/nodos/GuiaPagina";

function DocumentosContenido() {
  const params = useSearchParams();
  const router = useRouter();
  const empresas = useEmpresas();

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <DocumentosNav descripcion="Elegí una plantilla, completá los datos y guardalo o imprimilo en PDF. Lo que falta completar aparece resaltado." />
      <GuiaPagina id="documentos" titulo="Cómo funciona Documentos" pasos={["Elegí la empresa y la plantilla: los datos de la empresa y los socios ya vienen cargados.", "Completá lo resaltado y mirá la vista previa.", "Guardalo para tenerlo en Archivo o imprimilo en PDF.", "En Archivo también subís estatutos, actas firmadas y constancias."]} />

      {empresas.loading ? (
        <SkeletonBlock className="h-64" />
      ) : (
        <Generador
          empresas={empresas.data}
          empresaInicial={params.get("empresa") ?? leerPreferencias().empresaPorDefecto}
          plantillaInicial={params.get("plantilla")}
          onSaved={(d) => router.push(`/documentos/${d.id}`)}
        />
      )}
    </main>
  );
}

export default function DocumentosPage() {
  return (
    <Suspense fallback={null}>
      <DocumentosContenido />
    </Suspense>
  );
}
