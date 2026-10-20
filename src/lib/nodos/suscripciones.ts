// Suscripciones NODOS: tipos, textos y validaciones que comparten la página
// "Mi plan" (las dos apps), el Panel y las rutas de administración.
// Archivo idéntico en finanzas-app y nodos-empresas. No importa nada de
// Polar: lo del procesador vive en src/lib/pagos (solo en Empresas).
import { APP_ID } from "@/lib/nodos/app";
import { SITIOS, cookieDomainFor } from "@/lib/nodos/sitios";

export type Periodo = "mensual" | "anual";
export const PERIODOS: Periodo[] = ["mensual", "anual"];
export type EstadoFila = "prueba" | "activa" | "impaga" | "cancelada" | "vencida";
/** Estado como lo ve la cuenta (incluye la gracia de 5 días y la falta de fila). */
export type EstadoVisible = EstadoFila | "gracia" | "sin_suscripcion";
export type Proveedor = "prueba" | "manual" | "polar" | "pagopar";
export type FormaPagoManual = "transferencia" | "qr" | "efectivo" | "otro";
export const FORMAS_MANUALES: { id: FormaPagoManual; label: string }[] = [
  { id: "transferencia", label: "Transferencia" },
  { id: "qr", label: "QR" },
  { id: "efectivo", label: "Efectivo" },
  { id: "otro", label: "Otro" },
];

/** Días de gracia después del fin de un período pago (igual que en la base). */
export const GRACIA_DIAS = 5;

export const ESTADO_LABEL: Record<EstadoVisible, string> = {
  prueba: "Prueba gratis",
  activa: "Activa",
  impaga: "Pago pendiente",
  cancelada: "Cancelada al fin del período",
  vencida: "Vencida",
  gracia: "En gracia",
  sin_suscripcion: "Sin plan",
};

export const PROVEEDOR_LABEL: Record<Proveedor, string> = {
  prueba: "Prueba",
  manual: "Transferencia o QR",
  polar: "Tarjeta (Polar)",
  pagopar: "Pagopar",
};

/** Plan como lo ve una cuenta (sin ids de productos). */
export interface PlanPublico {
  id: string;
  nombre: string;
  descripcion: string | null;
  apps: string[];
  precio_mensual_gs: number;
  precio_anual_gs: number;
  tarjeta_mensual: boolean;
  tarjeta_anual: boolean;
}

/** Respuesta de GET /api/pagos/estado. */
export interface EstadoPlan {
  logueado: boolean;
  admin?: boolean;
  cortesia_hasta?: string | null;
  estado?: EstadoVisible;
  plan_id?: string | null;
  plan_nombre?: string | null;
  apps?: string[];
  periodo?: Periodo | null;
  proveedor?: Proveedor | null;
  prueba_hasta?: string | null;
  activa_hasta?: string | null;
  acceso_hasta?: string | null;
  dias_restantes?: number | null;
  cancelacion_pedida?: boolean;
  acceso?: { finanzas: boolean; empresas: boolean };
  planes?: PlanPublico[];
  cobro_activo?: boolean;
  tarjeta_disponible?: boolean;
}

/**
 * ¿La cuenta tiene lo que incluye el Combo (Finanzas + Empresas), por ejemplo
 * conectar socios? Sí cuando el cobro está apagado, para administradores, con
 * cortesía, en la prueba gratis o con un plan vigente que incluye las dos apps.
 */
export function incluyeCombo(e: EstadoPlan | null): boolean {
  if (!e) return true; // si no se pudo leer el estado, no se bloquea (falla abierto)
  if (!e.cobro_activo || e.admin) return true;
  const hoy = new Date().toISOString().slice(0, 10);
  if (e.cortesia_hasta && e.cortesia_hasta >= hoy) return true;
  if (e.estado === "prueba") return true;
  const vigente = e.estado === "activa" || e.estado === "gracia" || e.estado === "cancelada";
  const apps = e.apps ?? [];
  return vigente && apps.includes("finanzas") && apps.includes("empresas");
}

/** Fila de la lista del Panel → Suscripciones. */
export interface CuentaSuscripcion {
  user_id: string;
  email: string | null;
  nombre: string | null;
  usuario: string | null;
  is_admin: boolean;
  suspendido: boolean;
  cortesia_hasta: string | null;
  plan_id: string | null;
  periodo: Periodo | null;
  estado_fila: EstadoFila | null;
  estado: EstadoVisible;
  proveedor: Proveedor | null;
  prueba_hasta: string | null;
  activa_hasta: string | null;
  acceso_hasta: string | null;
}

