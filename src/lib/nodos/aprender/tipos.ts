/**
 * NODOS Aprender · tipos del juego "Carrera".
 *
 * Archivo compartido (idéntico en finanzas-app y nodos-empresas): el juego
 * lo usa para jugar y el Panel para editar el contenido. Todo es ficticio:
 * personas, activos y montos (guaraníes del juego). Los casos reales se
 * cuentan recién en la lección de NODO, con su fuente.
 */

export const VERSION_ESTADO = 1;

export type ActivoId = "plazo-fijo" | "dolar" | "fondo" | "acciones" | "btc" | "alt" | "alfa";
export type Etapa = "empleado" | "ahorrista" | "inversor" | "emprendedor" | "libre";
export type NivelVida = "austero" | "normal" | "alto";
export type Arranque = "ajustado" | "normal" | "holgado";
export type EstadoCarrera = "activa" | "quebrada" | "libre";
/** Color del post-it en el escritorio y del chip en el calendario. */
export type TipoSituacion = "situacion" | "oportunidad" | "vencimiento";
export type TipoEvento = "ingreso" | "gasto" | "vencimiento" | TipoSituacion;
export type Aviso = "inversion" | "legal";

export interface Posicion {
  /** Valor actual en Gs. */
  valor: number;
  /** Lo que pusiste en total (para la ganancia o pérdida). */
  invertido: number;
}

export interface Negocio {
  nombre: string;
  /** Resultado mensual esperado (antes de la variación del mes). */
  flujoBase: number;
  /** Variación mensual (0,2 = ±20 % aprox.). */
  volatilidad: number;
  /** Lo que se puso para arrancarlo. */
  aporte: number;
  meses: number;
}

export interface SituacionAbierta {
  id: string;
  /** Mes absoluto en que apareció. */
  desde: number;
  /** Opción elegida (si ya decidiste). */
  elegida?: string;
  /** Mes en que decidiste. */
  decididaEn?: number;
}

/** Quién es el personaje (se elige al crear la carrera). */
export interface Perfil {
  nombre: string;
  avatar: AvatarId;
  oficio: OficioId;
  meta: MetaId;
}
export type AvatarId = "persona" | "maletin" | "laptop" | "herramientas" | "paleta" | "libro" | "carrito" | "cafe";
export type OficioId = "cajero" | "administrativo" | "analista";
export type MetaId = "emergencia" | "auto" | "negocio" | "invertir";

export interface Carrera {
  version: number;
  /** Personaje. Opcional: las carreras creadas antes del 18/11 no lo tienen. */
  perfil?: Perfil;
  semilla: number;
  /** Mes absoluto que se está jugando (1 = enero del año 1). */
  mes: number;
  estado: EstadoCarrera;
  etapa: Etapa;
  /** La etapa más alta alcanzada: define qué se desbloqueó. */
  etapaMax: Etapa;
  efectivo: number;
  ahorro: number;
  activos: Partial<Record<ActivoId, Posicion>>;
  deudaTarjeta: number;
  limiteTarjeta: number;
  prestamo: { saldo: number; cuota: number } | null;
  sueldo: number;
  gastosFijos: number;
  nivelVida: NivelVida;
  negocio: Negocio | null;
  reputacion: number;
  /** Meses seguidos sin poder cubrir lo que se debía. */
  mora: number;
  marcas: string[];
  /** Situaciones programadas por decisiones anteriores. */
  programadas: { id: string; mes: number }[];
  abiertas: SituacionAbierta[];
  /** Cuántas veces salió cada situación. */
  vistas: Record<string, number>;
  /** Lecciones desbloqueadas en esta carrera. */
  lecciones: string[];
  indiceSalud: number;
}

// ── Contenido ─────────────────────────────────────────────────────────────

