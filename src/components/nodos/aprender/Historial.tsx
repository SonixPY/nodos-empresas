"use client";

import { useEffect, useState } from "react";
import { NOMBRE_ETAPA } from "@/lib/nodos/aprender";
import type { FilaCarrera, FilaTurno } from "@/lib/nodos/aprender/datos";
import { useCarrera } from "./CarreraProvider";
import { gs } from "./piezas";

const ESTADO: Record<FilaCarrera["estado"], string> = {
  activa: "En curso",
  quebrada: "Quebró",
  libre: "Libertad financiera",
  abandonada: "Terminada por vos",
};

function Grafico({ turnos }: { turnos: FilaTurno[] }) {
  if (turnos.length < 2) return <p className="text-sm text-carbon/60">El gráfico aparece después de cerrar dos meses.</p>;
  const w = 600;
  const h = 160;
  const vals = turnos.map((t) => t.patrimonio);
  const bajo = Math.min(...vals);
  const alto = Math.max(...vals);
  const margen = Math.max(1, (alto - bajo) * 0.15);
  const min = bajo - margen;
  const max = alto + margen;
  const x = (i: number) => (i / (turnos.length - 1)) * w;
  const y = (v: number) => h - ((v - min) / (max - min)) * h;
  const puntos = vals.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const ultimo = vals[vals.length - 1];
  return (
    <figure>
      <svg viewBox={`0 0 ${w} ${h}`} className="h-40 w-full" role="img" aria-label={`Patrimonio mes a mes: de ${gs(vals[0])} a ${gs(ultimo)}`}>
        {min < 0 && max > 0 && <line x1="0" x2={w} y1={y(0)} y2={y(0)} stroke="currentColor" strokeOpacity="0.25" strokeDasharray="4 4" />}
        <polyline points={puntos} fill="none" stroke="var(--color-bosque)" strokeWidth="3" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        <circle cx={x(vals.length - 1)} cy={y(ultimo)} r="5" fill="var(--color-cobre)" />
      </svg>
      <figcaption className="mt-1 flex justify-between text-xs text-carbon/60">
        <span>Mes {turnos[0].mes}</span>
        <span>Patrimonio · mes {turnos[turnos.length - 1].mes}: {gs(ultimo)}</span>
      </figcaption>
    </figure>
  );
}

/** Carreras anteriores y la evolución de la actual. */
export default function Historial() {
  const { fila, abandonar, ocupado, almacen } = useCarrera();
  const [carreras, setCarreras] = useState<FilaCarrera[] | null>(null);
  const [sel, setSel] = useState<string | null>(null);
  const [cargados, setCargados] = useState<{ id: string; mes?: number; turnos: FilaTurno[] } | null>(null);
  const [confirmar, setConfirmar] = useState(false);

  useEffect(() => {
    almacen
      .cargarCarreras()
      .then((c) => {
        setCarreras(c);
        setSel((s) => s ?? c[0]?.id ?? null);
      })
      .catch(() => setCarreras([]));
  }, [fila?.id, fila?.mes, almacen]);

  const mesActual = fila?.mes;
  useEffect(() => {
    if (!sel) return;
    let vivo = true;
    almacen
      .cargarTurnos(sel)
      .then((t) => vivo && setCargados({ id: sel, mes: mesActual, turnos: t }))
      .catch(() => vivo && setCargados({ id: sel, mes: mesActual, turnos: [] }));
    return () => {
      vivo = false;
    };
  }, [sel, mesActual, almacen]);

  const elegida = carreras?.find((c) => c.id === sel);
  const turnos = cargados && cargados.id === sel && cargados.mes === mesActual ? cargados.turnos : null;

  return (
    <div>
      <h1>Historial</h1>
      {carreras === null ? (
        <p className="mt-3 text-carbon/70">Cargando…</p>
      ) : carreras.length === 0 ? (
        <p className="mt-3 text-carbon/70">Todavía no empezaste ninguna carrera.</p>
      ) : (
        <div className="mt-5 grid gap-6 lg:grid-cols-[18rem_minmax(0,1fr)]">
          <ul className="flex flex-col gap-2" aria-label="Tus carreras">
            {carreras.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  aria-pressed={c.id === sel}
                  onClick={() => setSel(c.id)}
                  className={`w-full rounded-lg border-2 bg-[var(--superficie)] p-3 text-left transition ${c.id === sel ? "border-musgo" : "border-transparent hover:border-bosque/40"}`}
                >
                  <span className="block font-display font-semibold text-musgo">Carrera n.º {c.numero}</span>
                  <span className="block text-sm text-carbon/70">
                    {ESTADO[c.estado]} · {c.mes - (c.estado === "activa" ? 1 : 0)} meses · {NOMBRE_ETAPA[c.etapa]}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          {elegida && (
            <section className="rounded-lg border border-[var(--line)] bg-[var(--superficie)] p-5" aria-label={`Carrera n.º ${elegida.numero}`}>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <p className="text-xs text-carbon/65">Estado</p>
                  <p className="font-semibold">{ESTADO[elegida.estado]}</p>
                </div>
                <div>
                  <p className="text-xs text-carbon/65">Etapa más alta</p>
                  <p className="font-semibold">{NOMBRE_ETAPA[elegida.datos.etapaMax]}</p>
                </div>
                <div>
                  <p className="text-xs text-carbon/65">Salud financiera</p>
                  <p className="font-semibold">{elegida.indice_salud} / 100</p>
                </div>
              </div>
              <div className="mt-5">{turnos ? <Grafico turnos={turnos} /> : <p className="text-sm text-carbon/60">Cargando…</p>}</div>
              {elegida.estado === "activa" && (
                <div className="mt-6 border-t border-[var(--line)] pt-4">
                  {confirmar ? (
                    <div role="alert" className="text-sm">
                      <p>Vas a terminar esta carrera. Las lecciones que aprendiste quedan como herencia para la próxima.</p>
                      <div className="mt-2 flex gap-2">
                        <button type="button" className="btn btn-primary" disabled={ocupado} onClick={() => abandonar().then(() => setConfirmar(false))}>
                          Terminar la carrera
                        </button>
                        <button type="button" className="btn btn-ghost" onClick={() => setConfirmar(false)}>
                          Seguir jugando
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button type="button" className="btn btn-ghost" onClick={() => setConfirmar(true)}>
                      Terminar esta carrera y empezar otra
                    </button>
                  )}
                </div>
              )}
            </section>
          )}
        </div>
      )}
    </div>
  );
}
