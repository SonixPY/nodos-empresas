/**
 * Reglas económicas del juego. Los parámetros son del juego, no datos de
 * mercado: sirven para que las consecuencias se sientan reales, no para
 * predecir nada. Contenido educativo: no es asesoría de inversión.
 */
import type { ActivoId, Arranque, AvatarId, Carrera, Etapa, MetaId, NivelVida, OficioId } from "./tipos";

export const PARAMETROS = {
  arranques: {
    ajustado: { sueldo: 2_900_000, gastosFijos: 2_400_000, efectivo: 200_000 },
    normal: { sueldo: 3_500_000, gastosFijos: 2_600_000, efectivo: 500_000 },
    holgado: { sueldo: 5_000_000, gastosFijos: 3_200_000, efectivo: 1_500_000 },
  } satisfies Record<Arranque, { sueldo: number; gastosFijos: number; efectivo: number }>,
  /** Gasto variable del mes según el nivel de vida (proporción del sueldo). */
  nivelVida: { austero: 0.08, normal: 0.15, alto: 0.3 } satisfies Record<NivelVida, number>,
  /** Interés mensual de la tarjeta en el juego. */
  interesTarjeta: 0.035,
  /** Pago mínimo de la tarjeta (proporción del saldo). */
  pagoMinimo: 0.1,
  /** Límite de la tarjeta (en sueldos). */
  limiteTarjetaSueldos: 2,
  /** Rendimiento mensual de la caja de ahorro. */
  interesAhorro: 0.003,
  /** Herencia: Gs. por lección, con tope en sueldos. */
  herenciaPorLeccion: 250_000,
  herenciaTopeSueldos: 6,
  /** Meses de mora que terminan la carrera. */
  moraQuiebra: 3,
  /** Día del mes en que se cobra el sueldo (se ajusta a meses cortos). */
  diaSueldo: 30,
  fijos: [
    { dia: 1, titulo: "Alquiler", parte: 0.55 },
    { dia: 5, titulo: "Luz, agua e internet", parte: 0.17 },
    { dia: 10, titulo: "Supermercado y transporte", parte: 0.28 },
  ],
};

/** Activos del juego: nombre, rendimiento esperado y volatilidad mensual. */
export const ACTIVOS: Record<ActivoId, { nombre: string; mu: number; sigma: number; etapa: Etapa; cripto: boolean }> = {
  "plazo-fijo": { nombre: "Plazo fijo en guaraníes", mu: 0.006, sigma: 0, etapa: "ahorrista", cripto: false },
  dolar: { nombre: "Dólares", mu: 0.002, sigma: 0.02, etapa: "ahorrista", cripto: false },
  fondo: { nombre: "Fondo de inversión", mu: 0.005, sigma: 0.015, etapa: "ahorrista", cripto: false },
  acciones: { nombre: "Índice de acciones", mu: 0.006, sigma: 0.045, etapa: "inversor", cripto: false },
  btc: { nombre: "Bitcoin", mu: 0.01, sigma: 0.15, etapa: "ahorrista", cripto: true },
  alt: { nombre: "Cripto alternativa", mu: 0, sigma: 0.25, etapa: "inversor", cripto: true },
  // ALFA solo se mueve con la trayectoria de su caso: es ficticia.
  alfa: { nombre: "ALFA (moneda “estable”)", mu: 0.0145, sigma: 0, etapa: "ahorrista", cripto: true },
};

export const ETAPAS: Etapa[] = ["empleado", "ahorrista", "inversor", "emprendedor", "libre"];
export const nivelEtapa = (e: Etapa) => ETAPAS.indexOf(e);

export const NOMBRE_ETAPA: Record<Etapa, string> = {
  empleado: "Empleado",
  ahorrista: "Ahorrista",
  inversor: "Inversor",
  emprendedor: "Emprendedor",
  libre: "Libertad financiera",
};

const r0 = (n: number) => Math.round(n);

export function totalActivos(c: Carrera): number {
  return Object.values(c.activos).reduce((s, p) => s + (p?.valor ?? 0), 0);
}

