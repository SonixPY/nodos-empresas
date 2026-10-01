"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Circle,
  ExternalLink,
  Pencil,
  Plus,
  Printer,
  Trash2,
  UserPlus,
} from "lucide-react";
import { useAccionistas } from "@/lib/data";
import { daysUntil, formatFecha, todayIso } from "@/lib/dates";
import { formatPyg } from "@/lib/format";
import { calcularParticipaciones, formatNumero, formatPct } from "@/lib/accionistas";
import {
  CARGO_LABELS,
  CONDICIONES_BF,
  DIAS_HABILES_MODIFICACION,
  FUENTES_SIARA,
  TIPO_DOCUMENTO_LABELS,
  aNuevoAdministrador,
  aNuevoBeneficiario,
  administradorVacio,
  beneficiarioDesdeAccionista,
  beneficiarioDesdeAdministrador,
  beneficiarioVacio,
  bfVigente,
  cargoLabel,
  checklistSiara,
  eliminarAdministrador,
  eliminarBeneficiario,
  faltantesAdministrador,
  faltantesBeneficiario,
  guardarAdministrador,
  guardarBeneficiario,
  guardarSeguimientoSiara,
  imprimirResumenSiara,
  participacionTotal,
  resumenSiaraHtml,
  useAdministradores,
  useBeneficiarios,
  validarAdministrador,
  validarBeneficiario,
  type Administrador,
  type BeneficiarioFinal,
  type CargoAdministrador,
  type CondicionBF,
  type EmpresaSiara,
  type ItemChecklist,
  type NuevoAdministrador,
  type NuevoBeneficiario,
  type TipoDocumento,
} from "@/lib/siara";
import { useToast } from "@/components/ToastProvider";
import { SkeletonBlock } from "@/components/Skeleton";
import { TIPO_LABELS, type Accionista } from "@/lib/types";

// ─── piezas chicas ───────────────────────────────────────────────────────

/** Encabezado de sección "tipo formulario": número + título en versalitas. */
function Seccion({
  id,
  n,
  titulo,
  subtitulo,
  accion,
  children,
}: {
  id?: string;
  n: number;
  titulo: string;
  subtitulo?: string;
  accion?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-20 overflow-hidden rounded-md border bg-white" style={{ borderColor: "var(--line)" }}>
      <header
        className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5"
        style={{ borderColor: "var(--line)", background: "rgba(242,238,230,0.7)" }}
      >
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-sm bg-musgo text-xs font-semibold text-marfil">{n}</span>
          <div className="min-w-0">
            <h3 className="text-[13px]! leading-5! font-semibold uppercase tracking-[0.06em]">{titulo}</h3>
            {subtitulo && <p className="text-[11.5px] text-carbon/55">{subtitulo}</p>}
          </div>
        </div>
        {accion}
      </header>
      <div className="p-4">{children}</div>
    </section>
  );
}

function Dato({ label, children, falta }: { label: string; children: React.ReactNode; falta?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-carbon/45">{label}</dt>
      <dd className={`mt-0.5 break-words text-[13px] ${falta ? "italic text-bad/80" : "text-carbon/85"}`}>{children}</dd>
    </div>
  );
}

function valor(v: string | number | null | undefined): { txt: string; falta: boolean } {
  if (v === null || v === undefined || String(v).trim() === "") return { txt: "Falta completar", falta: true };
  return { txt: String(v), falta: false };
}

