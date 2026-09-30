import { addBusinessDays, addDays, lastDayOfMonth, parseIso, toIso } from "@/lib/dates";
import type { CategoriaObligacion, Empresa, NuevaObligacion, TipoSociedad } from "@/lib/types";

/**
 * Calendario de cumplimiento anual: a partir del tipo de sociedad y del mes
 * de cierre, genera las obligaciones del año con fecha concreta.
 *
 * Base usada (misma que la Plantilla 14 de Nodos Empresas):
 * - Código Civil art. 1079: asamblea ordinaria dentro de los 4 meses del cierre.
 * - Código Civil art. 1082: edicto por 5 días, con 10 a 30 días de anticipación.
 * - Código Civil art. 1084: comunicación de asistencia 3 días hábiles antes.
 * - Código Civil art. 1096: acta firmada dentro de los 5 días.
 * - Ley 1034/83 del Comerciante: documentación a disposición 15 días antes.
 * - Ley 6446/2019: actualización anual de Personas Jurídicas y Beneficiarios
 *   Finales al 30 de junio; comunicación de asambleas a la DGPEJBF.
 *
 * Los días hábiles descuentan fines de semana, feriados fijos y Semana
 * Santa, pero no los feriados trasladables: son referencias a confirmar.
 */

interface Regla {
  regla: string;
  titulo: string;
  descripcion: string;
  categoria: CategoriaObligacion;
  tipos: TipoSociedad[];
  plantilla?: string;
  fecha: (ctx: Contexto) => string | null;
}

interface Contexto {
  anio: number;
  cierre: string; // fin del ejercicio que se aprueba este año
  asamblea: string; // fecha límite de la asamblea / reunión anual
  empresa: Empresa;
}

const TODOS: TipoSociedad[] = ["sa", "eas", "srl"];

/** Fecha límite de la asamblea anual cuyo vencimiento cae en `anio`. */
export function contextoAnual(empresa: Empresa, anio: number): Contexto {
  const m = empresa.cierre_mes || 12;
  // Mes límite = cierre + 4. Si pasa de diciembre, el cierre fue el año anterior.
  const mesLimite = m + 4;
  const anioCierre = mesLimite > 12 ? anio - 1 : anio;
  const cierre = toIso(lastDayOfMonth(anioCierre, m));
  const limite = mesLimite > 12 ? mesLimite - 12 : mesLimite;
  const asamblea = toIso(lastDayOfMonth(anio, limite));
  return { anio, cierre, asamblea, empresa };
}

