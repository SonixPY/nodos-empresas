"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertTriangle, Columns3, List, MessageCircle, Plus, Search } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { formatFecha, todayIso } from "@/lib/dates";
import { useToast } from "@/components/ToastProvider";
import LeadForm from "@/components/panel/LeadForm";
import { SkeletonTable } from "@/components/Skeleton";
import {
  ETAPAS,
  ETAPA_COLOR,
  ETAPA_LABEL,
  ORIGEN_LABEL,
  TEMA_LABEL,
  migracionPendiente,
  waLink,
  type Etapa,
  type Lead,
  type Tema,
} from "@/lib/panel";

function Seguimiento({ fecha }: { fecha: string | null }) {
  if (!fecha) return <span className="text-carbon/35">—</span>;
  const hoy = todayIso();
  const cls = fecha < hoy ? "text-bad" : fecha === hoy ? "text-cobre-hover font-medium" : "text-carbon/70";
  return <span className={cls}>{fecha === hoy ? "Hoy" : formatFecha(fecha)}</span>;
}

function LeadsContenido() {
  const params = useSearchParams();
  const router = useRouter();
  const { showToast } = useToast();
  const [leads, setLeads] = useState<Lead[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [vista, setVista] = useState<"tablero" | "lista">("tablero");
  const [q, setQ] = useState("");
  const [tema, setTema] = useState<Tema | "todos">("todos");
  const [nuevo, setNuevo] = useState(params.get("nuevo") === "1");
  const etapaFiltro = params.get("etapa") as Etapa | null;

  useEffect(() => {
    supabase
      .from("leads")
      .select("*")
      .order("created_at", { ascending: false })
      .then(({ data, error: err }) => {
        if (err) setError(err.message);
        setLeads((data as Lead[]) ?? []);
      });
  }, []);

  const filtrados = useMemo(() => {
    const t = q.trim().toLowerCase();
    return (leads ?? []).filter(
      (l) =>
        (tema === "todos" || l.tema === tema) &&
        (!etapaFiltro || l.etapa === etapaFiltro) &&
        (!t || [l.nombre, l.email, l.empresa, l.telefono, l.mensaje].some((x) => x?.toLowerCase().includes(t)))
    );
  }, [leads, q, tema, etapaFiltro]);

  async function mover(l: Lead, etapa: Etapa) {
    if (etapa === l.etapa) return;
    setLeads((prev) => (prev ?? []).map((x) => (x.id === l.id ? { ...x, etapa } : x)));
    const { error: err } = await supabase.from("leads").update({ etapa }).eq("id", l.id);
    if (err) {
      setLeads((prev) => (prev ?? []).map((x) => (x.id === l.id ? { ...x, etapa: l.etapa } : x)));
      return showToast(`No se pudo mover: ${err.message}`, "error");
    }
    await supabase.from("lead_actividades").insert({ lead_id: l.id, tipo: "etapa", texto: `${ETAPA_LABEL[l.etapa]} → ${ETAPA_LABEL[etapa]}` });
  }

  if (migracionPendiente(error)) {
    return (
      <div className="card flex gap-3 text-sm">
        <AlertTriangle size={18} className="shrink-0 text-cobre" />
        <p>
          Falta correr la migración <code>003_panel.sql</code> en Supabase.
        </p>
      </div>
    );
  }

  return (
    <>
      <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1>Leads</h1>
          <p className="mt-1 text-carbon/65">Cada consulta, de dónde vino y en qué etapa está.</p>
        </div>
        {!nuevo && (
          <button type="button" className="btn btn-primary" onClick={() => setNuevo(true)}>
            <Plus size={15} /> Nuevo lead
          </button>
        )}
      </header>

      {nuevo && (
        <LeadForm
          onCreated={(l) => {
            setNuevo(false);
            setLeads((prev) => [l, ...(prev ?? [])]);
          }}
          onCancel={() => setNuevo(false)}
        />
      )}

      <div className="mb-5 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1 sm:max-w-xs">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-carbon/40" />
          <input className="input pl-9" placeholder="Buscar nombre, email, empresa..." value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <select className="input w-auto" value={tema} onChange={(e) => setTema(e.target.value as Tema | "todos")}>
          <option value="todos">Todos los temas</option>
          {Object.entries(TEMA_LABEL).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        {etapaFiltro && (
          <button type="button" className="btn btn-ghost py-1.5 text-xs" onClick={() => router.push("/panel/leads")}>
            Etapa: {ETAPA_LABEL[etapaFiltro]} ✕
          </button>
        )}
        <div className="segmented ml-auto">
          <button type="button" className={vista === "tablero" ? "active" : ""} onClick={() => setVista("tablero")}>
            <Columns3 size={14} className="mr-1 inline" /> Tablero
          </button>
          <button type="button" className={vista === "lista" ? "active" : ""} onClick={() => setVista("lista")}>
            <List size={14} className="mr-1 inline" /> Lista
          </button>
        </div>
      </div>

      {leads === null ? (
        <SkeletonTable rows={5} cols={4} />
      ) : vista === "tablero" ? (
        <div className="-mx-4 overflow-x-auto px-4 pb-2">
          <div className="grid min-w-[1100px] grid-cols-6 gap-3">
            {ETAPAS.map((e) => {
              const col = filtrados.filter((l) => l.etapa === e.id);
              return (
                <div key={e.id} className="rounded-lg bg-white/60 p-2">
                  <p className="mb-2 flex items-center justify-between px-1 text-xs font-semibold uppercase tracking-wide text-carbon/60">
                    <span className="flex items-center gap-1.5">
                      <span className="inline-block h-2 w-2 rounded-full" style={{ background: e.color }} /> {e.label}
                    </span>
                    <span>{col.length}</span>
                  </p>
                  <div className="space-y-2">
                    {col.map((l) => (
                      <div key={l.id} className="card card-hover !p-3">
                        <Link href={`/panel/leads/${l.id}`} className="block">
                          <p className="truncate font-medium text-musgo">{l.nombre}</p>
                          <p className="truncate text-xs text-carbon/55">{l.empresa || TEMA_LABEL[l.tema]}</p>
                          <p className="mt-1 flex items-center justify-between text-xs">
                            <span className="text-carbon/45">{ORIGEN_LABEL[l.origen]}</span>
                            <Seguimiento fecha={l.proximo_seguimiento} />
                          </p>
                        </Link>
                        <select
                          aria-label="Mover a etapa"
                          className="mt-2 w-full rounded border border-[var(--line)] bg-white px-1.5 py-1 text-xs"
                          value={l.etapa}
                          onChange={(ev) => mover(l, ev.target.value as Etapa)}
                        >
                          {ETAPAS.map((x) => (
                            <option key={x.id} value={x.id}>
                              {x.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="table-shell">
          <table>
            <thead>
              <tr>
                <th>Lead</th>
                <th>Tema</th>
                <th>Origen</th>
                <th>Etapa</th>
                <th>Seguimiento</th>
                <th>Alta</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {filtrados.map((l) => {
                const wa = waLink(l.telefono);
                return (
                  <tr key={l.id}>
                    <td>
                      <Link href={`/panel/leads/${l.id}`} className="font-medium text-musgo hover:text-cobre-hover">
                        {l.nombre}
                      </Link>
                      <p className="text-xs text-carbon/55">{[l.empresa, l.email].filter(Boolean).join(" · ")}</p>
                    </td>
                    <td>{TEMA_LABEL[l.tema]}</td>
                    <td>{ORIGEN_LABEL[l.origen]}</td>
                    <td>
                      <span className="rounded-full px-2 py-0.5 text-xs text-marfil" style={{ background: ETAPA_COLOR[l.etapa] }}>
                        {ETAPA_LABEL[l.etapa]}
                      </span>
                    </td>
                    <td>
                      <Seguimiento fecha={l.proximo_seguimiento} />
                    </td>
                    <td className="whitespace-nowrap text-xs text-carbon/60">{formatFecha(l.created_at)}</td>
                    <td>
                      {wa && (
                        <a href={wa} target="_blank" rel="noopener" title="Escribir por WhatsApp" className="text-carbon/50 hover:text-cobre-hover">
                          <MessageCircle size={16} />
                        </a>
                      )}
                    </td>
                  </tr>
                );
              })}
              {filtrados.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-6 text-center text-carbon/55">
                    No hay leads con estos filtros.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

export default function LeadsPage() {
  return (
    <Suspense fallback={null}>
      <LeadsContenido />
    </Suspense>
  );
}