export interface PlanAdmin {
  id: string;
  nombre: string;
  descripcion: string | null;
  apps: string[];
  precio_mensual_gs: number;
  precio_anual_gs: number;
  polar_producto_mensual: string | null;
  polar_producto_anual: string | null;
  activo: boolean;
  orden: number;
  /** Lista que muestra nodoscompliance.com en Planes (migración 013/027). */
  beneficios?: string[];
}

export interface ResumenAdmin {
  cuentas: CuentaSuscripcion[];
  planes: PlanAdmin[];
  totales_mes: { moneda: string; monto: number; pagos: number }[];
  hoy: string;
}

/** Fecha de hoy en Paraguay como YYYY-MM-DD. */
export function hoyPy(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Asuncion" }).format(new Date());
}

function sumarDias(iso: string, dias: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

/** Mismo cálculo que public.suscripcion_acceso_hasta en la base. */
export function accesoHasta(estado: EstadoFila | null, pruebaHasta: string | null, activaHasta: string | null): string | null {
  if (estado === "prueba") return pruebaHasta;
  if ((estado === "activa" || estado === "impaga") && activaHasta) return sumarDias(activaHasta, GRACIA_DIAS);
  if (estado === "cancelada") return activaHasta;
  return null;
}

/** Mismo cálculo que public.estado_suscripcion en la base. */
export function estadoVisible(
  estado: EstadoFila | null,
  pruebaHasta: string | null,
  activaHasta: string | null,
  hoy = hoyPy()
): EstadoVisible {
  if (!estado) return "sin_suscripcion";
  const hasta = accesoHasta(estado, pruebaHasta, activaHasta);
  if (!hasta || hasta < hoy) return "vencida";
  if ((estado === "activa" || estado === "impaga") && activaHasta && activaHasta < hoy) return "gracia";
  return estado;
}

export function formatoGs(monto: number): string {
  return `Gs. ${new Intl.NumberFormat("es-PY", { maximumFractionDigits: 0 }).format(monto)}`;
}

export function formatoMonto(monto: number, moneda: string): string {
  if (moneda === "PYG") return formatoGs(monto);
  return `${moneda} ${new Intl.NumberFormat("es-PY", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(monto / 100)}`;
}

export function formatoFecha(iso: string | null | undefined): string {
  if (!iso) return "—";
  const [a, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${a}`;
}

/**
 * Base de las rutas /api/pagos/* (viven solo en NODOS Empresas). Desde
 * Finanzas en producción se llaman en empresas.nodoscompliance.com con la
 * sesión compartida (CORS con credenciales, igual que /api/cuenta/*).
 */
export function urlPagos(ruta: string): string {
  if (APP_ID === "empresas" || typeof window === "undefined" || !cookieDomainFor(window.location.hostname)) return ruta;
  return `${SITIOS.empresas.url}${ruta}`;
}

// ── Validación de los pedidos del Panel (servidor) ────────────────────────
export const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const FECHA_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const PRODUCTO_REGEX = /^[A-Za-z0-9_-]{3,80}$/;

export function esFecha(v: unknown): v is string {
  return typeof v === "string" && FECHA_REGEX.test(v) && !Number.isNaN(Date.parse(`${v}T00:00:00Z`));
}

export interface PagoManualPedido {
  user_id: string;
  plan: string;
  periodo: Periodo;
  monto_gs: number;
  forma: FormaPagoManual;
  referencia: string;
  fecha: string;
  nota: string | null;
}

export function validarPagoManual(b: Record<string, unknown> | null): PagoManualPedido | string {
  if (!b) return "Pedido inválido.";
  if (typeof b.user_id !== "string" || !UUID_REGEX.test(b.user_id)) return "Elegí la cuenta.";
  if (typeof b.plan !== "string" || !/^[a-z0-9_-]{2,30}$/.test(b.plan)) return "Elegí el plan.";
  if (b.periodo !== "mensual" && b.periodo !== "anual") return "Elegí si es mensual o anual.";
  const monto = typeof b.monto_gs === "number" ? b.monto_gs : Number(b.monto_gs);
  if (!Number.isInteger(monto) || monto <= 0 || monto > 1_000_000_000) return "El monto en guaraníes tiene que ser un número entero mayor a 0.";
  if (!FORMAS_MANUALES.some((f) => f.id === b.forma)) return "Elegí la forma de pago.";
  const referencia = typeof b.referencia === "string" ? b.referencia.trim() : "";
  if (referencia.length < 3 || referencia.length > 120) return "Cargá la referencia del comprobante (3 a 120 caracteres).";
  if (!esFecha(b.fecha)) return "Fecha de pago inválida.";
  const nota = typeof b.nota === "string" ? b.nota.trim().slice(0, 500) : "";
  return {
    user_id: b.user_id,
    plan: b.plan,
    periodo: b.periodo,
    monto_gs: monto,
    forma: b.forma as FormaPagoManual,
    referencia,
    fecha: b.fecha,
    nota: nota || null,
  };
}

export const MENSAJE_PAGO_MANUAL: Record<string, string> = {
  sin_cuenta: "Esa cuenta no existe.",
  plan_invalido: "Ese plan no existe.",
  periodo_invalido: "Período inválido.",
  monto_invalido: "Monto inválido.",
  forma_invalida: "Forma de pago inválida.",
  referencia_invalida: "Referencia inválida.",
  fecha_invalida: "La fecha del pago no puede ser futura ni de hace más de 90 días.",
  referencia_repetida: "Ya hay un pago registrado con esa referencia.",
  tiene_polar_activa: "Esa cuenta tiene una suscripción con tarjeta vigente. Cancelala en Polar antes de registrar un pago manual.",
};

export interface CambiosPlan {
  nombre?: string;
  descripcion?: string | null;
  precio_mensual_gs?: number;
  precio_anual_gs?: number;
  polar_producto_mensual?: string | null;
  polar_producto_anual?: string | null;
  activo?: boolean;
  beneficios?: string[];
}

export function validarCambiosPlan(b: Record<string, unknown> | null): CambiosPlan | string {
  if (!b) return "Pedido inválido.";
  const out: CambiosPlan = {};
  if ("nombre" in b) {
    const n = typeof b.nombre === "string" ? b.nombre.trim() : "";
    if (n.length < 2 || n.length > 60) return "El nombre lleva de 2 a 60 caracteres.";
    out.nombre = n;
  }
  if ("descripcion" in b) {
    if (b.descripcion !== null && typeof b.descripcion !== "string") return "Descripción inválida.";
    const d = typeof b.descripcion === "string" ? b.descripcion.trim() : "";
    if (d.length > 200) return "La descripción lleva hasta 200 caracteres.";
    out.descripcion = d || null;
  }
  for (const k of ["precio_mensual_gs", "precio_anual_gs"] as const) {
    if (k in b) {
      const v = typeof b[k] === "number" ? (b[k] as number) : Number(b[k]);
      if (!Number.isInteger(v) || v < 0 || v > 1_000_000_000) return "Los precios van en guaraníes, enteros y sin puntos.";
      out[k] = v;
    }
  }
  for (const k of ["polar_producto_mensual", "polar_producto_anual"] as const) {
    if (k in b) {
      const v = typeof b[k] === "string" ? (b[k] as string).trim() : "";
      if (b[k] !== null && typeof b[k] !== "string") return "Id de producto inválido.";
      if (v && !PRODUCTO_REGEX.test(v)) return "El id de producto de Polar solo lleva letras, números, guiones (3 a 80).";
      out[k] = v || null;
    }
  }
  if ("activo" in b) {
    if (typeof b.activo !== "boolean") return "El campo activo tiene que ser verdadero o falso.";
    out.activo = b.activo;
  }
  if ("beneficios" in b) {
    if (!Array.isArray(b.beneficios)) return "Los beneficios van como una lista.";
    const lista = b.beneficios.map((x) => (typeof x === "string" ? x.trim() : "")).filter(Boolean);
    if (lista.length > 10) return "Hasta 10 beneficios por plan.";
    if (lista.some((x) => x.length > 90)) return "Cada beneficio lleva hasta 90 caracteres.";
    out.beneficios = lista;
  }
  if (out.polar_producto_mensual && out.polar_producto_mensual === out.polar_producto_anual) {
    return "El producto mensual y el anual tienen que ser distintos.";
  }
  if (Object.keys(out).length === 0) return "No hay cambios para guardar.";
  return out;
}
