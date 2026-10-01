"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { formatFecha, todayIso } from "@/lib/dates";
import { documentoImprimible, textoMarcaAgua } from "@/lib/descargas";
import { formatPyg } from "@/lib/format";
import { calcularParticipaciones, formatNumero, formatPct, type FilaAccionista } from "@/lib/accionistas";
import { TIPO_LABELS, type Accionista, type Empresa } from "@/lib/types";

/**
 * Ficha "estilo SIARA": los datos que pide el Sistema Integrado de
 * Administración de los Registros Administrativos (SIARA) del Ministerio de
 * Economía y Finanzas (DGPEJBF) para S.A. y S.R.L.
 *
 * Base: Ley N° 6446/2019 (arts. 4, 6 y 7), Decreto N° 3241/2020 (arts. 4, 6
 * y 10) y el Manual de usuario SIARA S.A./S.R.L. (MEF, marzo 2026).
 * Tablas: `beneficiarios_finales` y `administradores` (migración 007).
 * La app ayuda a ordenar la información; la declaración se hace en SIARA.
 */

// ─── Normativa citada en la UI (verificada) ─────────────────────────────

export const FUENTES_SIARA = {
  ley: "https://www.bacn.gov.py/leyes-paraguayas/9116/ley-n-6446-crea-el-registro-administrativo-de-personas-y-estructuras-juridicas-y-el-registro-administrativo-de-beneficiarios-finales-del-paraguay",
  decreto: "https://baselegal.com.py/docs/c6c4d5dc-3b90-11ea-9bc2-525400c761ca",
  manual: "https://www.mef.gov.py/sites/default/files/2026-03/DGPEJBF_MANUAL_SIARA_SA-SRL_marzo.pdf",
  siara: "https://www.mef.gov.py/es/dependencias/direcciones/direccion-general-personas-estructuras-juridicas-beneficiarios-finales/siara",
};

/** Plazo para comunicar modificaciones (Ley 6446/2019 art. 7; Decreto 3241/2020 art. 10). */
export const DIAS_HABILES_MODIFICACION = 15;

// ─── Empresa: campos SIARA (columnas agregadas en 007) ──────────────────

export interface CamposSiaraEmpresa {
  email_institucional: string | null;
  pagina_web: string | null;
  departamento: string | null;
  barrio: string | null;
  domicilio_comercial: string | null;
  actividad_principal: string | null;
  inscripcion_registral: string | null;
  fecha_inscripcion: string | null;
  valor_nominal_accion: number | null;
  siara_ultima_declaracion: string | null;
  siara_numero_solicitud: string | null;
}

/** Empresa tal como llega de `select *` después de correr la migración 007. */
export type EmpresaSiara = Empresa & Partial<CamposSiaraEmpresa>;

// ─── Beneficiarios finales ───────────────────────────────────────────────

export type TipoDocumento = "ci" | "pasaporte" | "otro";

export const TIPO_DOCUMENTO_LABELS: Record<TipoDocumento, string> = {
  ci: "Cédula de identidad",
  pasaporte: "Pasaporte",
  otro: "Otro",
};

/** Literales del art. 4 de la Ley 6446/2019. */
export type CondicionBF = "a" | "b" | "c" | "d" | "e";

export const CONDICIONES_BF: { key: CondicionBF; corto: string; texto: string }[] = [
  { key: "a", corto: "a) ≥ 10% del capital", texto: "Participación sustantiva: acciones o participaciones iguales o mayores al 10% del capital total." },
  { key: "b", corto: "b) > 25% de los votos", texto: "Controla más del 25% del derecho de votación." },
  { key: "c", corto: "c) Gerente / administrador", texto: "Gerentes, administradores o quienes frecuentemente usen o se beneficien de los activos de la sociedad." },
  { key: "d", corto: "d) Designa o cesa órganos", texto: "Tiene derecho a designar o cesar parte de los órganos de administración, dirección o supervisión." },
  { key: "e", corto: "e) Control estatutario", texto: "Tiene el control en virtud de estatutos, reglamentos u otros instrumentos." },
];

