import { addBusinessDays, addDays, lastDayOfMonth, toIso } from "@/lib/dates";
import type { Empresa, NuevaObligacion } from "@/lib/types";

/**
 * Cumplimiento PLA/FT ante la SEPRELAD para empresas que son sujetos
 * obligados (Ley 1015/97, art. 13). Cubre los tres sectores en los que suele
 * caer una empresa familiar:
 *
 * - Inmobiliarias y desarrolladoras: Res. SEPRELAD 201/2020, 165/2022 y 003/2025.
 * - Organizaciones sin fines de lucro (fundaciones familiares): Res. 490/2022.
 * - Remesadoras / transferencias de dinero: Res. 176/2020.
 * - Todos: Res. 202/2020 (constancia de beneficiarios finales del cliente).
 *
 * Las fechas son referencias para organizarse. Lo marcado "VERIFICAR" viene
 * de un comunicado oficial y no del texto de la resolución. SEPRELAD puede
 * prorrogar plazos (p. ej. Res. 158/2026): cargá la prórroga a mano.
 */

export type Sector = "inmobiliaria" | "osfl" | "remesas";

export const SECTORES: Record<Sector, { label: string; norma: string; alcance: string }> = {
  inmobiliaria: {
    label: "Inmobiliaria / desarrolladora",
    norma: "Res. SEPRELAD 201/2020 (y 165/2022)",
    alcance:
      "Compra-venta habitual de inmuebles, aunque sea actividad secundaria y sin importar cantidad ni monto de operaciones (Res. 201/2020, art. 1).",
  },
  osfl: {
    label: "Fundación u organización sin fines de lucro",
    norma: "Res. SEPRELAD 490/2022",
    alcance:
      "Fundaciones, asociaciones de utilidad pública y entidades religiosas. Las obligaciones dependen del segmento (1, 2 o 3) que asigna SEPRELAD (Res. 490/2022, art. 3).",
  },
  remesas: {
    label: "Remesas / transferencias de dinero",
    norma: "Res. SEPRELAD 176/2020",
    alcance: "Envío o recepción de remesas, giros u órdenes de pago, físicas o electrónicas (Res. 176/2020, art. 1).",
  },
};

export interface PerfilSeprelad {
  empresa_id: string;
  sectores: Sector[];
  segmento_osfl: number | null;
  inscripta: boolean;
  fecha_inscripcion: string | null;
  oc_nombre: string | null;
  oc_cargo: string | null;
  oc_email: string | null;
  oc_designado_el: string | null;
  ultima_autoevaluacion: string | null;
  ultima_metodologia: string | null;
  notas: string | null;
}

export function perfilVacio(empresaId: string): PerfilSeprelad {
  return {
    empresa_id: empresaId,
    sectores: [],
    segmento_osfl: null,
    inscripta: false,
    fecha_inscripcion: null,
    oc_nombre: null,
    oc_cargo: null,
    oc_email: null,
    oc_designado_el: null,
    ultima_autoevaluacion: null,
    ultima_metodologia: null,
    notas: null,
  };
}

interface Ctx {
  anio: number;
  /** Cierre del ejercicio anterior (base de informes y auditorías que vencen este año). */
  cierrePrevio: string;
  /** Cierre del ejercicio en curso. */
  cierreActual: string;
  perfil: PerfilSeprelad;
}

interface ReglaSeprelad {
  regla: string;
  titulo: string;
  descripcion: string;
  base: string;
  sectores: Sector[];
  /** Solo OSFL de estos segmentos (si no se indica, todos). */
  segmentos?: number[];
  plantilla?: string;
  /** Una o varias fechas en el año (las trimestrales devuelven cuatro). */
  fechas: (c: Ctx) => string[];
  verificar?: boolean;
  sugerida?: boolean;
}

const TRIMESTRES = [1, 4, 7, 10]; // meses en que se reporta el trimestre anterior

