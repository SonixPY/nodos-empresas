import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";

// Formulario público de consulta de nodoscompliance.com → lead en el Panel.
// Entra por el servidor (service role) para no abrir la tabla al público:
// valida, frena spam (campo trampa + límite por IP) y guarda solo lo necesario.

const ORIGENES_WEB = ["https://nodoscompliance.com", "https://www.nodoscompliance.com"];
const TEMAS = ["cripto-compliance", "empresa-familiar", "finanzas", "apps", "otro"];
const MAX_POR_HORA = 3;

function cors(origin: string | null) {
  const permitido = origin && (ORIGENES_WEB.includes(origin) || /^http:\/\/localhost(:\d+)?$/.test(origin)) ? origin : ORIGENES_WEB[0];
  return {
    "Access-Control-Allow-Origin": permitido,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    Vary: "Origin",
  };
}

const texto = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

export async function OPTIONS(request: Request) {
  return new NextResponse(null, { status: 204, headers: cors(request.headers.get("origin")) });
}

export async function POST(request: Request) {
  const headers = cors(request.headers.get("origin"));
  const responder = (status: number, body: object) => NextResponse.json(body, { status, headers });

  const b = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!b) return responder(400, { message: "Pedido inválido." });

  // Campo trampa: los humanos no lo ven; si viene lleno, es un bot. Respondemos OK sin guardar.
  if (texto(b.sitio_web, 200)) return responder(200, { ok: true });

  const nombre = texto(b.nombre, 120);
  const email = texto(b.email, 160).toLowerCase();
  const telefono = texto(b.telefono, 40);
  const empresa = texto(b.empresa, 160);
  const mensaje = texto(b.mensaje, 2000);
  const tema = TEMAS.includes(texto(b.tema, 40)) ? texto(b.tema, 40) : "otro";

  if (nombre.length < 2) return responder(400, { message: "Contanos tu nombre." });
  if (!email && !telefono) return responder(400, { message: "Dejanos un email o un WhatsApp para responderte." });
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return responder(400, { message: "Ese email no parece válido." });
  if (mensaje.length < 10) return responder(400, { message: "Contanos un poco más qué necesitás." });
  if (b.consentimiento !== true) return responder(400, { message: "Necesitamos que aceptes el aviso de privacidad." });

  const ip = (request.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "desconocido";
  const sal = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || "nodos";
  const ip_hash = createHash("sha256").update(`${sal}:${ip}`).digest("hex").slice(0, 32);

  let admin;
  try {
    admin = createSupabaseAdminClient();
  } catch {
    return responder(500, { message: "El formulario no está disponible ahora. Escribinos a contacto@nodoscompliance.com." });
  }

  const desde = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count } = await admin.from("leads").select("id", { count: "exact", head: true }).eq("ip_hash", ip_hash).gte("created_at", desde);
  if ((count ?? 0) >= MAX_POR_HORA) return responder(429, { message: "Recibimos varias consultas desde tu conexión. Probá de nuevo en un rato." });

  const { data, error } = await admin
    .from("leads")
    .insert({
      nombre,
      email: email || null,
      telefono: telefono || null,
      empresa: empresa || null,
      tema,
      mensaje,
      origen: "sitio",
      consentimiento: true,
      ip_hash,
      creado_por: null,
    })
    .select("id")
    .single();
  if (error) return responder(500, { message: "No pudimos guardar tu consulta. Escribinos a contacto@nodoscompliance.com." });

  await admin.from("lead_actividades").insert({ lead_id: data.id, tipo: "sistema", texto: "Consulta recibida desde el formulario de nodoscompliance.com.", autor: null });
  return responder(200, { ok: true });
}
