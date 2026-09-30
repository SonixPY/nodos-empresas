import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { requireAdmin } from "@/lib/nodos/adminApi";
import { supabaseAnonKey as supabaseAnonKey_, supabaseUrl as supabaseUrlLimpia } from "@/lib/nodos/sitios";

/** Envía a la cuenta un email para elegir una contraseña nueva. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const check = await requireAdmin();
  if (!check.ok) return NextResponse.json({ message: check.message }, { status: check.status });

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.auth.admin.getUserById(id);
  if (error || !data.user?.email) return NextResponse.json({ message: "No se encontró la cuenta." }, { status: 404 });

  // Cliente público con flujo implícito: el link del email trae la sesión en
  // el fragmento de la URL, y /nueva-clave la toma sin depender de este navegador.
  const publico = createClient(supabaseUrlLimpia(), supabaseAnonKey_(), {
    auth: { flowType: "implicit", persistSession: false, autoRefreshToken: false },
  });
  const origen = new URL(request.url).origin;
  const { error: envioError } = await publico.auth.resetPasswordForEmail(data.user.email, {
    redirectTo: `${origen}/nueva-clave`,
  });
  if (envioError) return NextResponse.json({ message: envioError.message }, { status: 500 });

  return NextResponse.json({ ok: true, email: data.user.email });
}
