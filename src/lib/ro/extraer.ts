/**
 * Extracción de operaciones desde la planilla del cliente (ESPECIFICACION §6).
 * Las columnas se identifican por el texto de la etiqueta, no por posición:
 * es lo que más cambia entre clientes.
 *
 *   A/D · tabla con encabezados (en la fila 1 o más abajo), con nombres
 *         oficiales o parecidos; ciudades por nombre; columnas duplicadas.
 *   B   · bloques verticales: etiqueta en A, valor en B, "OPERACIÓN NUMERO n".
 *   C   · etiquetas en A y una operación por columna.
 *   E   · CSV de caudales (dos "denominacion", "TIPO MONEDA").
 *   F   · texto pegado: "RUC 3752045-8 - PEREZ MACIEL, NIMIO DAVID".
 */
import { CAMPOS, limpiarTexto, norm, type FilaCruda, type Regimen, type Valor } from "./normalizador";
import { AUXILIARES } from "./campos";
import type { Celda } from "./xlsx";

export type Formato = "tabla" | "bloques" | "columnas";

export interface Encabezado {
  col: number;
  texto: string;
  destino: string | null;
}

export interface Extraccion {
  formato: Formato;
  filaEncabezado: number | null;
  encabezados: Encabezado[];
  filas: FilaCruda[];
  avisos: string[];
}

const k = (s: unknown) => norm(s).replace(/ /g, "");

/** Campos que pueden venir repetidos (se guardan todos y se resuelven al normalizar). */
const MULTIPLES = new Set(["montoFinanciado", "cantidadCuotas", "denominacion"]);

const SINONIMOS: Record<Regimen, Record<string, string>> = {
  inmobiliarias: {
    FECHA: "fechaOperacion",
    FECHADEOPERACION: "fechaOperacion",
    TIPODEINMUEBLE: "tipoInmueble",
    CUENTACORRIENTECATASTRAL: "ctaCteCatastral",
    CTACTE: "ctaCteCatastral",
    MODALIDAD: "modalidadOperacion",
    FORMADEPAGO: "formaPago",
    TIPODEOPERACION: "tipoOperacion",
    OPERACION: "tipoOperacion",
    MONEDA: "monedaOperacionCodigo",
    TIPOMONEDA: "monedaOperacionCodigo",
    MONTODEENTREGA: "montoEntrega",
    MONTODEENTREGAENGS: "montoEntrega",
    ENTREGA: "montoEntrega",
    MONTOCUOTAS: "montoFinanciado",
    MONTOCUOTASENGS: "montoFinanciado",
    SALDO: "montoFinanciado",
    SALDOFINANCIADO: "montoFinanciado",
    CANTIDADDECUOTAS: "cantidadCuotas",
    CUOTAS: "cantidadCuotas",
    COMPENSACION: "montoCompensacion",
    COMPENSACIONGS: "montoCompensacion",
    MONTOTOTAL: "_montoTotal",
    MONTOTOTALGS: "_montoTotal",
    TOTAL: "_montoTotal",
    CIUDAD: "ciudadCodigo",
    CIUDADDELINMUEBLE: "ciudadCodigo",
    NOMBREDELEDIFICIO: "nombreEdificio",
    EDIFICIO: "nombreEdificio",
    PISO: "pisoNumero",
    COMPRADOR: "compradorCompuesto",
    VENDEDOR: "vendedorCompuesto",
  },
  caudales: {
    FECHA: "fechaOperacion",
    FECHADEOPERACION: "fechaOperacion",
    TIPODOCUMENTO: "codigoTipoDocumento",
    TIPODEDOCUMENTO: "codigoTipoDocumento",
    NRODOCUMENTO: "numeroDocumento",
    NUMERODEDOCUMENTO: "numeroDocumento",
    DOCUMENTO: "numeroDocumento",
    RUC: "numeroDocumento",
    RAZONSOCIAL: "denominacion",
    NOMBRE: "denominacion",
    NACIONALIDAD: "codigoPaisNacionalidad",
    PAIS: "codigoPaisNacionalidad",
    ACTIVIDAD: "ocupacion",
    ACTIVIDADECONOMICA: "ocupacion",
    DOMICILIO: "direccion",
    TELEFONO: "numeroTelefono",
    PRECINTO: "numeroPrecintoSeguridad",
    NROPRECINTO: "numeroPrecintoSeguridad",
    MONTOGS: "montoGuaranies",
    MONTOENGUARANIES: "montoGuaranies",
    MONTOENGS: "montoGuaranies",
    ORIGEN: "codigoCiudadOrigen",
    CIUDADORIGEN: "codigoCiudadOrigen",
    CIUDADDEORIGEN: "codigoCiudadOrigen",
    DESTINO: "codigoCiudadDestino",
    CIUDADDESTINO: "codigoCiudadDestino",
    CIUDADDEDESTINO: "codigoCiudadDestino",
    MONEDA: "codigoMoneda",
    TIPOMONEDA: "codigoMoneda",
    RECIBO: "numeroReciboTransporte",
    NRORECIBO: "numeroReciboTransporte",
    NUMERODERECIBO: "numeroReciboTransporte",
    TASA: "_tasa",
    TASADECAMBIO: "_tasa",
    TIPODECAMBIO: "_tasa",
    COTIZACION: "_tasa",
    CLIENTE: "clienteCompuesto",
  },
};

