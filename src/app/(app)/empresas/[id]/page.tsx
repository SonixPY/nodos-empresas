"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { CalendarPlus, FileText, Pencil, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { generarCalendario, useDocumentos, useEmpresa, useObligaciones } from "@/lib/data";
import { formatFecha, MESES } from "@/lib/dates";
import { formatPyg } from "@/lib/format";
import { useToast } from "@/components/ToastProvider";
import EmpresaForm from "@/components/EmpresaForm";
import AccionistasPanel from "@/components/AccionistasPanel";
import ObligacionesLista, { aplicarCambio } from "@/components/ObligacionesLista";
import ObligacionForm from "@/components/ObligacionForm";
import { SkeletonBlock } from "@/components/Skeleton";
import { TIPO_LABELS, type Empresa } from "@/lib/types";

const TABS = [
  { key: "accionistas", label: "Libro de accionistas" },
  { key: "vencimientos", label: "Vencimientos" },
  { key: "documentos", label: "Documentos" },
  { key: "datos", label: "Datos" },
] as const;
type Tab = (typeof TABS)[number]["key"];

function Datos({ empresa, onSaved, onDeleted }: { empresa: Empresa; onSaved: (e: Empresa) => void; onDeleted: () => void }) {
  const [editando, setEditando] = useState(false);
  const { showToast } = useToast();

  async function eliminar() {
    if (!confirm(`¿Eliminar ${empresa.denominacion}? Se borran también sus accionistas, vencimientos y documentos. No se puede deshacer.`)) return;
    const { error } = await supabase.from("empresas").delete().eq("id", empresa.id);
    if (error) return showToast(`No se pudo eliminar: ${error.message}`, "error");
    showToast("Empresa eliminada.");
    onDeleted();
  }

  if (editando) {
    return (
      <EmpresaForm
        empresa={empresa}
        onSaved={(e) => {
          setEditando(false);
          onSaved(e);
        }}
        onCancel={() => setEditando(false)}
      />
    );
  }

  const filas: [string, string][] = [
    ["Tipo societario", TIPO_LABELS[empresa.tipo]],
    ["RUC", empresa.ruc ?? "—"],
    ["Domicilio", [empresa.domicilio, empresa.ciudad].filter(Boolean).join(", ") || "—"],
    ["Constitución", formatFecha(empresa.fecha_constitucion)],
    ["Cierre del ejercicio", `Fin de ${MESES[(empresa.cierre_mes || 12) - 1]}`],
    ["Vence el mandato", formatFecha(empresa.vencimiento_mandato)],
    ["Capital integrado", empresa.capital_integrado ? formatPyg(empresa.capital_integrado) : "—"],
  ];
  if (empresa.tipo === "sa") filas.push(["Síndico", empresa.tiene_sindico ? "Sí" : "No"]);

  return (
    <div className="card">
      <dl className="grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-2">
        {filas.map(([k, val]) => (
          <div key={k}>
            <dt className="text-xs text-carbon/55">{k}</dt>
            <dd className="text-sm">{val}</dd>
          </div>
        ))}
      </dl>
      {empresa.notas && <p className="mt-4 whitespace-pre-line text-sm text-carbon/70">{empresa.notas}</p>}
      <div className="mt-5 flex gap-2">
        <button type="button" className="btn btn-ghost" onClick={() => setEditando(true)}>
          <Pencil size={14} /> Editar
        </button>
        <button type="button" className="btn btn-ghost text-bad" onClick={eliminar}>
          <Trash2 size={14} /> Eliminar empresa
        </button>
      </div>
    </div>
  );
}

