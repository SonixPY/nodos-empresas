"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowRight, BookOpen, Check, Clock, History } from "lucide-react";
import {
  ACTIVOS,
  NOMBRE_ETAPA,
  NOMBRE_MES,
  fechaDelMes,
  gastoMensual,
  mesesDeEmergencia,
  patrimonio,
  puedeDecidir,
  totalActivos,
  totalDeudas,
  type ActivoId,
  type Carrera,
  type Contenido,
  type PlanMes,
} from "@/lib/nodos/aprender";
import { useCarrera } from "./CarreraProvider";
import { COLOR_POSTIT, NodoIcono, gs } from "./piezas";

const ROTACIONES = [-2.5, 2, -1.5, 2.5, -2, 1.5];

export function estadoPostit(c: Carrera, id: string): "decidir" | "decidido" | "esperando" {
  const a = c.abiertas.find((x) => x.id === id);
  if (!a?.elegida) return "decidir";
  return puedeDecidir(c, id) ? "decidido" : "esperando";
}

function PostIt({ carrera, contenido, id, i }: { carrera: Carrera; contenido: Contenido; id: string; i: number }) {
  const s = contenido.situaciones.get(id);
  if (!s) return null;
  const estado = estadoPostit(carrera, id);
  const desde = carrera.abiertas.find((a) => a.id === id)?.desde ?? carrera.mes;
  return (
    <Link
      href={`/aprender/situacion/${id}`}
      className="postit group relative block min-h-44 rotate-(--rot) p-5 pt-6 text-carbon shadow-[0_8px_14px_rgba(0,0,0,0.3)] transition hover:-translate-y-1 hover:rotate-0 hover:shadow-[0_14px_24px_rgba(0,0,0,0.35)] focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-marfil"
      style={{ background: COLOR_POSTIT[s.tipo], ["--rot" as string]: `${ROTACIONES[i % ROTACIONES.length]}deg`, opacity: estado === "decidir" ? 1 : 0.85 }}
    >
      <span aria-hidden className="absolute -top-2 left-1/2 h-4 w-4 -translate-x-1/2 rounded-full bg-cobre shadow" />
      <span className="block text-[11px] font-semibold uppercase tracking-[0.08em] text-bosque">
        {s.tipo === "oportunidad" ? "Oportunidad" : s.tipo === "vencimiento" ? "Vencimiento" : desde < carrera.mes ? "Sigue abierta" : "Situación"}
      </span>
      <span className="mt-2 block font-[Caveat,cursive] text-[26px] leading-[1.05]">{s.postit}</span>
      <span className="absolute bottom-3 right-4 flex items-center gap-1 text-xs font-semibold text-bosque">
        {estado === "decidido" && (
          <>
            <Check size={14} aria-hidden /> decidido
          </>
        )}
        {estado === "esperando" && (
          <>
            <Clock size={14} aria-hidden /> en curso
          </>
        )}
        {estado === "decidir" && (
          <span className="opacity-0 transition group-hover:opacity-100 group-focus-visible:opacity-100">
            Decidir <ArrowRight size={13} className="inline" aria-hidden />
          </span>
        )}
      </span>
    </Link>
  );
}

