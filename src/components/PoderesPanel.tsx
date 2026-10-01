"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Ban, FilePlus2, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { useEmpresas } from "@/lib/data";
import { formatFecha, todayIso } from "@/lib/dates";
import {
  ESTADO_PODER_ESTILO,
  TIPO_PODER_LABELS,
  aNuevoPoder,
  eliminarPoder,
  estadoPoder,
  guardarPoder,
  poderVacio,
  revocarPoder,
  usePoderes,
  validarPoder,
  type ClaveEstadoPoder,
  type NuevoPoder,
  type Poder,
  type TipoPoder,
} from "@/lib/poderes";
import { useToast } from "@/components/ToastProvider";
import { SkeletonTable } from "@/components/Skeleton";
import type { Empresa } from "@/lib/types";

// ─── piezas chicas ───────────────────────────────────────────────────────

export function EstadoPoderBadge({ poder }: { poder: Pick<Poder, "estado" | "fecha_vencimiento" | "revocado_el"> }) {
  const e = estadoPoder(poder);
  const st = ESTADO_PODER_ESTILO[e.clave];
  return (
    <span className="inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold" style={st}>
      {e.label}
    </span>
  );
}

function Dato({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-carbon/45">{label}</dt>
      <dd className="mt-0.5 break-words text-[13px] text-carbon/85">{children}</dd>
    </div>
  );
}

// ─── formulario ──────────────────────────────────────────────────────────

/**
 * Alta / edición de un poder. Se exporta para que el generador lo abra
 * precargado después de crear una carta poder.
 */
