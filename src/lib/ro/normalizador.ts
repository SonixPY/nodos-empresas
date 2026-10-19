/**
 * Reporte de Operaciones (RO) SEPRELAD: normalización y validación.
 *
 * Port de la implementación de referencia del kit (seprelad_core.py) más lo
 * que la especificación pide y la referencia no hacía: columnas duplicadas,
 * tasa de cambio del mismo día, sugerencia de RUC de otras filas, dos números
 * en una celda y reglas por empresa (ciudad fija, ciudad y teléfono por
 * defecto). Corre en el navegador: los datos nunca salen del dispositivo.
 *
 * Base: Res. SEPRELAD 201/2020, art. 31 (registro de todas las operaciones,
 * sin importar el monto). El formato de los campos sale de la macro oficial
 * y de rechazos reales de la plataforma: es una especificación técnica.
 */
import listas from "./datos/listas.json";
import equivalencias from "./datos/equivalencias.json";
import { ciudadExiste, ciudadesPorNombre } from "./ciudades";

export type Regimen = "inmobiliarias" | "caudales";
export type TipoObservacion = "COMPLETAR" | "VERIFICAR" | "AJUSTE";

export interface Observacion {
  item: number;
  tipo: TipoObservacion;
  campo: string;
  mensaje: string;
}

export type Valor = string | number | null | undefined;
/** Una fila tal como sale de la planilla: claves del JSON oficial. Los campos
 * duplicados llegan como lista (se resuelven acá); `_montoTotal`, `_tasa` y
 * `_montosEnGs` vienen de columnas auxiliares. */
export type FilaCruda = Record<string, Valor | Valor[] | boolean>;
export type Registro = Record<string, string | number>;

export interface ReglasEmpresa {
  ciudadFija?: number | null;
  ciudadPorDefecto?: number;
  telefonoPorDefecto?: string;
}

export interface Opciones {
  periodo?: { desde: string; hasta: string } | null;
  reglas?: ReglasEmpresa;
}

export interface Resultado {
  registros: Registro[];
  observaciones: Observacion[];
}

export const CAMPOS_INMOBILIARIAS = [
  "fechaOperacion", "tipoInmueble", "clasificacion", "ctaCteCatastral", "modalidadOperacion",
  "formaPago", "nombreEdificio", "tipoOperacion", "pisoNumero", "montoEntrega", "montoFinanciado",
  "cantidadCuotas", "montoCompensacion", "compradorTipoPersona", "compradorTipoDocumento",
  "compradorNumeroDocumento", "compradorDenominacion", "compradorNumeroTelefono", "compradorPep",
  "compradorNumeroCelular", "vendedorTipoPersona", "vendedorTipoDocumento", "vendedorNumeroDocumento",
  "vendedorDenominacion", "vendedorNumeroTelefono", "vendedorPep", "compradorActividad",
  "compradorNacionalidadCodigo", "compradorResidenciaCodigo", "compradorCiudadCodigo",
  "vendedorActividad", "vendedorNacionalidadCodigo", "vendedorResidenciaCodigo", "vendedorCiudadCodigo",
  "vendedorNumeroCelular", "ciudadCodigo", "monedaOperacionCodigo",
] as const;

export const CAMPOS_CAUDALES = [
  "fechaOperacion", "codigoTipoDocumento", "numeroDocumento", "denominacion", "codigoPaisNacionalidad",
  "ocupacion", "direccion", "numeroTelefono", "numeroPrecintoSeguridad", "monto", "montoGuaranies",
  "codigoCiudadOrigen", "codigoCiudadDestino", "codigoMoneda", "numeroReciboTransporte",
] as const;

export const CAMPOS: Record<Regimen, readonly string[]> = { inmobiliarias: CAMPOS_INMOBILIARIAS, caudales: CAMPOS_CAUDALES };

/** Campos numéricos del JSON oficial (el resto va como texto). */
export const NUMERICOS = new Set([
  "montoEntrega", "montoFinanciado", "cantidadCuotas", "montoCompensacion", "compradorCiudadCodigo",
  "vendedorCiudadCodigo", "ciudadCodigo", "monto", "montoGuaranies", "codigoCiudadOrigen", "codigoCiudadDestino",
]);

export const TELEFONO_POR_DEFECTO = "99999999";
export const CIUDAD_POR_DEFECTO = 1; // Asunción: solo si la ciudad está vacía o no existe en la tabla

const ROLES = ["comprador", "vendedor"] as const;
type Rol = (typeof ROLES)[number];
const SUFIJOS_ROL = [
  "TipoPersona", "TipoDocumento", "NumeroDocumento", "Denominacion", "NumeroTelefono", "Pep",
  "NumeroCelular", "Actividad", "NacionalidadCodigo", "ResidenciaCodigo", "CiudadCodigo",
] as const;

