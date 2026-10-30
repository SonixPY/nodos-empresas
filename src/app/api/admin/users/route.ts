import { NextResponse } from "next/server";
import type { User } from "@supabase/supabase-js";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { requireAdmin, type CuentaAdmin } from "@/lib/nodos/adminApi";
import { mensajeErrorAuth } from "@/lib/nodos/errores";

type Perfil = {
  id: string;
  is_admin: boolean | null;
  nombre?: string | null;
  usuario?: string | null;
  acceso_finanzas?: boolean | null;
  acceso_empresas?: boolean | null;
  suspendido?: boolean | null;
};

export async function GET() {
  const check = await requireAdmin();
  if (!check.ok) return NextResponse.json({ message: check.message }, { status: check.status });

  const admin = createSupabaseAdminClient();
  // Supabase Auth devuelve de a 1.000 cuentas como máximo: se recorren todas
  // las páginas (antes la cuenta 1.001 en adelante no aparecía en el panel).
  const cuentas: User[] = [];
  for (let page = 1; page <= 100; page++) {
    const { data, error: usersError } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (usersError) return NextResponse.json({ message: mensajeErrorAuth(usersError, "No se pudieron cargar las cuentas.") }, { status: 500 });
    cuentas.push(...data.users);
    if (data.users.length < 1000) break;
  }

  // Si la migración de cuentas NODOS todavía no corrió, caemos a las columnas básicas.
  let migracionPendiente = false;
  let perfiles: Perfil[] = [];
  const completo = await admin.from("profiles").select("id, is_admin, nombre, usuario, acceso_finanzas, acceso_empresas, suspendido");
  if (completo.error) {
    migracionPendiente = true;
    const basico = await admin.from("profiles").select("id, is_admin");
    perfiles = (basico.data ?? []) as Perfil[];
  } else {
    perfiles = (completo.data ?? []) as Perfil[];
  }
  const porId = new Map(perfiles.map((p) => [p.id, p]));

  const users: CuentaAdmin[] = cuentas
    .map((u) => {
      const p = porId.get(u.id);
      return {
        id: u.id,
        email: u.email ?? "",
        nombre: p?.nombre ?? null,
        usuario: p?.usuario ?? null,
        created_at: u.created_at,
        last_sign_in_at: u.last_sign_in_at ?? null,
        confirmed_at: u.email_confirmed_at ?? null,
        is_admin: !!p?.is_admin,
        acceso_finanzas: p?.acceso_finanzas !== false,
        acceso_empresas: p?.acceso_empresas !== false,
        suspendido: !!p?.suspendido,
      };
    })
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1));

  return NextResponse.json({ users, migracionPendiente, yo: check.callerId });
}