function Chip({
  children,
  tono = "neutro",
  className = "whitespace-nowrap",
}: {
  children: React.ReactNode;
  tono?: "neutro" | "ok" | "alerta" | "mal";
  className?: string;
}) {
  const st = {
    neutro: { color: "#1e2f25", background: "rgba(30,47,37,0.08)" },
    ok: { color: "#3f6b52", background: "rgba(63,107,82,0.12)" },
    alerta: { color: "#8c5934", background: "rgba(184,115,74,0.15)" },
    mal: { color: "#b23b3b", background: "rgba(178,59,59,0.1)" },
  }[tono];
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${className}`} style={st}>
      {children}
    </span>
  );
}

function Campo({ label, req, className = "", children }: { label: string; req?: boolean; className?: string; children: React.ReactNode }) {
  return (
    <div className={className}>
      <label className="field-label">
        {label}
        {req && <span className="required-mark">*</span>}
      </label>
      {children}
    </div>
  );
}

const formStyle = { borderColor: "rgba(184,115,74,0.4)", background: "rgba(184,115,74,0.05)" };

// ─── checklist ───────────────────────────────────────────────────────────

function Checklist({ items }: { items: ItemChecklist[] }) {
  const secciones = [...new Set(items.map((i) => i.seccion))];
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      {secciones.map((s) => (
        <div key={s}>
          <p className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-carbon/45">{s}</p>
          <ul className="space-y-1.5">
            {items
              .filter((i) => i.seccion === s)
              .map((i) => (
                <li key={i.texto} className="flex gap-2 text-[13px]">
                  {i.ok ? (
                    <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-good" />
                  ) : (
                    <Circle size={16} className="mt-0.5 shrink-0 text-cobre" />
                  )}
                  <span className={i.ok ? "text-carbon/60" : "text-carbon"}>
                    {i.texto}
                    {!i.ok && i.detalle && <span className="block text-[11.5px] text-carbon/55">{i.detalle}</span>}
                  </span>
                </li>
              ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

// ─── seguimiento de la declaración ───────────────────────────────────────

function Seguimiento({ empresa, onEmpresaChange }: { empresa: EmpresaSiara; onEmpresaChange?: (e: EmpresaSiara) => void }) {
  const { showToast } = useToast();
  const [editando, setEditando] = useState(false);
  const [fecha, setFecha] = useState(empresa.siara_ultima_declaracion ?? "");
  const [numero, setNumero] = useState(empresa.siara_numero_solicitud ?? "");
  const [saving, setSaving] = useState(false);

  async function guardar() {
    if (fecha && fecha > todayIso()) return showToast("La fecha de declaración no puede ser futura.", "error");
    setSaving(true);
    const { data, error } = await guardarSeguimientoSiara(empresa.id, {
      siara_ultima_declaracion: fecha || null,
      siara_numero_solicitud: numero.trim() || null,
    });
    setSaving(false);
    if (error) return showToast(`No se pudo guardar: ${error.message}`, "error");
    showToast("Declaración registrada.");
    setEditando(false);
    onEmpresaChange?.(data as EmpresaSiara);
  }

  if (editando) {
    return (
      <div className="flex flex-wrap items-end gap-2">
        <Campo label="Fecha de la última declaración">
          <input type="date" className="input" value={fecha} max={todayIso()} onChange={(e) => setFecha(e.target.value)} />
        </Campo>
        <Campo label="N° de solicitud SIARA">
          <input className="input" value={numero} onChange={(e) => setNumero(e.target.value)} />
        </Campo>
        <button type="button" className="btn btn-primary" onClick={guardar} disabled={saving}>
          {saving ? "Guardando..." : "Guardar"}
        </button>
        <button type="button" className="btn btn-ghost" onClick={() => setEditando(false)}>
          Cancelar
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px]">
      <span>
        <span className="text-carbon/55">Última declaración: </span>
        {empresa.siara_ultima_declaracion ? formatFecha(empresa.siara_ultima_declaracion) : "sin registrar"}
        {empresa.siara_numero_solicitud && <span className="text-carbon/55"> · Solicitud N° {empresa.siara_numero_solicitud}</span>}
      </span>
      <button type="button" className="text-xs font-medium text-cobre-hover hover:underline" onClick={() => setEditando(true)}>
        {empresa.siara_ultima_declaracion ? "Actualizar" : "Registrar declaración"}
      </button>
    </div>
  );
}

// ─── beneficiarios finales ───────────────────────────────────────────────

function BeneficiarioForm({
  inicial,
  editandoId,
  otros,
  fuentes,
  onSaved,
  onCancel,
}: {
  inicial: NuevoBeneficiario;
  editandoId: string | null;
  otros: BeneficiarioFinal[];
  fuentes: { key: string; label: string; datos: NuevoBeneficiario }[];
  onSaved: (b: BeneficiarioFinal) => void;
  onCancel: () => void;
}) {
  const [f, setF] = useState<NuevoBeneficiario>(inicial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = <K extends keyof NuevoBeneficiario>(k: K, v: NuevoBeneficiario[K]) => setF((p) => ({ ...p, [k]: v }));
  const txt = (k: keyof NuevoBeneficiario) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => set(k, e.target.value as never);
  const fecha = (k: keyof NuevoBeneficiario) => (e: React.ChangeEvent<HTMLInputElement>) => set(k, (e.target.value || null) as never);
  const num = (k: "participacion_directa" | "participacion_indirecta") => (e: React.ChangeEvent<HTMLInputElement>) =>
    set(k, e.target.value === "" ? 0 : Number(e.target.value));

  const faltan = faltantesBeneficiario(f);

  function toggleCond(c: CondicionBF) {
    set("condiciones", f.condiciones.includes(c) ? f.condiciones.filter((x) => x !== c) : [...f.condiciones, c].sort());
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const err = validarBeneficiario(f, otros, editandoId);
    if (err) return setError(err);
    setSaving(true);
    const { data, error: dbErr } = await guardarBeneficiario(f, editandoId);
    setSaving(false);
    if (dbErr) return setError(`No se pudo guardar: ${dbErr.message}`);
    onSaved(data as BeneficiarioFinal);
  }

  return (
    <form onSubmit={submit} className="animate-slide-up rounded-sm border p-4" style={formStyle}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3>{editandoId ? "Editar beneficiario final" : "Nuevo beneficiario final"}</h3>
        {!editandoId && fuentes.length > 0 && (
          <select
            className="input py-1.5! text-[13px]! sm:w-auto! sm:max-w-[340px]"
            value=""
            onChange={(e) => {
              const src = fuentes.find((x) => x.key === e.target.value);
              if (src) setF(src.datos);
            }}
            aria-label="Cargar datos desde"
          >
            <option value="">Cargar datos desde…</option>
            {fuentes.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
          </select>
        )}
      </div>

      <p className="mb-2 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-carbon/45">Identificación</p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Campo label="Nombres y apellidos" req className="sm:col-span-2">
          <input className="input" value={f.nombre} onChange={txt("nombre")} autoFocus />
        </Campo>
        <Campo label="Tipo de documento">
          <select className="input" value={f.tipo_documento} onChange={(e) => set("tipo_documento", e.target.value as TipoDocumento)}>
            {(Object.keys(TIPO_DOCUMENTO_LABELS) as TipoDocumento[]).map((t) => (
              <option key={t} value={t}>
                {TIPO_DOCUMENTO_LABELS[t]}
              </option>
            ))}
          </select>
        </Campo>
        <Campo label="N° de documento" req>
          <input className="input" value={f.documento ?? ""} onChange={txt("documento")} />
        </Campo>
        <Campo label="RUC (si tiene)">
          <input className="input" value={f.ruc ?? ""} onChange={txt("ruc")} />
        </Campo>
        <Campo label="Nacionalidad" req>
          <input className="input" value={f.nacionalidad ?? ""} onChange={txt("nacionalidad")} />
        </Campo>
        <Campo label="Fecha de nacimiento" req>
          <input type="date" className="input" value={f.fecha_nacimiento ?? ""} max={todayIso()} onChange={fecha("fecha_nacimiento")} />
        </Campo>
        <Campo label="País de residencia" req>
          <input className="input" value={f.pais_residencia ?? ""} onChange={txt("pais_residencia")} />
        </Campo>
        <Campo label="Profesión" req>
          <input className="input" value={f.profesion ?? ""} onChange={txt("profesion")} />
        </Campo>
        <Campo label="Ocupación">
          <input className="input" value={f.ocupacion ?? ""} onChange={txt("ocupacion")} />
        </Campo>
        <Campo label="Correo electrónico">
          <input type="email" className="input" value={f.email ?? ""} onChange={txt("email")} />
        </Campo>
        <Campo label="Teléfono">
          <input type="tel" className="input" value={f.telefono ?? ""} onChange={txt("telefono")} />
        </Campo>
      </div>

      <p className="mb-2 mt-4 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-carbon/45">Domicilio</p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Campo label="Calle principal y número" req className="sm:col-span-2">
          <input className="input" value={f.domicilio ?? ""} onChange={txt("domicilio")} />
        </Campo>
        <Campo label="Barrio">
          <input className="input" value={f.barrio ?? ""} onChange={txt("barrio")} />
        </Campo>
        <Campo label="Ciudad" req>
          <input className="input" value={f.ciudad ?? ""} onChange={txt("ciudad")} />
        </Campo>
        <Campo label="Departamento / provincia">
          <input className="input" value={f.departamento ?? ""} onChange={txt("departamento")} />
        </Campo>
      </div>

      <p className="mb-2 mt-4 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-carbon/45">Participación y control</p>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Campo label="% directo del capital">
          <input type="number" min="0" max="100" step="0.01" className="input" value={f.participacion_directa} onChange={num("participacion_directa")} />
        </Campo>
        <Campo label="% indirecto del capital">
          <input type="number" min="0" max="100" step="0.01" className="input" value={f.participacion_indirecta} onChange={num("participacion_indirecta")} />
        </Campo>
        <Campo label="% de votos">
          <input
            type="number"
            min="0"
            max="100"
            step="0.01"
            className="input"
            value={f.porcentaje_votos ?? ""}
            onChange={(e) => set("porcentaje_votos", e.target.value === "" ? null : Number(e.target.value))}
          />
        </Campo>
        <Campo label="BF desde" req>
          <input type="date" className="input" value={f.fecha_desde ?? ""} onChange={fecha("fecha_desde")} />
        </Campo>
      </div>
      <fieldset className="mt-3">
        <legend className="field-label">
          Condición de beneficiario final (Ley 6446/2019, art. 4)<span className="required-mark">*</span>
        </legend>
        <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
          {CONDICIONES_BF.map((c) => (
            <label key={c.key} className="flex cursor-pointer gap-2 rounded-sm border bg-white px-2.5 py-2 text-[13px]" style={{ borderColor: "var(--line)" }}>
              <input type="checkbox" className="mt-0.5" checked={f.condiciones.includes(c.key)} onChange={() => toggleCond(c.key)} />
              <span>
                <span className="font-medium">{c.corto}</span>
                <span className="block text-[11.5px] text-carbon/60">{c.texto}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      {f.participacion_indirecta > 0 && (
        <Campo label="Cadena de control (sociedades intermedias)" req className="mt-3">
          <textarea
            className="input min-h-[60px]"
            value={f.cadena_control ?? ""}
            onChange={txt("cadena_control")}
            placeholder="Ej.: 60% de Inversora XX S.A. (RUC …), que tiene el 40% de esta sociedad"
          />
        </Campo>
      )}

      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="sm:col-span-2">
          <label className="field-label">Persona expuesta políticamente (PEP)</label>
          <label className="input flex items-center gap-2 text-sm text-carbon/75">
            <input type="checkbox" checked={f.es_pep} onChange={(e) => set("es_pep", e.target.checked)} />
            Es PEP (o familiar / allegado cercano)
          </label>
        </div>
        {f.es_pep && (
          <Campo label="Cargo o vínculo PEP" req className="sm:col-span-2">
            <input className="input" value={f.cargo_pep ?? ""} onChange={txt("cargo_pep")} />
          </Campo>
        )}
        <Campo label="Dejó de ser BF el">
          <input type="date" className="input" value={f.fecha_hasta ?? ""} onChange={fecha("fecha_hasta")} />
        </Campo>
        <Campo label="Notas internas" className={f.es_pep ? "sm:col-span-1 lg:col-span-3" : "sm:col-span-2 lg:col-span-1"}>
          <input className="input" value={f.notas ?? ""} onChange={txt("notas")} />
        </Campo>
      </div>

      {faltan.length > 0 && (
        <p className="mt-3 text-[12px] text-carbon/60">
          Podés guardar igual; para declararlo en SIARA faltan: <span className="text-cobre-hover">{faltan.join(", ")}</span>.
        </p>
      )}
      {error && <p className="mt-2 text-sm text-bad">{error}</p>}
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? "Guardando..." : editandoId ? "Guardar cambios" : "Agregar beneficiario"}
        </button>
        <button type="button" className="btn btn-ghost" onClick={onCancel}>
          Cancelar
        </button>
      </div>
    </form>
  );
}

function BeneficiarioItem({ b, onEditar, onBorrado }: { b: BeneficiarioFinal; onEditar: () => void; onBorrado: () => void }) {
  const { showToast } = useToast();
  const faltan = faltantesBeneficiario(aNuevoBeneficiario(b));
  const vigente = bfVigente(b);

  async function borrar() {
    if (!confirm(`¿Eliminar a ${b.nombre} de los beneficiarios finales? Si dejó de serlo, mejor cargá la fecha en "Dejó de ser BF el".`)) return;
    const { error } = await eliminarBeneficiario(b.id);
    if (error) return showToast(`No se pudo eliminar: ${error.message}`, "error");
    showToast("Beneficiario final eliminado.");
    onBorrado();
  }

  return (
    <li className={`animate-row-in rounded-md border bg-white p-3.5 ${vigente ? "" : "opacity-60"}`} style={{ borderColor: "var(--line)" }}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-medium text-carbon [overflow-wrap:anywhere]">{b.nombre}</p>
          <p className="text-xs text-carbon/55">
            {b.documento ? `${TIPO_DOCUMENTO_LABELS[b.tipo_documento]} ${b.documento}` : "Sin documento"}
            {b.nacionalidad ? ` · ${b.nacionalidad}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {b.es_pep && <Chip tono="alerta">PEP</Chip>}
          {!vigente ? <Chip>Cesado</Chip> : faltan.length === 0 ? <Chip tono="ok">Completo</Chip> : <Chip tono="alerta">Faltan {faltan.length}</Chip>}
        </div>
      </div>
      <dl className="mt-2.5 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4">
        <Dato label="Capital">
          {formatPct(participacionTotal(b))}
          {Number(b.participacion_indirecta) > 0 && <span className="text-carbon/50"> ({formatPct(Number(b.participacion_indirecta))} indirecto)</span>}
        </Dato>
        <Dato label="Votos">{b.porcentaje_votos !== null ? formatPct(Number(b.porcentaje_votos)) : "—"}</Dato>
        <Dato label="Desde">{b.fecha_desde ? formatFecha(b.fecha_desde) : "—"}</Dato>
        <Dato label="Condición">{b.condiciones.length ? b.condiciones.map((c) => `${c})`).join(" ") : "—"}</Dato>
      </dl>
      {faltan.length > 0 && vigente && <p className="mt-2 text-[11.5px] text-cobre-hover">Falta: {faltan.join(", ")}</p>}
      <div className="mt-2.5 flex items-center gap-1 border-t pt-2" style={{ borderColor: "var(--line)" }}>
        <button type="button" className="btn btn-ghost px-2.5! py-1! text-xs" onClick={onEditar}>
          <Pencil size={13} /> Editar
        </button>
        <button type="button" className="btn btn-ghost ml-auto px-2.5! py-1! text-xs text-bad" onClick={borrar} title="Eliminar" aria-label={`Eliminar a ${b.nombre}`}>
          <Trash2 size={13} />
        </button>
      </div>
    </li>
  );
}

