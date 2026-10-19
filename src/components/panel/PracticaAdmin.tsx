"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowDown, ArrowUp, Loader2, Pencil, Plus, RotateCcw, Save, Search, Trash2, X } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { useToast } from "@/components/ToastProvider";
import { mensajeError } from "@/lib/nodos/errores";
import {
  AVISO_TEXTO,
  MISIONES,
  PERSONAJES,
  RUTAS,
  TARJETAS,
  TIPOS_JUEGO,
  mezclarContenido,
  validarMision,
  validarTarjeta,
  type Aviso,
  type Efectos,
  type FilaContenido,
  type Mazo,
  type Mision,
  type Opcion,
  type PersonajeId,
  type Ruta,
  type Tarjeta,
  type TipoEmpresaJuego,
} from "@/lib/nodos/practica";

type Estado = FilaContenido["estado"];
const ESTADOS: { id: Estado; label: string }[] = [
  { id: "borrador", label: "Borrador" },
  { id: "revisado", label: "Revisado" },
  { id: "publicado", label: "Publicado" },
];
const MAZOS: { id: Mazo; label: string }[] = [
  { id: "plata", label: "Mi plata" },
  { id: "inversiones", label: "Inversiones" },
  { id: "negocio", label: "Negocio" },
  { id: "calendario", label: "Calendario" },
  { id: "cumplimiento", label: "Cumplimiento" },
];
const AVISOS: { id: Aviso; label: string }[] = [
  { id: "inversion", label: "No es asesoría de inversión" },
  { id: "legal", label: "No constituye asesoramiento legal" },
  { id: "ninguno", label: "Sin aviso" },
];
const EFECTOS: { id: keyof Efectos; label: string }[] = [
  { id: "cajaPersonal", label: "Caja personal (Gs.)" },
  { id: "cajaEmpresa", label: "Caja empresa (Gs.)" },
  { id: "inversiones", label: "Inversiones (Gs.)" },
  { id: "cumplimiento", label: "Cumplimiento (pts)" },
  { id: "riesgo", label: "Riesgo (pts)" },
  { id: "dividendo", label: "Dividendo bruto (Gs.)" },
];
const TIPOS = Object.keys(TIPOS_JUEGO) as TipoEmpresaJuego[];
const MESES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
const BUILTIN_T = new Set(TARJETAS.map((t) => t.id));
const BUILTIN_M = new Set(MISIONES.map((m) => m.id));

const pill = (on: boolean) =>
  `rounded-full border px-3 py-1 text-xs font-medium transition ${on ? "border-musgo bg-musgo text-marfil" : "border-[var(--line)] text-carbon/70 hover:border-cobre"}`;

function toggle<T>(lista: T[], v: T): T[] {
  return lista.includes(v) ? lista.filter((x) => x !== v) : [...lista, v];
}

/** Quita los campos vacíos para que lo guardado sea igual a lo que valida el juego. */
function limpiarTarjeta(t: Tarjeta): Tarjeta {
  const c = t.condicion ?? {};
  const condicion = {
    ...(c.tipos?.length ? { tipos: c.tipos } : {}),
    ...(c.meses?.length ? { meses: [...c.meses].sort((a, b) => a - b) } : {}),
    ...(c.sujetoObligado !== undefined ? { sujetoObligado: c.sujetoObligado } : {}),
    ...(c.requiere ? { requiere: c.requiere } : {}),
    ...(c.excluye ? { excluye: c.excluye } : {}),
    ...(c.soloProgramada ? { soloProgramada: true } : {}),
    ...(c.soloMision ? { soloMision: true } : {}),
  };
  const opciones: Opcion[] = t.opciones.map((o) => {
    const efectos: Efectos = {};
    for (const e of EFECTOS) {
      const v = o.efectos[e.id];
      if (typeof v === "number" && Number.isFinite(v) && v !== 0) efectos[e.id] = v;
    }
    return {
      texto: o.texto.trim(),
      explicacion: o.explicacion.trim(),
      efectos,
      ...(o.marca?.length ? { marca: o.marca } : {}),
      ...(o.quita?.length ? { quita: o.quita } : {}),
      ...(o.programa?.length ? { programa: o.programa } : {}),
    };
  });
  return {
    id: t.id.trim(),
    mazo: t.mazo,
    titulo: t.titulo.trim(),
    situacion: t.situacion.trim(),
    opciones,
    base: t.base.trim(),
    aviso: t.aviso,
    ...(Object.keys(condicion).length ? { condicion } : {}),
    ...(t.fija ? { fija: true } : {}),
    ...(t.repetible ? { repetible: true } : {}),
    ...(t.hacelo && t.hacelo.texto.trim() ? { hacelo: { app: t.hacelo.app, ruta: t.hacelo.ruta.trim(), texto: t.hacelo.texto.trim() } } : {}),
  };
}

