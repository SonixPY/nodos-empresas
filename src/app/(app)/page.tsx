"use client";

import { useEffect, useMemo, useState } from "react";
import { Building2, CalendarClock, FilePlus2 } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { useEmpresas, useObligaciones, generarCalendario } from "@/lib/data";
import { useToast } from "@/components/ToastProvider";
import { aplicarCambio } from "@/components/ObligacionesLista";
import NovedadesEmpresas from "@/components/NovedadesEmpresas";
import ResumenEmpresasVista from "@/components/resumen/ResumenEmpresasVista";
import PrimerosPasos, { usePasoVisto, usePrimerosPasosVisible, type PasoInicial } from "@/components/resumen/PrimerosPasos";

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

  // Primeros pasos: se completan solos con lo que ya está cargado.
  const [documentos, setDocumentos] = useState<number | null>(null);
  useEffect(() => {
    supabase
      .from("documentos")
      .select("id", { count: "exact", head: true })
      .then(({ count, error }) => setDocumentos(error ? 0 : (count ?? 0)));
  }, []);
  const vencimientosVistos = usePasoVisto("vencimientos");
  const pasos = useMemo<PasoInicial[]>(() => {
    const conRubro = empresas.data.some((e) => !!e.rubro);
    const sinRubro = empresas.data.find((e) => !e.rubro);
    return [
      {
        key: "empresa",
        icon: Building2,
        titulo: "Cargá tu primera empresa",
        texto: sinRubro && !conRubro
          ? `Completá el rubro de ${sinRubro.denominacion}: con eso ves novedades pensadas para su actividad.`
          : "Tipo de sociedad, rubro y mes de cierre: con eso se arma solo su calendario del año.",
        hecho: conRubro,
        accion: sinRubro && !conRubro ? { label: "Completar rubro", href: `/empresas/${sinRubro.id}` } : { label: "Cargar empresa", href: "/empresas?nueva=1" },
      },
      {
        key: "vencimientos",
        icon: CalendarClock,
        titulo: "Revisá tus vencimientos",
        texto: "Asambleas, balance, SIARA y mandatos, mes por mes. Marcá lo que ya hiciste y NODOS te avisa lo que viene.",
        hecho: vencimientosVistos || obligaciones.data.some((o) => o.estado === "hecho"),
        accion: { label: "Ver calendario", href: "/vencimientos" },
      },
      {
        key: "documento",
        icon: FilePlus2,
        titulo: "Generá tu primer documento",
        texto: "Un acta, una carta poder o una nota con los datos de la empresa ya precargados, lista para imprimir en PDF.",
        hecho: (documentos ?? 0) > 0,
        accion: { label: "Generar documento", href: "/documentos" },
      },
    ];
  }, [empresas.data, obligaciones.data, vencimientosVistos, documentos]);
  const verPasos = usePrimerosPasosVisible(pasos, loading || documentos === null);

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
      primerosPasos={verPasos ? <PrimerosPasos app="NODOS Empresas" pasos={pasos} /> : null}
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