const REGLAS: Regla[] = [
  {
    regla: "balance",
    titulo: "Balance, inventario y memoria del ejercicio listos",
    descripcion:
      "Balance general y estado de resultados firmados por el contador y el representante legal, más la memoria del órgano de administración. Coordiná con tu contador con tiempo.",
    categoria: "societario",
    tipos: TODOS,
    fecha: (c) => addDays(c.asamblea, -35),
  },
  {
    regla: "directorio_convoca",
    titulo: "Reunión de Directorio: aprobar documentación y convocar a asamblea",
    descripcion:
      "El Directorio aprueba memoria y balance, propone el destino de utilidades y convoca a la Asamblea General Ordinaria.",
    categoria: "societario",
    tipos: ["sa"],
    plantilla: "acta-directorio-convocatoria",
    fecha: (c) => addDays(c.asamblea, -25),
  },
  {
    regla: "edicto",
    titulo: "Publicar edicto de convocatoria (5 días)",
    descripcion:
      "Publicación en un diario durante 5 días, con al menos 10 y no más de 30 días de anticipación a la asamblea (Código Civil, art. 1082). Esta es la fecha más tarde para la primera publicación. Guardá la factura.",
    categoria: "societario",
    tipos: ["sa"],
    plantilla: "edicto-convocatoria",
    fecha: (c) => addDays(c.asamblea, -10),
  },
  {
    regla: "documentacion",
    titulo: "Documentación a disposición de los accionistas",
    descripcion:
      "Memoria, balance, estado de resultados e informe del síndico disponibles en la sede social, con no menos de 15 días de anticipación a la asamblea.",
    categoria: "societario",
    tipos: ["sa"],
    fecha: (c) => addDays(c.asamblea, -15),
  },
  {
    regla: "cierre_asistencia",
    titulo: "Cierre del registro de asistencia",
    descripcion:
      "Los accionistas deben comunicar su asistencia con no menos de 3 días hábiles de anticipación (Código Civil, art. 1084). Pedí las cartas poder de quienes no puedan ir.",
    categoria: "societario",
    tipos: ["sa"],
    plantilla: "registro-asistencia",
    fecha: (c) => addBusinessDays(c.asamblea, -3),
  },
  {
    regla: "asamblea",
    titulo: "Asamblea General Ordinaria anual (fecha límite)",
    descripcion:
      "Aprobación de memoria, balance y destino de utilidades, gestión del Directorio y síndico, y elección de autoridades si corresponde. Plazo: 4 meses desde el cierre (Código Civil, art. 1079).",
    categoria: "societario",
    tipos: ["sa"],
    plantilla: "acta-asamblea-ordinaria",
    fecha: (c) => c.asamblea,
  },
  {
    regla: "asamblea",
    titulo: "Asamblea anual de accionistas (fecha límite sugerida)",
    descripcion:
      "Aprobación de estados financieros, destino de utilidades y gestión del órgano de administración. Revisá el plazo exacto en tus estatutos: los estatutos modelo suelen fijar 4 meses desde el cierre.",
    categoria: "societario",
    tipos: ["eas"],
    plantilla: "acta-asamblea-eas",
    fecha: (c) => c.asamblea,
  },
  {
    regla: "asamblea",
    titulo: "Reunión de socios: aprobar ejercicio y destino de utilidades",
    descripcion:
      "Decidí el destino de las utilidades dentro del primer cuatrimestre posterior al cierre. Si no se decide en plazo, puede presumirse la distribución a efectos tributarios: consultalo con tu contador.",
    categoria: "societario",
    tipos: ["srl"],
    fecha: (c) => c.asamblea,
  },
  {
    regla: "firma_acta",
    titulo: "Acta de asamblea firmada en el libro",
    descripcion:
      "El acta debe quedar firmada por el presidente, el secretario y los accionistas designados dentro de los 5 días (Código Civil, art. 1096). Si la asamblea se hace antes de la fecha límite, adelantá esta tarea.",
    categoria: "societario",
    tipos: ["sa"],
    fecha: (c) => addDays(c.asamblea, 5),
  },
  {
    regla: "comunicacion_asamblea",
    titulo: "Comunicar la asamblea a la DGPEJBF",
    descripcion:
      "Comunicación de la asamblea dentro de los 15 días hábiles posteriores. Fecha calculada desde la fecha límite de la asamblea (descuenta fines de semana y feriados fijos; confirmá los trasladables).",
    categoria: "registros",
    tipos: ["sa", "eas"],
    fecha: (c) => addBusinessDays(c.asamblea, 15),
  },
  {
    regla: "actualizacion_bf",
    titulo: "Actualización anual de Personas Jurídicas y Beneficiarios Finales",
    descripcion:
      "Todos los datos declarados en los registros administrativos deben actualizarse cada año a más tardar el 30 de junio (Ley 6446/2019). Revisá accionistas con 10% o más del capital o más del 25% de los votos.",
    categoria: "registros",
    tipos: TODOS,
    fecha: (c) => `${c.anio}-06-30`,
  },
  {
    regla: "planillas_mtess",
    titulo: "Revisar vencimiento de planillas laborales (MTESS)",
    descripcion:
      "El vencimiento depende de la terminación del número patronal y el régimen cambió recientemente. Confirmá la fecha en el Ministerio de Trabajo y cargala como tarea propia.",
    categoria: "laboral",
    tipos: TODOS,
    fecha: (c) => `${c.anio}-04-20`,
  },
  {
    regla: "revision_libros",
    titulo: "Revisión de medio año: libros societarios al día",
    descripcion: "Actas firmadas, registro de acciones actualizado y libros rubricados en orden.",
    categoria: "interno",
    tipos: TODOS,
    fecha: (c) => `${c.anio}-07-31`,
  },
  {
    regla: "revision_poderes",
    titulo: "Revisión de poderes y firmas autorizadas",
    descripcion:
      "Poderes vigentes, firmas registradas en bancos y accesos a sistemas de organismos (DNIT, IPS, MTESS). Revocá lo que ya no corresponde.",
    categoria: "interno",
    tipos: TODOS,
    plantilla: "acta-poderes",
    fecha: (c) => `${c.anio}-09-30`,
  },
  {
    regla: "planificacion_sucesion",
    titulo: "Reunión familiar: gobierno y sucesión",
    descripcion:
      "¿Hay que incorporar a la siguiente generación, cambiar autoridades o ajustar estatutos el año próximo? Es el momento de planificarlo.",
    categoria: "interno",
    tipos: TODOS,
    fecha: (c) => `${c.anio}-10-31`,
  },
  {
    regla: "aguinaldo",
    titulo: "Pago del aguinaldo al personal",
    descripcion: "El aguinaldo se paga a más tardar el 31 de diciembre.",
    categoria: "laboral",
    tipos: TODOS,
    fecha: (c) => `${c.anio}-12-31`,
  },
  {
    regla: "renovacion_mandato",
    titulo: "Vence el mandato de las autoridades",
    descripcion:
      "El mandato del órgano de administración vence este año. Incluí la elección de autoridades en el orden del día de la asamblea y actualizá los registros dentro de los 15 días hábiles del cambio.",
    categoria: "societario",
    tipos: ["sa", "eas"],
    plantilla: "acta-distribucion-cargos",
    fecha: (c) => {
      const v = c.empresa.vencimiento_mandato;
      if (!v || parseIso(v).getFullYear() !== c.anio) return null;
      return v < c.asamblea ? v : c.asamblea;
    },
  },
];

