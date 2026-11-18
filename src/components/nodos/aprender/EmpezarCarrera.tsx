"use client";

import { useEffect, useId, useState } from "react";
import { ArrowLeft, ArrowRight, Check, Loader2 } from "lucide-react";
import {
  AVATARES,
  METAS,
  OFICIOS,
  PARAMETROS,
  herenciaInicial,
  nombreValido,
  type AvatarId,
  type MetaId,
  type OficioId,
} from "@/lib/nodos/aprender";
import { useCarrera } from "./CarreraProvider";
import { Aviso, AvatarIcono, NodoIcono, gs } from "./piezas";

const PASOS = ["Quién sos", "Tu trabajo", "Tu meta", "Tu ficha"] as const;
const NOMBRE_AVATAR: Record<AvatarId, string> = {
  persona: "Persona",
  maletin: "Maletín",
  laptop: "Computadora",
  herramientas: "Herramientas",
  paleta: "Paleta",
  libro: "Libro",
  carrito: "Carrito",
  cafe: "Café",
};

/** Credencial del personaje: se va completando mientras elegís. */
function Credencial({ nombre, avatar, oficio, meta, herencia }: { nombre: string; avatar: AvatarId; oficio: OficioId | null; meta: MetaId | null; herencia: number }) {
  const o = oficio ? OFICIOS[oficio] : null;
  const a = o ? PARAMETROS.arranques[o.arranque] : null;
  return (
    <div className="relative mx-auto w-full max-w-sm pt-6">
      {/* Cinta y broche de la credencial */}
      <span aria-hidden className="absolute left-1/2 top-0 h-8 w-10 -translate-x-1/2 rounded-b-md bg-cobre" />
      <div className="relative overflow-hidden rounded-xl bg-marfil text-carbon shadow-[0_14px_30px_rgba(0,0,0,0.4)]">
        <div className="flex items-center justify-between bg-musgo px-4 py-2.5 text-marfil">
          <span className="font-display text-sm font-bold tracking-[0.12em]">CREDENCIAL</span>
          <NodoIcono size={26} />
        </div>
        <div className="flex gap-4 p-5">
          <AvatarIcono avatar={avatar} size={72} />
          <div className="min-w-0">
            <p className="truncate font-display text-xl font-bold text-musgo">{nombre.trim() || "Tu nombre"}</p>
            <p className="text-sm text-carbon/75">{o ? o.nombre : "Elegí tu trabajo"}</p>
            {o && <p className="text-xs text-carbon/60">en {o.lugar}</p>}
          </div>
        </div>
        <dl className="grid grid-cols-2 gap-3 border-t border-[var(--line)] px-5 py-4 text-sm">
          <div>
            <dt className="text-xs text-bosque">Sueldo</dt>
            <dd className="font-semibold">{a ? gs(a.sueldo) : "—"}</dd>
          </div>
          <div>
            <dt className="text-xs text-bosque">Gastos fijos</dt>
            <dd className="font-semibold">{a ? gs(a.gastosFijos) : "—"}</dd>
          </div>
          <div>
            <dt className="text-xs text-bosque">Efectivo inicial</dt>
            <dd className="font-semibold">{a ? gs(a.efectivo + herencia) : "—"}</dd>
          </div>
          <div>
            <dt className="text-xs text-bosque">Meta</dt>
            <dd className="font-semibold">{meta ? METAS[meta].nombre : "—"}</dd>
          </div>
        </dl>
        <p className="border-t border-dashed border-[var(--line)] px-5 py-2.5 text-[11px] text-carbon/55">Personaje y montos ficticios.</p>
      </div>
    </div>
  );
}

