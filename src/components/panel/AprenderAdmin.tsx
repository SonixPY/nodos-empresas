"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Loader2, Pencil, Plus, RotateCcw, Save, Search, Trash2, X } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { useToast } from "@/components/ToastProvider";
import { mensajeError } from "@/lib/nodos/errores";
import {
  CASOS,
  SITUACIONES,
  validarCaso,
  validarSituacion,
  type CasoReal,
  type FilaAprender,
  type Opcion,
  type Situacion,
} from "@/lib/nodos/aprender";

type Estado = FilaAprender["estado"];
const ESTADOS: { id: Estado; label: string }[] = [
  { id: "borrador", label: "Borrador" },
  { id: "revisado", label: "Revisado" },
  { id: "publicado", label: "Publicado" },
];
const TIPOS: { id: Situacion["tipo"]; label: string }[] = [
  { id: "situacion", label: "Situación" },
  { id: "oportunidad", label: "Oportunidad" },
  { id: "vencimiento", label: "Vencimiento" },
];
const INCLUIDAS = new Map(SITUACIONES.map((s) => [s.id, s]));
const CASOS_INCLUIDOS = new Map(CASOS.map((c) => [c.id, c]));

/** Lo que no es texto (efectos, requisitos, trayectoria) se edita como JSON. */
type Avanzado = Pick<Situacion, "porDefecto" | "peso" | "repetible" | "requisitos" | "trayectoria"> & {
  opciones: Record<string, Pick<Opcion, "efectos" | "marca" | "quita" | "programa">>;
};

function separar(s: Situacion): { textos: Situacion; avanzado: string } {
  const av: Avanzado = {
    porDefecto: s.porDefecto,
    ...(s.peso !== undefined ? { peso: s.peso } : {}),
    ...(s.repetible ? { repetible: true } : {}),
    ...(s.requisitos ? { requisitos: s.requisitos } : {}),
    ...(s.trayectoria ? { trayectoria: s.trayectoria } : {}),
    opciones: Object.fromEntries(
      s.opciones.map((o) => [
        o.id,
        { efectos: o.efectos, ...(o.marca ? { marca: o.marca } : {}), ...(o.quita ? { quita: o.quita } : {}), ...(o.programa ? { programa: o.programa } : {}) },
      ]),
    ),
  };
  return { textos: s, avanzado: JSON.stringify(av, null, 2) };
}

function unir(t: Situacion, avanzadoTxt: string): { s: Situacion | null; error: string | null } {
  let av: Avanzado;
  try {
    av = JSON.parse(avanzadoTxt) as Avanzado;
  } catch {
    return { s: null, error: "El JSON de reglas no es válido." };
  }
  const s: Situacion = {
    id: t.id.trim(),
    tipo: t.tipo,
    titulo: t.titulo.trim(),
    postit: t.postit.trim(),
    texto: t.texto.trim(),
    aviso: t.aviso,
    porDefecto: av.porDefecto,
    ...(av.peso !== undefined ? { peso: av.peso } : {}),
    ...(av.repetible ? { repetible: true } : {}),
    ...(av.requisitos ? { requisitos: av.requisitos } : {}),
    ...(av.trayectoria ? { trayectoria: av.trayectoria } : {}),
    opciones: t.opciones.map((o) => {
      const x = av.opciones?.[o.id] ?? { efectos: {} };
      return {
        id: o.id.trim(),
        titulo: o.titulo.trim(),
        texto: o.texto.trim(),
        resultado: o.resultado.trim(),
        nodo: o.nodo.trim(),
        efectos: x.efectos ?? {},
        ...(x.marca?.length ? { marca: x.marca } : {}),
        ...(x.quita?.length ? { quita: x.quita } : {}),
        ...(x.programa?.length ? { programa: x.programa } : {}),
      };
    }),
    leccion: {
      id: t.leccion.id.trim(),
      titulo: t.leccion.titulo.trim(),
      reglas: t.leccion.reglas.map((r) => r.trim()).filter(Boolean),
      ...(t.leccion.casoReal ? { casoReal: t.leccion.casoReal.trim() } : {}),
    },
  };
  return { s, error: null };
}