export interface BeneficiarioFinal {
  id: string;
  user_id: string;
  empresa_id: string;
  accionista_id: string | null;
  nombre: string;
  tipo_documento: TipoDocumento;
  documento: string | null;
  ruc: string | null;
  nacionalidad: string | null;
  fecha_nacimiento: string | null;
  pais_residencia: string | null;
  departamento: string | null;
  ciudad: string | null;
  barrio: string | null;
  domicilio: string | null;
  profesion: string | null;
  ocupacion: string | null;
  email: string | null;
  telefono: string | null;
  participacion_directa: number;
  participacion_indirecta: number;
  porcentaje_votos: number | null;
  condiciones: CondicionBF[];
  cadena_control: string | null;
  es_pep: boolean;
  cargo_pep: string | null;
  fecha_desde: string | null;
  fecha_hasta: string | null;
  notas: string | null;
  created_at: string;
  updated_at: string;
}

export type NuevoBeneficiario = Omit<BeneficiarioFinal, "id" | "user_id" | "created_at" | "updated_at">;

export function beneficiarioVacio(empresaId: string): NuevoBeneficiario {
  return {
    empresa_id: empresaId,
    accionista_id: null,
    nombre: "",
    tipo_documento: "ci",
    documento: null,
    ruc: null,
    nacionalidad: "Paraguaya",
    fecha_nacimiento: null,
    pais_residencia: "Paraguay",
    departamento: null,
    ciudad: null,
    barrio: null,
    domicilio: null,
    profesion: null,
    ocupacion: null,
    email: null,
    telefono: null,
    participacion_directa: 0,
    participacion_indirecta: 0,
    porcentaje_votos: null,
    condiciones: [],
    cadena_control: null,
    es_pep: false,
    cargo_pep: null,
    fecha_desde: null,
    fecha_hasta: null,
    notas: null,
  };
}

export function aNuevoBeneficiario(b: BeneficiarioFinal): NuevoBeneficiario {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { id, user_id, created_at, updated_at, ...rest } = b;
  return { ...rest, participacion_directa: Number(rest.participacion_directa), participacion_indirecta: Number(rest.participacion_indirecta) };
}

/** Precarga un BF desde una fila del libro de accionistas (criterios objetivos a / b). */
export function beneficiarioDesdeAccionista(empresaId: string, a: FilaAccionista): NuevoBeneficiario {
  const condiciones: CondicionBF[] = [];
  if (a.pctCapital >= 10) condiciones.push("a");
  if (a.pctVotos > 25) condiciones.push("b");
  return {
    ...beneficiarioVacio(empresaId),
    accionista_id: a.id,
    nombre: a.nombre,
    documento: a.documento,
    email: a.email,
    telefono: a.telefono,
    participacion_directa: redondear(a.pctCapital),
    porcentaje_votos: redondear(a.pctVotos),
    condiciones,
  };
}

/** Precarga un BF desde un administrador (condición c del art. 4). */
export function beneficiarioDesdeAdministrador(empresaId: string, a: Administrador): NuevoBeneficiario {
  return {
    ...beneficiarioVacio(empresaId),
    nombre: a.nombre,
    tipo_documento: a.tipo_documento,
    documento: a.documento,
    nacionalidad: a.nacionalidad ?? "Paraguaya",
    domicilio: a.domicilio,
    ciudad: a.ciudad,
    profesion: a.profesion,
    ocupacion: a.ocupacion,
    email: a.email,
    telefono: a.telefono,
    condiciones: ["c"],
    fecha_desde: a.fecha_designacion,
  };
}

function redondear(n: number) {
  return Math.round(n * 100) / 100;
}

export function participacionTotal(b: Pick<NuevoBeneficiario, "participacion_directa" | "participacion_indirecta">): number {
  return Number(b.participacion_directa || 0) + Number(b.participacion_indirecta || 0);
}

/** ¿Sigue siendo BF hoy? (sin fecha de cese, o cese futuro) */
export function bfVigente(b: Pick<NuevoBeneficiario, "fecha_hasta">, hoy = todayIso()): boolean {
  return !b.fecha_hasta || b.fecha_hasta >= hoy;
}

