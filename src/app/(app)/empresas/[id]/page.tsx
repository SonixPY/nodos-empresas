"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, CalendarClock, FilePlus2, FileText, Pencil, Trash2 } from "lucide-react";
import { useDocumentos, useEmpresa } from "@/lib/data";
import { formatFecha, MESES } from "@/lib/dates";
import { formatPyg } from "@/lib/format";
import { useToast } from "@/components/ToastProvider";
import { mensajeError } from "@/lib/nodos/errores";
import EmpresaForm from "@/components/EmpresaForm";
import AccionistasPanel from "@/components/AccionistasPanel";
import SiaraPanel from "@/components/SiaraPanel";
import PoderesPanel from "@/components/PoderesPanel";
import ArchivoPanel from "@/components/ArchivoPanel";
import { SkeletonBlock } from "@/components/Skeleton";
import EmptyState from "@/components/EmptyState";
import { esSociedad, REGIMEN_LABELS, TIPO_LABELS, type Empresa } from "@/lib/types";
import type { EmpresaSiara } from "@/lib/siara";
import { esRubro, RUBRO_LABEL } from "@/lib/novedades";

const TABS = [
  { key: "datos", label: "Datos" },
  { key: "accionistas", label: "Accionistas" },
  { key: "siara", label: "SIARA" },
  { key: "poderes", label: "Poderes" },
  { key: "documentos", label: "Documentos" },
] as const;
type Tab = (typeof TABS)[number]["key"];

/** Unipersonal y RUC personal no tienen libro de accionistas ni SIARA (Ley
 * 6446/2019 alcanza a personas y estructuras jurídicas). */
const SOLO_SOCIEDADES: Tab[] = ["accionistas", "siara"];
const tabsPara = (e: Empresa) => TABS.filter((t) => esSociedad(e.tipo) || !SOLO_SOCIEDADES.includes(t.key));

function Datos({
  empresa,
  onSaved,
  onDeleted,
  editarInicial = false,
}: {
  empresa: Empresa;
  onSaved: (e: Empresa) => void;
  onDeleted: () => void;
  /** Abre directo el formulario con los datos registrales de SIARA (desde la pestaña SIARA). */
  editarInicial?: boolean;
}) {
  const [editando, setEditando] = useState(editarInicial);
  const { showToast } = useToast();

  async function eliminar() {
    if (!confirm(`¿Eliminar ${empresa.denominacion}? Se borran también sus accionistas, vencimientos, documentos y archivos subidos. No se puede deshacer.`)) return;
    // Pasa por el servidor: borra también los archivos de Storage de la empresa.
    const res = await fetch(`/api/empresas/${empresa.id}`, { method: "DELETE" }).catch((e: unknown) => e);
    if (!(res instanceof Response)) return showToast(`No se pudo eliminar: ${mensajeError(res)}`, "error");
    const body = (await res.json().catch(() => null)) as { message?: string } | null;
    if (!res.ok) return showToast(`No se pudo eliminar: ${body?.message ?? "error del servidor."}`, "error");
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
        abrirSiara={editarInicial}
      />
    );
  }

  const sociedad = esSociedad(empresa.tipo);
  const filas: [string, string][] = [
    ["Tipo de entidad", TIPO_LABELS[empresa.tipo]],
    ["RUC", empresa.ruc ?? "—"],
    ["Domicilio", [empresa.domicilio, empresa.ciudad].filter(Boolean).join(", ") || "—"],
    [sociedad ? "Constitución" : "Inicio de actividades", formatFecha(empresa.fecha_constitucion)],
    ["Cierre del ejercicio", `Fin de ${MESES[(empresa.cierre_mes || 12) - 1]}`],
  ];
  if (sociedad) {
    filas.push(["Vence el mandato", formatFecha(empresa.vencimiento_mandato)]);
    filas.push(["Capital integrado", empresa.capital_integrado ? formatPyg(empresa.capital_integrado) : "—"]);
  }
  if (empresa.regimen_tributario) filas.push(["Régimen tributario", REGIMEN_LABELS[empresa.regimen_tributario]]);
  if (esRubro(empresa.rubro)) filas.push(["Rubro", RUBRO_LABEL[empresa.rubro]]);
  if (empresa.tipo === "sa") filas.push(["Síndico", empresa.tiene_sindico ? "Sí" : "No"]);
  // Datos registrales para SIARA (migración 007), si están cargados.
  const s = empresa as EmpresaSiara;
  const extra: [string, string | null | undefined][] = [
    ["Correo institucional", s.email_institucional],
    ["Departamento / barrio", [s.departamento, s.barrio].filter(Boolean).join(" · ")],
    ["Domicilio comercial", s.domicilio_comercial],
    ["Actividad principal", s.actividad_principal],
    ["Inscripción registral", [s.inscripcion_registral, s.fecha_inscripcion ? formatFecha(s.fecha_inscripcion) : null].filter(Boolean).join(" · ")],
    ["Valor nominal", s.valor_nominal_accion ? formatPyg(s.valor_nominal_accion) : null],
  ];
  for (const [k, v] of extra) if (v) filas.push([k, v]);

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
      <div className="mt-5 flex flex-wrap gap-2">
        <button type="button" className="btn btn-ghost whitespace-nowrap" onClick={() => setEditando(true)}>
          <Pencil size={14} /> Editar
        </button>
        <button type="button" className="btn btn-ghost whitespace-nowrap text-bad" onClick={eliminar}>
          <Trash2 size={14} /> Eliminar empresa
        </button>
      </div>
    </div>
  );
}

