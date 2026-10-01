import type { Sector } from "@/lib/seprelad";

/**
 * Novedades para tus empresas: catálogo FIJO de temas.
 *
 * Privacidad: lo único que viaja del navegador a /api/novedades son los `id`
 * de este catálogo. Las búsquedas que el servidor le hace a Google News salen
 * de `queries` (texto fijo, igual para todos los clientes), así que no revelan
 * quién pregunta ni qué empresas tiene. Nunca se buscan nombres de empresas,
 * RUC ni personas. El cruce "¿te afecta?" (`aplicaA`) corre en el navegador
 * con los datos propios del usuario (RLS) y no se manda a ningún lado.
 *
 * Este archivo lo usan el servidor (whitelist) y el cliente (etiquetas y
 * reglas): no importar nada de cliente acá.
 */

// ── Rubros ───────────────────────────────────────────────────────────────

/** Ids válidos de `empresas.rubro` (mismo listado que el check de 008_novedades.sql). */
export const RUBROS = [
  "agro",
  "inmobiliario",
  "comercio",
  "industria",
  "servicios",
  "transporte",
  "tecnologia",
  "financiero",
  "salud",
  "educacion",
  "osfl",
] as const;
export type Rubro = (typeof RUBROS)[number];

export const RUBRO_LABEL: Record<Rubro, string> = {
  agro: "Agro y ganadería",
  inmobiliario: "Inmobiliario y construcción",
  comercio: "Comercio",
  industria: "Industria",
  servicios: "Servicios profesionales",
  transporte: "Transporte y logística",
  tecnologia: "Tecnología",
  financiero: "Financiero y remesas",
  salud: "Salud",
  educacion: "Educación",
  osfl: "Fundación u OSFL",
};

export function esRubro(v: unknown): v is Rubro {
  return typeof v === "string" && (RUBROS as readonly string[]).includes(v);
}

/** Palabras clave para estimar el rubro si la empresa no lo tiene cargado.
 * El orden importa: primero los más específicos. Se compara sin tildes. */
const CLAVES_RUBRO: [Rubro, RegExp][] = [
  ["osfl", /\b(fundacion|asociacion|sin fines de lucro|osfl|ong|iglesia|entidad religiosa)\b/],
  ["financiero", /(financ|remesa|casa de cambio|cambios\b|credito|prestamo|giros|seguros|cooperativa)/],
  ["salud", /(salud|clinic|sanatorio|hospital|farmac|medic|odontolog|laboratorio)/],
  ["educacion", /(educa|colegio|escuela|universidad|instituto|capacitacion|academia)/],
  ["tecnologia", /(software|tecnolog|informatic|sistemas|digital|telecomunic)/],
  ["transporte", /(transport|logistic|flete|cargas?\b|naviera|fluvial|courier)/],
  ["inmobiliario", /(inmobili|inmueble|construc|loteo|bienes raices|arquitect|edific|vivienda)/],
  ["agro", /(agro|agricol|ganader|ganado|soja|cultivo|estancia|forestal|semilla|granos|hacienda|avicol|lecher|frigorific|silo)/],
  ["industria", /(industri|fabrica|manufactur|metalurg|textil|plastic|elaboracion)/],
  ["servicios", /(consultor|asesor|juridic|abogad|contab|auditor|servicios profesionales|marketing|publicidad)/],
  ["comercio", /(comerci|venta|distribu|import|export|supermercado|tienda|almacen|mayorist|minorist|ferreter)/],
];