/** Datos mínimos de un BF (Ley 6446/2019 art. 6; Decreto 3241/2020 art. 6). Devuelve lo que falta. */
export function faltantesBeneficiario(b: NuevoBeneficiario): string[] {
  const f: string[] = [];
  if (!b.nombre.trim()) f.push("nombre");
  if (!b.documento?.trim()) f.push("documento");
  if (!b.nacionalidad?.trim()) f.push("nacionalidad");
  if (!b.fecha_nacimiento) f.push("fecha de nacimiento");
  if (!b.pais_residencia?.trim()) f.push("país de residencia");
  if (!b.domicilio?.trim() || !b.ciudad?.trim()) f.push("domicilio y ciudad");
  if (!b.profesion?.trim() && !b.ocupacion?.trim()) f.push("profesión u ocupación");
  if (b.condiciones.length === 0) f.push("condición de BF");
  if (!b.fecha_desde) f.push("fecha desde la que es BF");
  if (b.participacion_indirecta > 0 && !b.cadena_control?.trim()) f.push("cadena de control");
  if (b.es_pep && !b.cargo_pep?.trim()) f.push("cargo PEP");
  return f;
}

/** Validación dura antes de guardar (lo demás se muestra como "faltan datos"). */
export function validarBeneficiario(b: NuevoBeneficiario, otros: BeneficiarioFinal[], editandoId?: string | null): string | null {
  if (!b.nombre.trim()) return "Escribí el nombre y apellido.";
  for (const [k, label] of [
    ["participacion_directa", "La participación directa"],
    ["participacion_indirecta", "La participación indirecta"],
  ] as const) {
    const v = Number(b[k]);
    if (!Number.isFinite(v) || v < 0 || v > 100) return `${label} tiene que estar entre 0 y 100%.`;
  }
  if (b.porcentaje_votos !== null && (b.porcentaje_votos < 0 || b.porcentaje_votos > 100)) return "El % de votos tiene que estar entre 0 y 100%.";
  if (participacionTotal(b) > 100) return "La participación directa más la indirecta no puede superar el 100%.";
  if (b.condiciones.includes("a") && participacionTotal(b) < 10)
    return "Marcaste la condición a) (≥ 10% del capital), pero la participación cargada es menor al 10%.";
  if (b.condiciones.includes("b") && b.porcentaje_votos !== null && b.porcentaje_votos <= 25)
    return "Marcaste la condición b) (> 25% de los votos), pero el % de votos cargado no supera el 25%.";
  if (b.fecha_hasta && b.fecha_desde && b.fecha_hasta < b.fecha_desde) return "La fecha de cese no puede ser anterior a la fecha desde.";
  if (b.fecha_nacimiento && b.fecha_nacimiento > todayIso()) return "La fecha de nacimiento no puede ser futura.";
  const doc = b.documento?.trim().toLowerCase();
  if (doc && otros.some((o) => o.id !== editandoId && o.documento?.trim().toLowerCase() === doc))
    return "Ya hay un beneficiario final con ese documento.";
  const suma = otros.filter((o) => o.id !== editandoId && bfVigente(o)).reduce((s, o) => s + participacionTotal(o), 0) + (bfVigente(b) ? participacionTotal(b) : 0);
  if (suma > 100.0001) return `La suma de participaciones de los beneficiarios finales vigentes daría ${formatPct(suma)}: no puede superar el 100%.`;
  return null;
}

function limpiarTexto<T extends object>(obj: T): T {
  const out = { ...obj } as Record<string, unknown>;
  for (const [k, v] of Object.entries(out)) {
    if (typeof v === "string") out[k] = v.trim() === "" && k !== "nombre" ? null : v.trim();
  }
  return out as T;
}

export async function guardarBeneficiario(b: NuevoBeneficiario, id?: string | null) {
  const payload = limpiarTexto({
    ...b,
    participacion_directa: Number(b.participacion_directa || 0),
    participacion_indirecta: Number(b.participacion_indirecta || 0),
    cargo_pep: b.es_pep ? b.cargo_pep : null,
  });
  return id
    ? supabase.from("beneficiarios_finales").update(payload).eq("id", id).select().single()
    : supabase.from("beneficiarios_finales").insert(payload).select().single();
}