/** Documentos de la empresa en un solo lugar: lo generado en NODOS y lo
 * que se subió al archivo (estatutos, actas firmadas, constancias). */
function Documentos({ empresa }: { empresa: Empresa }) {
  const { data, loading } = useDocumentos(empresa.id);
  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-xl">Generados en NODOS</h2>
          <Link href={`/documentos?empresa=${empresa.id}`} className="btn btn-primary">
            <FileText size={15} /> Generar documento
          </Link>
        </div>
        {loading ? (
          <SkeletonBlock className="h-24" />
        ) : data.length === 0 ? (
          <EmptyState
            compacta
            icon={FileText}
            titulo="Todavía no generaste documentos para esta empresa"
            texto="Actas, poderes y notas con los datos de la empresa y sus accionistas ya precargados. Lo que guardes aparece acá."
            accion={{ label: "Generar documento", icon: FilePlus2, href: `/documentos?empresa=${empresa.id}` }}
          />
        ) : (
          <ul className="divide-y divide-[var(--line)] rounded-sm border bg-white" style={{ borderColor: "var(--line)" }}>
            {data.map((d) => (
              <li key={d.id}>
                <Link href={`/documentos/${d.id}`} className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm hover:bg-marfil/60">
                  <span className="min-w-0 [overflow-wrap:anywhere]">{d.titulo}</span>
                  <span className="shrink-0 text-xs text-carbon/55">{formatFecha(d.created_at)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
      <ArchivoPanel empresaId={empresa.id} empresas={[empresa]} />
    </div>
  );
}

function FichaEmpresa() {
  const { id } = useParams<{ id: string }>();
  const params = useSearchParams();
  const router = useRouter();
  const { data: empresa, setData, loading, error } = useEmpresa(id);
  // Enlaces viejos: ?tab=archivo ahora es Documentos.
  const tabParam = (params.get("tab") === "archivo" ? "documentos" : params.get("tab")) as Tab | null;
  const [tabElegida, setTab] = useState<Tab>(TABS.some((t) => t.key === tabParam) ? (tabParam as Tab) : "datos");
  // Si la entidad no tiene esa pestaña (p. ej. Accionistas en un unipersonal), se muestra Datos.
  const tab: Tab = empresa && !tabsPara(empresa).some((t) => t.key === tabElegida) ? "datos" : tabElegida;
  const [editarDatos, setEditarDatos] = useState(false);

  function irA(t: Tab) {
    setEditarDatos(false);
    setTab(t);
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <Link href="/empresas" className="inline-flex items-center gap-1 text-xs text-carbon/55 hover:text-cobre-hover">
        <ArrowLeft size={13} aria-hidden /> Empresas
      </Link>
      {loading ? (
        <SkeletonBlock className="mt-3 h-10 w-80" />
      ) : error || !empresa ? (
        <p className="mt-4 text-sm text-bad">{error ?? "No se encontró la empresa."}</p>
      ) : (
        <>
          <header className="mb-5 mt-2">
            <h1 className="max-sm:text-2xl max-sm:leading-tight [overflow-wrap:anywhere]">{empresa.denominacion}</h1>
            <p className="mt-1 text-sm text-carbon/60">
              {TIPO_LABELS[empresa.tipo]}
              {empresa.ruc ? ` · RUC ${empresa.ruc}` : ""}
            </p>
            <Link
              href={`/vencimientos?empresa=${empresa.id}`}
              className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-cobre-hover hover:underline"
            >
              <CalendarClock size={14} aria-hidden /> Ver sus vencimientos
            </Link>
          </header>
          {/* Una sola fila de pestañas; en celulares scrollea en horizontal en
              vez de partirse en dos renglones. */}
          <div
            className="no-scrollbar mb-5 flex gap-1 overflow-x-auto border-b"
            style={{ borderColor: "var(--line)" }}
            role="tablist"
          >
            {tabsPara(empresa).map((t) => (
              <button
                key={t.key}
                type="button"
                role="tab"
                aria-selected={tab === t.key}
                onClick={() => irA(t.key)}
                className={`-mb-px shrink-0 whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition ${
                  tab === t.key ? "border-cobre text-musgo" : "border-transparent text-carbon/55 hover:text-carbon"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div key={tab} className="animate-fade-in">
            {tab === "datos" && (
              <Datos
                empresa={empresa}
                editarInicial={editarDatos}
                onSaved={(e) => {
                  setData(e);
                  if (editarDatos) irA("siara");
                }}
                onDeleted={() => router.push("/empresas")}
              />
            )}
            {tab === "accionistas" && <AccionistasPanel empresa={empresa} />}
            {tab === "siara" && (
              <SiaraPanel
                empresaId={id}
                empresa={empresa as EmpresaSiara}
                onEmpresaChange={(e) => setData(e)}
                onEditarEmpresa={() => {
                  setEditarDatos(true);
                  setTab("datos");
                }}
              />
            )}
            {tab === "poderes" && <PoderesPanel empresaId={id} empresas={[empresa]} />}
            {tab === "documentos" && <Documentos empresa={empresa} />}
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