export function totalDeudas(c: Carrera): number {
  return c.deudaTarjeta + (c.prestamo?.saldo ?? 0);
}

export function patrimonio(c: Carrera): number {
  return r0(c.efectivo + c.ahorro + totalActivos(c) + (c.negocio?.aporte ?? 0) - totalDeudas(c));
}

/** Gasto mensual completo (fijos + nivel de vida + cuota de préstamo). */
export function gastoMensual(c: Carrera): number {
  return r0(c.gastosFijos + c.sueldo * PARAMETROS.nivelVida[c.nivelVida] + (c.prestamo?.cuota ?? 0));
}

/** Meses de gastos que cubrís con efectivo + ahorro. */
export function mesesDeEmergencia(c: Carrera): number {
  const g = gastoMensual(c);
  return g > 0 ? Math.max(0, (c.efectivo + c.ahorro) / g) : 0;
}

/** Ingreso pasivo esperado por mes (inversiones + negocio). */
export function ingresoPasivo(c: Carrera): number {
  let s = c.ahorro * PARAMETROS.interesAhorro;
  for (const [id, p] of Object.entries(c.activos) as [ActivoId, { valor: number }][]) s += p.valor * Math.max(0, ACTIVOS[id].mu);
  if (c.negocio) s += Math.max(0, c.negocio.flujoBase);
  return r0(s);
}

/**
 * Índice de salud financiera (0 a 100): fondo de emergencia (25), deuda
 * cara (25), diversificación (20), obligaciones al día (15) y ahorro del
 * mes (15). Mide cómo manejás la plata, no cuánta tenés.
 */
export function indiceSalud(c: Carrera, ahorroDelMes: number, ingresoDelMes: number): number {
  const emergencia = 25 * Math.min(1, mesesDeEmergencia(c) / 3);
  const relDeuda = c.sueldo > 0 ? totalDeudas(c) / c.sueldo : 0;
  const deuda = 25 * Math.max(0, 1 - relDeuda / 3);
  const partes = [c.ahorro, ...Object.values(c.activos).map((p) => p?.valor ?? 0)].filter((v) => v > 0);
  const total = partes.reduce((s, v) => s + v, 0);
  const hhi = total > 0 ? partes.reduce((s, v) => s + (v / total) ** 2, 0) : 1;
  const diversif = 20 * Math.min(1, (1 - hhi) / 0.6);
  const obligaciones = c.mora === 0 ? 15 : 0;
  const tasa = ingresoDelMes > 0 ? ahorroDelMes / ingresoDelMes : 0;
  const ahorro = 15 * Math.max(0, Math.min(1, tasa / 0.2));
  return Math.round(emergencia + deuda + diversif + obligaciones + ahorro);
}

/** Etapa según cómo está la carrera hoy. */
export function calcularEtapa(c: Carrera): Etapa {
  if (c.gastosFijos > 0 && ingresoPasivo(c) >= gastoMensual(c)) return "libre";
  if (c.negocio) return "emprendedor";
  const p = patrimonio(c);
  if (p > 0 && totalActivos(c) >= 0.2 * p) return "inversor";
  if (mesesDeEmergencia(c) >= 3) return "ahorrista";
  return "empleado";
}

export function activosDisponibles(c: Carrera): ActivoId[] {
  return (Object.keys(ACTIVOS) as ActivoId[]).filter((id) => id !== "alfa" && nivelEtapa(ACTIVOS[id].etapa) <= nivelEtapa(c.etapaMax));
}

export function tieneCripto(c: Carrera): boolean {
  return (Object.entries(c.activos) as [ActivoId, { valor: number }][]).some(([id, p]) => ACTIVOS[id].cripto && p.valor > 0);
}

export function herenciaInicial(puntos: number, sueldo: number): number {
  return Math.min(Math.max(0, puntos) * PARAMETROS.herenciaPorLeccion, PARAMETROS.herenciaTopeSueldos * sueldo);
}

