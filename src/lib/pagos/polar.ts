import "server-only";
import { createPolar, webhooks } from "@polar-sh/sdk/2026-10";

// Cliente de Polar (procesador de pagos con tarjeta, Merchant of Record).
// Solo servidor: el token de organización da acceso a la cuenta de Polar y
// nunca puede llegar al navegador (por eso no es NEXT_PUBLIC_ y este módulo
// importa "server-only": el build falla si un componente de cliente lo usa).
//
// Variables (Vercel → nodos-empresas, marcadas como Sensitive):
//   POLAR_ACCESS_TOKEN   token de organización (sandbox o producción)
//   POLAR_WEBHOOK_SECRET secreto del webhook ("whsec_...")
//   POLAR_SERVER         "sandbox" (por defecto) o "production"

export type ServidorPolar = "sandbox" | "production";

export function servidorPolar(): ServidorPolar {
  return process.env.POLAR_SERVER?.trim() === "production" ? "production" : "sandbox";
}

export function polarConfigurado(): boolean {
  return !!process.env.POLAR_ACCESS_TOKEN?.trim();
}

export function clientePolar() {
  const accessToken = process.env.POLAR_ACCESS_TOKEN?.trim();
  if (!accessToken) throw new Error("Falta POLAR_ACCESS_TOKEN.");
  // Timeout en segundos: el checkout no puede dejar colgada la página.
  return createPolar({ accessToken, environment: servidorPolar(), timeout: 15 });
}

export function secretoWebhookPolar(): string | null {
  return process.env.POLAR_WEBHOOK_SECRET?.trim() || null;
}

/**
 * Verifica la firma (Standard Webhooks: webhook-id, webhook-timestamp,
 * webhook-signature, tolerancia de 5 minutos) sobre el cuerpo crudo y recién
 * ahí lo interpreta. Lanza webhooks.PolarWebhookVerificationError si la firma
 * no es válida.
 */
export const validarEventoPolar = webhooks.validateEvent;
export const { PolarWebhookError, PolarWebhookUnknownTypeError, PolarWebhookVerificationError } = webhooks;