const NUEVA: Situacion = {
  id: "",
  tipo: "situacion",
  titulo: "",
  postit: "",
  texto: "",
  aviso: "inversion",
  porDefecto: "a",
  opciones: [
    { id: "a", titulo: "", texto: "", resultado: "", nodo: "", efectos: {} },
    { id: "b", titulo: "", texto: "", resultado: "", nodo: "", efectos: {} },
  ],
  leccion: { id: "", titulo: "", reglas: ["", "", ""] },
};

const CASO_NUEVO: CasoReal = { id: "", titulo: "", fecha: "", resumen: "", fuente: "", verificado: false };

const guardarFila = (id: string, tipo: FilaAprender["tipo"], datos: unknown, estado: Estado) =>
  supabase.from("aprender_contenido").upsert({ id, tipo, datos, estado }, { onConflict: "id" });

function Campo({ label, children, ayuda }: { label: string; children: React.ReactNode; ayuda?: string }) {
  return (
    <label className="block">
      <span className="field-label">{label}</span>
      {children}
      {ayuda && <span className="mt-1 block text-xs text-carbon/55">{ayuda}</span>}
    </label>
  );
}

function Errores({ lista }: { lista: string[] }) {
  if (!lista.length) return <p className="text-xs text-good">Pasa la validación: el juego la va a usar.</p>;
  return (
    <ul className="space-y-0.5 rounded-md border border-bad/30 bg-bad/5 p-3 text-xs text-bad" role="alert">
      {lista.map((e, i) => (
        <li key={i}>{e}</li>
      ))}
    </ul>
  );
}

