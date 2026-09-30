import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";

async function requireAdmin() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, status: 401, message: "No autenticado.", callerId: null };

  const { data: profile } = await supabase.from("profiles").select("is_admin").eq("id", user.id).maybeSingle();
  if (!profile?.is_admin)
    return { ok: false as const, status: 403, message: "No tenés permisos de administrador.", callerId: user.id };

  return { ok: true as const, callerId: user.id };
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const check = await requireAdmin();
  if (!check.ok) return NextResponse.json({ message: check.message }, { status: check.status });

  if (id === check.callerId) {
    return NextResponse.json({ message: "No te podés eliminar a vos mismo desde acá." }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();
  // Borra el usuario de auth.users; el `on delete cascade` de los `user_id`
  // se encarga de borrar también todos sus datos (empresas, accionistas,
  // vencimientos, documentos) y su fila de `profiles`.
  const { error } = await admin.auth.admin.deleteUser(id);
  if (error) return NextResponse.json({ message: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
