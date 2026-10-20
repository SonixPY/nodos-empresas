"use client";

import { useEffect, useState } from "react";
import { Check, Download, FileJson, FileSpreadsheet, Loader2, Settings } from "lucide-react";
import { useEmpresas } from "@/lib/data";
import { useToast } from "@/components/ToastProvider";
import { mensajeError } from "@/lib/nodos/errores";
import { EXPORTABLES, descargarCsv } from "@/lib/exportar";
import { guardarPreferencias, leerPreferencias, type PreferenciasEmpresas } from "@/lib/preferencias";

const CLAVE_BANDA = "nodos:banda-minimizada";

/** Configuración de NODOS Empresas: preferencias y descargas de tu información. */
export default function ConfiguracionPage() {
  const { showToast } = useToast();
  const empresas = useEmpresas();
  const [pref, setPref] = useState<PreferenciasEmpresas | null>(null);
  const [bandaMin, setBandaMin] = useState(true);
  const [ocupado, setOcupado] = useState<string | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPref(leerPreferencias());
    try {
      setBandaMin(localStorage.getItem(CLAVE_BANDA) !== "0");
    } catch {
      /* sin almacenamiento */
    }
  }, []);

  function cambiar(p: PreferenciasEmpresas) {
    setPref(p);
    guardarPreferencias(p);
    showToast("Preferencia guardada.");
  }

  function cambiarBanda(min: boolean) {
    setBandaMin(min);
    try {
      localStorage.setItem(CLAVE_BANDA, min ? "1" : "0");
    } catch {
      /* sin almacenamiento */
    }
    showToast("Preferencia guardada.");
  }

  async function csv(clave: string) {
    setOcupado(clave);
    try {
      const n = await descargarCsv(clave);
      showToast(`Descargado: ${n} ${n === 1 ? "fila" : "filas"}.`);
    } catch (err) {
      showToast(`No se pudo descargar: ${mensajeError(err)}`, "error");
    } finally {
      setOcupado(null);
    }
  }

  async function json() {
    setOcupado("json");
    try {
      const res = await fetch("/api/cuenta/exportar", { cache: "no-store" });
      if (!res.ok) throw new Error(((await res.json().catch(() => null)) as { message?: string } | null)?.message ?? "Probá de nuevo.");
      const blob = await res.blob();
      const nombre = /filename="([^"]+)"/.exec(res.headers.get("Content-Disposition") ?? "")?.[1] ?? "nodos-mis-datos.json";
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = nombre;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      showToast("Respaldo descargado.");
    } catch (err) {
      showToast(`No se pudo descargar: ${mensajeError(err)}`, "error");
    } finally {
      setOcupado(null);
    }
  }

  return (
    <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-6">
        <h1 className="flex items-center gap-2">
          <Settings size={26} className="text-cobre" aria-hidden /> Configuración
        </h1>
        <p className="mt-1 text-sm text-carbon/60">Cómo querés trabajar en NODOS Empresas y la descarga de tu información.</p>
      </header>

      <div className="space-y-6">
        <section className="card space-y-4">
          <h2 className="text-xl">Preferencias</h2>
          {!pref ? (
            <p className="text-sm text-carbon/60">Cargando...</p>
          ) : (
            <>
              <div>
                <label className="field-label" htmlFor="pref-empresa">
                  Empresa por defecto
                </label>
                <select
                  id="pref-empresa"
                  className="input sm:max-w-md"
                  value={pref.empresaPorDefecto ?? ""}
                  onChange={(e) => cambiar({ ...pref, empresaPorDefecto: e.target.value || null })}
                >
                  <option value="">Ninguna (ver todas)</option>
                  {empresas.data.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.denominacion}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-carbon/55">Se elige sola al abrir Vencimientos y Documentos.</p>
              </div>
              <Opciones
                titulo="Vencimientos se abre en"
                valor={pref.vistaVencimientos}
                opciones={[
                  ["calendario", "Calendario"],
                  ["lista", "Lista"],
                ]}
                onCambio={(v) => cambiar({ ...pref, vistaVencimientos: v as PreferenciasEmpresas["vistaVencimientos"] })}
              />
              <Opciones
                titulo="Banda verde del Resumen"
                valor={bandaMin ? "min" : "abierta"}
                opciones={[
                  ["abierta", "Abierta"],
                  ["min", "Minimizada"],
                ]}
                onCambio={(v) => cambiarBanda(v === "min")}
              />
              <p className="text-xs text-carbon/50">Estas preferencias se guardan en este navegador.</p>
            </>
          )}
        </section>

        <section className="card space-y-4">
          <div>
            <h2 className="flex items-center gap-2 text-xl">
              <Download size={19} className="text-cobre" aria-hidden /> Descargas
            </h2>
            <p className="mt-1 text-sm text-carbon/60">En CSV, para abrir en Excel o Google Sheets. Solo lo que podés ver en tu cuenta.</p>
          </div>
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {EXPORTABLES.map((ex) => (
              <li key={ex.clave} className="flex items-start gap-3 rounded-md border p-3" style={{ borderColor: "var(--line)" }}>
                <FileSpreadsheet size={18} className="mt-0.5 shrink-0 text-cobre" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-carbon">{ex.titulo}</p>
                  <p className="text-xs text-carbon/55">{ex.descripcion}</p>
                </div>
                <button type="button" className="btn btn-ghost shrink-0" disabled={!!ocupado} onClick={() => csv(ex.clave)} aria-label={`Descargar ${ex.titulo}`}>
                  {ocupado === ex.clave ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />} CSV
                </button>
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap items-center gap-3 border-t pt-4" style={{ borderColor: "var(--line)" }}>
            <button type="button" className="btn btn-primary" disabled={!!ocupado} onClick={json}>
              {ocupado === "json" ? <Loader2 size={15} className="animate-spin" /> : <FileJson size={15} />} Respaldo completo (JSON)
            </button>
            <p className="text-xs text-carbon/55">Todo lo de tu cuenta NODOS (Empresas y Finanzas) en un solo archivo.</p>
          </div>
        </section>
      </div>
    </main>
  );
}

function Opciones({
  titulo,
  valor,
  opciones,
  onCambio,
}: {
  titulo: string;
  valor: string;
  opciones: [string, string][];
  onCambio: (v: string) => void;
}) {
  return (
    <div>
      <p className="field-label">{titulo}</p>
      <div className="segmented" role="group" aria-label={titulo}>
        {opciones.map(([v, l]) => (
          <button key={v} type="button" aria-pressed={valor === v} className={valor === v ? "active" : ""} onClick={() => onCambio(v)}>
            {valor === v && <Check size={13} aria-hidden />} {l}
          </button>
        ))}
      </div>
    </div>
  );
}