function EditorSituacion({
  inicial,
  estadoInicial,
  nueva,
  ids,
  onCerrar,
  onGuardada,
}: {
  inicial: Situacion;
  estadoInicial: Estado;
  nueva: boolean;
  ids: Set<string>;
  onCerrar: () => void;
  onGuardada: () => void;
}) {
  const { showToast } = useToast();
  const base = useMemo(() => separar(inicial), [inicial]);
  const [t, setT] = useState<Situacion>(structuredClone(base.textos));
  const [avanzado, setAvanzado] = useState(base.avanzado);
  const [estado, setEstado] = useState<Estado>(estadoInicial);
  const [guardando, setGuardando] = useState(false);

  const { s, error } = unir(t, avanzado);
  const errores = [...(error ? [error] : []), ...(s ? validarSituacion(s) : [])];
  if (nueva && t.id && ids.has(t.id.trim())) errores.unshift("Ya existe contenido con ese id.");

  const op = (i: number, cambio: Partial<Opcion>) => setT({ ...t, opciones: t.opciones.map((o, j) => (j === i ? { ...o, ...cambio } : o)) });

  async function guardar() {
    if (!s || (errores.length && estado !== "borrador")) return showToast("Corregí los errores antes de marcarla como revisada o publicarla.", "error");
    setGuardando(true);
    const { error: err } = await guardarFila(s.id, "situacion", s, estado);
    setGuardando(false);
    if (err) return showToast(`No se pudo guardar: ${mensajeError(err)}`, "error");
    showToast(estado === "publicado" ? "Situación publicada." : "Situación guardada.");
    onGuardada();
  }

  return (
    <section className="card space-y-4 p-5" aria-label="Editar situación">
      <div className="flex items-start justify-between gap-3">
        <h2>{nueva ? "Nueva situación" : `Editar “${inicial.titulo}”`}</h2>
        <button type="button" className="btn btn-ghost !px-3" onClick={onCerrar} aria-label="Cerrar el editor">
          <X size={16} />
        </button>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <Campo label="Id" ayuda="Minúsculas, números y guiones. No se cambia después.">
          <input className="input" value={t.id} disabled={!nueva} onChange={(e) => setT({ ...t, id: e.target.value })} />
        </Campo>
        <Campo label="Tipo (color del post-it)">
          <select className="input" value={t.tipo} onChange={(e) => setT({ ...t, tipo: e.target.value as Situacion["tipo"] })}>
            {TIPOS.map((x) => (
              <option key={x.id} value={x.id}>
                {x.label}
              </option>
            ))}
          </select>
        </Campo>
        <Campo label="Aviso">
          <select className="input" value={t.aviso} onChange={(e) => setT({ ...t, aviso: e.target.value as Situacion["aviso"] })}>
            <option value="inversion">No es asesoría de inversión</option>
            <option value="legal">No constituye asesoramiento legal</option>
          </select>
        </Campo>
      </div>
      <Campo label="Título">
        <input className="input" value={t.titulo} onChange={(e) => setT({ ...t, titulo: e.target.value })} />
      </Campo>
      <Campo label="Texto del post-it" ayuda="Corto, en primera persona, como una nota escrita a mano.">
        <input className="input" value={t.postit} onChange={(e) => setT({ ...t, postit: e.target.value })} />
      </Campo>
      <Campo label="Situación">
        <textarea className="input min-h-24" value={t.texto} onChange={(e) => setT({ ...t, texto: e.target.value })} />
      </Campo>

      <fieldset className="space-y-3">
        <legend className="font-display font-semibold text-musgo">Opciones</legend>
        {t.opciones.map((o, i) => (
          <div key={i} className="space-y-2 rounded-md border border-[var(--line)] p-3">
            <div className="grid gap-2 sm:grid-cols-[8rem_1fr_auto]">
              <Campo label="Id">
                <input className="input" value={o.id} onChange={(e) => op(i, { id: e.target.value })} />
              </Campo>
              <Campo label="Título">
                <input className="input" value={o.titulo} onChange={(e) => op(i, { titulo: e.target.value })} />
              </Campo>
              <button
                type="button"
                className="btn btn-ghost self-end"
                disabled={t.opciones.length <= 1}
                onClick={() => setT({ ...t, opciones: t.opciones.filter((_, j) => j !== i) })}
                aria-label={`Quitar la opción ${i + 1}`}
              >
                <Trash2 size={15} />
              </button>
            </div>
            <Campo label="Texto">
              <input className="input" value={o.texto} onChange={(e) => op(i, { texto: e.target.value })} />
            </Campo>
            <Campo label="Qué pasó (al cerrarse)">
              <input className="input" value={o.resultado} onChange={(e) => op(i, { resultado: e.target.value })} />
            </Campo>
            <Campo label="Lo que dice NODO">
              <textarea className="input min-h-16" value={o.nodo} onChange={(e) => op(i, { nodo: e.target.value })} />
            </Campo>
          </div>
        ))}
        {t.opciones.length < 4 && (
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => setT({ ...t, opciones: [...t.opciones, { id: `op${t.opciones.length + 1}`, titulo: "", texto: "", resultado: "", nodo: "", efectos: {} }] })}
          >
            <Plus size={15} /> Agregar opción
          </button>
        )}
      </fieldset>

      <fieldset className="grid gap-3 sm:grid-cols-2">
        <legend className="font-display font-semibold text-musgo">Lección de NODO</legend>
        <Campo label="Id de la lección" ayuda="Varias situaciones pueden compartir la misma lección.">
          <input className="input" value={t.leccion.id} onChange={(e) => setT({ ...t, leccion: { ...t.leccion, id: e.target.value } })} />
        </Campo>
        <Campo label="Título de la lección">
          <input className="input" value={t.leccion.titulo} onChange={(e) => setT({ ...t, leccion: { ...t.leccion, titulo: e.target.value } })} />
        </Campo>
        <Campo label="Reglas (una por línea, hasta 4)">
          <textarea
            className="input min-h-24"
            value={t.leccion.reglas.join("\n")}
            onChange={(e) => setT({ ...t, leccion: { ...t.leccion, reglas: e.target.value.split("\n").slice(0, 4) } })}
          />
        </Campo>
        <Campo label="Caso real (id, opcional)" ayuda="Solo se muestra si el caso está marcado como verificado.">
          <input
            className="input"
            value={t.leccion.casoReal ?? ""}
            onChange={(e) => setT({ ...t, leccion: { ...t.leccion, casoReal: e.target.value || undefined } })}
          />
        </Campo>
      </fieldset>

      <details className="rounded-md border border-[var(--line)] p-3">
        <summary className="cursor-pointer text-sm font-medium">Reglas del juego (avanzado): efectos, requisitos, trayectoria</summary>
        <p className="mt-2 text-xs text-carbon/60">
          Efectos por opción (efectivo, ahorro, deudaTarjeta, sueldo, gastosFijos, reputacion, nivelVida, invertir, vender, perder, negocio, dejarTrabajo,
          prestamo), requisitos (etapaMinima, marca, sinMarca, activo, conDeudaTarjeta, conNegocio, meses, soloProgramada) y trayectoria ({"{"} activo,
          cambios {"}"}). Los montos van en guaraníes del juego.
        </p>
        <textarea className="input mt-2 min-h-64 font-mono text-xs" spellCheck={false} value={avanzado} onChange={(e) => setAvanzado(e.target.value)} />
      </details>

      <Errores lista={errores} />
      <div className="flex flex-wrap items-center gap-2">
        <div className="segmented" role="group" aria-label="Estado">
          {ESTADOS.map((x) => (
            <button key={x.id} type="button" className={estado === x.id ? "active" : ""} aria-pressed={estado === x.id} onClick={() => setEstado(x.id)}>
              {x.label}
            </button>
          ))}
        </div>
        <button type="button" className="btn btn-primary" onClick={guardar} disabled={guardando}>
          {guardando ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} Guardar
        </button>
      </div>
    </section>
  );
}

