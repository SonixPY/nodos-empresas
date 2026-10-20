"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";
import { ArrowRight, Check, X, type LucideIcon } from "lucide-react";

/*
 * Primeros pasos del Resumen (mismo componente en NODOS Finanzas y NODOS
 * Empresas). Los pasos se completan solos con datos reales; la tarjeta se
 * puede ocultar (se guarda en este navegador) pero vuelve a aparecer a los
 * 7 días si todavía falta algo, y desaparece del todo cuando está todo hecho.
 */

const CLAVE_OCULTO = "nodos.primerosPasos.ocultoEl";
const CLAVE_VISTO = "nodos.primerosPasos.visto.";
const EVENTO = "nodos-primeros-pasos";
const REAPARECE_MS = 7 * 24 * 60 * 60 * 1000;

function leer(clave: string): string | null {
  try {
    return window.localStorage.getItem(clave);
  } catch {
    return null; // modo privado o almacenamiento bloqueado
  }
}

function escribir(clave: string, valor: string) {
  try {
    window.localStorage.setItem(clave, valor);
  } catch {
    // sin almacenamiento: la tarjeta solo se oculta hasta recargar
  }
  window.dispatchEvent(new Event(EVENTO));
}

function suscribir(cb: () => void) {
  window.addEventListener("storage", cb);
  window.addEventListener(EVENTO, cb);
  return () => {
    window.removeEventListener("storage", cb);
    window.removeEventListener(EVENTO, cb);
  };
}

const ocultosEnMemoria = new Set<string>();
const claveOculto = (id: string) => (id ? `${CLAVE_OCULTO}.${id}` : CLAVE_OCULTO);

function ocultoAhora(id: string): boolean {
  if (ocultosEnMemoria.has(id)) return true;
  const v = leer(claveOculto(id));
  if (!v) return false;
  const t = Date.parse(v);
  return Number.isFinite(t) && Date.now() - t < REAPARECE_MS;
}

const CLAVE_FORZAR = "nodos.primerosPasos.mostrar";

function forzado(): boolean {
  try {
    return window.sessionStorage.getItem(CLAVE_FORZAR) === "1";
  } catch {
    return false;
  }
}

/** Vuelve a mostrar la tarjeta (desde el menú de la cuenta), aunque esté todo hecho. */
export function mostrarPrimerosPasos() {
  ocultosEnMemoria.clear();
  try {
    window.sessionStorage.setItem(CLAVE_FORZAR, "1");
    for (const k of Object.keys(window.localStorage)) if (k.startsWith(CLAVE_OCULTO)) window.localStorage.removeItem(k);
  } catch {
    /* sin almacenamiento */
  }
  window.dispatchEvent(new Event(EVENTO));
}

/** Marca un paso que se completa con solo visitar una pantalla (p. ej. Vencimientos). */
export function marcarPasoVisto(paso: string) {
  if (leer(CLAVE_VISTO + paso) === "1") return;
  escribir(CLAVE_VISTO + paso, "1");
}

export function usePasoVisto(paso: string): boolean {
  return useSyncExternalStore(
    suscribir,
    () => leer(CLAVE_VISTO + paso) === "1",
    () => false,
  );
}

function useOculto(id: string): boolean {
  return useSyncExternalStore(suscribir, () => ocultoAhora(id), () => true);
}

export interface PasoInicial {
  key: string;
  icon: LucideIcon;
  titulo: string;
  texto: string;
  hecho: boolean;
  /** Con `href` lleva a otra pantalla; con `onClick` hace algo en la misma. */
  accion: { label: string; href?: string; onClick?: () => void };
  /** Camino alternativo (p. ej. "Importar de Binance"). */
  secundaria?: { label: string; href: string };
  /** Acción opcional para dar el paso por hecho a mano (p. ej. "Las dejo como están"). */
  omitir?: { label: string; onClick: () => void };
}

/** Si la tarjeta corresponde: datos cargados, falta algo y no la ocultaron en los últimos 7 días. */
export function usePrimerosPasosVisible(pasos: PasoInicial[], cargando: boolean, id = ""): boolean {
  const oculto = useOculto(id);
  const pedido = useSyncExternalStore(suscribir, forzado, () => false);
  return !cargando && !oculto && (pedido || pasos.some((p) => !p.hecho));
}