/** N-ésimo día hábil del mes (1 = primer día hábil). */
function diaHabil(anio: number, mes: number, n: number): string {
  const antes = toIso(new Date(anio, mes - 1, 0)); // último día del mes anterior
  return addBusinessDays(antes, n);
}

const fecha = (anio: number, mes: number, dia: number) => toIso(new Date(anio, mes - 1, dia));

export const REGLAS_SEPRELAD: ReglaSeprelad[] = [
  // ── Inmobiliarias ────────────────────────────────────────────────────
  {
    regla: "sep_form_anual_inmo",
    titulo: "Formulario Anual de Información (SIRO)",
    descripcion: "Presentar por SIRO el formulario con los datos del ejercicio anterior.",
    base: "Res. SEPRELAD 165/2022, art. 2",
    sectores: ["inmobiliaria"],
    fechas: (c) => [fecha(c.anio, 5, 31)],
  },
  {
    regla: "sep_ro_trim_inmo",
    titulo: "Reporte de Operaciones del trimestre (SIRO)",
    descripcion:
      "Presentar por SIRO el reporte de operaciones del trimestre anterior, entre el día 11 y el 20 del mes. Esta es la fecha límite.",
    base: "Res. SEPRELAD 003/2025",
    sectores: ["inmobiliaria"],
    verificar: true,
    fechas: (c) => TRIMESTRES.map((m) => fecha(c.anio, m, 20)),
  },
  {
    regla: "sep_negativo_inmo",
    titulo: "Reporte Negativo del trimestre (si no hubo ROS)",
    descripcion:
      "Si en el trimestre no se reportó ninguna operación sospechosa, presentar el Reporte Negativo dentro de los 10 días hábiles siguientes al cierre del trimestre.",
    base: "Res. SEPRELAD 201/2020, art. 37",
    sectores: ["inmobiliaria"],
    fechas: (c) => TRIMESTRES.map((m) => addBusinessDays(toIso(new Date(c.anio, m - 1, 0)), 10)),
  },
  {
    regla: "sep_control_interno",
    titulo: "Informe de control interno a SEPRELAD",
    descripcion:
      "Evaluación anual del sistema de prevención (puede hacerla el oficial de cumplimiento). Se presenta dentro de los 90 días del cierre del ejercicio.",
    base: "Res. SEPRELAD 201/2020, art. 13 y Anexo II; Res. 176/2020, arts. 18 y 23",
    sectores: ["inmobiliaria", "remesas"],
    plantilla: "sep-informe-control-interno",
    fechas: (c) => [addDays(c.cierrePrevio, 90)],
  },
  {
    regla: "sep_auditoria_externa",
    titulo: "Informe de auditoría externa PLA/FT a SEPRELAD",
    descripcion:
      "Auditoría anual por auditor registrado ante SEPRELAD. El informe se remite dentro de los 180 días del cierre del ejercicio.",
    base: "Res. SEPRELAD 201/2020, art. 14; Res. 176/2020, art. 23.2",
    sectores: ["inmobiliaria", "remesas"],
    fechas: (c) => [addDays(c.cierrePrevio, 180)],
  },
  {
    regla: "sep_capacitacion",
    titulo: "Aprobar el programa anual de capacitación PLA/FT",
    descripcion:
      "Programa anual para directivos y empleados, con registro de cada sesión (se conserva 5 años). Fecha interna sugerida: primer mes del ejercicio.",
    base: "Res. SEPRELAD 201/2020, arts. 15-16; Res. 176/2020, art. 24; Res. 490/2022, arts. 7-9",
    sectores: ["inmobiliaria", "remesas", "osfl"],
    plantilla: "sep-plan-capacitacion",
    sugerida: true,
    fechas: (c) => [addDays(c.cierrePrevio, 31)],
  },
  {
    regla: "sep_informe_oc_inmo",
    titulo: "Informe anual del oficial de cumplimiento a la máxima autoridad",
    descripcion:
      "La norma no fija fecha: definila en tu manual. Fecha interna sugerida: 60 días después del cierre, antes del informe de control interno.",
    base: "Res. SEPRELAD 201/2020, art. 9.11",
    sectores: ["inmobiliaria"],
    sugerida: true,
    fechas: (c) => [addDays(c.cierrePrevio, 60)],
  },
  // ── Remesadoras ──────────────────────────────────────────────────────
  {
    regla: "sep_negativo_rem",
    titulo: "Reporte Negativo del trimestre (si no hubo ROS)",
    descripcion: "Presentar dentro de los 5 días hábiles siguientes al cierre de cada trimestre sin ROS.",
    base: "Res. SEPRELAD 176/2020, art. 47",
    sectores: ["remesas"],
    fechas: (c) => TRIMESTRES.map((m) => addBusinessDays(toIso(new Date(c.anio, m - 1, 0)), 5)),
  },
  {
    regla: "sep_programa_oc_rem",
    titulo: "Aprobar el programa anual del oficial de cumplimiento",
    descripcion: "Cronograma de actividades, fechas, roles y responsables, aprobado 30 días antes del cierre del ejercicio.",
    base: "Res. SEPRELAD 176/2020, art. 16",
    sectores: ["remesas"],
    fechas: (c) => [addDays(c.cierreActual, -30)],
  },
  {
    regla: "sep_informe_oc_rem",
    titulo: "Informe anual del oficial de cumplimiento (a disposición de SEPRELAD)",
    descripcion: "Debe estar a disposición de SEPRELAD a los 60 días del cierre del ejercicio.",
    base: "Res. SEPRELAD 176/2020, art. 18 y Anexo II",
    sectores: ["remesas"],
    fechas: (c) => [addDays(c.cierrePrevio, 60)],
  },
  {
    regla: "sep_politicas_rem",
    titulo: "Revisión anual de políticas por la máxima autoridad",
    descripcion: "La máxima autoridad revisa las políticas de prevención y verifica el funcionamiento del sistema.",
    base: "Res. SEPRELAD 176/2020, art. 9.2 y 9.4",
    sectores: ["remesas"],
    fechas: (c) => [c.cierreActual],
  },
  {
    regla: "sep_capacitacion_oc_1",
    titulo: "Capacitación especializada del oficial de cumplimiento (1 de 2)",
    descripcion: "El oficial de cumplimiento y su equipo deben recibir al menos 2 capacitaciones especializadas por año. Fecha sugerida.",
    base: "Res. SEPRELAD 176/2020, art. 25",
    sectores: ["remesas"],
    sugerida: true,
    fechas: (c) => [fecha(c.anio, 6, 30)],
  },
  {
    regla: "sep_capacitacion_oc_2",
    titulo: "Capacitación especializada del oficial de cumplimiento (2 de 2)",
    descripcion: "Segunda capacitación especializada del año. Fecha sugerida.",
    base: "Res. SEPRELAD 176/2020, art. 25",
    sectores: ["remesas"],
    sugerida: true,
    fechas: (c) => [fecha(c.anio, 11, 30)],
  },
  // ── OSFL ─────────────────────────────────────────────────────────────
  {
    regla: "sep_negativo_osfl",
    titulo: "Reporte Negativo del trimestre (si no hubo ROS)",
    descripcion: "Se presenta en los primeros 5 días hábiles de enero, abril, julio y octubre.",
    base: "Res. SEPRELAD 490/2022, art. 40",
    sectores: ["osfl"],
    fechas: (c) => TRIMESTRES.map((m) => diaHabil(c.anio, m, 5)),
  },
  {
    regla: "sep_programa_oc_osfl",
    titulo: "Aprobar el programa anual del encargado / oficial de cumplimiento",
    descripcion: "Aprobado antes del inicio del año siguiente.",
    base: "Res. SEPRELAD 490/2022, art. 32",
    sectores: ["osfl"],
    segmentos: [2, 3],
    fechas: (c) => [fecha(c.anio, 12, 31)],
  },
  {
    regla: "sep_informe_oc_osfl",
    titulo: "Informe anual del encargado / oficial de cumplimiento a la máxima autoridad",
    descripcion: "Dentro de los 30 días hábiles del cierre del ejercicio.",
    base: "Res. SEPRELAD 490/2022, arts. 31.10 y 33",
    sectores: ["osfl"],
    segmentos: [2, 3],
    fechas: (c) => [addBusinessDays(c.cierrePrevio, 30)],
  },
  {
    regla: "sep_auditoria_osfl",
    titulo: "Informe de auditoría externa PLA/FT a SEPRELAD",
    descripcion: "Hasta el 30 de junio del año siguiente al ejercicio auditado.",
    base: "Res. SEPRELAD 490/2022, arts. 9.13 y 34",
    sectores: ["osfl"],
    segmentos: [3],
    fechas: (c) => [fecha(c.anio, 6, 30)],
  },
  // ── Todos: evaluación de riesgos ─────────────────────────────────────
  {
    regla: "sep_autoevaluacion",
    titulo: "Actualizar la autoevaluación de riesgos PLA/FT",
    descripcion: "La autoevaluación de riesgos se actualiza cada 2 años (la metodología, cada 4).",
    base: "Res. SEPRELAD 201/2020, art. 3; Res. 176/2020, art. 3",
    sectores: ["inmobiliaria", "remesas"],
    fechas: (c) => {
      const u = c.perfil.ultima_autoevaluacion;
      if (!u) return [];
      const d = new Date(`${u}T12:00:00`);
      d.setFullYear(d.getFullYear() + 2);
      return d.getFullYear() === c.anio ? [toIso(d)] : [];
    },
  },
  {
    regla: "sep_metodologia",
    titulo: "Revisar la metodología de evaluación de riesgos",
    descripcion: "La metodología de la autoevaluación se revisa cada 4 años.",
    base: "Res. SEPRELAD 201/2020, art. 3; Res. 176/2020, art. 3",
    sectores: ["inmobiliaria", "remesas"],
    fechas: (c) => {
      const u = c.perfil.ultima_metodologia;
      if (!u) return [];
      const d = new Date(`${u}T12:00:00`);
      d.setFullYear(d.getFullYear() + 4);
      return d.getFullYear() === c.anio ? [toIso(d)] : [];
    },
  },
];

