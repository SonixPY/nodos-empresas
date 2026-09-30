"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Download, Printer, Save } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { useAccionistas } from "@/lib/data";
import { calcularParticipaciones } from "@/lib/accionistas";
import { PLANTILLAS, getPlantilla, renderDocumento, valoresIniciales, type Campo, type Contexto, type Datos } from "@/lib/plantillas";
import { descargarWord, imprimir } from "@/lib/descargas";
import { todayIso } from "@/lib/dates";
import { useToast } from "@/components/ToastProvider";
import DocPreview from "@/components/DocPreview";
import { TIPO_CORTO, type Documento, type Empresa } from "@/lib/types";

function CampoInput({
  campo,
  value,
  onChange,
  ctx,
}: {
  campo: Campo;
  value: string | boolean;
  onChange: (v: string | boolean) => void;
  ctx: Contexto;
}) {
  const label = (
    <label className="field-label">
      {campo.label}
      {campo.required && <span className="required-mark">*</span>}
    </label>
  );
  const help = campo.help ? <p className="mt-1 text-[11px] leading-snug text-carbon/50">{campo.help}</p> : null;
  const sv = typeof value === "string" ? value : "";

  switch (campo.type) {
    case "checkbox":
      return (
        <label className="flex items-center gap-2 text-sm text-carbon/75">
          <input type="checkbox" checked={value === true} onChange={(e) => onChange(e.target.checked)} />
          {campo.label}
        </label>
      );
    case "textarea":
      return (
        <div>
          {label}
          <textarea className="input min-h-[76px]" value={sv} onChange={(e) => onChange(e.target.value)} />
          {help}
        </div>
      );
    case "select": {
      const options = campo.optionsFromAccionistas
        ? ctx.accionistas.map((a) => ({ value: a.id, label: a.nombre }))
        : (campo.options ?? []);
      return (
        <div>
          {label}
          <select className="input" value={sv} onChange={(e) => onChange(e.target.value)}>
            {campo.optionsFromAccionistas && options.length === 0 && <option value="">Cargá accionistas primero</option>}
            {options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          {help}
        </div>
      );
    }
    default:
      return (
        <div>
          {label}
          <input
            type={campo.type}
            className="input"
            value={sv}
            min={campo.type === "number" ? 0 : undefined}
            onChange={(e) => onChange(e.target.value)}
          />
          {help}
        </div>
      );
  }
}

/**
 * Generador de documentos: elegís empresa y plantilla, completás el
 * formulario (con datos precargados de la empresa y su libro de
 * accionistas) y ves el documento armado en vivo.
 */
export default function Generador({
  empresas,
  empresaInicial,
  plantillaInicial,
  onSaved,
}: {
  empresas: Empresa[];
  empresaInicial?: string | null;
  plantillaInicial?: string | null;
  onSaved: (d: Documento) => void;
}) {
  const { showToast } = useToast();
  const [empresaId, setEmpresaId] = useState<string>(
    empresas.some((e) => e.id === empresaInicial) ? (empresaInicial as string) : (empresas[0]?.id ?? "")
  );
  const empresa = empresas.find((e) => e.id === empresaId) ?? null;
  const disponibles = useMemo(() => PLANTILLAS.filter((p) => !empresa || p.tipos.includes(empresa.tipo)), [empresa]);
  const [plantillaKey, setPlantillaKey] = useState<string>(plantillaInicial ?? "");
  const plantilla = getPlantilla(plantillaKey) && disponibles.some((p) => p.key === plantillaKey) ? getPlantilla(plantillaKey)! : disponibles[0];

  const { data: accionistas, loading } = useAccionistas(empresaId || null);
  const ctx: Contexto | null = useMemo(() => {
    if (!empresa) return null;
    const { filas, totalAcciones, totalVotos } = calcularParticipaciones(accionistas);
    return { empresa, accionistas: filas, totalAcciones, totalVotos };
  }, [empresa, accionistas]);

  // Los valores se guardan por "empresa + plantilla + versión del libro":
  // al cambiar de plantilla o de empresa se recargan los valores iniciales.
  const claveDatos = `${empresaId}:${plantilla?.key}:${loading ? "cargando" : accionistas.length}`;
  const [datosPorClave, setDatosPorClave] = useState<Record<string, Datos>>({});
  const datos: Datos = useMemo(() => {
    if (!plantilla || !ctx) return {};
    const base = valoresIniciales(plantilla, ctx);
    if (base.fecha === "") base.fecha = todayIso();
    return { ...base, ...(datosPorClave[claveDatos] ?? {}) };
  }, [plantilla, ctx, datosPorClave, claveDatos]);

  const [saving, setSaving] = useState(false);

  if (empresas.length === 0) {
    return (
      <div className="card text-sm text-carbon/70">
        Para generar documentos primero cargá una empresa en{" "}
        <Link href="/empresas" className="text-cobre hover:underline">
          Empresas
        </Link>
        .
      </div>
    );
  }

  if (!plantilla || !ctx || !empresa) {
    return <div className="card text-sm text-carbon/70">No hay plantillas disponibles para este tipo de sociedad todavía.</div>;
  }

  const html = renderDocumento(plantilla, datos, ctx);
  const titulo = plantilla.tituloDoc(datos, ctx);
  const faltan = plantilla.campos.filter((c) => c.required && !datos[c.key]).map((c) => c.label);

  function set(key: string, value: string | boolean) {
    setDatosPorClave((prev) => ({ ...prev, [claveDatos]: { ...(prev[claveDatos] ?? {}), [key]: value } }));
  }

  async function guardar() {
    if (!plantilla || !empresa) return;
    setSaving(true);
    const { data, error } = await supabase
      .from("documentos")
      .insert({ empresa_id: empresa.id, plantilla: plantilla.key, titulo, datos, contenido_html: html })
      .select()
      .single();
    setSaving(false);
    if (error) return showToast(`No se pudo guardar: ${error.message}`, "error");
    showToast("Documento guardado en el historial.");
    onSaved(data as Documento);
  }

  const campos = plantilla.campos.filter((c) => !c.showIf || datos[c.showIf] === true);

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
      <div className="space-y-4">
        <div className="card space-y-3">
          <div>
            <label className="field-label">Empresa</label>
            <select className="input" value={empresaId} onChange={(e) => setEmpresaId(e.target.value)}>
              {empresas.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.denominacion} ({TIPO_CORTO[e.tipo]})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="field-label">Plantilla</label>
            <select className="input" value={plantilla.key} onChange={(e) => setPlantillaKey(e.target.value)}>
              {disponibles.map((p) => (
                <option key={p.key} value={p.key}>
                  {p.numero} · {p.titulo}
                </option>
              ))}
            </select>
            <p className="mt-1.5 text-xs text-carbon/60">{plantilla.descripcion}</p>
          </div>
        </div>

        <div className="card space-y-3">
          <h3 className="text-base">Datos del documento</h3>
          {campos.map((c) => (
            <CampoInput key={c.key} campo={c} value={datos[c.key] ?? ""} onChange={(v) => set(c.key, v)} ctx={ctx} />
          ))}
        </div>
      </div>

      <div className="space-y-3 lg:sticky lg:top-20 lg:self-start">
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className="btn btn-primary" onClick={guardar} disabled={saving}>
            <Save size={15} /> {saving ? "Guardando..." : "Guardar en historial"}
          </button>
          <button type="button" className="btn btn-ghost" onClick={() => descargarWord(titulo, html)}>
            <Download size={15} /> Word
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => {
              if (!imprimir(titulo, html)) showToast("Tu navegador bloqueó la ventana. Permití ventanas emergentes.", "error");
            }}
          >
            <Printer size={15} /> Imprimir / PDF
          </button>
        </div>
        {faltan.length > 0 && (
          <p className="text-xs text-cobre">Faltan datos obligatorios: {faltan.join(", ")}. Los espacios pendientes aparecen resaltados.</p>
        )}
        <div className="max-h-[78vh] overflow-y-auto">
          <DocPreview html={html} />
        </div>
      </div>
    </div>
  );
}