export function generarObligacionesAnuales(empresa: Empresa, anio: number): NuevaObligacion[] {
  const ctx = contextoAnual(empresa, anio);
  const out: NuevaObligacion[] = [];
  for (const r of REGLAS) {
    if (!r.tipos.includes(empresa.tipo)) continue;
    const fecha = r.fecha(ctx);
    if (!fecha) continue;
    out.push({
      empresa_id: empresa.id,
      titulo: r.titulo,
      descripcion: r.descripcion,
      categoria: r.categoria,
      fecha,
      origen: "calendario",
      regla: r.regla,
      anio,
      plantilla: r.plantilla ?? null,
    });
  }
  return out.sort((a, b) => a.fecha.localeCompare(b.fecha));
}

/**
 * Tareas que se disparan al registrar un movimiento de acciones: avisos a
 * la sociedad y a la DGPEJBF, y actualización de beneficiarios finales.
 */
export function obligacionesPorMovimiento(
  empresaId: string,
  fechaMovimiento: string,
  detalle: string
): NuevaObligacion[] {
  const base = { empresa_id: empresaId, origen: "evento" as const, regla: null, anio: null, plantilla: null };
  return [
    {
      ...base,
      titulo: "Comunicación de la transferencia a la sociedad",
      descripcion: `${detalle}. El adquirente (y el vendedor) comunican la operación a la sociedad dentro de los 5 días hábiles; la sociedad actualiza el registro de acciones.`,
      categoria: "societario",
      fecha: addBusinessDays(fechaMovimiento, 5),
    },
    {
      ...base,
      titulo: "Comunicar la transferencia de acciones a la DGPEJBF",
      descripcion: `${detalle}. La sociedad comunica la transferencia dentro de los 5 días hábiles de recibida la comunicación, con copia del registro de acciones actualizado.`,
      categoria: "registros",
      fecha: addBusinessDays(fechaMovimiento, 10),
    },
    {
      ...base,
      titulo: "Actualizar beneficiarios finales (si cambió alguno)",
      descripcion: `${detalle}. Si el movimiento cambia quién supera el 10% del capital o el 25% de los votos, actualizá el registro dentro de los 15 días hábiles.`,
      categoria: "registros",
      fecha: addBusinessDays(fechaMovimiento, 15),
    },
  ];
}