function MonitorPlata({ c }: { c: Carrera }) {
  const salud = c.indiceSalud;
  const meses = mesesDeEmergencia(c);
  const activos = Object.entries(c.activos) as [ActivoId, { valor: number; invertido: number }][];
  return (
    <section aria-labelledby="monitor-titulo" className="rounded-2xl bg-carbon p-3 shadow-xl">
      <div className="rounded-lg bg-marfil p-4 sm:p-5">
        <div className="flex items-baseline justify-between gap-2">
          <h2 id="monitor-titulo" className="!text-xl">
            Tu plata
          </h2>
          <span className="rounded-sm border border-cobre px-2 py-0.5 text-xs font-medium">Etapa: {NOMBRE_ETAPA[c.etapa]}</span>
        </div>
        <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3">
          {[
            ["Efectivo", c.efectivo],
            ["Ahorro", c.ahorro],
            ["Inversiones", totalActivos(c)],
            ["Deudas", -totalDeudas(c)],
          ].map(([k, v]) => (
            <div key={k as string}>
              <dt className="text-xs text-bosque">{k}</dt>
              <dd className="whitespace-nowrap font-display text-[17px] font-semibold">{gs(v as number)}</dd>
            </div>
          ))}
        </dl>
        <div className="my-3 h-px bg-[var(--line)]" />
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs text-bosque">Patrimonio neto</p>
            <p className="font-display text-2xl font-bold sm:text-[28px]">{gs(patrimonio(c))}</p>
          </div>
          <div className="w-full max-w-56">
            <div className="flex justify-between text-xs">
              <span className="text-bosque">Salud financiera</span>
              <span className="font-semibold">{salud} / 100</span>
            </div>
            <div className="mt-1 h-2.5 overflow-hidden rounded-sm bg-[var(--line)]" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={salud} aria-label="Salud financiera">
              <div className="h-full bg-bosque transition-all" style={{ width: `${salud}%` }} />
            </div>
            <p className="mt-1 text-xs text-bosque">
              Fondo de emergencia: {meses.toLocaleString("es-PY", { maximumFractionDigits: 1 })} de 3 meses
            </p>
          </div>
        </div>
        {(activos.length > 0 || c.negocio || c.prestamo || c.deudaTarjeta > 0) && (
          <details className="mt-3 text-sm">
            <summary className="cursor-pointer text-bosque">Ver el detalle</summary>
            <ul className="mt-2 divide-y divide-[var(--line)]">
              {activos.map(([id, p]) => (
                <li key={id} className="flex justify-between gap-3 py-1.5">
                  <span>{ACTIVOS[id].nombre}</span>
                  <span>
                    {gs(p.valor)}{" "}
                    <span className={p.valor - p.invertido < 0 ? "text-bad" : "text-good"}>({gs(p.valor - p.invertido, true)})</span>
                  </span>
                </li>
              ))}
              {c.deudaTarjeta > 0 && (
                <li className="flex justify-between py-1.5">
                  <span>Tarjeta</span>
                  <span>{gs(-c.deudaTarjeta)}</span>
                </li>
              )}
              {c.prestamo && (
                <li className="flex justify-between py-1.5">
                  <span>Préstamo (cuota {gs(c.prestamo.cuota)})</span>
                  <span>{gs(-c.prestamo.saldo)}</span>
                </li>
              )}
              {c.negocio && (
                <li className="flex justify-between py-1.5">
                  <span className="capitalize">{c.negocio.nombre}</span>
                  <span>aporte {gs(c.negocio.aporte)}</span>
                </li>
              )}
              <li className="flex justify-between py-1.5">
                <span>Sueldo · gasto del mes</span>
                <span>
                  {gs(c.sueldo)} · {gs(gastoMensual(c))}
                </span>
              </li>
            </ul>
          </details>
        )}
      </div>
    </section>
  );
}

function consejosNodo(c: Carrera, plan: PlanMes): string[] {
  const pendientes = c.abiertas.filter((a) => !a.elegida).length;
  const m: string[] = [];
  if (pendientes) m.push(`Tenés ${pendientes} ${pendientes === 1 ? "cosa" : "cosas"} para decidir este mes.`);
  if (c.deudaTarjeta > 0) m.push("Vence la tarjeta el 15: pagar solo el mínimo genera intereses.");
  const meses = mesesDeEmergencia(c);
  if (meses < 3) m.push(`Tu fondo de emergencia cubre ${meses.toLocaleString("es-PY", { maximumFractionDigits: 1 })} meses. La meta son 3.`);
  if (plan.mesDelAnio === 12) m.push("En diciembre cobrás el aguinaldo: decidí antes qué vas a hacer con él.");
  if (c.mora > 0) m.push("Quedó una deuda impaga. Tres meses así terminan la carrera.");
  m.push("Las decisiones se aplican al cerrar el mes: hasta ahí podés cambiar de opinión.");
  return m;
}

