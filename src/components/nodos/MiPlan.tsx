"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import PlanVista, { type Confirmacion } from "@/components/nodos/PlanVista";
import { useToast } from "@/components/ToastProvider";
import { urlPagos, type EstadoPlan, type Periodo } from "@/lib/nodos/suscripciones";

// "Mi plan" dentro de Mi cuenta (idéntico en las dos apps). Lee y paga contra
// las rutas /api/pagos/* de NODOS Empresas con la sesión compartida. Nada
// sensible se guarda en el navegador: el estado se pide de nuevo cada vez.

const INTENTOS_CONFIRMACION = 8;
const ESPERA_MS = 3000;

async function pedir<T>(ruta: string, init?: RequestInit): Promise<{ ok: boolean; status: number; j: T | null }> {
  const res = await fetch(urlPagos(ruta), { credentials: "include", cache: "no-store", ...init }).catch(() => null);
  const j = (await res?.json().catch(() => null)) as T | null;
  return { ok: !!res?.ok, status: res?.status ?? 0, j };
}

function PlanContenido() {
  const params = useSearchParams();
  const router = useRouter();
  const { showToast } = useToast();
  const [estado, setEstado] = useState<EstadoPlan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [confirmacion, setConfirmacion] = useState<Confirmacion>(params.get("pago") === "ok" ? "esperando" : "no");
  const intentos = useRef(0);
  const desplazado = useRef(false);

  const cargar = useCallback(async () => {
    const r = await pedir<EstadoPlan & { message?: string }>("/api/pagos/estado");
    if (!r.ok || !r.j) {
      setError(r.j?.message ?? "Probá recargar la página en un rato.");
      return null;
    }
    setError(null);
    setEstado(r.j);
    return r.j;
  }, []);

  // Si se llegó con #plan (desde el aviso de plan o después de pagar), se
  // baja hasta la sección cuando termina de cargar.
  useEffect(() => {
    if (desplazado.current || (!estado && !error)) return;
    if (window.location.hash !== "#plan" && confirmacion === "no") return;
    desplazado.current = true;
    requestAnimationFrame(() => document.getElementById("plan")?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }, [estado, error, confirmacion]);

  useEffect(() => {
    let vivo = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const pagado = (e: EstadoPlan | null) => e?.proveedor === "polar" && (e.estado === "activa" || e.estado === "cancelada");
    const ciclo = async () => {
      const e = await cargar();
      if (!vivo || confirmacion !== "esperando") return;
      if (pagado(e)) {
        setConfirmacion("listo");
        router.replace("/cuenta#plan");
        return;
      }
      intentos.current += 1;
      if (intentos.current >= INTENTOS_CONFIRMACION) setConfirmacion("demora");
      else timer = setTimeout(ciclo, ESPERA_MS);
    };
    ciclo();
    return () => {
      vivo = false;
      if (timer) clearTimeout(timer);
    };
  }, [cargar, confirmacion, router]);

  async function irA(ruta: string, cuerpo: object, clave: string) {
    setOcupado(clave);
    const r = await pedir<{ url?: string; message?: string }>(ruta, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(cuerpo),
    });
    if (r.ok && r.j?.url && r.j.url.startsWith("https://")) {
      window.location.href = r.j.url;
      return;
    }
    setOcupado(null);
    showToast(r.j?.message ?? "No pudimos abrir el pago. Probá de nuevo.", "error");
  }

  return (
    <PlanVista
      embebido
      estado={estado}
      error={error}
      confirmacion={confirmacion}
      ocupado={ocupado}
      onTarjeta={(plan: string, periodo: Periodo) => irA("/api/pagos/checkout", { plan, periodo }, `${plan}:${periodo}`)}
      onPortal={() => irA("/api/pagos/portal", {}, "portal")}
    />
  );
}

/** Sección "Mi plan" de Mi cuenta: estado de la suscripción, planes y pago. */
export default function MiPlan() {
  return (
    <Suspense fallback={null}>
      <PlanContenido />
    </Suspense>
  );
}
