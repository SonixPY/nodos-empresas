"use client";

import { useEffect, useState } from "react";
import { Ban, X } from "lucide-react";
import { formatFecha, todayIso } from "@/lib/dates";
import { estadoPoder, poderVacio, revocarPoder, usePoderes, type NuevoPoder, type PoderPrefill } from "@/lib/poderes";
import { useToast } from "@/components/ToastProvider";
import { EstadoPoderBadge, PoderForm } from "@/components/PoderesPanel";
import type { Empresa } from "@/lib/types";

function Modal({
  titulo,
  subtitulo,
  onClose,
  children,
}: {
  titulo: string;
  subtitulo?: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-40 flex items-end justify-center bg-carbon/40 p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={titulo}
    >
      <div className="animate-slide-up max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-t-[16px] bg-marfil p-4 shadow-xl sm:rounded-[16px] sm:p-6">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2>{titulo}</h2>
            {subtitulo && <p className="mt-1 text-sm text-carbon/65">{subtitulo}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1.5 text-carbon/50 hover:bg-white hover:text-carbon"
            title="Cerrar"
          >
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

/** Después de generar una carta poder: registrar el poder con los datos ya cargados. */
export function RegistrarPoderDialog({
  empresa,
  prefill,
  documentoId,
  onClose,
}: {
  empresa: Empresa;
  prefill: PoderPrefill;
  documentoId: string | null;
  onClose: () => void;
}) {
  const { showToast } = useToast();
  const inicial: NuevoPoder = {
    ...poderVacio(empresa.id),
    ...prefill,
    fecha_otorgamiento: prefill.fecha_otorgamiento || todayIso(),
    documento_id: documentoId,
  };
  return (
    <Modal
      titulo="¿Lo sumás al registro de poderes?"
      subtitulo={`Así controlás su vigencia${prefill.fecha_vencimiento ? " y el vencimiento aparece en tu agenda" : ""}. Revisá los datos antes de guardar.`}
      onClose={onClose}
    >
      <PoderForm
        inicial={inicial}
        empresaFija
        cancelLabel="Ahora no"
        onCancel={onClose}
        onSaved={() => {
          showToast("Poder registrado en Documentos › Poderes.");
          onClose();
        }}
      />
    </Modal>
  );
}

/** Después de generar una revocación: marcar como revocado el poder registrado. */
export function RevocarPoderDialog({
  empresa,
  apoderado,
  fecha,
  onClose,
}: {
  empresa: Empresa;
  apoderado: string;
  fecha: string;
  onClose: () => void;
}) {
  const { showToast } = useToast();
  const poderes = usePoderes(empresa.id);
  const [busy, setBusy] = useState<string | null>(null);
  const desde = fecha || todayIso();
  const nombre = apoderado.trim().toLowerCase();
  const vigentes = poderes.data
    .filter((p) => p.estado === "vigente")
    .sort(
      (a, b) =>
        Number(b.apoderado.toLowerCase().includes(nombre) && !!nombre) - Number(a.apoderado.toLowerCase().includes(nombre) && !!nombre),
    );

  async function revocar(id: string) {
    setBusy(id);
    const { error } = await revocarPoder(id, desde);
    setBusy(null);
    if (error) return showToast(`No se pudo actualizar: ${error.message}`, "error");
    showToast("Poder marcado como revocado.");
    onClose();
  }

  return (
    <Modal
      titulo="¿Marcás el poder como revocado?"
      subtitulo={`Elegí cuál de los poderes vigentes de ${empresa.denominacion} se revoca desde el ${formatFecha(desde)}.`}
      onClose={onClose}
    >
      {poderes.loading ? (
        <p className="text-sm text-carbon/60">Cargando poderes…</p>
      ) : vigentes.length === 0 ? (
        <p className="text-sm text-carbon/70">No hay poderes vigentes registrados para esta empresa.</p>
      ) : (
        <ul className="space-y-2">
          {vigentes.map((p) => {
            const coincide = !!nombre && p.apoderado.toLowerCase().includes(nombre);
            return (
              <li
                key={p.id}
                className="flex flex-wrap items-center gap-3 rounded-md border bg-white p-3"
                style={{ borderColor: coincide ? "rgba(184,115,74,0.6)" : "var(--line)" }}
              >
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{p.apoderado}</p>
                  <p className="text-xs text-carbon/55">
                    Otorgado el {formatFecha(p.fecha_otorgamiento)}
                    {p.instrumento ? ` · ${p.instrumento}` : ""}
                  </p>
                </div>
                {estadoPoder(p).clave !== "vigente" && <EstadoPoderBadge poder={p} />}
                <button type="button" className="btn btn-primary" disabled={busy !== null} onClick={() => revocar(p.id)}>
                  <Ban size={14} /> {busy === p.id ? "Guardando..." : "Marcar revocado"}
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <div className="mt-4">
        <button type="button" className="btn btn-ghost" onClick={onClose}>
          Ahora no
        </button>
      </div>
    </Modal>
  );
}
