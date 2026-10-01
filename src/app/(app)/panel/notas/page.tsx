"use client";

import { useState } from "react";
import { AlertTriangle, Eye, EyeOff, Pencil, Plus, Star, Trash2, X } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { useNotasNodos } from "@/lib/data";
import { formatFecha } from "@/lib/dates";
import { useToast } from "@/components/ToastProvider";
import { SkeletonBlock } from "@/components/Skeleton";
import { NotaPreview } from "@/components/NovedadesEmpresas";
import { RUBRO_LABEL, RUBROS, TEMAS_NORMATIVA, temaPorId, urlSegura, DISCLAIMER_NOVEDADES, type NotaNodos, type Rubro } from "@/lib/novedades";
import { SECTORES, type Sector } from "@/lib/seprelad";
import { migracionPendiente } from "@/lib/panel";

type Borrador = Omit<NotaNodos, "id" | "created_at" | "publicada_el"> & { id?: string; publicada_el?: string | null };

const NUEVA: Borrador = {
  titulo: "",
  resumen: "",
  cuerpo: null,
  link: null,
  organismo: null,
  rubros: [],
  sectores_seprelad: [],
  destacada: false,
  publicada: false,
};

const SECTOR_IDS = Object.keys(SECTORES) as Sector[];

function toggle<T>(lista: T[], v: T): T[] {
  return lista.includes(v) ? lista.filter((x) => x !== v) : [...lista, v];
}

const pill = (on: boolean) =>
  `rounded-full border px-3 py-1 text-xs font-medium transition ${on ? "border-musgo bg-musgo text-marfil" : "border-[var(--line)] text-carbon/70 hover:border-cobre"}`;

