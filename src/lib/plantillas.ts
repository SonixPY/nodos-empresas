import { formatFecha, formatFechaLarga } from "@/lib/dates";
import { fechaEnLetrasActa, horaTexto, montoGs, numeroALetras } from "@/lib/letras";
import { formatNumero, formatPct, type FilaAccionista } from "@/lib/accionistas";
import type { Empresa, TipoSociedad } from "@/lib/types";
import type { PoderPrefill } from "@/lib/poderes";

/**
 * Plantillas del generador de documentos. Son las versiones "llenables" de
 * las plantillas v1 de Nodos Empresas (carpeta de Drive "NODOS Empresas —
 * Plantillas v1"): mismo texto base, con los datos de la empresa y del libro
 * de accionistas precargados. Todo documento sale con el aviso legal.
 */

export type Datos = Record<string, string | boolean>;

export interface Contexto {
  empresa: Empresa;
  accionistas: FilaAccionista[];
  totalAcciones: number;
  totalVotos: number;
}

export interface Campo {
  key: string;
  label: string;
  type: "text" | "textarea" | "date" | "time" | "number" | "select" | "checkbox";
  help?: string;
  options?: { value: string; label: string }[];
  default?: (ctx: Contexto) => string | boolean;
  required?: boolean;
  /** Solo se muestra si este otro campo (checkbox) está marcado. */
  showIf?: string;
  /** Las opciones del select salen del libro de accionistas (value = id). */
  optionsFromAccionistas?: boolean;
}

export type GrupoPlantilla = "societario" | "poderes" | "familia" | "seprelad";

export interface Plantilla {
  /** Identificador estable: se guarda en `documentos.plantilla` y en
   * `obligaciones.plantilla`. NUNCA cambiarlo (los documentos viejos dejarían
   * de encontrar su plantilla). */
  key: string;
  /** Código visible: prefijo del grupo + correlativo (SOC-01, POD-02…). */
  numero: string;
  titulo: string;
  descripcion: string;
  tipos: TipoSociedad[];
  /** Sección del selector; define el prefijo del código. */
  grupo: GrupoPlantilla;
  campos: Campo[];
  tituloDoc: (d: Datos, ctx: Contexto) => string;
  render: (d: Datos, ctx: Contexto) => string;
  /** Advertencia que el generador muestra arriba de la vista previa. */
  aviso?: string;
  /** Si el documento otorga un poder: datos para precargar el registro de poderes. */
  registroPoder?: (d: Datos, ctx: Contexto) => PoderPrefill;
  /** Si el documento revoca un poder: a quién y desde cuándo. */
  revocacionPoder?: (d: Datos, ctx: Contexto) => { apoderado: string; documento: string; fecha: string };
}

export const AVISO_LEGAL =
  "Documento generado con NODOS Empresas a partir de un modelo informativo de referencia. No constituye asesoramiento legal personalizado ni reemplaza la revisión de un profesional del derecho para el caso concreto. Verificá los estatutos de la sociedad y la normativa vigente antes de firmarlo.";

// ─── helpers ────────────────────────────────────────────────────────────

export function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function str(d: Datos, key: string): string {
  const x = d[key];
  return typeof x === "string" ? x.trim() : "";
}

/** Valor escapado, o un marcador resaltado [ASÍ] si el campo está vacío. */
function v(d: Datos, key: string, placeholder: string): string {
  const x = str(d, key);
  return x ? esc(x) : `<span class="ph">[${esc(placeholder)}]</span>`;
}

function on(d: Datos, key: string): boolean {
  return d[key] === true;
}

function lines(d: Datos, key: string): string[] {
  return str(d, key)
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
}

function firma(nombre: string, cargo: string): string {
  return `<div class="firma"><div class="linea"></div><div>${nombre}</div><div class="cargo">${esc(cargo)}</div></div>`;
}

function firmas(items: { nombre: string; cargo: string }[]): string {
  return `<div class="firmas">${items.map((i) => firma(i.nombre, i.cargo)).join("")}</div>`;
}

/** Marcador que renderDocumento reemplaza por el código de la plantilla (p. ej. SOC-01). */
const CODIGO = "%%CODIGO%%";

function encabezado(titulo: string): string {
  return `<p class="meta">NODOS Empresas · Plantilla ${CODIGO}</p><h1>${esc(titulo)}</h1>`;
}

function fechaActa(d: Datos, key = "fecha"): string {
  const x = str(d, key);
  return x ? fechaEnLetrasActa(x) : `<span class="ph">[a los __ días del mes de __ del año __]</span>`;
}

function denom(ctx: Contexto): string {
  return `<strong>${esc(ctx.empresa.denominacion)}</strong>`;
}

function ciudad(d: Datos, ctx: Contexto): string {
  return str(d, "ciudad") ? esc(str(d, "ciudad")) : ctx.empresa.ciudad ? esc(ctx.empresa.ciudad) : `<span class="ph">[CIUDAD]</span>`;
}

function domicilio(ctx: Contexto): string {
  return ctx.empresa.domicilio ? esc(ctx.empresa.domicilio) : `<span class="ph">[DOMICILIO SOCIAL]</span>`;
}

/** "Presidente | Juan López | 1.234.567" → partes. */
function parseAutoridades(d: Datos, key: string) {
  return lines(d, key).map((l) => {
    const [cargo = "", nombre = "", ci = ""] = l.split("|").map((p) => p.trim());
    return { cargo, nombre, ci };
  });
}

function autoridadesDefault(ctx: Contexto): string {
  const conCargo = ctx.accionistas.filter((a) => a.cargo);
  if (conCargo.length === 0) return "Presidente | [NOMBRE] | [C.I.]\nDirector Titular | [NOMBRE] | [C.I.]";
  return conCargo.map((a) => `${a.cargo} | ${a.nombre} | ${a.documento ?? ""}`).join("\n");
}

function presidenteDefault(ctx: Contexto): string {
  const p = ctx.accionistas.find((a) => /presidente/i.test(a.cargo ?? "") && !/vice/i.test(a.cargo ?? ""));
  return p?.nombre ?? "";
}

const CAMPOS_BASE: Campo[] = [
  { key: "fecha", label: "Fecha del acto", type: "date", required: true },
  { key: "hora", label: "Hora", type: "time", default: () => "10:00" },
  { key: "ciudad", label: "Ciudad", type: "text", default: (c) => c.empresa.ciudad ?? "" },
  { key: "numero_acta", label: "N° de acta", type: "text", help: "El número correlativo del libro de actas." },
];

const CIERRE = (c: Contexto) => {
  const m = c.empresa.cierre_mes || 12;
  const y = new Date().getFullYear() - (m === 12 ? 1 : 0);
  const last = new Date(y, m, 0);
  return `${last.getFullYear()}-${String(m).padStart(2, "0")}-${String(last.getDate()).padStart(2, "0")}`;
};

const CAMPOS_EJERCICIO: Campo[] = [
  { key: "cierre", label: "Cierre del ejercicio", type: "date", default: CIERRE, required: true },
  {
    key: "resultado_tipo",
    label: "Resultado del ejercicio",
    type: "select",
    options: [
      { value: "utilidad", label: "Utilidad" },
      { value: "perdida", label: "Pérdida" },
    ],
    default: () => "utilidad",
  },
  { key: "resultado_monto", label: "Monto del resultado (Gs.)", type: "number" },
  {
    key: "destino",
    label: "Destino de las utilidades",
    type: "textarea",
    help: "Ej.: Gs. 5.000.000 a reserva legal; Gs. 40.000.000 a dividendos; el saldo a resultados acumulados.",
  },
];

function resultadoTexto(d: Datos): string {
  const tipo = str(d, "resultado_tipo") === "perdida" ? "una pérdida" : "una utilidad";
  const monto = str(d, "resultado_monto");
  return `${tipo} de ${monto ? montoGs(monto) : '<span class="ph">[MONTO]</span>'}`;
}

function destinoTexto(d: Datos): string {
  if (str(d, "resultado_tipo") === "perdida") {
    return "no existen utilidades a distribuir, por lo que el resultado se traslada a la cuenta de resultados acumulados";
  }
  return str(d, "destino") ? esc(str(d, "destino")) : `<span class="ph">[DESTINO DE LAS UTILIDADES]</span>`;
}

function ordenDelDiaAsamblea(d: Datos): string[] {
  const cierre = str(d, "cierre") ? formatFecha(str(d, "cierre")) : "[FECHA DE CIERRE]";
  const items = [
    "Designación de dos accionistas para firmar el acta de la Asamblea, juntamente con el Presidente y el Secretario.",
    `Consideración de la Memoria del Directorio, el Balance General, el Estado de Resultados, sus anexos y el Informe del Síndico correspondientes al ejercicio cerrado el ${cierre}.`,
    "Consideración del destino de las utilidades del ejercicio.",
    "Consideración de la gestión del Directorio y del Síndico.",
  ];
  if (on(d, "elegir_directores")) items.push("Elección de directores titulares y suplentes y fijación de su número, por el período estatutario.");
  if (on(d, "elegir_sindico")) items.push("Elección de síndico titular y suplente.");
  if (on(d, "remuneracion")) items.push("Fijación de la remuneración de directores y síndicos.");
  return items;
}

const CAMPOS_ORDEN: Campo[] = [
  { key: "elegir_directores", label: "Incluir elección de directores", type: "checkbox", default: () => false },
  { key: "elegir_sindico", label: "Incluir elección de síndico", type: "checkbox", default: () => false },
  { key: "remuneracion", label: "Incluir remuneración de directores y síndicos", type: "checkbox", default: () => false },
];

// ─── plantillas ─────────────────────────────────────────────────────────

const actaDirectorioConvocatoria: Plantilla = {
  key: "acta-directorio-convocatoria",
  numero: "SOC-01",
  grupo: "societario",
  titulo: "Acta de Directorio que convoca a Asamblea General Ordinaria",
  descripcion: "Aprueba memoria y balance, propone el destino de utilidades y convoca a los accionistas.",
  tipos: ["sa"],
  campos: [
    ...CAMPOS_BASE,
    { key: "presentes", label: "Directores presentes (uno por línea)", type: "textarea", default: (c) => autoridadesDefault(c).split("\n").map((l) => l.split("|")[1]?.trim() ?? "").filter(Boolean).join("\n") },
    { key: "sindico", label: "Síndico titular", type: "text" },
    ...CAMPOS_EJERCICIO,
    { key: "fecha_asamblea", label: "Fecha de la asamblea", type: "date", required: true },
    { key: "hora_asamblea", label: "Hora 1ª convocatoria", type: "time", default: () => "10:00" },
    { key: "hora_segunda", label: "Hora 2ª convocatoria", type: "time", help: "Solo si los estatutos permiten convocatorias simultáneas. Dejalo vacío si no.", default: () => "11:00" },
    ...CAMPOS_ORDEN,
    { key: "autorizados", label: "Autorizados para publicar el edicto", type: "text" },
  ],
  tituloDoc: (d) => `Acta de Directorio — convocatoria AGO ${str(d, "fecha_asamblea") ? formatFecha(str(d, "fecha_asamblea")) : ""}`.trim(),
  render: (d, ctx) => {
    const presentes = lines(d, "presentes");
    const segunda = str(d, "hora_segunda")
      ? ` y, de no reunirse el quórum legal, a las ${horaTexto(str(d, "hora_segunda"))} en segunda convocatoria`
      : "";
    return `
${encabezado("Acta de Directorio")}
<p class="center"><strong>ACTA DE DIRECTORIO N° ${v(d, "numero_acta", "__")}</strong></p>
<p>En la ciudad de ${ciudad(d, ctx)}, República del Paraguay, ${fechaActa(d)}, siendo las ${horaTexto(str(d, "hora"))}, se reúnen en la sede social de ${denom(ctx)} (en adelante, "la Sociedad"), sita en ${domicilio(ctx)}, los miembros del Directorio que firman al pie${presentes.length ? `: ${presentes.map(esc).join(", ")}` : ""}.${str(d, "sindico") ? ` Se encuentra presente el Síndico Titular, ${esc(str(d, "sindico"))}.` : ""} Habiendo quórum suficiente conforme a los estatutos sociales, el Presidente declara abierta la sesión y pone a consideración el siguiente orden del día:</p>
<p><strong>1. Consideración de la Memoria del Directorio, el Balance General, el Estado de Resultados y demás documentación del ejercicio cerrado el ${str(d, "cierre") ? formatFecha(str(d, "cierre")) : "[FECHA DE CIERRE]"}.</strong></p>
<p>El Presidente presenta la documentación del ejercicio, que arroja ${resultadoTexto(d)}. Luego de un intercambio de opiniones, el Directorio resuelve aprobarla y someterla a consideración de la Asamblea General Ordinaria de Accionistas.</p>
<p><strong>2. Propuesta de destino de las utilidades del ejercicio.</strong></p>
<p>El Directorio resuelve proponer a la Asamblea que ${destinoTexto(d)}.</p>
<p><strong>3. Convocatoria a Asamblea General Ordinaria de Accionistas.</strong></p>
<p>El Directorio resuelve convocar a los señores accionistas a Asamblea General Ordinaria a celebrarse el día ${str(d, "fecha_asamblea") ? formatFecha(str(d, "fecha_asamblea")) : '<span class="ph">[FECHA]</span>'}, a las ${horaTexto(str(d, "hora_asamblea"))} en primera convocatoria${segunda}, en la sede social sita en ${domicilio(ctx)}, a fin de tratar el siguiente orden del día:</p>
<ol>${ordenDelDiaAsamblea(d).map((i) => `<li>${i}</li>`).join("")}</ol>
<p><strong>4. Publicaciones y puesta a disposición de documentación.</strong></p>
<p>El Directorio resuelve: (i) publicar el edicto de convocatoria en un diario de gran circulación durante cinco días, con al menos diez días y no más de treinta días de anticipación a la fecha de la Asamblea; (ii) poner a disposición de los accionistas en la sede social, con no menos de quince días de anticipación, la Memoria, el Balance General, el Estado de Resultados y el Informe del Síndico; y (iii) recordar a los accionistas que, para asistir, deberán comunicar su asistencia con no menos de tres días hábiles de anticipación a la fecha fijada.</p>
<p><strong>5. Autorizaciones.</strong></p>
<p>Se autoriza a ${v(d, "autorizados", "NOMBRE/S")} para que, en forma indistinta, realicen todas las gestiones necesarias para la publicación del edicto y demás trámites derivados de la presente resolución.</p>
<p>No habiendo más asuntos que tratar, se levanta la sesión, previa lectura y ratificación de la presente acta, que firman los presentes.</p>
${firmas([
  ...(presentes.length ? presentes : ["", ""]).map((n, i) => ({ nombre: n ? esc(n) : "&nbsp;", cargo: i === 0 ? "Presidente" : "Director" })),
  ...(str(d, "sindico") ? [{ nombre: esc(str(d, "sindico")), cargo: "Síndico Titular" }] : []),
])}`;
  },
};

