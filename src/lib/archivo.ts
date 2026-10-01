"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import type { Empresa } from "@/lib/types";

/**
 * Archivo de documentos reales de cada empresa (tabla `archivos` + bucket
 * privado `archivo` de Supabase Storage, migración 006).
 *
 * Nombre obligatorio: "EMPRESA - DOCUMENTO (FECHA).ext". Ruta en Storage:
 * <user_id dueño de la empresa>/<empresa_id>/<nombre saneado>.
 */

export const BUCKET_ARCHIVO = "archivo";
export const MAX_BYTES_ARCHIVO = 20 * 1024 * 1024;

export type TipoArchivo =
  | "estatuto"
  | "acta_asamblea"
  | "acta_directorio"
  | "poder"
  | "constancia_ruc"
  | "certificado_tributario"
  | "libro_accionistas"
  | "balance"
  | "contrato"
  | "identidad"
  | "comprobante_inscripcion"
  | "otro";

/** `label`: lo que se ve en la lista. `nombre`: cómo entra en el nombre del archivo. */
export const TIPOS_ARCHIVO: { value: TipoArchivo; label: string; nombre: string }[] = [
  { value: "estatuto", label: "Estatuto / Acta de constitución", nombre: "Estatuto" },
  { value: "acta_asamblea", label: "Acta de asamblea", nombre: "Acta de asamblea" },
  { value: "acta_directorio", label: "Acta de directorio", nombre: "Acta de directorio" },
  { value: "poder", label: "Poder", nombre: "Poder" },
  { value: "constancia_ruc", label: "Constancia de RUC", nombre: "Constancia de RUC" },
  { value: "certificado_tributario", label: "Certificado de cumplimiento tributario", nombre: "Certificado de cumplimiento tributario" },
  { value: "libro_accionistas", label: "Libro de accionistas", nombre: "Libro de accionistas" },
  { value: "balance", label: "Balance / Estados contables", nombre: "Balance y estados contables" },
  { value: "contrato", label: "Contrato", nombre: "Contrato" },
  { value: "identidad", label: "Documento de identidad", nombre: "Documento de identidad" },
  { value: "comprobante_inscripcion", label: "Comprobante de inscripción", nombre: "Comprobante de inscripción" },
  { value: "otro", label: "Otro", nombre: "Documento" },
];

export const TIPO_ARCHIVO_LABEL = Object.fromEntries(TIPOS_ARCHIVO.map((t) => [t.value, t.label])) as Record<TipoArchivo, string>;

