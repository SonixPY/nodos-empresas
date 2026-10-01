"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { MESES } from "@/lib/dates";
import { TIPO_LABELS, type Empresa, type NuevaEmpresa, type TipoSociedad } from "@/lib/types";
import type { CamposSiaraEmpresa } from "@/lib/siara";
import { RUBRO_LABEL, RUBROS } from "@/lib/novedades";

/** Datos de la empresa + los que pide SIARA (columnas de la migración 007). */
type FormEmpresa = NuevaEmpresa & Partial<Omit<CamposSiaraEmpresa, "siara_ultima_declaracion" | "siara_numero_solicitud">>;

/** Campos de texto de la persona jurídica que pide SIARA. */
const CAMPOS_SIARA: { k: keyof FormEmpresa; label: string; placeholder?: string; type?: string; wide?: boolean }[] = [
  { k: "email_institucional", label: "Correo electrónico institucional", type: "email" },
  { k: "pagina_web", label: "Página web", placeholder: "https://" },
  { k: "departamento", label: "Departamento", placeholder: "Ej.: Central" },
  { k: "barrio", label: "Barrio" },
  { k: "domicilio_comercial", label: "Domicilio comercial (si difiere)", wide: true },
  { k: "actividad_principal", label: "Actividad principal" },
  { k: "inscripcion_registral", label: "Datos de inscripción registral", placeholder: "Registro Público de Comercio: matrícula, serie, folio…", wide: true },
];

const VACIA: NuevaEmpresa = {
  denominacion: "",
  tipo: "sa",
  ruc: null,
  domicilio: null,
  ciudad: "Asunción",
  fecha_constitucion: null,
  cierre_mes: 12,
  vencimiento_mandato: null,
  tiene_sindico: true,
  capital_integrado: null,
  notas: null,
};

