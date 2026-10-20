"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { SITIOS, cookieDomainFor } from "@/lib/nodos/sitios";

export interface PerfilVisible {
  nombre: string | null;
  usuario: string | null;
  isAdmin: boolean;
  /** "icono:color" (ver lib/nodos/avatares). */
  avatar?: string | null;
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
      type Fila = { nombre?: string | null; usuario?: string | null; is_admin?: boolean | null; avatar?: string | null };
      // Si una migración todavía no corrió (avatar, usuario), se pide lo que
      // exista sin perder el rol de admin.
      let data: Fila | null = null;
      for (const columnas of ["nombre, usuario, is_admin, avatar", "nombre, usuario, is_admin", "nombre, is_admin"]) {
        const r = await supabase.from("profiles").select(columnas).eq("id", user.id).maybeSingle<Fila>();
        if (!r.error) {
          data = r.data;
          break;
        }
      }
      if (!activo) return;
      setPerfil({
        nombre: data?.nombre ?? (user.user_metadata?.nombre as string | undefined) ?? null,
        usuario: data?.usuario ?? null,
        isAdmin: !!data?.is_admin,
        avatar: data?.avatar ?? null,
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