const edicto: Plantilla = {
  key: "edicto-convocatoria",
  numero: "SOC-02",
  grupo: "societario",
  titulo: "Edicto de convocatoria a Asamblea General Ordinaria",
  descripcion: "El aviso a publicar 5 días en un diario, con 10 a 30 días de anticipación.",
  tipos: ["sa"],
  campos: [
    { key: "fecha_asamblea", label: "Fecha de la asamblea", type: "date", required: true },
    { key: "hora_asamblea", label: "Hora 1ª convocatoria", type: "time", default: () => "10:00" },
    { key: "hora_segunda", label: "Hora 2ª convocatoria", type: "time", help: "Dejalo vacío si los estatutos no permiten convocatorias simultáneas.", default: () => "11:00" },
    { key: "cierre", label: "Cierre del ejercicio", type: "date", default: CIERRE, required: true },
    ...CAMPOS_ORDEN,
  ],
  tituloDoc: (d) => `Edicto de convocatoria AGO ${str(d, "fecha_asamblea") ? formatFecha(str(d, "fecha_asamblea")) : ""}`.trim(),
  render: (d, ctx) => {
    const fecha = str(d, "fecha_asamblea");
    const segunda = str(d, "hora_segunda") ? ` y a las ${horaTexto(str(d, "hora_segunda"))} en segunda convocatoria` : "";
    return `
${encabezado("Edicto de convocatoria")}
<div class="edicto">
<p class="center"><strong>${esc(ctx.empresa.denominacion.toUpperCase())}</strong><br/><strong>CONVOCATORIA A ASAMBLEA GENERAL ORDINARIA</strong></p>
<p>El Directorio de ${esc(ctx.empresa.denominacion)} convoca a los señores accionistas a Asamblea General Ordinaria a celebrarse el día ${fecha ? formatFecha(fecha) : '<span class="ph">[FECHA]</span>'}, a las ${horaTexto(str(d, "hora_asamblea"))} en primera convocatoria${segunda}, en la sede social sita en ${domicilio(ctx)}${ctx.empresa.ciudad ? `, ${esc(ctx.empresa.ciudad)}` : ""}, a fin de tratar el siguiente:</p>
<p class="center"><strong>ORDEN DEL DÍA</strong></p>
<ol>${ordenDelDiaAsamblea(d).map((i) => `<li>${i}</li>`).join("")}</ol>
<p>Se recuerda a los señores accionistas que, para participar en la Asamblea, deberán comunicar su asistencia con no menos de tres días hábiles de anticipación a la fecha fijada. La documentación a ser considerada se encuentra a su disposición en la sede social.</p>
<p class="right"><strong>EL DIRECTORIO</strong></p>
</div>
<p class="nota">Publicar durante 5 días. Primera publicación entre ${fecha ? formatFecha(addDaysSafe(fecha, -30)) : "30"} y ${fecha ? formatFecha(addDaysSafe(fecha, -10)) : "10 días antes"}. Guardá la factura de publicación.</p>`;
  },
};

function addDaysSafe(iso: string, n: number): string {
  const [y, m, dd] = iso.split("-").map(Number);
  const x = new Date(y, m - 1, dd + n);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
}

const registroAsistencia: Plantilla = {
  key: "registro-asistencia",
  numero: "SOC-03",
  grupo: "societario",
  titulo: "Registro de asistencia a Asamblea",
  descripcion: "Se arma solo con tu libro de accionistas: acciones, votos y porcentaje de cada uno.",
  tipos: ["sa", "eas"],
  campos: [
    { key: "fecha_asamblea", label: "Fecha de la asamblea", type: "date", required: true },
    {
      key: "caracter",
      label: "Carácter",
      type: "select",
      options: [
        { value: "Ordinaria", label: "Ordinaria" },
        { value: "Extraordinaria", label: "Extraordinaria" },
      ],
      default: () => "Ordinaria",
    },
    { key: "presidente", label: "Presidente del Directorio", type: "text", default: presidenteDefault },
    { key: "apoderados", label: "Accionistas representados por apoderado", type: "textarea", help: "Uno por línea: Accionista | Apoderado" },
  ],
  tituloDoc: (d) => `Registro de asistencia ${str(d, "fecha_asamblea") ? formatFecha(str(d, "fecha_asamblea")) : ""}`.trim(),
  render: (d, ctx) => {
    const apod = new Map(
      lines(d, "apoderados").map((l) => {
        const [a, b] = l.split("|").map((x) => x.trim());
        return [a?.toLowerCase(), b] as const;
      })
    );
    const filas = ctx.accionistas.filter((a) => Number(a.acciones) > 0);
    const rows = filas
      .map(
        (a, i) => `<tr><td>${i + 1}</td><td>${esc(a.nombre)}</td><td>${esc(a.documento ?? "")}</td><td class="num">${formatNumero(a.acciones)}</td><td class="num">${formatNumero(a.votos)}</td><td class="num">${formatPct(a.pctCapital)}</td><td>${esc(apod.get(a.nombre.toLowerCase()) ?? "Por sí")}</td><td></td></tr>`
      )
      .join("");
    return `
${encabezado("Registro de asistencia")}
<p class="center"><strong>${esc(ctx.empresa.denominacion.toUpperCase())}</strong><br/>REGISTRO DE ASISTENCIA<br/>Asamblea General ${esc(str(d, "caracter") || "Ordinaria")} del ${str(d, "fecha_asamblea") ? formatFecha(str(d, "fecha_asamblea")) : '<span class="ph">[FECHA]</span>'}</p>
<table class="tabla">
<thead><tr><th>N°</th><th>Accionista</th><th>C.I. / RUC</th><th>Acciones</th><th>Votos</th><th>% capital</th><th>Representado por</th><th>Firma</th></tr></thead>
<tbody>${rows || '<tr><td colspan="8"><span class="ph">[Cargá accionistas en el libro de la empresa]</span></td></tr>'}</tbody>
<tfoot><tr><td colspan="3"><strong>TOTAL</strong></td><td class="num"><strong>${formatNumero(ctx.totalAcciones)}</strong></td><td class="num"><strong>${formatNumero(ctx.totalVotos)}</strong></td><td class="num"><strong>100%</strong></td><td colspan="2"></td></tr></tfoot>
</table>
<p>Se cierra el presente registro con la comunicación de asistencia de ${numeroALetras(filas.length)} (${filas.length}) accionistas, titulares de ${formatNumero(ctx.totalAcciones)} acciones que representan ${formatNumero(ctx.totalVotos)} votos. <em>Si alguno no comunicó asistencia, tachá su fila y recalculá el total.</em></p>
${firmas([{ nombre: str(d, "presidente") ? esc(str(d, "presidente")) : "&nbsp;", cargo: "Presidente del Directorio" }])}
<p class="nota">Registrá solo acciones integradas. Las cartas poder van adjuntas. Directores, síndicos, gerentes y empleados de la sociedad no pueden ser apoderados de accionistas.</p>`;
  },
};

const actaAsamblea: Plantilla = {
  key: "acta-asamblea-ordinaria",
  numero: "SOC-04",
  grupo: "societario",
  titulo: "Acta de Asamblea General Ordinaria anual",
  descripcion: "Aprobación del balance, destino de utilidades, gestión y elección de autoridades.",
  tipos: ["sa"],
  campos: [
    ...CAMPOS_BASE,
    { key: "presidente", label: "Preside la asamblea", type: "text", default: presidenteDefault },
    { key: "secretario", label: "Secretario", type: "text" },
    { key: "sindico", label: "Síndico titular", type: "text" },
    { key: "pct_presente", label: "% del capital presente", type: "number", default: () => "100" },
    { key: "diario", label: "Diario donde se publicó el edicto", type: "text" },
    { key: "fechas_publicacion", label: "Fechas de publicación", type: "text", help: "Ej.: 1, 2, 3, 6 y 7 de abril de 2027" },
    {
      key: "convocatoria",
      label: "Convocatoria",
      type: "select",
      options: [
        { value: "primera", label: "Primera" },
        { value: "segunda", label: "Segunda" },
      ],
      default: () => "primera",
    },
    { key: "firmantes", label: "Accionistas que firman el acta (uno por línea)", type: "textarea", default: (c) => c.accionistas.slice(0, 2).map((a) => a.nombre).join("\n") },
    ...CAMPOS_EJERCICIO,
    { key: "abstencion", label: "Accionistas-directores que se abstienen sobre su gestión", type: "text", help: "Recomendado cuando un accionista también es director." },
    ...CAMPOS_ORDEN,
    { key: "nuevas_autoridades", label: "Autoridades electas (Cargo | Nombre | C.I., una por línea)", type: "textarea", default: autoridadesDefault, showIf: "elegir_directores" },
    { key: "mandato", label: "Período del mandato", type: "text", default: () => "un (1) ejercicio", showIf: "elegir_directores" },
    { key: "sindico_electo", label: "Síndico titular / suplente electos", type: "text", showIf: "elegir_sindico" },
    { key: "remuneracion_texto", label: "Decisión sobre remuneración", type: "text", default: () => "que los cargos se ejerzan ad honorem", showIf: "remuneracion" },
    { key: "autorizados", label: "Autorizados para comunicar la asamblea", type: "text" },
  ],
  tituloDoc: (d) => `Acta de Asamblea General Ordinaria ${str(d, "fecha") ? formatFecha(str(d, "fecha")) : ""}`.trim(),
  render: (d, ctx) => {
    const firmantes = lines(d, "firmantes");
    const pct = Number(str(d, "pct_presente") || "0");
    const acciones = Math.round((ctx.totalAcciones * pct) / 100);
    let n = 4;
    const extra: string[] = [];
    if (on(d, "elegir_directores")) {
      n++;
      const aut = parseAutoridades(d, "nuevas_autoridades");
      extra.push(`<p><strong>${n}. Elección de directores titulares y suplentes.</strong></p>
<p>La Asamblea resuelve designar, por el período de ${v(d, "mandato", "PERÍODO")}, a las siguientes autoridades:</p>
<ul>${aut.map((a) => `<li>${esc(a.cargo)}: ${esc(a.nombre)}${a.ci ? `, C.I. N° ${esc(a.ci)}` : ""}</li>`).join("") || "<li><span class=\"ph\">[AUTORIDADES]</span></li>"}</ul>
<p>Los designados presentes aceptan sus cargos. La distribución de cargos será ratificada por el Directorio en su primera reunión.</p>`);
    }
    if (on(d, "elegir_sindico")) {
      n++;
      extra.push(`<p><strong>${n}. Elección de síndico titular y suplente.</strong></p><p>La Asamblea designa como síndicos a ${v(d, "sindico_electo", "SÍNDICO TITULAR / SUPLENTE")}.</p>`);
    }
    if (on(d, "remuneracion")) {
      n++;
      extra.push(`<p><strong>${n}. Remuneración de directores y síndicos.</strong></p><p>La Asamblea resuelve ${v(d, "remuneracion_texto", "DECISIÓN")}.</p>`);
    }
    n++;
    return `
${encabezado("Acta de Asamblea General Ordinaria")}
<p class="center"><strong>ACTA DE ASAMBLEA GENERAL ORDINARIA N° ${v(d, "numero_acta", "__")}</strong></p>
<p>En la ciudad de ${ciudad(d, ctx)}, República del Paraguay, ${fechaActa(d)}, siendo las ${horaTexto(str(d, "hora"))}, se reúnen en la sede social de ${denom(ctx)} (en adelante, "la Sociedad"), sita en ${domicilio(ctx)}, los accionistas que figuran en el Registro de Asistencia, titulares de ${formatNumero(acciones)} acciones, equivalentes al ${formatPct(pct)} del capital integrado con derecho a voto.${str(d, "sindico") ? ` Se encuentra presente el Síndico Titular, ${esc(str(d, "sindico"))}.` : ""}</p>
<p>Preside la Asamblea ${v(d, "presidente", "PRESIDENTE")} y actúa como Secretario ${v(d, "secretario", "SECRETARIO")}. El Presidente deja constancia de que la Asamblea fue convocada conforme a la ley y los estatutos sociales mediante publicaciones en el diario ${v(d, "diario", "DIARIO")} los días ${v(d, "fechas_publicacion", "FECHAS")}, y que existe quórum suficiente para sesionar en ${str(d, "convocatoria") === "segunda" ? "segunda" : "primera"} convocatoria. Acto seguido, se pasa a considerar el orden del día:</p>
<p><strong>1. Designación de dos accionistas para firmar el acta.</strong></p>
<p>Por unanimidad se designa a ${firmantes.length ? firmantes.map(esc).join(" y ") : '<span class="ph">[ACCIONISTAS]</span>'} para firmar la presente acta juntamente con el Presidente y el Secretario.</p>
<p><strong>2. Consideración de la Memoria del Directorio, el Balance General, el Estado de Resultados, sus anexos y el Informe del Síndico correspondientes al ejercicio cerrado el ${str(d, "cierre") ? formatFecha(str(d, "cierre")) : "[FECHA DE CIERRE]"}.</strong></p>
<p>Se pone a consideración la documentación mencionada, que estuvo a disposición de los accionistas en la sede social con la anticipación legal. Luego de un intercambio de opiniones, la Asamblea resuelve por unanimidad aprobarla. El ejercicio arroja ${resultadoTexto(d)}.</p>
<p><strong>3. Destino de las utilidades del ejercicio.</strong></p>
<p>A propuesta del Directorio, la Asamblea resuelve por unanimidad que ${destinoTexto(d)}.</p>
<p><strong>4. Consideración de la gestión del Directorio y del Síndico.</strong></p>
<p>La Asamblea resuelve aprobar la gestión del Directorio y del Síndico durante el ejercicio considerado.${str(d, "abstencion") ? ` ${esc(str(d, "abstencion"))}, en su calidad de director/es, se abstiene/n de votar respecto de su propia gestión.` : ""}</p>
${extra.join("\n")}
<p><strong>${n}. Autorizaciones.</strong></p>
<p>Se autoriza a ${v(d, "autorizados", "NOMBRE/S")} para que, en forma indistinta, realicen la comunicación de la presente Asamblea ante la Dirección General de Personas y Estructuras Jurídicas y Beneficiarios Finales, las actualizaciones que correspondan ante los registros administrativos y demás organismos, y cualquier otro trámite derivado de lo resuelto.</p>
<p>No habiendo más asuntos que tratar, se levanta la sesión, previa lectura y aprobación de la presente acta.</p>
${firmas([
  { nombre: str(d, "presidente") ? esc(str(d, "presidente")) : "&nbsp;", cargo: "Presidente" },
  { nombre: str(d, "secretario") ? esc(str(d, "secretario")) : "&nbsp;", cargo: "Secretario" },
  ...(firmantes.length ? firmantes : ["", ""]).map((f) => ({ nombre: f ? esc(f) : "&nbsp;", cargo: "Accionista" })),
  ...(str(d, "sindico") ? [{ nombre: esc(str(d, "sindico")), cargo: "Síndico" }] : []),
])}
<p class="nota">Después de la asamblea: firmá el acta en el libro dentro de los 5 días, comunicala a la DGPEJBF dentro de los 15 días hábiles y, si cambiaron las autoridades, actualizá los registros y generá el acta de distribución de cargos.</p>`;
  },
};

