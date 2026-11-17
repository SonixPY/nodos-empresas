"use client";

import Link from "next/link";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { NOMBRE_MES, gastoMensual, type Evento } from "@/lib/nodos/aprender";
import { useCarrera } from "./CarreraProvider";
import { CHIP, ETIQUETA_TIPO, gs } from "./piezas";
import { estadoPostit } from "./Escritorio";

const DIAS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

/** El mes como calendario: qué entra, qué sale y qué hay que decidir, día por día. */
export default function CalendarioMes() {
  const { carrera, contenido, plan, cerrar, ocupado } = useCarrera();
  const hoy = plan?.eventos.find((e) => e.situacion)?.dia ?? 1;
  const [sel, setSel] = useState<number>(hoy);
  const [confirmar, setConfirmar] = useState(false);
  if (!carrera || !contenido || !plan) return null;

  const porDia = new Map<number, Evento[]>();
  for (const e of plan.eventos) porDia.set(e.dia, [...(porDia.get(e.dia) ?? []), e]);
  const celdas: (number | null)[] = [...Array(plan.primerDia).fill(null), ...Array.from({ length: plan.dias }, (_, i) => i + 1)];
  while (celdas.length % 7) celdas.push(null);

  const entra = plan.eventos.filter((e) => e.tipo === "ingreso").reduce((s, e) => s + (e.monto ?? 0), 0);
  const sale = gastoMensual(carrera) + (carrera.deudaTarjeta > 0 ? carrera.deudaTarjeta : 0);
  const pendientes = carrera.abiertas.filter((a) => !a.elegida).length;
  const delDia = porDia.get(sel) ?? [];
  const mes = NOMBRE_MES[plan.mesDelAnio - 1];

  const cerrarMes = async () => {
    if (pendientes > 0 && !confirmar) return setConfirmar(true);
    setConfirmar(false);
    await cerrar();
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <section aria-labelledby="cal-titulo" className="overflow-hidden rounded-lg bg-[var(--superficie)] shadow-lg">
        <div className="flex justify-center gap-24 bg-bosque py-1.5" aria-hidden>
          {[0, 1, 2, 3].map((i) => (
            <span key={i} className="-mt-3.5 h-7 w-3 rounded-full bg-carbon" />
          ))}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-5">
          <h1 id="cal-titulo" className="capitalize">
            {mes} <span className="text-base font-normal text-carbon/60">· año {plan.anio}</span>
          </h1>
          <ul className="flex flex-wrap gap-x-3 gap-y-1 text-xs" aria-label="Referencias">
            {(["ingreso", "gasto", "situacion", "vencimiento"] as const).map((t) => (
              <li key={t} className="flex items-center gap-1.5">
                <span className={`h-3 w-3 rounded-sm ${CHIP[t].split(" ")[0]}`} aria-hidden />
                {ETIQUETA_TIPO[t]}
              </li>
            ))}
          </ul>
        </div>
        <div className="overflow-x-auto px-2 pb-3 sm:px-4">
          <div className="grid min-w-[36rem] grid-cols-7 border-t border-[var(--line)]" role="grid" aria-label={`Calendario de ${mes}`}>
            {DIAS.map((d) => (
              <div key={d} role="columnheader" className="px-2 py-1.5 text-xs font-semibold uppercase tracking-wide text-bosque">
                {d}
              </div>
            ))}
            {celdas.map((d, i) =>
              d === null ? (
                <div key={`v${i}`} className="min-h-24 border-b border-r border-[var(--line)] bg-[var(--sutil)]" aria-hidden />
              ) : (
                <button
                  key={d}
                  type="button"
                  role="gridcell"
                  aria-selected={sel === d}
                  aria-label={`Día ${d}${(porDia.get(d) ?? []).map((e) => `, ${e.titulo}`).join("")}`}
                  onClick={() => setSel(d)}
                  className={`flex min-h-24 min-w-0 flex-col items-start gap-1 overflow-hidden border-b border-r border-[var(--line)] p-1.5 text-left transition hover:bg-[var(--sutil)] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-cobre ${
                    sel === d ? "bg-[var(--sutil)] shadow-[inset_0_0_0_2px_var(--color-musgo)]" : ""
                  }`}
                >
                  <span className="font-display text-sm font-bold">{d}</span>
                  {(porDia.get(d) ?? []).map((e, j) => (
                    <span key={j} className={`line-clamp-2 max-w-full rounded-sm px-1.5 py-0.5 text-[11px] font-semibold leading-tight ${CHIP[e.tipo]}`}>
                      {e.situacion ? contenido.situaciones.get(e.situacion)?.titulo ?? e.titulo : e.titulo}
                    </span>
                  ))}
                </button>
              ),
            )}
          </div>
        </div>
      </section>

      <aside className="flex flex-col gap-4">
        <section aria-live="polite" className="rounded-lg bg-[var(--superficie)] p-5 shadow-lg">
          <h2 className="!text-base uppercase tracking-[0.08em] !text-bosque">
            Día {sel} de {mes}
          </h2>
          {delDia.length === 0 ? (
            <p className="mt-2 text-sm">Día tranquilo. Nada que decidir.</p>
          ) : (
            <ul className="mt-3 space-y-3">
              {delDia.map((e, i) => (
                <li key={i} className="border-b border-[var(--line)] pb-3 last:border-0 last:pb-0">
                  <span className={`inline-block rounded-sm px-1.5 py-0.5 text-[11px] font-semibold ${CHIP[e.tipo]}`}>{ETIQUETA_TIPO[e.tipo]}</span>
                  <p className="mt-1 font-display font-semibold">{e.situacion ? contenido.situaciones.get(e.situacion)?.titulo : e.titulo}</p>
                  {e.monto !== undefined && <p className="text-sm">{gs(e.monto, true)}</p>}
                  {e.situacion && (
                    <Link href={`/aprender/situacion/${e.situacion}`} className="btn btn-primary mt-2 !py-2">
                      {estadoPostit(carrera, e.situacion) === "decidir" ? "Decidir" : "Ver lo que decidiste"}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-lg border border-bosque bg-musgo p-5 text-marfil">
          <h2 className="!text-lg !text-marfil">Balance previsto</h2>
          <dl className="mt-2 space-y-1.5 text-sm">
            <div className="flex justify-between">
              <dt>Entra</dt>
              <dd className="font-semibold">{gs(entra, true)}</dd>
            </div>
            <div className="flex justify-between">
              <dt>Sale (gastos{carrera.deudaTarjeta > 0 ? " y tarjeta" : ""})</dt>
              <dd className="font-semibold">{gs(-sale)}</dd>
            </div>
            <div className="flex justify-between border-t border-bosque pt-1.5 text-[15px]">
              <dt>Queda</dt>
              <dd className="font-display text-lg font-bold">{gs(entra - sale, true)}</dd>
            </div>
          </dl>
          <p className="mt-2 text-xs text-marfil/80">Sin contar lo que decidas en las situaciones ni los movimientos de tus inversiones.</p>
          {confirmar ? (
            <div className="mt-3 rounded-md bg-marfil/10 p-3 text-sm" role="alert">
              <p>
                Tenés {pendientes} {pendientes === 1 ? "situación" : "situaciones"} sin decidir. Si cerrás, se aplica lo que pasaría si no hacés nada.
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <button type="button" className="btn bg-cobre text-musgo hover:bg-marfil" onClick={cerrarMes} disabled={ocupado}>
                  Cerrar igual
                </button>
                <button type="button" className="btn border border-marfil/40 text-marfil hover:bg-marfil/10" onClick={() => setConfirmar(false)}>
                  Volver
                </button>
              </div>
            </div>
          ) : (
            <button type="button" onClick={cerrarMes} disabled={ocupado} className="btn mt-3 w-full justify-center bg-cobre !py-3 !text-base font-bold text-musgo hover:bg-marfil">
              {ocupado && <Loader2 size={16} className="animate-spin" aria-hidden />} Cerrar {mes}
            </button>
          )}
        </section>
      </aside>
    </div>
  );
}