export function PoderForm({
  inicial,
  editandoId,
  empresas,
  empresaFija,
  titulo,
  cancelLabel = "Cancelar",
  onSaved,
  onCancel,
}: {
  inicial: NuevoPoder;
  editandoId?: string | null;
  /** Para elegir la empresa (si no hay empresa fija). */
  empresas?: Empresa[];
  empresaFija?: boolean;
  titulo?: string;
  cancelLabel?: string;
  onSaved: (p: Poder) => void;
  onCancel: () => void;
}) {
  const [f, setF] = useState<NuevoPoder>(inicial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = <K extends keyof NuevoPoder>(k: K, val: NuevoPoder[K]) => setF((p) => ({ ...p, [k]: val }));
  const txt = (k: keyof NuevoPoder) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => set(k, e.target.value as never);
  const fecha = (k: keyof NuevoPoder) => (e: React.ChangeEvent<HTMLInputElement>) => set(k, (e.target.value || null) as never);

  const requiereEscritura = (f.tipo === "general" || f.tipo === "judicial") && /carta/i.test(f.instrumento ?? "");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const err = validarPoder(f);
    if (err) return setError(err);
    setSaving(true);
    const { data, error: dbErr } = await guardarPoder(f, editandoId);
    setSaving(false);
    if (dbErr) return setError(`No se pudo guardar: ${dbErr.message}`);
    onSaved(data as Poder);
  }

  return (
    <form
      onSubmit={submit}
      className="animate-slide-up rounded-sm border p-4"
      style={{ borderColor: "rgba(184,115,74,0.4)", background: "rgba(184,115,74,0.05)" }}
    >
      {titulo && <h3 className="mb-3">{titulo}</h3>}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {!empresaFija && empresas && (
          <div className="sm:col-span-2 lg:col-span-4">
            <label className="field-label">
              Empresa (poderdante)<span className="required-mark">*</span>
            </label>
            <select className="input" value={f.empresa_id} onChange={(e) => set("empresa_id", e.target.value)}>
              <option value="">Elegí una empresa</option>
              {empresas.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.denominacion}
                </option>
              ))}
            </select>
          </div>
        )}
        <div className="sm:col-span-2">
          <label className="field-label">
            Apoderado<span className="required-mark">*</span>
          </label>
          <input
            className="input"
            value={f.apoderado}
            onChange={txt("apoderado")}
            placeholder="Nombre y apellido o razón social"
            autoFocus
          />
        </div>
        <div>
          <label className="field-label">C.I. / RUC del apoderado</label>
          <input className="input" value={f.apoderado_documento ?? ""} onChange={txt("apoderado_documento")} />
        </div>
        <div>
          <label className="field-label">Tipo de poder</label>
          <select className="input" value={f.tipo} onChange={(e) => set("tipo", e.target.value as TipoPoder)}>
            {(Object.keys(TIPO_PODER_LABELS) as TipoPoder[]).map((t) => (
              <option key={t} value={t}>
                {TIPO_PODER_LABELS[t]}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="field-label">
            Fecha de otorgamiento<span className="required-mark">*</span>
          </label>
          <input type="date" className="input" value={f.fecha_otorgamiento} onChange={(e) => set("fecha_otorgamiento", e.target.value)} />
        </div>
        <div className="sm:col-span-2 lg:col-span-3">
          <label className="field-label">Instrumento</label>
          <input
            className="input"
            value={f.instrumento ?? ""}
            onChange={txt("instrumento")}
            list="poder-instrumentos"
            placeholder="Escritura pública N° …, o Carta poder simple"
          />
          <datalist id="poder-instrumentos">
            <option value="Carta poder simple" />
            <option value="Carta poder con firma certificada por escribano" />
            <option value="Escritura pública N° " />
          </datalist>
        </div>
        {requiereEscritura && (
          <p className="text-xs text-cobre-hover sm:col-span-2 lg:col-span-4">
            Ojo: los poderes generales de administración, para actos de disposición y para juicio se otorgan por escritura pública ante
            escribano; una carta poder simple no alcanza.
          </p>
        )}

        <div className="sm:col-span-2">
          <label className="field-label">Escribano/a</label>
          <input
            className="input"
            value={f.escribano ?? ""}
            onChange={txt("escribano")}
            placeholder="Solo si es escritura o firma certificada"
          />
        </div>
        <div>
          <label className="field-label">Fecha de inscripción</label>
          <input type="date" className="input" value={f.fecha_inscripcion ?? ""} onChange={fecha("fecha_inscripcion")} />
          <p className="mt-1 text-[11px] leading-snug text-carbon/50">En caso de que aplique.</p>
        </div>
        <div>
          <label className="field-label">Registro</label>
          <input className="input" value={f.registro ?? ""} onChange={txt("registro")} list="poder-registros" />
          <datalist id="poder-registros">
            <option value="Registro de Poderes — Dirección General de los Registros Públicos" />
          </datalist>
        </div>

        <div>
          <label className="field-label">Vence el</label>
          <input type="date" className="input" value={f.fecha_vencimiento ?? ""} onChange={fecha("fecha_vencimiento")} />
          <p className="mt-1 text-[11px] leading-snug text-carbon/50">Si tiene fecha, aparece en Vencimientos.</p>
        </div>
        <div className="sm:col-span-1 lg:col-span-3">
          <label className="field-label">Duración</label>
          <input
            className="input"
            value={f.duracion_texto ?? ""}
            onChange={txt("duracion_texto")}
            list="poder-duraciones"
            placeholder="Hasta su revocación, por un año, mientras dure el mandato…"
          />
          <datalist id="poder-duraciones">
            <option value="Hasta su revocación" />
            <option value="Por un (1) año" />
            <option value="Mientras dure el mandato del Directorio" />
          </datalist>
        </div>

        <div className="sm:col-span-2 lg:col-span-4">
          <label className="field-label">Facultades</label>
          <textarea
            className="input min-h-[76px]"
            value={f.facultades ?? ""}
            onChange={txt("facultades")}
            placeholder="Qué puede hacer el apoderado (una por línea)"
          />
        </div>

        {editandoId && (
          <>
            <div>
              <label className="field-label">Estado</label>
              <select
                className="input"
                value={f.estado}
                onChange={(e) => {
                  const estado = e.target.value as NuevoPoder["estado"];
                  setF((p) => ({ ...p, estado, revocado_el: estado === "revocado" ? (p.revocado_el ?? todayIso()) : null }));
                }}
              >
                <option value="vigente">Vigente</option>
                <option value="revocado">Revocado</option>
              </select>
            </div>
            {f.estado === "revocado" && (
              <div>
                <label className="field-label">Revocado el</label>
                <input type="date" className="input" value={f.revocado_el ?? ""} onChange={fecha("revocado_el")} />
              </div>
            )}
          </>
        )}
        <div className="sm:col-span-2 lg:col-span-4">
          <label className="field-label">Notas</label>
          <textarea className="input min-h-[56px]" value={f.notas ?? ""} onChange={txt("notas")} />
        </div>
      </div>
      {error && <p className="mt-2 text-sm text-bad">{error}</p>}
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? "Guardando..." : editandoId ? "Guardar cambios" : "Registrar poder"}
        </button>
        <button type="button" className="btn btn-ghost" onClick={onCancel}>
          {cancelLabel}
        </button>
      </div>
    </form>
  );
}