const actaCargos: Plantilla = {
  key: "acta-distribucion-cargos",
  numero: "SOC-05",
  grupo: "societario",
  titulo: "Acta de Directorio: distribución y aceptación de cargos",
  descripcion: "Define quién ocupa cada cargo y quién usa la firma social después de una elección.",
  tipos: ["sa"],
  campos: [
    ...CAMPOS_BASE,
    { key: "fecha_asamblea", label: "Fecha de la asamblea que eligió autoridades", type: "date" },
    { key: "autoridades", label: "Autoridades (Cargo | Nombre | C.I., una por línea)", type: "textarea", default: autoridadesDefault, required: true },
    { key: "firma", label: "Representación legal y uso de firma", type: "text", default: () => "el Presidente, en forma individual", help: "Ajustalo a lo que digan tus estatutos." },
    { key: "sindico", label: "Síndico titular", type: "text" },
    { key: "autorizados", label: "Autorizados para las actualizaciones", type: "text" },
  ],
  tituloDoc: (d) => `Acta de Directorio — distribución de cargos ${str(d, "fecha") ? formatFecha(str(d, "fecha")) : ""}`.trim(),
  render: (d, ctx) => {
    const aut = parseAutoridades(d, "autoridades");
    return `
${encabezado("Distribución y aceptación de cargos")}
<p class="center"><strong>ACTA DE DIRECTORIO N° ${v(d, "numero_acta", "__")}</strong></p>
<p>En la ciudad de ${ciudad(d, ctx)}, República del Paraguay, ${fechaActa(d)}, siendo las ${horaTexto(str(d, "hora"))}, se reúnen en la sede social de ${denom(ctx)}, sita en ${domicilio(ctx)}, los miembros del Directorio electos por la Asamblea General Ordinaria de fecha ${str(d, "fecha_asamblea") ? formatFecha(str(d, "fecha_asamblea")) : '<span class="ph">[FECHA]</span>'}.${str(d, "sindico") ? ` Se encuentra presente el Síndico Titular, ${esc(str(d, "sindico"))}.` : ""} Habiendo quórum suficiente, se considera el siguiente orden del día:</p>
<p><strong>1. Aceptación de cargos.</strong> Los directores electos manifiestan su aceptación de los cargos y declaran no estar comprendidos en ninguna de las prohibiciones o incompatibilidades legales para ejercerlos.</p>
<p><strong>2. Distribución de cargos.</strong> El Directorio resuelve por unanimidad distribuir los cargos de la siguiente manera, por el período estatutario:</p>
<table class="tabla"><thead><tr><th>Cargo</th><th>Nombre y apellido</th><th>C.I. N°</th></tr></thead>
<tbody>${aut.map((a) => `<tr><td>${esc(a.cargo)}</td><td>${esc(a.nombre)}</td><td>${esc(a.ci)}</td></tr>`).join("")}</tbody></table>
<p><strong>3. Representación legal y uso de la firma social.</strong> Conforme a los estatutos sociales, la representación legal y el uso de la firma social corresponderán a ${v(d, "firma", "RÉGIMEN DE FIRMA")}.</p>
<p><strong>4. Actualizaciones y autorizaciones.</strong> Se autoriza a ${v(d, "autorizados", "NOMBRE/S")} para realizar las actualizaciones correspondientes ante la Dirección General de Personas y Estructuras Jurídicas y Beneficiarios Finales, la administración tributaria, el Instituto de Previsión Social, el Ministerio de Trabajo, Empleo y Seguridad Social, entidades bancarias y demás organismos.</p>
<p>No habiendo más asuntos que tratar, se levanta la sesión, previa lectura y ratificación de la presente acta.</p>
${firmas([...aut.map((a) => ({ nombre: esc(a.nombre) || "&nbsp;", cargo: a.cargo })), ...(str(d, "sindico") ? [{ nombre: esc(str(d, "sindico")), cargo: "Síndico Titular" }] : [])])}
<p class="nota">Si cambió el representante legal, actualizá el registro de personas jurídicas y beneficiarios finales dentro de los 15 días hábiles.</p>`;
  },
};

const actaPoderes: Plantilla = {
  key: "acta-poderes",
  numero: "POD-01",
  grupo: "poderes",
  titulo: "Acta de Directorio: otorgamiento y revocación de poderes",
  descripcion: "Autoriza a una persona a actuar por la empresa y deja sin efecto poderes anteriores.",
  tipos: ["sa"],
  campos: [
    ...CAMPOS_BASE,
    { key: "revocar", label: "Revocar un poder anterior", type: "checkbox", default: () => false },
    { key: "revocado_a", label: "Poder que se revoca (a favor de)", type: "text", showIf: "revocar" },
    { key: "revocado_escritura", label: "Escritura N° / fecha / escribano", type: "text", showIf: "revocar" },
    { key: "apoderado", label: "Nuevo apoderado (nombre)", type: "text", required: true },
    { key: "apoderado_ci", label: "C.I. del apoderado", type: "text" },
    {
      key: "clase",
      label: "Clase de poder",
      type: "select",
      options: [
        { value: "especial", label: "Especial" },
        { value: "general de administración", label: "General de administración" },
      ],
      default: () => "especial",
    },
    {
      key: "facultades",
      label: "Facultades (una por línea)",
      type: "textarea",
      default: () =>
        "Representar a la Sociedad ante la administración tributaria, el IPS, el Ministerio de Trabajo y demás reparticiones públicas.\nOperar cuentas bancarias hasta un monto de Gs. __ por operación.\nCelebrar contratos de trabajo y de prestación de servicios.",
    },
    { key: "exclusiones", label: "Facultades excluidas", type: "text", default: () => "vender o gravar inmuebles y constituir garantías a favor de terceros" },
    { key: "vigencia", label: "Vigencia", type: "text", default: () => "hasta su revocación" },
    { key: "firmantes", label: "Directores que firman (uno por línea)", type: "textarea", default: (c) => presidenteDefault(c) },
  ],
  tituloDoc: (d) => `Acta de Directorio — poder a ${str(d, "apoderado") || "apoderado"}`,
  render: (d, ctx) => {
    let n = 0;
    const partes: string[] = [];
    if (on(d, "revocar")) {
      n++;
      partes.push(`<p><strong>${n}. Revocación de poderes.</strong> El Directorio resuelve revocar, con efecto a partir de la fecha, el poder otorgado a favor de ${v(d, "revocado_a", "NOMBRE")}, instrumentado por ${v(d, "revocado_escritura", "ESCRITURA N°, FECHA Y ESCRIBANO")}. Se instruye notificar la revocación al apoderado y a los terceros ante quienes el poder hubiera sido presentado.</p>`);
    }
    n++;
    partes.push(`<p><strong>${n}. Otorgamiento de poder.</strong> El Directorio resuelve otorgar poder ${esc(str(d, "clase") || "especial")} a favor de ${v(d, "apoderado", "APODERADO")}${str(d, "apoderado_ci") ? `, C.I. N° ${esc(str(d, "apoderado_ci"))}` : ""}, para que, en nombre y representación de la Sociedad, pueda realizar los siguientes actos:</p>
<ul>${lines(d, "facultades").map((f) => `<li>${esc(f)}</li>`).join("")}</ul>
<p>Quedan expresamente excluidas de este poder las facultades de ${v(d, "exclusiones", "EXCLUSIONES")}, que requerirán resolución expresa del Directorio. El poder tendrá vigencia ${v(d, "vigencia", "VIGENCIA")}.</p>`);
    n++;
    partes.push(`<p><strong>${n}. Formalización.</strong> Se autoriza al Presidente a comparecer ante escribano público para otorgar la escritura de poder en los términos aquí aprobados y a gestionar su inscripción en la Dirección General de los Registros Públicos cuando corresponda.</p>`);
    const fs = lines(d, "firmantes");
    return `
${encabezado("Otorgamiento y revocación de poderes")}
<p class="center"><strong>ACTA DE DIRECTORIO N° ${v(d, "numero_acta", "__")}</strong></p>
<p>En la ciudad de ${ciudad(d, ctx)}, República del Paraguay, ${fechaActa(d)}, siendo las ${horaTexto(str(d, "hora"))}, se reúnen en la sede social de ${denom(ctx)}, sita en ${domicilio(ctx)}, los miembros del Directorio que firman al pie. Habiendo quórum suficiente conforme a los estatutos sociales, se pasa a considerar el siguiente orden del día:</p>
${partes.join("\n")}
<p>No habiendo más asuntos que tratar, se levanta la sesión, previa lectura y ratificación de la presente acta.</p>
${firmas((fs.length ? fs : ["", ""]).map((f, i) => ({ nombre: f ? esc(f) : "&nbsp;", cargo: i === 0 ? "Presidente" : "Director" })))}
<p class="nota">Buena práctica: poderes especiales con límites de monto y firma conjunta para actos de alto impacto. Cuando se firme la escritura, registrá el poder en Documentos › Poderes para controlar su vigencia.</p>`;
  },
  registroPoder: (d) => ({
    apoderado: str(d, "apoderado"),
    apoderado_documento: str(d, "apoderado_ci") || null,
    tipo: str(d, "clase").startsWith("general") ? "general" : "especial",
    facultades: lines(d, "facultades").join("\n") || null,
    fecha_otorgamiento: str(d, "fecha"),
    instrumento: "Escritura pública N° __ (aprobada por acta de Directorio)",
    duracion_texto: str(d, "vigencia") || null,
    notas: `Otorgamiento aprobado por acta de Directorio${str(d, "numero_acta") ? ` N° ${str(d, "numero_acta")}` : ""}${str(d, "fecha") ? ` del ${formatFecha(str(d, "fecha"))}` : ""}. Completá los datos de la escritura cuando se firme.`,
  }),
};

const cartaPoder: Plantilla = {
  key: "carta-poder",
  numero: "SOC-06",
  grupo: "societario",
  titulo: "Carta poder para representación en Asamblea",
  descripcion: "Para el accionista que no puede asistir y se hace representar.",
  tipos: ["sa", "eas"],
  campos: [
    { key: "fecha", label: "Fecha de la carta", type: "date", required: true },
    { key: "ciudad", label: "Ciudad", type: "text", default: (c) => c.empresa.ciudad ?? "" },
    { key: "accionista", label: "Accionista que otorga", type: "select", required: true, optionsFromAccionistas: true, default: (c) => c.accionistas[0]?.id ?? "" },
    { key: "apoderado", label: "Apoderado", type: "text", required: true },
    { key: "apoderado_ci", label: "C.I. del apoderado", type: "text" },
    { key: "fecha_asamblea", label: "Fecha de la asamblea", type: "date", required: true },
    { key: "hora_asamblea", label: "Hora", type: "time", default: () => "10:00" },
    {
      key: "caracter",
      label: "Carácter",
      type: "select",
      options: [
        { value: "Ordinaria", label: "Ordinaria" },
        { value: "Extraordinaria", label: "Extraordinaria" },
      ],
      default: () => "Ordinaria",
    },
    { key: "instrucciones", label: "Instrucciones de voto (opcional)", type: "textarea", help: "Vacío = el apoderado vota con total libertad." },
  ],
  tituloDoc: (d, ctx) => {
    const a = ctx.accionistas.find((x) => x.id === str(d, "accionista"));
    return `Carta poder — ${a?.nombre ?? "accionista"}`;
  },
  render: (d, ctx) => {
    const a = ctx.accionistas.find((x) => x.id === str(d, "accionista"));
    const nombre = a ? esc(a.nombre) : '<span class="ph">[ACCIONISTA]</span>';
    const doc = a?.documento ? `, con ${a.tipo_persona === "juridica" ? "RUC" : "C.I."} N° ${esc(a.documento)}` : "";
    const acciones = a ? formatNumero(a.acciones) : "[__]";
    const instr = str(d, "instrucciones");
    return `
${encabezado("Carta poder")}
<p class="right">${ciudad(d, ctx)}, ${str(d, "fecha") ? formatFecha(str(d, "fecha")) : '<span class="ph">[FECHA]</span>'}</p>
<p>Señores<br/>${denom(ctx)}<br/>Presente</p>
<p><strong>Ref.: Carta poder – Asamblea General ${esc(str(d, "caracter") || "Ordinaria")} del ${str(d, "fecha_asamblea") ? formatFecha(str(d, "fecha_asamblea")) : '<span class="ph">[FECHA]</span>'}</strong></p>
<p>Por medio de la presente, ${nombre}${doc}, en mi carácter de titular de ${acciones} acciones de ${esc(ctx.empresa.denominacion)}, otorgo poder especial a favor de ${v(d, "apoderado", "APODERADO")}${str(d, "apoderado_ci") ? `, con C.I. N° ${esc(str(d, "apoderado_ci"))}` : ""}, para que me represente en la Asamblea General ${esc(str(d, "caracter") || "Ordinaria")} de Accionistas convocada para el día ${str(d, "fecha_asamblea") ? formatFecha(str(d, "fecha_asamblea")) : '<span class="ph">[FECHA]</span>'}, a las ${horaTexto(str(d, "hora_asamblea"))}, en primera o segunda convocatoria, así como en sus eventuales cuartos intermedios.</p>
<p>En tal carácter, el apoderado queda facultado para deliberar y votar sobre todos los puntos del orden del día, ${instr ? `conforme a las siguientes instrucciones: ${esc(instr)}` : "con total libertad"}, firmar el registro de asistencia y el acta de la asamblea en caso de ser designado a tal efecto, y realizar todos los actos necesarios para el cumplimiento del presente mandato.</p>
<p>Atentamente,</p>
${firmas([{ nombre, cargo: a?.documento ? `${a.tipo_persona === "juridica" ? "RUC" : "C.I."} N° ${a.documento}` : "Accionista" }])}
<p class="nota">La firma debe estar certificada por escribano (o registrada en la sociedad). Si se firma en el exterior, necesita apostilla. No pueden ser apoderados los directores, síndicos, gerentes ni empleados de la sociedad.</p>`;
  },
};

const actaEas: Plantilla = {
  key: "acta-asamblea-eas",
  numero: "SOC-07",
  grupo: "societario",
  titulo: "Acta de Asamblea de Accionistas de EAS — aprobación anual",
  descripcion: "Estados financieros, destino de utilidades, gestión y designación del órgano de administración.",
  tipos: ["eas"],
  campos: [
    ...CAMPOS_BASE,
    {
      key: "modalidad",
      label: "Modalidad",
      type: "select",
      options: [
        { value: "presencial", label: "Presencial en la sede social" },
        { value: "electronica", label: "Por medios electrónicos (si los estatutos lo prevén)" },
      ],
      default: () => "presencial",
    },
    { key: "plataforma", label: "Plataforma usada", type: "text", help: "Solo si es por medios electrónicos." },
    { key: "totalitaria", label: "Se celebra con la totalidad del capital, sin convocatoria previa", type: "checkbox", default: () => true },
    { key: "pct_presente", label: "% del capital presente", type: "number", default: () => "100" },
    { key: "presidente", label: "Preside", type: "text", default: presidenteDefault },
    { key: "secretario", label: "Secretario", type: "text" },
    ...CAMPOS_EJERCICIO,
    { key: "designar", label: "Designar / renovar el órgano de administración", type: "checkbox", default: () => false },
    { key: "administradores", label: "Administradores (Cargo | Nombre | C.I., uno por línea)", type: "textarea", default: autoridadesDefault, showIf: "designar" },
    { key: "autorizados", label: "Autorizados para comunicaciones", type: "text" },
  ],
  tituloDoc: (d) => `Acta de Asamblea EAS ${str(d, "fecha") ? formatFecha(str(d, "fecha")) : ""}`.trim(),
  render: (d, ctx) => {
    const electronica = str(d, "modalidad") === "electronica";
    const lugar = electronica
      ? `por medios electrónicos a través de ${v(d, "plataforma", "PLATAFORMA")}, conforme lo autorizan los estatutos`
      : `en la sede social de ${denom(ctx)}, sita en ${domicilio(ctx)}`;
    const conv = on(d, "totalitaria")
      ? "La reunión se celebra sin convocatoria previa por encontrarse presente la totalidad del capital, que aprueba por unanimidad el orden del día."
      : "La reunión fue convocada conforme a los estatutos sociales.";
    const aut = parseAutoridades(d, "administradores");
    return `
${encabezado("Acta de Asamblea de Accionistas (EAS)")}
<p class="center"><strong>ACTA DE ASAMBLEA DE ACCIONISTAS N° ${v(d, "numero_acta", "__")}</strong></p>
<p>En la ciudad de ${ciudad(d, ctx)}, República del Paraguay, ${fechaActa(d)}, siendo las ${horaTexto(str(d, "hora"))}, se reúnen ${lugar}, los accionistas de ${denom(ctx)} titulares del ${formatPct(Number(str(d, "pct_presente") || "0"))} del capital con derecho a voto, según consta en el registro de asistencia. ${conv}</p>
<p>Preside la reunión ${v(d, "presidente", "PRESIDENTE")} y actúa como secretario ${v(d, "secretario", "SECRETARIO")}. Verificado el quórum estatutario, se considera el siguiente orden del día:</p>
<p><strong>1. Estados financieros e informe de gestión.</strong> Los accionistas resuelven aprobar el balance general, el estado de resultados y demás estados financieros del ejercicio cerrado el ${str(d, "cierre") ? formatFecha(str(d, "cierre")) : "[FECHA DE CIERRE]"}, que arrojan ${resultadoTexto(d)}, así como el informe de gestión presentado.</p>
<p><strong>2. Destino de las utilidades.</strong> Se resuelve que ${destinoTexto(d)}.</p>
<p><strong>3. Gestión del órgano de administración.</strong> Se aprueba la gestión del órgano de administración durante el ejercicio.</p>
${on(d, "designar") ? `<p><strong>4. Designación del órgano de administración.</strong> Se resuelve designar a:</p><ul>${aut.map((a) => `<li>${esc(a.cargo)}: ${esc(a.nombre)}${a.ci ? `, C.I. N° ${esc(a.ci)}` : ""}</li>`).join("")}</ul><p>Los designados presentes aceptan sus cargos.</p>` : ""}
<p><strong>${on(d, "designar") ? 5 : 4}. Autorizaciones.</strong> Se autoriza a ${v(d, "autorizados", "NOMBRE/S")} para realizar la comunicación de la presente asamblea y las actualizaciones que correspondan a través de la plataforma electrónica habilitada y ante los demás organismos.</p>
<p>No habiendo más asuntos que tratar, se levanta la sesión.</p>
${firmas([
  { nombre: str(d, "presidente") ? esc(str(d, "presidente")) : "&nbsp;", cargo: "Presidente de la reunión" },
  { nombre: str(d, "secretario") ? esc(str(d, "secretario")) : "&nbsp;", cargo: "Secretario" },
])}
<p class="nota">Si el administrador titular es el único accionista, los estatutos exigen designar un suplente.</p>`;
  },
};

