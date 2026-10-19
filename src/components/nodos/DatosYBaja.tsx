"use client";

// "Tus datos" en Mi cuenta: descarga de datos y baja de la cuenta. Este
// archivo es idéntico en finanzas-app y nodos-empresas: si lo cambiás,
// cambialo en los dos.

import { useState } from "react";
import { AlertTriangle, Download, Loader2, Trash2, X } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { SITIOS } from "@/lib/nodos/sitios";
import { mensajeError } from "@/lib/nodos/errores";

/** Descargar mis datos y eliminar la cuenta (con confirmación en línea, sin ventanas del navegador). */
export default function DatosYBaja({ email, usuario }: { email: string; usuario: string }) {
  const [abierto, setAbierto] = useState(false);
  const [confirmacion, setConfirmacion] = useState("");
  const [clave, setClave] = useState("");
  const [eliminando, setEliminando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [descargando, setDescargando] = useState(false);
  const [errorDescarga, setErrorDescarga] = useState<string | null>(null);

  async function descargar() {
    setDescargando(true);
    setErrorDescarga(null);
    try {
      const res = await fetch("/api/cuenta/exportar", { cache: "no-store" });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { message?: string } | null;
        return setErrorDescarga(data?.message ?? "No pudimos preparar la descarga. Probá de nuevo.");
      }
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
    } catch (err) {
      setErrorDescarga(mensajeError(err));
    } finally {
      setDescargando(false);
    }
  }

  const escrito = confirmacion.trim().toLowerCase().replace(/^@/, "");
  const coincide = !!escrito && (escrito === email.toLowerCase() || (!!usuario && escrito === usuario.toLowerCase()));

  function cerrar() {
    setAbierto(false);
    setConfirmacion("");
    setClave("");
    setError(null);
  }

  async function eliminar(e: React.FormEvent) {
    e.preventDefault();
    if (!coincide || !clave) return;
    setEliminando(true);
    setError(null);
    try {
      const res = await fetch("/api/cuenta/eliminar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmacion: escrito, clave }),
      });
      const data = (await res.json().catch(() => null)) as { message?: string } | null;
      if (!res.ok) {
        setEliminando(false);
        setClave("");
        return setError(data?.message ?? "No pudimos eliminar la cuenta. Probá de nuevo.");
      }
      await supabase.auth.signOut({ scope: "local" }).catch(() => null);
      // Sitio principal (otro dominio): la cuenta ya no existe en ninguna app.
      window.location.replace(new URL("/?cuenta=eliminada", SITIOS.inicio.url).toString());
    } catch (err) {
      setEliminando(false);
      setError(mensajeError(err));
    }
  }

  return (
    <div className="card space-y-4">
      <h3 className="flex items-center gap-2">
        <Download size={17} className="text-cobre" /> Tus datos
      </h3>
      <p className="text-sm text-carbon/70">
        Descargá una copia de todo lo que cargaste en NODOS Finanzas y NODOS Empresas, en un archivo JSON. Incluye la lista de archivos subidos
        al Archivo de tus empresas; los archivos en sí se descargan desde la ficha de cada empresa.
      </p>
      <button type="button" className="btn btn-ghost w-fit" onClick={descargar} disabled={descargando}>
        {descargando ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />} Descargar mis datos
      </button>
      {errorDescarga && (
        <p className="text-sm text-bad" role="alert">
          {errorDescarga}
        </p>
      )}

      <div className="border-t border-[var(--line)] pt-4">
        {!abierto ? (
          <>
            <p className="text-sm text-carbon/70">
              Eliminar tu cuenta borra para siempre tu acceso a las tres páginas y todos tus datos: inversiones, gastos, empresas, vencimientos,
              documentos y archivos subidos.
            </p>
            <button type="button" className="btn btn-ghost mt-3 text-bad" onClick={() => setAbierto(true)}>
              <Trash2 size={15} /> Eliminar mi cuenta
            </button>
          </>
        ) : (
          <form onSubmit={eliminar} className="space-y-3 rounded-lg border border-bad/30 bg-bad/5 p-4">
            <p className="flex gap-2 text-sm text-carbon/80">
              <AlertTriangle size={16} className="mt-0.5 shrink-0 text-bad" />
              <span>
                Esto no se puede deshacer. Si querés guardar una copia, descargá tus datos antes de seguir.
              </span>
            </p>
            <div>
              <label className="field-label" htmlFor="baja-confirmacion">
                Para confirmar, escribí {usuario ? <b>@{usuario}</b> : "tu email"}
                {usuario ? " o tu email" : ""}
              </label>
              <input
                id="baja-confirmacion"
                className="input"
                value={confirmacion}
                autoComplete="off"
                autoCapitalize="none"
                spellCheck={false}
                onChange={(e) => setConfirmacion(e.target.value)}
              />
            </div>
            <div>
              <label className="field-label" htmlFor="baja-clave">
                Tu contraseña
              </label>
              <input
                id="baja-clave"
                type="password"
                className="input"
                autoComplete="current-password"
                value={clave}
                onChange={(e) => setClave(e.target.value)}
              />
            </div>
            {error && <p className="text-sm text-bad" role="alert">{error}</p>}
            <div className="flex flex-wrap gap-2">
              <button type="submit" className="btn bg-bad text-white hover:bg-bad/90" disabled={!coincide || !clave || eliminando}>
                {eliminando ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />} Eliminar definitivamente
              </button>
              <button type="button" className="btn btn-ghost" onClick={cerrar} disabled={eliminando}>
                <X size={15} /> Cancelar
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
