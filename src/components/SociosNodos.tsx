"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Banknote, Check, Copy, Eye, Link2, Lock, Trash2 } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import Modal from "@/components/Modal";
import { useToast } from "@/components/ToastProvider";
import { mensajeError } from "@/lib/nodos/errores";
import { formatFecha, todayIso } from "@/lib/dates";
import { formatPyg } from "@/lib/format";
import { formatPct } from "@/lib/accionistas";
import {
  calcularDistribucion,
  crearInvitacion,
  desvincularAccionista,
  estadoEventoLabel,
  EVENTO_LABEL,
  IDU_NO_RESIDENTE,
  IDU_RESIDENTE,
  publicarDividendos,
  useEventosEmpresa,
} from "@/lib/vinculo";
import type { Accionista, Empresa } from "@/lib/types";
import { incluyeCombo, urlPagos, type EstadoPlan } from "@/lib/nodos/suscripciones";

const pct = (x: number) => `${Math.round(x * 100)} %`;

/** Enlace de invitación para que un socio conecte su cuenta NODOS. */
export function InvitarSocioDialog({ accionista, onClose }: { accionista: Accionista; onClose: () => void }) {
  const [enlace, setEnlace] = useState<string | null>(null);
  const [creando, setCreando] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Conectar socios es un extra del Combo (Finanzas + Empresas).
  const [combo, setCombo] = useState<boolean | null>(null);

  useEffect(() => {
    let vivo = true;
    fetch(urlPagos("/api/pagos/estado"), { credentials: "include", cache: "no-store" })
      .then((r) => (r.ok ? (r.json() as Promise<EstadoPlan>) : null))
      .catch(() => null)
      .then((e) => vivo && setCombo(incluyeCombo(e)));
    return () => {
      vivo = false;
    };
  }, []);

  async function crear() {
    setCreando(true);
    setError(null);
    const r = await crearInvitacion(accionista.id);
    setCreando(false);
    if (r.error) return setError(mensajeError({ message: r.error }));
    setEnlace(r.enlace);
  }

  async function copiar() {
    if (!enlace) return;
    try {
      await navigator.clipboard.writeText(enlace);
      setCopiado(true);
    } catch {
      setError("No se pudo copiar: seleccioná el enlace y copialo a mano.");
    }
  }

  return (
    <Modal titulo={`Conectar a ${accionista.nombre} con NODOS`} subtitulo="Su participación y los dividendos le llegan a NODOS Finanzas." onClose={onClose} ancho="max-w-xl">
      <ul className="mb-4 space-y-1.5 text-sm text-carbon/75">
        <li>Ve solo lo suyo: su porcentaje, sus aportes y sus dividendos. No ve a los demás socios ni el resto de la empresa.</li>
        <li className="flex items-start gap-1.5">
          <Eye size={15} className="mt-0.5 shrink-0 text-cobre" aria-hidden />
          <span>Es solo lectura: no puede modificar nada de la empresa. Lo único que decide es si registra el dividendo en sus propias finanzas.</span>
        </li>
        <li>Ingresa con su propia cuenta NODOS, o la crea gratis desde el enlace.</li>
        <li>El enlace sirve una sola vez y vence en 14 días. Si creás otro, el anterior deja de valer.</li>
      </ul>
      {enlace ? (
        <div className="space-y-2">
          <label className="field-label" htmlFor="enlace-invitacion">
            Enlace para {accionista.nombre}
          </label>
          <div className="flex gap-2">
            <input id="enlace-invitacion" className="input font-mono text-xs" readOnly value={enlace} onFocus={(e) => e.target.select()} />
            <button type="button" className="btn btn-primary shrink-0" onClick={copiar}>
              {copiado ? <Check size={15} /> : <Copy size={15} />} {copiado ? "Copiado" : "Copiar"}
            </button>
          </div>
          <p className="text-xs text-carbon/55">Mandáselo por el medio que uses con esa persona. Es personal: no lo publiques.</p>
        </div>
      ) : combo === false ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-dashed p-4" style={{ borderColor: "rgba(184,115,74,0.5)" }}>
          <p className="flex items-start gap-2 text-sm text-carbon/70">
            <Lock size={15} className="mt-0.5 shrink-0 text-cobre" aria-hidden /> Conectar socios con NODOS Finanzas está incluido en el Combo (Finanzas + Empresas).
          </p>
          <Link href="/cuenta#plan" className="btn btn-ghost shrink-0">
            Ver el Combo
          </Link>
        </div>
      ) : (
        <button type="button" className="btn btn-primary" onClick={crear} disabled={creando || combo === null}>
          <Link2 size={15} /> {creando ? "Creando..." : "Crear enlace de invitación"}
        </button>
      )}
      {error && <p className="mt-3 text-sm text-bad">{error}</p>}
    </Modal>
  );
}

