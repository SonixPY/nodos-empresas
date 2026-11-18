"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowDown, ArrowUp, ExternalLink, Info, Loader2, Pencil, Plus, Save, Trash2, X } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { useToast } from "@/components/ToastProvider";
import { mensajeError } from "@/lib/nodos/errores";
import { LIMITES, limpiarSerie, publicados, SERIE_NUEVA, validarSerie, type Episodio, type Serie } from "@/lib/series";

const SITIO = "https://nodoscompliance.com/#series";
const fecha = (iso?: string) => (iso ? new Date(iso).toLocaleDateString("es-PY", { day: "2-digit", month: "2-digit", year: "numeric" }) : "");

function Campo({ label, ayuda, children }: { label: string; ayuda?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="field-label">{label}</span>
      {children}
      {ayuda && <span className="mt-1 block text-xs text-carbon/55">{ayuda}</span>}
    </label>
  );
}

function Editor({
  inicial,
  numerosUsados,
  onCerrar,
  onGuardada,
}: {
  inicial: Serie;
  numerosUsados: number[];
  onCerrar: () => void;
  onGuardada: () => void;
}) {
  const { showToast } = useToast();
  const [s, setS] = useState<Serie>(inicial);
  const [guardando, setGuardando] = useState(false);
  const [intento, setIntento] = useState(false);
  const nueva = !inicial.id;
  const limpia = limpiarSerie(s as Serie & Record<string, unknown>);
  const errores = validarSerie(limpia, numerosUsados);

  const ep = (i: number, cambio: Partial<Episodio>) => setS({ ...s, episodios: s.episodios.map((e, j) => (j === i ? { ...e, ...cambio } : e)) });
  const mover = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= s.episodios.length) return;
    const lista = [...s.episodios];
    [lista[i], lista[j]] = [lista[j], lista[i]];
    setS({ ...s, episodios: lista });
  };

  async function guardar() {
    setIntento(true);
    if (errores.length) return showToast("Revisá los datos marcados antes de guardar.", "error");
    setGuardando(true);
    const fila = {
      numero: limpia.numero,
      titulo: limpia.titulo,
      descripcion: limpia.descripcion,
      duracion: limpia.duracion,
      url: limpia.url || null,
      episodios: limpia.episodios,
      estado: limpia.estado,
    };
    const { error } = nueva ? await supabase.from("series").insert(fila) : await supabase.from("series").update(fila).eq("id", inicial.id!);
    setGuardando(false);
    if (error) return showToast(`No se pudo guardar: ${mensajeError(error)}`, "error");
    showToast(limpia.estado === "publicado" ? "Serie guardada. En el sitio se ve en un minuto." : "Serie guardada como borrador.");
    onGuardada();
  }

  return (
    <section className="card space-y-5 p-5" aria-label="Editar serie">
      <div className="flex items-start justify-between gap-3">
        <h2>{nueva ? "Nueva serie" : `Editar “${inicial.titulo}”`}</h2>
        <button type="button" className="btn btn-ghost !px-3" onClick={onCerrar} aria-label="Cerrar el editor">
          <X size={16} />
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-[110px_1fr_160px_160px]">
        <Campo label="N.º">
          <input className="input" type="number" min={1} max={999} value={s.numero || ""} onChange={(e) => setS({ ...s, numero: Number(e.target.value) })} />
        </Campo>
        <Campo label="Título">
          <input className="input" maxLength={LIMITES.titulo} value={s.titulo} onChange={(e) => setS({ ...s, titulo: e.target.value })} />
        </Campo>
        <Campo label="Duración por episodio">
          <input className="input" maxLength={LIMITES.duracion} value={s.duracion} onChange={(e) => setS({ ...s, duracion: e.target.value })} />
        </Campo>
        <Campo label="Estado">
          <select className="input" value={s.estado} onChange={(e) => setS({ ...s, estado: e.target.value as Serie["estado"] })}>
            <option value="borrador">Borrador (no se ve)</option>
            <option value="publicado">Publicada</option>
          </select>
        </Campo>
      </div>
      <Campo label="Descripción" ayuda={`${s.descripcion.length}/${LIMITES.descripcion}`}>
        <textarea className="input min-h-20" maxLength={LIMITES.descripcion} value={s.descripcion} onChange={(e) => setS({ ...s, descripcion: e.target.value })} />
      </Campo>
      <Campo label="Link de la serie" ayuda="La lista de reproducción de YouTube (o el canal mientras no exista). Es el botón “Ver la serie en YouTube”.">
        <input className="input" inputMode="url" placeholder="https://www.youtube.com/playlist?list=…" value={s.url} onChange={(e) => setS({ ...s, url: e.target.value })} />
      </Campo>

      <div>
        <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="text-base">
            Episodios <span className="text-sm font-normal text-carbon/55">· {publicados(limpia)} de {s.episodios.length} con link</span>
          </h3>
          <p className="text-xs text-carbon/55">Sin link, el episodio aparece como “Próximamente”.</p>
        </div>
        <ol className="space-y-2">
          {s.episodios.map((e, i) => (
            <li key={i} className="grid items-end gap-2 rounded-md border border-bosque/15 p-3 sm:grid-cols-[48px_1fr_1.2fr_auto]">
              <span className="pb-2 font-display text-sm font-semibold text-cobre-hover">Ep. {i + 1}</span>
              <Campo label="Título">
                <input className="input" maxLength={LIMITES.tituloEpisodio} value={e.titulo} placeholder="Próximamente" onChange={(x) => ep(i, { titulo: x.target.value })} />
              </Campo>
              <Campo label="Link del video">
                <input className="input" inputMode="url" placeholder="https://youtu.be/…" value={e.url} onChange={(x) => ep(i, { url: x.target.value })} />
              </Campo>
              <div className="flex gap-1">
                <button type="button" className="btn btn-ghost !px-2.5" onClick={() => mover(i, -1)} disabled={i === 0} aria-label={`Subir el episodio ${i + 1}`}>
                  <ArrowUp size={15} />
                </button>
                <button type="button" className="btn btn-ghost !px-2.5" onClick={() => mover(i, 1)} disabled={i === s.episodios.length - 1} aria-label={`Bajar el episodio ${i + 1}`}>
                  <ArrowDown size={15} />
                </button>
                <button type="button" className="btn btn-ghost !px-2.5" onClick={() => setS({ ...s, episodios: s.episodios.filter((_, j) => j !== i) })} aria-label={`Quitar el episodio ${i + 1}`}>
                  <Trash2 size={15} />
                </button>
              </div>
            </li>
          ))}
        </ol>
        <button
          type="button"
          className="btn btn-ghost mt-2"
          disabled={s.episodios.length >= LIMITES.episodios}
          onClick={() => setS({ ...s, episodios: [...s.episodios, { titulo: "", url: "" }] })}
        >
          <Plus size={15} /> Agregar episodio
        </button>
      </div>

      {intento && errores.length > 0 && (
        <ul className="space-y-1 rounded-md bg-bad/10 p-3 text-sm text-bad" role="alert">
          {errores.map((x) => (
            <li key={x}>{x}</li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap justify-end gap-2 border-t border-bosque/10 pt-4">
        <button type="button" className="btn btn-ghost" onClick={onCerrar}>
          Cancelar
        </button>
        <button type="button" className="btn btn-primary" onClick={guardar} disabled={guardando}>
          {guardando ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} Guardar
        </button>
      </div>
    </section>
  );
}

export default function SeriesAdmin() {
  const { showToast } = useToast();
  const [series, setSeries] = useState<Serie[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editando, setEditando] = useState<Serie | null>(null);

  const cargar = useCallback(async () => {
    const { data, error: err } = await supabase.from("series").select("*").order("numero");
    if (err) {
      setError(
        /relation|does not exist|schema cache/i.test(err.message)
          ? "Falta correr el SQL 016_series en Supabase."
          : `No se pudieron cargar las series: ${mensajeError(err)}`,
      );
      setSeries([]);
      return;
    }
    setError(null);
    setSeries((data ?? []).map((f) => limpiarSerie(f)));
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial desde Supabase
    void cargar();
  }, [cargar]);

  async function borrar(s: Serie) {
    if (!window.confirm(`¿Borrar la serie “${s.titulo}”? Desaparece del sitio y no se puede deshacer.`)) return;
    const { error: err } = await supabase.from("series").delete().eq("id", s.id!);
    if (err) return showToast(mensajeError(err), "error");
    showToast("Serie borrada.");
    void cargar();
  }

  const siguiente = Math.max(0, ...(series ?? []).map((s) => s.numero)) + 1;

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1>Series</h1>
          <p className="mt-1 max-w-2xl text-sm text-carbon/60">
            Las series de videos de la página principal. Cargá el título y el link de cada episodio a medida que lo subas: el sitio se actualiza solo en
            alrededor de un minuto.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a className="btn btn-ghost" href={SITIO} target="_blank" rel="noopener noreferrer">
            <ExternalLink size={15} /> Ver en el sitio
          </a>
          <button type="button" className="btn btn-primary" onClick={() => setEditando({ ...structuredClone(SERIE_NUEVA), numero: siguiente })}>
            <Plus size={15} /> Nueva serie
          </button>
        </div>
      </header>

      <p className="flex gap-2 rounded-md bg-marfil/70 p-3 text-xs text-carbon/70">
        <Info size={14} className="mt-0.5 shrink-0 text-cobre" />
        El sitio muestra solo las series publicadas y agrega siempre el aviso de contenido educativo (no es asesoría de inversión ni asesoramiento legal
        para tu caso).
      </p>
      {error && <p className="text-sm text-bad">{error}</p>}

      {editando && (
        <Editor
          key={editando.id ?? "nueva"}
          inicial={editando}
          numerosUsados={(series ?? []).filter((x) => x.id !== editando.id).map((x) => x.numero)}
          onCerrar={() => setEditando(null)}
          onGuardada={() => {
            setEditando(null);
            void cargar();
          }}
        />
      )}

      {series === null ? (
        <p className="flex items-center gap-2 text-sm text-carbon/60">
          <Loader2 size={15} className="animate-spin" /> Cargando…
        </p>
      ) : series.length === 0 && !error ? (
        <p className="card p-5 text-sm text-carbon/60">Todavía no hay series. Creá la primera con “Nueva serie”.</p>
      ) : (
        <ul className="grid gap-3">
          {series.map((s) => {
            const pub = publicados(s);
            return (
              <li key={s.id} className="card flex flex-wrap items-center gap-4 p-4">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-musgo font-display text-sm font-semibold text-marfil">
                  {String(s.numero).padStart(2, "0")}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-display font-semibold text-musgo">{s.titulo}</p>
                  <p className="text-xs text-carbon/60">
                    {pub} de {s.episodios.length} episodios con link · {s.duracion}
                    {s.updated_at ? ` · actualizada el ${fecha(s.updated_at)}` : ""}
                  </p>
                  <span className="mt-1.5 block h-1.5 w-full max-w-xs overflow-hidden rounded bg-bosque/15">
                    <span className="block h-full bg-cobre" style={{ width: `${s.episodios.length ? Math.round((pub / s.episodios.length) * 100) : 0}%` }} />
                  </span>
                </div>
                <span
                  className={`rounded px-2 py-1 text-xs font-medium ${s.estado === "publicado" ? "bg-bosque/15 text-bosque" : "bg-carbon/10 text-carbon/60"}`}
                >
                  {s.estado === "publicado" ? "Publicada" : "Borrador"}
                </span>
                <div className="flex gap-1">
                  <button type="button" className="btn btn-ghost" onClick={() => setEditando(structuredClone(s))}>
                    <Pencil size={15} /> Editar
                  </button>
                  <button type="button" className="btn btn-ghost !px-3" onClick={() => borrar(s)} aria-label={`Borrar la serie ${s.titulo}`}>
                    <Trash2 size={15} />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
