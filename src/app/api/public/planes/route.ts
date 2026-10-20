import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";

// Planes activos para la sección Planes de nodoscompliance.com: nombre,
// descripción, precios en guaraníes y beneficios. Son datos públicos (los
// mismos que ve cualquiera en el sitio); nada de cuentas ni de Polar. Se
// editan desde Panel → Suscripciones.

const ORIGENES_WEB = ["https://nodoscompliance.com", "https://www.nodoscompliance.com"];

function cors(origin: string | null) {
  const permitido = origin && (ORIGENES_WEB.includes(origin) || /^http:\/\/localhost(:\d+)?$/.test(origin)) ? origin : ORIGENES_WEB[0];
  return {
    "Access-Control-Allow-Origin": permitido,
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    Vary: "Origin",
  };
}

export async function OPTIONS(request: Request) {
  return new NextResponse(null, { status: 204, headers: cors(request.headers.get("origin")) });
}

export async function GET(request: Request) {
  const headers = { ...cors(request.headers.get("origin")), "Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600" };
  let admin;
  try {
    admin = createSupabaseAdminClient();
  } catch {
    return NextResponse.json({ planes: [] }, { status: 200, headers });
  }
  const { data, error } = await admin.from("planes").select("*").eq("activo", true).order("orden");
  if (error) return NextResponse.json({ planes: [] }, { status: 200, headers });
  const planes = (data ?? []).map((p) => ({
    id: p.id as string,
    nombre: p.nombre as string,
    descripcion: (p.descripcion as string | null) ?? null,
    apps: (p.apps as string[]) ?? [],
    precio_mensual_gs: Number(p.precio_mensual_gs) || 0,
    precio_anual_gs: Number(p.precio_anual_gs) || 0,
    beneficios: Array.isArray(p.beneficios) ? (p.beneficios as string[]) : [],
  }));
  return NextResponse.json({ planes }, { status: 200, headers });
}
