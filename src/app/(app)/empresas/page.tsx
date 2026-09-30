"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Plus } from "lucide-react";
import { useEmpresas, generarCalendario } from "@/lib/data";
import { formatFecha, MESES } from "@/lib/dates";
import { useToast } from "@/components/ToastProvider";
import EmpresaForm from "@/components/EmpresaForm";
import { SkeletonTable } from "@/components/Skeleton";
import { TIPO_CORTO, type Empresa } from "@/lib/types";

function EmpresasContenido() {
  const router = useRouter();
  const params = useSearchParams();
  const { showToast } = useToast();
  const { data: empresas, loading, error } = useEmpresas();
  const [creando, setCreando] = useState(params.get("nueva") === "1");

  async function onCreada(e: Empresa) {
    const anio = new Date().getFullYear();
    const r1 = await generarCalendario(e, anio);
    const r2 = await generarCalendario(e, anio + 1);
    if (r1.error || r2.error) showToast("Empresa creada, pero no se pudo generar el calendario.", "error");
    else showToast("Empresa creada con su calendario de vencimientos.");
    router.push(`/empresas/${e.id}?tab=accionistas`);
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl">Empresas</h1>
          <p className="mt-1 text-sm text-carbon/60">Las sociedades que administrás: datos, accionistas, vencimientos y documentos.</p>
        </div>
        {!creando && (
          <button type="button" className="btn btn-primary" onClick={() => setCreando(true)}>
            <Plus size={15} /> Nueva empresa
          </button>
        )}
      </header>

      {creando && (
        <div className="mb-6">
          <EmpresaForm onSaved={onCreada} onCancel={() => setCreando(false)} />
        </div>
      )}

      {error && <p className="mb-4 text-sm text-bad">Error: {error}</p>}

      {loading ? (
        <SkeletonTable rows={3} cols={5} />
      ) : empresas.length === 0 ? (
        !creando && (
          <p className="rounded border border-dashed p-8 text-center text-sm text-carbon/60" style={{ borderColor: "var(--line)" }}>
            Todavía no cargaste empresas.
          </p>
        )
      ) : (
        <div className="table-shell">
          <table>
            <thead>
              <tr>
                <th>Denominación</th>
                <th>Tipo</th>
                <th>RUC</th>
                <th>Cierre</th>
                <th>Mandato vence</th>
              </tr>
            </thead>
            <tbody>
              {empresas.map((e) => (
                <tr key={e.id} className="cursor-pointer" onClick={() => router.push(`/empresas/${e.id}`)}>
                  <td className="font-medium">
                    <Link href={`/empresas/${e.id}`} className="hover:text-cobre">
                      {e.denominacion}
                    </Link>
                  </td>
                  <td>{TIPO_CORTO[e.tipo]}</td>
                  <td>{e.ruc ?? "—"}</td>
                  <td>Fin de {MESES[(e.cierre_mes || 12) - 1]}</td>
                  <td>{formatFecha(e.vencimiento_mandato)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}

export default function EmpresasPage() {
  return (
    <Suspense fallback={null}>
      <EmpresasContenido />
    </Suspense>
  );
}
