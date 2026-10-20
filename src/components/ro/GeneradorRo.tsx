"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowUp, Check, CheckCircle2, ChevronDown, ChevronUp, Download, FileSpreadsheet, Lock, Paperclip, RotateCcw, Settings2, ShieldCheck, Upload, X } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { useToast } from "@/components/ToastProvider";
import { mensajeError } from "@/lib/nodos/errores";
import { formatPyg } from "@/lib/format";
import { CAMPOS, NUMERICOS, Normalizador, OPCIONES_LISTA, parsearFecha, rangoTrimestre, trimestreDe, type FilaCruda, type Observacion, type Regimen, type Registro, type TipoObservacion } from "@/lib/ro/normalizador";
import { destinosPosibles, extraer, extraerTabla, type Extraccion } from "@/lib/ro/extraer";
import { leerXlsx, ExcelNoSoportado, type Celda, type Hoja } from "@/lib/ro/xlsx";
import { decodificarTexto, leerCsv } from "@/lib/ro/csv";
import { aTextoCp1252, armarArchivos, esCp1252, sha256Hex } from "@/lib/ro/salida";
import { etiqueta } from "@/lib/ro/campos";
import { nombreCiudadPy } from "@/lib/ro/ciudades";
import type { Empresa } from "@/lib/types";

type Presentacion = "registro" | "rectificacion" | "complementario";
const PRESENTACION: Record<Presentacion, { label: string; ayuda: string }> = {
  registro: { label: "Registro", ayuda: "Carga un reporte nuevo del período." },
  rectificacion: { label: "Rectificación", ayuda: "Reemplaza por completo un reporte ya presentado." },
  complementario: { label: "RO complementario", ayuda: "Agrega registros a un período ya presentado." },
};

const COLOR: Record<TipoObservacion, { fondo: string; texto: string; borde: string; label: string }> = {
  COMPLETAR: { fondo: "rgba(178,59,59,0.08)", texto: "text-bad", borde: "#b23b3b", label: "Completar" },
  VERIFICAR: { fondo: "rgba(201,162,39,0.12)", texto: "text-[#8a6d12]", borde: "#c9a227", label: "Verificar" },
  AJUSTE: { fondo: "rgba(63,107,82,0.10)", texto: "text-good", borde: "#3f6b52", label: "Ajuste" },
};
const GRAVEDAD: TipoObservacion[] = ["COMPLETAR", "VERIFICAR", "AJUSTE"];

interface ReglasRo {
  ciudad_fija: number | null;
  ciudad_por_defecto: number;
  telefono_por_defecto: string;
  notas: string | null;
}
const REGLAS_VACIAS: ReglasRo = { ciudad_fija: null, ciudad_por_defecto: 1, telefono_por_defecto: "99999999", notas: null };

function trimestreAnterior(hoy = new Date()): string {
  const t = Math.floor(hoy.getMonth() / 3) + 1;
  return t === 1 ? `${hoy.getFullYear() - 1}-T4` : `${hoy.getFullYear()}-T${t - 1}`;
}

function descargar(nombre: string, datos: BlobPart, tipo = "application/json") {
  const url = URL.createObjectURL(new Blob([datos], { type: tipo }));
  const a = document.createElement("a");
  a.href = url;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const csvCelda = (v: unknown) => {
  const s = String(v ?? "");
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** Texto a Windows-1252 en todo el archivo; avisa lo que se cambió. */
function prepararParaArchivo(registros: Registro[]): { registros: Registro[]; obs: Observacion[] } {
  const obs: Observacion[] = [];
  const out = registros.map((r) => {
    const o: Registro = {};
    for (const [k, v] of Object.entries(r)) {
      if (typeof v === "string" && !esCp1252(v)) {
        o[k] = aTextoCp1252(v);
        obs.push({ item: Number(r.item), tipo: "AJUSTE", campo: k, mensaje: `Se quitaron caracteres que el archivo oficial no admite ("${v}" → "${o[k]}").` });
      } else o[k] = v;
    }
    return o;
  });
  return { registros: out, obs };
}

function tamanoLegible(b: number): string {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toLocaleString("es-PY", { maximumFractionDigits: 0 })} KB`;
  return `${(b / 1024 / 1024).toLocaleString("es-PY", { maximumFractionDigits: 1 })} MB`;
}

const PASOS = ["Período", "Planilla", "Revisión", "Archivo"];

/** Dónde estás en el proceso, para que se entienda de un vistazo. */
function Pasos({ actual }: { actual: number }) {
  return (
    <ol className="flex items-center gap-1 overflow-x-auto pb-1 text-xs" aria-label="Pasos del reporte">
      {PASOS.map((p, i) => {
        const hecho = i < actual;
        const activo = i === actual;
        return (
          <li key={p} className="flex shrink-0 items-center gap-1">
            <span
              className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-semibold transition ${
                hecho ? "bg-musgo text-marfil" : activo ? "bg-cobre text-white" : "border text-carbon/45"
              }`}
              style={hecho || activo ? undefined : { borderColor: "var(--line)" }}
              aria-current={activo ? "step" : undefined}
            >
              {hecho ? <Check size={13} /> : i + 1}
            </span>
            <span className={activo ? "font-medium text-carbon" : "text-carbon/55"}>{p}</span>
            {i < PASOS.length - 1 && <span className={`mx-1 h-px w-5 sm:w-10 ${hecho ? "bg-musgo" : ""}`} style={hecho ? undefined : { background: "var(--line)" }} />}
          </li>
        );
      })}
    </ol>
  );
}

interface FuenteHoja {
  nombre: string;
  visible: boolean;
  filas: Celda[][];
}

