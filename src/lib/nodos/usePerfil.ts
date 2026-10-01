"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { SITIOS, cookieDomainFor } from "@/lib/nodos/sitios";

export interface PerfilVisible {
  nombre: string | null;
  usuario: string | null;
  isAdmin: boolean;
}

/** Perfil de la cuenta logueada para el header (sin el email). */
export function usePerfil() {
  const [perfil, setPerfil] = useState<PerfilVisible | null>(null);

  useEffect(() => {
    let activo = true;
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const completo = await supabase.from("profiles").select("nombre, usuario, is_admin").eq("id", user.id).maybeSingle();
      // Sin la migración del usuario todavía corrida, no se pierde el rol de admin.
      const data: { nombre?: string | null; usuario?: string | null; is_admin?: boolean | null } | null = completo.error
        ? (await supabase.from("profiles").select("nombre, is_admin").eq("id", user.id).maybeSingle()).data
        : completo.data;
      if (!activo) return;
      setPerfil({
        nombre: data?.nombre ?? (user.user_metadata?.nombre as string | undefined) ?? null,
        usuario: data?.usuario ?? null,
        isAdmin: !!data?.is_admin,
      });
    })();
    const onCambio = (e: Event) => {
      const detalle = (e as CustomEvent<Partial<PerfilVisible>>).detail;
      setPerfil((p) => (p ? { ...p, ...detalle } : p));
    };
    window.addEventListener("nodos:perfil", onCambio);
    return () => {
      activo = false;
      window.removeEventListener("nodos:perfil", onCambio);
    };
  }, []);

  return perfil;
}

/** Cierra la sesión en las tres páginas y vuelve al inicio de NODOS. */
export async function cerrarSesion() {
  await supabase.auth.signOut();
  window.location.href = cookieDomainFor(window.location.hostname) ? SITIOS.inicio.url : "/login";
}