export interface Efectos {
  efectivo?: number;
  ahorro?: number;
  deudaTarjeta?: number;
  sueldo?: number;
  gastosFijos?: number;
  reputacion?: number;
  nivelVida?: NivelVida;
  /** Mueve plata (del efectivo y, si no alcanza, del ahorro) a un activo. */
  invertir?: { activo: ActivoId; monto: number };
  /** Vende una parte (0 a 1) de un activo y la pasa al efectivo. */
  vender?: { activo: ActivoId; parte: number };
  /** Se pierde una parte (0 a 1) de un activo (quiebra, estafa). */
  perder?: { activo: ActivoId; parte: number };
  /** Arranca un negocio (el aporte sale del efectivo y del ahorro). */
  negocio?: Negocio;
  /** Dejás el trabajo: el sueldo pasa a 0. */
  dejarTrabajo?: boolean;
  /** Préstamo: entra el monto y se paga en cuotas fijas (el total ya trae los intereses). */
  prestamo?: { monto: number; cuota: number; meses: number };
}

export interface Opcion {
  id: string;
  titulo: string;
  texto: string;
  efectos: Efectos;
  /** Qué pasó después (lo ve el jugador al cerrarse la situación). */
  resultado: string;
  /** Lo que NODO dice sobre esta decisión. */
  nodo: string;
  marca?: string[];
  quita?: string[];
  programa?: { situacion: string; enMeses: number }[];
}

export interface Requisitos {
  etapaMinima?: Etapa;
  marca?: string;
  sinMarca?: string;
  /** Tener algo invertido en este activo. */
  activo?: ActivoId;
  conDeudaTarjeta?: boolean;
  conNegocio?: boolean;
  /** Meses del año (1 = enero) en que puede salir. */
  meses?: number[];
  /** Solo aparece si otra decisión la programa. */
  soloProgramada?: boolean;
}

export interface Situacion {
  id: string;
  tipo: TipoSituacion;
  titulo: string;
  /** Texto corto del post-it (letra manuscrita). */
  postit: string;
  texto: string;
  opciones: Opcion[];
  /** Opción que aplica el motor si cerrás el mes sin decidir. */
  porDefecto: string;
  requisitos?: Requisitos;
  /** Peso para el sorteo (1 = normal). */
  peso?: number;
  /** Día fijo del calendario (por ejemplo, el día de cobro). Sin él, el día se sortea. */
  dia?: number;
  repetible?: boolean;
  /**
   * Situación que dura varios meses: en cada cierre se aplica el siguiente
   * movimiento de precio. Sigue pegada en el escritorio hasta que decidís.
   */
  trayectoria?: { activo: ActivoId; cambios: number[] };
  leccion: Leccion;
  aviso: Aviso;
}

export interface Leccion {
  id: string;
  titulo: string;
  /** Tres reglas simples, en segunda persona. */
  reglas: string[];
  casoReal?: string;
}

export interface CasoReal {
  id: string;
  titulo: string;
  /** AAAA-MM */
  fecha: string;
  resumen: string;
  fuente: string;
  /** Lo marca Mauricio cuando revisó la fuente. Sin verificar no se muestra. */
  verificado: boolean;
}

export interface Contenido {
  situaciones: Map<string, Situacion>;
  casos: Map<string, CasoReal>;
}

// ── Lo que el motor le da a las pantallas ─────────────────────────────────

export interface Evento {
  dia: number;
  tipo: TipoEvento;
  titulo: string;
  monto?: number;
  situacion?: string;
}

export interface PlanMes {
  mes: number;
  anio: number;
  /** 1 = enero. */
  mesDelAnio: number;
  dias: number;
  /** 0 = lunes … 6 = domingo. */
  primerDia: number;
  eventos: Evento[];
  /** Ids de las situaciones del mes (nuevas + las que siguen abiertas). */
  situaciones: string[];
}

export interface LeccionDesbloqueada {
  situacion: string;
  opcion: string;
  leccion: string;
  titulo: string;
  resultado: string;
  nodo: string;
  reglas: string[];
  casoReal?: CasoReal;
}

export interface ResumenMes {
  mes: number;
  ingresos: { concepto: string; monto: number }[];
  gastos: { concepto: string; monto: number }[];
  movimientos: { concepto: string; monto: number }[];
  patrimonioAntes: number;
  patrimonioDespues: number;
  indiceSalud: number;
  lecciones: LeccionDesbloqueada[];
  avisos: string[];
}