function aplica(r: ReglaSeprelad, p: PerfilSeprelad): boolean {
  if (!r.sectores.some((s) => p.sectores.includes(s))) return false;
  if (r.segmentos && r.sectores.length === 1 && r.sectores[0] === "osfl") {
    return p.segmento_osfl != null && r.segmentos.includes(p.segmento_osfl);
  }
  return true;
}

function descripcionCompleta(r: ReglaSeprelad): string {
  const notas = [
    r.sugerida ? "Fecha interna sugerida, no fijada por la norma." : null,
    r.verificar ? "VERIFICAR contra el texto oficial de la resolución." : null,
  ].filter(Boolean);
  return `${r.descripcion} Base: ${r.base}.${notas.length ? ` ${notas.join(" ")}` : ""}`;
}

/** Reglas que aplican al perfil, para mostrar "qué te toca" antes de generar. */
export function reglasAplicables(perfil: PerfilSeprelad): ReglaSeprelad[] {
  return REGLAS_SEPRELAD.filter((r) => aplica(r, perfil));
}

export function generarObligacionesSeprelad(empresa: Empresa, perfil: PerfilSeprelad, anio: number): NuevaObligacion[] {
  const m = empresa.cierre_mes || 12;
  const ctx: Ctx = {
    anio,
    // Ejercicio cuyos informes vencen este año (con cierre al 31/12, el del año anterior).
    cierrePrevio: toIso(lastDayOfMonth(m > 6 ? anio - 1 : anio, m)),
    cierreActual: toIso(lastDayOfMonth(anio, m)),
    perfil,
  };
  const out: NuevaObligacion[] = [];
  for (const r of reglasAplicables(perfil)) {
    const fechas = r.fechas(ctx);
    fechas.forEach((f, i) => {
      out.push({
        empresa_id: empresa.id,
        // Los trimestrales se presentan en ene/abr/jul/oct por el trimestre anterior.
        titulo: fechas.length === 4 ? `${r.titulo} — ${i === 0 ? `4.º trim. ${anio - 1}` : `${i}.º trim. ${anio}`}` : r.titulo,
        descripcion: descripcionCompleta(r),
        categoria: "seprelad",
        fecha: f,
        origen: "calendario",
        regla: fechas.length > 1 ? `${r.regla}_${i + 1}` : r.regla,
        anio,
        plantilla: r.plantilla ?? null,
      });
    });
  }
  return out.sort((a, b) => a.fecha.localeCompare(b.fecha));
}

