import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";

/**
 * Tarea diaria (Vercel Cron, ver vercel.json): hace una consulta mínima a la
 * base para que el plan gratuito de Supabase no pause el proyecto por
 * inactividad. No lee ni devuelve datos de nadie.
 * Si está configurada la variable CRON_SECRET en Vercel, solo responde a
 * Vercel (que manda "Authorization: Bearer <CRON_SECRET>").
 */
export async function GET(request: Request) {
  const secreto = process.env.CRON_SECRET;
  if (secreto && request.headers.get("authorization") !== `Bearer ${secreto}`) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  try {
    const admin = createSupabaseAdminClient();
    const { error } = await admin.from("profiles").select("id", { count: "exact", head: true });
    if (error) return NextResponse.json({ ok: false, error: "consulta" }, { status: 500 });
    return NextResponse.json({ ok: true, fecha: new Date().toISOString() });
  } catch {
    return NextResponse.json({ ok: false, error: "configuracion" }, { status: 500 });
  }
}
