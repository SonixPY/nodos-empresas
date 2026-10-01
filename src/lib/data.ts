"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { generarObligacionesAnuales } from "@/lib/calendario";
import { generarObligacionesSeprelad, type PerfilSeprelad } from "@/lib/seprelad";
import type { Accionista, Documento, Empresa, MovimientoAcciones, Obligacion } from "@/lib/types";
import type { NotaNodos } from "@/lib/novedades";

interface Estado<T> {
  data: T;
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
  setData: React.Dispatch<React.SetStateAction<T>>;
}

/**
 * Hook genérico: corre una consulta al montar (y cada vez que cambia `key`)
 * y expone `reload` para volver a traer los datos después de un cambio.
 */
function useQuery<T>(key: string, fetcher: () => PromiseLike<{ data: T | null; error: { message: string } | null }>, initial: T): Estado<T> {
  const [data, setData] = useState<T>(initial);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const fetcherRef = useRef(fetcher);
  const initialRef = useRef(initial);

  useEffect(() => {
    fetcherRef.current = fetcher;
  });

  const reload = useCallback(async () => {
    const res = await fetcherRef.current();
    if (res.error) setError(res.error.message);
    else {
      setError(null);
      setData((res.data ?? initialRef.current) as T);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    reload();
  }, [reload, key]);

  return { data, loading, error, reload, setData };
}

export function useEmpresas() {
  return useQuery<Empresa[]>("empresas", () => supabase.from("empresas").select("*").order("denominacion"), []);
}

export function useEmpresa(id: string) {
  return useQuery<Empresa | null>(`empresa:${id}`, () => supabase.from("empresas").select("*").eq("id", id).maybeSingle(), null);
}

export function useAccionistas(empresaId: string | null) {
  return useQuery<Accionista[]>(
    `accionistas:${empresaId}`,
    async () =>
      empresaId
        ? await supabase.from("accionistas").select("*").eq("empresa_id", empresaId).order("acciones", { ascending: false })
        : { data: [], error: null },
    []
  );
}

export function useMovimientos(empresaId: string) {
  return useQuery<MovimientoAcciones[]>(
    `movimientos:${empresaId}`,
    () => supabase.from("movimientos_acciones").select("*").eq("empresa_id", empresaId).order("fecha", { ascending: false }),
    []
  );
}

/** Obligaciones de una empresa, o de todas si `empresaId` es null. */
export function useObligaciones(empresaId: string | null) {
  return useQuery<Obligacion[]>(
    `obligaciones:${empresaId}`,
    () => {
      const q = supabase.from("obligaciones").select("*").order("fecha");
      return empresaId ? q.eq("empresa_id", empresaId) : q;
    },
    []
  );
}

export function useDocumentos(empresaId: string | null) {
  return useQuery<Documento[]>(
    `documentos:${empresaId}`,
    () => {
      const q = supabase.from("documentos").select("*").order("created_at", { ascending: false });
      return empresaId ? q.eq("empresa_id", empresaId) : q;
    },
    []
  );
}

/**
 * Inserta las obligaciones del calendario anual. Si ya se generó ese año,
 * no duplica (índice único empresa + regla + año) y no pisa lo que el
 * usuario ya marcó como hecho.
 */
export async function generarCalendario(empresa: Empresa, anio: number): Promise<{ nuevas: number; error: string | null }> {
  const filas = generarObligacionesAnuales(empresa, anio);
  const { data, error } = await supabase
    .from("obligaciones")
    .upsert(filas, { onConflict: "empresa_id,regla,anio", ignoreDuplicates: true })
    .select("id");
  return { nuevas: data?.length ?? 0, error: error?.message ?? null };
}

export async function marcarObligacion(id: string, hecho: boolean) {
  return supabase
    .from("obligaciones")
    .update({ estado: hecho ? "hecho" : "pendiente", completado_en: hecho ? new Date().toISOString() : null })
    .eq("id", id);
}

// ── SEPRELAD ──────────────────────────────────────────────────────────────

export function usePerfilSeprelad(empresaId: string | null) {
  return useQuery<PerfilSeprelad | null>(
    `perfil_seprelad:${empresaId}`,
    async () =>
      empresaId
        ? await supabase.from("perfil_seprelad").select("*").eq("empresa_id", empresaId).maybeSingle()
        : { data: null, error: null },
    null
  );
}

/** Sectores SEPRELAD de todas las empresas visibles (para Novedades). */
export function useSectoresSeprelad() {
  return useQuery<Pick<PerfilSeprelad, "empresa_id" | "sectores">[]>(
    "perfil_seprelad:sectores",
    () => supabase.from("perfil_seprelad").select("empresa_id, sectores"),
    []
  );
}

// ── Notas NODOS (migración 008) ───────────────────────────────────────────

/** Notas editoriales. Con `todas` (Panel) trae también los borradores; RLS
 * solo se los entrega a administradores. */
export function useNotasNodos(todas = false) {
  return useQuery<NotaNodos[]>(
    `notas_nodos:${todas}`,
    () => {
      const q = supabase.from("notas_nodos").select("*");
      return todas
        ? q.order("created_at", { ascending: false })
        : q.eq("publicada", true).order("destacada", { ascending: false }).order("publicada_el", { ascending: false }).limit(30);
    },
    []
  );
}

export async function guardarPerfilSeprelad(perfil: PerfilSeprelad) {
  return supabase
    .from("perfil_seprelad")
    .upsert({ ...perfil, updated_at: new Date().toISOString() }, { onConflict: "empresa_id" })
    .select()
    .single();
}

export async function generarCalendarioSeprelad(
  empresa: Empresa,
  perfil: PerfilSeprelad,
  anio: number
): Promise<{ nuevas: number; error: string | null }> {
  const filas = generarObligacionesSeprelad(empresa, perfil, anio);
  if (filas.length === 0) return { nuevas: 0, error: null };
  const { data, error } = await supabase
    .from("obligaciones")
    .upsert(filas, { onConflict: "empresa_id,regla,anio", ignoreDuplicates: true })
    .select("id");
  return { nuevas: data?.length ?? 0, error: error?.message ?? null };
}