// ── Hechos que disparan plazos ───────────────────────────────────────────

export interface EventoSeprelad {
  key: string;
  label: string;
  sectores: Sector[];
  titulo: string;
  descripcion: string;
  base: string;
  plazo: (f: string) => string;
  plazoTexto: string;
  plantilla?: string;
}

export const EVENTOS_SEPRELAD: EventoSeprelad[] = [
  {
    key: "oc_designacion",
    label: "Designé un oficial de cumplimiento",
    sectores: ["inmobiliaria", "remesas", "osfl"],
    titulo: "Comunicar a SEPRELAD la designación del oficial de cumplimiento",
    descripcion:
      "Nota con los datos del oficial de cumplimiento. Si SEPRELAD no objeta en 10 días hábiles (30 para OSFL), se considera aceptada.",
    base: "Res. 201/2020, art. 10; Res. 176/2020, arts. 13-14; Res. 490/2022, art. 27",
    plazo: (f) => addBusinessDays(f, 5),
    plazoTexto: "5 días hábiles",
    plantilla: "sep-nota-oficial-cumplimiento",
  },
  {
    key: "oc_cambio_datos",
    label: "Cambiaron los datos del oficial de cumplimiento",
    sectores: ["inmobiliaria", "remesas", "osfl"],
    titulo: "Comunicar a SEPRELAD el cambio de datos del oficial de cumplimiento",
    descripcion: "Cualquier cambio, incluso de contacto o domicilio.",
    base: "Res. 201/2020, art. 10; Res. 176/2020, art. 14; Res. 490/2022, art. 27",
    plazo: (f) => addBusinessDays(f, 5),
    plazoTexto: "5 días hábiles",
    plantilla: "sep-nota-oficial-cumplimiento",
  },
  {
    key: "oc_remocion",
    label: "Removimos al oficial de cumplimiento",
    sectores: ["inmobiliaria", "remesas", "osfl"],
    titulo: "Comunicar a SEPRELAD la remoción del oficial de cumplimiento, con sus motivos",
    descripcion:
      "La remoción la aprueba la máxima autoridad. El cargo no puede quedar vacante más de 60 días corridos: designá un reemplazo.",
    base: "Res. 201/2020, art. 10; Res. 176/2020, art. 14; Res. 490/2022, art. 28",
    plazo: (f) => addBusinessDays(f, 5),
    plazoTexto: "5 días hábiles",
    plantilla: "sep-nota-oficial-cumplimiento",
  },
  {
    key: "oc_interino",
    label: "Asume un oficial de cumplimiento interino",
    sectores: ["inmobiliaria", "remesas", "osfl"],
    titulo: "Comunicar por escrito el oficial de cumplimiento interino",
    descripcion: "La ausencia del titular no puede superar 6 meses consecutivos.",
    base: "Res. 201/2020, art. 10; Res. 176/2020, art. 14; Res. 490/2022, art. 29",
    plazo: (f) => addDays(f, 2),
    plazoTexto: "48 horas",
    plantilla: "sep-nota-oficial-cumplimiento",
  },
  {
    key: "requerimiento",
    label: "Recibí un requerimiento de información de SEPRELAD",
    sectores: ["inmobiliaria", "remesas"],
    titulo: "Responder el requerimiento de SEPRELAD",
    descripcion: "Remitir la información pedida. Recordá que no se puede revelar el requerimiento al cliente.",
    base: "Res. 201/2020, art. 35; Res. 176/2020, art. 44",
    plazo: (f) => addBusinessDays(f, 4),
    plazoTexto: "4 días hábiles",
  },
  {
    key: "verificacion_diferida",
    label: "Empecé una relación con verificación de identidad pendiente",
    sectores: ["inmobiliaria", "remesas"],
    titulo: "Completar la verificación de identidad del cliente",
    descripcion: "Completar la debida diligencia que quedó diferida al iniciar la relación.",
    base: "Res. 201/2020, art. 19; Res. 176/2020, art. 30",
    plazo: (f) => addDays(f, 60),
    plazoTexto: "60 días",
    plantilla: "sep-debida-diligencia",
  },
  {
    key: "autoridades_osfl",
    label: "Cambiaron los integrantes de la máxima autoridad (OSFL)",
    sectores: ["osfl"],
    titulo: "Actualizar ante SEPRELAD los integrantes de la máxima autoridad",
    descripcion: "Aplica a OSFL de los segmentos 2 y 3.",
    base: "Res. 490/2022, arts. 8.9 y 9.10",
    plazo: (f) => addBusinessDays(f, 30),
    plazoTexto: "30 días hábiles",
  },
  {
    key: "recaudacion_masiva",
    label: "Terminó un evento de recaudación masiva (OSFL)",
    sectores: ["osfl"],
    titulo: "Presentar el reporte del evento de recaudación masiva",
    descripcion: "Fecha, descripción, beneficiarios, zona, total recaudado y porcentajes por canal y medio de cobro (Anexo IX).",
    base: "Res. 490/2022, arts. 14 y 41",
    plazo: (f) => addBusinessDays(f, 20),
    plazoTexto: "20 días hábiles",
  },
];