// ─── tarjeta de un poder ─────────────────────────────────────────────────

function PoderCard({ poder, empresa, onEditar, onCambio }: { poder: Poder; empresa?: string; onEditar: () => void; onCambio: () => void }) {
  const { showToast } = useToast();
  const [revocando, setRevocando] = useState(false);
  const [fechaRev, setFechaRev] = useState(todayIso());
  const [busy, setBusy] = useState(false);

  async function revocar() {
    setBusy(true);
    const { error } = await revocarPoder(poder.id, fechaRev);
    setBusy(false);
    if (error) return showToast(`No se pudo revocar: ${error.message}`, "error");
    showToast("Poder marcado como revocado.");
    setRevocando(false);
    onCambio();
  }

  async function borrar() {
    if (!confirm(`¿Eliminar del registro el poder de ${poder.apoderado}? Si tenía vencimiento, también se quita de la agenda.`)) return;
    setBusy(true);
    const { error } = await eliminarPoder(poder.id);
    setBusy(false);
    if (error) return showToast(`No se pudo eliminar: ${error.message}`, "error");
    showToast("Poder eliminado.");
    onCambio();
  }

  const venceTexto = poder.fecha_vencimiento ? formatFecha(poder.fecha_vencimiento) : (poder.duracion_texto ?? "Sin fecha");

  return (
    <li className="animate-row-in rounded-md border bg-white p-4" style={{ borderColor: "var(--line)" }}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-medium text-carbon">
            {poder.apoderado}
            {poder.apoderado_documento && <span className="ml-1.5 text-xs font-normal text-carbon/55">· {poder.apoderado_documento}</span>}
          </p>
          {empresa && <p className="text-xs text-carbon/55">{empresa}</p>}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="rounded-full px-2 py-0.5 text-[11px] font-medium text-musgo" style={{ background: "rgba(30,47,37,0.08)" }}>
            {TIPO_PODER_LABELS[poder.tipo]}
          </span>
          <EstadoPoderBadge poder={poder} />
        </div>
      </div>

      {poder.facultades && <p className="mt-2 line-clamp-2 whitespace-pre-line text-[13px] text-carbon/70">{poder.facultades}</p>}

      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4">
        <Dato label="Otorgado">{formatFecha(poder.fecha_otorgamiento)}</Dato>
        <Dato label="Vence">{venceTexto}</Dato>
        <Dato label="Instrumento">
          {poder.instrumento ?? "—"}
          {poder.escribano ? ` · Esc. ${poder.escribano}` : ""}
        </Dato>
        <Dato label="Inscripción">
          {poder.fecha_inscripcion ? formatFecha(poder.fecha_inscripcion) : "—"}
          {poder.registro ? ` · ${poder.registro}` : ""}
        </Dato>
      </dl>
      {poder.notas && <p className="mt-2 text-xs text-carbon/55">{poder.notas}</p>}

      {revocando ? (
        <div
          className="mt-3 flex flex-wrap items-end gap-2 rounded-sm border p-3"
          style={{ borderColor: "var(--line)", background: "rgba(242,238,230,0.6)" }}
        >
          <div>
            <label className="field-label">Revocado desde</label>
            <input type="date" className="input" value={fechaRev} onChange={(e) => setFechaRev(e.target.value)} />
          </div>
          <button type="button" className="btn btn-primary" onClick={revocar} disabled={busy || !fechaRev}>
            {busy ? "Guardando..." : "Confirmar revocación"}
          </button>
          <button type="button" className="btn btn-ghost" onClick={() => setRevocando(false)}>
            Cancelar
          </button>
          <p className="w-full text-[11px] text-carbon/55">
            Recordá notificar la revocación al apoderado y a quienes se les presentó el poder (plantilla POD-05).
          </p>
        </div>
      ) : (
        <div className="mt-3 flex flex-wrap items-center gap-1 border-t pt-2" style={{ borderColor: "var(--line)" }}>
          <button type="button" className="btn btn-ghost px-2.5! py-1! text-xs" onClick={onEditar}>
            <Pencil size={13} /> Editar
          </button>
          {poder.estado === "vigente" && (
            <button type="button" className="btn btn-ghost px-2.5! py-1! text-xs" onClick={() => setRevocando(true)}>
              <Ban size={13} /> Revocar
            </button>
          )}
          <button
            type="button"
            className="btn btn-ghost ml-auto px-2.5! py-1! text-xs text-bad"
            onClick={borrar}
            disabled={busy}
            title="Eliminar del registro"
          >
            <Trash2 size={13} />
          </button>
        </div>
      )}
    </li>
  );
}

