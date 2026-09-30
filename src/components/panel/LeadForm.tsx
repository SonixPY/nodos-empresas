"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useToast } from "@/components/ToastProvider";
import { ORIGEN_LABEL, TEMA_LABEL, type Lead, type Origen, type Tema } from "@/lib/panel";

/** Alta manual de un lead (llegó por WhatsApp, Instagram, un evento...). */
export default function LeadForm({ onCreated, onCancel }: { onCreated: (l: Lead) => void; onCancel: () => void }) {
  const { showToast } = useToast();
  const [f, setF] = useState({ nombre: "", email: "", telefono: "", empresa: "", tema: "otro" as Tema, origen: "whatsapp" as Origen, mensaje: "", proximo_seguimiento: "" });
  const [saving, setSaving] = useState(false);
  const set = (k: keyof typeof f, v: string) => setF((p) => ({ ...p, [k]: v }));

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    if (!f.nombre.trim()) return;
    setSaving(true);
    const { data, error } = await supabase
      .from("leads")
      .insert({
        nombre: f.nombre.trim(),
        email: f.email.trim().toLowerCase() || null,
        telefono: f.telefono.trim() || null,
        empresa: f.empresa.trim() || null,
        tema: f.tema,
        origen: f.origen,
        mensaje: f.mensaje.trim() || null,
        proximo_seguimiento: f.proximo_seguimiento || null,
      })
      .select()
      .single();
    setSaving(false);
    if (error) return showToast(`No se pudo guardar: ${error.message}`, "error");
    await supabase.from("lead_actividades").insert({ lead_id: data.id, tipo: "sistema", texto: `Lead cargado a mano (origen: ${ORIGEN_LABEL[f.origen]}).` });
    showToast("Lead cargado.");
    onCreated(data as Lead);
  }

  return (
    <form onSubmit={guardar} className="card mb-6">
      <h2 className="mb-4">Nuevo lead</h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label className="field-label">
            Nombre<span className="required-mark">*</span>
          </label>
          <input className="input" required value={f.nombre} onChange={(e) => set("nombre", e.target.value)} autoFocus />
        </div>
        <div>
          <label className="field-label">Email</label>
          <input className="input" type="email" value={f.email} onChange={(e) => set("email", e.target.value)} />
        </div>
        <div>
          <label className="field-label">Teléfono / WhatsApp</label>
          <input className="input" value={f.telefono} onChange={(e) => set("telefono", e.target.value)} placeholder="0981 123 456" />
        </div>
        <div>
          <label className="field-label">Empresa</label>
          <input className="input" value={f.empresa} onChange={(e) => set("empresa", e.target.value)} />
        </div>
        <div>
          <label className="field-label">Tema</label>
          <select className="input" value={f.tema} onChange={(e) => set("tema", e.target.value)}>
            {Object.entries(TEMA_LABEL).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="field-label">Origen</label>
          <select className="input" value={f.origen} onChange={(e) => set("origen", e.target.value)}>
            {Object.entries(ORIGEN_LABEL).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="field-label">Próximo seguimiento</label>
          <input className="input" type="date" value={f.proximo_seguimiento} onChange={(e) => set("proximo_seguimiento", e.target.value)} />
        </div>
        <div className="sm:col-span-2 lg:col-span-4">
          <label className="field-label">Qué necesita</label>
          <textarea className="input" rows={3} value={f.mensaje} onChange={(e) => set("mensaje", e.target.value)} />
        </div>
      </div>
      <div className="mt-4 flex gap-2">
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? "Guardando..." : "Guardar lead"}
        </button>
        <button type="button" className="btn btn-ghost" onClick={onCancel}>
          Cancelar
        </button>
      </div>
    </form>
  );
}
