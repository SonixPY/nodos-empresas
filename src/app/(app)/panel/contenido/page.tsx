"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ChevronLeft, ChevronRight, Plus, Trash2, X } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { addDays, MESES, todayIso } from "@/lib/dates";
import { useToast } from "@/components/ToastProvider";
import { SkeletonBlock } from "@/components/Skeleton";
import {
  ESTADOS_CONTENIDO,
  ESTADO_LABEL,
  PILARES,
  PILAR_COLOR,
  PILAR_LABEL,
  REDES,
  migracionPendiente,
  type Contenido,
  type EstadoContenido,
  type Pilar,
} from "@/lib/panel";

const DIAS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const REDES_POR_PILAR: Record<Pilar, string[]> = {
  "zona-gris": ["youtube", "spotify"],
  decodificado: ["youtube", "tiktok", "instagram"],
  "bajo-lupa": ["youtube", "tiktok", "instagram"],
  otro: ["instagram"],
};

function iso(y: number, m: number, d: number) {
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function Editor({ item, episodios, onSave, onDelete, onClose }: {
  item: Partial<Contenido>;
  episodios: Contenido[];
  onSave: (c: Partial<Contenido>, cortes: boolean) => Promise<void>;
  onDelete?: () => void;
  onClose: () => void;
}) {
  const [c, setC] = useState<Partial<Contenido>>(item);
  const [cortes, setCortes] = useState(!item.id && item.pilar === "zona-gris");
  const [saving, setSaving] = useState(false);
  const set = <K extends keyof Contenido>(k: K, v: Contenido[K]) => setC((p) => ({ ...p, [k]: v }));
  const redes = c.redes ?? [];

  return (
    <div className="card mb-6">
      <div className="mb-4 flex items-center justify-between">
        <h2>{item.id ? "Editar pieza" : "Nueva pieza"}</h2>
        <button type="button" onClick={onClose} className="text-carbon/50 hover:text-carbon" aria-label="Cerrar">
          <X size={18} />
        </button>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="sm:col-span-2">
          <label className="field-label">
            Título<span className="required-mark">*</span>
          </label>
          <input className="input" value={c.titulo ?? ""} onChange={(e) => set("titulo", e.target.value)} autoFocus />
        </div>
        <div>
          <label className="field-label">Pilar</label>
          <select
            className="input"
            value={c.pilar}
            onChange={(e) => {
              const p = e.target.value as Pilar;
              setC((prev) => ({ ...prev, pilar: p, redes: prev.id ? prev.redes : REDES_POR_PILAR[p] }));
              if (!item.id) setCortes(p === "zona-gris");
            }}
          >
            {PILARES.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="field-label">Fecha de publicación</label>
          <input className="input" type="date" value={c.fecha ?? ""} onChange={(e) => set("fecha", e.target.value || null)} />
        </div>
        <div>
          <label className="field-label">Estado</label>
          <select className="input" value={c.estado} onChange={(e) => set("estado", e.target.value as EstadoContenido)}>
            {ESTADOS_CONTENIDO.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
        {c.pilar !== "zona-gris" && (
          <div>
            <label className="field-label">Sale del episodio</label>
            <select className="input" value={c.episodio_id ?? ""} onChange={(e) => set("episodio_id", e.target.value || null)}>
              <option value="">Ninguno</option>
              {episodios.map((ep) => (
                <option key={ep.id} value={ep.id}>
                  {ep.titulo}
                </option>
              ))}
            </select>
          </div>
        )}
        <div className="sm:col-span-2">
          <label className="field-label">Link publicado</label>
          <input
            className="input"
            placeholder="https://..."
            value={c.links?.principal ?? ""}
            onChange={(e) => set("links", { ...(c.links ?? {}), principal: e.target.value })}
          />
        </div>
        <div className="sm:col-span-2 lg:col-span-4">
          <label className="field-label">Redes</label>
          <div className="flex flex-wrap gap-1.5">
            {REDES.map((r) => {
              const on = redes.includes(r.id);
              return (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => set("redes", on ? redes.filter((x) => x !== r.id) : [...redes, r.id])}
                  className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                    on ? "border-musgo bg-musgo text-marfil" : "border-[var(--line)] text-carbon/70 hover:border-cobre"
                  }`}
                >
                  {r.label}
                </button>
              );
            })}
          </div>
        </div>
        <div className="sm:col-span-2 lg:col-span-4">
          <label className="field-label">Notas y guion</label>
          <textarea className="input" rows={3} value={c.notas ?? ""} onChange={(e) => set("notas", e.target.value)} />
        </div>
      </div>
      {!item.id && c.pilar === "zona-gris" && (
        <label className="mt-4 flex items-center gap-2 text-sm">
          <input type="checkbox" checked={cortes} onChange={(e) => setCortes(e.target.checked)} />
          Crear también los cortes: 2 Decodificado y 2 Bajo Lupa, repartidos en las 2 semanas siguientes
        </label>
      )}
      <p className="t-caption mt-3 text-carbon/50">
        Recordá el disclaimer en todo contenido de finanzas, inversión o cripto: &quot;Contenido educativo. No constituye asesoría de inversión ni asesoría legal personalizada.&quot;
      </p>
      <div className="mt-4 flex gap-2">
        <button
          type="button"
          className="btn btn-primary"
          disabled={saving || !c.titulo?.trim()}
          onClick={async () => {
            setSaving(true);
            await onSave(c, cortes);
            setSaving(false);
          }}
        >
          {saving ? "Guardando..." : "Guardar"}
        </button>
        {onDelete && (
          <button type="button" className="btn btn-ghost text-bad" onClick={onDelete}>
            <Trash2 size={15} /> Eliminar
          </button>
        )}
      </div>
    </div>
  );
}

export default function ContenidoPage() {
  const { showToast } = useToast();
  const [items, setItems] = useState<Contenido[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const hoy = todayIso();
  const [mes, setMes] = useState(() => {
    const d = new Date();
    return { y: d.getFullYear(), m: d.getMonth() };
  });
  const [editando, setEditando] = useState<Partial<Contenido> | null>(null);

  useEffect(() => {
    supabase
      .from("contenido")
      .select("*")
      .order("fecha", { ascending: true })
      .then(({ data, error: err }) => {
        if (err) setError(err.message);
        setItems((data as Contenido[]) ?? []);
      });
  }, []);

  const episodios = useMemo(() => (items ?? []).filter((c) => c.pilar === "zona-gris"), [items]);

  const celdas = useMemo(() => {
    const primero = new Date(mes.y, mes.m, 1);
    const offset = (primero.getDay() + 6) % 7; // lunes = 0
    const dias = new Date(mes.y, mes.m + 1, 0).getDate();
    const out: (string | null)[] = Array(offset).fill(null);
    for (let d = 1; d <= dias; d++) out.push(iso(mes.y, mes.m, d));
    while (out.length % 7) out.push(null);
    return out;
  }, [mes]);

  const porDia = useMemo(() => {
    const m = new Map<string, Contenido[]>();
    for (const c of items ?? []) if (c.fecha) m.set(c.fecha, [...(m.get(c.fecha) ?? []), c]);
    return m;
  }, [items]);

  const sinFecha = (items ?? []).filter((c) => !c.fecha);

  async function guardar(c: Partial<Contenido>, conCortes: boolean) {
    const fila = {
      titulo: c.titulo!.trim(),
      pilar: c.pilar,
      estado: c.estado,
      fecha: c.fecha || null,
      redes: c.redes ?? [],
      links: c.links ?? {},
      notas: c.notas?.trim() || null,
      episodio_id: c.pilar === "zona-gris" ? null : c.episodio_id || null,
    };
    const q = c.id ? supabase.from("contenido").update(fila).eq("id", c.id) : supabase.from("contenido").insert(fila);
    const { data, error: err } = await q.select().single();
    if (err) return showToast(`No se pudo guardar: ${err.message}`, "error");
    let nuevos: Contenido[] = [];
    if (!c.id && conCortes) {
      const base = fila.fecha ?? hoy;
      const cortes = [
        { pilar: "decodificado", dias: 3, n: 1 },
        { pilar: "bajo-lupa", dias: 6, n: 1 },
        { pilar: "decodificado", dias: 10, n: 2 },
        { pilar: "bajo-lupa", dias: 13, n: 2 },
      ].map((x) => ({
        titulo: `${PILAR_LABEL[x.pilar as Pilar]} ${x.n} · ${fila.titulo}`,
        pilar: x.pilar,
        estado: "idea",
        fecha: addDays(base, x.dias),
        redes: REDES_POR_PILAR[x.pilar as Pilar],
        episodio_id: data.id,
      }));
      const r = await supabase.from("contenido").insert(cortes).select();
      nuevos = (r.data as Contenido[]) ?? [];
    }
    setItems((prev) => {
      const sin = (prev ?? []).filter((x) => x.id !== data.id);
      return [...sin, data as Contenido, ...nuevos].sort((a, b) => (a.fecha ?? "9999").localeCompare(b.fecha ?? "9999"));
    });
    setEditando(null);
    showToast(nuevos.length ? `Guardado, con ${nuevos.length} cortes.` : "Guardado.");
  }

  async function eliminar(c: Partial<Contenido>) {
    if (!c.id || !confirm(`¿Eliminar "${c.titulo}"?`)) return;
    const { error: err } = await supabase.from("contenido").delete().eq("id", c.id);
    if (err) return showToast(`No se pudo eliminar: ${err.message}`, "error");
    setItems((prev) => (prev ?? []).filter((x) => x.id !== c.id));
    setEditando(null);
  }

  async function avanzar(c: Contenido) {
    const i = ESTADOS_CONTENIDO.findIndex((s) => s.id === c.estado);
    const sig = ESTADOS_CONTENIDO[Math.min(i + 1, ESTADOS_CONTENIDO.length - 1)].id;
    setItems((prev) => (prev ?? []).map((x) => (x.id === c.id ? { ...x, estado: sig } : x)));
    await supabase.from("contenido").update({ estado: sig }).eq("id", c.id);
  }

  if (migracionPendiente(error)) {
    return (
      <div className="card flex gap-3 text-sm">
        <AlertTriangle size={18} className="shrink-0 text-cobre" />
        <p>
          Falta correr la migración <code>003_panel.sql</code> en Supabase.
        </p>
      </div>
    );
  }

  return (
    <>
      <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1>Contenido</h1>
          <p className="mt-1 text-carbon/65">Una grabación al mes de Zona Gris y sus cortes, mes a mes.</p>
        </div>
        {!editando && (
          <div className="flex gap-2">
            <button type="button" className="btn btn-ghost" onClick={() => setEditando({ pilar: "decodificado", estado: "idea", redes: REDES_POR_PILAR.decodificado })}>
              <Plus size={15} /> Short
            </button>
            <button type="button" className="btn btn-primary" onClick={() => setEditando({ pilar: "zona-gris", estado: "idea", redes: REDES_POR_PILAR["zona-gris"] })}>
              <Plus size={15} /> Episodio Zona Gris
            </button>
          </div>
        )}
      </header>

      {editando && (
        <Editor
          key={editando.id ?? "nuevo"}
          item={editando}
          episodios={episodios}
          onSave={guardar}
          onDelete={editando.id ? () => eliminar(editando) : undefined}
          onClose={() => setEditando(null)}
        />
      )}

      {items === null ? (
        <SkeletonBlock className="h-96" />
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_280px]">
          <section className="card">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="capitalize">
                {MESES[mes.m]} {mes.y}
              </h2>
              <div className="flex gap-1">
                <button type="button" className="btn btn-ghost px-2 py-1" aria-label="Mes anterior" onClick={() => setMes((p) => (p.m === 0 ? { y: p.y - 1, m: 11 } : { y: p.y, m: p.m - 1 }))}>
                  <ChevronLeft size={16} />
                </button>
                <button type="button" className="btn btn-ghost px-2 py-1" aria-label="Mes siguiente" onClick={() => setMes((p) => (p.m === 11 ? { y: p.y + 1, m: 0 } : { y: p.y, m: p.m + 1 }))}>
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
            <div className="grid grid-cols-7 gap-px overflow-hidden rounded-md border border-[var(--line)] bg-[var(--line)] text-xs">
              {DIAS.map((d) => (
                <div key={d} className="bg-marfil px-2 py-1 font-semibold text-carbon/55">
                  {d}
                </div>
              ))}
              {celdas.map((dia, i) => (
                <div key={i} className={`min-h-[84px] bg-white p-1 ${dia === hoy ? "ring-2 ring-inset ring-cobre" : ""}`}>
                  {dia && (
                    <>
                      <p className="mb-0.5 text-[11px] text-carbon/45">{Number(dia.slice(8))}</p>
                      {(porDia.get(dia) ?? []).map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => setEditando(c)}
                          title={`${PILAR_LABEL[c.pilar]} · ${ESTADO_LABEL[c.estado]}`}
                          className={`mb-0.5 block w-full truncate rounded px-1 py-0.5 text-left text-[11px] text-marfil ${c.estado === "publicado" ? "opacity-60" : ""}`}
                          style={{ background: PILAR_COLOR[c.pilar] }}
                        >
                          {c.estado === "publicado" ? "✓ " : ""}
                          {c.titulo}
                        </button>
                      ))}
                    </>
                  )}
                </div>
              ))}
            </div>
            <div className="mt-3 flex flex-wrap gap-3 text-xs text-carbon/60">
              {PILARES.map((p) => (
                <span key={p.id} className="flex items-center gap-1.5">
                  <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: p.color }} /> {p.label}
                </span>
              ))}
            </div>
          </section>

          <aside className="space-y-4">
            <div className="card">
              <h3 className="mb-2">En producción</h3>
              <ul className="space-y-2">
                {(items ?? [])
                  .filter((c) => c.estado !== "publicado" && c.estado !== "idea")
                  .slice(0, 8)
                  .map((c) => (
                    <li key={c.id} className="flex items-center justify-between gap-2 text-sm">
                      <button type="button" className="min-w-0 truncate text-left hover:text-cobre-hover" onClick={() => setEditando(c)}>
                        {c.titulo}
                      </button>
                      <button type="button" className="shrink-0 rounded-full border border-[var(--line)] px-2 py-0.5 text-[11px] hover:border-cobre" onClick={() => avanzar(c)} title="Pasar al siguiente estado">
                        {ESTADO_LABEL[c.estado]} →
                      </button>
                    </li>
                  ))}
                {(items ?? []).filter((c) => c.estado !== "publicado" && c.estado !== "idea").length === 0 && (
                  <li className="text-sm text-carbon/55">Nada en producción.</li>
                )}
              </ul>
            </div>
            <div className="card">
              <h3 className="mb-2">Ideas sin fecha</h3>
              <ul className="space-y-1.5">
                {sinFecha.map((c) => (
                  <li key={c.id}>
                    <button type="button" className="text-left text-sm hover:text-cobre-hover" onClick={() => setEditando(c)}>
                      <span className="mr-1.5 inline-block h-2 w-2 rounded-full" style={{ background: PILAR_COLOR[c.pilar] }} />
                      {c.titulo}
                    </button>
                  </li>
                ))}
                {sinFecha.length === 0 && <li className="text-sm text-carbon/55">Sin ideas pendientes.</li>}
              </ul>
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