function Editor({ inicial, onGuardada, onCerrar }: { inicial: Borrador; onGuardada: () => void; onCerrar: () => void }) {
  const { showToast } = useToast();
  const [n, setN] = useState<Borrador>(inicial);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = <K extends keyof Borrador>(k: K, v: Borrador[K]) => setN((p) => ({ ...p, [k]: v }));

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    const titulo = n.titulo.trim();
    const resumen = n.resumen.trim();
    const linkTxt = (n.link ?? "").trim();
    if (titulo.length < 3) return setError("El título necesita al menos 3 caracteres.");
    if (resumen.length < 3) return setError("Escribí un resumen.");
    if (linkTxt && !urlSegura(linkTxt)) return setError("El link tiene que empezar con https:// (o http://).");
    setGuardando(true);
    setError(null);
    const payload = {
      titulo,
      resumen,
      cuerpo: (n.cuerpo ?? "").trim() || null,
      link: linkTxt ? urlSegura(linkTxt) : null,
      organismo: n.organismo || null,
      rubros: n.rubros,
      sectores_seprelad: n.sectores_seprelad,
      destacada: n.destacada,
      publicada: n.publicada,
    };
    const res = n.id ? await supabase.from("notas_nodos").update(payload).eq("id", n.id) : await supabase.from("notas_nodos").insert(payload);
    setGuardando(false);
    if (res.error) return setError(`No se pudo guardar: ${res.error.message}`);
    showToast(n.publicada ? "Nota guardada y publicada." : "Borrador guardado.");
    onGuardada();
  }

  const preview: NotaNodos = {
    id: n.id ?? "preview",
    created_at: "",
    publicada_el: null,
    ...n,
    titulo: n.titulo.trim() || "Título de la nota",
    resumen: n.resumen.trim() || "Resumen de la nota.",
    link: urlSegura(n.link),
  };

  return (
    <form onSubmit={guardar} className="card mb-6 animate-slide-up">
      <div className="mb-4 flex items-center justify-between">
        <h2>{n.id ? "Editar nota" : "Nueva nota"}</h2>
        <button type="button" onClick={onCerrar} className="text-carbon/50 hover:text-carbon" aria-label="Cerrar">
          <X size={18} />
        </button>
      </div>
      <p className="mb-4 flex gap-2 rounded-md bg-marfil/70 p-3 text-xs text-carbon/70">
        <AlertTriangle size={14} className="mt-0.5 shrink-0 text-cobre" />
        Las notas las ven todos los clientes del segmento elegido. No incluyas datos de clientes, y citá solo normativa verificada (número y fecha
        de la resolución tal como figura en la fuente oficial).
      </p>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="field-label" htmlFor="nota-titulo">
              Título<span className="required-mark">*</span>
            </label>
            <input id="nota-titulo" className="input" maxLength={200} value={n.titulo} onChange={(e) => set("titulo", e.target.value)} autoFocus />
          </div>
          <div className="sm:col-span-2">
            <label className="field-label" htmlFor="nota-resumen">
              Resumen<span className="required-mark">*</span>
            </label>
            <textarea id="nota-resumen" className="input" rows={3} maxLength={600} value={n.resumen} onChange={(e) => set("resumen", e.target.value)} />
            <p className="mt-1 text-right text-[11px] text-carbon/45">{n.resumen.length}/600</p>
          </div>
          <div className="sm:col-span-2">
            <label className="field-label" htmlFor="nota-cuerpo">
              Desarrollo (opcional, se ve con “Leer más”)
            </label>
            <textarea id="nota-cuerpo" className="input" rows={4} maxLength={8000} value={n.cuerpo ?? ""} onChange={(e) => set("cuerpo", e.target.value)} />
          </div>
          <div>
            <label className="field-label" htmlFor="nota-link">
              Link a la fuente
            </label>
            <input id="nota-link" className="input" placeholder="https://" value={n.link ?? ""} onChange={(e) => set("link", e.target.value)} />
          </div>
          <div>
            <label className="field-label" htmlFor="nota-organismo">
              Organismo
            </label>
            <select id="nota-organismo" className="input" value={n.organismo ?? ""} onChange={(e) => set("organismo", e.target.value || null)}>
              <option value="">Ninguno</option>
              {TEMAS_NORMATIVA.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
          <fieldset className="sm:col-span-2">
            <legend className="field-label">Rubros (vacío = todos)</legend>
            <div className="flex flex-wrap gap-1.5">
              {RUBROS.map((r: Rubro) => (
                <button key={r} type="button" aria-pressed={n.rubros.includes(r)} className={pill(n.rubros.includes(r))} onClick={() => set("rubros", toggle(n.rubros, r))}>
                  {RUBRO_LABEL[r]}
                </button>
              ))}
            </div>
          </fieldset>
          <fieldset className="sm:col-span-2">
            <legend className="field-label">Sujetos obligados SEPRELAD (vacío = todos)</legend>
            <div className="flex flex-wrap gap-1.5">
              {SECTOR_IDS.map((s) => (
                <button
                  key={s}
                  type="button"
                  aria-pressed={n.sectores_seprelad.includes(s)}
                  className={pill(n.sectores_seprelad.includes(s))}
                  onClick={() => set("sectores_seprelad", toggle(n.sectores_seprelad, s))}
                >
                  {SECTORES[s].label}
                </button>
              ))}
            </div>
            <p className="mt-1 text-[11px] text-carbon/50">
              Si elegís rubros o sectores, la nota la ven solo las cuentas con alguna empresa que coincida (en cualquiera de los dos).
            </p>
          </fieldset>
          <div className="flex flex-wrap gap-4 sm:col-span-2">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={n.destacada} onChange={(e) => set("destacada", e.target.checked)} /> Destacada (arriba de todo)
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={n.publicada} onChange={(e) => set("publicada", e.target.checked)} /> Publicada
            </label>
          </div>
        </div>
        <div>
          <p className="field-label">Vista previa</p>
          <NotaPreview nota={preview} />
          <p className="mt-2 text-[11px] leading-snug text-carbon/50">{DISCLAIMER_NOVEDADES}</p>
        </div>
      </div>
      {error && <p className="mt-3 text-sm text-bad">{error}</p>}
      <div className="mt-4 flex flex-wrap gap-2">
        <button type="submit" className="btn btn-primary" disabled={guardando}>
          {guardando ? "Guardando..." : n.publicada ? "Guardar y publicar" : "Guardar borrador"}
        </button>
        <button type="button" className="btn btn-ghost" onClick={onCerrar}>
          Cancelar
        </button>
      </div>
    </form>
  );
}

function segmento(n: NotaNodos): string {
  const partes = [...n.rubros.map((r) => RUBRO_LABEL[r] ?? r), ...n.sectores_seprelad.map((s) => `SEPRELAD ${SECTORES[s]?.label ?? s}`)];
  return partes.length ? partes.join(" · ") : "Todos los clientes";
}