// ─── administradores ─────────────────────────────────────────────────────

function AdministradorForm({
  inicial,
  editandoId,
  esSrl,
  onSaved,
  onCancel,
}: {
  inicial: NuevoAdministrador;
  editandoId: string | null;
  esSrl: boolean;
  onSaved: (a: Administrador) => void;
  onCancel: () => void;
}) {
  const [f, setF] = useState<NuevoAdministrador>(inicial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = <K extends keyof NuevoAdministrador>(k: K, v: NuevoAdministrador[K]) => setF((p) => ({ ...p, [k]: v }));
  const txt = (k: keyof NuevoAdministrador) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => set(k, e.target.value as never);
  const fecha = (k: keyof NuevoAdministrador) => (e: React.ChangeEvent<HTMLInputElement>) => set(k, (e.target.value || null) as never);
  const faltan = faltantesAdministrador(f);

  const cargos = (Object.keys(CARGO_LABELS) as CargoAdministrador[]).filter(
    (c) => !esSrl || !["presidente", "vicepresidente", "director_titular", "director_suplente", "sindico_titular", "sindico_suplente"].includes(c) || c === f.cargo
  );

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const err = validarAdministrador(f);
    if (err) return setError(err);
    setSaving(true);
    const { data, error: dbErr } = await guardarAdministrador(f, editandoId);
    setSaving(false);
    if (dbErr) return setError(`No se pudo guardar: ${dbErr.message}`);
    onSaved(data as Administrador);
  }

  return (
    <form onSubmit={submit} className="animate-slide-up rounded-sm border p-4" style={formStyle}>
      <h3 className="mb-3">{editandoId ? "Editar administrador o representante" : "Nuevo administrador o representante"}</h3>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Campo label="Nombres y apellidos" req className="sm:col-span-2">
          <input className="input" value={f.nombre} onChange={txt("nombre")} autoFocus />
        </Campo>
        <Campo label="Tipo de documento">
          <select className="input" value={f.tipo_documento} onChange={(e) => set("tipo_documento", e.target.value as TipoDocumento)}>
            {(Object.keys(TIPO_DOCUMENTO_LABELS) as TipoDocumento[]).map((t) => (
              <option key={t} value={t}>
                {TIPO_DOCUMENTO_LABELS[t]}
              </option>
            ))}
          </select>
        </Campo>
        <Campo label="N° de documento" req>
          <input className="input" value={f.documento ?? ""} onChange={txt("documento")} />
        </Campo>
        <Campo label="Cargo" req>
          <select className="input" value={f.cargo} onChange={(e) => set("cargo", e.target.value as CargoAdministrador)}>
            {cargos.map((c) => (
              <option key={c} value={c}>
                {CARGO_LABELS[c]}
              </option>
            ))}
          </select>
        </Campo>
        {f.cargo === "otro" ? (
          <Campo label="¿Qué cargo?" req>
            <input className="input" value={f.cargo_detalle ?? ""} onChange={txt("cargo_detalle")} />
          </Campo>
        ) : (
          <div>
            <label className="field-label">¿Es representante legal?</label>
            <label className="input flex items-center gap-2 text-sm text-carbon/75">
              <input
                type="checkbox"
                checked={f.cargo === "representante_legal" || f.es_representante_legal}
                disabled={f.cargo === "representante_legal"}
                onChange={(e) => set("es_representante_legal", e.target.checked)}
              />
              Sí, representa a la sociedad
            </label>
          </div>
        )}
        <Campo label="Nacionalidad" req>
          <input className="input" value={f.nacionalidad ?? ""} onChange={txt("nacionalidad")} />
        </Campo>
        <Campo label="Profesión u ocupación" req>
          <input className="input" value={f.profesion ?? ""} onChange={txt("profesion")} />
        </Campo>
        <Campo label="Domicilio" req className="sm:col-span-2">
          <input className="input" value={f.domicilio ?? ""} onChange={txt("domicilio")} placeholder="Calle, número, barrio" />
        </Campo>
        <Campo label="Ciudad">
          <input className="input" value={f.ciudad ?? ""} onChange={txt("ciudad")} />
        </Campo>
        <Campo label="Correo electrónico">
          <input type="email" className="input" value={f.email ?? ""} onChange={txt("email")} />
        </Campo>
        <Campo label="Teléfono">
          <input type="tel" className="input" value={f.telefono ?? ""} onChange={txt("telefono")} />
        </Campo>
        <Campo label="Fecha de asunción" req>
          <input type="date" className="input" value={f.fecha_designacion ?? ""} onChange={fecha("fecha_designacion")} />
        </Campo>
        <Campo label="Asamblea de designación">
          <input type="date" className="input" value={f.fecha_asamblea ?? ""} onChange={fecha("fecha_asamblea")} />
        </Campo>
        <Campo label="Vence el mandato" req={["presidente", "vicepresidente", "director_titular", "director_suplente", "sindico_titular", "sindico_suplente", "administrador"].includes(f.cargo)}>
          <input type="date" className="input" value={f.vencimiento_mandato ?? ""} onChange={fecha("vencimiento_mandato")} />
        </Campo>
        <Campo label="Acta / instrumento" className="sm:col-span-2">
          <input className="input" value={f.instrumento ?? ""} onChange={txt("instrumento")} placeholder="Ej.: Acta de Asamblea Ordinaria N° 12" />
        </Campo>
        <div>
          <label className="field-label">Inscripción</label>
          <label className="input flex items-center gap-2 text-sm text-carbon/75">
            <input type="checkbox" checked={f.inscripto} onChange={(e) => set("inscripto", e.target.checked)} />
            Designación inscripta
          </label>
        </div>
        <div>
          <label className="field-label">Estado</label>
          <label className="input flex items-center gap-2 text-sm text-carbon/75">
            <input type="checkbox" checked={f.activo} onChange={(e) => set("activo", e.target.checked)} />
            En funciones
          </label>
        </div>
        <Campo label="Notas internas" className="sm:col-span-2 lg:col-span-4">
          <input className="input" value={f.notas ?? ""} onChange={txt("notas")} />
        </Campo>
      </div>
      {f.vencimiento_mandato && f.activo && (
        <p className="mt-3 text-[12px] text-carbon/60">Se agenda el vencimiento “Vence mandato de {f.nombre.trim() || "…"} ({cargoLabel(f)})” en Vencimientos.</p>
      )}
      {faltan.length > 0 && (
        <p className="mt-2 text-[12px] text-carbon/60">
          Podés guardar igual; para declararlo en SIARA faltan: <span className="text-cobre-hover">{faltan.join(", ")}</span>.
        </p>
      )}
      {error && <p className="mt-2 text-sm text-bad">{error}</p>}
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? "Guardando..." : editandoId ? "Guardar cambios" : "Agregar"}
        </button>
        <button type="button" className="btn btn-ghost" onClick={onCancel}>
          Cancelar
        </button>
      </div>
    </form>
  );
}

