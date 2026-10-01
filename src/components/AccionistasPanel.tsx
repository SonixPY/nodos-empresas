"use client";

import { useState } from "react";
import { ArrowRightLeft, Pencil, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { useAccionistas, useMovimientos } from "@/lib/data";
import { calcularParticipaciones, formatNumero, formatPct, UMBRAL_CAPITAL_PCT, UMBRAL_VOTOS_PCT } from "@/lib/accionistas";
import { obligacionesPorMovimiento } from "@/lib/calendario";
import { formatFecha, todayIso } from "@/lib/dates";
import { formatPyg } from "@/lib/format";
import { useToast } from "@/components/ToastProvider";
import Accordion from "@/components/Accordion";
import { SkeletonTable } from "@/components/Skeleton";
import { MOVIMIENTO_LABELS, type Accionista, type Empresa, type NuevoAccionista, type TipoMovimiento, type TipoPersona } from "@/lib/types";

function vacio(empresaId: string): NuevoAccionista {
  return {
    empresa_id: empresaId,
    nombre: "",
    documento: null,
    tipo_persona: "fisica",
    vinculo: null,
    acciones: 0,
    votos_por_accion: 1,
    cargo: null,
    email: null,
    telefono: null,
  };
}

function aNuevo(a: Accionista): NuevoAccionista {
  return {
    empresa_id: a.empresa_id,
    nombre: a.nombre,
    documento: a.documento,
    tipo_persona: a.tipo_persona,
    vinculo: a.vinculo,
    acciones: Number(a.acciones),
    votos_por_accion: Number(a.votos_por_accion),
    cargo: a.cargo,
    email: a.email,
    telefono: a.telefono,
  };
}

function AccionistaForm({
  inicial,
  editandoId,
  onSaved,
  onCancel,
}: {
  inicial: NuevoAccionista;
  editandoId: string | null;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [f, setF] = useState<NuevoAccionista>(inicial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = <K extends keyof NuevoAccionista>(k: K, val: NuevoAccionista[K]) => setF((p) => ({ ...p, [k]: val }));
  const txt = (k: keyof NuevoAccionista) => (e: React.ChangeEvent<HTMLInputElement>) =>
    set(k, (e.target.value.trim() === "" ? null : e.target.value) as never);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!f.nombre.trim()) {
      setError("El nombre es obligatorio.");
      return;
    }
    setSaving(true);
    const payload = { ...f, nombre: f.nombre.trim() };
    const { error: err } = editandoId
      ? await supabase.from("accionistas").update(payload).eq("id", editandoId)
      : await supabase.from("accionistas").insert(payload);
    setSaving(false);
    if (err) {
      setError(`No se pudo guardar: ${err.message}`);
      return;
    }
    onSaved();
  }

  return (
    <form onSubmit={submit} className="animate-slide-up mb-4 rounded-sm border p-4" style={{ borderColor: "var(--line)", background: "rgba(242,238,230,0.5)" }}>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="sm:col-span-2">
          <label className="field-label">
            Nombre o razón social<span className="required-mark">*</span>
          </label>
          <input className="input" value={f.nombre} onChange={(e) => set("nombre", e.target.value)} autoFocus />
        </div>
        <div>
          <label className="field-label">Persona</label>
          <select className="input" value={f.tipo_persona} onChange={(e) => set("tipo_persona", e.target.value as TipoPersona)}>
            <option value="fisica">Física</option>
            <option value="juridica">Jurídica</option>
          </select>
        </div>
        <div>
          <label className="field-label">{f.tipo_persona === "juridica" ? "RUC" : "C.I."}</label>
          <input className="input" value={f.documento ?? ""} onChange={txt("documento")} />
        </div>
        <div>
          <label className="field-label">
            Acciones{editandoId ? "" : " iniciales"}
          </label>
          <input
            type="number"
            min="0"
            className="input"
            value={f.acciones}
            onChange={(e) => set("acciones", Number(e.target.value || 0))}
          />
          {editandoId && <p className="mt-1 text-[11px] text-carbon/50">Para cambios de tenencia, mejor usá “Registrar movimiento”.</p>}
        </div>
        <div>
          <label className="field-label">Votos por acción</label>
          <input
            type="number"
            min="0"
            step="1"
            className="input"
            value={f.votos_por_accion}
            onChange={(e) => set("votos_por_accion", Number(e.target.value || 0))}
          />
        </div>
        <div>
          <label className="field-label">Cargo en la administración</label>
          <input className="input" value={f.cargo ?? ""} onChange={txt("cargo")} placeholder="Presidente, Director..." list="cargos-sugeridos" />
          <datalist id="cargos-sugeridos">
            {["Presidente", "Vicepresidente", "Director Titular", "Director Suplente", "Administrador Titular", "Administrador Suplente", "Gerente"].map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </div>
        <div>
          <label className="field-label">Vínculo / rama familiar</label>
          <input className="input" value={f.vinculo ?? ""} onChange={txt("vinculo")} placeholder="Fundador, hija, rama López..." />
        </div>
        <div>
          <label className="field-label">Email</label>
          <input type="email" className="input" value={f.email ?? ""} onChange={txt("email")} />
        </div>
        <div>
          <label className="field-label">Teléfono</label>
          <input className="input" value={f.telefono ?? ""} onChange={txt("telefono")} />
        </div>
      </div>
      {error && <p className="mt-2 text-sm text-bad">{error}</p>}
      <div className="mt-3 flex gap-2">
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? "Guardando..." : editandoId ? "Guardar" : "Agregar accionista"}
        </button>
        <button type="button" className="btn btn-ghost" onClick={onCancel}>
          Cancelar
        </button>
      </div>
    </form>
  );
}

function MovimientoForm({
  empresa,
  accionistas,
  onDone,
  onCancel,
}: {
  empresa: Empresa;
  accionistas: Accionista[];
  onDone: () => void;
  onCancel: () => void;
}) {
  const { showToast } = useToast();
  const [tipo, setTipo] = useState<TipoMovimiento>("transferencia");
  const [fecha, setFecha] = useState(todayIso());
  const [de, setDe] = useState(accionistas.find((a) => a.acciones > 0)?.id ?? "");
  const [a, setA] = useState("");
  const [nuevoNombre, setNuevoNombre] = useState("");
  const [nuevoDoc, setNuevoDoc] = useState("");
  const [cantidad, setCantidad] = useState("");
  const [precio, setPrecio] = useState("");
  const [notas, setNotas] = useState("");
  const [crearTareas, setCrearTareas] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sinOrigen = tipo === "suscripcion" || tipo === "ajuste";
  const origen = accionistas.find((x) => x.id === de);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const cant = Number(cantidad);
    if (!cant || cant <= 0) return setError("Indicá una cantidad de acciones mayor a cero.");
    if (!sinOrigen && !de) return setError("Elegí quién transfiere.");
    if (a === "nuevo" && !nuevoNombre.trim()) return setError("Escribí el nombre del nuevo accionista.");
    if (!a) return setError("Elegí quién recibe.");

    setSaving(true);
    let destinoId = a;
    if (a === "nuevo") {
      const { data, error: err } = await supabase
        .from("accionistas")
        .insert({ empresa_id: empresa.id, nombre: nuevoNombre.trim(), documento: nuevoDoc.trim() || null, acciones: 0 })
        .select("id")
        .single();
      if (err) {
        setSaving(false);
        return setError(`No se pudo crear el accionista: ${err.message}`);
      }
      destinoId = data.id;
    }

    const { error: err } = await supabase.rpc("registrar_movimiento_acciones", {
      p_empresa_id: empresa.id,
      p_fecha: fecha,
      p_tipo: tipo,
      p_de_accionista_id: sinOrigen ? null : de,
      p_a_accionista_id: destinoId,
      p_cantidad: cant,
      p_precio_total: precio ? Number(precio) : null,
      p_notas: notas.trim() || null,
    });
    if (err) {
      setSaving(false);
      return setError(err.message);
    }

    if (crearTareas && !sinOrigen) {
      const destino = a === "nuevo" ? nuevoNombre.trim() : accionistas.find((x) => x.id === destinoId)?.nombre;
      const detalle = `${formatNumero(cant)} acciones de ${origen?.nombre ?? "—"} a ${destino ?? "—"} (${MOVIMIENTO_LABELS[tipo].toLowerCase()}, ${formatFecha(fecha)})`;
      await supabase.from("obligaciones").insert(obligacionesPorMovimiento(empresa.id, fecha, detalle));
    }
    setSaving(false);
    showToast(crearTareas && !sinOrigen ? "Movimiento registrado y vencimientos creados." : "Movimiento registrado.");
    onDone();
  }

  return (
    <form onSubmit={submit} className="animate-slide-up mb-4 rounded-sm border p-4" style={{ borderColor: "rgba(184,115,74,0.4)", background: "rgba(184,115,74,0.05)" }}>
      <h3 className="mb-3">Registrar movimiento de acciones</h3>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label className="field-label">Tipo</label>
          <select className="input" value={tipo} onChange={(e) => setTipo(e.target.value as TipoMovimiento)}>
            {(Object.keys(MOVIMIENTO_LABELS) as TipoMovimiento[]).map((t) => (
              <option key={t} value={t}>
                {MOVIMIENTO_LABELS[t]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="field-label">Fecha</label>
          <input type="date" className="input" value={fecha} onChange={(e) => setFecha(e.target.value)} />
        </div>
        {!sinOrigen && (
          <div>
            <label className="field-label">De (transfiere)</label>
            <select className="input" value={de} onChange={(e) => setDe(e.target.value)}>
              <option value="">Elegí...</option>
              {accionistas.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.nombre} ({formatNumero(x.acciones)})
                </option>
              ))}
            </select>
          </div>
        )}
        <div>
          <label className="field-label">A (recibe)</label>
          <select className="input" value={a} onChange={(e) => setA(e.target.value)}>
            <option value="">Elegí...</option>
            {accionistas
              .filter((x) => x.id !== de || sinOrigen)
              .map((x) => (
                <option key={x.id} value={x.id}>
                  {x.nombre}
                </option>
              ))}
            <option value="nuevo">+ Nuevo accionista</option>
          </select>
        </div>
        {a === "nuevo" && (
          <>
            <div>
              <label className="field-label">Nombre del nuevo accionista</label>
              <input className="input" value={nuevoNombre} onChange={(e) => setNuevoNombre(e.target.value)} />
            </div>
            <div>
              <label className="field-label">C.I. / RUC</label>
              <input className="input" value={nuevoDoc} onChange={(e) => setNuevoDoc(e.target.value)} />
            </div>
          </>
        )}
        <div>
          <label className="field-label">Cantidad de acciones</label>
          <input type="number" min="1" className="input" value={cantidad} onChange={(e) => setCantidad(e.target.value)} />
          {origen && !sinOrigen && <p className="mt-1 text-[11px] text-carbon/50">Disponible: {formatNumero(origen.acciones)}</p>}
        </div>
        {tipo === "transferencia" && (
          <div>
            <label className="field-label">Precio total (Gs.)</label>
            <input type="number" min="0" className="input" value={precio} onChange={(e) => setPrecio(e.target.value)} />
          </div>
        )}
        <div className="sm:col-span-2">
          <label className="field-label">Notas</label>
          <input className="input" value={notas} onChange={(e) => setNotas(e.target.value)} placeholder="Ej.: contrato privado del 10/09, sucesión de ..." />
        </div>
      </div>
      {!sinOrigen && (
        <label className="mt-3 flex items-center gap-2 text-sm text-carbon/70">
          <input type="checkbox" checked={crearTareas} onChange={(e) => setCrearTareas(e.target.checked)} />
          Crear los vencimientos de comunicación (sociedad, DGPEJBF y beneficiarios finales)
        </label>
      )}
      {error && <p className="mt-2 text-sm text-bad">{error}</p>}
      <div className="mt-3 flex gap-2">
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? "Registrando..." : "Registrar"}
        </button>
        <button type="button" className="btn btn-ghost" onClick={onCancel}>
          Cancelar
        </button>
      </div>
    </form>
  );
}