/** Destino de un encabezado de tabla: campo oficial, auxiliar o null. */
export function destinoDeEncabezado(texto: unknown, regimen: Regimen): string | null {
  const key = k(texto);
  if (!key) return null;
  const oficiales = new Map(CAMPOS[regimen].map((c) => [c.toUpperCase(), c]));
  for (const intento of [key, `${key}CODIGO`, key.replace(/NOMBRE$/, "CODIGO"), key.replace(/NOMBRE$/, "")]) {
    const c = oficiales.get(intento);
    if (c) return c;
  }
  const sin = SINONIMOS[regimen][key];
  if (sin) return sin;
  return null;
}

/** Opciones del selector de mapeo: campos del régimen y auxiliares. */
export function destinosPosibles(regimen: Regimen): string[] {
  return [...CAMPOS[regimen], ...AUXILIARES[regimen]];
}

const vacia = (fila: Celda[]) => fila.every((c) => c === null || c === undefined || String(c).trim() === "");

// ---------------------------------------------------------------- formato A / D / E / F

function detectarTabla(hoja: Celda[][], regimen: Regimen): { fila: number; destinos: (string | null)[] } | null {
  let mejor: { fila: number; destinos: (string | null)[]; n: number } | null = null;
  for (let r = 0; r < Math.min(hoja.length, 15); r++) {
    const destinos = (hoja[r] ?? []).map((c) => destinoDeEncabezado(c, regimen));
    const n = new Set(destinos.filter(Boolean)).size;
    if (n >= 3 && (!mejor || n > mejor.n)) mejor = { fila: r, destinos, n };
  }
  return mejor ? { fila: mejor.fila, destinos: mejor.destinos } : null;
}

const COMPUESTO = /^(CI|C\.I\.|RUC|PA|CRP|CRT|TDEF|CRC)\s*[:.]?\s*([\d.]+(?:-\d)?)\s*[-–]\s*(.+)$/i;

/** "RUC 3752045-8 - PEREZ MACIEL, NIMIO DAVID" → tipo, número y nombre. */
export function separarCompuesto(v: unknown): { tipo: string; numero: string; nombre: string } | null {
  const m = limpiarTexto(v).match(COMPUESTO);
  if (!m) return null;
  return { tipo: m[1].replace(/\./g, "").toUpperCase(), numero: m[2], nombre: m[3].trim() };
}