function EditorCaso({ inicial, estadoInicial, nuevo, onCerrar, onGuardado }: { inicial: CasoReal; estadoInicial: Estado; nuevo: boolean; onCerrar: () => void; onGuardado: () => void }) {
  const { showToast } = useToast();
  const [c, setC] = useState<CasoReal>(structuredClone(inicial));
  const [estado, setEstado] = useState<Estado>(estadoInicial);
  const [guardando, setGuardando] = useState(false);
  const errores = validarCaso({ ...c, id: c.id.trim() });

  async function guardar() {
    if (errores.length && estado !== "borrador") return showToast("Corregí los errores antes de publicarlo.", "error");
    setGuardando(true);
    const { error } = await guardarFila(c.id.trim(), "caso", { ...c, id: c.id.trim() }, estado);
    setGuardando(false);
    if (error) return showToast(`No se pudo guardar: ${mensajeError(error)}`, "error");
    showToast("Caso guardado.");
    onGuardado();
  }

  return (
    <section className="card space-y-3 p-5" aria-label="Editar caso real">
      <div className="flex items-start justify-between gap-3">
        <h2>{nuevo ? "Nuevo caso real" : `Editar “${inicial.titulo}”`}</h2>
        <button type="button" className="btn btn-ghost !px-3" onClick={onCerrar} aria-label="Cerrar el editor">
          <X size={16} />
        </button>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <Campo label="Id">
          <input className="input" value={c.id} disabled={!nuevo} onChange={(e) => setC({ ...c, id: e.target.value })} />
        </Campo>
        <Campo label="Título">
          <input className="input" value={c.titulo} onChange={(e) => setC({ ...c, titulo: e.target.value })} />
        </Campo>
        <Campo label="Fecha (AAAA-MM)">
          <input className="input" value={c.fecha} placeholder="2022-05" onChange={(e) => setC({ ...c, fecha: e.target.value })} />
        </Campo>
      </div>
      <Campo label="Qué pasó" ayuda="Solo hechos con fuente pública. Sin opinar sobre la responsabilidad de terceros ni nombrar personas físicas.">
        <textarea className="input min-h-28" value={c.resumen} onChange={(e) => setC({ ...c, resumen: e.target.value })} />
      </Campo>
      <Campo label="Fuente">
        <input className="input" value={c.fuente} onChange={(e) => setC({ ...c, fuente: e.target.value })} />
      </Campo>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={c.verificado} onChange={(e) => setC({ ...c, verificado: e.target.checked })} />
        Revisé la fuente y los hechos (sin esto, el caso no se muestra en el juego)
      </label>
      <Errores lista={errores} />
      <div className="flex flex-wrap items-center gap-2">
        <div className="segmented" role="group" aria-label="Estado">
          {ESTADOS.map((x) => (
            <button key={x.id} type="button" className={estado === x.id ? "active" : ""} aria-pressed={estado === x.id} onClick={() => setEstado(x.id)}>
              {x.label}
            </button>
          ))}
        </div>
        <button type="button" className="btn btn-primary" onClick={guardar} disabled={guardando}>
          {guardando ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} Guardar
        </button>
      </div>
    </section>
  );
}