// ---------------------------------------------------------------- utilidades

/** MAYÚSCULAS, sin tildes, sin signos, espacios simples (clave de comparación). */
export function norm(s: unknown): string {
  return String(s ?? "")
    .normalize("NFKD")
    .replace(/[^\x00-\x7F]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .trim();
}

export function limpiarTexto(s: unknown): string {
  if (s === null || s === undefined) return "";
  return String(s).replace(/ /g, " ").replace(/\s+/g, " ").trim();
}

const esVacio = (v: unknown) => v === null || v === undefined || (typeof v === "string" && v.trim() === "");
const esGuion = (v: unknown) => ["-", "N/A", "NA", "0"].includes(limpiarTexto(v).toUpperCase());

/** Dígito verificador de RUC paraguayo (módulo 11, base máxima 11; algoritmo SET). */
export function dvRuc(numero: string | number): number {
  let total = 0;
  let k = 2;
  for (const d of String(numero).split("").reverse()) {
    total += Number(d) * k;
    k = k < 11 ? k + 1 : 2;
  }
  const resto = total % 11;
  return resto > 1 ? 11 - resto : 0;
}

/** Primer número de una celda que trae varios ("0981… / 0982…"). */
function primero(v: string): { valor: string; varios: boolean } {
  const partes = v.split(/[\/;|,]|\s+(?:y|o)\s+/i).map((x) => x.trim()).filter((x) => /\d/.test(x));
  return { valor: partes[0] ?? v, varios: partes.length > 1 };
}

/** Solo dígitos, con 0 inicial para números paraguayos. Vacío o en ceros → teléfono por defecto. */
export function normalizarTelefono(v: Valor, defecto = TELEFONO_POR_DEFECTO): string {
  const crudo = typeof v === "number" ? String(Math.trunc(v)) : String(v ?? "");
  let s = primero(crudo).valor.replace(/\D/g, "");
  if (s.startsWith("595") && s.length === 12) s = "0" + s.slice(3); // +595 981 123456 → 0981123456
  if (s.length === 9 && s.startsWith("9")) s = "0" + s; // 981123456 → 0981123456 (celular)
  if (s.length === 8 && s.startsWith("2")) s = "0" + s; // 21415559 → 021415559 (fijo)
  if (!s || /^0+$/.test(s)) return defecto;
  return s;
}

const ISO = (y: number, m: number, d: number): string | null => {
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
  return `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
};

/** Fecha en formato yyyy-MM-dd, o null. Acepta dd/MM/yyyy, dd-MM-yyyy, yyyy-MM-dd y número de serie de Excel. */
export function parsearFecha(v: Valor): string | null {
  if (typeof v === "number") {
    if (v > 20000 && v < 80000) {
      const dt = new Date(Date.UTC(1899, 11, 30) + Math.floor(v) * 86400000);
      return dt.toISOString().slice(0, 10);
    }
    return null;
  }
  const s = String(v ?? "").trim();
  let m = s.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
  if (m) return ISO(Number(m[3]), Number(m[2]), Number(m[1]));
  m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T]\d{1,2}:\d{2}(?::\d{2})?(?:\.\d+)?Z?)?$/);
  if (m) return ISO(Number(m[1]), Number(m[2]), Number(m[3]));
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2})$/);
  if (m) {
    const yy = Number(m[3]);
    return ISO(yy < 69 ? 2000 + yy : 1900 + yy, Number(m[2]), Number(m[1]));
  }
  return null;
}

/** Monto como número. Acepta 1.500.000 | 1500000 | "3.958,96" | "₲s 1.500.000" | "-" | "N/A". */
export function parsearMonto(v: Valor): number | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "number") {
    if (!Number.isFinite(v)) return null;
    return Number.isInteger(v) ? v : Math.round(v * 100) / 100;
  }
  let s = String(v).trim();
  if (["", "-", "N/A", "NA"].includes(s.toUpperCase())) return null;
  s = s.replace(/[^\d.,-]/g, "");
  if (!s) return null;
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  else if (/\.\d{3}(\.|$)/.test(s)) s = s.replace(/\./g, "");
  const x = Number(s);
  if (!Number.isFinite(x)) return null;
  return Number.isInteger(x) ? x : Math.round(x * 100) / 100;
}

const trimestreDe = (iso: string) => `${iso.slice(0, 4)}-T${Math.floor((Number(iso.slice(5, 7)) - 1) / 3) + 1}`;
export { trimestreDe };

/** Desde y hasta (yyyy-MM-dd) de un período "2026-T3". */
export function rangoTrimestre(periodo: string): { desde: string; hasta: string } {
  const [y, t] = periodo.split("-T").map(Number);
  const mesIni = (t - 1) * 3 + 1;
  const fin = new Date(Date.UTC(y, mesIni + 2, 0)).getUTCDate();
  return { desde: `${y}-${String(mesIni).padStart(2, "0")}-01`, hasta: `${y}-${String(mesIni + 2).padStart(2, "0")}-${fin}` };
}

// ---------------------------------------------------------------- tablas

type Listas = typeof listas;
type ClaveLista = "tipoInmueble" | "clasificacion" | "modalidadOperacion" | "formaPago" | "tipoOperacion" | "tipoPersona" | "tipoDocumento" | "pep";

const VALORES = new Map<string, string>();
for (const clave of ["tipoInmueble", "clasificacion", "modalidadOperacion", "formaPago", "tipoOperacion", "tipoPersona", "tipoDocumento", "pep"] as ClaveLista[]) {
  for (const v of (listas as Listas)[clave] as string[]) VALORES.set(`${clave}|${norm(v)}`, v);
}
const ACTIVIDADES = new Map<string, string>(((listas as Listas).actividadesEconomicas as string[]).map((a) => [norm(a), a]));
const PAISES = new Set<string>((listas as Listas).paisesISO3 as string[]);
const MONEDAS = new Set<string>((listas as Listas).monedasISO4217 as string[]);
const EQ = equivalencias as {
  actividad_por_defecto: Record<"comprador" | "vendedor" | "cliente_caudales", string>;
  actividades: Record<string, string>;
  valores_lista: Record<string, string>;
  nacionalidades: Record<string, string>;
};

export const OPCIONES_LISTA = {
  tipoInmueble: listas.tipoInmueble,
  clasificacion: listas.clasificacion,
  modalidadOperacion: listas.modalidadOperacion,
  formaPago: Array.from(new Set(listas.formaPago)),
  tipoOperacion: listas.tipoOperacion,
  tipoPersona: listas.tipoPersona,
  tipoDocumento: listas.tipoDocumento,
  pep: listas.pep,
};

// ---------------------------------------------------------------- normalizador

export class Normalizador {
  readonly regimen: Regimen;
  private periodo: { desde: string; hasta: string } | null;
  private ciudadFija: number | null;
  private ciudadDefecto: number;
  private telDefecto: string;

  constructor(regimen: Regimen, opciones: Opciones = {}) {
    this.regimen = regimen;
    this.periodo = opciones.periodo ?? null;
    const r = opciones.reglas ?? {};
    this.ciudadFija = r.ciudadFija && ciudadExiste(r.ciudadFija) ? r.ciudadFija : null;
    this.ciudadDefecto = r.ciudadPorDefecto && ciudadExiste(r.ciudadPorDefecto) ? r.ciudadPorDefecto : CIUDAD_POR_DEFECTO;
    this.telDefecto = r.telefonoPorDefecto && /^\d{8,12}$/.test(r.telefonoPorDefecto) ? r.telefonoPorDefecto : TELEFONO_POR_DEFECTO;
  }

  private lista(clave: ClaveLista, v: Valor, item: number, campo: string, obs: Observacion[]): string {
    if (esVacio(v)) return "";
    const n = norm(v);
    const oficial = VALORES.get(`${clave}|${n}`);
    if (oficial) return oficial;
    if (clave === "tipoDocumento" && n === "DEF") {
      obs.push({ item, tipo: "VERIFICAR", campo, mensaje: 'Se cargó "DEF" como "TDEF", el valor de la tabla oficial. Confirmalo con SEPRELAD.' });
      return "TDEF";
    }
    const alias = EQ.valores_lista[n];
    if (alias && VALORES.get(`${clave}|${norm(alias)}`)) {
      obs.push({ item, tipo: "AJUSTE", campo, mensaje: `"${limpiarTexto(v)}" se cargó como "${alias}".` });
      return alias;
    }
    obs.push({ item, tipo: "COMPLETAR", campo, mensaje: `"${limpiarTexto(v)}" no está en la tabla oficial.` });
    return "";
  }

  private actividad(v: Valor, rol: "comprador" | "vendedor" | "cliente_caudales", item: number, campo: string, obs: Observacion[]): string {
    const n = norm(v);
    const oficial = ACTIVIDADES.get(n);
    if (oficial) return oficial;
    const eq = EQ.actividades[n];
    if (eq) {
      obs.push({ item, tipo: "AJUSTE", campo, mensaje: `"${limpiarTexto(v)}" se cargó como "${eq}".` });
      return eq;
    }
    const defecto = EQ.actividad_por_defecto[rol];
    obs.push({ item, tipo: "AJUSTE", campo, mensaje: `${esVacio(v) ? "Actividad vacía" : `"${limpiarTexto(v)}" no está en la tabla oficial`}: se cargó "${defecto}".` });
    return defecto;
  }

  private pais(v: Valor, item: number, campo: string, obs: Observacion[], requerido: boolean): string {
    const s = limpiarTexto(v).toUpperCase();
    if (PAISES.has(s)) return s;
    const eq = EQ.nacionalidades[norm(v)];
    if (eq) {
      obs.push({ item, tipo: "AJUSTE", campo, mensaje: `"${limpiarTexto(v)}" se cargó como "${eq}".` });
      return eq;
    }
    if (s) obs.push({ item, tipo: "COMPLETAR", campo, mensaje: `"${limpiarTexto(v)}" no tiene código ISO 3166-1 alfa-3.` });
    else if (requerido) obs.push({ item, tipo: "VERIFICAR", campo, mensaje: "País vacío." });
    return "";
  }

  private ciudad(v: Valor, item: number, campo: string, obs: Observacion[]): number {
    if (this.ciudadFija) return this.ciudadFija;
    if (!esVacio(v)) {
      const texto = limpiarTexto(v);
      if (/^\d+(\.0+)?$/.test(texto)) {
        const cod = Math.trunc(Number(texto));
        if (ciudadExiste(cod)) return cod; // un código válido del exterior nunca se reemplaza
      } else {
        const cods = ciudadesPorNombre(norm(texto));
        if (cods.length === 1) return cods[0];
        if (cods.length > 1) {
          obs.push({ item, tipo: "VERIFICAR", campo, mensaje: `"${texto}" corresponde a más de una ciudad (códigos ${cods.join(" y ")}): se usó ${cods[0]}.` });
          return cods[0];
        }
      }
    }
    obs.push({ item, tipo: "AJUSTE", campo, mensaje: `Ciudad ${esVacio(v) ? "vacía" : `"${limpiarTexto(v)}" inexistente`}: se cargó ${this.ciudadDefecto}.` });
    return this.ciudadDefecto;
  }

  private documento(tipo: string, numero: Valor, item: number, campo: string, obs: Observacion[]): string {
    let nd = typeof numero === "number" && Number.isInteger(numero) ? String(numero) : limpiarTexto(numero).replace(/\s/g, "");
    if (/[\/;|]/.test(nd)) {
      const { valor, varios } = primero(nd);
      if (varios) obs.push({ item, tipo: "VERIFICAR", campo, mensaje: `La celda trae más de un documento ("${limpiarTexto(numero)}"): se cargó el primero.` });
      nd = valor.replace(/\s/g, "");
    }
    if (!nd) {
      obs.push({ item, tipo: "COMPLETAR", campo, mensaje: "Número de documento vacío." });
      return "";
    }
    if (tipo === "CI") {
      nd = nd.replace(/\./g, "");
      if (/^\d+-\d$/.test(nd)) obs.push({ item, tipo: "VERIFICAR", campo, mensaje: `C.I. con guion (${nd}): ¿es un RUC?` });
      else if (/^09\d{8}$/.test(nd)) obs.push({ item, tipo: "COMPLETAR", campo, mensaje: `"${nd}" parece un teléfono, no una cédula.` });
      else if (!/^\d{3,10}$/.test(nd)) obs.push({ item, tipo: "COMPLETAR", campo, mensaje: `C.I. con formato inválido: "${limpiarTexto(numero)}".` });
    } else if (tipo === "RUC") {
      nd = nd.replace(/\./g, "");
      if (/^\d{5,8}$/.test(nd)) {
        nd = `${nd}-${dvRuc(nd)}`;
        obs.push({ item, tipo: "AJUSTE", campo, mensaje: `RUC sin dígito verificador: se calculó ${nd}.` });
      }
      const m = nd.match(/^(\d{5,8})-(\d)$/);
      if (!m) obs.push({ item, tipo: "COMPLETAR", campo, mensaje: `RUC con formato inválido: "${limpiarTexto(numero)}".` });
      else if (dvRuc(m[1]) !== Number(m[2]))
        obs.push({ item, tipo: "VERIFICAR", campo, mensaje: `RUC ${nd}: el dígito verificador no corresponde (sería ${m[1]}-${dvRuc(m[1])}).` });
    } else if (!/^[A-Za-z0-9-]{2,20}$/.test(nd)) {
      obs.push({ item, tipo: "COMPLETAR", campo, mensaje: `Documento con formato inválido: "${limpiarTexto(numero)}".` });
    }
    return nd;
  }

  private moneda(v: Valor, item: number, campo: string, obs: Observacion[]): string {
    let mon = limpiarTexto(v).toUpperCase();
    const alias = EQ.valores_lista[norm(mon)];
    if (alias && MONEDAS.has(alias)) {
      if (alias !== mon) obs.push({ item, tipo: "AJUSTE", campo, mensaje: `"${limpiarTexto(v)}" se cargó como "${alias}".` });
      mon = alias;
    }
    if (!MONEDAS.has(mon)) obs.push({ item, tipo: "COMPLETAR", campo, mensaje: mon ? `La moneda "${mon}" no es un código ISO 4217.` : "Moneda vacía." });
    return mon;
  }

  private fecha(v: Valor, item: number, obs: Observacion[]): string {
    const f = parsearFecha(v);
    if (!f) {
      obs.push({ item, tipo: "COMPLETAR", campo: "fechaOperacion", mensaje: `Fecha inválida: "${limpiarTexto(v)}".` });
      return "";
    }
    if (this.periodo && (f < this.periodo.desde || f > this.periodo.hasta)) {
      obs.push({ item, tipo: "VERIFICAR", campo: "fechaOperacion", mensaje: `${f.split("-").reverse().join("/")} cae fuera del período elegido.` });
    }
    return f;
  }

  /** Elige entre columnas duplicadas: el par que cumple entrega + financiado = total. */
  private resolverDuplicados(r: FilaCruda, item: number, obs: Observacion[]): { fin: Valor; cuo: Valor } {
    const fins = Array.isArray(r.montoFinanciado) ? r.montoFinanciado : [r.montoFinanciado as Valor];
    const cuos = Array.isArray(r.cantidadCuotas) ? r.cantidadCuotas : [r.cantidadCuotas as Valor];
    if (fins.length <= 1 && cuos.length <= 1) return { fin: fins[0], cuo: cuos[0] };
    const ent = parsearMonto(r.montoEntrega as Valor) ?? 0;
    const total = parsearMonto(r._montoTotal as Valor);
    if (total !== null) {
      for (let i = 0; i < fins.length; i++) {
        const f = parsearMonto(fins[i]) ?? 0;
        if (Math.abs(ent + f - total) <= 1) {
          if (i > 0) obs.push({ item, tipo: "AJUSTE", campo: "montoFinanciado", mensaje: "La planilla trae las columnas de cuotas dos veces: se usó el par que cumple entrega + financiado = total." });
          return { fin: fins[i], cuo: cuos[Math.min(i, cuos.length - 1)] };
        }
      }
    }
    obs.push({ item, tipo: "VERIFICAR", campo: "montoFinanciado", mensaje: "La planilla trae las columnas de cuotas dos veces y ninguna cuadra con el total: se usó la primera." });
    return { fin: fins[0], cuo: cuos[0] };
  }

  private inmobiliaria(r: FilaCruda, item: number, obs: Observacion[]): Registro {
    const o: Registro = {};
    const g = (k: string) => r[k] as Valor;
    o.fechaOperacion = this.fecha(g("fechaOperacion"), item, obs);
    o.tipoInmueble = this.lista("tipoInmueble", g("tipoInmueble"), item, "tipoInmueble", obs);
    o.clasificacion = this.lista("clasificacion", g("clasificacion"), item, "clasificacion", obs);
    o.ctaCteCatastral = limpiarTexto(g("ctaCteCatastral"));
    o.modalidadOperacion = this.lista("modalidadOperacion", g("modalidadOperacion"), item, "modalidadOperacion", obs);
    o.formaPago = this.lista("formaPago", g("formaPago"), item, "formaPago", obs);
    o.nombreEdificio = esGuion(g("nombreEdificio")) ? "" : limpiarTexto(g("nombreEdificio"));
    o.tipoOperacion = this.lista("tipoOperacion", g("tipoOperacion"), item, "tipoOperacion", obs);
    o.pisoNumero = esGuion(g("pisoNumero")) ? "" : limpiarTexto(g("pisoNumero"));
    for (const k of ["tipoInmueble", "clasificacion", "modalidadOperacion", "formaPago", "tipoOperacion"]) {
      if (!o[k] && !obs.some((x) => x.item === item && x.campo === k)) obs.push({ item, tipo: "COMPLETAR", campo: k, mensaje: "Campo vacío." });
    }

    // Montos: compensación, financiado y cuotas en 0 cuando no corresponden (la SEPRELAD rechaza null).
    const { fin: finCrudo, cuo: cuoCrudo } = this.resolverDuplicados(r, item, obs);
    const ent = parsearMonto(g("montoEntrega")) ?? 0;
    const fin = parsearMonto(finCrudo) ?? 0;
    let cuo = Math.trunc(parsearMonto(cuoCrudo) ?? 0);
    const com = parsearMonto(g("montoCompensacion")) ?? 0;
    if (fin < 0) obs.push({ item, tipo: "VERIFICAR", campo: "montoFinanciado", mensaje: `Monto financiado negativo (${fin}).` });
    if (fin > 0 && cuo === 0) obs.push({ item, tipo: "VERIFICAR", campo: "cantidadCuotas", mensaje: "Hay saldo financiado pero 0 cuotas." });
    if (o.modalidadOperacion === "CONTADO" && fin > 0) obs.push({ item, tipo: "VERIFICAR", campo: "modalidadOperacion", mensaje: "Figura CONTADO pero tiene saldo financiado: ¿es CRÉDITO?" });
    if (o.modalidadOperacion === "CONTADO" && fin === 0 && cuo) {
      obs.push({ item, tipo: "AJUSTE", campo: "cantidadCuotas", mensaje: `Operación de contado sin saldo con ${cuo} cuotas: se cargó 0.` });
      cuo = 0;
    }
    if (ent + fin + com === 0) obs.push({ item, tipo: "COMPLETAR", campo: "montoEntrega", mensaje: "Todos los montos están en 0." });
    const total = parsearMonto(r._montoTotal as Valor);
    if (total !== null && total > 0 && Math.abs(ent + fin + com - total) > 1) {
      obs.push({ item, tipo: "VERIFICAR", campo: "montoEntrega", mensaje: `Entrega + financiado + compensación (${ent + fin + com}) no coincide con el monto total de la planilla (${total}).` });
    }
    o.montoEntrega = ent;
    o.montoFinanciado = fin;
    o.cantidadCuotas = cuo;
    o.montoCompensacion = com;

    for (const rol of ROLES) {
      const presente = ["TipoPersona", "NumeroDocumento", "Denominacion"].some((k) => !esVacio(g(`${rol}${k}`)) && limpiarTexto(g(`${rol}${k}`)) !== "-");
      const requerido =
        (rol === "comprador" && (o.tipoOperacion === "VENTA" || o.tipoOperacion === "INTERMEDIACIÓN")) ||
        (rol === "vendedor" && (o.tipoOperacion === "COMPRA" || o.tipoOperacion === "INTERMEDIACIÓN"));
      if (!presente) {
        for (const k of SUFIJOS_ROL) o[`${rol}${k}`] = "";
        if (requerido) obs.push({ item, tipo: "COMPLETAR", campo: rol, mensaje: `Faltan los datos del ${rol}.` });
        continue;
      }
      this.persona(r, rol, item, o, obs);
    }

    o.ciudadCodigo = this.ciudad(g("ciudadCodigo"), item, "ciudadCodigo", obs);
    o.monedaOperacionCodigo = this.moneda(g("monedaOperacionCodigo"), item, "monedaOperacionCodigo", obs);
    if (r._montosEnGs === true && o.monedaOperacionCodigo === "USD") {
      obs.push({ item, tipo: "VERIFICAR", campo: "monedaOperacionCodigo", mensaje: "La operación es en USD pero la planilla trae los montos en guaraníes: confirmá cómo se informan." });
    }
    return ordenar(item, o, CAMPOS_INMOBILIARIAS);
  }

  private persona(r: FilaCruda, rol: Rol, item: number, o: Registro, obs: Observacion[]) {
    const g = (k: string) => r[`${rol}${k}`] as Valor;
    o[`${rol}TipoPersona`] = this.lista("tipoPersona", g("TipoPersona"), item, `${rol}TipoPersona`, obs);
    const td = this.lista("tipoDocumento", g("TipoDocumento"), item, `${rol}TipoDocumento`, obs);
    if (!td && esVacio(g("TipoDocumento"))) obs.push({ item, tipo: "COMPLETAR", campo: `${rol}TipoDocumento`, mensaje: "Tipo de documento vacío." });
    o[`${rol}TipoDocumento`] = td;
    o[`${rol}NumeroDocumento`] = this.documento(td, g("NumeroDocumento"), item, `${rol}NumeroDocumento`, obs);
    const den = limpiarTexto(g("Denominacion")).toUpperCase();
    if (!den) obs.push({ item, tipo: "COMPLETAR", campo: `${rol}Denominacion`, mensaje: "Nombre o razón social vacío." });
    o[`${rol}Denominacion`] = den;
    o[`${rol}NumeroTelefono`] = normalizarTelefono(g("NumeroTelefono"), this.telDefecto);
    o[`${rol}Pep`] = this.lista("pep", esVacio(g("Pep")) ? "NO" : g("Pep"), item, `${rol}Pep`, obs);
    if (o[`${rol}Pep`] === "SI") obs.push({ item, tipo: "VERIFICAR", campo: `${rol}Pep`, mensaje: `${den || "La persona"} figura como PEP: corresponde debida diligencia reforzada.` });
    o[`${rol}NumeroCelular`] = normalizarTelefono(g("NumeroCelular"), this.telDefecto);
    o[`${rol}Actividad`] = this.actividad(g("Actividad"), rol, item, `${rol}Actividad`, obs);
    o[`${rol}NacionalidadCodigo`] = this.pais(g("NacionalidadCodigo"), item, `${rol}NacionalidadCodigo`, obs, true);
    o[`${rol}ResidenciaCodigo`] = this.pais(g("ResidenciaCodigo"), item, `${rol}ResidenciaCodigo`, obs, true);
    o[`${rol}CiudadCodigo`] = this.ciudad(g("CiudadCodigo"), item, `${rol}CiudadCodigo`, obs);
  }

  private caudal(r: FilaCruda, item: number, obs: Observacion[], tasas: Map<string, Set<number>>): Registro {
    const o: Registro = {};
    const g = (k: string) => r[k] as Valor;
    o.fechaOperacion = this.fecha(g("fechaOperacion"), item, obs);
    const td = this.lista("tipoDocumento", g("codigoTipoDocumento"), item, "codigoTipoDocumento", obs);
    if (!td && esVacio(g("codigoTipoDocumento"))) obs.push({ item, tipo: "COMPLETAR", campo: "codigoTipoDocumento", mensaje: "Tipo de documento vacío." });
    o.codigoTipoDocumento = td;
    o.numeroDocumento = this.documento(td, g("numeroDocumento"), item, "numeroDocumento", obs);
    const den = denominacionCompleta(r.denominacion);
    o.denominacion = den;
    if (!den) obs.push({ item, tipo: "COMPLETAR", campo: "denominacion", mensaje: "Razón social vacía." });
    o.codigoPaisNacionalidad = this.pais(g("codigoPaisNacionalidad"), item, "codigoPaisNacionalidad", obs, true);
    o.ocupacion = this.actividad(g("ocupacion"), "cliente_caudales", item, "ocupacion", obs);
    const dire = limpiarTexto(g("direccion"));
    o.direccion = dire === "." || dire === "-" ? "" : dire;
    o.numeroTelefono = normalizarTelefono(g("numeroTelefono"), this.telDefecto);
    o.numeroPrecintoSeguridad = limpiarTexto(g("numeroPrecintoSeguridad"));
    const monto = parsearMonto(g("monto")) ?? 0;
    let montoGs = parsearMonto(g("montoGuaranies")) ?? 0;
    const mon = this.moneda(g("codigoMoneda"), item, "codigoMoneda", obs);
    if (monto === 0) obs.push({ item, tipo: "VERIFICAR", campo: "monto", mensaje: "Traslado con monto 0: confirmá si se reporta." });
    if (mon === "PYG") {
      if (montoGs === 0 && monto > 0) {
        montoGs = monto;
        obs.push({ item, tipo: "AJUSTE", campo: "montoGuaranies", mensaje: "En guaraníes, el monto en guaraníes es igual al monto." });
      } else if (monto !== montoGs) obs.push({ item, tipo: "VERIFICAR", campo: "montoGuaranies", mensaje: "En PYG, monto y monto en guaraníes deberían coincidir." });
    } else if (mon && monto > 0 && montoGs <= monto) {
      const tasa = parsearMonto(r._tasa as Valor);
      if (tasa && tasa > 1) {
        montoGs = Math.round(monto * tasa);
        obs.push({ item, tipo: "AJUSTE", campo: "montoGuaranies", mensaje: `Monto en guaraníes calculado con la tasa de la planilla (${tasa}).` });
      } else {
        const delDia = tasas.get(`${o.fechaOperacion}|${mon}`);
        if (delDia && delDia.size === 1) {
          const t = Array.from(delDia)[0];
          montoGs = Math.round(monto * t);
          obs.push({ item, tipo: "AJUSTE", campo: "montoGuaranies", mensaje: `Sin tasa: se usó la del mismo día y moneda que aparece en el archivo (${t}).` });
        } else {
          obs.push({
            item,
            tipo: "COMPLETAR",
            campo: "montoGuaranies",
            mensaje: delDia && delDia.size > 1 ? `Sin tasa y el archivo trae varias tasas para ese día (${Array.from(delDia).join(", ")}).` : "Moneda extranjera sin tasa de cambio: completá el monto en guaraníes.",
          });
        }
      }
    }
    o.monto = monto;
    o.montoGuaranies = montoGs;
    o.codigoCiudadOrigen = this.ciudad(g("codigoCiudadOrigen"), item, "codigoCiudadOrigen", obs);
    o.codigoCiudadDestino = this.ciudad(g("codigoCiudadDestino"), item, "codigoCiudadDestino", obs);
    o.codigoMoneda = mon;
    o.numeroReciboTransporte = limpiarTexto(g("numeroReciboTransporte"));
    return ordenar(item, o, CAMPOS_CAUDALES);
  }

  /** Tasas de cambio por día y moneda que el propio archivo trae (explícitas o deducidas). */
  private tasasDelArchivo(filas: FilaCruda[]): Map<string, Set<number>> {
    const m = new Map<string, Set<number>>();
    for (const r of filas) {
      const f = parsearFecha(r.fechaOperacion as Valor);
      const mon = (EQ.valores_lista[norm(r.codigoMoneda)] ?? limpiarTexto(r.codigoMoneda).toUpperCase()) || "";
      if (!f || !mon || mon === "PYG") continue;
      const monto = parsearMonto(r.monto as Valor) ?? 0;
      const gs = parsearMonto(r.montoGuaranies as Valor) ?? 0;
      const tasa = parsearMonto(r._tasa as Valor);
      const t = tasa && tasa > 1 ? tasa : monto > 0 && gs > monto ? Math.round((gs / monto) * 100) / 100 : null;
      if (!t) continue;
      const k = `${f}|${mon}`;
      if (!m.has(k)) m.set(k, new Set());
      m.get(k)!.add(t);
    }
    return m;
  }

  procesar(filas: FilaCruda[]): Resultado {
    const obs: Observacion[] = [];
    const tasas = this.regimen === "caudales" ? this.tasasDelArchivo(filas) : new Map<string, Set<number>>();
    const registros = filas.map((r, i) => (this.regimen === "inmobiliarias" ? this.inmobiliaria(r, i + 1, obs) : this.caudal(r, i + 1, obs, tasas)));
    if (this.ciudadFija) obs.push({ item: 0, tipo: "AJUSTE", campo: "ciudades", mensaje: `Regla de la empresa: todas las ciudades se cargan como ${this.ciudadFija}.` });
    sugerirRuc(registros, obs);
    return { registros, observaciones: obs };
  }
}

function ordenar(item: number, o: Registro, campos: readonly string[]): Registro {
  const out: Registro = { item };
  for (const c of campos) out[c] = o[c] ?? (NUMERICOS.has(c) ? 0 : "");
  return out;
}

/** Caudales: si hay dos columnas "denominacion" (corta y completa), se usa la completa. */
function denominacionCompleta(v: FilaCruda[string]): string {
  const vals = (Array.isArray(v) ? v : [v]).map((x) => limpiarTexto(x).toUpperCase()).filter(Boolean);
  return vals.sort((a, b) => b.length - a.length)[0] ?? "";
}

/** Si un RUC tiene el dígito mal y la misma persona figura en otra fila con un RUC válido, lo sugiere. */
function sugerirRuc(registros: Registro[], obs: Observacion[]) {
  const validos = new Map<string, string>();
  const pares: [string, string][] = [
    ["compradorDenominacion", "compradorNumeroDocumento"],
    ["vendedorDenominacion", "vendedorNumeroDocumento"],
    ["denominacion", "numeroDocumento"],
  ];
  for (const r of registros)
    for (const [d, n] of pares) {
      const ruc = String(r[n] ?? "");
      const m = ruc.match(/^(\d{5,8})-(\d)$/);
      if (m && dvRuc(m[1]) === Number(m[2]) && r[d]) validos.set(String(r[d]), ruc);
    }
  for (const o of obs) {
    if (o.tipo !== "VERIFICAR" || !o.mensaje.includes("dígito verificador no corresponde")) continue;
    const r = registros[o.item - 1];
    const par = pares.find(([, n]) => n === o.campo);
    if (!r || !par) continue;
    const sugerido = validos.get(String(r[par[0]] ?? ""));
    if (sugerido && sugerido !== r[o.campo]) o.mensaje += ` En otra fila la misma persona figura con RUC ${sugerido}.`;
  }
}