/** Extensión → tipo MIME aceptado por el bucket. */
export const MIME_POR_EXTENSION: Record<string, string> = {
  pdf: "application/pdf",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

export const ACCEPT_ARCHIVO = Object.keys(MIME_POR_EXTENSION)
  .map((e) => `.${e}`)
  .join(",");

export interface Archivo {
  id: string;
  user_id: string;
  empresa_id: string;
  tipo_documento: TipoArchivo;
  detalle: string | null;
  titulo: string;
  fecha_documento: string;
  storage_path: string;
  nombre_archivo: string;
  mime: string | null;
  tamano: number | null;
  subido_por: string | null;
  created_at: string;
}

// ─── nombres ──────────────────────────────────────────────────────────────

export function extensionDe(nombre: string): string {
  const m = /\.([a-zA-Z0-9]{1,5})$/.exec(nombre.trim());
  return m ? m[1].toLowerCase() : "";
}

/** Valida tipo y tamaño del archivo elegido. Devuelve el error o null. */
export function validarArchivo(file: File): string | null {
  const ext = extensionDe(file.name);
  if (!MIME_POR_EXTENSION[ext]) return "Formato no admitido. Subí PDF, imagen (JPG, PNG, WEBP), Word o Excel.";
  if (file.size > MAX_BYTES_ARCHIVO) return "El archivo supera los 20 MB.";
  if (file.size === 0) return "El archivo está vacío.";
  return null;
}

/** Quita caracteres que rompen nombres de archivo y espacios de más. */
function limpiarParte(s: string): string {
  return Array.from(s)
    .filter((c) => c.charCodeAt(0) >= 32)
    .join("")
    .replace(/[\\/:*?"<>|#%{}^~[\]`]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** La parte "DOCUMENTO": nombre del tipo + detalle opcional. */
export function tituloDocumento(tipo: TipoArchivo, detalle: string): string {
  const base = TIPOS_ARCHIVO.find((t) => t.value === tipo)?.nombre ?? "Documento";
  const d = limpiarParte(detalle);
  if (!d) return base;
  // "Otro" + detalle → solo el detalle ("Nota a la DNIT"), no "Documento Nota…".
  return tipo === "otro" ? d.charAt(0).toUpperCase() + d.slice(1) : `${base} ${d}`;
}

/**
 * "EMPRESA - DOCUMENTO (FECHA).ext". `n` > 1 agrega " (n)" antes de la
 * extensión para no pisar otro archivo con el mismo nombre.
 */
export function nombreFinal(denominacion: string, documento: string, fecha: string, ext: string, n = 1): string {
  const emp = limpiarParte(denominacion).slice(0, 80) || "Empresa";
  const doc = limpiarParte(documento).slice(0, 100) || "Documento";
  const sufijo = n > 1 ? ` (${n})` : "";
  return `${emp} - ${doc} (${fecha})${sufijo}${ext ? `.${ext}` : ""}`;
}

/**
 * Supabase Storage solo acepta claves ASCII "seguras": se quitan tildes y la
 * ñ, y cualquier otro carácter raro pasa a guion. El nombre lindo (con
 * tildes) queda en `nombre_archivo` y es el que se usa al descargar.
 */
export function claveSegura(nombre: string): string {
  return nombre
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/ñ/g, "n")
    .replace(/Ñ/g, "N")
    .replace(/[^A-Za-z0-9 _.,()&@+=-]/g, "-")
    .replace(/-{2,}/g, "-");
}

export function rutaStorage(empresa: Pick<Empresa, "id" | "user_id">, nombre: string): string {
  return `${empresa.user_id}/${empresa.id}/${claveSegura(nombre)}`;
}

/** Primer nombre libre (sin chocar con los existentes de la empresa). */
export function nombreLibre(
  denominacion: string,
  documento: string,
  fecha: string,
  ext: string,
  ocupados: Set<string>,
  desde = 1,
): { nombre: string; n: number } {
  let n = desde;
  for (;;) {
    const nombre = nombreFinal(denominacion, documento, fecha, ext, n);
    if (!ocupados.has(claveSegura(nombre).toLowerCase())) return { nombre, n };
    n++;
  }
}

export function formatTamano(bytes: number | null): string {
  if (bytes == null) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`;
}

// ─── datos ────────────────────────────────────────────────────────────────

/** Archivos de una empresa, o de todas si `empresaId` es null. */
export function useArchivos(empresaId: string | null) {
  const [data, setData] = useState<Archivo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const idRef = useRef(empresaId);

  useEffect(() => {
    idRef.current = empresaId;
  });

  const reload = useCallback(async () => {
    const id = idRef.current;
    const q = supabase.from("archivos").select("*").order("fecha_documento", { ascending: false });
    const res = await (id ? q.eq("empresa_id", id) : q);
    if (res.error) setError(res.error.message);
    else {
      setError(null);
      setData((res.data ?? []) as Archivo[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    reload();
  }, [reload, empresaId]);

  return { data, loading, error, reload, setData };
}

export interface SubidaArchivo {
  empresa: Empresa;
  tipo: TipoArchivo;
  detalle: string;
  fecha: string;
  file: File;
  /** Nombres (storage_path) ya usados en esa empresa, para no chocar. */
  existentes: Archivo[];
}

/**
 * Sube el archivo con el nombre obligatorio y registra sus metadatos. Si el
 * nombre ya existe en Storage, prueba con " (2)", " (3)"…; si falla el
 * registro en la tabla, borra el archivo subido para no dejar huérfanos.
 */
export async function subirArchivo(s: SubidaArchivo): Promise<{ data: Archivo | null; error: string | null }> {
  const ext = extensionDe(s.file.name);
  const mime = MIME_POR_EXTENSION[ext] ?? s.file.type;
  const documento = tituloDocumento(s.tipo, s.detalle);
  const ocupados = new Set(
    s.existentes.filter((a) => a.empresa_id === s.empresa.id).map((a) => a.storage_path.split("/").pop()!.toLowerCase()),
  );

  let desde = 1;
  for (let intento = 0; intento < 6; intento++) {
    const { nombre, n } = nombreLibre(s.empresa.denominacion, documento, s.fecha, ext, ocupados, desde);
    const ruta = rutaStorage(s.empresa, nombre);
    const up = await supabase.storage.from(BUCKET_ARCHIVO).upload(ruta, s.file, { contentType: mime, upsert: false, cacheControl: "3600" });
    if (up.error) {
      const msg = up.error.message ?? "";
      if (/exist|duplicate|409/i.test(msg)) {
        ocupados.add(claveSegura(nombre).toLowerCase());
        desde = n + 1;
        continue;
      }
      return { data: null, error: msg };
    }
    const ins = await supabase
      .from("archivos")
      .insert({
        user_id: s.empresa.user_id,
        empresa_id: s.empresa.id,
        tipo_documento: s.tipo,
        detalle: s.detalle.trim() || null,
        titulo: documento,
        fecha_documento: s.fecha,
        storage_path: ruta,
        nombre_archivo: nombre,
        mime,
        tamano: s.file.size,
      })
      .select()
      .single();
    if (ins.error) {
      await supabase.storage.from(BUCKET_ARCHIVO).remove([ruta]);
      return { data: null, error: ins.error.message };
    }
    return { data: ins.data as Archivo, error: null };
  }
  return { data: null, error: "Ya existen demasiados archivos con ese nombre. Agregá un detalle distinto." };
}

/** Link de descarga temporal (60 s) con el nombre lindo del archivo. */
export async function urlDescarga(a: Archivo): Promise<{ url: string | null; error: string | null }> {
  const { data, error } = await supabase.storage.from(BUCKET_ARCHIVO).createSignedUrl(a.storage_path, 60, { download: a.nombre_archivo });
  return { url: data?.signedUrl ?? null, error: error?.message ?? null };
}

/** Borra primero el archivo y después el registro (si el archivo ya no estaba, sigue igual). */
export async function eliminarArchivo(a: Archivo): Promise<{ error: string | null }> {
  const rm = await supabase.storage.from(BUCKET_ARCHIVO).remove([a.storage_path]);
  if (rm.error && !/not.?found/i.test(rm.error.message)) return { error: rm.error.message };
  const { error } = await supabase.from("archivos").delete().eq("id", a.id);
  return { error: error?.message ?? null };
}