/** Panel → Aprender: situaciones y casos reales del juego. */
export default function AprenderAdmin() {
  const { showToast } = useToast();
  const [filas, setFilas] = useState<FilaAprender[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pestana, setPestana] = useState<"situaciones" | "casos">("situaciones");
  const [buscar, setBuscar] = useState("");
  const [editS, setEditS] = useState<{ s: Situacion; estado: Estado; nueva: boolean } | null>(null);
  const [editC, setEditC] = useState<{ c: CasoReal; estado: Estado; nuevo: boolean } | null>(null);

  const cargar = useCallback(async () => {
    const { data, error: err } = await supabase.from("aprender_contenido").select("id, tipo, datos, estado").order("id");
    if (err) setError(mensajeError(err));
    else setError(null);
    setFilas((data ?? []) as FilaAprender[]);
  }, []);

  useEffect(() => {
    // Carga inicial desde la base (efecto de sincronización con un sistema externo).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    cargar();
  }, [cargar]);

  const porId = useMemo(() => new Map((filas ?? []).map((f) => [f.id, f])), [filas]);
  const situaciones = useMemo(() => {
    const ids = new Set([...INCLUIDAS.keys(), ...(filas ?? []).filter((f) => f.tipo === "situacion").map((f) => f.id)]);
    return Array.from(ids)
      .map((id) => {
        const f = porId.get(id);
        const s = (f?.datos as Situacion | undefined) ?? INCLUIDAS.get(id)!;
        return { id, s: { ...s, id }, fila: f, incluida: INCLUIDAS.has(id), valida: validarSituacion({ ...s, id }).length === 0 };
      })
      .filter((x) => !buscar || `${x.id} ${x.s.titulo}`.toLowerCase().includes(buscar.toLowerCase()));
  }, [filas, porId, buscar]);
  const casos = useMemo(() => {
    const ids = new Set([...CASOS_INCLUIDOS.keys(), ...(filas ?? []).filter((f) => f.tipo === "caso").map((f) => f.id)]);
    return Array.from(ids).map((id) => {
      const f = porId.get(id);
      const c = (f?.datos as CasoReal | undefined) ?? CASOS_INCLUIDOS.get(id)!;
      return { id, c: { ...c, id }, fila: f, incluido: CASOS_INCLUIDOS.has(id) };
    });
  }, [filas, porId]);

  async function restaurar(id: string, incluida: boolean) {
    if (!window.confirm(incluida ? "¿Volver a la versión incluida en la app? Se borra la edición." : "¿Borrar este contenido? No se puede deshacer.")) return;
    const { error: err } = await supabase.from("aprender_contenido").delete().eq("id", id);
    if (err) return showToast(mensajeError(err), "error");
    showToast(incluida ? "Restaurada la versión original." : "Borrado.");
    cargar();
  }

  const etiquetaEstado = (f?: FilaAprender, incluida?: boolean) =>
    f ? ESTADOS.find((e) => e.id === f.estado)?.label + (incluida ? " (editada)" : "") : "Incluida en la app";

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1>NODOS Aprender</h1>
          <p className="mt-1 max-w-2xl text-sm text-carbon/60">
            Situaciones y casos reales de la Carrera. Editá lo incluido o sumá contenido nuevo: solo lo publicado llega a los jugadores, y lo que no
            pasa la validación no se usa.
          </p>
        </div>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() =>
            pestana === "situaciones"
              ? setEditS({ s: structuredClone(NUEVA), estado: "borrador", nueva: true })
              : setEditC({ c: structuredClone(CASO_NUEVO), estado: "borrador", nuevo: true })
          }
        >
          <Plus size={15} /> {pestana === "situaciones" ? "Nueva situación" : "Nuevo caso real"}
        </button>
      </header>

      <p className="flex gap-2 rounded-md bg-marfil/70 p-3 text-xs text-carbon/70">
        <AlertTriangle size={14} className="mt-0.5 shrink-0 text-cobre" />
        Personas, activos y montos del juego son ficticios. Los casos reales llevan fuente pública y solo se muestran marcados como verificados. No uses
        casos ni datos de clientes.
      </p>
      {error && <p className="text-sm text-bad">{error}</p>}

      {editS && (
        <EditorSituacion
          key={editS.s.id || "nueva"}
          inicial={editS.s}
          estadoInicial={editS.estado}
          nueva={editS.nueva}
          ids={new Set(situaciones.map((x) => x.id))}
          onCerrar={() => setEditS(null)}
          onGuardada={() => {
            setEditS(null);
            cargar();
          }}
        />
      )}
      {editC && (
        <EditorCaso
          key={editC.c.id || "nuevo"}
          inicial={editC.c}
          estadoInicial={editC.estado}
          nuevo={editC.nuevo}
          onCerrar={() => setEditC(null)}
          onGuardado={() => {
            setEditC(null);
            cargar();
          }}
        />
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="segmented" role="tablist" aria-label="Contenido">
          <button type="button" role="tab" aria-selected={pestana === "situaciones"} className={pestana === "situaciones" ? "active" : ""} onClick={() => setPestana("situaciones")}>
            Situaciones ({situaciones.length})
          </button>
          <button type="button" role="tab" aria-selected={pestana === "casos"} className={pestana === "casos" ? "active" : ""} onClick={() => setPestana("casos")}>
            Casos reales ({casos.length})
          </button>
        </div>
        {pestana === "situaciones" && (
          <label className="relative">
            <span className="sr-only">Buscar</span>
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-carbon/50" aria-hidden />
            <input className="input !pl-9" placeholder="Buscar por id o título" value={buscar} onChange={(e) => setBuscar(e.target.value)} />
          </label>
        )}
      </div>

      {filas === null ? (
        <p className="text-sm text-carbon/60">Cargando…</p>
      ) : pestana === "situaciones" ? (
        <div className="table-shell">
          <table>
            <thead>
              <tr>
                <th>Situación</th>
                <th>Tipo</th>
                <th>Estado</th>
                <th className="text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {situaciones.map((x) => (
                <tr key={x.id}>
                  <td>
                    <span className="block font-medium">{x.s.titulo}</span>
                    <span className="text-xs text-carbon/55">
                      {x.id}
                      {!x.valida && <span className="ml-2 text-bad">no pasa la validación</span>}
                    </span>
                  </td>
                  <td>{TIPOS.find((t) => t.id === x.s.tipo)?.label}</td>
                  <td>{etiquetaEstado(x.fila, x.incluida)}</td>
                  <td className="text-right">
                    <div className="inline-flex gap-1">
                      <button type="button" className="btn btn-ghost !px-3" aria-label={`Editar ${x.s.titulo}`} onClick={() => setEditS({ s: structuredClone(x.s), estado: x.fila?.estado ?? "borrador", nueva: false })}>
                        <Pencil size={15} />
                      </button>
                      {x.fila && (
                        <button type="button" className="btn btn-ghost !px-3" aria-label={x.incluida ? `Restaurar ${x.s.titulo}` : `Borrar ${x.s.titulo}`} onClick={() => restaurar(x.id, x.incluida)}>
                          {x.incluida ? <RotateCcw size={15} /> : <Trash2 size={15} />}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="table-shell">
          <table>
            <thead>
              <tr>
                <th>Caso</th>
                <th>Fecha</th>
                <th>Verificado</th>
                <th>Estado</th>
                <th className="text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {casos.map((x) => (
                <tr key={x.id}>
                  <td>
                    <span className="block font-medium">{x.c.titulo}</span>
                    <span className="text-xs text-carbon/55">{x.id}</span>
                  </td>
                  <td>{x.c.fecha}</td>
                  <td>{x.c.verificado ? "Sí" : <span className="text-bad">No: no se muestra</span>}</td>
                  <td>{etiquetaEstado(x.fila, x.incluido)}</td>
                  <td className="text-right">
                    <div className="inline-flex gap-1">
                      <button type="button" className="btn btn-ghost !px-3" aria-label={`Editar ${x.c.titulo}`} onClick={() => setEditC({ c: structuredClone(x.c), estado: x.fila?.estado ?? "borrador", nuevo: false })}>
                        <Pencil size={15} />
                      </button>
                      {x.fila && (
                        <button type="button" className="btn btn-ghost !px-3" aria-label={x.incluido ? `Restaurar ${x.c.titulo}` : `Borrar ${x.c.titulo}`} onClick={() => restaurar(x.id, x.incluido)}>
                          {x.incluido ? <RotateCcw size={15} /> : <Trash2 size={15} />}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