export default function NotasPage() {
  const { showToast } = useToast();
  const { data, loading, error, reload } = useNotasNodos(true);
  const [editando, setEditando] = useState<Borrador | null>(null);

  async function publicar(n: NotaNodos, publicada: boolean) {
    const { error } = await supabase.from("notas_nodos").update({ publicada }).eq("id", n.id);
    if (error) return showToast(`No se pudo actualizar: ${error.message}`, "error");
    showToast(publicada ? "Nota publicada." : "Nota despublicada.");
    reload();
  }

  async function eliminar(n: NotaNodos) {
    if (!confirm(`¿Eliminar la nota “${n.titulo}”? No se puede deshacer.`)) return;
    const { error } = await supabase.from("notas_nodos").delete().eq("id", n.id);
    if (error) return showToast(`No se pudo eliminar: ${error.message}`, "error");
    showToast("Nota eliminada.");
    reload();
  }

  if (migracionPendiente(error) || /notas_nodos/i.test(error ?? "")) {
    return (
      <div className="card flex gap-3 text-sm">
        <AlertTriangle size={18} className="shrink-0 text-cobre" />
        <p>
          Falta correr la migración <code>008_novedades.sql</code> en Supabase.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl">Notas NODOS</h1>
          <p className="mt-1 text-sm text-carbon/60">Lo que ven tus clientes en “Novedades para tus empresas”, pestaña Notas NODOS.</p>
        </div>
        {!editando && (
          <button type="button" className="btn btn-primary" onClick={() => setEditando({ ...NUEVA })}>
            <Plus size={15} /> Nueva nota
          </button>
        )}
      </div>

      {editando && (
        <Editor
          key={editando.id ?? "nueva"}
          inicial={editando}
          onCerrar={() => setEditando(null)}
          onGuardada={() => {
            setEditando(null);
            reload();
          }}
        />
      )}

      {error && <p className="mb-4 text-sm text-bad">Error cargando notas: {error}</p>}

      {loading ? (
        <SkeletonBlock className="h-40 w-full" />
      ) : data.length === 0 ? (
        <div className="card text-center text-sm text-carbon/65">Todavía no hay notas. Creá la primera con “Nueva nota”.</div>
      ) : (
        <ul className="space-y-3">
          {data.map((n) => (
            <li key={n.id} className="card !p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 text-[11px]">
                    <span
                      className={`rounded-full px-2 py-0.5 font-semibold uppercase tracking-wider ${n.publicada ? "bg-musgo text-marfil" : "bg-marfil text-carbon/60"}`}
                    >
                      {n.publicada ? "Publicada" : "Borrador"}
                    </span>
                    {n.destacada && (
                      <span className="inline-flex items-center gap-1 font-semibold text-cobre-hover">
                        <Star size={11} className="fill-current" /> Destacada
                      </span>
                    )}
                    {n.organismo && <span className="font-semibold uppercase tracking-wider text-cobre-hover">{temaPorId(n.organismo)?.label ?? n.organismo}</span>}
                    <span className="text-carbon/50">{n.publicada_el ? `Publicada el ${formatFecha(n.publicada_el.slice(0, 10))}` : `Creada el ${formatFecha(n.created_at.slice(0, 10))}`}</span>
                  </div>
                  <p className="mt-1 font-display text-base font-semibold leading-snug text-musgo [overflow-wrap:anywhere]">{n.titulo}</p>
                  <p className="mt-0.5 line-clamp-2 text-sm text-carbon/70">{n.resumen}</p>
                  <p className="mt-1 text-xs text-carbon/55">Para: {segmento(n)}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button type="button" className="btn btn-ghost !py-1.5 text-sm" onClick={() => setEditando({ ...n })}>
                    <Pencil size={14} /> Editar
                  </button>
                  <button type="button" className="btn btn-ghost !py-1.5 text-sm" onClick={() => publicar(n, !n.publicada)}>
                    {n.publicada ? <EyeOff size={14} /> : <Eye size={14} />} {n.publicada ? "Despublicar" : "Publicar"}
                  </button>
                  <button type="button" className="btn btn-ghost !py-1.5 text-sm text-bad" onClick={() => eliminar(n)} aria-label={`Eliminar ${n.titulo}`}>
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
