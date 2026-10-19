"use client";

import { supabase } from "@/lib/supabaseClient";
import { useQuery } from "@/lib/data";
import type { Accionista, EventoEntidad } from "@/lib/types";

/**
 * Vínculo Empresas → Finanzas (NODOS 1.0).
 *
 * Empresas publica eventos (dividendos, aportes, cesiones) para cada
 * accionista. Si el accionista conectó su cuenta NODOS (invitación aceptada),
 * el evento le llega a Finanzas; si no, queda esperando hasta que la conecte.
 * La base fija el destinatario: el navegador no puede elegirlo.
 */

/**
 * IDU (Ley 6380/2019): 8 % para residentes y 15 % para no residentes, que
 * retiene la sociedad al pagar o poner a disposición las utilidades. Es una
 * estimación para organizarse: la liquidación la hace el contador.
 */
export const IDU_RESIDENTE = 0.08;
export const IDU_NO_RESIDENTE = 0.15;

export interface LineaDistribucion {
  accionista: Accionista;
  pct: number;
  residente: boolean;
  bruto: number;
  retencion: number;
  neto: number;
}

/**
 * Reparte `total` (Gs., entero) según las acciones de cada accionista. Usa
 * el método del resto mayor: la suma de las partes da exactamente el total.
 */
export function calcularDistribucion(accionistas: Accionista[], total: number, residencia: Record<string, boolean>): LineaDistribucion[] {
  const conAcciones = accionistas.filter((a) => Number(a.acciones) > 0);
  const totalAcciones = conAcciones.reduce((s, a) => s + Number(a.acciones), 0);
  const monto = Math.max(0, Math.round(total));
  if (totalAcciones <= 0 || monto <= 0) return [];
  const exactos = conAcciones.map((a) => (monto * Number(a.acciones)) / totalAcciones);
  const base = exactos.map((x) => Math.floor(x));
  let resto = monto - base.reduce((s, x) => s + x, 0);
  const orden = exactos.map((x, i) => ({ i, frac: x - Math.floor(x) })).sort((p, q) => q.frac - p.frac);
  for (const { i } of orden) {
    if (resto <= 0) break;
    base[i] += 1;
    resto -= 1;
  }
  return conAcciones.map((a, i) => {
    const residente = residencia[a.id] ?? a.residente ?? true;
    const bruto = base[i];
    const retencion = Math.round(bruto * (residente ? IDU_RESIDENTE : IDU_NO_RESIDENTE));
    return {
      accionista: a,
      pct: (Number(a.acciones) / totalAcciones) * 100,
      residente,
      bruto,
      retencion,
      neto: bruto - retencion,
    };
  });
}

/** Publica un dividendo por accionista. Devuelve el error, si hubo. */
export async function publicarDividendos(empresaId: string, fecha: string, lineas: LineaDistribucion[], detalle: string | null) {
  const filas = lineas
    .filter((l) => l.bruto > 0)
    .map((l) => ({
      empresa_id: empresaId,
      accionista_id: l.accionista.id,
      tipo: "dividendo" as const,
      fecha,
      monto_bruto: l.bruto,
      retencion: l.retencion,
      monto_neto: l.neto,
      detalle: detalle?.trim() ? detalle.trim().slice(0, 300) : null,
    }));
  if (filas.length === 0) return { error: "No hay montos para publicar." };
  const { error } = await supabase.from("eventos_entidad").insert(filas);
  return { error: error ? error.message : null };
}

/** Eventos publicados por una empresa (los ve su equipo). */
export function useEventosEmpresa(empresaId: string) {
  return useQuery<EventoEntidad[]>(
    `eventos:${empresaId}`,
    () => supabase.from("eventos_entidad").select("*").eq("empresa_id", empresaId).order("fecha", { ascending: false }).limit(200),
    []
  );
}

/** Crea la invitación de un accionista y devuelve el enlace para compartir. */
export async function crearInvitacion(accionistaId: string): Promise<{ enlace: string | null; error: string | null }> {
  const { data, error } = await supabase.rpc("crear_invitacion_accionista", { p_accionista: accionistaId });
  if (error || typeof data !== "string") return { enlace: null, error: error?.message ?? "No se pudo crear la invitación." };
  // El token va después de "#": no viaja al servidor ni a la analítica, y
  // la página lo guarda en la pestaña mientras la persona ingresa.
  return { enlace: `${window.location.origin}/vincular#t=${data}`, error: null };
}

export async function desvincularAccionista(accionistaId: string) {
  const { error } = await supabase.rpc("desvincular_accionista", { p_accionista: accionistaId });
  return { error: error ? error.message : null };
}

export const EVENTO_LABEL: Record<EventoEntidad["tipo"], string> = {
  dividendo: "Dividendo",
  aporte: "Aporte de capital",
  cesion_entrada: "Recibió acciones",
  cesion_salida: "Transfirió acciones",
};

export function estadoEventoLabel(ev: EventoEntidad): string {
  if (ev.estado === "aplicado") return "Registrado en Finanzas";
  if (ev.estado === "descartado") return "Descartado por el socio";
  if (ev.estado === "informativo") return ev.destinatario ? "Visible para el socio" : "Socio sin conectar";
  return ev.destinatario ? "Pendiente en Finanzas" : "Espera que el socio se conecte";
}
