"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Download, Printer, Trash2 } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { descargarWord, imprimir } from "@/lib/descargas";
import { formatFecha } from "@/lib/dates";
import { useToast } from "@/components/ToastProvider";
import DocPreview from "@/components/DocPreview";
import { SkeletonBlock } from "@/components/Skeleton";
import type { Documento, Empresa } from "@/lib/types";

export default function DocumentoPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { showToast } = useToast();
  const [doc, setDoc] = useState<Documento | null>(null);
  const [empresa, setEmpresa] = useState<Empresa | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data, error: err } = await supabase.from("documentos").select("*").eq("id", id).maybeSingle();
      if (!active) return;
      if (err || !data) {
        setError(err?.message ?? "No se encontró el documento.");
        setLoading(false);
        return;
      }
      setDoc(data as Documento);
      const { data: e } = await supabase.from("empresas").select("*").eq("id", data.empresa_id).maybeSingle();
      if (active) {
        setEmpresa((e as Empresa) ?? null);
        setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [id]);

  async function eliminar() {
    if (!doc || !confirm("¿Eliminar este documento del historial?")) return;
    const { error: err } = await supabase.from("documentos").delete().eq("id", doc.id);
    if (err) return showToast(`No se pudo eliminar: ${err.message}`, "error");
    showToast("Documento eliminado.");
    router.push("/documentos");
  }

  return (
    <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <Link href="/documentos" className="text-xs text-carbon/55 hover:text-cobre-hover">
        ← Documentos
      </Link>
      {loading ? (
        <SkeletonBlock className="mt-4 h-96" />
      ) : error || !doc ? (
        <p className="mt-4 text-sm text-bad">{error}</p>
      ) : (
        <>
          <header className="mb-4 mt-2 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h1>{doc.titulo}</h1>
              <p className="mt-1 text-sm text-carbon/60">
                {empresa ? (
                  <Link href={`/empresas/${empresa.id}?tab=documentos`} className="hover:text-cobre-hover">
                    {empresa.denominacion}
                  </Link>
                ) : null}
                {" · "}generado el {formatFecha(doc.created_at)}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" className="btn btn-ghost" onClick={() => descargarWord(doc.titulo, doc.contenido_html)}>
                <Download size={15} /> Word
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => {
                  if (!imprimir(doc.titulo, doc.contenido_html)) showToast("Permití ventanas emergentes para imprimir.", "error");
                }}
              >
                <Printer size={15} /> Imprimir / PDF
              </button>
              {empresa && (
                <Link href={`/documentos?empresa=${empresa.id}&plantilla=${doc.plantilla}`} className="btn btn-ghost">
                  Nuevo desde esta plantilla
                </Link>
              )}
              <button type="button" className="btn btn-ghost text-bad" onClick={eliminar}>
                <Trash2 size={15} />
              </button>
            </div>
          </header>
          <DocPreview html={doc.contenido_html} />
        </>
      )}
    </main>
  );
}
