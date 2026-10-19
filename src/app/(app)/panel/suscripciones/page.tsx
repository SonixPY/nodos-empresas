"use client";

import { useCallback, useEffect, useState } from "react";
import SuscripcionesAdmin, { type AccionesSuscripciones } from "@/components/panel/SuscripcionesAdmin";
import { useToast } from "@/components/ToastProvider";
import type { ResumenAdmin } from "@/lib/nodos/suscripciones";

// NODOS Panel → Suscripciones (solo administradores: lo verifica el layout
// del Panel en el servidor, cada ruta /api/admin/* y la base).

async function enviar(ruta: string, metodo: "POST" | "PATCH", cuerpo: object): Promise<string | null> {
  const res = await fetch(ruta, {
    method: metodo,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(cuerpo),
  }).catch(() => null);
  if (res?.ok) return null;
  const j = (await res?.json().catch(() => null)) as { message?: string } | null;
  return j?.message ?? "No se pudo guardar. Probá de nuevo.";
}

export default function SuscripcionesPage() {
  const { showToast } = useToast();
  const [datos, setDatos] = useState<ResumenAdmin | null>(null);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    const res = await fetch("/api/admin/suscripciones", { cache: "no-store" }).catch(() => null);
    const j = (await res?.json().catch(() => null)) as (ResumenAdmin & { message?: string }) | null;
    if (!res?.ok || !j?.cuentas) {
      setError(j?.message ?? "No se pudo cargar.");
      return;
    }
    setError(null);
    setDatos(j);
  }, []);

  useEffect(() => {
    // Carga inicial desde el servidor (no hay estado externo que sincronizar).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    cargar();
  }, [cargar]);

  const acciones: AccionesSuscripciones = {
    pagoManual: (b) => enviar("/api/admin/suscripciones/manual", "POST", b),
    cortesia: (b) => enviar("/api/admin/suscripciones/cortesia", "POST", b),
    cancelar: (b) => enviar("/api/admin/suscripciones/cancelar", "POST", b),
    editarPlan: (id, cambios) => enviar(`/api/admin/planes/${encodeURIComponent(id)}`, "PATCH", cambios),
  };

  return (
    <SuscripcionesAdmin
      datos={datos}
      error={error}
      acciones={acciones}
      onHecho={(msg) => {
        showToast(msg);
        cargar();
      }}
    />
  );
}
