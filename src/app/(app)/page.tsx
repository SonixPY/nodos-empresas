"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useDocumentos, useEmpresas } from "@/lib/data";
import { formatFecha } from "@/lib/dates";
import Generador from "@/components/Generador";
import Accordion from "@/components/Accordion";
import { SkeletonBlock } from "@/components/Skeleton";

function DocumentosContenido() {
  const params = useSearchParams();
  const router = useRouter();
  const empresas = useEmpresas();
  const documentos = useDocumentos(null);
  const nombres = new Map(empresas.data.map((e) => [e.id, e.denominacion]));

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-6">
        <h1 className="text-2xl">Documentos</h1>
        <p className="mt-1 text-sm text-carbon/60">
          Elegí una plantilla, completá los datos y descargalo en Word o PDF. Lo que falta completar aparece resaltado.
        </p>
      </header>

      {empresas.loading ? (
        <SkeletonBlock className="h-64" />
      ) : (
        <Generador
          empresas={empresas.data}
          empresaInicial={params.get("empresa")}
          plantillaInicial={params.get("plantilla")}
          onSaved={(d) => {
            documentos.setData((prev) => [d, ...prev]);
            router.push(`/documentos/${d.id}`);
          }}
        />
      )}

      <div className="mt-8">
        <Accordion title="Historial de documentos" subtitle="Todo lo que guardaste, por empresa" badge={`${documentos.data.length}`}>
          {documentos.data.length === 0 ? (
            <p className="text-sm text-carbon/60">Todavía no guardaste documentos.</p>
          ) : (
            <div className="table-shell">
              <table>
                <thead>
                  <tr>
                    <th>Documento</th>
                    <th>Empresa</th>
                    <th>Generado</th>
                  </tr>
                </thead>
                <tbody>
                  {documentos.data.map((d) => (
                    <tr key={d.id}>
                      <td>
                        <Link href={`/documentos/${d.id}`} className="font-medium hover:text-cobre">
                          {d.titulo}
                        </Link>
                      </td>
                      <td>{nombres.get(d.empresa_id) ?? "—"}</td>
                      <td className="whitespace-nowrap">{formatFecha(d.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Accordion>
      </div>
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