const actaUnico: Plantilla = {
  key: "acta-accionista-unico",
  numero: "SOC-08",
  grupo: "societario",
  titulo: "Acta de decisiones del Accionista Único de EAS",
  descripcion: "Para la EAS de una sola persona: sus decisiones anuales también se documentan.",
  tipos: ["eas"],
  campos: [
    { key: "fecha", label: "Fecha", type: "date", required: true },
    { key: "ciudad", label: "Ciudad", type: "text", default: (c) => c.empresa.ciudad ?? "" },
    { key: "numero_acta", label: "N° de acta", type: "text" },
    { key: "accionista", label: "Accionista único", type: "text", default: (c) => c.accionistas[0]?.nombre ?? "" },
    { key: "accionista_ci", label: "C.I.", type: "text", default: (c) => c.accionistas[0]?.documento ?? "" },
    ...CAMPOS_EJERCICIO,
    { key: "titular", label: "Administrador titular", type: "text", default: (c) => c.accionistas[0]?.nombre ?? "" },
    { key: "suplente", label: "Administrador suplente", type: "text", help: "Obligatorio si el titular es el propio accionista único." },
    { key: "otra", label: "Otra decisión (opcional)", type: "textarea" },
  ],
  tituloDoc: (d) => `Decisiones del accionista único ${str(d, "fecha") ? formatFecha(str(d, "fecha")) : ""}`.trim(),
  render: (d, ctx) => `
${encabezado("Decisiones del Accionista Único")}
<p class="center"><strong>ACTA DE DECISIONES DEL ACCIONISTA ÚNICO N° ${v(d, "numero_acta", "__")}</strong></p>
<p>En la ciudad de ${ciudad(d, ctx)}, República del Paraguay, ${fechaActa(d)}, ${v(d, "accionista", "NOMBRE")}${str(d, "accionista_ci") ? `, con C.I. N° ${esc(str(d, "accionista_ci"))}` : ""}, en su carácter de titular del cien por ciento (100%) de las acciones de ${denom(ctx)}${ctx.empresa.ruc ? `, RUC N° ${esc(ctx.empresa.ruc)}` : ""}, en ejercicio de las atribuciones que la ley y los estatutos confieren al órgano de gobierno, adopta las siguientes decisiones:</p>
<p><strong>PRIMERA – Estados financieros.</strong> Aprueba los estados financieros del ejercicio cerrado el ${str(d, "cierre") ? formatFecha(str(d, "cierre")) : "[FECHA DE CIERRE]"}, que arrojan ${resultadoTexto(d)}.</p>
<p><strong>SEGUNDA – Destino de las utilidades.</strong> Resuelve que ${destinoTexto(d)}.</p>
<p><strong>TERCERA – Órgano de administración.</strong> Ratifica o designa como administrador titular a ${v(d, "titular", "TITULAR")} y como administrador suplente a ${v(d, "suplente", "SUPLENTE")}.</p>
${str(d, "otra") ? `<p><strong>CUARTA – Otra decisión.</strong> ${esc(str(d, "otra"))}</p>` : ""}
<p><strong>${str(d, "otra") ? "QUINTA" : "CUARTA"} – Autorizaciones.</strong> Autoriza a realizar las comunicaciones y actualizaciones que correspondan a través de la plataforma electrónica habilitada y ante los demás organismos.</p>
<p>En prueba de conformidad, firma la presente acta en el lugar y fecha indicados.</p>
${firmas([{ nombre: str(d, "accionista") ? esc(str(d, "accionista")) : "&nbsp;", cargo: "Accionista Único" }])}`,
};

const actaFamiliar: Plantilla = {
  key: "acta-contratacion-familiar",
  numero: "FAM-04",
  grupo: "familia",
  titulo: "Acta que aprueba la contratación de un familiar",
  descripcion: "Deja constancia de que la contratación de un pariente se decidió con reglas objetivas.",
  tipos: ["sa", "eas", "srl"],
  campos: [
    ...CAMPOS_BASE,
    { key: "candidato", label: "Familiar a contratar", type: "text", required: true },
    { key: "director_vinculado", label: "Director vinculado", type: "text" },
    { key: "parentesco", label: "Parentesco", type: "text", help: "Ej.: hijo, sobrina, cónyuge" },
    { key: "puesto", label: "Cargo o servicio", type: "text", required: true },
    {
      key: "modalidad",
      label: "Modalidad",
      type: "select",
      options: [
        { value: "contrato de trabajo por tiempo indefinido", label: "Contrato de trabajo" },
        { value: "contrato de prestación de servicios", label: "Prestación de servicios" },
      ],
      default: () => "contrato de trabajo por tiempo indefinido",
    },
    { key: "remuneracion", label: "Remuneración mensual (Gs.)", type: "number" },
    { key: "comparacion", label: "Comparación con el mercado", type: "text", default: () => "se evaluaron dos candidatos externos" },
    { key: "reporta_a", label: "Reporta a", type: "text" },
    { key: "inicio", label: "Fecha de inicio", type: "date" },
    { key: "firmantes", label: "Directores que firman (uno por línea)", type: "textarea" },
  ],
  tituloDoc: (d) => `Acta — contratación de ${str(d, "candidato") || "familiar"}`,
  render: (d, ctx) => {
    const fs = lines(d, "firmantes");
    return `
${encabezado("Aprobación de contratación de un familiar")}
<p class="center"><strong>ACTA DE ${ctx.empresa.tipo === "eas" ? "ÓRGANO DE ADMINISTRACIÓN" : ctx.empresa.tipo === "srl" ? "GERENCIA" : "DIRECTORIO"} N° ${v(d, "numero_acta", "__")}</strong></p>
<p>En la ciudad de ${ciudad(d, ctx)}, República del Paraguay, ${fechaActa(d)}, siendo las ${horaTexto(str(d, "hora"))}, se reúnen en la sede social de ${denom(ctx)}, sita en ${domicilio(ctx)}, los miembros que firman al pie. Habiendo quórum suficiente, se considera el siguiente orden del día:</p>
<p><strong>1. Declaración de interés.</strong> ${str(d, "director_vinculado") ? `${esc(str(d, "director_vinculado"))} declara que ${v(d, "candidato", "CANDIDATO")} es su ${v(d, "parentesco", "PARENTESCO")} y, en consecuencia, manifiesta que se abstendrá de deliberar y votar en el punto siguiente, retirándose de la sala durante su tratamiento.` : `Ningún miembro presente declara vínculo familiar con ${v(d, "candidato", "CANDIDATO")}.`}</p>
<p><strong>2. Contratación de ${v(d, "candidato", "CANDIDATO")} como ${v(d, "puesto", "CARGO")}.</strong> Se informa que existe una necesidad real del puesto, que el candidato reúne los requisitos de la política interna de incorporación de familiares, que ${v(d, "comparacion", "COMPARACIÓN CON EL MERCADO")}, y que la remuneración propuesta de ${str(d, "remuneracion") ? montoGs(str(d, "remuneracion")) : '<span class="ph">[MONTO]</span>'} mensuales se encuentra dentro de los valores de mercado del puesto. Los miembros no vinculados resuelven por unanimidad aprobar la contratación bajo la modalidad de ${esc(str(d, "modalidad"))}${str(d, "inicio") ? `, con inicio el ${formatFecha(str(d, "inicio"))}` : ""}. El candidato reportará a ${v(d, "reporta_a", "CARGO DEL SUPERIOR")}, sin vínculo familiar directo con él.</p>
<p><strong>3. Autorización.</strong> Se autoriza a suscribir el contrato correspondiente y a realizar las inscripciones y registros que correspondan, incluida la inscripción en el Instituto de Previsión Social cuando se trate de un contrato de trabajo.</p>
<p>No habiendo más asuntos que tratar, se levanta la sesión.</p>
${firmas((fs.length ? fs : ["", ""]).map((f) => ({ nombre: f ? esc(f) : "&nbsp;", cargo: f && f === str(d, "director_vinculado") ? "Director (se abstuvo en el punto 2)" : "Director" })))}`;
  },
};

const TODOS_TIPOS: TipoSociedad[] = ["sa", "eas", "srl"];

const CAMPOS_EMPLEADOR: Campo[] = [
  { key: "fecha", label: "Fecha de firma", type: "date", required: true },
  { key: "ciudad", label: "Ciudad", type: "text", default: (c) => c.empresa.ciudad ?? "" },
  { key: "representante", label: "Firma por la empresa", type: "text", default: presidenteDefault, required: true },
  { key: "representante_ci", label: "C.I. del representante", type: "text", default: (c) => c.accionistas.find((a) => a.nombre === presidenteDefault(c))?.documento ?? "" },
  { key: "representante_cargo", label: "Cargo del representante", type: "text", default: (c) => (c.empresa.tipo === "srl" ? "Gerente" : "Presidente") },
];

function partesEmpresa(d: Datos, ctx: Contexto, rol: string): string {
  return `${denom(ctx)}${ctx.empresa.ruc ? `, RUC N° ${esc(ctx.empresa.ruc)}` : ""}, con domicilio en ${domicilio(ctx)}${ctx.empresa.ciudad ? `, ${esc(ctx.empresa.ciudad)}` : ""}, representada en este acto por ${v(d, "representante", "REPRESENTANTE")}${str(d, "representante_ci") ? `, C.I. N° ${esc(str(d, "representante_ci"))}` : ""}, en su carácter de ${v(d, "representante_cargo", "CARGO")}, en adelante "${rol}"`;
}

const contratoTrabajo: Plantilla = {
  key: "contrato-trabajo-familiar",
  numero: "FAM-01",
  grupo: "familia",
  titulo: "Contrato de trabajo para un familiar que trabaja en la empresa",
  descripcion: "Formaliza la relación laboral de un hijo, sobrino o cónyuge como la de cualquier empleado. Cubre el contenido del art. 46 del Código del Trabajo.",
  tipos: TODOS_TIPOS,
  campos: [
    ...CAMPOS_EMPLEADOR,
    { key: "trabajador", label: "Nombre completo del trabajador", type: "text", required: true },
    { key: "trabajador_ci", label: "C.I. del trabajador", type: "text", required: true },
    { key: "edad", label: "Edad", type: "number", help: "Si es menor de 18 años no uses este modelo sin asesoramiento: el trabajo adolescente tiene reglas propias." },
    { key: "sexo", label: "Sexo", type: "text" },
    { key: "estado_civil", label: "Estado civil", type: "text" },
    { key: "profesion", label: "Profesión u oficio", type: "text" },
    { key: "nacionalidad", label: "Nacionalidad", type: "text", default: () => "paraguaya" },
    { key: "trabajador_domicilio", label: "Domicilio del trabajador", type: "text" },
    { key: "parentesco", label: "Parentesco", type: "text", required: true, help: "Ej.: hijo del accionista Ramón López" },
    { key: "cargo", label: "Cargo", type: "text", required: true },
    { key: "reporta_a", label: "Reporta a (cargo)", type: "text", help: "Recomendado: que no sea el padre, madre o cónyuge." },
    { key: "funciones", label: "Funciones principales (una por línea)", type: "textarea", required: true },
    { key: "lugar", label: "Lugar de prestación", type: "text", default: (c) => [c.empresa.domicilio, c.empresa.ciudad].filter(Boolean).join(", ") },
    { key: "salario", label: "Salario mensual (Gs.)", type: "number", required: true },
    { key: "forma_pago", label: "Forma y fecha de pago", type: "text", default: () => "mensualmente, dentro de los primeros cinco días del mes siguiente, por transferencia bancaria" },
    { key: "jornada", label: "Jornada", type: "text", default: () => "de lunes a viernes de 08:00 a 17:00 horas, con una hora de descanso" },
    { key: "beneficios", label: "Beneficios adicionales", type: "text", help: "Uniforme, alimentación, etc. Vacío = solo los legales." },
    {
      key: "prueba",
      label: "Período de prueba",
      type: "select",
      options: [
        { value: "30", label: "30 días (trabajador no calificado)" },
        { value: "60", label: "60 días (trabajador calificado)" },
      ],
      default: () => "60",
    },
    {
      key: "duracion",
      label: "Duración",
      type: "select",
      options: [
        { value: "indefinido", label: "Por tiempo indefinido" },
        { value: "determinado", label: "Por tiempo determinado" },
      ],
      default: () => "indefinido",
    },
    { key: "fin", label: "Fecha de finalización", type: "date", help: "Solo si es por tiempo determinado." },
    { key: "inicio", label: "Fecha de inicio", type: "date", required: true },
    { key: "adicionales", label: "Cláusulas adicionales (opcional)", type: "textarea" },
  ],
  tituloDoc: (d) => `Contrato de trabajo — ${str(d, "trabajador") || "familiar"}`,
  render: (d, ctx) => {
    const funciones = lines(d, "funciones");
    const datosTrab = [
      str(d, "edad") ? `de ${esc(str(d, "edad"))} años de edad` : "",
      str(d, "sexo") ? `sexo ${esc(str(d, "sexo"))}` : "",
      str(d, "estado_civil") ? `estado civil ${esc(str(d, "estado_civil"))}` : "",
      str(d, "profesion") ? `de profesión u oficio ${esc(str(d, "profesion"))}` : "",
      str(d, "nacionalidad") ? `de nacionalidad ${esc(str(d, "nacionalidad"))}` : "",
    ]
      .filter(Boolean)
      .join(", ");
    const duracion =
      str(d, "duracion") === "determinado"
        ? `por tiempo determinado, hasta el ${str(d, "fin") ? formatFecha(str(d, "fin")) : '<span class="ph">[FECHA DE FINALIZACIÓN]</span>'}`
        : "por tiempo indefinido";
    return `
${encabezado("Contrato de trabajo")}
<p class="center"><strong>CONTRATO INDIVIDUAL DE TRABAJO</strong></p>
<p>En la ciudad de ${ciudad(d, ctx)}, República del Paraguay, ${fechaActa(d)}, entre:</p>
<p>${partesEmpresa(d, ctx, "EL EMPLEADOR")}; y</p>
<p>${v(d, "trabajador", "NOMBRE DEL TRABAJADOR")}${datosTrab ? `, ${datosTrab}` : ""}, con C.I. N° ${v(d, "trabajador_ci", "C.I.")}, con domicilio en ${v(d, "trabajador_domicilio", "DOMICILIO")}, en adelante "EL TRABAJADOR";</p>
<p>convienen en celebrar el presente contrato individual de trabajo, que se regirá por el Código del Trabajo y las siguientes cláusulas:</p>
<p><strong>PRIMERA – Declaración sobre el vínculo familiar.</strong> Las partes dejan constancia de que EL TRABAJADOR es ${v(d, "parentesco", "PARENTESCO")}. El vínculo no otorga a EL TRABAJADOR derechos, privilegios ni obligaciones distintos de los que surgen de este contrato, de la ley laboral y de los reglamentos internos aplicables a todo el personal.</p>
<p><strong>SEGUNDA – Cargo y funciones.</strong> EL TRABAJADOR se desempeñará en el cargo de ${v(d, "cargo", "CARGO")}${str(d, "reporta_a") ? `, reportando a ${esc(str(d, "reporta_a"))}` : ""}. Sus funciones principales serán:</p>
<ul>${funciones.length ? funciones.map((f) => `<li>${esc(f)}</li>`).join("") : '<li><span class="ph">[FUNCIONES]</span></li>'}<li>Las demás tareas propias del cargo.</li></ul>
<p>Prestará sus servicios en ${v(d, "lugar", "LUGAR DE PRESTACIÓN")}.</p>
<p><strong>TERCERA – Remuneración.</strong> EL EMPLEADOR abonará a EL TRABAJADOR un salario mensual de ${str(d, "salario") ? montoGs(str(d, "salario")) : '<span class="ph">[MONTO]</span>'}, pagadero ${v(d, "forma_pago", "FORMA Y FECHA DE PAGO")}. La remuneración fue fijada en condiciones equivalentes a las de un trabajador sin vínculo familiar y es independiente de cualquier dividendo o utilidad que EL TRABAJADOR pudiera percibir como accionista o socio.</p>
<p><strong>CUARTA – Jornada.</strong> La jornada de trabajo será ${v(d, "jornada", "JORNADA")}, dentro de los límites establecidos por la ley.</p>
<p><strong>QUINTA – Beneficios.</strong> ${str(d, "beneficios") ? `EL EMPLEADOR proporcionará los siguientes beneficios: ${esc(str(d, "beneficios"))}.` : "No se pactan beneficios adicionales a los establecidos por la ley."}</p>
<p><strong>SEXTA – Período de prueba.</strong> Se establece un período de prueba de ${str(d, "prueba") === "30" ? "treinta (30)" : "sesenta (60)"} días, conforme al Código del Trabajo.</p>
<p><strong>SÉPTIMA – Duración.</strong> El presente contrato se celebra ${duracion}, con fecha de inicio el ${str(d, "inicio") ? formatFecha(str(d, "inicio")) : '<span class="ph">[FECHA DE INICIO]</span>'}.</p>
<p><strong>OCTAVA – Seguridad social.</strong> EL EMPLEADOR inscribirá a EL TRABAJADOR en el Instituto de Previsión Social y lo registrará ante el Ministerio de Trabajo, Empleo y Seguridad Social, realizando los aportes que correspondan.</p>
<p><strong>NOVENA – Confidencialidad.</strong> EL TRABAJADOR guardará reserva sobre la información de EL EMPLEADOR a la que acceda con motivo de su trabajo, incluida la que conozca por su condición de familiar de los propietarios, durante la vigencia del contrato y después de su terminación.</p>
<p><strong>DÉCIMA – Evaluación de desempeño.</strong> EL TRABAJADOR será evaluado con los mismos criterios y periodicidad que el resto del personal.</p>
${str(d, "adicionales") ? `<p><strong>DÉCIMA PRIMERA – Estipulaciones adicionales.</strong> ${esc(str(d, "adicionales"))}</p>` : ""}
<p>En prueba de conformidad, se firman dos ejemplares de un mismo tenor y a un solo efecto, quedando uno en poder de cada parte.</p>
${firmas([
  { nombre: str(d, "representante") ? `${esc(str(d, "representante"))}<br/><span class="cargo">por ${esc(ctx.empresa.denominacion)}</span>` : "&nbsp;", cargo: "EL EMPLEADOR" },
  { nombre: str(d, "trabajador") ? esc(str(d, "trabajador")) : "&nbsp;", cargo: "EL TRABAJADOR" },
])}
<p class="nota">Antes de firmar: aprobá la contratación con el acta de la plantilla FAM-04 y respetá la política de familiares (plantilla FAM-03). No pagues "sueldos" a familiares que en la práctica no trabajan.</p>`;
  },
};