/** Alta o edición de una empresa. Con `empresa` edita; sin ella, crea. */
export default function EmpresaForm({
  empresa,
  onSaved,
  onCancel,
  abrirSiara = false,
}: {
  empresa?: Empresa;
  /** Abre desplegados los datos registrales para SIARA. */
  abrirSiara?: boolean;
  onSaved: (e: Empresa) => void;
  onCancel?: () => void;
}) {
  const [f, setF] = useState<FormEmpresa>(() => {
    if (!empresa) return VACIA;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { id, user_id, created_at, ...rest } = empresa as Empresa & Partial<CamposSiaraEmpresa>;
    return rest;
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [verSiara, setVerSiara] = useState(abrirSiara);

  function set<K extends keyof FormEmpresa>(k: K, val: FormEmpresa[K]) {
    setF((prev) => ({ ...prev, [k]: val }));
  }

  const txt = (k: keyof FormEmpresa) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    set(k, (e.target.value.trim() === "" ? null : e.target.value) as never);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!f.denominacion.trim()) {
      setError("La denominación es obligatoria.");
      return;
    }
    setSaving(true);
    setError(null);
    const payload = { ...f, denominacion: f.denominacion.trim(), tiene_sindico: f.tipo === "sa" ? f.tiene_sindico : false };
    const res = empresa
      ? await supabase.from("empresas").update(payload).eq("id", empresa.id).select().single()
      : await supabase.from("empresas").insert(payload).select().single();
    setSaving(false);
    if (res.error) {
      setError(`No se pudo guardar: ${res.error.message}`);
      return;
    }
    onSaved(res.data as Empresa);
  }

  return (
    <form onSubmit={handleSubmit} className="card animate-slide-up">
      <h2 className="mb-4">{empresa ? "Editar datos de la empresa" : "Nueva empresa"}</h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="sm:col-span-2">
          <label className="field-label">
            Denominación social<span className="required-mark">*</span>
          </label>
          <input
            className="input"
            value={f.denominacion}
            onChange={(e) => set("denominacion", e.target.value)}
            placeholder="Ej.: Agroganadera López S.A."
            autoFocus={!empresa}
          />
        </div>
        <div>
          <label className="field-label">
            Tipo societario<span className="required-mark">*</span>
          </label>
          <select className="input" value={f.tipo} onChange={(e) => set("tipo", e.target.value as TipoSociedad)}>
            {(Object.keys(TIPO_LABELS) as TipoSociedad[]).map((t) => (
              <option key={t} value={t}>
                {TIPO_LABELS[t]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="field-label">RUC</label>
          <input className="input" value={f.ruc ?? ""} onChange={txt("ruc")} placeholder="80000000-0" />
        </div>
        <div>
          <label className="field-label">Ciudad</label>
          <input className="input" value={f.ciudad ?? ""} onChange={txt("ciudad")} />
        </div>
        <div>
          <label className="field-label" htmlFor="empresa-rubro">
            Rubro
          </label>
          <select id="empresa-rubro" className="input" value={f.rubro ?? ""} onChange={(e) => set("rubro", e.target.value || null)}>
            <option value="">Sin especificar</option>
            {RUBROS.map((r) => (
              <option key={r} value={r}>
                {RUBRO_LABEL[r]}
              </option>
            ))}
          </select>
          <p className="mt-1 text-[11px] leading-snug text-carbon/50">Para mostrarte novedades de tu sector. No se comparte con nadie.</p>
        </div>
        <div>
          <label className="field-label">Domicilio social</label>
          <input className="input" value={f.domicilio ?? ""} onChange={txt("domicilio")} placeholder="Calle, número, barrio" />
        </div>
        <div>
          <label className="field-label">Fecha de constitución</label>
          <input type="date" className="input" value={f.fecha_constitucion ?? ""} onChange={txt("fecha_constitucion")} />
        </div>
        <div>
          <label className="field-label">Cierre del ejercicio</label>
          <select className="input" value={f.cierre_mes} onChange={(e) => set("cierre_mes", Number(e.target.value))}>
            {MESES.map((m, i) => (
              <option key={m} value={i + 1}>
                Fin de {m}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="field-label">Vence el mandato de las autoridades</label>
          <input type="date" className="input" value={f.vencimiento_mandato ?? ""} onChange={txt("vencimiento_mandato")} />
        </div>
        <div>
          <label className="field-label">Capital integrado (Gs.)</label>
          <input
            type="number"
            min="0"
            className="input"
            value={f.capital_integrado ?? ""}
            onChange={(e) => set("capital_integrado", e.target.value === "" ? null : Number(e.target.value))}
          />
        </div>
        {f.tipo === "sa" && (
          <div>
            <label className="field-label opacity-0 select-none" aria-hidden="true">
              Síndico
            </label>
            <label className="input flex items-center gap-2 text-sm text-carbon/70">
              <input type="checkbox" checked={f.tiene_sindico} onChange={(e) => set("tiene_sindico", e.target.checked)} />
              Tiene síndico designado
            </label>
          </div>
        )}
        <div className="sm:col-span-2 lg:col-span-3">
          <button
            type="button"
            className="flex w-full items-center justify-between gap-2 rounded-sm border px-3 py-2 text-left text-sm font-medium text-musgo"
            style={{ borderColor: "var(--line)", background: "rgba(242,238,230,0.6)" }}
            onClick={() => setVerSiara((v) => !v)}
            aria-expanded={verSiara}
          >
            <span>
              Datos registrales para SIARA
              <span className="block text-xs font-normal text-carbon/55">Correo institucional, departamento, barrio, inscripción, valor nominal…</span>
            </span>
            <span className="text-xs text-carbon/50">{verSiara ? "Ocultar" : "Completar"}</span>
          </button>
        </div>
        {verSiara && (
          <>
            {CAMPOS_SIARA.map((c) => (
              <div key={c.k} className={c.wide ? "sm:col-span-2" : ""}>
                <label className="field-label">{c.label}</label>
                <input
                  className="input"
                  type={c.type ?? "text"}
                  value={(f[c.k] as string | null | undefined) ?? ""}
                  onChange={txt(c.k)}
                  placeholder={c.placeholder}
                />
              </div>
            ))}
            <div>
              <label className="field-label">Fecha de inscripción</label>
              <input type="date" className="input" value={f.fecha_inscripcion ?? ""} onChange={txt("fecha_inscripcion")} />
            </div>
            <div>
              <label className="field-label">Valor nominal por {f.tipo === "srl" ? "cuota" : "acción"} (Gs.)</label>
              <input
                type="number"
                min="0"
                className="input"
                value={f.valor_nominal_accion ?? ""}
                onChange={(e) => set("valor_nominal_accion", e.target.value === "" ? null : Number(e.target.value))}
              />
            </div>
          </>
        )}
        <div className="sm:col-span-2 lg:col-span-3">
          <label className="field-label">Notas internas</label>
          <textarea className="input min-h-[70px]" value={f.notas ?? ""} onChange={txt("notas")} />
        </div>
      </div>
      {error && <p className="mt-3 text-sm text-bad">{error}</p>}
      <div className="mt-4 flex gap-2">
        <button type="submit" disabled={saving} className="btn btn-primary">
          {saving ? "Guardando..." : empresa ? "Guardar cambios" : "Crear empresa"}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel} className="btn btn-ghost">
            Cancelar
          </button>
        )}
      </div>
    </form>
  );
}