/** Desconecta la cuenta NODOS de un accionista (lo aplicado en Finanzas se queda). */
export async function desconectarSocio(accionista: Accionista, onListo: () => void, avisar: (m: string, t?: "error") => void) {
  if (!confirm(`¿Desconectar la cuenta NODOS de ${accionista.nombre}? Deja de recibir dividendos y movimientos nuevos en Finanzas; lo que ya registró se queda.`)) return;
  const r = await desvincularAccionista(accionista.id);
  if (r.error) return avisar(`No se pudo desconectar: ${mensajeError({ message: r.error })}`, "error");
  avisar("Cuenta desconectada.");
  onListo();
}

/** Reparto de utilidades por porcentaje de acciones, con la retención estimada del IDU. */
export function DistribuirUtilidadesDialog({
  empresa,
  accionistas,
  onClose,
  onPublicado,
}: {
  empresa: Empresa;
  accionistas: Accionista[];
  onClose: () => void;
  onPublicado: () => void;
}) {
  const { showToast } = useToast();
  const [fecha, setFecha] = useState(todayIso());
  const [total, setTotal] = useState("");
  const [detalle, setDetalle] = useState("");
  const [residencia, setResidencia] = useState<Record<string, boolean>>({});
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const monto = Number(total.replace(/\D/g, "")) || 0;
  const lineas = useMemo(() => calcularDistribucion(accionistas, monto, residencia), [accionistas, monto, residencia]);
  const suma = lineas.reduce((s, l) => ({ bruto: s.bruto + l.bruto, retencion: s.retencion + l.retencion, neto: s.neto + l.neto }), { bruto: 0, retencion: 0, neto: 0 });
  const conectados = lineas.filter((l) => l.accionista.usuario_vinculado).length;

  async function publicar() {
    setError(null);
    if (!fecha) return setError("Indicá la fecha en que se ponen a disposición las utilidades.");
    if (monto <= 0) return setError("Indicá el monto total a distribuir.");
    if (lineas.length === 0) return setError("No hay accionistas con acciones para repartir.");
    setGuardando(true);
    // Guarda la residencia que se cambió acá, para la próxima distribución.
    const cambios = lineas.filter((l) => (l.accionista.residente ?? true) !== l.residente);
    for (const l of cambios) {
      const { error: e } = await supabase.from("accionistas").update({ residente: l.residente }).eq("id", l.accionista.id);
      if (e) {
        setGuardando(false);
        return setError(`No se pudo guardar la residencia de ${l.accionista.nombre}: ${mensajeError(e)}`);
      }
    }
    const r = await publicarDividendos(empresa.id, fecha, lineas, detalle);
    setGuardando(false);
    if (r.error) return setError(`No se pudo publicar: ${mensajeError({ message: r.error })}`);
    showToast(conectados > 0 ? `Dividendos publicados. ${conectados} socio${conectados === 1 ? "" : "s"} lo ve${conectados === 1 ? "" : "n"} en Finanzas.` : "Dividendos publicados.");
    onPublicado();
  }

  return (
    <Modal titulo="Distribuir utilidades" subtitulo={`${empresa.denominacion} · según el porcentaje de acciones de cada socio`} onClose={onClose}>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div>
          <label className="field-label" htmlFor="dist-fecha">
            Fecha de pago o puesta a disposición<span className="required-mark">*</span>
          </label>
          <input id="dist-fecha" type="date" className="input" value={fecha} onChange={(e) => setFecha(e.target.value)} />
        </div>
        <div>
          <label className="field-label" htmlFor="dist-total">
            Monto total a distribuir (Gs.)<span className="required-mark">*</span>
          </label>
          <input
            id="dist-total"
            inputMode="numeric"
            className="input tabular-nums"
            value={monto ? monto.toLocaleString("es-PY") : ""}
            onChange={(e) => setTotal(e.target.value)}
            placeholder="0"
          />
        </div>
        <div>
          <label className="field-label" htmlFor="dist-detalle">
            Referencia
          </label>
          <input id="dist-detalle" className="input" value={detalle} maxLength={300} onChange={(e) => setDetalle(e.target.value)} placeholder="Ej.: Utilidades 2025, acta N° 12" />
        </div>
      </div>

      {lineas.length > 0 && (
        <div className="table-shell mt-4">
          <table>
            <thead>
              <tr>
                <th>Socio</th>
                <th className="text-right">%</th>
                <th>Residente</th>
                <th className="text-right">Bruto</th>
                <th className="text-right">IDU</th>
                <th className="text-right">Neto</th>
              </tr>
            </thead>
            <tbody>
              {lineas.map((l) => (
                <tr key={l.accionista.id}>
                  <td className="min-w-[9rem]">
                    <span className="font-medium">{l.accionista.nombre}</span>
                    <span className="block text-[11px] text-carbon/50">{l.accionista.usuario_vinculado ? "Conectado a NODOS" : "Sin conectar"}</span>
                  </td>
                  <td className="text-right tabular-nums">{formatPct(l.pct)}</td>
                  <td>
                    <label className="inline-flex items-center gap-1.5 text-xs">
                      <input type="checkbox" checked={l.residente} onChange={(e) => setResidencia((p) => ({ ...p, [l.accionista.id]: e.target.checked }))} />
                      {l.residente ? pct(IDU_RESIDENTE) : pct(IDU_NO_RESIDENTE)}
                    </label>
                  </td>
                  <td className="text-right tabular-nums">{formatPyg(l.bruto)}</td>
                  <td className="text-right tabular-nums text-carbon/70">{formatPyg(l.retencion)}</td>
                  <td className="text-right font-medium tabular-nums">{formatPyg(l.neto)}</td>
                </tr>
              ))}
              <tr>
                <td className="font-medium">Total</td>
                <td></td>
                <td></td>
                <td className="text-right font-medium tabular-nums">{formatPyg(suma.bruto)}</td>
                <td className="text-right font-medium tabular-nums">{formatPyg(suma.retencion)}</td>
                <td className="text-right font-medium tabular-nums">{formatPyg(suma.neto)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-4 space-y-1.5 text-xs leading-relaxed text-carbon/60">
        <p>
          La retención es una estimación del IDU (Ley 6380/2019): {pct(IDU_RESIDENTE)} para residentes y {pct(IDU_NO_RESIDENTE)} para no residentes, que la empresa retiene al pagar o poner a
          disposición las utilidades. Confirmá montos, formulario y plazo de pago con tu contador.
        </p>
        <p>
          Los socios conectados ven el &quot;a cobrar&quot; en NODOS Finanzas; a los demás les llega cuando conecten su cuenta. El reparto no reemplaza el acta de la asamblea que aprueba el destino
          de las utilidades. No constituye asesoramiento legal para tu caso.
        </p>
      </div>
      {error && <p className="mt-3 text-sm text-bad">{error}</p>}
      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" className="btn btn-primary" onClick={publicar} disabled={guardando || lineas.length === 0}>
          <Banknote size={15} /> {guardando ? "Publicando..." : "Publicar dividendos"}
        </button>
        <button type="button" className="btn btn-ghost" onClick={onClose}>
          Cancelar
        </button>
      </div>
    </Modal>
  );
}

/** Lo que Empresas publicó para los socios: dividendos, aportes y cesiones. */
export function PublicadoParaSocios({ empresaId, accionistas }: { empresaId: string; accionistas: Accionista[] }) {
  const { showToast } = useToast();
  const { data, loading, error, reload, setData } = useEventosEmpresa(empresaId);
  const nombre = (id: string | null) => accionistas.find((a) => a.id === id)?.nombre ?? "Accionista eliminado";

  async function borrar(id: string) {
    if (!confirm("¿Borrar este dividendo publicado? El socio deja de verlo como pendiente.")) return;
    const { error: e } = await supabase.from("eventos_entidad").delete().eq("id", id);
    if (e) return showToast(`No se pudo borrar: ${mensajeError(e)}`, "error");
    setData((prev) => prev.filter((x) => x.id !== id));
    showToast("Dividendo borrado.");
  }

  if (loading) return null;
  if (error) return <p className="text-xs text-carbon/55">No se pudo cargar lo publicado para los socios.</p>;
  if (data.length === 0)
    return (
      <p className="text-sm text-carbon/60">
        Todavía no hay nada publicado. Los aportes y cesiones que registres, y los dividendos que distribuyas, aparecen acá y en NODOS Finanzas de cada socio conectado.
      </p>
    );
  return (
    <div className="space-y-2">
      <div className="table-shell">
        <table>
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Movimiento</th>
              <th>Socio</th>
              <th className="text-right">Monto</th>
              <th>Estado</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {data.map((ev) => (
              <tr key={ev.id}>
                <td className="whitespace-nowrap">{formatFecha(ev.fecha)}</td>
                <td className="whitespace-nowrap">{EVENTO_LABEL[ev.tipo]}</td>
                <td className="min-w-[9rem]">{nombre(ev.accionista_id)}</td>
                <td className="whitespace-nowrap text-right tabular-nums">
                  {ev.tipo === "dividendo" ? formatPyg(ev.monto_neto ?? 0) : ev.cantidad ? `${Number(ev.cantidad).toLocaleString("es-PY")} acc.` : "—"}
                </td>
                <td className="whitespace-nowrap text-xs text-carbon/65">{estadoEventoLabel(ev)}</td>
                <td className="text-right">
                  {ev.tipo === "dividendo" && ev.estado === "pendiente" && (
                    <button type="button" title="Borrar" className="rounded-full p-1 text-carbon/50 hover:text-bad" onClick={() => borrar(ev.id)}>
                      <Trash2 size={14} />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button type="button" className="text-xs font-medium text-carbon/55 hover:text-cobre-hover" onClick={() => reload()}>
        Actualizar
      </button>
    </div>
  );
}