const contratoServicios: Plantilla = {
  key: "contrato-servicios-familiar",
  numero: "FAM-02",
  grupo: "familia",
  titulo: "Contrato de prestación de servicios con un familiar independiente",
  descripcion: "Para el familiar profesional (contador, arquitecto, diseñador) que factura con su propio RUC, sin horario ni subordinación.",
  tipos: TODOS_TIPOS,
  campos: [
    ...CAMPOS_EMPLEADOR,
    { key: "prestador", label: "Nombre del prestador", type: "text", required: true },
    { key: "prestador_ci", label: "C.I.", type: "text" },
    { key: "prestador_ruc", label: "RUC", type: "text", required: true },
    { key: "profesion", label: "Profesión", type: "text" },
    { key: "prestador_domicilio", label: "Domicilio", type: "text" },
    { key: "parentesco", label: "Parentesco", type: "text", required: true },
    { key: "fecha_aprobacion", label: "Fecha en que se aprobó la contratación", type: "date" },
    { key: "comparacion", label: "Comparación con el mercado", type: "text", default: () => "luego de comparar las condiciones con dos cotizaciones de mercado" },
    { key: "servicios", label: "Servicios y entregables (uno por línea)", type: "textarea", required: true },
    { key: "honorarios", label: "Honorarios (Gs.)", type: "number", required: true },
    {
      key: "base_honorarios",
      label: "Base de los honorarios",
      type: "select",
      options: [
        { value: "por mes de servicio", label: "Por mes" },
        { value: "por entregable", label: "Por entregable" },
        { value: "por hora", label: "Por hora" },
      ],
      default: () => "por mes de servicio",
    },
    { key: "dias_pago", label: "Días para pagar la factura", type: "number", default: () => "10" },
    { key: "desde", label: "Vigente desde", type: "date", required: true },
    { key: "hasta", label: "Vigente hasta", type: "date", help: "Vacío = plazo indeterminado." },
    { key: "preaviso", label: "Días de preaviso para rescindir", type: "number", default: () => "30" },
    { key: "confidencialidad_anios", label: "Años de confidencialidad posteriores", type: "number", default: () => "2" },
    { key: "jurisdiccion", label: "Jurisdicción", type: "text", default: (c) => `los tribunales de la ciudad de ${c.empresa.ciudad ?? "Asunción"}` },
  ],
  tituloDoc: (d) => `Contrato de servicios — ${str(d, "prestador") || "familiar"}`,
  render: (d, ctx) => {
    const servicios = lines(d, "servicios");
    return `
${encabezado("Contrato de prestación de servicios")}
<p class="center"><strong>CONTRATO DE PRESTACIÓN DE SERVICIOS PROFESIONALES</strong></p>
<p>En la ciudad de ${ciudad(d, ctx)}, República del Paraguay, ${fechaActa(d)}, entre:</p>
<p>${partesEmpresa(d, ctx, "LA EMPRESA")}; y</p>
<p>${v(d, "prestador", "PRESTADOR")}${str(d, "prestador_ci") ? `, C.I. N° ${esc(str(d, "prestador_ci"))}` : ""}, RUC N° ${v(d, "prestador_ruc", "RUC")}${str(d, "profesion") ? `, de profesión ${esc(str(d, "profesion"))}` : ""}, con domicilio en ${v(d, "prestador_domicilio", "DOMICILIO")}, en adelante "EL PRESTADOR";</p>
<p>convienen en celebrar el presente contrato de prestación de servicios, sujeto a las siguientes cláusulas:</p>
<p><strong>PRIMERA – Vínculo familiar y conflicto de interés.</strong> EL PRESTADOR declara ser ${v(d, "parentesco", "PARENTESCO")}. La contratación fue aprobada por el órgano de administración${str(d, "fecha_aprobacion") ? ` en fecha ${formatFecha(str(d, "fecha_aprobacion"))}` : ""}, con abstención de los miembros vinculados, ${v(d, "comparacion", "COMPARACIÓN CON EL MERCADO")}.</p>
<p><strong>SEGUNDA – Objeto.</strong> EL PRESTADOR se obliga a prestar a LA EMPRESA los siguientes servicios profesionales:</p>
<ul>${servicios.length ? servicios.map((s) => `<li>${esc(s)}</li>`).join("") : '<li><span class="ph">[SERVICIOS Y ENTREGABLES]</span></li>'}</ul>
<p><strong>TERCERA – Autonomía.</strong> EL PRESTADOR ejecutará los servicios con autonomía técnica y organizativa, con sus propios medios, sin sujeción a horario ni subordinación jurídica respecto de LA EMPRESA, pudiendo prestar servicios a terceros. Nada de lo dispuesto en este contrato crea una relación laboral entre las partes.</p>
<p><strong>CUARTA – Honorarios.</strong> LA EMPRESA pagará a EL PRESTADOR honorarios de ${str(d, "honorarios") ? montoGs(str(d, "honorarios")) : '<span class="ph">[MONTO]</span>'} ${esc(str(d, "base_honorarios") || "por mes de servicio")}, más el IVA que corresponda, contra presentación de la factura legal, dentro de los ${v(d, "dias_pago", "__")} días de recibida.</p>
<p><strong>QUINTA – Plazo.</strong> El contrato rige desde el ${str(d, "desde") ? formatFecha(str(d, "desde")) : '<span class="ph">[FECHA]</span>'} ${str(d, "hasta") ? `hasta el ${formatFecha(str(d, "hasta"))}` : "por tiempo indeterminado"}. Cualquiera de las partes podrá rescindirlo sin causa con un preaviso escrito de ${v(d, "preaviso", "__")} días, abonándose los servicios efectivamente prestados hasta esa fecha.</p>
<p><strong>SEXTA – Confidencialidad.</strong> EL PRESTADOR guardará reserva sobre toda la información de LA EMPRESA a la que acceda con motivo de los servicios, durante la vigencia del contrato y por ${v(d, "confidencialidad_anios", "__")} años después de su terminación.</p>
<p><strong>SÉPTIMA – Propiedad de los trabajos.</strong> Los informes, documentos y demás resultados producidos por EL PRESTADOR en ejecución de este contrato serán de propiedad de LA EMPRESA una vez pagados los honorarios correspondientes.</p>
<p><strong>OCTAVA – Evaluación.</strong> LA EMPRESA evaluará los servicios con los mismos criterios que aplica a sus proveedores externos, a cargo de una persona sin vínculo familiar con EL PRESTADOR.</p>
<p><strong>NOVENA – Obligaciones tributarias.</strong> EL PRESTADOR es el único responsable del cumplimiento de sus obligaciones tributarias y previsionales derivadas de los honorarios percibidos.</p>
<p><strong>DÉCIMA – Jurisdicción.</strong> Para cualquier controversia, las partes se someten a ${v(d, "jurisdiccion", "JURISDICCIÓN")}, renunciando a cualquier otra.</p>
<p>En prueba de conformidad, se firman dos ejemplares de un mismo tenor.</p>
${firmas([
  { nombre: str(d, "representante") ? `${esc(str(d, "representante"))}<br/><span class="cargo">por ${esc(ctx.empresa.denominacion)}</span>` : "&nbsp;", cargo: "LA EMPRESA" },
  { nombre: str(d, "prestador") ? esc(str(d, "prestador")) : "&nbsp;", cargo: "EL PRESTADOR" },
])}
<p class="nota">Este contrato no sirve para "disfrazar" una relación laboral: si en la práctica el familiar cumple horario, recibe órdenes y cobra un monto fijo mensual, la ley puede presumir un contrato de trabajo (Código del Trabajo, art. 48). En ese caso usá la plantilla FAM-01.</p>`;
  },
};

const politicaFamiliares: Plantilla = {
  key: "politica-familiares",
  numero: "FAM-03",
  grupo: "familia",
  titulo: "Política de incorporación y remuneración de familiares",
  descripcion: "Reglamento interno corto: quién puede entrar, con qué requisitos, cómo se paga y quién evalúa. Primer paso hacia un protocolo familiar.",
  tipos: TODOS_TIPOS,
  campos: [
    { key: "fecha", label: "Fecha de aprobación", type: "date", required: true },
    {
      key: "organo",
      label: "Aprobada por",
      type: "select",
      options: [
        { value: "la Asamblea de Accionistas", label: "Asamblea de accionistas" },
        { value: "el Directorio", label: "Directorio" },
        { value: "la reunión de socios", label: "Reunión de socios (S.R.L.)" },
        { value: "el órgano de administración", label: "Órgano de administración (EAS)" },
      ],
      default: (c) => (c.empresa.tipo === "srl" ? "la reunión de socios" : "la Asamblea de Accionistas"),
    },
    {
      key: "alcance",
      label: "Quiénes son \"familiares\"",
      type: "textarea",
      default: () => "los cónyuges o convivientes de los accionistas, sus descendientes, ascendientes, hermanos y sobrinos, y los cónyuges de todos ellos",
    },
    {
      key: "requisitos",
      label: "Requisitos de ingreso (uno por línea)",
      type: "textarea",
      default: () =>
        "Tener título universitario o terciario relacionado con el puesto, o experiencia equivalente.\nAcreditar al menos dos años de experiencia laboral fuera de la empresa familiar.\nPostularse a un puesto vacante descrito por escrito.\nSer evaluado sin participación decisiva de sus padres o cónyuge.",
    },
    { key: "pasantias", label: "Permitir pasantías de estudiantes", type: "checkbox", default: () => true },
    { key: "pasantia_meses", label: "Duración máxima de la pasantía (meses)", type: "number", default: () => "3", showIf: "pasantias" },
    { key: "anios_gerencia", label: "Años en la empresa para acceder a cargos gerenciales", type: "number", default: () => "3" },
    { key: "aprueba", label: "Quién aprueba excepciones y pagos extra", type: "text", default: (c) => (c.empresa.tipo === "srl" ? "la reunión de socios" : "el Directorio") },
    { key: "desacuerdos", label: "Cómo se resuelven desacuerdos", type: "text", default: () => "se tratarán primero en una reunión familiar y, si no se resuelven, se someterán a mediación" },
    { key: "revision_anios", label: "Revisión cada (años)", type: "number", default: () => "2" },
  ],
  tituloDoc: (d) => `Política de familiares ${str(d, "fecha") ? formatFecha(str(d, "fecha")) : ""}`.trim(),
  render: (d, ctx) => {
    const req = lines(d, "requisitos");
    let n = 5;
    const pas = on(d, "pasantias")
      ? `<p><strong>${++n}. Pasantías.</strong> Los familiares estudiantes podrán realizar pasantías por un plazo máximo de ${v(d, "pasantia_meses", "__")} meses, con tareas y horario definidos por escrito y respetando la normativa laboral aplicable a su edad.</p>`
      : "";
    const sec = (t: string, body: string) => `<p><strong>${++n}. ${t}.</strong> ${body}</p>`;
    return `
${encabezado("Política de familiares")}
<p class="center"><strong>${esc(ctx.empresa.denominacion.toUpperCase())}</strong><br/><strong>POLÍTICA DE INCORPORACIÓN Y REMUNERACIÓN DE FAMILIARES</strong><br/>Aprobada por ${esc(str(d, "organo") || "[ÓRGANO]")} en fecha ${str(d, "fecha") ? formatFecha(str(d, "fecha")) : '<span class="ph">[FECHA]</span>'}</p>
<p><strong>1. Objetivo.</strong> Establecer reglas claras, objetivas e iguales para la incorporación, remuneración, evaluación y salida de los familiares de los propietarios que trabajen en la empresa, para proteger tanto a la empresa como a las relaciones familiares.</p>
<p><strong>2. Alcance.</strong> Se consideran "familiares" a los fines de esta política: ${v(d, "alcance", "ALCANCE")}.</p>
<p><strong>3. Principio general.</strong> Trabajar en la empresa no es un derecho derivado de ser familiar o propietario. Los familiares se incorporan cuando existe un puesto vacante real y reúnen sus requisitos, en igualdad de condiciones con candidatos externos.</p>
<p><strong>4. Requisitos de ingreso.</strong> Para incorporarse, el familiar deberá:</p>
<ul>${req.map((r) => `<li>${esc(r)}</li>`).join("") || '<li><span class="ph">[REQUISITOS]</span></li>'}</ul>
<p><strong>5. Remuneración.</strong> La remuneración de cada familiar será la que corresponda a la banda salarial del puesto, igual a la que se pagaría a un profesional externo con la misma experiencia. El sueldo retribuye el trabajo y los dividendos retribuyen la propiedad: se pagan y registran por separado. Ningún familiar recibirá pagos, adelantos o beneficios fuera de su contrato y de esta política sin aprobación de ${v(d, "aprueba", "ÓRGANO")}.</p>
${pas}
${sec("Reporte y evaluación", "Ningún familiar reportará directamente a su padre, madre, cónyuge o hermano, salvo aprobación expresa cuando no exista alternativa. Los familiares serán evaluados con los mismos criterios y periodicidad que el resto del personal.")}
${sec("Formalización", "Todo familiar que trabaje en la empresa tendrá contrato de trabajo escrito e inscripción en el Instituto de Previsión Social o, si es independiente, contrato de prestación de servicios con factura. No se admiten relaciones informales.")}
${sec("Cargos gerenciales", `El acceso de familiares a cargos gerenciales requerirá al menos ${v(d, "anios_gerencia", "__")} años en la empresa y evaluación favorable de desempeño. La designación de autoridades corresponde al órgano que fijen los estatutos.`)}
${sec("Desempeño insuficiente y salida", "Si un familiar no cumple con las expectativas del puesto, se aplicarán los mismos procedimientos que al resto del personal, respetando la legislación laboral. La desvinculación laboral no afecta su condición de accionista o socio ni sus derechos como tal.")}
${sec("Conflictos de interés", "Toda contratación de un familiar como empleado o proveedor será aprobada con abstención de los miembros vinculados y quedará registrada en acta.")}
${sec("Resolución de desacuerdos", `Los desacuerdos sobre la aplicación de esta política ${v(d, "desacuerdos", "PROCEDIMIENTO")}.`)}
${sec("Vigencia y revisión", `Esta política rige desde su aprobación y será revisada cada ${v(d, "revision_anios", "__")} años.`)}
<p style="margin-top:24pt"><strong>Constancia de recepción:</strong> Declaro haber recibido y leído esta política y me comprometo a respetarla.</p>
${firmas([{ nombre: "&nbsp;", cargo: "Nombre, C.I. y fecha" }])}
<p class="nota">Es un documento de gobierno interno: su fuerza viene de la aprobación societaria. Ninguna regla puede contradecir el Código del Trabajo (por ejemplo, el preaviso y las indemnizaciones de ley). Entregá una copia firmada a cada familiar que trabaje o quiera trabajar en la empresa.</p>`;
  },
};