export async function eliminarBeneficiario(id: string) {
  return supabase.from("beneficiarios_finales").delete().eq("id", id);
}

// ─── Administradores y representantes ────────────────────────────────────

export type CargoAdministrador =
  | "presidente"
  | "vicepresidente"
  | "director_titular"
  | "director_suplente"
  | "sindico_titular"
  | "sindico_suplente"
  | "gerente"
  | "administrador"
  | "representante_legal"
  | "apoderado"
  | "otro";

export const CARGO_LABELS: Record<CargoAdministrador, string> = {
  presidente: "Presidente",
  vicepresidente: "Vicepresidente",
  director_titular: "Director titular",
  director_suplente: "Director suplente",
  sindico_titular: "Síndico titular",
  sindico_suplente: "Síndico suplente",
  gerente: "Gerente",
  administrador: "Administrador",
  representante_legal: "Representante legal",
  apoderado: "Apoderado",
  otro: "Otro",
};

/** Cargos con mandato a plazo: se pide la "vigencia del cargo". */
export const CARGOS_CON_MANDATO: CargoAdministrador[] = [
  "presidente",
  "vicepresidente",
  "director_titular",
  "director_suplente",
  "sindico_titular",
  "sindico_suplente",
  "administrador",
];

export interface Administrador {
  id: string;
  user_id: string;
  empresa_id: string;
  nombre: string;
  tipo_documento: TipoDocumento;
  documento: string | null;
  cargo: CargoAdministrador;
  cargo_detalle: string | null;
  es_representante_legal: boolean;
  nacionalidad: string | null;
  profesion: string | null;
  ocupacion: string | null;
  domicilio: string | null;
  ciudad: string | null;
  email: string | null;
  telefono: string | null;
  fecha_designacion: string | null;
  fecha_asamblea: string | null;
  vencimiento_mandato: string | null;
  instrumento: string | null;
  inscripto: boolean;
  activo: boolean;
  notas: string | null;
  obligacion_id: string | null;
  created_at: string;
  updated_at: string;
}

export type NuevoAdministrador = Omit<Administrador, "id" | "user_id" | "obligacion_id" | "created_at" | "updated_at">;

export function cargoLabel(a: Pick<Administrador, "cargo" | "cargo_detalle">): string {
  return a.cargo === "otro" ? a.cargo_detalle?.trim() || "Otro cargo" : CARGO_LABELS[a.cargo];
}

export function administradorVacio(empresaId: string, empresa?: Pick<Empresa, "vencimiento_mandato"> | null): NuevoAdministrador {
  return {
    empresa_id: empresaId,
    nombre: "",
    tipo_documento: "ci",
    documento: null,
    cargo: "director_titular",
    cargo_detalle: null,
    es_representante_legal: false,
    nacionalidad: "Paraguaya",
    profesion: null,
    ocupacion: null,
    domicilio: null,
    ciudad: null,
    email: null,
    telefono: null,
    fecha_designacion: null,
    fecha_asamblea: null,
    vencimiento_mandato: empresa?.vencimiento_mandato ?? null,
    instrumento: null,
    inscripto: false,
    activo: true,
    notas: null,
  };
}

export function aNuevoAdministrador(a: Administrador): NuevoAdministrador {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { id, user_id, obligacion_id, created_at, updated_at, ...rest } = a;
  return rest;
}

/** Datos mínimos de un administrador (Decreto 3241/2020 art. 4; manual SIARA). */
export function faltantesAdministrador(a: NuevoAdministrador): string[] {
  const f: string[] = [];
  if (!a.nombre.trim()) f.push("nombre");
  if (!a.documento?.trim()) f.push("documento");
  if (a.cargo === "otro" && !a.cargo_detalle?.trim()) f.push("cargo");
  if (!a.nacionalidad?.trim()) f.push("nacionalidad");
  if (!a.domicilio?.trim()) f.push("domicilio");
  if (!a.profesion?.trim() && !a.ocupacion?.trim()) f.push("profesión u ocupación");
  if (!a.fecha_designacion) f.push("fecha de asunción");
  if (CARGOS_CON_MANDATO.includes(a.cargo) && !a.vencimiento_mandato) f.push("vigencia del cargo");
  if (!a.email?.trim() && !a.telefono?.trim()) f.push("correo o teléfono");
  return f;
}

