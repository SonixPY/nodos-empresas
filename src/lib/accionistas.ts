import type { Accionista } from "@/lib/types";

/**
 * Umbrales de la Ley 6446/2019 para identificar beneficiarios finales por
 * criterio objetivo: participación igual o mayor al 10% del capital, o
 * control de más del 25% de los votos. Los criterios de la ley se aplican
 * "en cascada" y hay criterios subjetivos (control, administración) que la
 * app no puede evaluar: el resultado es una alerta para revisar, no una
 * determinación.
 */
export const UMBRAL_CAPITAL_PCT = 10;
export const UMBRAL_VOTOS_PCT = 25;

export interface FilaAccionista extends Accionista {
  pctCapital: number;
  votos: number;
  pctVotos: number;
  posibleBF: boolean;
}

export function calcularParticipaciones(accionistas: Accionista[]) {
  const totalAcciones = accionistas.reduce((s, a) => s + Number(a.acciones || 0), 0);
  const totalVotos = accionistas.reduce((s, a) => s + Number(a.acciones || 0) * Number(a.votos_por_accion ?? 1), 0);

  const filas: FilaAccionista[] = accionistas.map((a) => {
    const acciones = Number(a.acciones || 0);
    const votos = acciones * Number(a.votos_por_accion ?? 1);
    const pctCapital = totalAcciones > 0 ? (acciones / totalAcciones) * 100 : 0;
    const pctVotos = totalVotos > 0 ? (votos / totalVotos) * 100 : 0;
    return {
      ...a,
      pctCapital,
      votos,
      pctVotos,
      posibleBF: acciones > 0 && (pctCapital >= UMBRAL_CAPITAL_PCT || pctVotos > UMBRAL_VOTOS_PCT),
    };
  });

  filas.sort((x, y) => Number(y.acciones) - Number(x.acciones) || x.nombre.localeCompare(y.nombre));

  return { filas, totalAcciones, totalVotos };
}

export function formatPct(n: number): string {
  return `${n.toLocaleString("es-PY", { maximumFractionDigits: 2 })}%`;
}

export function formatNumero(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  return Number(n).toLocaleString("es-PY", { maximumFractionDigits: 2 });
}