// ─── Poderes: cartas poder simples ──────────────────────────────────────
// Solo para mandatos administrativos simples. Los poderes que la ley exige
// otorgar por escritura pública NO se resuelven con estos modelos.

const AVISO_ESCRITURA =
  "Este modelo sirve solo para mandatos administrativos simples. Los poderes generales de administración, los poderes para actos de disposición (vender, gravar o donar bienes) y los poderes para juicio deben otorgarse por escritura pública ante escribano. Ante la duda, consultá con un profesional.";

const NOTA_ESCRITURA = `<p class="nota"><strong>Importante:</strong> ${esc(AVISO_ESCRITURA)} Muchas instituciones piden además que la firma de quien otorga esté certificada por escribano.</p>`;

function camposCartaPoder(facultades: string[]): Campo[] {
  return [
    ...CAMPOS_EMPLEADOR,
    { key: "apoderado", label: "Apoderado (nombre completo)", type: "text", required: true },
    { key: "apoderado_ci", label: "C.I. del apoderado", type: "text", required: true },
    { key: "apoderado_domicilio", label: "Domicilio del apoderado", type: "text" },
    { key: "facultades", label: "Facultades (una por línea)", type: "textarea", required: true, default: () => facultades.join("\n"), help: "Sé concreto: el poder alcanza solo a lo que está escrito." },
    { key: "vence", label: "Vigente hasta", type: "date", help: "Vacío = hasta su revocación por escrito. Recomendado: un plazo concreto (por ejemplo, un año)." },
  ];
}

function apoderadoTexto(d: Datos): string {
  return `${v(d, "apoderado", "APODERADO")}, con C.I. N° ${v(d, "apoderado_ci", "C.I.")}${str(d, "apoderado_domicilio") ? `, domiciliado/a en ${esc(str(d, "apoderado_domicilio"))}` : ""}, en adelante "el Apoderado"`;
}

function vigenciaTexto(d: Datos): string {
  return str(d, "vence")
    ? `hasta el ${formatFecha(str(d, "vence"))} inclusive, salvo revocación anterior comunicada por escrito`
    : "hasta su revocación expresa, comunicada por escrito al Apoderado y a la institución ante la cual se haya presentado";
}

function fechaLugar(d: Datos, ctx: Contexto): string {
  return `<p class="right">${ciudad(d, ctx)}, ${str(d, "fecha") ? formatFechaLarga(str(d, "fecha")) : '<span class="ph">[FECHA]</span>'}</p>`;
}

function renderCartaPoder(d: Datos, ctx: Contexto, opts: { titulo: string; ante: string; limites: string; nota?: string }): string {
  const fs = lines(d, "facultades");
  return `
${encabezado("Carta poder")}
${fechaLugar(d, ctx)}
<p class="center"><strong>CARTA PODER — ${esc(opts.titulo.toUpperCase())}</strong></p>
<p>Por la presente, ${partesEmpresa(d, ctx, "la Poderdante")}, otorga PODER ESPECIAL a favor de ${apoderadoTexto(d)}, para que, en nombre y representación de la Poderdante, realice ante ${opts.ante} las siguientes gestiones:</p>
<ol>${(fs.length ? fs : ["[FACULTADES]"]).map((f) => `<li>${esc(f)}</li>`).join("")}</ol>
<p>${opts.limites}</p>
<p>El presente poder tendrá vigencia ${vigenciaTexto(d)}. La Poderdante se reserva el derecho de revocarlo en cualquier momento.</p>
<p>El Apoderado acepta el mandato y se compromete a rendir cuentas de su gestión y a devolver la documentación que reciba para el cumplimiento del encargo.</p>
${firmas([
  { nombre: str(d, "representante") ? esc(str(d, "representante")) : "&nbsp;", cargo: `${str(d, "representante_cargo") || "Representante"} — por ${ctx.empresa.denominacion}` },
  { nombre: str(d, "apoderado") ? esc(str(d, "apoderado")) : "&nbsp;", cargo: "Apoderado — acepto el mandato" },
])}
${NOTA_ESCRITURA}
${opts.nota ? `<p class="nota">${opts.nota}</p>` : ""}`;
}

function registroCartaPoder(instrumento: string) {
  return (d: Datos): PoderPrefill => ({
    apoderado: str(d, "apoderado"),
    apoderado_documento: str(d, "apoderado_ci") || null,
    tipo: "administrativo",
    facultades: lines(d, "facultades").join("\n") || null,
    fecha_otorgamiento: str(d, "fecha"),
    instrumento,
    fecha_vencimiento: str(d, "vence") || null,
    duracion_texto: str(d, "vence") ? null : "Hasta su revocación por escrito",
  });
}

const LIMITES_BASE =
  "Este poder se limita a las gestiones enumeradas. No comprende la facultad de vender, gravar ni disponer de bienes, percibir sumas de dinero, contraer obligaciones, reconocer deudas, transigir ni representar a la Poderdante en juicio.";

const cartaPoderAdministrativa: Plantilla = {
  key: "pod-carta-administrativa",
  numero: "POD-02",
  grupo: "poderes",
  titulo: "Carta poder simple para trámites administrativos",
  descripcion: "Autoriza a una persona a presentar y retirar documentos y hacer seguimiento de trámites a nombre de la empresa.",
  tipos: TODOS_TIPOS,
  aviso: AVISO_ESCRITURA,
  campos: [
    ...camposCartaPoder([
      "Presentar y retirar notas, solicitudes, formularios y documentos.",
      "Solicitar y retirar certificados, constancias, copias y comprobantes a nombre de la Poderdante.",
      "Realizar el seguimiento de expedientes y tomar vista de ellos.",
      "Firmar cargos de recepción, constancias de presentación y notificaciones.",
    ]),
    { key: "ante", label: "Ante quién", type: "text", default: () => "reparticiones públicas, municipalidades y entidades privadas", help: "Ej.: la Municipalidad de Asunción y la ANDE." },
  ],
  tituloDoc: (d) => `Carta poder (trámites administrativos) — ${str(d, "apoderado") || "apoderado"}`,
  render: (d, ctx) => renderCartaPoder(d, ctx, { titulo: "Trámites administrativos", ante: v(d, "ante", "INSTITUCIONES"), limites: LIMITES_BASE }),
  registroPoder: registroCartaPoder("Carta poder simple — trámites administrativos"),
};

const cartaPoderDnit: Plantilla = {
  key: "pod-carta-dnit",
  numero: "POD-03",
  grupo: "poderes",
  titulo: "Carta poder para gestiones ante la DNIT (ex SET)",
  descripcion: "Para presentar notas, retirar constancias y certificados y hacer seguimiento de trámites tributarios.",
  tipos: TODOS_TIPOS,
  aviso: AVISO_ESCRITURA,
  campos: camposCartaPoder([
    "Presentar notas, solicitudes y documentos y retirar las respuestas, constancias y resoluciones que se emitan.",
    "Solicitar y retirar la constancia de RUC, el certificado de cumplimiento tributario y demás constancias a nombre de la Poderdante.",
    "Realizar gestiones relacionadas con el timbrado de comprobantes y la actualización de datos del RUC.",
    "Tomar vista de expedientes, notificarse de actuaciones y presentar la documentación que se requiera.",
  ]),
  tituloDoc: (d) => `Carta poder (DNIT) — ${str(d, "apoderado") || "apoderado"}`,
  render: (d, ctx) =>
    renderCartaPoder(d, ctx, {
      titulo: "Gestiones ante la DNIT",
      ante: "la Dirección Nacional de Ingresos Tributarios (DNIT)",
      limites: `${LIMITES_BASE} Tampoco autoriza a acogerse a planes de facilidades de pago, renunciar a recursos ni consentir determinaciones tributarias.`,
      nota: "La clave de acceso a los sistemas en línea de la DNIT (Marangatu) es personal: esta carta poder no autoriza a compartirla. Para algunos trámites la DNIT puede exigir firma certificada o un poder por escritura pública: verificá los requisitos vigentes del trámite antes de presentarla.",
    }),
  registroPoder: registroCartaPoder("Carta poder simple — gestiones ante la DNIT"),
};

const cartaPoderIpsMtess: Plantilla = {
  key: "pod-carta-ips-mtess",
  numero: "POD-04",
  grupo: "poderes",
  titulo: "Carta poder para trámites ante IPS y MTESS",
  descripcion: "Para gestiones patronales ante el Instituto de Previsión Social y el Ministerio de Trabajo, Empleo y Seguridad Social.",
  tipos: TODOS_TIPOS,
  aviso: AVISO_ESCRITURA,
  campos: camposCartaPoder([
    "Realizar ante el Instituto de Previsión Social (IPS) gestiones de inscripción y actualización de datos patronales, y de altas, bajas y modificaciones de asegurados.",
    "Solicitar y retirar constancias, certificados y estados de cuenta patronales ante el IPS.",
    "Realizar ante el Ministerio de Trabajo, Empleo y Seguridad Social (MTESS) gestiones de inscripción y actualización en el registro obrero-patronal, presentar planillas y documentos laborales y retirar constancias.",
    "Tomar vista de expedientes, notificarse y presentar la documentación que se requiera en trámites administrativos.",
  ]),
  tituloDoc: (d) => `Carta poder (IPS / MTESS) — ${str(d, "apoderado") || "apoderado"}`,
  render: (d, ctx) =>
    renderCartaPoder(d, ctx, {
      titulo: "Trámites ante IPS y MTESS",
      ante: "el Instituto de Previsión Social (IPS) y el Ministerio de Trabajo, Empleo y Seguridad Social (MTESS)",
      limites: `${LIMITES_BASE} Tampoco autoriza a conciliar ni a asumir compromisos en audiencias o inspecciones laborales.`,
      nota: "Las claves de los sistemas en línea del IPS y del MTESS son personales: esta carta poder no autoriza a compartirlas. Cada institución puede pedir requisitos propios (firma certificada, fotocopia de C.I., formularios): verificalos antes de presentarla.",
    }),
  registroPoder: registroCartaPoder("Carta poder simple — trámites ante IPS y MTESS"),
};

const revocacionCartaPoder: Plantilla = {
  key: "pod-revocacion",
  numero: "POD-05",
  grupo: "poderes",
  titulo: "Revocación de carta poder",
  descripcion: "Deja sin efecto una carta poder simple y se notifica al apoderado y a las instituciones donde se presentó.",
  tipos: TODOS_TIPOS,
  aviso:
    "Este modelo revoca cartas poder simples. Si el poder se otorgó por escritura pública, lo recomendable es revocarlo también por escritura pública ante escribano y anotar la revocación donde el poder se haya inscripto.",
  campos: [
    ...CAMPOS_EMPLEADOR,
    { key: "apoderado", label: "Apoderado cuyo poder se revoca", type: "text", required: true },
    { key: "apoderado_ci", label: "C.I. del apoderado", type: "text" },
    { key: "poder_fecha", label: "Fecha del poder que se revoca", type: "date", required: true },
    { key: "poder_descripcion", label: "Poder que se revoca", type: "text", default: () => "carta poder simple", help: "Ej.: carta poder simple para gestiones ante la DNIT." },
    { key: "efecto", label: "Revocado desde", type: "date", help: "Vacío = desde la fecha de esta nota." },
    { key: "devolver", label: "Pedir la devolución del original y de la documentación", type: "checkbox", default: () => true },
    { key: "notificar", label: "Instituciones a notificar (una por línea)", type: "textarea", help: "Donde se presentó el poder: la revocación debe comunicarse a cada una." },
  ],
  tituloDoc: (d) => `Revocación de carta poder — ${str(d, "apoderado") || "apoderado"}`,
  render: (d, ctx) => {
    const efecto = str(d, "efecto") || str(d, "fecha");
    const inst = lines(d, "notificar");
    return `
${encabezado("Revocación de carta poder")}
${fechaLugar(d, ctx)}
<p>Señor/a<br/>${v(d, "apoderado", "APODERADO")}${str(d, "apoderado_ci") ? `<br/>C.I. N° ${esc(str(d, "apoderado_ci"))}` : ""}<br/>Presente</p>
<p><strong>Ref.: Revocación de poder</strong></p>
<p>Por la presente, ${partesEmpresa(d, ctx, "la Poderdante")}, le comunica que REVOCA, con efecto a partir del ${efecto ? formatFecha(efecto) : '<span class="ph">[FECHA]</span>'}, el poder otorgado a su favor en fecha ${str(d, "poder_fecha") ? formatFecha(str(d, "poder_fecha")) : '<span class="ph">[FECHA DEL PODER]</span>'}, instrumentado mediante ${v(d, "poder_descripcion", "PODER")}.</p>
<p>A partir de esa fecha, usted deja de estar facultado/a para actuar en nombre y representación de la Poderdante en las gestiones comprendidas en dicho poder.${on(d, "devolver") ? " Le solicitamos devolver el original del poder y toda la documentación de la Poderdante que obre en su poder dentro de los cinco (5) días hábiles de recibida la presente." : ""}</p>
${inst.length ? `<p>Esta revocación será comunicada a:</p><ul>${inst.map((i) => `<li>${esc(i)}</li>`).join("")}</ul>` : ""}
<p>Atentamente,</p>
${firmas([
  { nombre: str(d, "representante") ? esc(str(d, "representante")) : "&nbsp;", cargo: `${str(d, "representante_cargo") || "Representante"} — por ${ctx.empresa.denominacion}` },
  { nombre: str(d, "apoderado") ? esc(str(d, "apoderado")) : "&nbsp;", cargo: "Recibí — firma, aclaración y fecha" },
])}
<p class="nota">Notificá la revocación al apoderado (guardá su recibo) y a cada institución o tercero ante quien se presentó el poder: frente a quienes no la conozcan, la revocación podría no serles oponible. Después, marcá el poder como revocado en Documentos › Poderes.</p>`;
  },
  revocacionPoder: (d) => ({ apoderado: str(d, "apoderado"), documento: str(d, "apoderado_ci"), fecha: str(d, "efecto") || str(d, "fecha") }),
};