// ─── panel ───────────────────────────────────────────────────────────────

type Filtro = "todos" | ClaveEstadoPoder;

const FILTROS: { value: Filtro; label: string }[] = [
  { value: "todos", label: "Todos" },
  { value: "vigente", label: "Vigentes" },
  { value: "por_vencer", label: "Por vencer" },
  { value: "vencido", label: "Vencidos" },
  { value: "revocado", label: "Revocados" },
];

/**
 * Registro de poderes. Con `empresaId` muestra los de esa empresa (para la
 * ficha de la empresa); sin él, los de todas, con filtro por empresa.
 */
export default function PoderesPanel({
  empresaId = null,
  empresas: empresasProp,
  empresaInicial = null,
}: {
  empresaId?: string | null;
  empresas?: Empresa[];
  /** Filtro de empresa inicial en la vista global. */
  empresaInicial?: string | null;
}) {
  const { showToast } = useToast();
  const empresasQ = useEmpresas();
  const empresas = empresasProp ?? empresasQ.data;
  const poderes = usePoderes(empresaId);
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [empresaFiltro, setEmpresaFiltro] = useState(empresaInicial ?? "");
  const [tipoFiltro, setTipoFiltro] = useState<"" | TipoPoder>("");
  const [busqueda, setBusqueda] = useState("");
  const [form, setForm] = useState<{ inicial: NuevoPoder; id: string | null } | null>(null);

  const nombres = useMemo(() => new Map(empresas.map((e) => [e.id, e.denominacion])), [empresas]);
  const global = !empresaId;

  const conEstado = useMemo(() => poderes.data.map((p) => ({ p, e: estadoPoder(p) })), [poderes.data]);
  const base = conEstado.filter(
    ({ p }) =>
      (!empresaFiltro || p.empresa_id === empresaFiltro) &&
      (!tipoFiltro || p.tipo === tipoFiltro) &&
      (!busqueda.trim() ||
        `${p.apoderado} ${p.apoderado_documento ?? ""} ${p.facultades ?? ""} ${p.instrumento ?? ""} ${nombres.get(p.empresa_id) ?? ""}`
          .toLowerCase()
          .includes(busqueda.trim().toLowerCase())),
  );
  const cuenta = (f: Filtro) => (f === "todos" ? base.length : base.filter(({ e }) => e.clave === f).length);
  const orden: Record<ClaveEstadoPoder, number> = { por_vencer: 0, vencido: 1, vigente: 2, revocado: 3 };
  const visibles = base
    .filter(({ e }) => filtro === "todos" || e.clave === filtro)
    .sort(
      (a, b) => orden[a.e.clave] - orden[b.e.clave] || (a.p.fecha_vencimiento ?? "9999").localeCompare(b.p.fecha_vencimiento ?? "9999"),
    );

  const linkCarta = `/documentos?${empresaId ? `empresa=${empresaId}&` : ""}plantilla=pod-carta-administrativa`;

  function nuevo() {
    setForm({ inicial: poderVacio(empresaId ?? empresaFiltro ?? ""), id: null });
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2>Poderes</h2>
          <p className="mt-0.5 text-sm text-carbon/60">
            Quién puede actuar por {global ? "cada empresa" : "la empresa"}, con qué facultades y hasta cuándo.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={linkCarta} className="btn btn-ghost">
            <FilePlus2 size={15} /> Generar carta poder
          </Link>
          <button type="button" className="btn btn-primary" onClick={nuevo} disabled={!!form}>
            <Plus size={15} /> Registrar poder
          </button>
        </div>
      </div>

      {form && (
        <PoderForm
          key={form.id ?? "nuevo"}
          inicial={form.inicial}
          editandoId={form.id}
          empresas={empresas}
          empresaFija={!global}
          titulo={form.id ? "Editar poder" : "Registrar poder"}
          onCancel={() => setForm(null)}
          onSaved={() => {
            showToast(form.id ? "Poder actualizado." : "Poder registrado.");
            setForm(null);
            poderes.reload();
          }}
        />
      )}

      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="segmented" role="tablist" aria-label="Filtrar por estado">
          {FILTROS.map((f) => (
            <button key={f.value} type="button" className={filtro === f.value ? "active" : ""} onClick={() => setFiltro(f.value)}>
              {f.label} <span className="ml-0.5 opacity-60">{cuenta(f.value)}</span>
            </button>
          ))}
        </div>
        <div className="flex flex-1 flex-wrap gap-2">
          {global && (
            <select
              className="input w-auto! min-w-[10rem] flex-1 sm:flex-none"
              value={empresaFiltro}
              onChange={(e) => setEmpresaFiltro(e.target.value)}
              aria-label="Empresa"
            >
              <option value="">Todas las empresas</option>
              {empresas.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.denominacion}
                </option>
              ))}
            </select>
          )}
          <select
            className="input w-auto! flex-1 sm:flex-none"
            value={tipoFiltro}
            onChange={(e) => setTipoFiltro(e.target.value as "" | TipoPoder)}
            aria-label="Tipo"
          >
            <option value="">Todos los tipos</option>
            {(Object.keys(TIPO_PODER_LABELS) as TipoPoder[]).map((t) => (
              <option key={t} value={t}>
                {TIPO_PODER_LABELS[t]}
              </option>
            ))}
          </select>
          <label className="relative min-w-[12rem] flex-1">
            <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-carbon/40" />
            <input
              className="input pl-8!"
              placeholder="Buscar apoderado, facultad…"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
            />
          </label>
        </div>
      </div>

      {poderes.loading ? (
        <SkeletonTable rows={3} cols={4} />
      ) : poderes.error ? (
        <p className="text-sm text-bad">No se pudieron cargar los poderes: {poderes.error}</p>
      ) : visibles.length === 0 ? (
        <div className="card text-sm text-carbon/65">
          {poderes.data.length === 0
            ? "Todavía no registraste poderes. Registrá los que ya existen (escrituras, cartas poder) para controlar su vigencia."
            : "No hay poderes con esos filtros."}
        </div>
      ) : (
        <ul className="space-y-3">
          {visibles.map(({ p }) => (
            <PoderCard
              key={p.id}
              poder={p}
              empresa={global ? nombres.get(p.empresa_id) : undefined}
              onEditar={() => {
                setForm({ inicial: aNuevoPoder(p), id: p.id });
                if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
              }}
              onCambio={poderes.reload}
            />
          ))}
        </ul>
      )}
      <p className="text-[11px] leading-snug text-carbon/50">
        Los poderes generales de administración, para actos de disposición y para juicio se otorgan por escritura pública ante escribano.
        Este registro es de control interno: no reemplaza la inscripción que corresponda.
      </p>
    </section>
  );
}