function Vencimientos({ empresa }: { empresa: Empresa }) {
  const { showToast } = useToast();
  const { data, setData, reload, loading } = useObligaciones(empresa.id);
  const [filtro, setFiltro] = useState<"pendientes" | "hechas" | "todas">("pendientes");
  const [nueva, setNueva] = useState(false);
  const [generando, setGenerando] = useState(false);
  const anio = new Date().getFullYear();

  const visibles = data.filter((o) => (filtro === "todas" ? true : filtro === "hechas" ? o.estado === "hecho" : o.estado === "pendiente"));

  async function generar(y: number) {
    setGenerando(true);
    const r = await generarCalendario(empresa, y);
    setGenerando(false);
    if (r.error) return showToast(`No se pudo generar: ${r.error}`, "error");
    await reload();
    showToast(r.nuevas > 0 ? `${r.nuevas} vencimientos agregados para ${y}.` : `El calendario ${y} ya estaba generado.`);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="segmented">
          {(["pendientes", "hechas", "todas"] as const).map((f) => (
            <button key={f} type="button" className={filtro === f ? "active" : ""} onClick={() => setFiltro(f)}>
              {f[0].toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {[anio, anio + 1].map((y) => (
            <button key={y} type="button" className="btn btn-ghost" onClick={() => generar(y)} disabled={generando}>
              <CalendarPlus size={15} /> Calendario {y}
            </button>
          ))}
          <button type="button" className="btn btn-primary" onClick={() => setNueva(true)}>
            <Plus size={15} /> Vencimiento
          </button>
        </div>
      </div>
      {nueva && (
        <ObligacionForm
          empresas={[empresa]}
          empresaId={empresa.id}
          onCreated={(o) => {
            setNueva(false);
            setData((prev) => [...prev, o].sort((a, b) => a.fecha.localeCompare(b.fecha)));
          }}
          onCancel={() => setNueva(false)}
        />
      )}
      {loading ? (
        <SkeletonBlock className="h-32" />
      ) : (
        <ObligacionesLista
          obligaciones={visibles}
          onChange={(id, patch) => setData((prev) => aplicarCambio(prev, id, patch))}
          vacio={filtro === "pendientes" ? "No hay vencimientos pendientes." : "Nada para mostrar."}
        />
      )}
      <p className="text-xs text-carbon/55">
        El calendario automático sale del tipo societario y el mes de cierre. Los plazos en días hábiles descuentan fines de semana y feriados fijos, pero no los trasladables: tomalos como
        referencia y confirmalos. Tocá una tarea para ver el detalle y la base legal.
      </p>
    </div>
  );
}

function Documentos({ empresa }: { empresa: Empresa }) {
  const { data, loading } = useDocumentos(empresa.id);
  return (
    <div className="space-y-3">
      <Link href={`/documentos?empresa=${empresa.id}`} className="btn btn-primary">
        <FileText size={15} /> Generar documento
      </Link>
      {loading ? (
        <SkeletonBlock className="h-24" />
      ) : data.length === 0 ? (
        <p className="rounded border border-dashed p-6 text-center text-sm text-carbon/60" style={{ borderColor: "var(--line)" }}>
          Todavía no generaste documentos para esta empresa.
        </p>
      ) : (
        <ul className="divide-y rounded-sm border bg-white" style={{ borderColor: "var(--line)" }}>
          {data.map((d) => (
            <li key={d.id}>
              <Link href={`/documentos/${d.id}`} className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm hover:bg-marfil/60">
                <span>{d.titulo}</span>
                <span className="shrink-0 text-xs text-carbon/55">{formatFecha(d.created_at)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function FichaEmpresa() {
  const { id } = useParams<{ id: string }>();
  const params = useSearchParams();
  const router = useRouter();
  const { data: empresa, setData, loading, error } = useEmpresa(id);
  const tabParam = params.get("tab") as Tab | null;
  const [tab, setTab] = useState<Tab>(TABS.some((t) => t.key === tabParam) ? (tabParam as Tab) : "accionistas");

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <Link href="/empresas" className="text-xs text-carbon/55 hover:text-cobre-hover">
        ← Empresas
      </Link>
      {loading ? (
        <SkeletonBlock className="mt-3 h-10 w-80" />
      ) : error || !empresa ? (
        <p className="mt-4 text-sm text-bad">{error ?? "No se encontró la empresa."}</p>
      ) : (
        <>
          <header className="mb-5 mt-2">
            <h1>{empresa.denominacion}</h1>
            <p className="mt-1 text-sm text-carbon/60">
              {TIPO_LABELS[empresa.tipo]}
              {empresa.ruc ? ` · RUC ${empresa.ruc}` : ""}
            </p>
          </header>
          <div className="mb-5 flex flex-wrap gap-1 border-b" style={{ borderColor: "var(--line)" }}>
            {TABS.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium transition ${
                  tab === t.key ? "border-cobre text-musgo" : "border-transparent text-carbon/55 hover:text-carbon"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div key={tab} className="animate-fade-in">
            {tab === "accionistas" && <AccionistasPanel empresa={empresa} />}
            {tab === "vencimientos" && <Vencimientos empresa={empresa} />}
            {tab === "documentos" && <Documentos empresa={empresa} />}
            {tab === "datos" && <Datos empresa={empresa} onSaved={(e) => setData(e)} onDeleted={() => router.push("/empresas")} />}
          </div>
        </>
      )}
    </main>
  );
}

export default function EmpresaPage() {
  return (
    <Suspense fallback={null}>
      <FichaEmpresa />
    </Suspense>
  );
}
