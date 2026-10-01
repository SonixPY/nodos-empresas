"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { daysUntil, formatFecha, todayIso } from "@/lib/dates";

/**
 * Registro de poderes por empresa (tabla `poderes`, migración 006).
 * El vencimiento en la agenda (`obligaciones`) lo mantiene un trigger de la
 * base: la app solo guarda el poder.
 */

export type TipoPoder = "general" | "especial" | "judicial" | "administrativo" | "otro";

export const TIPO_PODER_LABELS: Record<TipoPoder, string> = {
  general: "General",
  especial: "Especial",
  judicial: "Judicial",
  administrativo: "Administrativo",
  otro: "Otro",
};

export interface Poder {
  id: string;
  user_id: string;
  empresa_id: string;
  apoderado: string;
  apoderado_documento: string | null;
  tipo: TipoPoder;
  facultades: string | null;
  fecha_otorgamiento: string;
  instrumento: string | null;
  escribano: string | null;
  fecha_inscripcion: string | null;
  registro: string | null;
  fecha_vencimiento: string | null;
  duracion_texto: string | null;
  estado: "vigente" | "revocado";
  revocado_el: string | null;
  notas: string | null;
  obligacion_id: string | null;
  documento_id: string | null;
  created_at: string;
  updated_at: string;
}

/** Lo que la app escribe (user_id y obligacion_id los fija la base). */
export type NuevoPoder = Omit<Poder, "id" | "user_id" | "obligacion_id" | "created_at" | "updated_at">;

/** Datos con los que el generador precarga el registro de un poder. */
export type PoderPrefill = Partial<Omit<NuevoPoder, "empresa_id" | "estado" | "revocado_el">>;

export function poderVacio(empresaId: string): NuevoPoder {
  return {
    empresa_id: empresaId,
    apoderado: "",
    apoderado_documento: null,
    tipo: "especial",
    facultades: null,
    fecha_otorgamiento: todayIso(),
    instrumento: null,
    escribano: null,
    fecha_inscripcion: null,
    registro: null,
    fecha_vencimiento: null,
    duracion_texto: null,
    estado: "vigente",
    revocado_el: null,
    notas: null,
    documento_id: null,
  };
}

export function aNuevoPoder(p: Poder): NuevoPoder {
  return {
    empresa_id: p.empresa_id,
    apoderado: p.apoderado,
    apoderado_documento: p.apoderado_documento,
    tipo: p.tipo,
    facultades: p.facultades,
    fecha_otorgamiento: p.fecha_otorgamiento,
    instrumento: p.instrumento,
    escribano: p.escribano,
    fecha_inscripcion: p.fecha_inscripcion,
    registro: p.registro,
    fecha_vencimiento: p.fecha_vencimiento,
    duracion_texto: p.duracion_texto,
    estado: p.estado,
    revocado_el: p.revocado_el,
    notas: p.notas,
    documento_id: p.documento_id,
  };
}

/** Días antes del vencimiento en que el poder pasa a "por vencer". */
export const DIAS_AVISO_PODER = 30;

export type ClaveEstadoPoder = "vigente" | "por_vencer" | "vencido" | "revocado";

export interface EstadoPoder {
  clave: ClaveEstadoPoder;
  label: string;
  dias: number | null;
}

/** Estado efectivo: "vencido" y "por vencer" se calculan con la fecha de hoy. */
export function estadoPoder(p: Pick<Poder, "estado" | "fecha_vencimiento" | "revocado_el">, hoy: string = todayIso()): EstadoPoder {
  if (p.estado === "revocado") {
    return { clave: "revocado", label: p.revocado_el ? `Revocado el ${formatFecha(p.revocado_el)}` : "Revocado", dias: null };
  }
  if (!p.fecha_vencimiento) return { clave: "vigente", label: "Vigente", dias: null };
  const dias = daysUntil(p.fecha_vencimiento, hoy);
  if (dias < 0) return { clave: "vencido", label: "Vencido", dias };
  if (dias === 0) return { clave: "por_vencer", label: "Vence hoy", dias };
  if (dias <= DIAS_AVISO_PODER) return { clave: "por_vencer", label: dias === 1 ? "Vence mañana" : `Vence en ${dias} días`, dias };
  return { clave: "vigente", label: "Vigente", dias };
}

export const ESTADO_PODER_ESTILO: Record<ClaveEstadoPoder, { color: string; background: string }> = {
  vigente: { color: "#3f6b52", background: "rgba(63,107,82,0.12)" },
  por_vencer: { color: "#8c5934", background: "rgba(184,115,74,0.15)" },
  vencido: { color: "#b23b3b", background: "rgba(178,59,59,0.1)" },
  revocado: { color: "rgba(36,37,34,0.65)", background: "rgba(36,37,34,0.07)" },
};

/** Poderes de una empresa, o de todas si `empresaId` es null. */
export function usePoderes(empresaId: string | null) {
  const [data, setData] = useState<Poder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const idRef = useRef(empresaId);

  useEffect(() => {
    idRef.current = empresaId;
  });

  const reload = useCallback(async () => {
    const id = idRef.current;
    const q = supabase.from("poderes").select("*").order("fecha_otorgamiento", { ascending: false });
    const res = await (id ? q.eq("empresa_id", id) : q);
    if (res.error) setError(res.error.message);
    else {
      setError(null);
      setData((res.data ?? []) as Poder[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    reload();
  }, [reload, empresaId]);

  return { data, loading, error, reload, setData };
}

function limpiar(p: NuevoPoder): NuevoPoder {
  const t = (s: string | null) => (s && s.trim() ? s.trim() : null);
  return {
    ...p,
    apoderado: p.apoderado.trim(),
    apoderado_documento: t(p.apoderado_documento),
    facultades: t(p.facultades),
    instrumento: t(p.instrumento),
    escribano: t(p.escribano),
    registro: t(p.registro),
    duracion_texto: t(p.duracion_texto),
    notas: t(p.notas),
    fecha_inscripcion: p.fecha_inscripcion || null,
    fecha_vencimiento: p.fecha_vencimiento || null,
    revocado_el: p.estado === "revocado" ? p.revocado_el || todayIso() : null,
  };
}

/** Valida lo mínimo antes de mandar a la base. Devuelve el error o null. */
export function validarPoder(p: NuevoPoder): string | null {
  if (!p.empresa_id) return "Elegí la empresa.";
  if (!p.apoderado.trim()) return "Escribí el nombre del apoderado.";
  if (!p.fecha_otorgamiento) return "La fecha de otorgamiento es obligatoria.";
  if (p.fecha_vencimiento && p.fecha_vencimiento < p.fecha_otorgamiento) return "El vencimiento no puede ser anterior al otorgamiento.";
  if (p.fecha_inscripcion && p.fecha_inscripcion < p.fecha_otorgamiento) return "La inscripción no puede ser anterior al otorgamiento.";
  return null;
}

export async function guardarPoder(p: NuevoPoder, id?: string | null) {
  const payload = limpiar(p);
  return id
    ? supabase.from("poderes").update(payload).eq("id", id).select().single()
    : supabase.from("poderes").insert(payload).select().single();
}

export async function revocarPoder(id: string, fecha: string) {
  return supabase.from("poderes").update({ estado: "revocado", revocado_el: fecha }).eq("id", id).select().single();
}

export async function eliminarPoder(id: string) {
  return supabase.from("poderes").delete().eq("id", id);
}