function aplicarCompuestos(fila: FilaCruda, regimen: Regimen) {
  const roles = regimen === "inmobiliarias" ? ["comprador", "vendedor"] : ["cliente"];
  for (const rol of roles) {
    const campoDoc = rol === "cliente" ? "numeroDocumento" : `${rol}NumeroDocumento`;
    const campoTipo = rol === "cliente" ? "codigoTipoDocumento" : `${rol}TipoDocumento`;
    const campoNombre = rol === "cliente" ? "denominacion" : `${rol}Denominacion`;
    const compuesto = fila[`${rol}Compuesto`] ?? (separarCompuesto(fila[campoDoc]) ? fila[campoDoc] : undefined);
    delete fila[`${rol}Compuesto`];
    const p = separarCompuesto(compuesto);
    if (!p) continue;
    fila[campoDoc] = p.numero;
    if (!fila[campoTipo]) fila[campoTipo] = p.tipo;
    const actual = fila[campoNombre];
    if (!actual || (Array.isArray(actual) && actual.length === 0)) fila[campoNombre] = p.nombre;
  }
}

export function extraerTabla(hoja: Celda[][], regimen: Regimen, filaEncabezado: number, destinos: (string | null)[]): Extraccion {
  const avisos: string[] = [];
  const encabezados: Encabezado[] = (hoja[filaEncabezado] ?? []).map((t, col) => ({ col, texto: limpiarTexto(t), destino: destinos[col] ?? null }));
  const usados = new Map<string, number>();
  for (const e of encabezados) {
    if (!e.destino) continue;
    const n = (usados.get(e.destino) ?? 0) + 1;
    usados.set(e.destino, n);
    if (n > 1 && !MULTIPLES.has(e.destino)) avisos.push(`La columna "${e.texto}" repite un campo ya asignado: se usa la primera.`);
  }
  const enGs = encabezados.some((e) => (e.destino === "montoEntrega" || e.destino === "montoFinanciado") && /\bGS\b|GUARANI/.test(norm(e.texto)));
  const filas: FilaCruda[] = [];
  let omitidas = 0;
  for (let r = filaEncabezado + 1; r < hoja.length; r++) {
    const fila = hoja[r] ?? [];
    if (vacia(fila)) continue;
    const out: FilaCruda = {};
    const vistos = new Set<string>();
    for (const e of encabezados) {
      if (!e.destino) continue;
      const v = (fila[e.col] ?? null) as Valor;
      if (MULTIPLES.has(e.destino)) {
        const prev = out[e.destino];
        out[e.destino] = Array.isArray(prev) ? [...prev, v] : prev === undefined ? [v] : [prev as Valor, v];
      } else if (!vistos.has(e.destino)) {
        out[e.destino] = v;
        vistos.add(e.destino);
      }
    }
    for (const m of MULTIPLES) {
      const val = out[m];
      if (Array.isArray(val) && val.length === 1) out[m] = val[0];
    }
    aplicarCompuestos(out, regimen);
    if (enGs) out._montosEnGs = true;
    // Filas de totales o notas: sin fecha ni personas.
    const claves = regimen === "inmobiliarias" ? ["fechaOperacion", "compradorNumeroDocumento", "vendedorNumeroDocumento", "compradorDenominacion", "vendedorDenominacion"] : ["fechaOperacion", "numeroDocumento", "denominacion"];
    if (claves.every((c) => !limpiarTexto(Array.isArray(out[c]) ? (out[c] as Valor[]).join("") : out[c]))) {
      omitidas++;
      continue;
    }
    filas.push(out);
  }
  if (omitidas) avisos.push(`Se omitieron ${omitidas} fila${omitidas === 1 ? "" : "s"} sin fecha ni personas (totales, notas o filas de relleno).`);
  return { formato: "tabla", filaEncabezado, encabezados, filas, avisos };
}

// ---------------------------------------------------------------- formatos B y C (inmobiliarias)

type Seccion = "comprador" | "vendedor" | null;