function AdministradorItem({
  a,
  esBF,
  onEditar,
  onComoBF,
  onBorrado,
}: {
  a: Administrador;
  esBF: boolean;
  onEditar: () => void;
  onComoBF: () => void;
  onBorrado: () => void;
}) {
  const { showToast } = useToast();
  const faltan = faltantesAdministrador(aNuevoAdministrador(a));
  const dias = a.vencimiento_mandato ? daysUntil(a.vencimiento_mandato) : null;

  async function borrar() {
    if (!confirm(`¿Eliminar a ${a.nombre}? Si tenía vencimiento de mandato, también se quita de la agenda. Si cesó en el cargo, mejor desmarcá "En funciones".`)) return;
    const { error } = await eliminarAdministrador(a.id);
    if (error) return showToast(`No se pudo eliminar: ${error.message}`, "error");
    showToast("Eliminado.");
    onBorrado();
  }

  return (
    <li className={`animate-row-in rounded-md border bg-white p-3.5 ${a.activo ? "" : "opacity-60"}`} style={{ borderColor: "var(--line)" }}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-medium text-carbon [overflow-wrap:anywhere]">{a.nombre}</p>
          <p className="text-xs text-carbon/55">
            {cargoLabel(a)}
            {a.documento ? ` · ${a.tipo_documento === "ci" ? "C.I." : TIPO_DOCUMENTO_LABELS[a.tipo_documento]} ${a.documento}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {(a.es_representante_legal || a.cargo === "representante_legal") && <Chip>Rep. legal</Chip>}
          {!a.activo ? (
            <Chip>Cesado</Chip>
          ) : dias !== null && dias < 0 ? (
            <Chip tono="mal">Mandato vencido</Chip>
          ) : dias !== null && dias <= 60 ? (
            <Chip tono="alerta">Vence en {dias} días</Chip>
          ) : faltan.length === 0 ? (
            <Chip tono="ok">Completo</Chip>
          ) : (
            <Chip tono="alerta">Faltan {faltan.length}</Chip>
          )}
        </div>
      </div>
      <dl className="mt-2.5 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4">
        <Dato label="Asunción">{a.fecha_designacion ? formatFecha(a.fecha_designacion) : "—"}</Dato>
        <Dato label="Vence">{a.vencimiento_mandato ? formatFecha(a.vencimiento_mandato) : "—"}</Dato>
        <Dato label="Instrumento">{a.instrumento ?? "—"}</Dato>
        <Dato label="Inscripta">{a.inscripto ? "Sí" : "No"}</Dato>
      </dl>
      {faltan.length > 0 && a.activo && <p className="mt-2 text-[11.5px] text-cobre-hover">Falta: {faltan.join(", ")}</p>}
      <div className="mt-2.5 flex flex-wrap items-center gap-1 border-t pt-2" style={{ borderColor: "var(--line)" }}>
        <button type="button" className="btn btn-ghost px-2.5! py-1! text-xs" onClick={onEditar}>
          <Pencil size={13} /> Editar
        </button>
        {a.activo && !esBF && (
          <button type="button" className="btn btn-ghost px-2.5! py-1! text-xs" onClick={onComoBF} title="Condición c) del art. 4 de la Ley 6446/2019">
            <UserPlus size={13} /> Agregar como BF
          </button>
        )}
        <button type="button" className="btn btn-ghost ml-auto px-2.5! py-1! text-xs text-bad" onClick={borrar} title="Eliminar" aria-label={`Eliminar a ${a.nombre}`}>
          <Trash2 size={13} />
        </button>
      </div>
    </li>
  );
}

// ─── panel ───────────────────────────────────────────────────────────────

/**
 * Ficha "estilo SIARA" de una empresa: lo que se declara en el Registro
 * Administrativo de Personas y Estructuras Jurídicas y de Beneficiarios
 * Finales, con checklist de datos faltantes y resumen imprimible.
 */
export default function SiaraPanel({
  empresaId,
  empresa,
  accionistas: accionistasProp,
  onEmpresaChange,
  onEditarEmpresa,
}: {
  empresaId: string;
  empresa: EmpresaSiara;
  /** Si ya están cargados; si no, se traen de la base. */
  accionistas?: Accionista[];
  onEmpresaChange?: (e: EmpresaSiara) => void;
  /** Abre el formulario de datos de la empresa (pestaña Datos). */
  onEditarEmpresa?: () => void;
}) {
  const { showToast } = useToast();
  const accQ = useAccionistas(accionistasProp ? null : empresaId);
  const accionistas = accionistasProp ?? accQ.data;
  const bfQ = useBeneficiarios(empresaId);
  const admQ = useAdministradores(empresaId);
  const [bfForm, setBfForm] = useState<{ inicial: NuevoBeneficiario; id: string | null } | null>(null);
  const [admForm, setAdmForm] = useState<{ inicial: NuevoAdministrador; id: string | null } | null>(null);

  const activos = useMemo(() => accionistas.filter((a) => a.activo !== false && Number(a.acciones) > 0), [accionistas]);
  const { filas, totalAcciones, totalVotos } = useMemo(() => calcularParticipaciones(activos), [activos]);
  const items = useMemo(() => checklistSiara(empresa, accionistas, bfQ.data, admQ.data), [empresa, accionistas, bfQ.data, admQ.data]);
  const pendientes = items.filter((i) => !i.ok).length;
  const pct = items.length ? Math.round(((items.length - pendientes) / items.length) * 100) : 0;
  const sumaBF = bfQ.data.filter((b) => bfVigente(b)).reduce((s, b) => s + participacionTotal(b), 0);
  const docsBF = new Set(bfQ.data.map((b) => b.documento?.trim().toLowerCase()).filter(Boolean));

  const fuentesBF = useMemo(
    () => [
      ...filas
        .filter((f) => f.tipo_persona === "fisica")
        .map((f) => ({
          key: `acc:${f.id}`,
          label: `Accionista: ${f.nombre} (${formatPct(f.pctCapital)})${f.posibleBF ? " — supera umbral" : ""}`,
          datos: beneficiarioDesdeAccionista(empresaId, f),
        })),
      ...admQ.data
        .filter((a) => a.activo)
        .map((a) => ({ key: `adm:${a.id}`, label: `${cargoLabel(a)}: ${a.nombre}`, datos: beneficiarioDesdeAdministrador(empresaId, a) })),
    ],
    [filas, admQ.data, empresaId]
  );

  const cargando = bfQ.loading || admQ.loading || (!accionistasProp && accQ.loading);
  const errorTablas = bfQ.error || admQ.error;
  const anio = new Date().getFullYear();
  const proximaAnual = todayIso() <= `${anio}-06-30` ? `${anio}-06-30` : `${anio + 1}-06-30`;

  function imprimir() {
    const ok = imprimirResumenSiara(empresa, resumenSiaraHtml(empresa, accionistas, bfQ.data, admQ.data));
    if (!ok) showToast("El navegador bloqueó la ventana. Permití las ventanas emergentes para este sitio.", "error");
  }

  const pej: [string, string | number | null | undefined][] = [
    ["Razón social", empresa.denominacion],
    ["Tipo", TIPO_LABELS[empresa.tipo]],
    ["RUC", empresa.ruc],
    ["Correo institucional", empresa.email_institucional],
    ["Página web", empresa.pagina_web || "—"],
    ["Departamento", empresa.departamento],
    ["Ciudad", empresa.ciudad],
    ["Barrio", empresa.barrio],
    ["Domicilio social", empresa.domicilio],
    ["Domicilio comercial", empresa.domicilio_comercial || "Igual al social"],
    ["Actividad principal", empresa.actividad_principal || "—"],
    ["Constitución", empresa.fecha_constitucion ? formatFecha(empresa.fecha_constitucion) : null],
    ["Inscripción registral", empresa.inscripcion_registral],
    ["Fecha de inscripción", empresa.fecha_inscripcion ? formatFecha(empresa.fecha_inscripcion) : "—"],
    ["Capital integrado", empresa.capital_integrado ? formatPyg(empresa.capital_integrado) : null],
    [empresa.tipo === "srl" ? "Valor nominal por cuota" : "Valor nominal por acción", empresa.valor_nominal_accion ? formatPyg(empresa.valor_nominal_accion) : null],
  ];

  return (
    <div className="space-y-4">
      {/* Estado de la declaración */}
      <div className="card">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-xl! leading-7!">Declaración en SIARA</h2>
            <p className="mt-0.5 text-[13px] text-carbon/60">
              Registro Administrativo de Personas y Estructuras Jurídicas y de Beneficiarios Finales (MEF · DGPEJBF).
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn btn-ghost" onClick={imprimir} disabled={cargando}>
              <Printer size={15} /> Resumen / PDF
            </button>
            <a href={FUENTES_SIARA.siara} target="_blank" rel="noopener noreferrer" className="btn btn-ghost">
              <ExternalLink size={15} /> Ir a SIARA
            </a>
          </div>
        </div>

        {cargando ? (
          <SkeletonBlock className="mt-4 h-24" />
        ) : (
          <>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              {pendientes === 0 ? (
                <Chip tono="ok" className="leading-4">Listo para declarar en SIARA</Chip>
              ) : (
                <Chip tono="alerta" className="leading-4">
                  Listo para declarar en SIARA: falta{pendientes === 1 ? "" : "n"} {pendientes} dato{pendientes === 1 ? "" : "s"}
                </Chip>
              )}
              <div className="h-2 min-w-[120px] flex-1 overflow-hidden rounded-full" style={{ background: "var(--line)" }} aria-hidden="true">
                <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: pendientes === 0 ? "var(--color-good)" : "var(--color-cobre)" }} />
              </div>
              <span className="text-xs text-carbon/55">{pct}%</span>
            </div>
            <div className="mt-4">
              <Checklist items={items} />
            </div>
          </>
        )}

        <div className="mt-4 border-t pt-3" style={{ borderColor: "var(--line)" }}>
          <Seguimiento key={`${empresa.siara_ultima_declaracion}-${empresa.siara_numero_solicitud}`} empresa={empresa} onEmpresaChange={onEmpresaChange} />
        </div>

        <div className="mt-3 rounded-sm px-3 py-2.5 text-[12.5px] leading-[19px] text-carbon/75" style={{ background: "rgba(242,238,230,0.8)", borderLeft: "3px solid var(--color-cobre)" }}>
          <p>
            <strong>Plazos.</strong> Toda modificación (accionistas, beneficiarios finales, autoridades, domicilio) se comunica dentro de los{" "}
            <strong>{DIAS_HABILES_MODIFICACION} días hábiles</strong> (
            <a href={FUENTES_SIARA.ley} target="_blank" rel="noopener noreferrer" className="underline hover:text-cobre-hover">
              Ley N° 6446/2019, art. 7
            </a>
            ;{" "}
            <a href={FUENTES_SIARA.decreto} target="_blank" rel="noopener noreferrer" className="underline hover:text-cobre-hover">
              Decreto N° 3241/2020, art. 10
            </a>
            ). Además, los datos se actualizan cada año a más tardar el <strong>30 de junio</strong> (Decreto N° 3241/2020, art. 10): próxima,{" "}
            {formatFecha(proximaAnual)}. Una sociedad nueva declara dentro de los 45 días hábiles de su constitución (Ley N° 6446/2019, art. 3).
          </p>
          <p className="mt-1.5 text-carbon/60">
            SIARA pide además la documentación firmada con firma electrónica cualificada: última escritura de modificación del capital (o la de constitución),
            último documento de elección de autoridades y registro de accionistas actualizado; y los poderes, si se declaran apoderados (
            <a href={FUENTES_SIARA.manual} target="_blank" rel="noopener noreferrer" className="underline hover:text-cobre-hover">
              manual SIARA S.A./S.R.L.
            </a>
            ). Información general; no constituye asesoramiento legal personalizado.
          </p>
        </div>
      </div>

      {errorTablas && (
        <p className="flex items-start gap-2 rounded-sm border px-3 py-2 text-sm text-bad" style={{ borderColor: "rgba(178,59,59,0.3)" }}>
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          No se pudieron leer los datos de SIARA ({errorTablas}). ¿Se corrió la migración 007_siara.sql?
        </p>
      )}

      {/* 1. Persona jurídica */}
      <Seccion
        n={1}
        titulo="Datos de la persona jurídica"
        accion={
          onEditarEmpresa && (
            <button type="button" className="btn btn-ghost px-2.5! py-1! text-xs" onClick={onEditarEmpresa}>
              <Pencil size={13} /> Completar
            </button>
          )
        }
      >
        <dl className="grid grid-cols-1 gap-x-6 gap-y-3 min-[420px]:grid-cols-2 lg:grid-cols-4">
          {pej.map(([k, v]) => {
            const x = valor(v);
            return (
              <Dato key={k} label={k} falta={x.falta}>
                {x.txt}
              </Dato>
            );
          })}
        </dl>
      </Seccion>

      {/* 2. Accionistas */}
      <Seccion
        n={2}
        titulo={empresa.tipo === "srl" ? "Socios" : "Accionistas"}
        subtitulo={`Del libro de accionistas · ${formatNumero(totalAcciones)} ${empresa.tipo === "srl" ? "cuotas" : "acciones"} · ${formatNumero(totalVotos)} votos`}
      >
        {cargando ? (
          <SkeletonBlock className="h-20" />
        ) : filas.length === 0 ? (
          <p className="text-sm text-carbon/60">Todavía no hay accionistas cargados. Cargalos en la pestaña “Accionistas”.</p>
        ) : (
          <>
            <ul className="space-y-2 sm:hidden">
              {filas.map((f) => (
                <li key={f.id} className="rounded-sm border px-3 py-2" style={{ borderColor: "var(--line)" }}>
                  <div className="flex items-start justify-between gap-2">
                    <p className="min-w-0 text-[13.5px] font-medium [overflow-wrap:anywhere]">{f.nombre}</p>
                    <span className="shrink-0 text-[13px] font-semibold">{formatPct(f.pctCapital)}</span>
                  </div>
                  <p className="text-[11.5px] text-carbon/55">
                    {f.documento ?? "Sin documento"} · {formatNumero(f.acciones)} acc. · {formatPct(f.pctVotos)} votos
                    {f.tipo_persona === "juridica" ? " · persona jurídica" : ""}
                  </p>
                  {f.posibleBF && (
                    <div className="mt-1">
                      <Chip tono={f.documento && docsBF.has(f.documento.trim().toLowerCase()) ? "ok" : "alerta"}>
                        {f.tipo_persona === "juridica" ? "Identificar BF detrás" : "Posible BF"}
                      </Chip>
                    </div>
                  )}
                </li>
              ))}
            </ul>
            <div className="table-shell max-sm:hidden">
              <table>
                <thead>
                  <tr>
                    <th>Nombre</th>
                    <th>Documento</th>
                    <th className="text-right!">{empresa.tipo === "srl" ? "Cuotas" : "Acciones"}</th>
                    <th className="text-right!">% capital</th>
                    <th className="text-right!">% votos</th>
                    <th>Contacto</th>
                    <th>BF</th>
                  </tr>
                </thead>
                <tbody>
                  {filas.map((f) => (
                    <tr key={f.id}>
                      <td>
                        {f.nombre}
                        {f.tipo_persona === "juridica" && <span className="block text-[11px] text-carbon/50">Persona jurídica</span>}
                      </td>
                      <td className={f.documento ? "" : "italic text-bad/80"}>{f.documento ?? "Falta"}</td>
                      <td className="text-right tabular-nums">{formatNumero(f.acciones)}</td>
                      <td className="text-right tabular-nums">{formatPct(f.pctCapital)}</td>
                      <td className="text-right tabular-nums">{formatPct(f.pctVotos)}</td>
                      <td className="text-xs text-carbon/65">{[f.email, f.telefono].filter(Boolean).join(" · ") || <span className="italic text-bad/80">Falta</span>}</td>
                      <td>
                        {f.posibleBF ? (
                          <Chip tono={f.documento && docsBF.has(f.documento.trim().toLowerCase()) ? "ok" : "alerta"}>
                            {f.tipo_persona === "juridica" ? "Identificar BF" : f.documento && docsBF.has(f.documento.trim().toLowerCase()) ? "Declarado" : "Posible BF"}
                          </Chip>
                        ) : (
                          <span className="text-carbon/40">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-[11.5px] text-carbon/55">
              SIARA también pide de cada accionista domicilio, profesión, ocupación y nacionalidad: tenelos a mano al declarar.
            </p>
          </>
        )}
      </Seccion>

      {/* 3. Beneficiarios finales */}
      <Seccion
        id="siara-bf"
        n={3}
        titulo="Beneficiarios finales"
        subtitulo={`Suma de participaciones vigentes: ${formatPct(sumaBF)}`}
        accion={
          !bfForm && (
            <button type="button" className="btn btn-primary px-3! py-1.5! text-xs" onClick={() => setBfForm({ inicial: beneficiarioVacio(empresaId), id: null })}>
              <Plus size={14} /> Agregar
            </button>
          )
        }
      >
        <div className="space-y-3">
          {bfForm && (
            <BeneficiarioForm
              key={bfForm.id ?? `nuevo-${bfForm.inicial.nombre}`}
              inicial={bfForm.inicial}
              editandoId={bfForm.id}
              otros={bfQ.data}
              fuentes={fuentesBF}
              onSaved={(b) => {
                showToast(bfForm.id ? "Beneficiario final actualizado." : "Beneficiario final agregado.");
                setBfForm(null);
                bfQ.setData((prev) => (prev.some((x) => x.id === b.id) ? prev.map((x) => (x.id === b.id ? b : x)) : [...prev, b]));
              }}
              onCancel={() => setBfForm(null)}
            />
          )}
          {cargando ? (
            <SkeletonBlock className="h-20" />
          ) : bfQ.data.length === 0 ? (
            !bfForm && (
              <p className="rounded border border-dashed p-5 text-center text-sm text-carbon/60" style={{ borderColor: "var(--line)" }}>
                Ningún beneficiario final cargado. Toda sociedad tiene al menos uno: si nadie supera los umbrales de capital o votos, se declara a quien ejerce el control o la
                administración (art. 4, literales c a e).
              </p>
            )
          ) : (
            <ul className="space-y-2">
              {bfQ.data.map((b) => (
                <BeneficiarioItem
                  key={b.id}
                  b={b}
                  onEditar={() => setBfForm({ inicial: aNuevoBeneficiario(b), id: b.id })}
                  onBorrado={() => bfQ.setData((prev) => prev.filter((x) => x.id !== b.id))}
                />
              ))}
            </ul>
          )}
          {sumaBF > 100 && <p className="text-sm text-bad">La suma de participaciones supera el 100%: revisá los porcentajes.</p>}
          <p className="text-[11.5px] text-carbon/55">
            Beneficiario final: la persona física que, directa o indirectamente, tiene una participación sustantiva o el control final de la sociedad (Ley N° 6446/2019, art. 4). Se
            declara siempre una persona física: si un accionista es una sociedad, hay que llegar a quien la controla.
          </p>
        </div>
      </Seccion>

      {/* 4. Administradores */}
      <Seccion
        n={4}
        titulo="Administradores y representantes"
        subtitulo={empresa.tipo === "srl" ? "Gerentes y representantes legales" : "Directorio, sindicatura y representantes legales"}
        accion={
          !admForm && (
            <button
              type="button"
              className="btn btn-primary px-3! py-1.5! text-xs"
              onClick={() =>
                setAdmForm({
                  inicial: { ...administradorVacio(empresaId, empresa), cargo: empresa.tipo === "srl" ? "gerente" : "director_titular" },
                  id: null,
                })
              }
            >
              <Plus size={14} /> Agregar
            </button>
          )
        }
      >
        <div className="space-y-3">
          {admForm && (
            <AdministradorForm
              key={admForm.id ?? "nuevo"}
              inicial={admForm.inicial}
              editandoId={admForm.id}
              esSrl={empresa.tipo === "srl"}
              onSaved={(a) => {
                showToast(a.vencimiento_mandato && a.activo ? "Guardado. El vencimiento del mandato quedó en la agenda." : "Guardado.");
                setAdmForm(null);
                admQ.setData((prev) => (prev.some((x) => x.id === a.id) ? prev.map((x) => (x.id === a.id ? a : x)) : [...prev, a]));
              }}
              onCancel={() => setAdmForm(null)}
            />
          )}
          {cargando ? (
            <SkeletonBlock className="h-20" />
          ) : admQ.data.length === 0 ? (
            !admForm && (
              <p className="rounded border border-dashed p-5 text-center text-sm text-carbon/60" style={{ borderColor: "var(--line)" }}>
                Cargá a quienes integran el órgano de administración y al representante legal.
              </p>
            )
          ) : (
            <ul className="space-y-2">
              {admQ.data.map((a) => (
                <AdministradorItem
                  key={a.id}
                  a={a}
                  esBF={!!a.documento && docsBF.has(a.documento.trim().toLowerCase())}
                  onEditar={() => setAdmForm({ inicial: aNuevoAdministrador(a), id: a.id })}
                  onComoBF={() => {
                    setBfForm({ inicial: beneficiarioDesdeAdministrador(empresaId, a), id: null });
                    requestAnimationFrame(() => document.getElementById("siara-bf")?.scrollIntoView({ behavior: "smooth", block: "start" }));
                  }}
                  onBorrado={() => admQ.setData((prev) => prev.filter((x) => x.id !== a.id))}
                />
              ))}
            </ul>
          )}
          <p className="text-[11.5px] text-carbon/55">
            Los apoderados se registran en la pestaña “Poderes”. SIARA puede calificar a gerentes y administradores como beneficiarios finales por el literal c) del art. 4: revisá si
            corresponde agregarlos.
          </p>
        </div>
      </Seccion>
    </div>
  );
}
