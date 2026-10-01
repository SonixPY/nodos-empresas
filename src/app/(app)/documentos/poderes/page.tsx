"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import DocumentosNav from "@/components/DocumentosNav";
import PoderesPanel from "@/components/PoderesPanel";

function PoderesContenido() {
  const params = useSearchParams();
  return <PoderesPanel empresaInicial={params.get("empresa")} />;
}

export default function PoderesPage() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <DocumentosNav />
      <Suspense fallback={null}>
        <PoderesContenido />
      </Suspense>
    </main>
  );
}
