import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { paraSitio } from "@/lib/series";

// Series publicadas para la sección Series de nodoscompliance.com. Son datos
// públicos (los mismos que muestra el sitio); se editan en Panel → Series.
// Si la base no responde, el sitio usa la copia que trae en su propio HTML.

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
  const base = cors(request.headers.get("origin"));
  const ok = { ...base, "Cache-Control": "public, s-maxage=60, stale-while-revalidate=600" };
  const falla = { ...base, "Cache-Control": "no-store" };
  let admin;
  try {
    admin = createSupabaseAdminClient();
  } catch {
    return NextResponse.json({ series: null }, { status: 503, headers: falla });
  }
  const { data, error } = await admin.from("series").select("numero, titulo, descripcion, duracion, url, episodios, estado").eq("estado", "publicado").order("numero");
  if (error) return NextResponse.json({ series: null }, { status: 503, headers: falla });
  return NextResponse.json({ series: paraSitio(data ?? []) }, { status: 200, headers: ok });
}