export function validarAdministrador(a: NuevoAdministrador): string | null {
  if (!a.nombre.trim()) return "Escribí el nombre y apellido.";
  if (a.cargo === "otro" && !a.cargo_detalle?.trim()) return "Escribí el cargo.";
  if (a.vencimiento_mandato && a.fecha_designacion && a.vencimiento_mandato < a.fecha_designacion)
    return "El vencimiento del mandato no puede ser anterior a la designación.";
  return null;
}

export async function guardarAdministrador(a: NuevoAdministrador, id?: string | null) {
  const payload = limpiarTexto({
    ...a,
    cargo_detalle: a.cargo === "otro" ? a.cargo_detalle : null,
    es_representante_legal: a.cargo === "representante_legal" ? true : a.es_representante_legal,
  });
  return id
    ? supabase.from("administradores").update(payload).eq("id", id).select().single()
    : supabase.from("administradores").insert(payload).select().single();
}

export async function eliminarAdministrador(id: string) {
  return supabase.from("administradores").delete().eq("id", id);
}

// ─── Hooks ───────────────────────────────────────────────────────────────

function useTabla<T>(tabla: string, empresaId: string, orden: string) {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const idRef = useRef(empresaId);

  useEffect(() => {
    idRef.current = empresaId;
  });

  const reload = useCallback(async () => {
    const res = await supabase.from(tabla).select("*").eq("empresa_id", idRef.current).order(orden);
    if (res.error) setError(res.error.message);
    else {
      setError(null);
      setData((res.data ?? []) as T[]);
    }
    setLoading(false);
  }, [tabla, orden]);

  useEffect(() => {
    reload();
  }, [reload, empresaId]);

  return { data, setData, loading, error, reload };
}

export function useBeneficiarios(empresaId: string) {
  return useTabla<BeneficiarioFinal>("beneficiarios_finales", empresaId, "created_at");
}

export function useAdministradores(empresaId: string) {
  return useTabla<Administrador>("administradores", empresaId, "created_at");
}

export async function guardarSeguimientoSiara(empresaId: string, patch: Pick<CamposSiaraEmpresa, "siara_ultima_declaracion" | "siara_numero_solicitud">) {
  return supabase.from("empresas").update(patch).eq("id", empresaId).select().single();
}

// ─── Checklist "listo para declarar" ─────────────────────────────────────

export interface ItemChecklist {
  seccion: "Persona jurídica" | "Accionistas" | "Beneficiarios finales" | "Administradores";
  texto: string;
  ok: boolean;
  /** Detalle de lo que falta (cuando !ok). */
  detalle?: string;
}

