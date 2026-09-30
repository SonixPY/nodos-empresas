"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { todayIso } from "@/lib/dates";
import { CATEGORIA_LABELS, type CategoriaObligacion, type Empresa, type Obligacion } from "@/lib/types";

/** Alta manual de un vencimiento (algo propio de la empresa que no está en el calendario automático). */
export default function ObligacionForm({
  empresas,
  empresaId,
  onCreated,
  onCancel,
}: {
  empresas: Empresa[];
  empresaId?: string;
  onCreated: (o: Obligacion) => void;
  onCancel: () => void;
}) {
  const [empresa, setEmpresa] = useState(empresaId ?? empresas[0]?.id ?? "");
  const [titulo, setTitulo] = useState("");
  const [fecha, setFecha] = useState(todayIso());
  const [categoria, setCategoria] = useState<CategoriaObligacion>("societario");
  const [descripcion, setDescripcion] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!empresa || !titulo.trim() || !fecha) {
      setError("Completá empresa, título y fecha.");
      return;
    }
    setSaving(true);
    const { data, error: err } = await supabase
      .from("obligaciones")
      .insert({
        empresa_id: empresa,
        titulo: titulo.trim(),
        fecha,
        categoria,
        descripcion: descripcion.trim() || null,
        origen: "manual",
      })
      .select()
      .single();
    setSaving(false);
    if (err) {
      setError(`No se pudo guardar: ${err.message}`);
      return;
    }
    onCreated(data as Obligacion);
  }

  return (
    <form onSubmit={handleSubmit} className="card animate-slide-up">
      <h3 className="mb-3 text-base">Nuevo vencimiento</h3>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {!empresaId && (
          <div>
            <label className="field-label">
              Empresa<span className="required-mark">*</span>
            </label>
            <select className="input" value={empresa} onChange={(e) => setEmpresa(e.target.value)}>
              {empresas.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.denominacion}
                </option>
              ))}
            </select>
          </div>
        )}
        <div className={empresaId ? "sm:col-span-2" : ""}>
          <label className="field-label">
            Qué hay que hacer<span className="required-mark">*</span>
          </label>
          <input className="input" value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ej.: Renovar habilitación municipal" />
        </div>
        <div>
          <label className="field-label">
            Fecha límite<span className="required-mark">*</span>
          </label>
          <input type="date" className="input" value={fecha} onChange={(e) => setFecha(e.target.value)} />
        </div>
        <div>
          <label className="field-label">Categoría</label>
          <select className="input" value={categoria} onChange={(e) => setCategoria(e.target.value as CategoriaObligacion)}>
            {(Object.keys(CATEGORIA_LABELS) as CategoriaObligacion[]).map((c) => (
              <option key={c} value={c}>
                {CATEGORIA_LABELS[c]}
              </option>
            ))}
          </select>
        </div>
        <div className="sm:col-span-2 lg:col-span-4">
          <label className="field-label">Detalle</label>
          <input className="input" value={descripcion} onChange={(e) => setDescripcion(e.target.value)} />
        </div>
      </div>
      {error && <p className="mt-2 text-sm text-bad">{error}</p>}
      <div className="mt-3 flex gap-2">
        <button type="submit" disabled={saving} className="btn btn-primary">
          {saving ? "Guardando..." : "Agregar"}
        </button>
        <button type="button" onClick={onCancel} className="btn btn-ghost">
          Cancelar
        </button>
      </div>
    </form>
  );
}