const TARJETA_NUEVA: Tarjeta = {
  id: "",
  mazo: "negocio",
  titulo: "",
  situacion: "",
  base: "",
  aviso: "legal",
  opciones: [
    { texto: "", explicacion: "", efectos: {} },
    { texto: "", explicacion: "", efectos: {} },
  ],
};

const MISION_NUEVA: Mision = {
  id: "",
  ruta: "ser-empresario",
  orden: 10,
  titulo: "",
  descripcion: "",
  tarjetas: [],
  gratis: false,
  tipo: "unipersonal",
  personaje: "emprendedor",
  sujetoObligado: false,
};

/**
 * Panel → Práctica: editar las tarjetas y misiones de NODOS Práctica sin
 * programar. Lo incluido en la app se puede reemplazar (y restaurar); lo
 * nuevo se suma. Solo lo "Publicado" llega a los usuarios.
 */
export default function PracticaAdmin() {
  const { showToast } = useToast();
  const [filas, setFilas] = useState<FilaContenido[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pestana, setPestana] = useState<"tarjetas" | "misiones">("tarjetas");
  const [busqueda, setBusqueda] = useState("");
  const [editTarjeta, setEditTarjeta] = useState<{ t: Tarjeta; estado: Estado; nueva: boolean } | null>(null);
  const [editMision, setEditMision] = useState<{ m: Mision; estado: Estado; nueva: boolean } | null>(null);

  const cargar = useCallback(async () => {
    const { data, error: err } = await supabase.from("practica_contenido").select("id, tipo, datos, estado").order("id");
    if (err) setError(mensajeError(err));
    else {
      setError(null);
      setFilas((data ?? []) as FilaContenido[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    cargar();
  }, [cargar]);

  const fila = (id: string, tipo: FilaContenido["tipo"]) => filas.find((f) => f.id === id && f.tipo === tipo);
  // Lo que ve hoy un usuario (con lo publicado), para los selectores de tarjetas.
  const enJuego = useMemo(() => mezclarContenido(filas), [filas]);
  const idsTarjetas = useMemo(() => {
    const s = new Set(enJuego.tarjetas.keys());
    for (const f of filas) if (f.tipo === "tarjeta") s.add(f.id);
    return s;
  }, [enJuego, filas]);

  const listaTarjetas = useMemo(() => {
    const ids = new Set<string>([...BUILTIN_T, ...filas.filter((f) => f.tipo === "tarjeta").map((f) => f.id)]);
    const q = busqueda.trim().toLowerCase();
    return Array.from(ids)
      .map((id) => {
        const f = fila(id, "tarjeta");
        const t = (f ? { ...(f.datos as Tarjeta), id } : TARJETAS.find((x) => x.id === id)) as Tarjeta;
        return { id, t, f };
      })
      .filter(({ id, t }) => !q || id.includes(q) || (t?.titulo ?? "").toLowerCase().includes(q))
      .sort((a, b) => (a.t?.mazo ?? "").localeCompare(b.t?.mazo ?? "") || a.id.localeCompare(b.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filas, busqueda]);

  const listaMisiones = useMemo(() => {
    const ids = new Set<string>([...BUILTIN_M, ...filas.filter((f) => f.tipo === "mision").map((f) => f.id)]);
    return Array.from(ids)
      .map((id) => {
        const f = fila(id, "mision");
        const m = (f ? { ...(f.datos as Mision), id } : MISIONES.find((x) => x.id === id)) as Mision;
        return { id, m, f };
      })
      .sort((a, b) => (a.m?.ruta ?? "").localeCompare(b.m?.ruta ?? "") || (a.m?.orden ?? 0) - (b.m?.orden ?? 0));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filas]);

  async function restaurar(id: string, tipo: FilaContenido["tipo"]) {
    const original = tipo === "tarjeta" ? BUILTIN_T.has(id) : BUILTIN_M.has(id);
    if (!window.confirm(original ? "¿Volver a la versión incluida en la app? Se borra la edición." : "¿Borrar este contenido? No se puede deshacer.")) return;
    const { error: err } = await supabase.from("practica_contenido").delete().eq("id", id);
    if (err) return showToast(mensajeError(err), "error");
    showToast(original ? "Restaurada la versión original." : "Borrado.");
    cargar();
  }

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1>NODOS Práctica</h1>
          <p className="mt-1 max-w-2xl text-sm text-carbon/60">
            Tarjetas y misiones del simulador. Editá lo incluido o sumá contenido nuevo: solo lo publicado llega a los usuarios, y si algo no pasa
            la validación no se usa.
          </p>
        </div>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() =>
            pestana === "tarjetas"
              ? setEditTarjeta({ t: structuredClone(TARJETA_NUEVA), estado: "borrador", nueva: true })
              : setEditMision({ m: structuredClone(MISION_NUEVA), estado: "borrador", nueva: true })
          }
        >
          <Plus size={15} /> {pestana === "tarjetas" ? "Nueva tarjeta" : "Nueva misión"}
        </button>
      </header>

      <p className="flex gap-2 rounded-md bg-marfil/70 p-3 text-xs text-carbon/70">
        <AlertTriangle size={14} className="mt-0.5 shrink-0 text-cobre" />
        Todo es ficticio: no uses casos ni datos de clientes. Citá solo normativa verificada (número, año y artículo tal como figuran en la fuente
        oficial).
      </p>

      {error && <p className="text-sm text-bad">{error}</p>}

      {editTarjeta && (
        <EditorTarjeta
          key={editTarjeta.t.id || "nueva"}
          inicial={editTarjeta.t}
          estadoInicial={editTarjeta.estado}
          nueva={editTarjeta.nueva}
          idsExistentes={idsTarjetas}
          onCerrar={() => setEditTarjeta(null)}
          onGuardada={() => {
            setEditTarjeta(null);
            cargar();
          }}
        />
      )}
      {editMision && (
        <EditorMision
          key={editMision.m.id || "nueva"}
          inicial={editMision.m}
          estadoInicial={editMision.estado}
          nueva={editMision.nueva}
          idsTarjetas={idsTarjetas}
          idsExistentes={new Set(listaMisiones.map((x) => x.id))}
          onCerrar={() => setEditMision(null)}
          onGuardada={() => {
            setEditMision(null);
            cargar();
          }}
        />
      )}

      <div className="flex flex-wrap items-center gap-3">
        <div className="segmented" role="tablist" aria-label="Contenido">
          <button type="button" role="tab" aria-selected={pestana === "tarjetas"} className={pestana === "tarjetas" ? "active" : ""} onClick={() => setPestana("tarjetas")}>
            Tarjetas ({listaTarjetas.length})
          </button>
          <button type="button" role="tab" aria-selected={pestana === "misiones"} className={pestana === "misiones" ? "active" : ""} onClick={() => setPestana("misiones")}>
            Misiones ({listaMisiones.length})
          </button>
        </div>
        {pestana === "tarjetas" && (
          <label className="relative min-w-[200px] flex-1 sm:max-w-xs">
            <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-carbon/40" />
            <input className="input pl-8" placeholder="Buscar por id o título" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
          </label>
        )}
      </div>

      {loading ? (
        <p className="text-sm text-carbon/60">Cargando...</p>
      ) : pestana === "tarjetas" ? (
        <ul className="card divide-y divide-[var(--line)] !p-0">
          {listaTarjetas.map(({ id, t, f }) => (
            <li key={id} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-carbon">{t?.titulo ?? id}</p>
                <p className="truncate text-xs text-carbon/50">
                  {id} · {MAZOS.find((m) => m.id === t?.mazo)?.label ?? "Sin mazo"}
                  {t?.fija ? " · calendario" : ""}
                  {t?.condicion?.soloProgramada ? " · consecuencia" : ""}
                </p>
              </div>
              <EstadoChip f={f} incluida={BUILTIN_T.has(id)} />
              <div className="flex gap-1">
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => setEditTarjeta({ t: structuredClone({ ...(t as Tarjeta), id }), estado: f?.estado ?? "borrador", nueva: false })}
                >
                  <Pencil size={14} /> Editar
                </button>
                {f && (
                  <button type="button" className="btn btn-ghost" onClick={() => restaurar(id, "tarjeta")} title={BUILTIN_T.has(id) ? "Volver a la original" : "Borrar"}>
                    {BUILTIN_T.has(id) ? <RotateCcw size={14} /> : <Trash2 size={14} />}
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <ul className="card divide-y divide-[var(--line)] !p-0">
          {listaMisiones.map(({ id, m, f }) => (
            <li key={id} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-carbon">
                  {m?.orden}. {m?.titulo ?? id}
                </p>
                <p className="truncate text-xs text-carbon/50">
                  {RUTAS[m?.ruta as Ruta]?.titulo ?? "Sin ruta"} · {m?.tarjetas?.length ?? 0} tarjetas · {m?.gratis ? "gratis" : "Combo"}
                </p>
              </div>
              <EstadoChip f={f} incluida={BUILTIN_M.has(id)} />
              <div className="flex gap-1">
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => setEditMision({ m: structuredClone({ ...(m as Mision), id }), estado: f?.estado ?? "borrador", nueva: false })}
                >
                  <Pencil size={14} /> Editar
                </button>
                {f && (
                  <button type="button" className="btn btn-ghost" onClick={() => restaurar(id, "mision")} title={BUILTIN_M.has(id) ? "Volver a la original" : "Borrar"}>
                    {BUILTIN_M.has(id) ? <RotateCcw size={14} /> : <Trash2 size={14} />}
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function EstadoChip({ f, incluida }: { f?: FilaContenido; incluida: boolean }) {
  const texto = !f ? "Incluida" : `${incluida ? "Editada" : "Nueva"} · ${ESTADOS.find((e) => e.id === f.estado)?.label}`;
  const color = !f ? "rgba(36,37,34,0.06)" : f.estado === "publicado" ? "rgba(63,107,82,0.14)" : "rgba(184,115,74,0.14)";
  return (
    <span className="shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-medium text-carbon/70" style={{ background: color }}>
      {texto}
    </span>
  );
}

async function guardarFila(id: string, tipo: FilaContenido["tipo"], datos: unknown, estado: Estado) {
  return supabase.from("practica_contenido").upsert({ id, tipo, datos, estado }, { onConflict: "id" });
}

function EditorTarjeta({
  inicial,
  estadoInicial,
  nueva,
  idsExistentes,
  onCerrar,
  onGuardada,
}: {
  inicial: Tarjeta;
  estadoInicial: Estado;
  nueva: boolean;
  idsExistentes: Set<string>;
  onCerrar: () => void;
  onGuardada: () => void;
}) {
  const { showToast } = useToast();
  const [t, setT] = useState<Tarjeta>(inicial);
  const [estado, setEstado] = useState<Estado>(estadoInicial);
  const [guardando, setGuardando] = useState(false);
  const [problemas, setProblemas] = useState<string[]>([]);
  const c = t.condicion ?? {};
  const setC = (patch: Partial<NonNullable<Tarjeta["condicion"]>>) => setT({ ...t, condicion: { ...c, ...patch } });
  const setOpcion = (i: number, patch: Partial<Opcion>) => setT({ ...t, opciones: t.opciones.map((o, j) => (j === i ? { ...o, ...patch } : o)) });

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    const limpia = limpiarTarjeta(t);
    const errores = validarTarjeta(limpia);
    if (nueva && idsExistentes.has(limpia.id)) errores.unshift("Ya existe una tarjeta con ese id.");
    for (const o of limpia.opciones) for (const p of o.programa ?? []) if (!idsExistentes.has(p.tarjeta) && p.tarjeta !== limpia.id) errores.push(`La tarjeta programada "${p.tarjeta}" no existe.`);
    setProblemas(errores);
    if (errores.length) return;
    setGuardando(true);
    const { error } = await guardarFila(limpia.id, "tarjeta", limpia, estado);
    setGuardando(false);
    if (error) return showToast(`No se pudo guardar: ${mensajeError(error)}`, "error");
    showToast(estado === "publicado" ? "Tarjeta publicada." : "Tarjeta guardada.");
    onGuardada();
  }

  return (
    <form onSubmit={guardar} className="card animate-slide-up space-y-5">
      <div className="flex items-center justify-between">
        <h2>{nueva ? "Nueva tarjeta" : `Editar: ${inicial.titulo || inicial.id}`}</h2>
        <button type="button" onClick={onCerrar} className="text-carbon/50 hover:text-carbon" aria-label="Cerrar">
          <X size={18} />
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Campo label="Id" ayuda="minúsculas, números y guiones">
          <input className="input" value={t.id} disabled={!nueva} maxLength={60} onChange={(e) => setT({ ...t, id: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "") })} />
        </Campo>
        <Campo label="Mazo">
          <select className="input" value={t.mazo} onChange={(e) => setT({ ...t, mazo: e.target.value as Mazo })}>
            {MAZOS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
        </Campo>
        <Campo label="Aviso">
          <select className="input" value={t.aviso} onChange={(e) => setT({ ...t, aviso: e.target.value as Aviso })}>
            {AVISOS.map((a) => (
              <option key={a.id} value={a.id}>
                {a.label}
              </option>
            ))}
          </select>
        </Campo>
        <Campo label="Estado">
          <select className="input" value={estado} onChange={(e) => setEstado(e.target.value as Estado)}>
            {ESTADOS.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </Campo>
        <div className="sm:col-span-2 lg:col-span-4">
          <Campo label="Título">
            <input className="input" maxLength={80} value={t.titulo} onChange={(e) => setT({ ...t, titulo: e.target.value })} />
          </Campo>
        </div>
        <div className="sm:col-span-2 lg:col-span-4">
          <Campo label="Situación" ayuda="Lo que le pasa al jugador, en dos o tres líneas">
            <textarea className="input" rows={2} maxLength={400} value={t.situacion} onChange={(e) => setT({ ...t, situacion: e.target.value })} />
          </Campo>
        </div>
        <div className="sm:col-span-2 lg:col-span-4">
          <Campo label="Base normativa o fuente" ayuda="Solo normas verificadas">
            <input className="input" maxLength={200} value={t.base} onChange={(e) => setT({ ...t, base: e.target.value })} />
          </Campo>
        </div>
      </div>

      <fieldset className="space-y-3">
        <legend className="field-label">Cuándo sale</legend>
        <div className="flex flex-wrap gap-1.5">
          {TIPOS.map((x) => (
            <button key={x} type="button" className={pill(!!c.tipos?.includes(x))} onClick={() => setC({ tipos: toggle(c.tipos ?? [], x) })}>
              {TIPOS_JUEGO[x].corto}
            </button>
          ))}
          <span className="self-center text-xs text-carbon/45">Sin marcar: todos los tipos</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {MESES.map((m, i) => (
            <button key={m} type="button" className={pill(!!c.meses?.includes(i + 1))} onClick={() => setC({ meses: toggle(c.meses ?? [], i + 1) })}>
              {m}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-4 text-sm text-carbon/80">
          <label className="inline-flex items-center gap-2">
            Sujeto obligado
            <select
              className="input !w-auto"
              value={c.sujetoObligado === undefined ? "" : c.sujetoObligado ? "si" : "no"}
              onChange={(e) => setC({ sujetoObligado: e.target.value === "" ? undefined : e.target.value === "si" })}
            >
              <option value="">Indiferente</option>
              <option value="si">Solo si es</option>
              <option value="no">Solo si no es</option>
            </select>
          </label>
          <label className="inline-flex items-center gap-2">
            <input type="checkbox" checked={!!t.fija} onChange={(e) => setT({ ...t, fija: e.target.checked })} /> Fija en esos meses (calendario)
          </label>
          <label className="inline-flex items-center gap-2">
            <input type="checkbox" checked={!!t.repetible} onChange={(e) => setT({ ...t, repetible: e.target.checked })} /> Puede repetirse en el año
          </label>
          <label className="inline-flex items-center gap-2">
            <input type="checkbox" checked={!!c.soloProgramada} onChange={(e) => setC({ soloProgramada: e.target.checked })} /> Solo como consecuencia de otra
          </label>
          <label className="inline-flex items-center gap-2">
            <input type="checkbox" checked={!!c.soloMision} onChange={(e) => setC({ soloMision: e.target.checked })} /> Solo en misiones
          </label>
        </div>
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="field-label">Opciones (de 1 a 3)</legend>
        {t.opciones.map((o, i) => (
          <div key={i} className="space-y-3 rounded-md border p-3" style={{ borderColor: "var(--line)" }}>
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-carbon">Opción {i + 1}</p>
              {t.opciones.length > 1 && (
                <button type="button" className="text-carbon/45 hover:text-bad" aria-label={`Quitar opción ${i + 1}`} onClick={() => setT({ ...t, opciones: t.opciones.filter((_, j) => j !== i) })}>
                  <Trash2 size={14} />
                </button>
              )}
            </div>
            <input className="input" placeholder="Lo que elige el jugador" maxLength={120} value={o.texto} onChange={(e) => setOpcion(i, { texto: e.target.value })} />
            <textarea className="input" rows={2} placeholder="Por qué pasa lo que pasa (se muestra al elegir)" maxLength={400} value={o.explicacion} onChange={(e) => setOpcion(i, { explicacion: e.target.value })} />
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
              {EFECTOS.map((ef) => (
                <label key={ef.id} className="text-[11px] text-carbon/60">
                  {ef.label}
                  <input
                    type="number"
                    className="input mt-0.5"
                    value={o.efectos[ef.id] ?? ""}
                    onChange={(e) => setOpcion(i, { efectos: { ...o.efectos, [ef.id]: e.target.value === "" ? undefined : Number(e.target.value) } })}
                  />
                </label>
              ))}
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <label className="text-[11px] text-carbon/60">
                Deja marcas (separadas por coma)
                <input className="input mt-0.5" value={(o.marca ?? []).join(", ")} onChange={(e) => setOpcion(i, { marca: lista(e.target.value) })} />
              </label>
              <label className="text-[11px] text-carbon/60">
                Quita marcas
                <input className="input mt-0.5" value={(o.quita ?? []).join(", ")} onChange={(e) => setOpcion(i, { quita: lista(e.target.value) })} />
              </label>
              <label className="text-[11px] text-carbon/60">
                Vuelve más adelante (tarjeta:meses, separadas por coma)
                <input
                  className="input mt-0.5"
                  value={(o.programa ?? []).map((p) => `${p.tarjeta}:${p.enMeses}`).join(", ")}
                  onChange={(e) =>
                    setOpcion(i, {
                      programa: lista(e.target.value).map((x) => {
                        const [tarjeta, meses] = x.split(":");
                        return { tarjeta: (tarjeta ?? "").trim(), enMeses: Number(meses) || 1 };
                      }),
                    })
                  }
                />
              </label>
            </div>
          </div>
        ))}
        {t.opciones.length < 3 && (
          <button type="button" className="btn btn-ghost" onClick={() => setT({ ...t, opciones: [...t.opciones, { texto: "", explicacion: "", efectos: {} }] })}>
            <Plus size={14} /> Sumar opción
          </button>
        )}
      </fieldset>

      <fieldset className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <legend className="field-label sm:col-span-3">Hacelo de verdad (opcional)</legend>
        <select
          className="input"
          value={t.hacelo?.app ?? "empresas"}
          onChange={(e) => setT({ ...t, hacelo: { ruta: t.hacelo?.ruta ?? "/", texto: t.hacelo?.texto ?? "", app: e.target.value as "finanzas" | "empresas" } })}
        >
          <option value="empresas">NODOS Empresas</option>
          <option value="finanzas">NODOS Finanzas</option>
        </select>
        <input
          className="input"
          placeholder="/ruta (ej. /vencimientos)"
          value={t.hacelo?.ruta ?? ""}
          onChange={(e) => setT({ ...t, hacelo: { app: t.hacelo?.app ?? "empresas", texto: t.hacelo?.texto ?? "", ruta: e.target.value } })}
        />
        <input
          className="input"
          placeholder="Texto del enlace"
          maxLength={80}
          value={t.hacelo?.texto ?? ""}
          onChange={(e) => setT({ ...t, hacelo: { app: t.hacelo?.app ?? "empresas", ruta: t.hacelo?.ruta ?? "/", texto: e.target.value } })}
        />
      </fieldset>

      {t.aviso !== "ninguno" && <p className="text-xs text-carbon/50">Se muestra: {AVISO_TEXTO[t.aviso]}</p>}

      {problemas.length > 0 && (
        <ul className="list-disc space-y-0.5 rounded-md bg-bad/5 p-3 pl-7 text-sm text-bad">
          {problemas.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      )}

      <div className="flex gap-2">
        <button type="submit" className="btn btn-primary" disabled={guardando}>
          {guardando ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} Guardar
        </button>
        <button type="button" className="btn btn-ghost" onClick={onCerrar}>
          Cancelar
        </button>
      </div>
    </form>
  );
}

function EditorMision({
  inicial,
  estadoInicial,
  nueva,
  idsTarjetas,
  idsExistentes,
  onCerrar,
  onGuardada,
}: {
  inicial: Mision;
  estadoInicial: Estado;
  nueva: boolean;
  idsTarjetas: Set<string>;
  idsExistentes: Set<string>;
  onCerrar: () => void;
  onGuardada: () => void;
}) {
  const { showToast } = useToast();
  const [m, setM] = useState<Mision>(inicial);
  const [estado, setEstado] = useState<Estado>(estadoInicial);
  const [agregar, setAgregar] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [problemas, setProblemas] = useState<string[]>([]);
  const opciones = Array.from(idsTarjetas).sort();

  function mover(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= m.tarjetas.length) return;
    const next = [...m.tarjetas];
    [next[i], next[j]] = [next[j], next[i]];
    setM({ ...m, tarjetas: next });
  }

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    const limpia: Mision = { ...m, id: m.id.trim(), titulo: m.titulo.trim(), descripcion: m.descripcion.trim() };
    const errores = validarMision(limpia, idsTarjetas);
    if (nueva && idsExistentes.has(limpia.id)) errores.unshift("Ya existe una misión con ese id.");
    setProblemas(errores);
    if (errores.length) return;
    setGuardando(true);
    const { error } = await guardarFila(limpia.id, "mision", limpia, estado);
    setGuardando(false);
    if (error) return showToast(`No se pudo guardar: ${mensajeError(error)}`, "error");
    showToast(estado === "publicado" ? "Misión publicada." : "Misión guardada.");
    onGuardada();
  }

  return (
    <form onSubmit={guardar} className="card animate-slide-up space-y-5">
      <div className="flex items-center justify-between">
        <h2>{nueva ? "Nueva misión" : `Editar: ${inicial.titulo || inicial.id}`}</h2>
        <button type="button" onClick={onCerrar} className="text-carbon/50 hover:text-carbon" aria-label="Cerrar">
          <X size={18} />
        </button>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Campo label="Id" ayuda="ej. m-impuestos">
          <input className="input" value={m.id} disabled={!nueva} maxLength={60} onChange={(e) => setM({ ...m, id: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "") })} />
        </Campo>
        <Campo label="Ruta">
          <select className="input" value={m.ruta} onChange={(e) => setM({ ...m, ruta: e.target.value as Ruta })}>
            {(Object.keys(RUTAS) as Ruta[]).map((r) => (
              <option key={r} value={r}>
                {RUTAS[r].titulo}
              </option>
            ))}
          </select>
        </Campo>
        <Campo label="Orden">
          <input type="number" min={1} max={99} className="input" value={m.orden} onChange={(e) => setM({ ...m, orden: Number(e.target.value) })} />
        </Campo>
        <Campo label="Estado">
          <select className="input" value={estado} onChange={(e) => setEstado(e.target.value as Estado)}>
            {ESTADOS.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </Campo>
        <div className="sm:col-span-2">
          <Campo label="Título">
            <input className="input" maxLength={80} value={m.titulo} onChange={(e) => setM({ ...m, titulo: e.target.value })} />
          </Campo>
        </div>
        <div className="sm:col-span-2">
          <Campo label="Descripción">
            <input className="input" maxLength={200} value={m.descripcion} onChange={(e) => setM({ ...m, descripcion: e.target.value })} />
          </Campo>
        </div>
        <Campo label="Personaje">
          <select className="input" value={m.personaje} onChange={(e) => setM({ ...m, personaje: e.target.value as PersonajeId })}>
            {(Object.keys(PERSONAJES) as PersonajeId[]).map((p) => (
              <option key={p} value={p}>
                {PERSONAJES[p].titulo}
              </option>
            ))}
          </select>
        </Campo>
        <Campo label="Empresa">
          <select className="input" value={m.tipo} onChange={(e) => setM({ ...m, tipo: e.target.value as TipoEmpresaJuego })}>
            {TIPOS.map((x) => (
              <option key={x} value={x}>
                {TIPOS_JUEGO[x].corto}
              </option>
            ))}
          </select>
        </Campo>
        <label className="inline-flex items-center gap-2 self-end pb-2 text-sm text-carbon/80">
          <input type="checkbox" checked={m.sujetoObligado} onChange={(e) => setM({ ...m, sujetoObligado: e.target.checked })} /> Sujeto obligado
        </label>
        <label className="inline-flex items-center gap-2 self-end pb-2 text-sm text-carbon/80">
          <input type="checkbox" checked={m.gratis} onChange={(e) => setM({ ...m, gratis: e.target.checked })} /> Gratis (si no, incluida en el Combo)
        </label>
      </div>

      <fieldset className="space-y-2">
        <legend className="field-label">Tarjetas, en orden</legend>
        {m.tarjetas.length === 0 && <p className="text-sm text-carbon/50">Sumá al menos una tarjeta.</p>}
        <ol className="space-y-1.5">
          {m.tarjetas.map((id, i) => (
            <li key={`${id}-${i}`} className="flex items-center gap-2 rounded-sm border px-3 py-2 text-sm" style={{ borderColor: "var(--line)" }}>
              <span className="w-5 text-carbon/45">{i + 1}.</span>
              <span className="min-w-0 flex-1 truncate">{id}</span>
              <button type="button" className="p-1 text-carbon/50 hover:text-cobre" aria-label="Subir" onClick={() => mover(i, -1)} disabled={i === 0}>
                <ArrowUp size={14} />
              </button>
              <button type="button" className="p-1 text-carbon/50 hover:text-cobre" aria-label="Bajar" onClick={() => mover(i, 1)} disabled={i === m.tarjetas.length - 1}>
                <ArrowDown size={14} />
              </button>
              <button type="button" className="p-1 text-carbon/50 hover:text-bad" aria-label="Quitar" onClick={() => setM({ ...m, tarjetas: m.tarjetas.filter((_, j) => j !== i) })}>
                <Trash2 size={14} />
              </button>
            </li>
          ))}
        </ol>
        <div className="flex flex-wrap gap-2">
          <select className="input !w-auto min-w-[220px]" value={agregar} onChange={(e) => setAgregar(e.target.value)}>
            <option value="">Elegí una tarjeta...</option>
            {opciones.map((id) => (
              <option key={id} value={id}>
                {id}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="btn btn-ghost"
            disabled={!agregar || m.tarjetas.length >= 8}
            onClick={() => {
              setM({ ...m, tarjetas: [...m.tarjetas, agregar] });
              setAgregar("");
            }}
          >
            <Plus size={14} /> Sumar
          </button>
        </div>
      </fieldset>

      {problemas.length > 0 && (
        <ul className="list-disc space-y-0.5 rounded-md bg-bad/5 p-3 pl-7 text-sm text-bad">
          {problemas.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      )}

      <div className="flex gap-2">
        <button type="submit" className="btn btn-primary" disabled={guardando}>
          {guardando ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} Guardar
        </button>
        <button type="button" className="btn btn-ghost" onClick={onCerrar}>
          Cancelar
        </button>
      </div>
    </form>
  );
}

function lista(v: string): string[] {
  return v
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
}

function Campo({ label, ayuda, children }: { label: string; ayuda?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="field-label">
        {label}
        {ayuda && <span className="ml-1 font-normal text-carbon/45">({ayuda})</span>}
      </span>
      {children}
    </label>
  );
}
