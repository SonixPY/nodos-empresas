// Traduce un evento de Polar (ya verificado) a los datos mínimos que guarda
// la base (función public.polar_aplicar_evento). Sin dependencias de
// servidor: se prueba aislado.
//
// Reglas de seguridad:
//   · La cuenta se identifica SOLO por customer.external_id, que nuestro
//     servidor pone al crear el checkout (= id de la cuenta NODOS). Nunca por
//     metadata, email ni nombre.
//   · Se guardan ids, estados, montos y fechas. Nunca email, nombre,
//     dirección de facturación ni datos del medio de pago.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ID = /^[A-Za-z0-9_-]{1,100}$/;

/** Eventos que la base sabe aplicar; el resto se acusa (202) sin guardar. */
export const EVENTOS_POLAR = [
  "subscription.created",
  "subscription.active",
  "subscription.updated",
  "subscription.canceled",
  "subscription.uncanceled",
  "subscription.revoked",
  "subscription.past_due",
  "subscription.cycled",
  "subscription.paused",
  "subscription.resumed",
  "order.paid",
  "order.refunded",
] as const;

export interface EventoPolarMapeado {
  tipo: string;
  ocurrido: string;
  userId: string | null;
  clienteId: string | null;
  datos: Record<string, string | number | boolean | null>;
}

type Obj = Record<string, unknown>;
const obj = (v: unknown): Obj | null => (v && typeof v === "object" && !Array.isArray(v) ? (v as Obj) : null);
const id = (v: unknown) => (typeof v === "string" && ID.test(v) ? v : null);
const texto = (v: unknown, max = 40) => (typeof v === "string" ? v.slice(0, max) : null);
const entero = (v: unknown) => (typeof v === "number" && Number.isInteger(v) && v >= 0 ? v : null);
const bool = (v: unknown) => (typeof v === "boolean" ? v : null);

function fecha(v: unknown): string | null {
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v.toISOString();
  if (typeof v !== "string") return null;
  const t = Date.parse(v);
  return Number.isNaN(t) ? null : new Date(t).toISOString();
}

function externalId(data: Obj): string | null {
  const cliente = obj(data.customer);
  const ext = cliente?.external_id;
  return typeof ext === "string" && UUID.test(ext) ? ext.toLowerCase() : null;
}

export function mapearEventoPolar(evento: unknown): EventoPolarMapeado | null {
  const e = obj(evento);
  const data = obj(e?.data);
  const tipo = typeof e?.type === "string" ? e.type : null;
  if (!e || !data || !tipo || !(EVENTOS_POLAR as readonly string[]).includes(tipo)) return null;

  const ocurrido = fecha(e.timestamp) ?? new Date().toISOString();
  const base = { tipo, ocurrido, userId: externalId(data), clienteId: id(data.customer_id) };

  if (tipo.startsWith("subscription.")) {
    return {
      ...base,
      datos: {
        suscripcion_id: id(data.id),
        producto_id: id(data.product_id),
        status: texto(data.status, 30),
        period_start: fecha(data.current_period_start),
        period_end: fecha(data.current_period_end),
        cancel_at_period_end: bool(data.cancel_at_period_end),
        canceled_at: fecha(data.canceled_at),
        ended_at: fecha(data.ended_at),
      },
    };
  }

  return {
    ...base,
    datos: {
      orden_id: id(data.id),
      producto_id: id(data.product_id),
      suscripcion_id: id(data.subscription_id),
      status: texto(data.status, 30),
      total: entero(data.total_amount),
      reembolsado: entero(data.refunded_amount),
      moneda: typeof data.currency === "string" && /^[a-z]{3}$/i.test(data.currency) ? data.currency.toUpperCase() : null,
      motivo: texto(data.billing_reason, 40),
    },
  };
}