// ─── SEPRELAD (PLA/FT) ──────────────────────────────────────────────────
// Para empresas que son sujetos obligados (Ley 1015/97, art. 13). Nunca
// incluyen contenido de un ROS: ese reporte es confidencial y va solo por SIRO.

const TODAS: TipoSociedad[] = ["sa", "eas", "srl"];

const SECTOR_OPCIONES = [
  { value: "201", label: "Inmobiliaria (Res. 201/2020)" },
  { value: "176", label: "Remesas (Res. 176/2020)" },
  { value: "490", label: "OSFL / fundación (Res. 490/2022)" },
];

function baseSector(d: Datos, art: Record<string, string>): string {
  const s = str(d, "sector") || "201";
  const norma = s === "176" ? "Resolución SEPRELAD N° 176/2020" : s === "490" ? "Resolución SEPRELAD N° 490/2022" : "Resolución SEPRELAD N° 201/2020";
  return `${norma}${art[s] ? `, ${art[s]}` : ""}`;
}

function organo(ctx: Contexto): string {
  return ctx.empresa.tipo === "eas" ? "ÓRGANO DE ADMINISTRACIÓN" : ctx.empresa.tipo === "srl" ? "GERENCIA" : "DIRECTORIO";
}

const actaOficialCumplimiento: Plantilla = {
  key: "sep-acta-oficial-cumplimiento",
  numero: "SEP-01",
  grupo: "seprelad",
  titulo: "Acta de designación del oficial de cumplimiento",
  descripcion: "La máxima autoridad designa al oficial de cumplimiento titular (y su interino), con autonomía y recursos.",
  tipos: TODAS,
  campos: [
    ...CAMPOS_BASE,
    { key: "sector", label: "Normativa que aplica", type: "select", options: SECTOR_OPCIONES, default: () => "201" },
    { key: "oc_nombre", label: "Oficial de cumplimiento titular", type: "text", required: true },
    { key: "oc_ci", label: "C.I. del titular", type: "text" },
    { key: "oc_cargo", label: "Cargo / jerarquía en la empresa", type: "text", help: "Debe tener jerarquía suficiente y reportar a la máxima autoridad." },
    { key: "interino_nombre", label: "Oficial de cumplimiento interino", type: "text" },
    { key: "interino_ci", label: "C.I. del interino", type: "text" },
    { key: "recursos", label: "Recursos asignados", type: "text", default: () => "los recursos humanos, técnicos y presupuestarios necesarios para el cumplimiento de sus funciones" },
    { key: "firmantes", label: "Quienes firman (uno por línea)", type: "textarea", default: presidenteDefault },
  ],
  tituloDoc: (d) => `Acta — designación del oficial de cumplimiento ${str(d, "oc_nombre")}`.trim(),
  render: (d, ctx) => {
    const fs = lines(d, "firmantes");
    return `
${encabezado("Designación del oficial de cumplimiento")}
<p class="center"><strong>ACTA DE ${organo(ctx)} N° ${v(d, "numero_acta", "__")}</strong></p>
<p>En la ciudad de ${ciudad(d, ctx)}, República del Paraguay, ${fechaActa(d)}, siendo las ${horaTexto(str(d, "hora"))}, se reúnen en la sede social de ${denom(ctx)}${ctx.empresa.ruc ? `, RUC ${esc(ctx.empresa.ruc)}` : ""}, sita en ${domicilio(ctx)}, los miembros que firman al pie, con quórum suficiente, para tratar el siguiente orden del día:</p>
<p><strong>1. Designación del oficial de cumplimiento.</strong> En su carácter de sujeto obligado conforme al artículo 13 de la Ley N° 1015/97 y a la ${baseSector(d, { "201": "artículos 7, 8 y 10", "176": "artículos 13 y 14", "490": "artículos 25 a 29" })}, se resuelve por unanimidad designar como oficial de cumplimiento titular a ${v(d, "oc_nombre", "NOMBRE")}${str(d, "oc_ci") ? `, C.I. N° ${esc(str(d, "oc_ci"))}` : ""}${str(d, "oc_cargo") ? `, quien ocupa el cargo de ${esc(str(d, "oc_cargo"))}` : ""}.${str(d, "interino_nombre") ? ` Se designa como oficial de cumplimiento interino, para los casos de ausencia, renuncia o remoción del titular, a ${esc(str(d, "interino_nombre"))}${str(d, "interino_ci") ? `, C.I. N° ${esc(str(d, "interino_ci"))}` : ""}.` : ""}</p>
<p><strong>2. Autonomía y recursos.</strong> El oficial de cumplimiento reportará directamente a este órgano, actuará con autonomía e independencia en el ejercicio de sus funciones y contará con ${v(d, "recursos", "RECURSOS")}. Tendrá acceso irrestricto a la información de la empresa necesaria para su labor.</p>
<p><strong>3. Declaración.</strong> El designado declara conocer las funciones del cargo y no encontrarse alcanzado por las inhabilidades previstas en la normativa aplicable.</p>
<p><strong>4. Comunicación a la SEPRELAD.</strong> Se instruye comunicar la presente designación a la Secretaría de Prevención de Lavado de Dinero o Bienes (SEPRELAD) dentro de los cinco (5) días hábiles siguientes, con los datos exigidos por la normativa.</p>
<p>No habiendo más asuntos que tratar, se levanta la sesión.</p>
${firmas([...(fs.length ? fs : [""]).map((f) => ({ nombre: f ? esc(f) : "&nbsp;", cargo: "Por la máxima autoridad" })), { nombre: str(d, "oc_nombre") ? esc(str(d, "oc_nombre")) : "&nbsp;", cargo: "Acepto el cargo — Oficial de cumplimiento" }])}`;
  },
};

const notaOficialCumplimiento: Plantilla = {
  key: "sep-nota-oficial-cumplimiento",
  numero: "SEP-02",
  grupo: "seprelad",
  titulo: "Nota a SEPRELAD: oficial de cumplimiento",
  descripcion: "Comunica la designación, el cambio de datos, la remoción o el interino del oficial de cumplimiento.",
  tipos: TODAS,
  campos: [
    { key: "fecha", label: "Fecha de la nota", type: "date", required: true },
    { key: "ciudad", label: "Ciudad", type: "text", default: (c) => c.empresa.ciudad ?? "Asunción" },
    { key: "sector", label: "Normativa que aplica", type: "select", options: SECTOR_OPCIONES, default: () => "201" },
    {
      key: "motivo",
      label: "Motivo",
      type: "select",
      options: [
        { value: "designacion", label: "Designación" },
        { value: "cambio", label: "Cambio de datos" },
        { value: "remocion", label: "Remoción" },
        { value: "interino", label: "Oficial interino" },
      ],
      default: () => "designacion",
    },
    { key: "oc_nombre", label: "Nombre y apellido", type: "text", required: true },
    { key: "oc_documento", label: "Tipo y N° de documento", type: "text" },
    { key: "oc_nacionalidad", label: "Nacionalidad", type: "text", default: () => "paraguaya" },
    { key: "oc_cargo", label: "Cargo en la empresa", type: "text" },
    { key: "oc_telefono", label: "Teléfono", type: "text" },
    { key: "oc_email", label: "Correo electrónico", type: "text" },
    { key: "oc_domicilio", label: "Domicilio real", type: "text" },
    { key: "fecha_acto", label: "Fecha del acta que lo resolvió", type: "date" },
    { key: "motivos_remocion", label: "Motivos de la remoción", type: "textarea", help: "Solo para remoción." },
    { key: "periodo_ausencia", label: "Período de ausencia del titular", type: "text", help: "Solo para interino." },
    { key: "firmante", label: "Representante legal que firma", type: "text", default: presidenteDefault },
  ],
  tituloDoc: (d) => `Nota a SEPRELAD — ${str(d, "motivo") || "designación"} del oficial de cumplimiento`,
  render: (d, ctx) => {
    const motivo = str(d, "motivo") || "designacion";
    const asunto = { designacion: "Comunicación de designación", cambio: "Comunicación de cambio de datos", remocion: "Comunicación de remoción", interino: "Comunicación de oficial de cumplimiento interino" }[motivo];
    const art = baseSector(d, { "201": "artículo 10", "176": "artículo 14", "490": "artículos 27 a 29" });
    return `
${encabezado(`${asunto} del oficial de cumplimiento`)}
<p class="right">${ciudad(d, ctx)}, ${str(d, "fecha") ? formatFecha(str(d, "fecha")) : '<span class="ph">[FECHA]</span>'}</p>
<p>Señor/a Ministro/a Secretario/a Ejecutivo/a<br/>Secretaría de Prevención de Lavado de Dinero o Bienes (SEPRELAD)<br/>Presente</p>
<p><strong>Ref.: ${esc(asunto ?? "")} del oficial de cumplimiento — ${esc(ctx.empresa.denominacion)}${ctx.empresa.ruc ? `, RUC ${esc(ctx.empresa.ruc)}` : ""}</strong></p>
<p>Me dirijo a usted, en representación de ${denom(ctx)}, con domicilio en ${domicilio(ctx)}, en cumplimiento de la ${art}, a fin de ${
      motivo === "remocion"
        ? `comunicar la remoción de ${v(d, "oc_nombre", "NOMBRE")} como oficial de cumplimiento, resuelta por la máxima autoridad${str(d, "fecha_acto") ? ` en fecha ${formatFecha(str(d, "fecha_acto"))}` : ""}, por los siguientes motivos: ${v(d, "motivos_remocion", "MOTIVOS")}.`
        : motivo === "interino"
          ? `comunicar que ${v(d, "oc_nombre", "NOMBRE")} asume como oficial de cumplimiento interino durante ${v(d, "periodo_ausencia", "PERÍODO DE AUSENCIA DEL TITULAR")}.`
          : motivo === "cambio"
            ? `comunicar la actualización de los datos del oficial de cumplimiento, que quedan como se detalla a continuación.`
            : `comunicar la designación de ${v(d, "oc_nombre", "NOMBRE")} como oficial de cumplimiento${str(d, "fecha_acto") ? `, resuelta en fecha ${formatFecha(str(d, "fecha_acto"))}` : ""}.`
    }</p>
${
  motivo === "remocion"
    ? ""
    : `<table class="tabla"><tbody>
<tr><td>Nombre y apellido</td><td>${v(d, "oc_nombre", "NOMBRE")}</td></tr>
<tr><td>Documento</td><td>${v(d, "oc_documento", "TIPO Y N°")}</td></tr>
<tr><td>Nacionalidad</td><td>${v(d, "oc_nacionalidad", "NACIONALIDAD")}</td></tr>
<tr><td>Cargo</td><td>${v(d, "oc_cargo", "CARGO")}</td></tr>
<tr><td>Teléfono</td><td>${v(d, "oc_telefono", "TELÉFONO")}</td></tr>
<tr><td>Correo electrónico</td><td>${v(d, "oc_email", "CORREO")}</td></tr>
<tr><td>Domicilio real</td><td>${v(d, "oc_domicilio", "DOMICILIO")}</td></tr>
</tbody></table>
<p>Se adjunta la documentación respaldatoria exigida por la normativa (copia del documento, constancia de domicilio con croquis y factura de servicio público, currículum vitae${str(d, "sector") !== "201" ? " y declaración jurada de no estar alcanzado por inhabilidades" : ""}).</p>`
}
<p>Sin otro particular, saludo a usted atentamente.</p>
${firmas([{ nombre: str(d, "firmante") ? esc(str(d, "firmante")) : "&nbsp;", cargo: `Representante legal — ${ctx.empresa.denominacion}` }])}
<p class="nota">Plazo: 5 días hábiles desde la designación, el cambio o la remoción; 48 horas para el interino. Verificá el canal de presentación vigente (SIRO) antes de enviarla.</p>`;
  },
};

const debidaDiligencia: Plantilla = {
  key: "sep-debida-diligencia",
  numero: "SEP-03",
  grupo: "seprelad",
  titulo: "Formulario de debida diligencia del cliente",
  descripcion: "Conozca a su cliente: datos mínimos de persona física o jurídica, origen de fondos y beneficiarios finales.",
  tipos: TODAS,
  campos: [
    { key: "fecha", label: "Fecha", type: "date", required: true },
    {
      key: "tipo_cliente",
      label: "Tipo de cliente",
      type: "select",
      options: [
        { value: "juridica", label: "Persona jurídica" },
        { value: "fisica", label: "Persona física" },
      ],
      default: () => "juridica",
    },
    { key: "regimen", label: "Régimen", type: "select", options: [{ value: "general", label: "General" }, { value: "simplificado", label: "Simplificado" }, { value: "ampliado", label: "Ampliado (PEP, no residente, OSFL, fideicomiso)" }], default: () => "general" },
    { key: "operacion", label: "Operación o relación", type: "text", help: "Ej.: compra del lote 12, manzana B." },
  ],
  tituloDoc: (d) => `Debida diligencia — ${str(d, "tipo_cliente") === "fisica" ? "persona física" : "persona jurídica"}`,
  render: (d, ctx) => {
    const juridica = str(d, "tipo_cliente") !== "fisica";
    const fila = (l: string) => `<tr><td>${esc(l)}</td><td>&nbsp;</td></tr>`;
    const filas = juridica
      ? ["Razón social", "RUC", "Escritura de constitución y modificaciones (N°, fecha, escribano)", "Domicilio legal", "Teléfono y correo", "Representantes y apoderados (nombre, C.I., facultades)", "Actividad principal", "Origen de los fondos de la operación", "Respaldo de ingresos presentado"]
      : ["Nombre y apellido", "Documento de identidad (tipo y N°)", "Nacionalidad", "Domicilio", "Teléfono y correo", "RUC o constancia de no contribuyente", "Profesión o actividad", "Origen de los fondos de la operación", "Respaldo de ingresos presentado", "¿Es persona expuesta políticamente (PEP)? Cargo y período"];
    return `
${encabezado(`Formulario de debida diligencia — ${juridica ? "persona jurídica" : "persona física"}`)}
<p><strong>Sujeto obligado:</strong> ${denom(ctx)}${ctx.empresa.ruc ? ` · RUC ${esc(ctx.empresa.ruc)}` : ""} · <strong>Fecha:</strong> ${str(d, "fecha") ? formatFecha(str(d, "fecha")) : "____"} · <strong>Régimen:</strong> ${esc(str(d, "regimen") || "general")}</p>
<p><strong>Operación o relación:</strong> ${v(d, "operacion", "DESCRIPCIÓN")}</p>
<table class="tabla"><tbody>${filas.map(fila).join("")}</tbody></table>
${
  juridica
    ? `<p><strong>Beneficiarios finales</strong> (personas físicas que poseen al menos el 10% del capital, más del 25% de los votos, o ejercen el control por otros medios — Ley N° 6446/2019, art. 4):</p>
<table class="tabla"><thead><tr><th>Nombre y apellido</th><th>C.I.</th><th>% capital / votos</th><th>Forma de control</th></tr></thead><tbody>${"<tr><td>&nbsp;</td><td></td><td></td><td></td></tr>".repeat(3)}</tbody></table>
<p>☐ Se recibió la constancia del Registro de Beneficiarios Finales (Ministerio de Economía y Finanzas), conforme a la Resolución SEPRELAD N° 202/2020.</p>`
    : ""
}
<p><strong>Documentación recibida:</strong> ☐ Documento de identidad ☐ RUC ☐ Constancia de domicilio ☐ Respaldo de ingresos ${juridica ? "☐ Estatutos ☐ Poderes ☐ Constancia de beneficiarios finales" : ""}</p>
<p><strong>Verificación en listas</strong> (ONU, GAFI, OFAC y las que indique SEPRELAD): ☐ Sin coincidencias ☐ Con coincidencia (inmovilizar y comunicar sin demora) — Fecha: ______ Responsable: ______</p>
<p><strong>Calificación de riesgo asignada:</strong> ☐ Bajo ☐ Medio ☐ Alto — Próxima actualización del legajo: ______</p>
<p>El cliente declara bajo fe de juramento que los datos consignados son exactos y que los fondos no provienen de actividades ilícitas, y se compromete a comunicar cualquier cambio.</p>
${firmas([{ nombre: "&nbsp;", cargo: "Firma del cliente / representante" }, { nombre: "&nbsp;", cargo: `Por ${ctx.empresa.denominacion}` }])}
<p class="nota">Base: Ley N° 1015/97, arts. 14 a 18; Res. SEPRELAD 201/2020, arts. 19 a 24; Res. 176/2020, arts. 30 a 35; Res. 202/2020. Conservá el legajo 5 años desde el fin de la relación. Si hay sospecha, no completes la debida diligencia de forma que alerte al cliente.</p>`;
  },
};