/** Libro de accionistas de una empresa: tenencias, % de capital y votos, alertas de beneficiario final y movimientos. */
export default function AccionistasPanel({ empresa, onChanged }: { empresa: Empresa; onChanged?: () => void }) {
  const { showToast } = useToast();
  const { data: accionistas, loading, error, reload } = useAccionistas(empresa.id);
  const movs = useMovimientos(empresa.id);
  const [modo, setModo] = useState<"nada" | "nuevo" | "editar" | "movimiento">("nada");
  const [editando, setEditando] = useState<Accionista | null>(null);

  const { filas, totalAcciones, totalVotos } = calcularParticipaciones(accionistas);
  const posiblesBF = filas.filter((f) => f.posibleBF);

  async function refrescar() {
    setModo("nada");
    setEditando(null);
    await Promise.all([reload(), movs.reload()]);
    onChanged?.();
  }

  async function borrar(a: Accionista) {
    if (!confirm(`¿Eliminar a ${a.nombre} del libro? Si tiene acciones, primero registrá su transferencia.`)) return;
    const { error: err } = await supabase.from("accionistas").delete().eq("id", a.id);
    if (err) return showToast(`No se pudo eliminar: ${err.message}`, "error");
    showToast("Accionista eliminado.");
    refrescar();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-carbon/60">
          {filas.length} accionista{filas.length === 1 ? "" : "s"} · {formatNumero(totalAcciones)} acciones · {formatNumero(totalVotos)} votos
          {empresa.capital_integrado ? ` · Capital integrado ${formatPyg(empresa.capital_integrado)}` : ""}
        </p>
        <div className="flex gap-2">
          <button type="button" className="btn btn-ghost" onClick={() => setModo(modo === "movimiento" ? "nada" : "movimiento")} disabled={accionistas.length === 0}>
            <ArrowRightLeft size={15} /> Registrar movimiento
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              setEditando(null);
              setModo(modo === "nuevo" ? "nada" : "nuevo");
            }}
          >
            <Plus size={15} /> Accionista
          </button>
        </div>
      </div>

      {modo === "nuevo" && <AccionistaForm inicial={vacio(empresa.id)} editandoId={null} onSaved={refrescar} onCancel={() => setModo("nada")} />}
      {modo === "editar" && editando && (
        <AccionistaForm
          key={editando.id}
          inicial={aNuevo(editando)}
          editandoId={editando.id}
          onSaved={refrescar}
          onCancel={() => {
            setModo("nada");
            setEditando(null);
          }}
        />
      )}
      {modo === "movimiento" && <MovimientoForm empresa={empresa} accionistas={accionistas} onDone={refrescar} onCancel={() => setModo("nada")} />}

      {error && <p className="text-sm text-bad">Error: {error}</p>}

      {loading ? (
        <SkeletonTable rows={3} cols={6} />
      ) : filas.length === 0 ? (
        <p className="rounded border border-dashed p-8 text-center text-sm text-carbon/60" style={{ borderColor: "var(--line)" }}>
          Todavía no cargaste accionistas. Empezá por quienes figuran hoy en el libro de registro de acciones.
        </p>
      ) : (
        <div className="table-shell">
          <table>
            <thead>
              <tr>
                <th>Accionista</th>
                <th>C.I. / RUC</th>
                <th className="text-right">Acciones</th>
                <th className="text-right">% capital</th>
                <th className="text-right">% votos</th>
                <th>Cargo / vínculo</th>
                <th>Beneficiario final</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filas.map((f) => (
                <tr key={f.id} className={Number(f.acciones) === 0 ? "opacity-50" : ""}>
                  <td className="min-w-[11rem] font-medium">
                    {f.nombre}
                    {f.tipo_persona === "juridica" && <span className="ml-1 text-xs text-carbon/50">(P. jurídica)</span>}
                  </td>
                  <td className="whitespace-nowrap">{f.documento ?? "—"}</td>
                  <td className="text-right tabular-nums">{formatNumero(f.acciones)}</td>
                  <td className="text-right tabular-nums">{formatPct(f.pctCapital)}</td>
                  <td className="text-right tabular-nums">{formatPct(f.pctVotos)}</td>
                  <td className="min-w-[9rem] text-xs text-carbon/70">{[f.cargo, f.vinculo].filter(Boolean).join(" · ") || "—"}</td>
                  <td className="text-xs">
                    {f.posibleBF ? (
                      <span className="rounded-full px-2 py-0.5 font-medium text-cobre" style={{ background: "rgba(184,115,74,0.12)" }}>
                        {f.tipo_persona === "juridica" ? "Ver cadena de control" : "Posible BF"}
                      </span>
                    ) : (
                      <span className="text-carbon/40">—</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap text-right">
                    <button
                      type="button"
                      title="Editar"
                      className="rounded-full p-1 text-carbon/50 hover:text-cobre-hover"
                      onClick={() => {
                        setEditando(f);
                        setModo("editar");
                      }}
                    >
                      <Pencil size={14} />
                    </button>
                    <button type="button" title="Eliminar" className="rounded-full p-1 text-carbon/50 hover:text-bad" onClick={() => borrar(f)}>
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {filas.length > 0 && (
        <p className="text-xs leading-relaxed text-carbon/55">
          <strong>Beneficiarios finales:</strong> se marca a quien tiene {UMBRAL_CAPITAL_PCT}% o más del capital o más del {UMBRAL_VOTOS_PCT}% de los votos
          (criterios objetivos de la Ley 6446/2019). {posiblesBF.length > 0 ? `Hoy son ${posiblesBF.length}. ` : ""}La ley también contempla criterios
          de control y administración que esta herramienta no evalúa, y para accionistas personas jurídicas hay que identificar a las personas físicas de la
          cadena de control. Es una alerta para revisar, no una determinación.
        </p>
      )}

      <Accordion title="Historial de movimientos" badge={`${movs.data.length}`}>
        {movs.data.length === 0 ? (
          <p className="text-sm text-carbon/60">Sin movimientos registrados.</p>
        ) : (
          <div className="table-shell">
            <table>
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Tipo</th>
                  <th>De</th>
                  <th>A</th>
                  <th className="text-right">Acciones</th>
                  <th className="text-right">Precio</th>
                  <th>Notas</th>
                </tr>
              </thead>
              <tbody>
                {movs.data.map((m) => (
                  <tr key={m.id}>
                    <td className="whitespace-nowrap">{formatFecha(m.fecha)}</td>
                    <td className="whitespace-nowrap">{MOVIMIENTO_LABELS[m.tipo]}</td>
                    <td className="min-w-[10rem]">{m.de_nombre ?? "—"}</td>
                    <td className="min-w-[10rem]">{m.a_nombre ?? "—"}</td>
                    <td className="text-right tabular-nums">{formatNumero(m.cantidad)}</td>
                    <td className="text-right tabular-nums">{m.precio_total ? formatPyg(m.precio_total) : "—"}</td>
                    <td className="min-w-[10rem] text-xs text-carbon/70">{m.notas ?? ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Accordion>
    </div>
  );
}
