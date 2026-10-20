/**
 * Liquidación final de un trabajador (Código del Trabajo, Ley N.º 213/1993).
 *
 * Solo se usan reglas verificadas:
 * - Art. 87: preaviso de 30, 45, 60 o 90 días según la antigüedad (hasta 1 año,
 *   más de 1 hasta 5, más de 5 hasta 10, más de 10).
 * - Art. 90: sin preaviso, el empleador paga el salario de ese plazo; si el que
 *   lo omite es el trabajador, debe la mitad.
 * - Art. 91 (texto de la Ley N.º 496/1995): despido sin justa causa, 15 salarios
 *   diarios por año de servicio o fracción de seis meses.
 * - Art. 92: preaviso e indemnización se calculan con el salario promedio de
 *   los últimos seis meses.
 * - Art. 218 (Ley N.º 496/1995): vacaciones de 12, 18 o 30 días según la
 *   antigüedad (hasta 5 años, más de 5 hasta 10, más de 10).
 * - Arts. 243 y 244: aguinaldo causado y proporcional (la doceava parte de lo
 *   cobrado en el año).
 *
 * Criterios de cálculo (no son texto de la ley, se explican en pantalla):
 * salario diario = promedio mensual ÷ 30; vacaciones proporcionales = días que
 * corresponden por antigüedad ÷ 12 por cada mes entero desde el último
 * aniversario, solo cuando el contrato termina por despido sin justa causa.
 */

export type Motivo = "despido_injustificado" | "despido_justificado" | "renuncia";

export const MOTIVOS: Record<Motivo, { label: string; ayuda: string }> = {
  despido_injustificado: { label: "Despido sin justa causa", ayuda: "El empleador termina el contrato sin una causa del art. 81." },
  despido_justificado: { label: "Despido con justa causa", ayuda: "Por una de las causas del art. 81: no hay preaviso ni indemnización." },
  renuncia: { label: "Renuncia del trabajador", ayuda: "El trabajador debe dar preaviso; si no lo da, debe la mitad (art. 90)." },
};

export interface DatosLiquidacion {
  ingreso: string; // AAAA-MM-DD
  salida: string; // AAAA-MM-DD
  motivo: Motivo;
  /** Salario mensual promedio de los últimos seis meses (art. 92). */
  salarioPromedio: number;
  /** ¿Se dio el preaviso por escrito y se trabajó ese plazo? */
  huboPreaviso: boolean;
  /** Días del último mes trabajados y todavía no pagados. */
  diasPendientes: number;
  /** Días de vacaciones de años anteriores que no se gozaron. */
  vacacionesCausadas: number;
  /** Total cobrado en el año calendario hasta la salida (para el aguinaldo). */
  cobradoEnElAnio: number;
}

export interface Antiguedad {
  anios: number;
  meses: number;
  dias: number;
  totalMeses: number;
}

export interface Concepto {
  id: string;
  titulo: string;
  monto: number; // negativo = descuento
  detalle: string;
  base: string; // artículo o criterio
}

export interface Liquidacion {
  antiguedad: Antiguedad;
  salarioDiario: number;
  diasPreaviso: number;
  aniosIndemnizacion: number;
  diasVacacionesAnio: number;
  conceptos: Concepto[];
  total: number;
  avisos: string[];
}

