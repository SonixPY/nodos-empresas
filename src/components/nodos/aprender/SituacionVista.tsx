"use client";

import Link from "next/link";
import { ArrowLeft, Check } from "lucide-react";
import { ACTIVOS, minutosSituacion, puedeDecidir } from "@/lib/nodos/aprender";
import { useCarrera } from "./CarreraProvider";
import { Aviso, COLOR_POSTIT, gs } from "./piezas";

/** Una situación del mes: contexto y opciones. La consecuencia llega al cerrar el mes. */
export default function SituacionVista({ id }: { id: string }) {
  const { carrera, contenido, decidir } = useCarrera();
  if (!carrera || !contenido) return null;
  const s = contenido.situaciones.get(id);
  const abierta = carrera.abiertas.find((a) => a.id === id);

  if (!s || !abierta) {
    return (
      <div className="mx-auto max-w-xl text-center">
        <h1>Esta situación ya no está en tu escritorio</h1>
        <p className="mt-2 text-carbon/75">
          Puede que ya se haya cerrado. Lo que aprendiste quedó en tu
          biblioteca.
        </p>
        <Link href="/aprender" className="btn btn-primary mt-4">
          Volver al escritorio
        </Link>
      </div>
    );
  }

  const editable = puedeDecidir(carrera, id);
  const posicion = s.trayectoria
    ? carrera.activos[s.trayectoria.activo]
    : undefined;

  return (
    <div>
      <Link
        href="/aprender"
        className="inline-flex min-h-11 items-center gap-2 text-sm text-cobre-hover hover:underline"
      >
        <ArrowLeft size={16} aria-hidden /> Volver al escritorio
      </Link>
      <div className="mt-3 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="self-start rounded-lg bg-[#B89A72] p-2.5 shadow-[0_10px_30px_rgba(0,0,0,0.25)]">
          <div className="rounded-sm bg-[radial-gradient(rgba(0,0,0,0.12)_1px,transparent_1.4px)] bg-[length:9px_9px] p-5 ring-8 ring-inset ring-[#7A5F42] sm:p-7">
            <article
              className="relative p-6 shadow-[0_8px_14px_rgba(0,0,0,0.3)] sm:p-7 lg:-rotate-[0.6deg]"
              style={{ background: COLOR_POSTIT[s.tipo] }}
            >
              <span
                aria-hidden
                className="absolute -top-2.5 left-1/2 h-[18px] w-[18px] -translate-x-1/2 rounded-full bg-cobre shadow"
              />
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-bosque">
                {s.tipo === "oportunidad"
                  ? "Oportunidad"
                  : s.tipo === "vencimiento"
                    ? "Vencimiento"
                    : "Situación"}
                {abierta.desde < carrera.mes && " · sigue abierta"}
                <span className="font-normal normal-case tracking-normal text-carbon/60"> · ≈ {minutosSituacion(s)} min</span>
              </p>
              <h1 className="mt-2 !text-carbon">{s.titulo}</h1>
              <p className="mt-3 text-[15px] leading-relaxed text-carbon">
                {s.texto}
              </p>
              {posicion && (
                <div className="mt-4 grid grid-cols-2 gap-3 rounded-md bg-white/70 p-3 text-sm">
                  <div>
                    <p className="text-xs text-bosque">
                      {ACTIVOS[s.trayectoria!.activo].nombre} hoy
                    </p>
                    <p className="font-display text-lg font-bold">
                      {gs(posicion.valor)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-bosque">Ganancia o pérdida</p>
                    <p
                      className={`font-display text-lg font-bold ${posicion.valor < posicion.invertido ? "text-bad" : "text-good"}`}
                    >
                      {gs(posicion.valor - posicion.invertido, true)}
                    </p>
                  </div>
                </div>
              )}
              <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs text-bosque">Efectivo</p>
                  <p className="font-semibold">{gs(carrera.efectivo)}</p>
                </div>
                <div>
                  <p className="text-xs text-bosque">Ahorro</p>
                  <p className="font-semibold">{gs(carrera.ahorro)}</p>
                </div>
              </div>
            </article>
          </div>
        </div>

        <section
          aria-labelledby="opciones-titulo"
          className="flex flex-col gap-3"
        >
          <h2 id="opciones-titulo">
            {editable ? "¿Qué hacés?" : "Ya decidiste"}
          </h2>
          <div
            role="radiogroup"
            aria-labelledby="opciones-titulo"
            className="flex flex-col gap-3"
          >
            {s.opciones.map((o) => {
              const elegida = abierta.elegida === o.id;
              return (
                <button
                  key={o.id}
                  type="button"
                  role="radio"
                  aria-checked={elegida}
                  disabled={!editable}
                  onClick={() => decidir(id, o.id)}
                  className={`flex items-start gap-3 rounded-lg border-2 bg-[var(--superficie)] p-4 text-left shadow-sm transition enabled:hover:-translate-y-0.5 enabled:hover:border-bosque disabled:cursor-default ${
                    elegida ? "border-musgo" : "border-transparent"
                  } ${!editable && !elegida ? "opacity-50" : ""}`}
                >
                  <span
                    aria-hidden
                    className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${elegida ? "border-musgo bg-musgo text-marfil" : "border-bosque/50"}`}
                  >
                    {elegida && <Check size={12} />}
                  </span>
                  <span>
                    <span className="block font-display text-lg font-semibold text-musgo">
                      {o.titulo}
                    </span>
                    <span className="block text-sm leading-snug text-carbon/80">
                      {o.texto}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
          <p className="text-sm text-carbon/70">
            {editable
              ? abierta.elegida
                ? "Listo. Se aplica al cerrar el mes; hasta entonces podés cambiar de opinión."
                : s.trayectoria
                  ? "Si no decidís, la situación sigue abierta el mes que viene."
                  : "Si cerrás el mes sin decidir, se aplica lo que pasaría si no hacés nada."
              : "Tu decisión ya se aplicó. La lección de NODO llega cuando la situación termine."}
          </p>
          <div className="flex flex-wrap gap-2">
            <Link href="/aprender" className="btn btn-ghost">
              Volver al escritorio
            </Link>
            <Link href="/aprender/mes" className="btn btn-ghost">
              Ver el mes
            </Link>
          </div>
          <Aviso tipo={s.aviso} className="mt-2" />
        </section>
      </div>
    </div>
  );
}
