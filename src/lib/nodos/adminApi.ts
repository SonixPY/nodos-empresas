import { createSupabaseServerClient } from "@/lib/supabaseServer";

/** Verifica que quien llama tenga sesión y sea administrador. */
export async function requireAdmin() {
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

export interface CuentaAdmin {
  id: string;
  email: string;
  nombre: string | null;
  usuario: string | null;
  created_at: string;
  last_sign_in_at: string | null;
  confirmed_at: string | null;
  is_admin: boolean;
  acceso_finanzas: boolean;
  acceso_empresas: boolean;
  suspendido: boolean;
}

/** Campos que el panel puede modificar. */
export interface CambiosCuenta {
  nombre?: string | null;
  usuario?: string | null;
  email?: string;
  is_admin?: boolean;
  acceso_finanzas?: boolean;
  acceso_empresas?: boolean;
  suspendido?: boolean;
}

export function limpiarCambios(body: unknown): CambiosCuenta | string {
  if (!body || typeof body !== "object") return "Pedido inválido.";
  const b = body as Record<string, unknown>;
  const out: CambiosCuenta = {};
  for (const k of ["is_admin", "acceso_finanzas", "acceso_empresas", "suspendido"] as const) {
    if (k in b) {
      if (typeof b[k] !== "boolean") return `El campo ${k} tiene que ser verdadero o falso.`;
      out[k] = b[k] as boolean;
    }
  }
  if ("nombre" in b) {
    if (b.nombre !== null && typeof b.nombre !== "string") return "Nombre inválido.";
    out.nombre = typeof b.nombre === "string" ? b.nombre.trim().slice(0, 120) || null : null;
  }
  if ("usuario" in b) {
    if (b.usuario === null || b.usuario === "") out.usuario = null;
    else if (typeof b.usuario !== "string" || !/^[a-z0-9._]{3,20}$/.test(b.usuario.trim().toLowerCase()))
      return "El usuario lleva de 3 a 20 caracteres: letras minúsculas, números, punto o guion bajo.";
    else out.usuario = b.usuario.trim().toLowerCase();
  }
  if ("email" in b) {
    if (typeof b.email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(b.email.trim())) return "Email inválido.";
    out.email = b.email.trim().toLowerCase();
  }
  if (Object.keys(out).length === 0) return "No hay cambios para guardar.";
  return out;
}