export function checklistSiara(
  empresa: EmpresaSiara,
  accionistas: Accionista[],
  bfs: BeneficiarioFinal[],
  admins: Administrador[]
): ItemChecklist[] {
  const out: ItemChecklist[] = [];
  const add = (seccion: ItemChecklist["seccion"], texto: string, ok: boolean, detalle?: string) => out.push({ seccion, texto, ok, detalle });

  // Persona jurídica
  add("Persona jurídica", "RUC", !!empresa.ruc?.trim());
  add("Persona jurídica", "Correo electrónico institucional", !!empresa.email_institucional?.trim());
  const dom = [
    !empresa.domicilio?.trim() && "calle",
    !empresa.ciudad?.trim() && "ciudad",
    !empresa.departamento?.trim() && "departamento",
    !empresa.barrio?.trim() && "barrio",
  ].filter(Boolean) as string[];
  add("Persona jurídica", "Domicilio social completo", dom.length === 0, dom.length ? `Falta: ${dom.join(", ")}` : undefined);
  add("Persona jurídica", "Fecha de constitución", !!empresa.fecha_constitucion);
  add("Persona jurídica", "Datos de inscripción registral", !!empresa.inscripcion_registral?.trim());
  add("Persona jurídica", "Capital y valor nominal de cada acción o cuota", !!empresa.capital_integrado && !!empresa.valor_nominal_accion);

  // Accionistas
  const activos = accionistas.filter((a) => a.activo !== false && Number(a.acciones) > 0);
  add("Accionistas", "Libro de accionistas cargado", activos.length > 0);
  const sinDoc = activos.filter((a) => !a.documento?.trim());
  add("Accionistas", "Documento de cada accionista", activos.length > 0 && sinDoc.length === 0, sinDoc.length ? `Sin documento: ${sinDoc.map((a) => a.nombre).join(", ")}` : undefined);
  const sinContacto = activos.filter((a) => !a.email?.trim() || !a.telefono?.trim());
  add(
    "Accionistas",
    "Correo y celular de cada accionista",
    activos.length > 0 && sinContacto.length === 0,
    sinContacto.length ? `Incompleto: ${sinContacto.map((a) => a.nombre).join(", ")}` : undefined
  );

  // Beneficiarios finales
  const vigentes = bfs.filter((b) => bfVigente(b));
  const completos = vigentes.filter((b) => faltantesBeneficiario(aNuevoBeneficiario(b)).length === 0);
  add("Beneficiarios finales", "Al menos un beneficiario final con todos sus datos", completos.length > 0);
  const incompletos = vigentes.filter((b) => !completos.includes(b));
  add(
    "Beneficiarios finales",
    "Todos los beneficiarios finales completos",
    vigentes.length > 0 && incompletos.length === 0,
    incompletos.length ? incompletos.map((b) => `${b.nombre}: ${faltantesBeneficiario(aNuevoBeneficiario(b)).join(", ")}`).join(" · ") : undefined
  );
  const { filas } = calcularParticipaciones(activos);
  const docsBF = new Set(vigentes.map((b) => b.documento?.trim().toLowerCase()).filter(Boolean));
  const idsBF = new Set(vigentes.map((b) => b.accionista_id).filter(Boolean));
  const sinDeclarar = filas.filter(
    (f) => f.posibleBF && f.tipo_persona === "fisica" && !idsBF.has(f.id) && !(f.documento && docsBF.has(f.documento.trim().toLowerCase()))
  );
  add(
    "Beneficiarios finales",
    "Accionistas que superan los umbrales, declarados como BF",
    sinDeclarar.length === 0,
    sinDeclarar.length ? `Revisá: ${sinDeclarar.map((f) => `${f.nombre} (${formatPct(f.pctCapital)})`).join(", ")}` : undefined
  );
  const juridicas = filas.filter((f) => f.posibleBF && f.tipo_persona === "juridica");
  if (juridicas.length > 0) {
    const conCadena = vigentes.some((b) => Number(b.participacion_indirecta) > 0);
    add(
      "Beneficiarios finales",
      "Personas físicas detrás de los accionistas que son sociedades",
      conCadena,
      conCadena ? undefined : `Identificá quién controla a ${juridicas.map((j) => j.nombre).join(", ")} (participación indirecta).`
    );
  }

  // Administradores
  const adm = admins.filter((a) => a.activo);
  add("Administradores", "Órgano de administración cargado", adm.length > 0);
  add("Administradores", "Representante legal identificado", adm.some((a) => a.es_representante_legal || a.cargo === "representante_legal"));
  const admInc = adm.filter((a) => faltantesAdministrador(aNuevoAdministrador(a)).length > 0);
  add(
    "Administradores",
    "Datos completos de cada administrador",
    adm.length > 0 && admInc.length === 0,
    admInc.length ? admInc.map((a) => `${a.nombre}: ${faltantesAdministrador(aNuevoAdministrador(a)).join(", ")}`).join(" · ") : undefined
  );

  return out;
}

// ─── Resumen imprimible ──────────────────────────────────────────────────

