"use client";

import { supabase } from "@/lib/supabaseClient";
import { mensajeError } from "@/lib/nodos/errores";
import { todayIso } from "@/lib/dates";

/**
 * Descargas de NODOS Empresas en CSV (se abren en Excel o Google Sheets).
 * Cada tabla sale con columnas legibles y el nombre de la empresa en lugar
 * de su id. El respaldo completo (JSON) va por /api/cuenta/exportar.
 */

export interface Exportable {
  clave: string;
  titulo: string;
  descripcion: string;
  tabla: string;
  /** columna de la base → encabezado del CSV */
  columnas: [string, string][];
  orden: string;
}

export const EXPORTABLES: Exportable[] = [
  {
    clave: "empresas",
    titulo: "Empresas",
    descripcion: "Datos de cada empresa: tipo, RUC, domicilio, cierre y mandato.",
    tabla: "empresas",
    columnas: [
      ["denominacion", "Denominación"],
      ["tipo", "Tipo"],
      ["ruc", "RUC"],
      ["domicilio", "Domicilio"],
      ["ciudad", "Ciudad"],
      ["fecha_constitucion", "Constitución"],
      ["cierre_mes", "Mes de cierre"],
      ["vencimiento_mandato", "Vence el mandato"],
      ["capital_integrado", "Capital integrado (Gs.)"],
      ["rubro", "Rubro"],
      ["regimen_tributario", "Régimen tributario"],
    ],
    orden: "denominacion",
  },
  {
    clave: "accionistas",
    titulo: "Accionistas",
    descripcion: "Libro de accionistas o socios de cada empresa.",
    tabla: "accionistas",
    columnas: [
      ["empresa_id", "Empresa"],
      ["nombre", "Nombre"],
      ["documento", "Documento"],
      ["tipo_persona", "Persona"],
      ["vinculo", "Vínculo"],
      ["acciones", "Acciones o cuotas"],
      ["cargo", "Cargo"],
      ["activo", "Activo"],
    ],
    orden: "nombre",
  },
  {
    clave: "vencimientos",
    titulo: "Vencimientos",
    descripcion: "Calendario completo: fecha, categoría, estado y qué hay que hacer.",
    tabla: "obligaciones",
    columnas: [
      ["empresa_id", "Empresa"],
      ["fecha", "Fecha"],
      ["titulo", "Vencimiento"],
      ["categoria", "Categoría"],
      ["estado", "Estado"],
      ["completado_en", "Hecho el"],
      ["descripcion", "Qué hacer"],
    ],
    orden: "fecha",
  },
  {
    clave: "documentos",
    titulo: "Documentos generados",
    descripcion: "Lista de actas, notas y poderes generados (sin el texto del documento).",
    tabla: "documentos",
    columnas: [
      ["empresa_id", "Empresa"],
      ["titulo", "Documento"],
      ["plantilla", "Plantilla"],
      ["created_at", "Generado"],
    ],
    orden: "created_at",
  },
  {
    clave: "poderes",
    titulo: "Poderes",
    descripcion: "Apoderados, tipo de poder, otorgamiento y vencimiento.",
    tabla: "poderes",
    columnas: [
      ["empresa_id", "Empresa"],
      ["apoderado", "Apoderado"],
      ["apoderado_documento", "Documento"],
      ["tipo", "Tipo"],
      ["fecha_otorgamiento", "Otorgado"],
      ["instrumento", "Instrumento"],
      ["fecha_vencimiento", "Vence"],
    ],
    orden: "fecha_otorgamiento",
  },
  {
    clave: "archivo",
    titulo: "Archivo (lista)",
    descripcion: "Nombre, tipo y fecha de cada archivo subido. Los archivos se bajan desde la ficha.",
    tabla: "archivos",
    columnas: [
      ["empresa_id", "Empresa"],
      ["nombre_archivo", "Archivo"],
      ["tipo_documento", "Tipo"],
      ["fecha_documento", "Fecha del documento"],
      ["created_at", "Subido"],
    ],
    orden: "fecha_documento",
  },
];

function celda(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = typeof v === "boolean" ? (v ? "Sí" : "No") : String(v);
  return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Arma y descarga el CSV de una tabla. Devuelve cuántas filas salieron. */
export async function descargarCsv(clave: string): Promise<number> {
  const ex = EXPORTABLES.find((e) => e.clave === clave);
  if (!ex) throw new Error("Descarga desconocida.");
  const cols = ex.columnas.map(([c]) => c);
  const [filas, empresas] = await Promise.all([
    supabase.from(ex.tabla).select(cols.join(", ")).order(ex.orden, { ascending: true }).limit(10000),
    cols.includes("empresa_id") ? supabase.from("empresas").select("id, denominacion") : Promise.resolve({ data: [], error: null }),
  ]);
  if (filas.error) throw new Error(mensajeError(filas.error));
  const nombres = new Map(((empresas.data ?? []) as { id: string; denominacion: string }[]).map((e) => [e.id, e.denominacion]));
  const datos = (filas.data ?? []) as unknown as Record<string, unknown>[];
  const lineas = [
    ex.columnas.map(([, h]) => celda(h)).join(","),
    ...datos.map((f) => cols.map((c) => celda(c === "empresa_id" ? (nombres.get(String(f[c])) ?? f[c]) : f[c])).join(",")),
  ];
  // BOM para que Excel lea bien tildes y ñ.
  const blob = new Blob(["﻿" + lineas.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `NODOS Empresas - ${ex.titulo} (${todayIso()}).csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return datos.length;
}
