import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";

async function requireAdmin() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, status: 401, message: "No autenticado." };

  const { data: profile } = await supabase.from("profiles").select("is_admin").eq("id", user.id).maybeSingle();
  if (!profile?.is_admin) return { ok: false as const, status: 403, message: "No tenés permisos de administrador." };

  return { ok: true as const };
}

export async function GET() {
  const check = await requireAdmin();
  if (!check.ok) return NextResponse.json({ message: check.message }, { status: check.status });

  const admin = createSupabaseAdminClient();
  const { data: usersData, error: usersError } = await admin.auth.admin.listUsers({ perPage: 1000 });
  if (usersError) return NextResponse.json({ message: usersError.message }, { status: 500 });

  const { data: profiles } = await admin.from("profiles").select("id, is_admin");
  const adminIds = new Set((profiles ?? []).filter((p) => p.is_admin).map((p) => p.id));

  const users = usersData.users
    .map((u) => ({
      id: u.id,
      email: u.email ?? "",
      created_at: u.created_at,
      last_sign_in_at: u.last_sign_in_at ?? null,
      confirmed_at: u.email_confirmed_at ?? null,
      is_admin: adminIds.has(u.id),
    }))
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1));

  return NextResponse.json({ users });
}
