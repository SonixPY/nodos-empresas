"use client";

import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { FilePlus2, FileText, Search } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { useDocumentos, useEmpresas } from "@/lib/data";
import { formatFecha } from "@/lib/dates";
import { GRUPO_LABELS, getPlantilla, grupoDe, type GrupoPlantilla } from "@/lib/plantillas";
import { useSelection } from "@/lib/useSelection";
import { useToast } from "@/components/ToastProvider";
import DocumentosNav from "@/components/DocumentosNav";
import BulkDeleteBar from "@/components/BulkDeleteBar";
import { SkeletonTable } from "@/components/Skeleton";
import EmptyState from "@/components/EmptyState";
import ArchivoPanel from "@/components/ArchivoPanel";
import { mensajeError } from "@/lib/nodos/errores";

/** Archivo de Documentos: lo generado en NODOS y lo subido, en un solo lugar. */
function GuardadosContenido() {
  const params = useSearchParams();
  const empresaParam = params.get("empresa");
  const { showToast } = useToast();
  const empresas = useEmpresas();
  const documentos = useDocumentos(null);
  const [empresaFiltro, setEmpresaFiltro] = useState(empresaParam ?? "");
  const [grupoFiltro, setGrupoFiltro] = useState<"" | GrupoPlantilla>("");
  const [busqueda, setBusqueda] = useState("");
  const [deleting, setDeleting] = useState(false);
  const nombres = useMemo(() => new Map(empresas.data.map((e) => [e.id, e.denominacion])), [empresas.data]);

  const filas = useMemo(
    () =>
      documentos.data
        .map((d) => {
          // La key de la plantilla es estable: los documentos viejos siguen
          // resolviendo su plantilla y muestran el código nuevo.
          const p = getPlantilla(d.plantilla);
          return { d, codigo: p?.numero ?? "—", grupo: p ? grupoDe(p) : null };
        })
        .filter(
          ({ d, codigo, grupo }) =>
            (!empresaFiltro || d.empresa_id === empresaFiltro) &&
            (!grupoFiltro || grupo === grupoFiltro) &&
            (!busqueda.trim() ||
              `${codigo} ${d.titulo} ${nombres.get(d.empresa_id) ?? ""}`.toLowerCase().includes(busqueda.trim().toLowerCase())),
        ),
    [documentos.data, empresaFiltro, grupoFiltro, busqueda, nombres],
  );
  const ids = useMemo(() => filas.map((f) => f.d.id), [filas]);
  const sel = useSelection(ids);

  async function borrarSeleccion() {
    if (!confirm(`¿Eliminar ${sel.selectedIds.length === 1 ? "el documento seleccionado" : `${sel.selectedIds.length} documentos`}?`))
      return;
    setDeleting(true);
    const { error } = await supabase.from("documentos").delete().in("id", sel.selectedIds);
    setDeleting(false);
    if (error) return showToast(`No se pudo eliminar: ${mensajeError(error)}`, "error");
    const borrados = new Set(sel.selectedIds);
    documentos.setData((prev) => prev.filter((d) => !borrados.has(d.id)));
    sel.clear();
    showToast("Documentos eliminados.");
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <DocumentosNav descripcion="Todo en un solo lugar: lo que generaste en NODOS y lo que subiste (estatutos, actas firmadas, constancias)." />

      <h2 className="mb-3 text-xl">Generados en NODOS</h2>

      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <select
          className="input w-auto! min-w-[10rem] flex-1 sm:flex-none"
          value={empresaFiltro}
          onChange={(e) => setEmpresaFiltro(e.target.value)}
          aria-label="Empresa"
        >
          <option value="">Todas las empresas</option>
          {empresas.data.map((e) => (
            <option key={e.id} value={e.id}>
              {e.denominacion}
            </option>
          ))}
        </select>
        <select
          className="input w-auto! flex-1 sm:flex-none"
          value={grupoFiltro}
          onChange={(e) => setGrupoFiltro(e.target.value as "" | GrupoPlantilla)}
          aria-label="Grupo"
        >
          <option value="">Todos los grupos</option>
          {(Object.keys(GRUPO_LABELS) as GrupoPlantilla[]).map((g) => (
            <option key={g} value={g}>
              {GRUPO_LABELS[g]}
            </option>
          ))}
        </select>
        <label className="relative min-w-[12rem] flex-1">
          <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-carbon/40" />
          <input
            className="input pl-8!"
            placeholder="Buscar por título o código…"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
        </label>
      </div>

      <BulkDeleteBar
        count={sel.selectedIds.length}
        deleting={deleting}
        onDelete={borrarSeleccion}
        onClear={sel.clear}
        label={sel.selectedIds.length === 1 ? "documento seleccionado" : "documentos seleccionados"}
      />

      {documentos.loading ? (
        <SkeletonTable rows={5} cols={4} />
      ) : documentos.data.length === 0 ? (
        <EmptyState
          icon={FileText}
          titulo="Todavía no guardaste documentos"
          texto="Las actas, poderes y notas que generes quedan acá con su código (SOC, POD, FAM, SEP), listas para volver a abrir o imprimir en PDF."
          accion={{ label: "Generar el primero", icon: FilePlus2, href: "/documentos" }}
        />
      ) : filas.length === 0 ? (
        <div className="card text-sm text-carbon/65">No hay documentos con esos filtros.</div>
      ) : (
        <div className="table-shell overflow-x-auto">
          <table>
            <thead>
              <tr>
                <th className="w-8">
                  <input type="checkbox" checked={sel.allSelected} onChange={sel.toggleAll} aria-label="Seleccionar todos" />
                </th>
                <th>Código</th>
                <th>Documento</th>
                <th>Empresa</th>
                <th>Generado</th>
              </tr>
            </thead>
            <tbody>
              {filas.map(({ d, codigo }) => (
                <tr key={d.id}>
                  <td>
                    <input
                      type="checkbox"
                      checked={sel.selected.has(d.id)}
                      onChange={() => sel.toggle(d.id)}
                      aria-label={`Seleccionar ${d.titulo}`}
                    />
                  </td>
                  <td className="whitespace-nowrap font-mono text-xs text-cobre-hover">{codigo}</td>
                  <td className="min-w-[14rem]">
                    <Link href={`/documentos/${d.id}`} className="font-medium hover:text-cobre-hover">
                      {d.titulo}
                    </Link>
                  </td>
                  <td className="min-w-[10rem]">{nombres.get(d.empresa_id) ?? "—"}</td>
                  <td className="whitespace-nowrap">{formatFecha(d.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="mt-10">
        <ArchivoPanel empresaInicial={empresaParam} />
      </div>
    </main>
  );
}

export default function GuardadosPage() {
  return (
    <Suspense fallback={null}>
      <GuardadosContenido />
    </Suspense>
  );
}