export default function GeneradorRo({ empresa, regimenInicial }: { empresa: Empresa; regimenInicial: Regimen }) {
  const { showToast } = useToast();
  const [regimen, setRegimen] = useState<Regimen>(regimenInicial);
  const [periodo, setPeriodo] = useState(trimestreAnterior());
  const [presentacion, setPresentacion] = useState<Presentacion>("registro");
  const [reglas, setReglas] = useState<ReglasRo>(REGLAS_VACIAS);
  const [verReglas, setVerReglas] = useState(false);
  const [guardandoReglas, setGuardandoReglas] = useState(false);

  const [nombreArchivo, setNombreArchivo] = useState<string | null>(null);
  const [hojas, setHojas] = useState<FuenteHoja[]>([]);
  const [elegidas, setElegidas] = useState<number[]>([]);
  const [mapeos, setMapeos] = useState<Record<number, (string | null)[]>>({});
  const [pegado, setPegado] = useState("");
  const [arrastrando, setArrastrando] = useState(false);
  const [tamano, setTamano] = useState<number | null>(null);
  const [leyendo, setLeyendo] = useState(false);
  const [errorLectura, setErrorLectura] = useState<string | null>(null);

  const [ediciones, setEdiciones] = useState<Record<number, Record<string, string>>>({});
  const [abierta, setAbierta] = useState<number | null>(null);
  const [filtro, setFiltro] = useState<TipoObservacion | "todas" | "sin">("todas");
  const [soloPeriodo, setSoloPeriodo] = useState(false);
  const [confirmoPendientes, setConfirmoPendientes] = useState(false);
  const [generando, setGenerando] = useState(false);
  const [generado, setGenerado] = useState<{ hash: string; cantidad: number; obligacion: { id: string; titulo: string } | null } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const revisionRef = useRef<HTMLElement>(null);
  const yaBajo = useRef(false);

  useEffect(() => {
    let vigente = true;
    supabase
      .from("ro_reglas_empresa")
      .select("ciudad_fija, ciudad_por_defecto, telefono_por_defecto, notas")
      .eq("empresa_id", empresa.id)
      .maybeSingle()
      .then(({ data }) => {
        if (vigente) setReglas((data as ReglasRo | null) ?? REGLAS_VACIAS);
      });
    return () => {
      vigente = false;
    };
  }, [empresa.id]);

  function reiniciar() {
    setNombreArchivo(null);
    setTamano(null);
    yaBajo.current = false;
    setHojas([]);
    setElegidas([]);
    setMapeos({});
    setEdiciones({});
    setAbierta(null);
    setGenerado(null);
    setConfirmoPendientes(false);
    setErrorLectura(null);
  }

  function cargarHojas(nuevas: FuenteHoja[], nombre: string) {
    reiniciar();
    setNombreArchivo(nombre);
    setHojas(nuevas);
    // Solo las hojas visibles: las ocultas suelen ser trimestres viejos o listas auxiliares.
    setElegidas(nuevas.map((h, i) => (h.visible && h.filas.some((f) => f.some((c) => c !== null && c !== "")) ? i : -1)).filter((i) => i >= 0));
  }

  async function leerArchivo(file: File) {
    setLeyendo(true);
    setErrorLectura(null);
    try {
      if (file.size > 25 * 1024 * 1024) throw new ExcelNoSoportado("El archivo supera 25 MB.");
      const bytes = new Uint8Array(await file.arrayBuffer());
      setTamano(file.size);
      if (/\.(xlsx|xlsm)$/i.test(file.name)) {
        cargarHojas(leerXlsx(bytes) as Hoja[], file.name);
      } else if (/\.(csv|txt|tsv)$/i.test(file.name)) {
        cargarHojas([{ nombre: file.name, visible: true, filas: leerCsv(decodificarTexto(bytes)) }], file.name);
      } else if (/\.xls$/i.test(file.name)) {
        throw new ExcelNoSoportado("Es un .xls del formato viejo: abrilo en Excel y guardalo como .xlsx.");
      } else {
        throw new ExcelNoSoportado("Subí un Excel (.xlsx o .xlsm), un CSV o un texto.");
      }
    } catch (e) {
      setErrorLectura(e instanceof Error ? e.message : "No se pudo leer el archivo.");
    } finally {
      setLeyendo(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function usarPegado() {
    if (!pegado.trim()) return;
    cargarHojas([{ nombre: "Texto pegado", visible: true, filas: leerCsv(pegado) }], "Texto pegado");
    setTamano(pegado.length);
    setPegado("");
  }


  const leerArchivoRef = useRef(leerArchivo);
  const usarTextoRef = useRef((t: string) => {
    void t;
  });
  useEffect(() => {
    leerArchivoRef.current = leerArchivo;
    usarTextoRef.current = (t: string) => {
      cargarHojas([{ nombre: "Tabla pegada", visible: true, filas: leerCsv(t) }], "Tabla pegada");
      setTamano(t.length);
      setPegado("");
    };
  });

  // Como en un chat: soltá el archivo en cualquier parte de la página o
  // pegalo con Ctrl+V (archivo copiado o filas copiadas de Excel).
  useEffect(() => {
    let profundidad = 0;
    const hayArchivo = (e: DragEvent) => Array.from(e.dataTransfer?.types ?? []).includes("Files");
    const entra = (e: DragEvent) => {
      if (!hayArchivo(e)) return;
      e.preventDefault();
      profundidad++;
      setArrastrando(true);
    };
    const sobre = (e: DragEvent) => hayArchivo(e) && e.preventDefault();
    const sale = (e: DragEvent) => {
      if (!hayArchivo(e)) return;
      profundidad = Math.max(0, profundidad - 1);
      if (profundidad === 0) setArrastrando(false);
    };
    const suelta = (e: DragEvent) => {
      if (!hayArchivo(e)) return;
      e.preventDefault();
      profundidad = 0;
      setArrastrando(false);
      const f = e.dataTransfer?.files?.[0];
      if (f) void leerArchivoRef.current(f);
    };
    const pega = (e: ClipboardEvent) => {
      const f = e.clipboardData?.files?.[0];
      if (f) {
        e.preventDefault();
        void leerArchivoRef.current(f);
        return;
      }
      const destino = e.target as HTMLElement | null;
      // En otros campos se pega normal; fuera de ellos, una tabla copiada se lee directo.
      if (destino && (destino.tagName === "INPUT" || destino.tagName === "SELECT" || (destino.tagName === "TEXTAREA" && destino.id !== "ro-pegar"))) return;
      const texto = e.clipboardData?.getData("text/plain") ?? "";
      if (texto.includes("\t") && texto.trim().split(/\r?\n/).length >= 2) {
        e.preventDefault();
        usarTextoRef.current(texto);
      }
    };
    window.addEventListener("dragenter", entra);
    window.addEventListener("dragover", sobre);
    window.addEventListener("dragleave", sale);
    window.addEventListener("drop", suelta);
    window.addEventListener("paste", pega);
    return () => {
      window.removeEventListener("dragenter", entra);
      window.removeEventListener("dragover", sobre);
      window.removeEventListener("dragleave", sale);
      window.removeEventListener("drop", suelta);
      window.removeEventListener("paste", pega);
    };
  }, []);

  // Extracción por hoja (con el mapeo manual, si se cambió).
  const extracciones = useMemo(() => {
    const out: Record<number, Extraccion | null> = {};
    for (const i of elegidas) {
      const h = hojas[i];
      if (!h) continue;
      const auto = extraer(h.filas, regimen);
      if (auto && auto.formato === "tabla" && mapeos[i] && auto.filaEncabezado !== null) out[i] = extraerTabla(h.filas, regimen, auto.filaEncabezado, mapeos[i]);
      else out[i] = auto;
    }
    return out;
  }, [elegidas, hojas, regimen, mapeos]);

  const crudas = useMemo(() => elegidas.flatMap((i) => extracciones[i]?.filas ?? []), [elegidas, extracciones]);
  const rango = useMemo(() => rangoTrimestre(periodo), [periodo]);
  const trimestres = useMemo(() => {
    const c = new Map<string, number>();
    for (const f of crudas) {
      const d = parsearFecha(f.fechaOperacion as Celda);
      if (d) c.set(trimestreDe(d), (c.get(trimestreDe(d)) ?? 0) + 1);
    }
    return Array.from(c.entries()).sort();
  }, [crudas]);

  // Índices (en `crudas`) que entran al archivo.
  const indices = useMemo(
    () =>
      crudas
        .map((f, i) => ({ f, i }))
        .filter(({ f }) => {
          if (!soloPeriodo) return true;
          const d = parsearFecha(f.fechaOperacion as Celda);
          return !d || (d >= rango.desde && d <= rango.hasta);
        })
        .map(({ i }) => i),
    [crudas, soloPeriodo, rango]
  );

  const resultado = useMemo(() => {
    if (indices.length === 0) return null;
    const filas: FilaCruda[] = indices.map((i) => ({ ...crudas[i], ...(ediciones[i] ?? {}) }));
    const n = new Normalizador(regimen, {
      periodo: rango,
      reglas: { ciudadFija: reglas.ciudad_fija, ciudadPorDefecto: reglas.ciudad_por_defecto, telefonoPorDefecto: reglas.telefono_por_defecto },
    });
    const r = n.procesar(filas);
    const p = prepararParaArchivo(r.registros);
    return { registros: p.registros, observaciones: [...r.observaciones, ...p.obs] };
  }, [indices, crudas, ediciones, regimen, rango, reglas]);

  const porItem = useMemo(() => {
    const m = new Map<number, Observacion[]>();
    for (const o of resultado?.observaciones ?? []) m.set(o.item, [...(m.get(o.item) ?? []), o]);
    return m;
  }, [resultado]);
  const cuenta = (t: TipoObservacion) => (resultado?.observaciones ?? []).filter((o) => o.tipo === t && o.item > 0).length;
  const pendientes = cuenta("COMPLETAR");
  const peor = (item: number): TipoObservacion | null => {
    const o = porItem.get(item) ?? [];
    return GRAVEDAD.find((g) => o.some((x) => x.tipo === g)) ?? null;
  };

  const resumen = useMemo(() => {
    if (!resultado) return null;
    const fechas = resultado.registros.map((r) => String(r.fechaOperacion)).filter(Boolean).sort();
    const totales = new Map<string, number>();
    for (const r of resultado.registros) {
      if (regimen === "inmobiliarias") {
        const mon = String(r.monedaOperacionCodigo || "—");
        totales.set(mon, (totales.get(mon) ?? 0) + Number(r.montoEntrega) + Number(r.montoFinanciado) + Number(r.montoCompensacion));
      } else totales.set("PYG", (totales.get("PYG") ?? 0) + Number(r.montoGuaranies));
    }
    return { desde: fechas[0], hasta: fechas[fechas.length - 1], totales: Array.from(totales.entries()) };
  }, [resultado, regimen]);

  function editar(item: number, campo: string, valor: string) {
    const i = indices[item - 1];
    setEdiciones((prev) => ({ ...prev, [i]: { ...(prev[i] ?? {}), [campo]: valor } }));
    setGenerado(null);
  }

  async function guardarReglas() {
    setGuardandoReglas(true);
    const { error } = await supabase.from("ro_reglas_empresa").upsert({ empresa_id: empresa.id, ...reglas, notas: reglas.notas?.trim() || null }, { onConflict: "empresa_id" });
    setGuardandoReglas(false);
    if (error) return showToast(`No se pudieron guardar las reglas: ${mensajeError(error)}`, "error");
    showToast("Reglas guardadas para esta empresa.");
  }

  async function generar() {
    if (!resultado) return;
    if (pendientes > 0 && !confirmoPendientes) return showToast("Hay datos para completar. Corregilos o confirmá que querés generar igual.", "error");
    setGenerando(true);
    try {
      const archivos = armarArchivos(resultado.registros);
      descargar("output_base64.json", archivos.base64);
      descargar("output.json", archivos.jsonBytes as BlobPart);
      const hash = await sha256Hex(archivos.base64);
      const { error } = await supabase.from("ro_generaciones").insert({
        empresa_id: empresa.id,
        regimen,
        periodo,
        presentacion,
        cantidad: resultado.registros.length,
        hash_sha256: hash,
      });
      if (error) showToast(`Los archivos se descargaron, pero no se pudo dejar constancia: ${mensajeError(error)}`, "error");
      // Vencimiento del RO de ese trimestre en el calendario SEPRELAD (inmobiliarias).
      let obligacion: { id: string; titulo: string } | null = null;
      if (regimen === "inmobiliarias") {
        const [y, t] = periodo.split("-T").map(Number);
        const { data } = await supabase
          .from("obligaciones")
          .select("id, titulo")
          .eq("empresa_id", empresa.id)
          .eq("regla", t === 4 ? "sep_ro_trim_inmo_1" : `sep_ro_trim_inmo_${t + 1}`)
          .eq("anio", t === 4 ? y + 1 : y)
          .eq("estado", "pendiente")
          .maybeSingle();
        obligacion = (data as { id: string; titulo: string } | null) ?? null;
      }
      setGenerado({ hash, cantidad: resultado.registros.length, obligacion });
      showToast("Archivos generados y verificados.");
    } catch (e) {
      showToast(e instanceof Error ? e.message : "No se pudo generar el archivo.", "error");
    } finally {
      setGenerando(false);
    }
  }

  async function marcarHecha(id: string) {
    const { error } = await supabase.from("obligaciones").update({ estado: "hecho", completado_en: new Date().toISOString() }).eq("id", id);
    if (error) return showToast(`No se pudo marcar: ${mensajeError(error)}`, "error");
    setGenerado((g) => (g ? { ...g, obligacion: null } : g));
    showToast("Vencimiento marcado como hecho.");
  }

  function descargarPlantilla() {
    descargar(`plantilla-ro-${regimen}.csv`, "﻿" + CAMPOS[regimen].join(";") + "\r\n", "text/csv;charset=utf-8");
  }

  function descargarObservaciones() {
    if (!resultado) return;
    const filas = [["item", "tipo", "campo", "mensaje"], ...resultado.observaciones.map((o) => [o.item, o.tipo, etiqueta(o.campo), o.mensaje])];
    descargar(`observaciones-ro-${periodo}.csv`, "﻿" + filas.map((f) => f.map(csvCelda).join(";")).join("\r\n"), "text/csv;charset=utf-8");
  }

  const anioActual = new Date().getFullYear();
  const periodos = [anioActual - 1, anioActual].flatMap((y) => [1, 2, 3, 4].map((t) => `${y}-T${t}`)).reverse();
  const visibles = (resultado?.registros ?? []).filter((r) => {
    const p = peor(Number(r.item));
    return filtro === "todas" ? true : filtro === "sin" ? p === null : (porItem.get(Number(r.item)) ?? []).some((o) => o.tipo === filtro);
  });

  const pasoActual = generado ? 4 : resultado ? (pendientes > 0 && !confirmoPendientes ? 2 : 3) : 1;

  return (
    <div className="space-y-6">
      <Pasos actual={pasoActual} />
      {/* 1. Datos del reporte */}
      <section className="card">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <label className="field-label" htmlFor="ro-regimen">
              Régimen
            </label>
            <select id="ro-regimen" className="input" value={regimen} onChange={(e) => {
                setRegimen(e.target.value as Regimen);
                setMapeos({});
                setEdiciones({});
              }}>
              <option value="inmobiliarias">Inmobiliarias (compra, venta e intermediación)</option>
              <option value="caudales">Transporte de caudales</option>
            </select>
          </div>
          <div>
            <label className="field-label" htmlFor="ro-periodo">
              Trimestre
            </label>
            <select id="ro-periodo" className="input" value={periodo} onChange={(e) => {
                setPeriodo(e.target.value);
                setGenerado(null);
              }}>
              {periodos.map((p) => (
                <option key={p} value={p}>
                  {p.replace("-T", " · trimestre ")}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="field-label" htmlFor="ro-presentacion">
              Presentación
            </label>
            <select id="ro-presentacion" className="input" value={presentacion} onChange={(e) => setPresentacion(e.target.value as Presentacion)}>
              {(Object.keys(PRESENTACION) as Presentacion[]).map((p) => (
                <option key={p} value={p}>
                  {PRESENTACION[p].label}
                </option>
              ))}
            </select>
            <p className="mt-1 text-[11px] text-carbon/50">{PRESENTACION[presentacion].ayuda}</p>
          </div>
        </div>
        <button type="button" className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-carbon/65 hover:text-cobre-hover" onClick={() => setVerReglas((v) => !v)} aria-expanded={verReglas}>
          <Settings2 size={14} /> Reglas de esta empresa {verReglas ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
        {verReglas && (
          <div className="mt-3 grid grid-cols-1 gap-3 rounded-sm border p-3 sm:grid-cols-3" style={{ borderColor: "var(--line)" }}>
            <div>
              <label className="field-label" htmlFor="ro-ciudad-fija">
                Ciudad para todo el archivo
              </label>
              <input
                id="ro-ciudad-fija"
                className="input"
                inputMode="numeric"
                placeholder="Sin regla"
                value={reglas.ciudad_fija ?? ""}
                onChange={(e) => setReglas((r) => ({ ...r, ciudad_fija: e.target.value ? Number(e.target.value.replace(/\D/g, "")) || null : null }))}
              />
              <p className="mt-1 text-[11px] text-carbon/50">Solo si el cliente lo pidió. {reglas.ciudad_fija ? (nombreCiudadPy(reglas.ciudad_fija) ?? "Código del exterior") : ""}</p>
            </div>
            <div>
              <label className="field-label" htmlFor="ro-ciudad-defecto">
                Ciudad si viene vacía o no existe
              </label>
              <input
                id="ro-ciudad-defecto"
                className="input"
                inputMode="numeric"
                value={reglas.ciudad_por_defecto}
                onChange={(e) => setReglas((r) => ({ ...r, ciudad_por_defecto: Number(e.target.value.replace(/\D/g, "")) || 1 }))}
              />
              <p className="mt-1 text-[11px] text-carbon/50">{nombreCiudadPy(reglas.ciudad_por_defecto) ?? "Código del exterior"}</p>
            </div>
            <div>
              <label className="field-label" htmlFor="ro-telefono">
                Teléfono si viene vacío o en 0
              </label>
              <input
                id="ro-telefono"
                className="input"
                inputMode="numeric"
                value={reglas.telefono_por_defecto}
                onChange={(e) => setReglas((r) => ({ ...r, telefono_por_defecto: e.target.value.replace(/\D/g, "").slice(0, 12) }))}
              />
              <p className="mt-1 text-[11px] text-carbon/50">La SEPRELAD rechaza teléfonos en 0. Confirmá con ella si son 8 o 9 dígitos.</p>
            </div>
            <div className="sm:col-span-3">
              <button type="button" className="btn btn-ghost" onClick={guardarReglas} disabled={guardandoReglas || !/^\d{8,12}$/.test(reglas.telefono_por_defecto)}>
                {guardandoReglas ? "Guardando..." : "Guardar reglas"}
              </button>
            </div>
          </div>
        )}
      </section>

      {/* 2. Planilla: se suelta, se pega o se adjunta, como en un chat */}
      <section className="card">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2>Planilla de operaciones</h2>
            <p className="mt-1 text-sm text-carbon/65">Soltala, pegala o adjuntala. Las columnas se reconocen solas por su nombre y después podés corregir cualquier cosa.</p>
          </div>
          <button type="button" className="btn btn-ghost" onClick={descargarPlantilla}>
            <FileSpreadsheet size={15} /> Plantilla NODOS
          </button>
        </div>

        <input ref={inputRef} type="file" className="sr-only" id="ro-archivo" accept=".xlsx,.xlsm,.csv,.txt,.tsv" onChange={(e) => e.target.files?.[0] && leerArchivo(e.target.files[0])} />

        {nombreArchivo ? (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="inline-flex max-w-full items-center gap-2 rounded-lg border py-1.5 pl-2 pr-1 text-sm animate-fade-in" style={{ borderColor: "var(--line)", background: "var(--superficie)" }}>
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-musgo text-marfil">
                <FileSpreadsheet size={16} />
              </span>
              <span className="min-w-0">
                <span className="block truncate font-medium text-carbon">{nombreArchivo}</span>
                <span className="block text-[11px] text-carbon/55">
                  {tamano !== null ? (nombreArchivo.endsWith("pegada") || nombreArchivo.endsWith("pegado") ? `${tamano.toLocaleString("es-PY")} caracteres` : tamanoLegible(tamano)) : ""}
                  {hojas.length > 1 ? ` · ${hojas.length} hojas` : ""}
                </span>
              </span>
              <button type="button" onClick={reiniciar} className="ml-1 rounded-full p-1 text-carbon/45 hover:bg-carbon/5 hover:text-bad" title="Quitar y empezar de nuevo" aria-label="Quitar planilla">
                <X size={15} />
              </button>
            </span>
            <label htmlFor="ro-archivo" className="btn btn-ghost cursor-pointer">
              <RotateCcw size={15} /> Cambiar
            </label>
          </div>
        ) : (
          <div
            className={`mt-4 rounded-2xl border-2 border-dashed p-4 transition sm:p-5 ${arrastrando ? "border-cobre bg-cobre/5" : ""}`}
            style={arrastrando ? undefined : { borderColor: "var(--line)" }}
          >
            <label htmlFor="ro-archivo" className="flex cursor-pointer flex-col items-center gap-2 py-4 text-center">
              <span className={`flex h-12 w-12 items-center justify-center rounded-full bg-cobre/10 text-cobre-hover transition ${arrastrando || leyendo ? "scale-110" : ""}`}>
                {leyendo ? <span className="spinner" aria-hidden /> : <Upload size={22} />}
              </span>
              <span className="font-medium text-carbon">{leyendo ? "Leyendo la planilla..." : arrastrando ? "Soltala acá" : "Arrastrá tu planilla acá o tocá para elegirla"}</span>
              <span className="text-xs text-carbon/55">Excel (.xlsx, .xlsm), CSV o texto · hasta 25 MB · también podés pegarla con Ctrl+V</span>
            </label>
            <div className="mt-2 flex items-end gap-2 rounded-xl border px-3 py-2" style={{ borderColor: "var(--line)", background: "var(--campo, var(--superficie))" }}>
              <label htmlFor="ro-archivo" className="mb-0.5 shrink-0 cursor-pointer rounded-full p-1.5 text-carbon/50 hover:bg-carbon/5 hover:text-cobre-hover" title="Adjuntar archivo">
                <Paperclip size={17} />
              </label>
              <textarea
                id="ro-pegar"
                rows={1}
                className="max-h-40 min-h-[2.25rem] flex-1 resize-none bg-transparent py-1.5 font-mono text-xs outline-none placeholder:font-sans placeholder:text-sm placeholder:text-carbon/40"
                value={pegado}
                onChange={(e) => {
                  setPegado(e.target.value);
                  e.target.style.height = "auto";
                  e.target.style.height = `${Math.min(160, e.target.scrollHeight)}px`;
                }}
                onPaste={(e) => {
                  const t = e.clipboardData.getData("text/plain");
                  if (t.includes("\t") && t.trim().split(/\r?\n/).length >= 2) {
                    e.preventDefault();
                    usarTextoRef.current(t);
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                    e.preventDefault();
                    usarPegado();
                  }
                }}
                placeholder="O pegá acá las filas con sus encabezados"
                aria-label="Pegar filas de la planilla"
              />
              <button type="button" onClick={usarPegado} disabled={!pegado.trim()} className="mb-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-cobre text-white transition hover:bg-cobre-hover disabled:opacity-30" title="Usar este texto (Ctrl+Enter)" aria-label="Usar este texto">
                <ArrowUp size={16} />
              </button>
            </div>
          </div>
        )}

        <p className="mt-3 flex items-start gap-2 rounded-sm bg-marfil/70 px-3 py-2 text-xs text-carbon/70">
          <Lock size={14} className="mt-0.5 shrink-0 text-musgo" />
          La planilla se procesa en tu navegador: no se sube ni se guarda en NODOS. Solo queda constancia de quién generó el archivo, cuándo, el período, la cantidad de registros y una huella del archivo.
        </p>
        {errorLectura && (
          <p className="mt-3 flex items-start gap-2 rounded-sm border border-bad/30 bg-bad/5 px-3 py-2 text-sm text-bad animate-fade-in">
            <AlertTriangle size={15} className="mt-0.5 shrink-0" /> {errorLectura}
          </p>
        )}

        {resultado && (
          <div className="mt-4 rounded-lg border p-3 animate-fade-in" style={{ borderColor: "var(--line)" }}>
            <p className="text-sm text-carbon">
              Encontré <strong>{resultado.registros.length}</strong> operación{resultado.registros.length === 1 ? "" : "es"}
              {elegidas.length > 1 ? ` en ${elegidas.length} hojas` : ""}.{" "}
              {pendientes === 0 && cuenta("VERIFICAR") === 0 ? "Todo está en orden para generar el archivo." : "Esto es lo que conviene mirar:"}
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {GRAVEDAD.map((g) =>
                cuenta(g) > 0 ? (
                  <button
                    key={g}
                    type="button"
                    onClick={() => {
                      setFiltro(g);
                      revisionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
                    }}
                    className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition hover:brightness-95 ${COLOR[g].texto}`}
                    style={{ background: COLOR[g].fondo, borderColor: COLOR[g].borde }}
                  >
                    {cuenta(g)} {g === "COMPLETAR" ? "para completar" : g === "VERIFICAR" ? "para verificar" : "ajustes automáticos"}
                  </button>
                ) : null
              )}
              <button
                type="button"
                onClick={() => revisionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
                className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium text-cobre-hover hover:underline"
              >
                Ir a la revisión <ChevronDown size={13} />
              </button>
            </div>
          </div>
        )}

        {hojas.length > 0 && (
          <div className="mt-4 space-y-3">
            <p className="text-sm font-medium text-musgo">{nombreArchivo}</p>
            <ul className="space-y-2">
              {hojas.map((h, i) => {
                const ex = extracciones[i];
                const activa = elegidas.includes(i);
                return (
                  <li key={i} className="rounded-sm border p-3" style={{ borderColor: "var(--line)" }}>
                    <label className="flex flex-wrap items-center gap-2 text-sm">
                      <input type="checkbox" checked={activa} disabled={!h.visible} onChange={(e) => setElegidas((p) => (e.target.checked ? [...p, i].sort() : p.filter((x) => x !== i)))} />
                      <span className="font-medium">{h.nombre}</span>
                      {!h.visible ? (
                        <span className="text-xs text-carbon/50">Oculta: no se procesa</span>
                      ) : activa && ex ? (
                        <span className="text-xs text-carbon/55">
                          {ex.filas.length} operación{ex.filas.length === 1 ? "" : "es"} ·{" "}
                          {ex.formato === "tabla" ? "tabla con encabezados" : ex.formato === "bloques" ? "bloques por operación" : "una operación por columna"}
                        </span>
                      ) : activa ? (
                        <span className="text-xs text-bad">No se reconoció el formato de esta hoja</span>
                      ) : null}
                    </label>
                    {activa && ex?.avisos.map((a) => (
                      <p key={a} className="mt-1 text-xs text-carbon/60">
                        {a}
                      </p>
                    ))}
                    {activa && ex?.formato === "tabla" && (
                      <details className="mt-2">
                        <summary className="cursor-pointer text-xs font-medium text-cobre-hover">Revisar qué columna va a cada campo</summary>
                        <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                          {ex.encabezados
                            .filter((e) => e.texto)
                            .map((e) => (
                              <label key={e.col} className="text-xs">
                                <span className="block truncate text-carbon/60" title={e.texto}>
                                  {e.texto}
                                </span>
                                <select
                                  className="input mt-0.5 py-1 text-xs"
                                  value={e.destino ?? ""}
                                  onChange={(ev) => {
                                    const base = mapeos[i] ?? ex.encabezados.map((x) => x.destino);
                                    const nuevo = [...base];
                                    nuevo[e.col] = ev.target.value || null;
                                    setMapeos((m) => ({ ...m, [i]: nuevo }));
                                    setEdiciones({});
                                  }}
                                >
                                  <option value="">No usar</option>
                                  {destinosPosibles(regimen).map((d) => (
                                    <option key={d} value={d}>
                                      {etiqueta(d)}
                                    </option>
                                  ))}
                                </select>
                              </label>
                            ))}
                        </div>
                      </details>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </section>

      {/* 3. Revisión */}
      {resultado && resumen && (
        <section ref={revisionRef} className="scroll-mt-20 space-y-3">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2>Revisión</h2>
              <p className="mt-1 text-sm text-carbon/65">
                {resultado.registros.length} operación{resultado.registros.length === 1 ? "" : "es"}
                {resumen.desde ? ` · del ${resumen.desde.split("-").reverse().join("/")} al ${resumen.hasta.split("-").reverse().join("/")}` : ""}
                {resumen.totales.map(([m, t]) => ` · ${m === "PYG" ? formatPyg(t) : `${m} ${t.toLocaleString("es-PY")}`}`).join("")}
              </p>
            </div>
            <button type="button" className="btn btn-ghost" onClick={descargarObservaciones}>
              <Download size={15} /> Observaciones (CSV)
            </button>
          </div>

          {trimestres.length > 1 && (
            <div className="flex flex-wrap items-center gap-3 rounded-sm border border-cobre/40 bg-cobre/5 p-3 text-sm">
              <AlertTriangle size={16} className="shrink-0 text-cobre" />
              <span>
                La planilla trae operaciones de {trimestres.length} trimestres ({trimestres.map(([t, n]) => `${t.replace("-T", " T")}: ${n}`).join(" · ")}). Un archivo es un trimestre.
              </span>
              <label className="inline-flex items-center gap-1.5">
                <input type="checkbox" checked={soloPeriodo} onChange={(e) => setSoloPeriodo(e.target.checked)} /> Incluir solo {periodo.replace("-T", " T")}
              </label>
            </div>
          )}

          <div className="segmented flex-wrap">
            {(["todas", "COMPLETAR", "VERIFICAR", "AJUSTE", "sin"] as const).map((f) => (
              <button key={f} type="button" className={filtro === f ? "active" : ""} onClick={() => setFiltro(f)}>
                {f === "todas" ? "Todas" : f === "sin" ? "Sin observaciones" : `${COLOR[f].label} (${cuenta(f)})`}
              </button>
            ))}
          </div>

          {resultado.observaciones.filter((o) => o.item === 0).map((o) => (
            <p key={o.mensaje} className="text-xs text-carbon/60">
              {o.mensaje}
            </p>
          ))}

          <div className="table-shell">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Fecha</th>
                  <th>{regimen === "inmobiliarias" ? "Operación" : "Moneda"}</th>
                  <th>{regimen === "inmobiliarias" ? "Comprador / vendedor" : "Cliente"}</th>
                  <th className="text-right">Monto</th>
                  <th>Observaciones</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {visibles.map((r) => {
                  const item = Number(r.item);
                  const p = peor(item);
                  const obs = porItem.get(item) ?? [];
                  const persona = regimen === "inmobiliarias" ? [r.compradorDenominacion, r.vendedorDenominacion].filter(Boolean).join(" / ") : String(r.denominacion);
                  const monto = regimen === "inmobiliarias" ? Number(r.montoEntrega) + Number(r.montoFinanciado) + Number(r.montoCompensacion) : Number(r.montoGuaranies);
                  return (
                    <FilaRevision
                      key={item}
                      item={item}
                      registro={r}
                      regimen={regimen}
                      persona={persona}
                      monto={regimen === "inmobiliarias" ? `${r.monedaOperacionCodigo === "PYG" ? formatPyg(monto) : `${r.monedaOperacionCodigo} ${monto.toLocaleString("es-PY")}`}` : formatPyg(monto)}
                      peor={p}
                      obs={obs}
                      abierta={abierta === item}
                      onToggle={() => setAbierta(abierta === item ? null : item)}
                      onEditar={(campo, valor) => editar(item, campo, valor)}
                    />
                  );
                })}
                {visibles.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-6 text-center text-sm text-carbon/55">
                      Nada para mostrar con este filtro.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* 4. Generar */}
          <div className="card space-y-3">
            {pendientes > 0 ? (
              <label className="flex items-start gap-2 text-sm text-bad">
                <input type="checkbox" className="mt-1" checked={confirmoPendientes} onChange={(e) => setConfirmoPendientes(e.target.checked)} />
                Hay {pendientes} dato{pendientes === 1 ? "" : "s"} para completar. Revisé los pendientes y quiero generar el archivo igual.
              </label>
            ) : (
              <p className="flex items-center gap-2 text-sm text-good">
                <CheckCircle2 size={16} /> Sin datos pendientes de completar.
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              <button type="button" className="btn btn-primary" onClick={generar} disabled={generando || (pendientes > 0 && !confirmoPendientes)}>
                <Download size={15} /> {generando ? "Generando..." : "Generar y descargar"}
              </button>
            </div>
            <p className="text-xs text-carbon/55">
              Se descargan <code>output_base64.json</code> (el que se sube a la plataforma de la SEPRELAD, que pide validación OTP) y <code>output.json</code> (el mismo contenido, para revisarlo).
              Antes de bajarlo se verifica que el Base64 se decodifique igual.
            </p>
            {generado && (
              <div className="rounded-sm border p-3 text-sm" style={{ borderColor: "var(--line)" }}>
                <p className="flex items-center gap-2 font-medium text-musgo">
                  <ShieldCheck size={16} className="text-good" /> {generado.cantidad} registros · {periodo.replace("-T", " trimestre ")} · {PRESENTACION[presentacion].label}
                </p>
                <p className="mt-1 break-all font-mono text-[11px] text-carbon/55">SHA-256 {generado.hash}</p>
                {generado.obligacion && (
                  <button type="button" className="btn btn-ghost mt-2" onClick={() => marcarHecha(generado.obligacion!.id)}>
                    <CheckCircle2 size={15} /> Marcar hecho: {generado.obligacion.titulo}
                  </button>
                )}
              </div>
            )}
          </div>
        </section>
      )}

      <p className="t-caption text-carbon/50">
        Herramienta de preparación: revisá el archivo antes de presentarlo. Las reglas de formato salen de la macro oficial y de rechazos reales de la plataforma; la obligación de registrar
        todas las operaciones es de la Res. SEPRELAD 201/2020, art. 31. No constituye asesoramiento legal para tu caso. <Link href="/cumplimiento" className="underline">Volver a SEPRELAD</Link>
      </p>
    </div>
  );
}

const LISTA_DE: Record<string, keyof typeof OPCIONES_LISTA> = {
  tipoInmueble: "tipoInmueble",
  clasificacion: "clasificacion",
  modalidadOperacion: "modalidadOperacion",
  formaPago: "formaPago",
  tipoOperacion: "tipoOperacion",
  compradorTipoPersona: "tipoPersona",
  vendedorTipoPersona: "tipoPersona",
  compradorTipoDocumento: "tipoDocumento",
  vendedorTipoDocumento: "tipoDocumento",
  codigoTipoDocumento: "tipoDocumento",
  compradorPep: "pep",
  vendedorPep: "pep",
};

function FilaRevision({
  item,
  registro,
  regimen,
  persona,
  monto,
  peor,
  obs,
  abierta,
  onToggle,
  onEditar,
}: {
  item: number;
  registro: Registro;
  regimen: Regimen;
  persona: string;
  monto: string;
  peor: TipoObservacion | null;
  obs: Observacion[];
  abierta: boolean;
  onToggle: () => void;
  onEditar: (campo: string, valor: string) => void;
}) {
  const color = peor ? COLOR[peor] : null;
  const conObs = new Set(obs.map((o) => o.campo));
  // Primero los campos con observaciones; el resto, en el orden oficial.
  const campos = [...CAMPOS[regimen]].sort((a, b) => Number(conObs.has(b)) - Number(conObs.has(a)));
  return (
    <>
      <tr style={color ? { background: color.fondo, boxShadow: `inset 3px 0 0 ${color.borde}` } : undefined}>
        <td className="tabular-nums">{item}</td>
        <td className="whitespace-nowrap">{registro.fechaOperacion ? String(registro.fechaOperacion).split("-").reverse().join("/") : "—"}</td>
        <td className="whitespace-nowrap">{regimen === "inmobiliarias" ? String(registro.tipoOperacion || "—") : String(registro.codigoMoneda || "—")}</td>
        <td className="min-w-[11rem]">{persona || "—"}</td>
        <td className="whitespace-nowrap text-right tabular-nums">{monto}</td>
        <td className="min-w-[14rem] text-xs">
          {obs.length === 0 ? (
            <span className="text-carbon/40">—</span>
          ) : (
            <ul className="space-y-0.5">
              {obs.slice(0, abierta ? obs.length : 2).map((o, i) => (
                <li key={i} className={COLOR[o.tipo].texto}>
                  <strong>{COLOR[o.tipo].label}:</strong> {etiqueta(o.campo)}. {o.mensaje}
                </li>
              ))}
              {!abierta && obs.length > 2 && <li className="text-carbon/50">y {obs.length - 2} más</li>}
            </ul>
          )}
        </td>
        <td className="text-right">
          <button type="button" className="rounded-full p-1 text-carbon/50 hover:text-cobre-hover" onClick={onToggle} title={abierta ? "Cerrar" : "Ver y corregir"} aria-expanded={abierta}>
            {abierta ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </td>
      </tr>
      {abierta && (
        <tr>
          <td colSpan={7} className="bg-marfil/50">
            <div className="grid grid-cols-1 gap-2 py-2 sm:grid-cols-2 lg:grid-cols-3">
              {campos.map((c) => {
                const lista = LISTA_DE[c];
                const valor = String(registro[c] ?? "");
                return (
                  <label key={c} className="text-xs">
                    <span className={`block ${conObs.has(c) ? "font-medium text-musgo" : "text-carbon/60"}`}>{etiqueta(c)}</span>
                    {lista ? (
                      <select className="input mt-0.5 py-1 text-xs" value={valor} onChange={(e) => onEditar(c, e.target.value)}>
                        <option value="">(vacío)</option>
                        {OPCIONES_LISTA[lista].map((o) => (
                          <option key={o} value={o}>
                            {o}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        key={`${c}:${valor}`}
                        className="input mt-0.5 py-1 text-xs"
                        defaultValue={valor}
                        inputMode={NUMERICOS.has(c) ? "numeric" : undefined}
                        onBlur={(e) => e.target.value !== valor && onEditar(c, e.target.value)}
                      />
                    )}
                  </label>
                );
              })}
            </div>
            <p className="pb-2 text-[11px] text-carbon/50">Los cambios se aplican al salir de cada campo y se vuelven a validar con las mismas reglas.</p>
          </td>
        </tr>
      )}
    </>
  );
}
