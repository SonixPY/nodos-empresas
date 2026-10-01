import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { SITIOS } from "@/lib/nodos/sitios";

// Utilidades de los endpoints /api/cuenta/*: los usa la pantalla única de
// ingreso de nodoscompliance.com (otro origen del mismo sitio) y las apps.
// Las cookies de sesión las escribe el servidor con Domain=.nodoscompliance.com.

const ORIGENES = [
  SITIOS.inicio.url,
  "https://www.nodoscompliance.com",
  SITIOS.finanzas.url,
  SITIOS.empresas.url,
];

export function origenPermitido(origin: string | null): boolean {
  return !!origin && (ORIGENES.includes(origin) || /^http:\/\/localhost(:\d+)?$/.test(origin));
}

export function corsCuenta(request: Request, metodos = "GET, POST, PATCH, OPTIONS") {
  const origin = request.headers.get("origin");
  return {
    "Access-Control-Allow-Origin": origenPermitido(origin) ? origin! : SITIOS.inicio.url,
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Methods": metodos,
    "Access-Control-Allow-Headers": "Content-Type",
    "Cache-Control": "no-store",
    Vary: "Origin",
  };
}

/** Respuesta JSON con CORS. */
export function responder(request: Request, status: number, body: object) {
  return NextResponse.json(body, { status, headers: corsCuenta(request) });
}

export function preflight(request: Request) {
  return new NextResponse(null, { status: 204, headers: corsCuenta(request) });
}

/**
 * Los POST solo se aceptan desde las páginas NODOS (o sin Origin, mismo
 * origen en navegadores viejos): evita que otra web abra sesiones a ciegas.
 */
export function origenValido(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  if (origenPermitido(origin)) return true;
  return origin === new URL(request.url).origin;
}

export function hashIp(request: Request): string {
  const ip = (request.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "desconocido";
  const sal = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || "nodos";
  return createHash("sha256").update(`${sal}:${ip}`).digest("hex").slice(0, 32);
}

export const texto = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

export async function leerJson(request: Request): Promise<Record<string, unknown> | null> {
  return (await request.json().catch(() => null)) as Record<string, unknown> | null;
}