/** Creación del personaje: nombre y avatar, trabajo, meta y ficha final. */
export default function EmpezarCarrera() {
  const { empezar, ocupado, almacen } = useCarrera();
  const idNombre = useId();
  const [paso, setPaso] = useState(0);
  const [nombre, setNombre] = useState("");
  const [avatar, setAvatar] = useState<AvatarId>("persona");
  const [oficio, setOficio] = useState<OficioId | null>(null);
  const [meta, setMeta] = useState<MetaId | null>(null);
  const [puntos, setPuntos] = useState(0);
  const [tocado, setTocado] = useState(false);

  useEffect(() => {
    almacen
      .cargarLecciones()
      .then((l) => setPuntos(l.length))
      .catch(() => setPuntos(0));
  }, [almacen]);

  const herencia = oficio ? herenciaInicial(puntos, PARAMETROS.arranques[OFICIOS[oficio].arranque].sueldo) : 0;
  const listo = [nombreValido(nombre), oficio !== null, meta !== null, true];
  const siguiente = () => {
    setTocado(true);
    if (listo[paso]) {
      setTocado(false);
      setPaso((p) => Math.min(PASOS.length - 1, p + 1));
    }
  };

  return (
    <div className="-mx-4 bg-[#2A3D31] px-4 py-6 sm:mx-0 sm:rounded-2xl sm:p-6 lg:p-8">
      <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <section className="rounded-2xl bg-marfil p-5 shadow-xl sm:p-7" aria-labelledby="crear-titulo">
          <div className="flex items-center gap-3">
            <NodoIcono size={44} />
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.1em] text-bosque">Nueva carrera</p>
              <h1 id="crear-titulo" className="!text-2xl sm:!text-3xl">
                Armá tu personaje
              </h1>
            </div>
          </div>

          <ol className="mt-5 flex flex-wrap gap-2" aria-label="Pasos">
            {PASOS.map((p, i) => (
              <li key={p}>
                <button
                  type="button"
                  disabled={i > paso && !listo.slice(0, i).every(Boolean)}
                  onClick={() => setPaso(i)}
                  aria-current={i === paso ? "step" : undefined}
                  className={`flex min-h-9 items-center gap-1.5 rounded-full px-3 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-40 ${
                    i === paso ? "bg-musgo text-marfil" : i < paso ? "bg-bosque/15 text-musgo" : "bg-[var(--sutil)] text-carbon/70"
                  }`}
                >
                  {i < paso ? <Check size={13} aria-hidden /> : <span aria-hidden>{i + 1}.</span>} {p}
                </button>
              </li>
            ))}
          </ol>

          <div className="mt-6 min-h-[18rem]">
            {paso === 0 && (
              <div className="space-y-5">
                <div>
                  <label htmlFor={idNombre} className="font-display text-lg font-semibold text-musgo">
                    ¿Cómo se llama tu personaje?
                  </label>
                  <input
                    id={idNombre}
                    className="input mt-2 w-full max-w-sm"
                    value={nombre}
                    maxLength={24}
                    autoComplete="off"
                    placeholder="Por ejemplo: Sofi"
                    onChange={(e) => setNombre(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && siguiente()}
                    aria-invalid={tocado && !listo[0]}
                    aria-describedby={`${idNombre}-ayuda`}
                  />
                  <p id={`${idNombre}-ayuda`} className={`mt-1 text-xs ${tocado && !listo[0] ? "text-bad" : "text-carbon/60"}`}>
                    De 2 a 24 letras. Es ficticio: no hace falta tu nombre real.
                  </p>
                </div>
                <fieldset>
                  <legend className="font-display text-lg font-semibold text-musgo">Elegí un avatar</legend>
                  <div className="mt-2 grid grid-cols-4 gap-2 sm:max-w-md">
                    {AVATARES.map((a) => (
                      <label
                        key={a}
                        className={`flex cursor-pointer flex-col items-center gap-1 rounded-lg border-2 p-2 transition ${avatar === a ? "border-musgo bg-musgo/5" : "border-transparent hover:border-bosque/40"}`}
                      >
                        <input type="radio" name="avatar" value={a} checked={avatar === a} onChange={() => setAvatar(a)} className="sr-only" />
                        <AvatarIcono avatar={a} size={44} />
                        <span className="text-[11px] text-carbon/70">{NOMBRE_AVATAR[a]}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>
              </div>
            )}

            {paso === 1 && (
              <fieldset>
                <legend className="font-display text-lg font-semibold text-musgo">¿De qué trabajás?</legend>
                <p className="mt-1 text-sm text-carbon/70">Tu trabajo define con cuánto arrancás. Más adelante podés capacitarte, pedir un aumento o emprender.</p>
                <div className="mt-3 grid gap-3">
                  {(Object.keys(OFICIOS) as OficioId[]).map((id) => {
                    const o = OFICIOS[id];
                    const a = PARAMETROS.arranques[o.arranque];
                    return (
                      <label
                        key={id}
                        className={`cursor-pointer rounded-lg border-2 bg-[var(--superficie)] p-4 transition ${oficio === id ? "border-musgo" : "border-[var(--line)] hover:border-bosque"}`}
                      >
                        <input type="radio" name="oficio" value={id} checked={oficio === id} onChange={() => setOficio(id)} className="sr-only" />
                        <span className="flex flex-wrap items-baseline justify-between gap-2">
                          <span className="font-display text-lg font-semibold text-musgo">{o.nombre}</span>
                          <span className="text-xs text-carbon/70">
                            Sueldo {gs(a.sueldo)} · Gastos fijos {gs(a.gastosFijos)}
                          </span>
                        </span>
                        <span className="mt-1 block text-sm text-carbon/75">
                          En {o.lugar}. {o.texto}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </fieldset>
            )}

            {paso === 2 && (
              <fieldset>
                <legend className="font-display text-lg font-semibold text-musgo">¿Cuál es tu meta?</legend>
                <p className="mt-1 text-sm text-carbon/70">No hay una correcta. Te va a acompañar en el escritorio para que veas cuánto te falta.</p>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  {(Object.keys(METAS) as MetaId[]).map((id) => (
                    <label
                      key={id}
                      className={`cursor-pointer rounded-lg border-2 bg-[var(--superficie)] p-4 transition ${meta === id ? "border-musgo" : "border-[var(--line)] hover:border-bosque"}`}
                    >
                      <input type="radio" name="meta" value={id} checked={meta === id} onChange={() => setMeta(id)} className="sr-only" />
                      <span className="block font-display font-semibold text-musgo">{METAS[id].nombre}</span>
                      <span className="mt-1 block text-sm text-carbon/75">{METAS[id].texto}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
            )}

            {paso === 3 && oficio && meta && (
              <div className="space-y-3 text-[15px] leading-relaxed">
                <h2 className="!text-xl">Todo listo, {nombre.trim()}</h2>
                <p>
                  Empezás como {OFICIOS[oficio].nombre.toLowerCase()} en {OFICIOS[oficio].lugar}. Cada mes cobrás, pagás y aparecen situaciones en tu escritorio.
                  Algunas se basan en casos reales.
                </p>
                <p>No hay respuestas correctas a la vista: decidís y ves las consecuencias. Después, NODO te explica qué pasó.</p>
                <p>Si te fundís, la carrera termina. Lo que aprendiste queda como herencia para la próxima.</p>
                {puntos > 0 && (
                  <p className="rounded-lg border border-cobre/60 bg-cobre/10 px-4 py-3 text-sm">
                    Herencia de tus carreras anteriores: {puntos} {puntos === 1 ? "lección aprendida" : "lecciones aprendidas"}. Arrancás con {gs(herencia)} extra.
                  </p>
                )}
              </div>
            )}
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--line)] pt-4">
            <button type="button" className="btn btn-ghost" onClick={() => setPaso((p) => Math.max(0, p - 1))} disabled={paso === 0}>
              <ArrowLeft size={16} aria-hidden /> Atrás
            </button>
            {paso < PASOS.length - 1 ? (
              <button type="button" className="btn btn-primary" onClick={siguiente} aria-disabled={!listo[paso]}>
                Seguir <ArrowRight size={16} aria-hidden />
              </button>
            ) : (
              <button
                type="button"
                className="btn btn-primary !px-6 !py-3 !text-base"
                disabled={ocupado || !oficio || !meta || !nombreValido(nombre)}
                onClick={() => oficio && meta && empezar({ nombre, avatar, oficio, meta })}
              >
                {ocupado && <Loader2 size={16} className="animate-spin" aria-hidden />} Empezar la carrera
              </button>
            )}
          </div>
          {tocado && !listo[paso] && paso > 0 && (
            <p role="alert" className="mt-2 text-sm text-bad">
              Elegí una opción para seguir.
            </p>
          )}
        </section>

        <aside aria-label="Vista previa de tu credencial" className="lg:sticky lg:top-32">
          <Credencial nombre={nombre} avatar={avatar} oficio={oficio} meta={meta} herencia={herencia} />
          <Aviso className="mx-auto mt-5 max-w-sm text-center !text-marfil/70" />
        </aside>
      </div>
    </div>
  );
}