// ── Calendario del juego ──────────────────────────────────────────────────
const DIAS_MES = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

export function fechaDelMes(mesAbs: number, semilla: number) {
  const anio = Math.floor((mesAbs - 1) / 12) + 1;
  const mesDelAnio = ((mesAbs - 1) % 12) + 1;
  // El año 1 arranca en un día de la semana que depende de la semilla.
  let dias = semilla % 7;
  for (let m = 1; m < mesAbs; m++) dias += DIAS_MES[(m - 1) % 12];
  return { anio, mesDelAnio, dias: DIAS_MES[mesDelAnio - 1], primerDia: dias % 7 };
}

export const NOMBRE_MES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

// ── Creación del personaje ────────────────────────────────────────────────

export const AVATARES: AvatarId[] = ["persona", "maletin", "laptop", "herramientas", "paleta", "libro", "carrito", "cafe"];

/** Cada oficio define el arranque (sueldo y gastos). Todo ficticio. */
export const OFICIOS: Record<OficioId, { nombre: string; lugar: string; arranque: Arranque; texto: string }> = {
  cajero: { nombre: "Cajero/a", lugar: "un supermercado del barrio", arranque: "ajustado", texto: "Sueldo justo y casi sin colchón: cada imprevisto pesa." },
  administrativo: { nombre: "Asistente administrativo/a", lugar: "una distribuidora", arranque: "normal", texto: "Un sueldo promedio y un poco de efectivo para arrancar." },
  analista: { nombre: "Analista", lugar: "una empresa de servicios", arranque: "holgado", texto: "Mejor sueldo y algo ahorrado: más margen para equivocarte." },
};

/** La meta guía la carrera; el avance se calcula con el estado (0 a 1). */
export const METAS: Record<MetaId, { nombre: string; texto: string; avance: (c: Carrera) => number; detalle: (c: Carrera) => string }> = {
  emergencia: {
    nombre: "Tener un colchón",
    texto: "Juntar 3 meses de gastos para que ningún imprevisto te endeude.",
    avance: (c) => Math.min(1, mesesDeEmergencia(c) / 3),
    detalle: (c) => `${mesesDeEmergencia(c).toLocaleString("es-PY", { maximumFractionDigits: 1 })} de 3 meses de gastos`,
  },
  auto: {
    nombre: "Comprar un auto",
    texto: "Juntar Gs. 30.000.000 para un auto usado, sin endeudarte.",
    avance: (c) => Math.min(1, Math.max(0, c.ahorro + totalActivos(c)) / 30_000_000),
    detalle: (c) => `Gs. ${Math.round(Math.max(0, c.ahorro + totalActivos(c))).toLocaleString("es-PY")} de Gs. 30.000.000`,
  },
  negocio: {
    nombre: "Tener tu negocio",
    texto: "Ahorrar el aporte y abrir tu propio negocio.",
    avance: (c) => (c.negocio ? 1 : Math.min(0.95, Math.max(0, c.ahorro) / 8_000_000)),
    detalle: (c) => (c.negocio ? "Ya tenés tu negocio" : `Gs. ${Math.round(Math.max(0, c.ahorro)).toLocaleString("es-PY")} de Gs. 8.000.000 de aporte`),
  },
  invertir: {
    nombre: "Aprender a invertir",
    texto: "Que tus inversiones lleguen al 20 % de tu patrimonio.",
    avance: (c) => {
      const p = patrimonio(c);
      return p > 0 ? Math.min(1, totalActivos(c) / (0.2 * p)) : 0;
    },
    detalle: (c) => {
      const p = patrimonio(c);
      return `${p > 0 ? Math.round((totalActivos(c) / p) * 100) : 0} % de 20 % invertido`;
    },
  },
};

/** Nombre del personaje: 2 a 24 letras, números, espacios, puntos o guiones. */
export function nombreValido(n: string): boolean {
  const t = n.trim();
  return t.length >= 2 && t.length <= 24 && /^[\p{L}\p{N} .'-]+$/u.test(t);
}
