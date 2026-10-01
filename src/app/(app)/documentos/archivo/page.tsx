"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import DocumentosNav from "@/components/DocumentosNav";
import ArchivoPanel from "@/components/ArchivoPanel";

function ArchivoContenido() {
  const params = useSearchParams();
  return <ArchivoPanel empresaInicial={params.get("empresa")} />;
}

export default function ArchivoPage() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <DocumentosNav />
      <Suspense fallback={null}>
        <ArchivoContenido />
      </Suspense>
    </main>
  );
}