export default function Escritorio() {
  const { carrera, contenido, plan } = useCarrera();
  const [consejo, setConsejo] = useState(0);
  const consejos = useMemo(() => (carrera && plan ? consejosNodo(carrera, plan) : []), [carrera, plan]);
  if (!carrera || !contenido || !plan) return null;
  const f = fechaDelMes(carrera.mes, carrera.semilla);
  const pendientes = carrera.abiertas.filter((a) => !a.elegida).length;

  return (
    <div className="-mx-4 rounded-none bg-[#2A3D31] px-4 py-6 sm:mx-0 sm:rounded-2xl sm:p-6 lg:p-8">
      <h1 className="sr-only">Escritorio</h1>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        {/* Corcho */}
        <section aria-labelledby="corcho-titulo" className="flex flex-col rounded-lg bg-[#B89A72] p-2.5 shadow-[0_10px_30px_rgba(0,0,0,0.35)]">
          <div className="relative min-h-[22rem] flex-1 rounded-sm bg-[radial-gradient(rgba(0,0,0,0.12)_1px,transparent_1.4px)] bg-[length:9px_9px] p-5 ring-8 ring-inset ring-[#7A5F42] sm:p-7">
            <h2 id="corcho-titulo" className="inline-block rounded-sm bg-marfil px-2.5 py-1 font-display !text-sm font-bold uppercase tracking-[0.08em] !text-carbon">
              Pendientes de {NOMBRE_MES[f.mesDelAnio - 1]}
            </h2>
            {plan.situaciones.length === 0 ? (
              <p className="mt-6 max-w-sm rounded-sm bg-marfil/90 p-4 font-[Caveat,cursive] text-2xl leading-tight text-carbon">
                Nada pendiente. Mirá el calendario y cerrá el mes.
              </p>
            ) : (
              <ul className="mt-6 grid gap-6 sm:grid-cols-2">
                {plan.situaciones.map((id, i) => (
                  <li key={id}>
                    <PostIt carrera={carrera} contenido={contenido} id={id} i={i} />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <div className="flex flex-col gap-6">
          <MonitorPlata c={carrera} />

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <Link
              href="/aprender/mes"
              className="col-span-2 flex overflow-hidden rounded-md bg-marfil text-carbon shadow-lg transition hover:-translate-y-0.5 sm:col-span-1 sm:flex-col"
            >
              <span className="flex items-center justify-center bg-cobre px-3 py-1 font-display text-xs font-bold uppercase tracking-[0.1em] text-musgo sm:py-1">
                {NOMBRE_MES[f.mesDelAnio - 1]}
              </span>
              <span className="flex flex-1 items-center justify-between gap-2 px-3 py-2 sm:flex-col sm:justify-center">
                <span className="font-display text-3xl font-bold">{carrera.mes}</span>
                <span className="text-xs text-bosque">{pendientes ? `${pendientes} por decidir` : "Cerrar el mes"}</span>
              </span>
            </Link>
            <Link href="/aprender/biblioteca" className="rounded-[4px_10px_10px_4px] bg-cobre-hover p-3.5 text-marfil shadow-lg transition hover:-translate-y-0.5">
              <BookOpen size={18} aria-hidden />
              <span className="mt-1 block font-display font-bold">Biblioteca</span>
              <span className="block text-xs text-marfil/85">{new Set(carrera.lecciones).size} lecciones</span>
            </Link>
            <Link href="/aprender/historial" className="rounded-md border-l-[10px] border-bosque bg-musgo p-3.5 text-marfil shadow-lg transition hover:-translate-y-0.5">
              <History size={18} aria-hidden />
              <span className="mt-1 block font-display font-bold">Historial</span>
              <span className="block text-xs text-marfil/85">Salud {carrera.indiceSalud} / 100</span>
            </Link>
          </div>

          <button
            type="button"
            onClick={() => setConsejo((n) => n + 1)}
            className="flex items-center gap-4 rounded-2xl border-2 border-cobre bg-musgo p-4 text-left text-marfil shadow-lg transition hover:-translate-y-0.5"
            aria-label={`NODO dice: ${consejos[consejo % Math.max(1, consejos.length)]}. Tocá para otro consejo.`}
          >
            <NodoIcono size={48} />
            <span>
              <span className="block font-display font-bold">NODO</span>
              <span className="block text-sm" aria-live="polite">
                {consejos[consejo % Math.max(1, consejos.length)]}
              </span>
            </span>
          </button>

          <Link href="/aprender/mes" className="btn btn-primary self-start">
            Ver el mes y cerrarlo <ArrowRight size={16} aria-hidden />
          </Link>
        </div>
      </div>
    </div>
  );
}
