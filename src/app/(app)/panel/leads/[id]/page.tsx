"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Mail, MessageCircle, Phone, Trash2 } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { formatFecha } from "@/lib/dates";
import { useToast } from "@/components/ToastProvider";
import { SkeletonBlock } from "@/components/Skeleton";
import {
  ACTIVIDAD_LABEL,
  ETAPAS,
  ETAPA_LABEL,
  ORIGEN_LABEL,
  TEMA_LABEL,
  waLink,
  type Actividad,
  type Etapa,
  type Lead,
  type TipoActividad,
} from "@/lib/panel";

function fechaHora(iso: string) {
  return new Date(iso).toLocaleString("es-PY", { dateStyle: "short", timeStyle: "short" });
}

export default function LeadPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { showToast } = useToast();
  const [lead, setLead] = useState<Lead | null>(null);
  const [borrador, setBorrador] = useState<Lead | null>(null);
  const [actividades, setActividades] = useState<Actividad[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [nota, setNota] = useState("");
  const [tipoNota, setTipoNota] = useState<TipoActividad>("nota");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const [l, a] = await Promise.all([
        supabase.from("leads").select("*").eq("id", id).maybeSingle(),
        supabase.from("lead_actividades").select("*").eq("lead_id", id).order("created_at", { ascending: false }),
      ]);
      if (l.error || !l.data) return setError(l.error?.message ?? "No se encontró el lead.");
      setLead(l.data as Lead);
      setBorrador(l.data as Lead);
      setActividades((a.data as Actividad[]) ?? []);
    })();
  }, [id]);

  async function registrar(tipo: TipoActividad, texto: string) {
    const { data } = await supabase.from("lead_actividades").insert({ lead_id: id, tipo, texto }).select().single();
    if (data) setActividades((prev) => [data as Actividad, ...prev]);
  }

  async function guardar() {
    if (!borrador || !lead) return;
    setSaving(true);
    const cambios = {
      nombre: borrador.nombre.trim() || lead.nombre,
      email: borrador.email?.trim().toLowerCase() || null,
      telefono: borrador.telefono?.trim() || null,
      empresa: borrador.empresa?.trim() || null,
      tema: borrador.tema,
      origen: borrador.origen,
      etapa: borrador.etapa,
      prioridad: borrador.prioridad,
      proximo_seguimiento: borrador.proximo_seguimiento || null,
      valor_estimado: borrador.valor_estimado,
    };
    const { data, error: err } = await supabase.from("leads").update(cambios).eq("id", id).select().single();
    setSaving(false);
    if (err) return showToast(`No se pudo guardar: ${err.message}`, "error");
    if (lead.etapa !== borrador.etapa) await registrar("etapa", `${ETAPA_LABEL[lead.etapa]} › ${ETAPA_LABEL[borrador.etapa]}`);
    setLead(data as Lead);
    setBorrador(data as Lead);
    showToast("Lead actualizado.");
  }

  async function agregarNota(e: React.FormEvent) {
    e.preventDefault();
    if (!nota.trim()) return;
    await registrar(tipoNota, nota.trim());
    setNota("");
  }

  async function eliminar() {
    if (!lead || !confirm(`¿Eliminar el lead de ${lead.nombre} y todo su historial?`)) return;
    const { error: err } = await supabase.from("leads").delete().eq("id", id);
    if (err) return showToast(`No se pudo eliminar: ${err.message}`, "error");
    showToast("Lead eliminado.");
    router.push("/panel/leads");
  }

  if (error) return <p className="text-bad">{error}</p>;
  if (!lead || !borrador) return <SkeletonBlock className="h-80" />;

  const set = <K extends keyof Lead>(k: K, v: Lead[K]) => setBorrador((p) => (p ? { ...p, [k]: v } : p));
  const wa = waLink(lead.telefono);
  const sucio = JSON.stringify(borrador) !== JSON.stringify(lead);

  return (
    <div>
      <Link href="/panel/leads" className="inline-flex items-center gap-1 text-xs text-carbon/55 hover:text-cobre-hover">
        <ArrowLeft size={13} aria-hidden /> Leads
      </Link>
      <header className="mb-5 mt-2 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1>{lead.nombre}</h1>
          <p className="mt-1 text-carbon/65">
            {TEMA_LABEL[lead.tema]} · llegó por {ORIGEN_LABEL[lead.origen]} el {formatFecha(lead.created_at)}
            {lead.consentimiento ? " · aceptó el aviso de privacidad" : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {wa && (
            <a className="btn btn-ghost" href={wa} target="_blank" rel="noopener" onClick={() => registrar("whatsapp", "Se abrió WhatsApp para escribirle.")}>
              <MessageCircle size={15} /> WhatsApp
            </a>
          )}
          {lead.email && (
            <a
              className="btn btn-ghost"
              href={`mailto:${lead.email}?subject=${encodeURIComponent("Tu consulta a NODOS")}`}
              onClick={() => registrar("email", "Se abrió el correo para escribirle.")}
            >
              <Mail size={15} /> Email
            </a>
          )}
          {lead.telefono && (
            <a className="btn btn-ghost" href={`tel:${lead.telefono}`}>
              <Phone size={15} /> Llamar
            </a>
          )}
          <button type="button" className="btn btn-ghost text-bad" onClick={eliminar} title="Eliminar lead">
            <Trash2 size={15} />
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.2fr_1fr]">
        <section className="card">
          <h2 className="mb-4">Datos y etapa</h2>
          <div className="mb-4 flex flex-wrap gap-1.5">
            {ETAPAS.map((e) => (
              <button
                key={e.id}
                type="button"
                onClick={() => set("etapa", e.id as Etapa)}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                  borrador.etapa === e.id ? "border-transparent text-marfil" : "border-[var(--line)] text-carbon/70 hover:border-cobre"
                }`}
                style={borrador.etapa === e.id ? { background: e.color } : undefined}
              >
                {e.label}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="field-label">Nombre</label>
              <input className="input" value={borrador.nombre} onChange={(e) => set("nombre", e.target.value)} />
            </div>
            <div>
              <label className="field-label">Empresa</label>
              <input className="input" value={borrador.empresa ?? ""} onChange={(e) => set("empresa", e.target.value)} />
            </div>
            <div>
              <label className="field-label">Email</label>
              <input className="input" type="email" value={borrador.email ?? ""} onChange={(e) => set("email", e.target.value)} />
            </div>
            <div>
              <label className="field-label">Teléfono / WhatsApp</label>
              <input className="input" value={borrador.telefono ?? ""} onChange={(e) => set("telefono", e.target.value)} />
            </div>
            <div>
              <label className="field-label">Tema</label>
              <select className="input" value={borrador.tema} onChange={(e) => set("tema", e.target.value as Lead["tema"])}>
                {Object.entries(TEMA_LABEL).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="field-label">Origen</label>
              <select className="input" value={borrador.origen} onChange={(e) => set("origen", e.target.value as Lead["origen"])}>
                {Object.entries(ORIGEN_LABEL).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="field-label">Próximo seguimiento</label>
              <input
                className="input"
                type="date"
                value={borrador.proximo_seguimiento ?? ""}
                onChange={(e) => set("proximo_seguimiento", e.target.value || null)}
              />
            </div>
            <div>
              <label className="field-label">Prioridad</label>
              <select className="input" value={borrador.prioridad} onChange={(e) => set("prioridad", Number(e.target.value) as Lead["prioridad"])}>
                <option value={1}>Alta</option>
                <option value={2}>Media</option>
                <option value={3}>Baja</option>
              </select>
            </div>
            <div>
              <label className="field-label">Valor estimado (USD)</label>
              <input
                className="input"
                type="number"
                min={0}
                value={borrador.valor_estimado ?? ""}
                onChange={(e) => set("valor_estimado", e.target.value === "" ? null : Number(e.target.value))}
              />
            </div>
          </div>
          {lead.mensaje && (
            <div className="mt-4 rounded-md bg-marfil p-3 text-sm">
              <p className="t-caption mb-1 text-carbon/55">Mensaje original</p>
              <p className="whitespace-pre-wrap">{lead.mensaje}</p>
            </div>
          )}
          <button type="button" className="btn btn-primary mt-5" disabled={!sucio || saving} onClick={guardar}>
            {saving ? "Guardando..." : "Guardar cambios"}
          </button>
        </section>

        <section className="card">
          <h2 className="mb-3">Historial</h2>
          <form onSubmit={agregarNota} className="mb-4 space-y-2">
            <div className="flex gap-2">
              <select className="input w-auto" value={tipoNota} onChange={(e) => setTipoNota(e.target.value as TipoActividad)}>
                {(["nota", "llamada", "email", "whatsapp", "reunion"] as TipoActividad[]).map((t) => (
                  <option key={t} value={t}>
                    {ACTIVIDAD_LABEL[t]}
                  </option>
                ))}
              </select>
              <button type="submit" className="btn btn-primary" disabled={!nota.trim()}>
                Agregar
              </button>
            </div>
            <textarea className="input" rows={2} placeholder="Qué se habló, qué quedó pendiente..." value={nota} onChange={(e) => setNota(e.target.value)} />
          </form>
          <ol className="relative space-y-3 border-l border-[var(--line)] pl-4">
            {actividades.map((a) => (
              <li key={a.id}>
                <span className="absolute -left-[5px] mt-1.5 h-2.5 w-2.5 rounded-full bg-cobre" />
                <p className="t-caption text-carbon/50">
                  {ACTIVIDAD_LABEL[a.tipo]} · {fechaHora(a.created_at)}
                </p>
                <p className="whitespace-pre-wrap text-sm">{a.texto}</p>
              </li>
            ))}
            {actividades.length === 0 && <li className="text-sm text-carbon/55">Sin actividad todavía.</li>}
          </ol>
        </section>
      </div>
    </div>
  );
}