function esc(s: string | number | null | undefined): string {
  if (s === null || s === undefined || s === "") return "—";
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function tablaClaveValor(filas: [string, string | number | null | undefined][]): string {
  return `<table class="tabla"><tbody>${filas.map(([k, v]) => `<tr><th style="width:38%">${esc(k)}</th><td>${esc(v)}</td></tr>`).join("")}</tbody></table>`;
}

export function resumenSiaraHtml(empresa: EmpresaSiara, accionistas: Accionista[], bfs: BeneficiarioFinal[], admins: Administrador[]): string {
  const activos = accionistas.filter((a) => a.activo !== false && Number(a.acciones) > 0);
  const { filas, totalAcciones, totalVotos } = calcularParticipaciones(activos);
  const pendientes = checklistSiara(empresa, accionistas, bfs, admins).filter((i) => !i.ok);

  const pej = tablaClaveValor([
    ["Razón social", empresa.denominacion],
    ["Tipo", TIPO_LABELS[empresa.tipo]],
    ["RUC", empresa.ruc],
    ["Correo institucional", empresa.email_institucional],
    ["Página web", empresa.pagina_web],
    ["Departamento", empresa.departamento],
    ["Ciudad", empresa.ciudad],
    ["Barrio", empresa.barrio],
    ["Domicilio social (calle y número)", empresa.domicilio],
    ["Domicilio comercial", empresa.domicilio_comercial],
    ["Actividad principal", empresa.actividad_principal],
    ["Fecha de constitución", empresa.fecha_constitucion ? formatFecha(empresa.fecha_constitucion) : null],
    ["Inscripción registral", empresa.inscripcion_registral],
    ["Fecha de inscripción", empresa.fecha_inscripcion ? formatFecha(empresa.fecha_inscripcion) : null],
    ["Capital integrado", empresa.capital_integrado ? formatPyg(empresa.capital_integrado) : null],
    ["Valor nominal por acción / cuota", empresa.valor_nominal_accion ? formatPyg(empresa.valor_nominal_accion) : null],
    ["Total de acciones / cuotas", formatNumero(totalAcciones)],
    ["Total de votos", formatNumero(totalVotos)],
  ]);

  const acc = filas.length
    ? `<table class="tabla"><thead><tr><th>Nombre</th><th>Documento</th><th class="num">Acciones</th><th class="num">Votos</th><th class="num">% capital</th><th class="num">% votos</th><th>Contacto</th></tr></thead><tbody>${filas
        .map(
          (f) =>
            `<tr><td>${esc(f.nombre)}${f.tipo_persona === "juridica" ? " (persona jurídica)" : ""}</td><td>${esc(f.documento)}</td><td class="num">${esc(formatNumero(f.acciones))}</td><td class="num">${esc(formatNumero(f.votos))}</td><td class="num">${esc(formatPct(f.pctCapital))}</td><td class="num">${esc(formatPct(f.pctVotos))}</td><td>${esc([f.email, f.telefono].filter(Boolean).join(" · "))}</td></tr>`
        )
        .join("")}</tbody></table>`
    : "<p>Sin accionistas cargados.</p>";

  const bfHtml = bfs.length
    ? bfs
        .map(
          (b, i) =>
            `<p class="meta">Beneficiario final ${i + 1}${bfVigente(b) ? "" : " · cesado"}</p>${tablaClaveValor([
              ["Nombres y apellidos", b.nombre],
              [TIPO_DOCUMENTO_LABELS[b.tipo_documento], b.documento],
              ["RUC", b.ruc],
              ["Nacionalidad", b.nacionalidad],
              ["Fecha de nacimiento", b.fecha_nacimiento ? formatFecha(b.fecha_nacimiento) : null],
              ["País de residencia", b.pais_residencia],
              ["Domicilio", [b.domicilio, b.barrio, b.ciudad, b.departamento].filter(Boolean).join(", ")],
              ["Profesión / ocupación", [b.profesion, b.ocupacion].filter(Boolean).join(" / ")],
              ["Correo / teléfono", [b.email, b.telefono].filter(Boolean).join(" · ")],
              ["Participación directa", formatPct(Number(b.participacion_directa))],
              ["Participación indirecta", formatPct(Number(b.participacion_indirecta))],
              ["% de votos", b.porcentaje_votos !== null ? formatPct(Number(b.porcentaje_votos)) : null],
              ["Condición (Ley 6446/2019, art. 4)", b.condiciones.map((c) => CONDICIONES_BF.find((x) => x.key === c)?.corto).join("; ")],
              ["Cadena de control", b.cadena_control],
              ["Persona expuesta políticamente", b.es_pep ? `Sí — ${b.cargo_pep ?? ""}` : "No"],
              ["BF desde", b.fecha_desde ? formatFecha(b.fecha_desde) : null],
              ["BF hasta", b.fecha_hasta ? formatFecha(b.fecha_hasta) : null],
            ])}`
        )
        .join("")
    : "<p>Sin beneficiarios finales cargados.</p>";

  const admHtml = admins.length
    ? `<table class="tabla"><thead><tr><th>Nombre</th><th>Documento</th><th>Cargo</th><th>Rep. legal</th><th>Asunción</th><th>Vigencia</th><th>Instrumento</th></tr></thead><tbody>${admins
        .map(
          (a) =>
            `<tr><td>${esc(a.nombre)}${a.activo ? "" : " (cesado)"}<br><small>${esc([a.nacionalidad, a.profesion || a.ocupacion, a.domicilio, a.email, a.telefono].filter(Boolean).join(" · "))}</small></td><td>${esc(a.documento)}</td><td>${esc(cargoLabel(a))}</td><td>${a.es_representante_legal || a.cargo === "representante_legal" ? "Sí" : "No"}</td><td>${esc(a.fecha_designacion ? formatFecha(a.fecha_designacion) : null)}</td><td>${esc(a.vencimiento_mandato ? formatFecha(a.vencimiento_mandato) : null)}</td><td>${esc(a.instrumento)}</td></tr>`
        )
        .join("")}</tbody></table>`
    : "<p>Sin administradores cargados.</p>";

  const faltan = pendientes.length
    ? `<div class="nota" style="display:block"><strong>Faltan ${pendientes.length} datos antes de declarar:</strong><ul>${pendientes
        .map((p) => `<li>${esc(p.seccion)}: ${esc(p.texto)}${p.detalle ? ` — ${esc(p.detalle)}` : ""}</li>`)
        .join("")}</ul></div>`
    : "";

  return `<p class="meta">Resumen para cargar en SIARA · ${esc(formatFecha(todayIso()))}</p>
<h1>${esc(empresa.denominacion)}</h1>
${faltan}
<h2 style="font-size:12pt;margin:14pt 0 4pt">1. Datos de la persona jurídica</h2>${pej}
<h2 style="font-size:12pt;margin:14pt 0 4pt">2. Accionistas / socios</h2>${acc}
<h2 style="font-size:12pt;margin:14pt 0 4pt">3. Beneficiarios finales</h2>${bfHtml}
<h2 style="font-size:12pt;margin:14pt 0 4pt">4. Administradores y representantes</h2>${admHtml}
<p class="aviso">Hoja de trabajo para ordenar la información que se declara en SIARA (Ley N° 6446/2019 y Decreto N° 3241/2020). No reemplaza la declaración ni la documentación que exige el sistema (estatuto o última modificación del capital, última acta de elección de autoridades, registro de accionistas, poderes), firmada con firma electrónica cualificada. Contenido informativo; no constituye asesoramiento legal personalizado.</p>`;
}

/**
 * Abre el resumen en una ventana y lanza el diálogo de impresión (Guardar
 * como PDF). A diferencia de los modelos de documentos, acá el texto SÍ se
 * puede seleccionar y copiar: la idea es pasarlo a los campos de SIARA.
 */
export function imprimirResumenSiara(empresa: EmpresaSiara, html: string): boolean {
  const w = window.open("", "_blank");
  if (!w) return false;
  const doc = documentoImprimible(`SIARA — ${empresa.denominacion}`, html, textoMarcaAgua(empresa.denominacion)).replace(
    "</style></head>",
    `body { -webkit-user-select: text; user-select: text; }
.doc { font-size: 10.5pt; }
.doc h2 { font-family: "Inter", Arial, sans-serif; color: #1e2f25; page-break-after: avoid; }
.doc .tabla { page-break-inside: auto; }
.doc .tabla tr { page-break-inside: avoid; }
.doc small { color: #666; font-size: 8.5pt; }
@media print { .doc .nota { display: block !important; } }
</style></head>`
  );
  w.document.open();
  w.document.write(doc);
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 350);
  return true;
}
