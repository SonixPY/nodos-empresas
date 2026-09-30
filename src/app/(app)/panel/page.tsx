"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowRight, CalendarClock, Inbox, UserPlus } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { daysUntil, formatFecha, todayIso } from "@/lib/dates";
import {
  ETAPAS,
  ETAPA_COLOR,
  ETAPA_LABEL,
  ORIGEN_LABEL,
  PILAR_COLOR,
  PILAR_LABEL,
  ESTADO_LABEL,
  TEMA_LABEL,
  migracionPendiente,
  type Contenido,
  type Lead,
} from "@/lib/panel";
import { SkeletonStatTiles } from "@/components/Skeleton";

export default function PanelResumen() {
  const [leads, setLeads] = useState<Lead[] | null>(null);
  const [contenido, setContenido] = useState<Contenido[]>([]);
  const [cuentas, setCuentas] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const [l, c, u] = await Promise.all([
        supabase.from("leads").select("*").order("created_at", { ascending: false }).limit(500),
        supabase.from("contenido").select("*").order("fecha", { ascending: true }),
        fetch("/api/admin/users").then((r) => (r.ok ? r.json() : null)).catch(() => null),
      ]);
      if (l.error) setError(l.error.message);
      setLeads((l.data as Lead[]) ?? []);
      setContenido((c.data as Contenido[]) ?? []);
      setCuentas(u?.users?.length ?? null);
    })();
  }, []);

  const hoy = todayIso();
  const datos = useMemo(() => {
    const ls = leads ?? [];
    const activos = ls.filter((l) => l.etapa !== "cliente" && l.etapa !== "descartado");
    const semana = ls.filter((l) => daysUntil(l.created_at.slice(0, 10)) >= -7);
    const seguimientos = activos
      .filter((l) => l.proximo_seguimiento && l.proximo_seguimiento <= hoy)
      .sort((a, b) => (a.proximo_seguimiento! < b.proximo_seguimiento! ? -1 : 1));
    const nuevosSinTocar = ls.filter((l) => l.etapa === "nuevo");
    const porEtapa = ETAPAS.map((e) => ({ ...e, n: ls.filter((l) => l.etapa === e.id).length }));
    const proximoContenido = contenido.filter((c) => c.estado !== "publicado" && c.fecha && c.fecha >= hoy).slice(0, 6);
    const atrasado = contenido.filter((c) => c.estado !== "publicado" && c.fecha && c.fecha < hoy);
    return { activos, semana, seguimientos, nuevosSinTocar, porEtapa, proximoContenido, atrasado };
  }, [leads, contenido, hoy]);

  if (migracionPendiente(error)) {
    return (
      <div className="card flex gap-3 text-sm">
        <AlertTriangle size={18} className="shrink-0 text-cobre" />
        <p>
          Falta correr la migración <code>003_panel.sql</code> en Supabase. Cuando corra, el panel se habilita solo.
        </p>
      </div>
    );
  }
  if (leads === null) return <SkeletonStatTiles count={4} />;

  const total = leads.length || 1;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="stat-tile">
          <p className="stat-label">Leads nuevos (7 días)</p>
          <p className="stat-value">{datos.semana.length}</p>
        </div>
        <div className="stat-tile">
          <p className="stat-label">Leads activos</p>
          <p className="stat-value">{datos.activos.length}</p>
        </div>
        <div className="stat-tile">
          <p className="stat-label">Seguimientos para hoy o atrasados</p>
          <p className="stat-value" style={{ color: datos.seguimientos.length ? "var(--color-bad)" : undefined }}>
            {datos.seguimientos.length}
          </p>
        </div>
        <div className="stat-tile">
          <p className="stat-label">Cuentas NODOS</p>
          <p className="stat-value">{cuentas ?? "—"}</p>
        </div>
      </div>

      <section className="card">
        <div className="mb-3 flex items-baseline justify-between">
          <h2>Embudo</h2>
          <Link href="/panel/leads" className="text-xs font-medium text-cobre-hover hover:underline">
            Ver todos los leads
          </Link>
        </div>
        {leads.length === 0 ? (
          <p className="text-sm text-carbon/60">Todavía no hay leads. Los del formulario del sitio entran solos; también podés cargarlos a mano.</p>
        ) : (
          <>
            <div className="flex h-3 overflow-hidden rounded-full bg-marfil">
              {datos.porEtapa
                .filter((e) => e.n > 0)
                .map((e) => (
                  <div key={e.id} title={`${e.label}: ${e.n}`} style={{ width: `${(e.n / total) * 100}%`, background: e.color }} />
                ))}
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
              {datos.porEtapa.map((e) => (
                <Link key={e.id} href={`/panel/leads?etapa=${e.id}`} className="rounded-md px-2 py-1.5 hover:bg-marfil">
                  <p className="flex items-center gap-1.5 text-xs text-carbon/60">
                    <span className="inline-block h-2 w-2 rounded-full" style={{ background: e.color }} /> {e.label}
                  </p>
                  <p className="font-display text-lg font-semibold text-musgo">{e.n}</p>
                </Link>
              ))}
            </div>
          </>
        )}
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="card">
          <h2 className="mb-3 flex items-center gap-2">
            <CalendarClock size={18} className="text-cobre" /> Seguimientos pendientes
          </h2>
          {datos.seguimientos.length === 0 ? (
            <p className="text-sm text-carbon/60">No hay seguimientos para hoy.</p>
          ) : (
            <ul className="divide-y divide-[var(--line)]">
              {datos.seguimientos.slice(0, 8).map((l) => (
                <li key={l.id}>
                  <Link href={`/panel/leads/${l.id}`} className="flex items-center justify-between gap-3 py-2 hover:text-cobre-hover">
                    <span className="min-w-0">
                      <span className="block truncate font-medium text-musgo">{l.nombre}</span>
                      <span className="text-xs text-carbon/55">
                        {TEMA_LABEL[l.tema]} · {ETAPA_LABEL[l.etapa]}
                      </span>
                    </span>
                    <span className={`shrink-0 text-xs ${l.proximo_seguimiento! < hoy ? "text-bad" : "text-cobre-hover"}`}>
                      {l.proximo_seguimiento! < hoy ? `Atrasado ${formatFecha(l.proximo_seguimiento)}` : "Hoy"}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card">
          <h2 className="mb-3 flex items-center gap-2">
            <Inbox size={18} className="text-cobre" /> Últimos leads
          </h2>
          {leads.length === 0 ? (
            <Link href="/panel/leads?nuevo=1" className="btn btn-primary">
              <UserPlus size={15} /> Cargar un lead
            </Link>
          ) : (
            <ul className="divide-y divide-[var(--line)]">
              {leads.slice(0, 6).map((l) => (
                <li key={l.id}>
                  <Link href={`/panel/leads/${l.id}`} className="flex items-center justify-between gap-3 py-2 hover:text-cobre-hover">
                    <span className="min-w-0">
                      <span className="block truncate font-medium text-musgo">{l.nombre}</span>
                      <span className="text-xs text-carbon/55">
                        {ORIGEN_LABEL[l.origen]} · {TEMA_LABEL[l.tema]}
                      </span>
                    </span>
                    <span className="shrink-0 rounded-full px-2 py-0.5 text-xs text-marfil" style={{ background: ETAPA_COLOR[l.etapa] }}>
                      {ETAPA_LABEL[l.etapa]}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="card">
        <div className="mb-3 flex items-baseline justify-between">
          <h2>Contenido que viene</h2>
          <Link href="/panel/contenido" className="flex items-center gap-1 text-xs font-medium text-cobre-hover hover:underline">
            Calendario <ArrowRight size={12} />
          </Link>
        </div>
        {datos.atrasado.length > 0 && (
          <p className="mb-3 flex items-center gap-1.5 text-sm text-bad">
            <AlertTriangle size={14} /> {datos.atrasado.length} pieza{datos.atrasado.length === 1 ? "" : "s"} con fecha pasada sin publicar.
          </p>
        )}
        {datos.proximoContenido.length === 0 ? (
          <p className="text-sm text-carbon/60">No hay contenido programado. Cargá el próximo episodio de Zona Gris en el calendario.</p>
        ) : (
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {datos.proximoContenido.map((c) => (
              <li key={c.id} className="rounded-lg border border-[var(--line)] p-3">
                <p className="t-caption" style={{ color: PILAR_COLOR[c.pilar] }}>
                  {PILAR_LABEL[c.pilar]} · {formatFecha(c.fecha)}
                </p>
                <p className="mt-0.5 font-medium text-musgo">{c.titulo}</p>
                <p className="text-xs text-carbon/55">{ESTADO_LABEL[c.estado]}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