/** `id` separa tarjetas que comparten navegador (p. ej. Práctica y Finanzas). */
export default function PrimerosPasos({ app, pasos, id = "" }: { app: string; pasos: PasoInicial[]; id?: string }) {
  const hechos = pasos.filter((p) => p.hecho).length;
  const pct = Math.round((hechos / pasos.length) * 100);
  const siguiente = pasos.find((p) => !p.hecho)?.key;

  function ocultar() {
    try {
      window.sessionStorage.removeItem(CLAVE_FORZAR);
    } catch {
      /* sin almacenamiento */
    }
    ocultosEnMemoria.add(id);
    escribir(claveOculto(id), new Date().toISOString());
  }

  return (
    <section aria-labelledby="primeros-pasos-titulo" className="animate-fade-in card relative mb-6 overflow-hidden !p-5 sm:!p-6">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="t-caption uppercase tracking-[0.14em] text-cobre">Primeros pasos</p>
          <h2 id="primeros-pasos-titulo" className="mt-0.5 !text-[20px] !leading-7 sm:!text-[22px]">
            {hechos === pasos.length ? `${app} está listo` : `Dejá ${app} listo en ${pasos.length} pasos`}
          </h2>
        </div>
        <button
          type="button"
          onClick={ocultar}
          className="-mr-1 -mt-1 grid h-8 w-8 shrink-0 place-items-center rounded-md text-carbon/45 transition hover:bg-marfil hover:text-carbon"
          aria-label="Ocultar primeros pasos por ahora"
          title="Ocultar por ahora (vuelve en 7 días si falta algo)"
        >
          <X size={16} />
        </button>
      </div>

      <div className="mt-3 flex items-center gap-3">
        <div
          className="h-1.5 flex-1 overflow-hidden rounded-full bg-marfil"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={pasos.length}
          aria-valuenow={hechos}
          aria-label="Progreso de primeros pasos"
        >
          <div className="h-full rounded-full bg-cobre transition-all duration-500" style={{ width: `${Math.max(pct, 4)}%` }} />
        </div>
        <span className="t-caption shrink-0 tabular-nums text-carbon/60">
          {hechos} de {pasos.length} listos
        </span>
      </div>

      <ol className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-3">
        {pasos.map((p, i) => {
          const activo = p.key === siguiente;
          return (
            <li
              key={p.key}
              className="flex flex-col rounded-md border p-4 transition"
              style={{
                borderColor: activo ? "rgba(184,115,74,0.55)" : "var(--line)",
                background: p.hecho ? "rgba(63,107,82,0.05)" : activo ? "rgba(184,115,74,0.05)" : "var(--superficie)",
              }}
            >
              <div className="flex items-center gap-2.5">
                <span
                  className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-[13px] font-semibold ${
                    p.hecho ? "bg-good text-white" : activo ? "bg-cobre text-white" : "border text-carbon/55"
                  }`}
                  style={!p.hecho && !activo ? { borderColor: "var(--line)" } : undefined}
                  aria-hidden="true"
                >
                  {p.hecho ? <Check size={15} strokeWidth={2.5} /> : i + 1}
                </span>
                <p.icon size={17} className={p.hecho ? "text-good" : "text-cobre"} strokeWidth={1.75} aria-hidden="true" />
                <span className="sr-only">{p.hecho ? "Hecho:" : `Paso ${i + 1}:`}</span>
              </div>
              <h3 className={`mt-3 !text-[16px] !leading-6 ${p.hecho ? "!text-carbon/55 line-through decoration-carbon/25" : ""}`}>{p.titulo}</h3>
              <p className="mt-1 flex-1 text-[13px] leading-5 text-carbon/60">{p.texto}</p>
              {p.hecho ? (
                <p className="t-caption mt-3 text-good">Listo</p>
              ) : (
                <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1">
                  {p.accion.href ? (
                    <Link href={p.accion.href} className={`btn ${activo ? "btn-primary" : "btn-ghost"} !px-3 !py-1.5 text-[13px]`}>
                      {p.accion.label} <ArrowRight size={14} />
                    </Link>
                  ) : (
                    <button type="button" onClick={p.accion.onClick} className={`btn ${activo ? "btn-primary" : "btn-ghost"} !px-3 !py-1.5 text-[13px]`}>
                      {p.accion.label} <ArrowRight size={14} />
                    </button>
                  )}
                  {p.secundaria && (
                    <Link href={p.secundaria.href} className="text-[13px] font-medium text-cobre-hover underline-offset-2 hover:underline">
                      {p.secundaria.label}
                    </Link>
                  )}
                  {p.omitir && (
                    <button type="button" onClick={p.omitir.onClick} className="text-[13px] text-carbon/55 underline-offset-2 hover:text-cobre-hover hover:underline">
                      {p.omitir.label}
                    </button>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
