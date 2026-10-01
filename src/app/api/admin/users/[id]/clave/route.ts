import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { requireAdmin } from "@/lib/nodos/adminApi";

/** El administrador define una contraseña (temporal) para una cuenta. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const check = await requireAdmin();
  if (!check.ok) return NextResponse.json({ message: check.message }, { status: check.status });

  const body = (await request.json().catch(() => null)) as { clave?: unknown } | null;
  const clave = typeof body?.clave === "string" ? body.clave : "";
  if (clave.length < 8 || clave.length > 72) {
    return NextResponse.json({ message: "La contraseña necesita entre 8 y 72 caracteres." }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();
  const { error } = await admin.auth.admin.updateUserById(id, { password: clave });
  if (error) return NextResponse.json({ message: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
