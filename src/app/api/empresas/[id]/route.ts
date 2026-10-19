import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { BUCKET_ARCHIVOS_EMPRESAS, borrarCarpeta } from "@/lib/nodos/storage";
import { origenValido } from "@/lib/nodos/cuentaApi";
import { mensajeError } from "@/lib/nodos/errores";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Elimina una empresa con todo lo suyo: primero sus archivos en Storage
 * (<dueño>/<empresa>/…) y después la fila (el `on delete cascade` borra
 * accionistas, vencimientos, documentos, poderes, archivo, etc.).
 *
 * Permiso: todo se hace con la sesión de quien llama (sin service role), así
 * que RLS (`puede_acceder` en la tabla y `archivo_puede_acceder` en Storage)
 * decide si puede ver y borrar la empresa y sus archivos.
 */
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!origenValido(request)) return NextResponse.json({ message: "Origen no permitido." }, { status: 403 });
  const { id } = await params;
  if (!UUID.test(id)) return NextResponse.json({ message: "Empresa inválida." }, { status: 400 });

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ message: "Tu sesión venció. Volvé a ingresar." }, { status: 401 });

  const { data: perfil } = await supabase.from("profiles").select("acceso_empresas, suspendido").eq("id", user.id).maybeSingle();
  if (perfil && (perfil.suspendido === true || perfil.acceso_empresas === false)) {
    return NextResponse.json({ message: "Tu cuenta no tiene acceso a NODOS Empresas." }, { status: 403 });
  }

  const { data: empresa, error: errEmpresa } = await supabase.from("empresas").select("id, user_id").eq("id", id).maybeSingle();
  if (errEmpresa) return NextResponse.json({ message: mensajeError(errEmpresa) }, { status: 500 });
  if (!empresa) return NextResponse.json({ message: "No se encontró la empresa o no tenés acceso." }, { status: 404 });

  // Doble control explícito con la misma regla que usa RLS.
  const { data: acceso, error: errAcceso } = await supabase.rpc("puede_acceder", { dueno: empresa.user_id });
  if (errAcceso || acceso !== true) return NextResponse.json({ message: "No tenés permiso para eliminar esta empresa." }, { status: 403 });

  try {
    await borrarCarpeta(supabase, BUCKET_ARCHIVOS_EMPRESAS, `${empresa.user_id}/${empresa.id}`);
  } catch (e) {
    return NextResponse.json(
      { message: `No se pudieron borrar los archivos de la empresa: ${mensajeError(e)} La empresa no se eliminó.` },
      { status: 500 }
    );
  }

  const { error, count } = await supabase.from("empresas").delete({ count: "exact" }).eq("id", empresa.id);
  if (error) return NextResponse.json({ message: mensajeError(error) }, { status: 500 });
  if (!count) return NextResponse.json({ message: "No tenés permiso para eliminar esta empresa." }, { status: 403 });
  return NextResponse.json({ ok: true });
}