const djOrigenFondos: Plantilla = {
  key: "sep-dj-origen-fondos",
  numero: "SEP-04",
  grupo: "seprelad",
  titulo: "Declaración jurada de origen de fondos y beneficiario final",
  descripcion: "El cliente declara de dónde vienen los fondos y quiénes son los beneficiarios finales.",
  tipos: TODAS,
  campos: [
    { key: "fecha", label: "Fecha", type: "date", required: true },
    { key: "ciudad", label: "Ciudad", type: "text", default: (c) => c.empresa.ciudad ?? "Asunción" },
    { key: "declarante", label: "Declarante", type: "text", required: true },
    { key: "declarante_ci", label: "C.I. del declarante", type: "text" },
    { key: "en_representacion", label: "En representación de (si es persona jurídica)", type: "text" },
    { key: "operacion", label: "Operación", type: "text", required: true },
    { key: "monto", label: "Monto (en la moneda de la operación)", type: "text" },
    { key: "origen", label: "Origen de los fondos", type: "textarea", required: true, help: "Ej.: venta de inmueble, ahorro de salarios, distribución de utilidades." },
    { key: "beneficiarios", label: "Beneficiarios finales (Nombre | C.I. | %, uno por línea)", type: "textarea" },
  ],
  tituloDoc: (d) => `DJ origen de fondos — ${str(d, "declarante")}`.trim(),
  render: (d, ctx) => {
    const bfs = lines(d, "beneficiarios").map((l) => l.split("|").map((x) => x.trim()));
    return `
${encabezado("Declaración jurada de origen de fondos y beneficiario final")}
<p>En ${ciudad(d, ctx)}, a los ${str(d, "fecha") ? formatFecha(str(d, "fecha")) : "____"}, ${v(d, "declarante", "DECLARANTE")}${str(d, "declarante_ci") ? `, con C.I. N° ${esc(str(d, "declarante_ci"))}` : ""}${str(d, "en_representacion") ? `, en representación de ${esc(str(d, "en_representacion"))}` : ""}, declara bajo fe de juramento ante ${denom(ctx)}:</p>
<p><strong>1.</strong> Que los fondos utilizados en la operación ${v(d, "operacion", "OPERACIÓN")}${str(d, "monto") ? `, por ${esc(str(d, "monto"))}` : ""}, provienen de: ${v(d, "origen", "ORIGEN DE LOS FONDOS")}, y no tienen relación con actividades ilícitas ni con el financiamiento del terrorismo.</p>
<p><strong>2.</strong> Que los beneficiarios finales, entendidos como las personas físicas que poseen al menos el 10% del capital, más del 25% de los votos o ejercen el control final (Ley N° 6446/2019, art. 4), son:</p>
<table class="tabla"><thead><tr><th>Nombre y apellido</th><th>C.I.</th><th>Participación</th></tr></thead><tbody>${(bfs.length ? bfs : [["", "", ""], ["", "", ""]]).map(([n = "", c = "", p = ""]) => `<tr><td>${esc(n) || "&nbsp;"}</td><td>${esc(c)}</td><td>${esc(p)}</td></tr>`).join("")}</tbody></table>
<p><strong>3.</strong> Que se compromete a presentar la documentación respaldatoria que se le requiera y a comunicar cualquier cambio en lo declarado.</p>
<p>La falsedad en esta declaración puede constituir delito conforme a la legislación penal vigente.</p>
${firmas([{ nombre: str(d, "declarante") ? esc(str(d, "declarante")) : "&nbsp;", cargo: "Declarante" }])}`;
  },
};

const constanciaManual: Plantilla = {
  key: "sep-constancia-manual",
  numero: "SEP-05",
  grupo: "seprelad",
  titulo: "Constancia de conocimiento del manual y el código de ética PLA/FT",
  descripcion: "Directores y empleados firman que recibieron y conocen el manual de prevención y el código de ética.",
  tipos: TODAS,
  campos: [
    { key: "fecha", label: "Fecha", type: "date", required: true },
    { key: "version", label: "Versión del manual", type: "text", default: () => "1.0" },
    { key: "personas", label: "Personas (Nombre | C.I. | Cargo, una por línea)", type: "textarea", required: true },
  ],
  tituloDoc: (d) => `Constancia de conocimiento del manual PLA/FT v${str(d, "version") || "1.0"}`,
  render: (d, ctx) => {
    const ps = lines(d, "personas").map((l) => l.split("|").map((x) => x.trim()));
    return `
${encabezado("Constancia de toma de conocimiento")}
<p>Quienes firman al pie, directores y empleados de ${denom(ctx)}, declaran haber recibido, leído y comprendido el <strong>Manual de Prevención de Lavado de Dinero y Financiamiento del Terrorismo</strong> (versión ${v(d, "version", "__")}) y el <strong>Código de Ética y Conducta</strong> de la empresa, y se comprometen a cumplirlos, incluido el deber de reserva sobre la información vinculada a la prevención.</p>
<table class="tabla"><thead><tr><th>Nombre y apellido</th><th>C.I.</th><th>Cargo</th><th>Firma</th></tr></thead><tbody>${(ps.length ? ps : [["", "", ""]]).map(([n = "", c = "", g = ""]) => `<tr><td>${esc(n) || "&nbsp;"}</td><td>${esc(c)}</td><td>${esc(g)}</td><td style="width:30%"></td></tr>`).join("")}</tbody></table>
<p>Fecha: ${str(d, "fecha") ? formatFecha(str(d, "fecha")) : "____"}</p>
<p class="nota">Base: Res. SEPRELAD 201/2020, arts. 11 y 12; Res. 490/2022, arts. 21 y 24. Guardá la constancia 5 años.</p>`;
  },
};

const planCapacitacion: Plantilla = {
  key: "sep-plan-capacitacion",
  numero: "SEP-06",
  grupo: "seprelad",
  titulo: "Plan anual y registro de capacitación PLA/FT",
  descripcion: "Programa del año con temas, destinatarios y fechas, más la planilla de asistencia de cada sesión.",
  tipos: TODAS,
  campos: [
    { key: "fecha", label: "Fecha de aprobación", type: "date", required: true },
    { key: "anio", label: "Año del plan", type: "text", default: () => String(new Date().getFullYear()) },
    { key: "responsable", label: "Oficial de cumplimiento responsable", type: "text" },
    {
      key: "sesiones",
      label: "Sesiones (Fecha | Tema | Destinatarios | Modalidad, una por línea)",
      type: "textarea",
      default: () =>
        "Marzo | Marco legal PLA/FT y obligaciones del sujeto obligado | Todo el personal | Presencial\nJunio | Debida diligencia y beneficiarios finales | Comercial y administración | Presencial\nSeptiembre | Señales de alerta y operaciones inusuales | Todo el personal | Virtual\nNoviembre | Deber de reserva y conservación de documentos | Todo el personal | Presencial",
    },
  ],
  tituloDoc: (d) => `Plan de capacitación PLA/FT ${str(d, "anio")}`,
  render: (d, ctx) => {
    const ss = lines(d, "sesiones").map((l) => l.split("|").map((x) => x.trim()));
    return `
${encabezado(`Plan anual de capacitación PLA/FT ${esc(str(d, "anio"))}`)}
<p>${denom(ctx)} aprueba el siguiente programa anual de capacitación en prevención de lavado de dinero y financiamiento del terrorismo, a cargo de ${v(d, "responsable", "OFICIAL DE CUMPLIMIENTO")}.</p>
<table class="tabla"><thead><tr><th>Fecha</th><th>Tema</th><th>Destinatarios</th><th>Modalidad</th></tr></thead><tbody>${ss.map(([f = "", t = "", de = "", m = ""]) => `<tr><td>${esc(f)}</td><td>${esc(t)}</td><td>${esc(de)}</td><td>${esc(m)}</td></tr>`).join("")}</tbody></table>
<p>Aprobado el ${str(d, "fecha") ? formatFecha(str(d, "fecha")) : "____"}.</p>
${firmas([{ nombre: "&nbsp;", cargo: "Por la máxima autoridad" }, { nombre: str(d, "responsable") ? esc(str(d, "responsable")) : "&nbsp;", cargo: "Oficial de cumplimiento" }])}
<h1 style="margin-top:28pt">Registro de asistencia</h1>
<p>Sesión: ______________________ Fecha: ________ Duración: ______ Expositor: ______________</p>
<table class="tabla"><thead><tr><th>Nombre y apellido</th><th>C.I.</th><th>Cargo</th><th>Firma</th></tr></thead><tbody>${"<tr><td>&nbsp;</td><td></td><td></td><td></td></tr>".repeat(8)}</tbody></table>
<p class="nota">Base: Res. SEPRELAD 201/2020, arts. 15 y 16 (temas mínimos); Res. 176/2020, arts. 24 y 25 (remesadoras: además 2 capacitaciones especializadas del oficial por año); Res. 490/2022, Anexo X. Conservá los registros 5 años.</p>`;
  },
};

const informeControlInterno: Plantilla = {
  key: "sep-informe-control-interno",
  numero: "SEP-07",
  grupo: "seprelad",
  titulo: "Informe anual de control interno PLA/FT",
  descripcion: "Estructura del informe anual con los puntos del Anexo II de la Res. 201/2020.",
  tipos: TODAS,
  campos: [
    { key: "fecha", label: "Fecha del informe", type: "date", required: true },
    { key: "ejercicio", label: "Ejercicio evaluado", type: "text", default: () => String(new Date().getFullYear() - 1) },
    { key: "responsable", label: "Quien lo elabora", type: "text" },
  ],
  tituloDoc: (d) => `Informe de control interno PLA/FT ${str(d, "ejercicio")}`,
  render: (d, ctx) => {
    const puntos = [
      "Conocimiento del cliente: grado de cumplimiento de la debida diligencia y actualización de legajos.",
      "Gestión de riesgos: vigencia de la autoevaluación y de la matriz de riesgo de clientes.",
      "Cumplimiento del manual de prevención.",
      "Aprobación y actualizaciones del manual en el ejercicio.",
      "Control del registro de operaciones.",
      "Nuevas señales de alerta incorporadas.",
      "Estadística mensual de operaciones inusuales analizadas (solo cantidades, sin datos de casos).",
      "Cambios al manual propuestos.",
      "Capacitación: sesiones realizadas, asistentes y temas.",
      "Contratos con terceros terminados por incumplimiento.",
      "Observaciones de auditorías anteriores y su seguimiento.",
      "Otros aspectos relevantes y plan de mejoras.",
    ];
    return `
${encabezado(`Informe anual de control interno — ejercicio ${esc(str(d, "ejercicio"))}`)}
<p><strong>Sujeto obligado:</strong> ${denom(ctx)}${ctx.empresa.ruc ? ` · RUC ${esc(ctx.empresa.ruc)}` : ""}<br/><strong>Elaborado por:</strong> ${v(d, "responsable", "RESPONSABLE")} · <strong>Fecha:</strong> ${str(d, "fecha") ? formatFecha(str(d, "fecha")) : "____"}</p>
${puntos.map((p, i) => `<p><strong>${i + 1}. ${esc(p)}</strong></p><p><span class="ph">[Desarrollo]</span></p>`).join("")}
${firmas([{ nombre: str(d, "responsable") ? esc(str(d, "responsable")) : "&nbsp;", cargo: "Oficial de cumplimiento" }])}
<p class="nota">Base: Res. SEPRELAD 201/2020, art. 13 y Anexo II. Se presenta dentro de los 90 días del cierre del ejercicio. No incluyas datos que permitan identificar un ROS ni a los clientes involucrados.</p>`;
  },
};

export const PLANTILLAS: Plantilla[] = [
  actaDirectorioConvocatoria,
  edicto,
  registroAsistencia,
  actaAsamblea,
  actaCargos,
  cartaPoder,
  actaEas,
  actaUnico,
  contratoTrabajo,
  contratoServicios,
  politicaFamiliares,
  actaFamiliar,
  actaPoderes,
  cartaPoderAdministrativa,
  cartaPoderDnit,
  cartaPoderIpsMtess,
  revocacionCartaPoder,
  actaOficialCumplimiento,
  notaOficialCumplimiento,
  debidaDiligencia,
  djOrigenFondos,
  constanciaManual,
  planCapacitacion,
  informeControlInterno,
];

/** Orden de las secciones del selector y prefijo de cada código. */
export const GRUPO_LABELS: Record<GrupoPlantilla, string> = {
  societario: "Sociedad y asambleas",
  poderes: "Poderes",
  familia: "Familiares en la empresa",
  seprelad: "Cumplimiento SEPRELAD (PLA/FT)",
};

export const GRUPO_PREFIJO: Record<GrupoPlantilla, string> = {
  societario: "SOC",
  poderes: "POD",
  familia: "FAM",
  seprelad: "SEP",
};

export function grupoDe(p: Plantilla): GrupoPlantilla {
  return p.grupo;
}

/**
 * Códigos anteriores a la numeración por grupos (hasta oct. 2026), por si
 * alguien busca una plantilla con el número viejo o lo ve en un documento
 * guardado antes del cambio. Las `key` no cambiaron.
 */
export const CODIGO_ANTERIOR: Record<string, string> = {
  "acta-directorio-convocatoria": "01",
  "edicto-convocatoria": "02",
  "registro-asistencia": "03",
  "acta-asamblea-ordinaria": "04",
  "acta-distribucion-cargos": "05",
  "acta-poderes": "06",
  "carta-poder": "07",
  "acta-asamblea-eas": "08",
  "acta-accionista-unico": "09",
  "contrato-trabajo-familiar": "10",
  "contrato-servicios-familiar": "11",
  "politica-familiares": "12",
  "acta-contratacion-familiar": "13",
  "sep-acta-oficial-cumplimiento": "S1",
  "sep-nota-oficial-cumplimiento": "S2",
  "sep-debida-diligencia": "S3",
  "sep-dj-origen-fondos": "S4",
  "sep-constancia-manual": "S5",
  "sep-plan-capacitacion": "S6",
  "sep-informe-control-interno": "S7",
};

/** Código visible de una plantilla por su key ("" si ya no existe). */
export function codigoPlantilla(key: string | null | undefined): string {
  return getPlantilla(key)?.numero ?? "";
}

export function getPlantilla(key: string | null | undefined): Plantilla | undefined {
  return PLANTILLAS.find((p) => p.key === key);
}

export function valoresIniciales(p: Plantilla, ctx: Contexto): Datos {
  const d: Datos = {};
  for (const c of p.campos) {
    const def = c.default?.(ctx);
    d[c.key] = def ?? (c.type === "checkbox" ? false : "");
  }
  return d;
}

/** Documento completo con el aviso legal, listo para vista previa o descarga. */
export function renderDocumento(p: Plantilla, d: Datos, ctx: Contexto): string {
  return `${p.render(d, ctx).split(CODIGO).join(esc(p.numero))}<p class="aviso"><strong>Aviso:</strong> ${esc(AVISO_LEGAL)}</p>`;
}