function fecha(iso: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return null;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Años, meses y días completos entre dos fechas (la de salida cuenta). */
export function antiguedad(ingreso: string, salida: string): Antiguedad | null {
  const a = fecha(ingreso);
  const b = fecha(salida);
  if (!a || !b || b < a) return null;
  const fin = new Date(b.getTime() + 86400000); // el día de salida se trabaja
  let anios = fin.getUTCFullYear() - a.getUTCFullYear();
  let meses = fin.getUTCMonth() - a.getUTCMonth();
  let dias = fin.getUTCDate() - a.getUTCDate();
  if (dias < 0) {
    meses -= 1;
    dias += new Date(Date.UTC(fin.getUTCFullYear(), fin.getUTCMonth(), 0)).getUTCDate();
  }
  if (meses < 0) {
    anios -= 1;
    meses += 12;
  }
  return { anios, meses, dias, totalMeses: anios * 12 + meses };
}

/** Art. 87. */
export function diasDePreaviso(a: Antiguedad): number {
  const exacto = a.meses === 0 && a.dias === 0;
  if (a.anios < 1 || (a.anios === 1 && exacto)) return 30;
  if (a.anios < 5 || (a.anios === 5 && exacto)) return 45;
  if (a.anios < 10 || (a.anios === 10 && exacto)) return 60;
  return 90;
}

/** Art. 218 (Ley 496/1995). */
export function diasDeVacaciones(a: Antiguedad): number {
  const exacto = a.meses === 0 && a.dias === 0;
  if (a.anios < 5 || (a.anios === 5 && exacto)) return 12;
  if (a.anios < 10 || (a.anios === 10 && exacto)) return 18;
  return 30;
}

/** Art. 91: años de servicio, contando la fracción de seis meses como un año. */
export function aniosParaIndemnizacion(a: Antiguedad): number {
  return a.anios + (a.meses >= 6 ? 1 : 0);
}

const red = (n: number) => Math.round(n);
const gs = (n: number) => `Gs. ${red(n).toLocaleString("es-PY")}`;

export function calcularLiquidacion(d: DatosLiquidacion): Liquidacion | null {
  const ant = antiguedad(d.ingreso, d.salida);
  if (!ant) return null;
  const diario = Math.max(0, d.salarioPromedio) / 30;
  const diasPre = diasDePreaviso(ant);
  const aniosInd = aniosParaIndemnizacion(ant);
  const diasVac = diasDeVacaciones(ant);
  const conceptos: Concepto[] = [];
  const avisos: string[] = [];

  if (d.diasPendientes > 0) {
    conceptos.push({
      id: "salario",
      titulo: "Salario de los días trabajados",
      monto: red(diario * d.diasPendientes),
      detalle: `${d.diasPendientes} día${d.diasPendientes === 1 ? "" : "s"} × ${gs(diario)}`,
      base: "Lo trabajado y no pagado",
    });
  }

  if (d.motivo === "despido_injustificado") {
    if (!d.huboPreaviso) {
      conceptos.push({
        id: "preaviso",
        titulo: "Preaviso no otorgado",
        monto: red(diario * diasPre),
        detalle: `${diasPre} días × ${gs(diario)}`,
        base: "Arts. 87 y 90",
      });
    }
    conceptos.push({
      id: "indemnizacion",
      titulo: "Indemnización por despido",
      monto: red(15 * diario * aniosInd),
      detalle: `15 salarios diarios × ${aniosInd} año${aniosInd === 1 ? "" : "s"} de servicio`,
      base: "Art. 91",
    });
    if (aniosInd === 0) avisos.push("Con menos de seis meses de servicio no se llega a un año computable para la indemnización.");
    const mesesDesdeAniversario = ant.meses;
    if (mesesDesdeAniversario > 0) {
      const dias = (diasVac / 12) * mesesDesdeAniversario;
      conceptos.push({
        id: "vac_prop",
        titulo: "Vacaciones proporcionales",
        monto: red(diario * dias),
        detalle: `${diasVac} días ÷ 12 × ${mesesDesdeAniversario} mes${mesesDesdeAniversario === 1 ? "" : "es"} = ${dias.toLocaleString("es-PY", { maximumFractionDigits: 2 })} días`,
        base: "Art. 218 · criterio proporcional",
      });
    }
  }

  if (d.motivo === "renuncia" && !d.huboPreaviso) {
    conceptos.push({
      id: "preaviso_desc",
      titulo: "Descuento por preaviso no dado",
      monto: -red((diario * diasPre) / 2),
      detalle: `Mitad de ${diasPre} días × ${gs(diario)}`,
      base: "Arts. 87 y 90",
    });
    avisos.push("El descuento por preaviso se aplica solo si el trabajador no avisó: confirmalo antes de descontar.");
  }

  if (d.vacacionesCausadas > 0) {
    conceptos.push({
      id: "vac_causadas",
      titulo: "Vacaciones causadas no gozadas",
      monto: red(diario * d.vacacionesCausadas),
      detalle: `${d.vacacionesCausadas} día${d.vacacionesCausadas === 1 ? "" : "s"} × ${gs(diario)}`,
      base: "Art. 218",
    });
  }

  if (d.cobradoEnElAnio > 0) {
    conceptos.push({
      id: "aguinaldo",
      titulo: "Aguinaldo proporcional",
      monto: red(d.cobradoEnElAnio / 12),
      detalle: `${gs(d.cobradoEnElAnio)} cobrados en el año ÷ 12`,
      base: "Arts. 243 y 244",
    });
  }

  if (d.motivo === "despido_justificado") avisos.push("Con justa causa no corresponden preaviso ni indemnización; la causa del art. 81 tiene que poder probarse.");

  const total = conceptos.reduce((s, c) => s + c.monto, 0);
  return { antiguedad: ant, salarioDiario: diario, diasPreaviso: diasPre, aniosIndemnizacion: aniosInd, diasVacacionesAnio: diasVac, conceptos, total, avisos };
}

/** Lo cobrado en el año calendario si el salario fue el mismo todos los meses. */
export function estimarCobradoEnElAnio(ingreso: string, salida: string, salarioMensual: number): number {
  const a = fecha(ingreso);
  const b = fecha(salida);
  if (!a || !b || b < a) return 0;
  const inicioAnio = new Date(Date.UTC(b.getUTCFullYear(), 0, 1));
  const desde = a > inicioAnio ? a : inicioAnio;
  const t = antiguedad(desde.toISOString().slice(0, 10), salida);
  if (!t) return 0;
  return Math.round(salarioMensual * (t.totalMeses + t.dias / 30));
}
