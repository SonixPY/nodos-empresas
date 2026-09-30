import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { limpiarCambios, requireAdmin } from "@/lib/nodos/adminApi";

/** Modifica una cuenta: rol, acceso por app, suspensión, nombre o email. Vale para las tres páginas NODOS. */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const check = await requireAdmin();
  if (!check.ok) return NextResponse.json({ message: check.message }, { status: check.status });

  const cambios = limpiarCambios(await request.json().catch(() => null));
  if (typeof cambios === "string") return NextResponse.json({ message: cambios }, { status: 400 });

  if (id === check.callerId && (cambios.is_admin === false || cambios.suspendido === true)) {
    return NextResponse.json(
      { message: "No podés quitarte el rol de administrador ni suspender tu propia cuenta." },
      { status: 400 }
    );
  }

  const admin = createSupabaseAdminClient();

  if (cambios.email || cambios.suspendido !== undefined) {
    const { error } = await admin.auth.admin.updateUserById(id, {
      ...(cambios.email ? { email: cambios.email, email_confirm: true } : {}),
      // Suspender también bloquea el inicio de sesión en Supabase Auth.
      ...(cambios.suspendido !== undefined ? { ban_duration: cambios.suspendido ? "876000h" : "none" } : {}),
    });
    if (error) return NextResponse.json({ message: error.message }, { status: 500 });
  }

  const { error } = await admin.from("profiles").update(cambios).eq("id", id);
  if (error) {
    const pendiente = /column|schema cache/i.test(error.message);
    return NextResponse.json(
      {
        message: pendiente
          ? "Falta correr la migración de cuentas NODOS (000_cuentas_nodos.sql) en Supabase."
          : error.message,
      },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const check = await requireAdmin();
  if (!check.ok) return NextResponse.json({ message: check.message }, { status: check.status });

  if (id === check.callerId) {
    return NextResponse.json({ message: "No te podés eliminar a vos mismo desde acá." }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();
  // Borra la cuenta de auth.users; el `on delete cascade` borra sus datos en
  // Finanzas y en Empresas, y su fila de `profiles`.
  const { error } = await admin.auth.admin.deleteUser(id);
  if (error) return NextResponse.json({ message: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