const ETIQUETAS_OPERACION: Record<string, string> = {
  TIPOINMUEBLE: "tipoInmueble",
  TIPODEINMUEBLE: "tipoInmueble",
  CLASIFICACION: "clasificacion",
  CUENTACORRIENTECATASTRAL: "ctaCteCatastral",
  CTACTECATASTRAL: "ctaCteCatastral",
  CIUDAD: "ciudadCodigo",
  TIPODEOPERACION: "tipoOperacion",
  FECHADEOPERACION: "fechaOperacion",
  FECHA: "fechaOperacion",
  MONEDA: "monedaOperacionCodigo",
  MODALIDAD: "modalidadOperacion",
  FORMADEPAGO: "formaPago",
  MONTODEENTREGAENGS: "montoEntrega",
  MONTODEENTREGA: "montoEntrega",
  MONTOCUOTASENGS: "montoFinanciado",
  MONTOCUOTAS: "montoFinanciado",
  CANTIDADDECUOTAS: "cantidadCuotas",
  COMPENSACIONGS: "montoCompensacion",
  COMPENSACION: "montoCompensacion",
  MONTOTOTALGS: "_montoTotal",
  MONTOTOTAL: "_montoTotal",
  NOMBREDELEDIFICIO: "nombreEdificio",
  NOMBREEDIFICIO: "nombreEdificio",
  PISO: "pisoNumero",
  PISONUMERO: "pisoNumero",
};

const ETIQUETAS_PERSONA: Record<string, string> = {
  TIPODEPERSONA: "TipoPersona",
  TIPODEDOCUMENTO: "TipoDocumento",
  NUMERODEDOCUMENTO: "NumeroDocumento",
  NRODEDOCUMENTO: "NumeroDocumento",
  NOMBRE: "Denominacion",
  NOMBREORAZONSOCIAL: "Denominacion",
  RAZONSOCIAL: "Denominacion",
  DENOMINACION: "Denominacion",
  NACIONALIDAD: "NacionalidadCodigo",
  PEP: "Pep",
  PAISDERESIDENCIA: "ResidenciaCodigo",
  RESIDENCIA: "ResidenciaCodigo",
  CIUDAD: "CiudadCodigo",
  ACTIVIDADECONOMICA: "Actividad",
  ACTIVIDAD: "Actividad",
  NUMERODETELEFONOMOVILCELULAR: "NumeroCelular",
  CELULAR: "NumeroCelular",
  NUMERODECELULAR: "NumeroCelular",
  NUMERODETELEFONO: "NumeroTelefono",
  TELEFONO: "NumeroTelefono",
};

function seccionDe(key: string): Seccion | "operacion" | undefined {
  if (/DATOSDELCOMPRADOR|^COMPRADOR$/.test(key)) return "comprador";
  if (/DATOSDELVENDEDOR|^VENDEDOR$/.test(key)) return "vendedor";
  if (/DATOSDELINMUEBLE|DATOSDELAOPERACION/.test(key)) return "operacion";
  return undefined;
}

function campoDeEtiqueta(key: string, seccion: Seccion): string | null {
  if (seccion) {
    const p = ETIQUETAS_PERSONA[key] ?? Object.entries(ETIQUETAS_PERSONA).sort((a, b) => b[0].length - a[0].length).find(([e]) => key.startsWith(e))?.[1];
    if (p) return `${seccion}${p}`;
  }
  return ETIQUETAS_OPERACION[key] ?? Object.entries(ETIQUETAS_OPERACION).sort((a, b) => b[0].length - a[0].length).find(([e]) => key.startsWith(e))?.[1] ?? null;
}

function asignar(fila: FilaCruda, campo: string, v: Valor) {
  if (v === null || v === undefined || String(v).trim() === "") return;
  if (fila[campo] === undefined || fila[campo] === null || fila[campo] === "") fila[campo] = v;
}

function cerrar(fila: FilaCruda, nombre: string | null, filas: FilaCruda[]) {
  if (Object.keys(fila).length === 0) return;
  if (nombre && !fila.compradorDenominacion) fila.compradorDenominacion = nombre;
  aplicarCompuestos(fila, "inmobiliarias");
  fila._montosEnGs = true;
  filas.push(fila);
}

const TITULO = /OPERACI[OÓ]N\s+N(?:[UÚ]MERO|°|º|RO\.?)\s*\d+\s*[-–:]?\s*(.*)$/i;