export function obligacionPorEvento(empresaId: string, evento: EventoSeprelad, fechaHecho: string, detalle: string): NuevaObligacion {
  return {
    empresa_id: empresaId,
    titulo: evento.titulo,
    descripcion: `${detalle ? `${detalle}. ` : ""}${evento.descripcion} Plazo: ${evento.plazoTexto} desde el ${fechaHecho.split("-").reverse().join("/")}. Base: ${evento.base}.`,
    categoria: "seprelad",
    fecha: evento.plazo(fechaHecho),
    origen: "evento",
    regla: null,
    anio: null,
    plantilla: evento.plantilla ?? null,
  };
}

/** Recordatorios permanentes (no tienen fecha, van en el panel). */
export const PRINCIPIOS = [
  {
    titulo: "Conservá todo 5 años",
    texto:
      "Registros de operaciones y legajos de debida diligencia, desde la operación o el fin de la relación.",
    base: "Ley 1015/97, art. 18",
  },
  {
    titulo: "Pedí la constancia de beneficiarios finales",
    texto: "A todo cliente persona jurídica, al iniciar la relación y en cada actualización del legajo.",
    base: "Res. SEPRELAD 202/2020, arts. 1-2",
  },
  {
    titulo: "Los ROS no pasan por esta app",
    texto:
      "El reporte de operación sospechosa es confidencial y se envía solo por SIRO. Esta herramienta no lo redacta ni lo guarda.",
    base: "Res. 201/2020, art. 33; Res. 176/2020, art. 42; Res. 490/2022, art. 36",
  },
  {
    titulo: "Nunca le avises al cliente",
    texto:
      "Está prohibido revelar al cliente o a terceros que se analizó o reportó una operación, o que hubo un requerimiento.",
    base: "Ley 1015/97, art. 20; Res. 201/2020, art. 36",
  },
];
