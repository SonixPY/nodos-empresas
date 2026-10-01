"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useEmpresas, useObligaciones, generarCalendario } from "@/lib/data";
import { useToast } from "@/components/ToastProvider";
import { aplicarCambio } from "@/components/ObligacionesLista";
import NovedadesEmpresas from "@/components/NovedadesEmpresas";
import ResumenEmpresasVista from "@/components/resumen/ResumenEmpresasVista";

/** Resumen: banda de saludo con el estado de vencimientos y las novedades
 * para tus empresas (mismo formato que el Resumen de NODOS Finanzas); debajo
 * cifras clave, lo próximo que vence y accesos rápidos. El detalle de cada
 * empresa queda en su ficha y el año completo en Vencimientos. */
export default function ResumenPage() {
  const { showToast } = useToast();
  const empresas = useEmpresas();
  const obligaciones = useObligaciones(null);
  const [generando, setGenerando] = useState(false);
  const [nombre, setNombre] = useState<string | null>(null);
  const [recientes, setRecientes] = useState<Set<string>>(() => new Set());
  const anio = new Date().getFullYear();

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return;
      const { data: p } = await supabase.from("profiles").select("nombre, usuario").eq("id", data.user.id).maybeSingle();
      setNombre((p?.nombre as string | null)?.split(" ")[0] ?? (p?.usuario as string | null) ?? null);
    });
  }, []);

  const loading = empresas.loading || obligaciones.loading;

  async function generarTodos() {
    setGenerando(true);
    let nuevas = 0;
    for (const e of empresas.data) {
      for (const y of [anio, anio + 1]) {
        const r = await generarCalendario(e, y);
        if (r.error) {
          setGenerando(false);
          return showToast(`No se pudo generar: ${r.error}`, "error");
        }
        nuevas += r.nuevas;
      }
    }
    await obligaciones.reload();
    setGenerando(false);
    showToast(nuevas > 0 ? `${nuevas} vencimientos agregados.` : "Los calendarios ya estaban al día.");
  }

  return (
    <ResumenEmpresasVista
      nombre={nombre}
      empresas={empresas.data}
      obligaciones={obligaciones.data}
      loading={loading}
      error={empresas.error || obligaciones.error}
      recientes={recientes}
      onChange={(id, patch) => {
        if (patch?.estado === "hecho") setRecientes((r) => new Set(r).add(id));
        obligaciones.setData((prev) => aplicarCambio(prev, id, patch));
      }}
      novedades={(empresas.loading || empresas.data.length > 0) && <NovedadesEmpresas empresas={empresas.data} loading={empresas.loading} />}
      pie={
        <>
          ¿Falta algún vencimiento?{" "}
          <button type="button" className="font-medium text-cobre-hover hover:underline disabled:opacity-50" onClick={generarTodos} disabled={generando || loading}>
            {generando ? "Generando..." : `Actualizar calendarios ${anio}–${anio + 1}`}
          </button>
        </>
      }
    />
  );
}