export function extraerBloques(hoja: Celda[][]): Extraccion {
  const filas: FilaCruda[] = [];
  const avisos: string[] = [];
  let actual: FilaCruda | null = null;
  let nombre: string | null = null;
  let seccion: Seccion = null;
  const sinMapear = new Set<string>();
  for (const fila of hoja) {
    const etiqueta = limpiarTexto(fila[0]);
    if (!etiqueta) continue;
    const key = k(etiqueta);
    const titulo = etiqueta.match(TITULO);
    if (titulo || key.startsWith("OPERACIONNUMERO")) {
      if (actual) cerrar(actual, nombre, filas);
      actual = {};
      nombre = titulo?.[1]?.trim() || limpiarTexto(fila[1]) || null;
      seccion = null;
      continue;
    }
    const sec = seccionDe(key);
    if (sec !== undefined) {
      seccion = sec === "operacion" ? null : sec;
      continue;
    }
    if (!actual) continue;
    const campo = campoDeEtiqueta(key, seccion);
    if (!campo) {
      sinMapear.add(etiqueta);
      continue;
    }
    asignar(actual, campo, (fila[1] ?? null) as Valor);
    // El nombre a veces está en la columna C de "Número de documento".
    if (campo.endsWith("NumeroDocumento") && fila[2]) asignar(actual, campo.replace("NumeroDocumento", "Denominacion"), fila[2] as Valor);
  }
  if (actual) cerrar(actual, nombre, filas);
  if (sinMapear.size) avisos.push(`Etiquetas sin reconocer (se ignoraron): ${Array.from(sinMapear).slice(0, 8).join(", ")}${sinMapear.size > 8 ? "…" : ""}.`);
  return { formato: "bloques", filaEncabezado: null, encabezados: [], filas, avisos };
}

export function extraerColumnas(hoja: Celda[][]): Extraccion {
  const filas: FilaCruda[] = [];
  const avisos: string[] = [];
  const ancho = Math.max(0, ...hoja.map((f) => f.length));
  const sinMapear = new Set<string>();
  for (let j = 1; j < ancho; j++) {
    if (hoja.every((f) => f[j] === null || f[j] === undefined || String(f[j]).trim() === "")) continue;
    const out: FilaCruda = {};
    let seccion: Seccion = null;
    let nombre: string | null = null;
    for (let r = 0; r < hoja.length; r++) {
      const fila = hoja[r] ?? [];
      const etiqueta = limpiarTexto(fila[0]);
      const key = k(etiqueta);
      if (!etiqueta) {
        // La fila sin etiqueta debajo de "ORDEN" es el nombre.
        if (r > 0 && k(hoja[r - 1]?.[0]) === "ORDEN" && fila[j]) nombre = limpiarTexto(fila[j]);
        continue;
      }
      if (key === "ORDEN") continue;
      const sec = seccionDe(key);
      if (sec !== undefined) {
        seccion = sec === "operacion" ? null : sec;
        continue;
      }
      const campo = campoDeEtiqueta(key, seccion);
      if (!campo) {
        sinMapear.add(etiqueta);
        continue;
      }
      asignar(out, campo, (fila[j] ?? null) as Valor);
    }
    cerrar(out, nombre, filas);
  }
  if (sinMapear.size) avisos.push(`Etiquetas sin reconocer (se ignoraron): ${Array.from(sinMapear).slice(0, 8).join(", ")}${sinMapear.size > 8 ? "…" : ""}.`);
  return { formato: "columnas", filaEncabezado: null, encabezados: [], filas, avisos };
}

// ---------------------------------------------------------------- detección

/** Detecta el formato de una hoja y extrae las operaciones. */
export function extraer(hoja: Celda[][], regimen: Regimen): Extraccion | null {
  const tabla = detectarTabla(hoja, regimen);
  if (tabla) return extraerTabla(hoja, regimen, tabla.fila, tabla.destinos);
  if (regimen === "inmobiliarias") {
    const etiquetas = hoja.map((f) => k(f[0])).filter(Boolean);
    if (etiquetas.some((e) => e.startsWith("OPERACIONNUMERO") || TITULO.test(e))) return extraerBloques(hoja);
    if (hoja.some((f) => TITULO.test(limpiarTexto(f[0])))) return extraerBloques(hoja);
    const reconocidas = etiquetas.filter((e) => campoDeEtiqueta(e, "comprador")).length;
    if (reconocidas >= 5) return extraerColumnas(hoja);
  }
  return null;
}