function sinTildes(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

export function rubroPorPalabras(texto: string | null | undefined): Rubro | null {
  if (!texto) return null;
  const t = sinTildes(texto);
  for (const [r, re] of CLAVES_RUBRO) if (re.test(t)) return r;
  return null;
}

const RUBRO_DE_SECTOR: Record<Sector, Rubro> = {
  inmobiliaria: "inmobiliario",
  osfl: "osfl",
  remesas: "financiero",
};

/** Datos mínimos de una empresa para decidir qué temas le aplican. Se arma
 * en el navegador y nunca sale de él. */
export interface EmpresaCtx {
  id: string;
  nombre: string;
  rubro: Rubro | null;
  /** true si el rubro no está cargado y se estimó por palabras clave. */
  rubroEstimado: boolean;
  /** Sectores SEPRELAD de su perfil de sujeto obligado (vacío si no es). */
  sectores: Sector[];
}

/** Rubro de la empresa: el cargado; si no, se estima por el sector SEPRELAD
 * (dato fuerte), la actividad principal (SIARA) o la denominación. */
export function contextoEmpresa(
  e: { id: string; denominacion: string; rubro?: string | null; actividad_principal?: string | null },
  sectores: Sector[] = []
): EmpresaCtx {
  if (esRubro(e.rubro)) return { id: e.id, nombre: e.denominacion, rubro: e.rubro, rubroEstimado: false, sectores };
  const estimado =
    (sectores[0] ? RUBRO_DE_SECTOR[sectores[0]] : null) ?? rubroPorPalabras(e.actividad_principal) ?? rubroPorPalabras(e.denominacion);
  return { id: e.id, nombre: e.denominacion, rubro: estimado, rubroEstimado: estimado !== null, sectores };
}

// ── Temas ────────────────────────────────────────────────────────────────

export type TipoTema = "normativa" | "rubro";

export interface Tema {
  id: string;
  tipo: TipoTema;
  /** Etiqueta corta del chip. */
  label: string;
  /** Búsquedas fijas en Google News (se combinan y deduplican). */
  queries: string[];
  /** ¿A qué empresas del usuario les puede afectar? (corre en el navegador). */
  aplicaA: (e: EmpresaCtx) => boolean;
}

const todas = () => true;
const sujetoObligado = (e: EmpresaCtx) => e.sectores.length > 0;
const conSector = (s: Sector) => (e: EmpresaCtx) => e.sectores.includes(s);
const deRubro = (r: Rubro) => (e: EmpresaCtx) => e.rubro === r;

/** Normativa: un tema por organismo. Los temas por sector SEPRELAD van antes
 * que el general para que, si un titular aparece en los dos, quede con la
 * etiqueta más específica. */
export const TEMAS_NORMATIVA: Tema[] = [
  {
    id: "seprelad-inmobiliaria",
    tipo: "normativa",
    label: "SEPRELAD · Inmobiliarias",
    queries: ["SEPRELAD inmobiliarias", "SEPRELAD sector inmobiliario"],
    aplicaA: conSector("inmobiliaria"),
  },
  {
    id: "seprelad-osfl",
    tipo: "normativa",
    label: "SEPRELAD · OSFL",
    queries: ["SEPRELAD organizaciones sin fines de lucro", "SEPRELAD OSFL"],
    aplicaA: conSector("osfl"),
  },
  {
    id: "seprelad-remesas",
    tipo: "normativa",
    label: "SEPRELAD · Remesas",
    queries: ["SEPRELAD remesadoras", "SEPRELAD remesas de dinero"],
    aplicaA: conSector("remesas"),
  },
  {
    id: "seprelad",
    tipo: "normativa",
    label: "SEPRELAD",
    queries: ["SEPRELAD resolución", "site:seprelad.gov.py"],
    aplicaA: sujetoObligado,
  },
  {
    id: "dnit",
    tipo: "normativa",
    label: "DNIT (ex SET)",
    queries: ["DNIT resolución general", "site:dnit.gov.py"],
    aplicaA: todas,
  },
  {
    id: "mef-siara",
    tipo: "normativa",
    label: "MEF · Beneficiarios finales",
    queries: ["SIARA beneficiarios finales", "Ministerio de Economía personas y estructuras jurídicas"],
    aplicaA: todas,
  },
  {
    id: "registros",
    tipo: "normativa",
    label: "Registros Públicos",
    queries: ["Dirección General de los Registros Públicos"],
    aplicaA: todas,
  },
  {
    id: "ips",
    tipo: "normativa",
    label: "IPS",
    queries: ["IPS empleadores resolución", "Instituto de Previsión Social empleadores"],
    // No guardamos si la empresa tiene personal: se asume que puede tenerlo.
    aplicaA: todas,
  },
  {
    id: "mtess",
    tipo: "normativa",
    label: "MTESS",
    queries: ["Ministerio de Trabajo Paraguay resolución", "MTESS resolución"],
    aplicaA: todas,
  },
  {
    id: "bcp",
    tipo: "normativa",
    label: "BCP",
    queries: ["Banco Central del Paraguay resolución", "site:bcp.gov.py"],
    aplicaA: (e) => e.rubro === "financiero" || e.sectores.includes("remesas"),
  },
];

const QUERIES_RUBRO: Record<Rubro, string[]> = {
  agro: ["agronegocios Paraguay", "ganadería Paraguay"],
  inmobiliario: ["sector inmobiliario Paraguay", "construcción Paraguay"],
  comercio: ["sector comercial Paraguay", "importadores Paraguay"],
  industria: ["industria Paraguay", "Unión Industrial Paraguaya"],
  servicios: ["servicios profesionales Paraguay", "pymes Paraguay"],
  transporte: ["transporte de cargas Paraguay", "logística Paraguay"],
  tecnologia: ["tecnología empresas Paraguay", "startups Paraguay"],
  financiero: ["sector financiero Paraguay", "remesas Paraguay"],
  salud: ["sector salud privado Paraguay", "Ministerio de Salud Paraguay"],
  educacion: ["educación privada Paraguay", "Ministerio de Educación Paraguay"],
  osfl: ["organizaciones sin fines de lucro Paraguay", "fundaciones Paraguay"],
};

export const TEMAS_RUBRO: Tema[] = RUBROS.map((r) => ({
  id: `rubro-${r}`,
  tipo: "rubro",
  label: RUBRO_LABEL[r],
  queries: QUERIES_RUBRO[r],
  aplicaA: deRubro(r),
}));

export const TEMAS: Tema[] = [...TEMAS_NORMATIVA, ...TEMAS_RUBRO];
const POR_ID = new Map(TEMAS.map((t) => [t.id, t]));
const ORDEN = new Map(TEMAS.map((t, i) => [t.id, i]));

export function temaPorId(id: string): Tema | undefined {
  return POR_ID.get(id);
}

/** Ids de normativa válidos para `notas_nodos.organismo` (mismo listado que 008). */
export const ORGANISMOS = TEMAS_NORMATIVA.map((t) => t.id);

export const MAX_TEMAS_POR_PEDIDO = 12;

/** Whitelist: deja solo ids del catálogo (los desconocidos se descartan),
 * sin repetidos, en el orden del catálogo y hasta el máximo. */
export function filtrarTemas(ids: string[]): Tema[] {
  const vistos = new Set<string>();
  const out: Tema[] = [];
  for (const raw of ids) {
    if (typeof raw !== "string" || raw.length > 40) continue;
    const t = POR_ID.get(raw);
    if (!t || vistos.has(t.id)) continue;
    vistos.add(t.id);
    out.push(t);
  }
  return out.sort((a, b) => ORDEN.get(a.id)! - ORDEN.get(b.id)!).slice(0, MAX_TEMAS_POR_PEDIDO);
}

/** Temas de un tipo que le aplican a al menos una empresa. Sin empresas,
 * normativa general de referencia. */
export function temasParaEmpresas(tipo: TipoTema, empresas: EmpresaCtx[]): Tema[] {
  const base = tipo === "normativa" ? TEMAS_NORMATIVA : TEMAS_RUBRO;
  if (empresas.length === 0) return tipo === "normativa" ? base.filter((t) => ["dnit", "mef-siara", "seprelad"].includes(t.id)) : [];
  return base.filter((t) => empresas.some((e) => t.aplicaA(e)));
}

/** Empresas del usuario a las que les puede afectar un tema. */
export function empresasAfectadas(temaId: string, empresas: EmpresaCtx[]): EmpresaCtx[] {
  const t = POR_ID.get(temaId);
  return t ? empresas.filter((e) => t.aplicaA(e)) : [];
}

// ── Titulares y notas ────────────────────────────────────────────────────

/** Un titular tal como lo devuelve /api/novedades. */
export interface Novedad {
  titulo: string;
  fuente: string;
  url: string;
  /** ISO 8601, o "" si el feed no trajo fecha. */
  fecha: string;
  /** Id del tema del catálogo que lo trajo. */
  tema: string;
}

/** Nota editorial de NODOS (tabla `notas_nodos`). No contiene datos de clientes. */
export interface NotaNodos {
  id: string;
  titulo: string;
  resumen: string;
  cuerpo: string | null;
  link: string | null;
  organismo: string | null;
  rubros: Rubro[];
  sectores_seprelad: Sector[];
  destacada: boolean;
  publicada: boolean;
  publicada_el: string | null;
  created_at: string;
}

/** Empresas a las que apunta una nota: por rubro o sector si los tiene; si
 * no, por la regla del organismo; si tampoco, a todas. */
export function empresasDeNota(n: Pick<NotaNodos, "rubros" | "sectores_seprelad" | "organismo">, empresas: EmpresaCtx[]): EmpresaCtx[] {
  const rubros = n.rubros ?? [];
  const sectores = n.sectores_seprelad ?? [];
  if (rubros.length > 0 || sectores.length > 0) {
    return empresas.filter((e) => (e.rubro !== null && rubros.includes(e.rubro)) || e.sectores.some((s) => sectores.includes(s)));
  }
  if (n.organismo && POR_ID.has(n.organismo)) return empresasAfectadas(n.organismo, empresas);
  return empresas;
}

/** ¿Se le muestra la nota a este usuario? Las notas sin segmentar, a todos;
 * las segmentadas, solo si alguna de sus empresas entra. */
export function notaVisible(n: Pick<NotaNodos, "rubros" | "sectores_seprelad">, empresas: EmpresaCtx[]): boolean {
  if ((n.rubros ?? []).length === 0 && (n.sectores_seprelad ?? []).length === 0) return true;
  return empresasDeNota({ ...n, organismo: null }, empresas).length > 0;
}

/** Solo links http(s): cualquier otro esquema (javascript:, data:) se descarta. */
export function urlSegura(u: string | null | undefined): string | null {
  if (!u) return null;
  try {
    const url = new URL(u);
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : null;
  } catch {
    return null;
  }
}

/** "hace 5 min", "hace 3 h", "hace 2 d", o la fecha corta si es vieja. */
export function tiempoRelativo(iso: string, ahora: number): string {
  if (!iso) return "";
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "";
  const min = Math.max(0, Math.round((ahora - t) / 60000));
  if (min < 1) return "recién";
  if (min < 60) return `hace ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.round(h / 24);
  if (d < 7) return `hace ${d} d`;
  return new Date(t).toLocaleDateString("es-PY", { day: "numeric", month: "short" });
}

export const DISCLAIMER_NOVEDADES =
  "Información general sobre normativa y noticias de fuentes externas. No constituye asesoramiento legal para tu caso.";
