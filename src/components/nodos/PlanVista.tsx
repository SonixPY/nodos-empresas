"use client";

import { useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  BadgeCheck,
  CheckCircle2,
  Clock,
  CreditCard,
  ExternalLink,
  Gift,
  Landmark,
  Loader2,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { SITIOS, SOPORTE_EMAIL } from "@/lib/nodos/sitios";
import {
  PROVEEDOR_LABEL,
  formatoFecha,
  formatoGs,
  type EstadoPlan,
  type Periodo,
  type PlanPublico,
} from "@/lib/nodos/suscripciones";

export type Confirmacion = "no" | "esperando" | "listo" | "demora";

const APP_LABEL: Record<string, string> = { finanzas: "Finanzas", empresas: "Empresas" };

function Aviso({ tono, icon, titulo, children }: { tono: "ok" | "info" | "alerta" | "mal"; icon: React.ReactNode; titulo: string; children?: React.ReactNode }) {
  const borde = { ok: "border-l-good", info: "border-l-cobre", alerta: "border-l-cobre-hover", mal: "border-l-bad" }[tono];
  return (
    <div className={`card flex gap-3 border-l-4 ${borde}`} role={tono === "mal" || tono === "alerta" ? "alert" : "status"}>
      <span className="mt-0.5 shrink-0">{icon}</span>
      <div className="min-w-0">
        <p className="font-display font-semibold text-musgo">{titulo}</p>
        {children && <div className="mt-1 text-sm text-carbon/75">{children}</div>}
      </div>
    </div>
  );
}

/** Resumen del estado de la cuenta (prueba, activa, gracia, vencida...). */
function EstadoActual({ e }: { e: EstadoPlan }) {
  const hasta = formatoFecha(e.acceso_hasta);
  const dias = e.dias_restantes ?? 0;
  const diasTxt = dias === 0 ? "hoy es el último día" : dias === 1 ? "te queda 1 día" : `te quedan ${dias} días`;
  const plan = e.plan_nombre ?? "NODOS";
  const periodo = e.periodo === "anual" ? "anual" : e.periodo === "mensual" ? "mensual" : null;

  if (e.admin) {
    return (
      <Aviso tono="ok" icon={<ShieldCheck size={20} className="text-good" />} titulo="Sos administrador">
        Tenés acceso completo a las dos apps sin plan.
      </Aviso>
    );
  }
  const cortesia = e.cortesia_hasta ? (
    <Aviso tono="ok" icon={<Gift size={20} className="text-good" />} titulo={`Acceso de cortesía hasta el ${formatoFecha(e.cortesia_hasta)}`}>
      Podés usar Finanzas y Empresas sin pagar hasta esa fecha.
    </Aviso>
  ) : null;

  let principal: React.ReactNode = null;
  switch (e.estado) {
    case "prueba":
      principal = (
        <Aviso tono="info" icon={<Clock size={20} className="text-cobre" />} titulo={`Prueba gratis: ${diasTxt}`}>
          Tu prueba de 14 días termina el {hasta}. No se cobra nada automáticamente: para seguir, elegí un plan.
        </Aviso>
      );
      break;
    case "activa":
      principal = (
        <Aviso tono="ok" icon={<CheckCircle2 size={20} className="text-good" />} titulo={`${plan} activo hasta el ${formatoFecha(e.activa_hasta)}`}>
          {periodo ? `Plan ${periodo}` : "Plan"} · {e.proveedor ? PROVEEDOR_LABEL[e.proveedor] : ""}
          {e.proveedor === "polar" ? ". Se renueva solo al final del período." : "."}
        </Aviso>
      );
      break;
    case "cancelada":
      principal = (
        <Aviso tono="info" icon={<Clock size={20} className="text-cobre" />} titulo={`Cancelaste la renovación: acceso hasta el ${hasta}`}>
          No se te va a cobrar de nuevo. Si cambiás de idea, podés reactivarla desde Gestionar o cancelar.
        </Aviso>
      );
      break;
    case "gracia":
    case "impaga":
      principal = (
        <Aviso tono="alerta" icon={<AlertTriangle size={20} className="text-cobre-hover" />} titulo={`Tu plan necesita un pago: ${diasTxt} de gracia`}>
          {e.estado === "impaga" || e.proveedor === "polar"
            ? "No pudimos cobrar la renovación. Revisá tu tarjeta desde Gestionar o cancelar, "
            : `Tu plan venció el ${formatoFecha(e.activa_hasta)}. Pagá la renovación `}
          antes del {hasta} para no perder el acceso. Tus datos se conservan.
        </Aviso>
      );
      break;
    case "vencida":
      principal = (
        <Aviso tono="mal" icon={<XCircle size={20} className="text-bad" />} titulo="Tu plan o tu prueba venció">
          Elegí un plan para volver a usar las herramientas. Tus datos se conservan.
        </Aviso>
      );
      break;
    default:
      principal = (
        <Aviso tono="info" icon={<BadgeCheck size={20} className="text-cobre" />} titulo="Todavía no tenés un plan">
          {e.cobro_activo
            ? "Al entrar a una app empieza tu prueba gratis de 14 días."
            : "Por ahora el acceso a las apps sigue abierto. Cuando empiecen los planes, vas a tener 14 días de prueba gratis."}
        </Aviso>
      );
  }
  return (
    <div className="space-y-3">
      {cortesia}
      {principal}
    </div>
  );
}

function TarjetaPlan({
  plan,
  periodo,
  actual,
  ocupado,
  onTarjeta,
  onTransferencia,
}: {
  plan: PlanPublico;
  periodo: Periodo;
  actual: boolean;
  ocupado: boolean;
  onTarjeta: () => void;
  onTransferencia: () => void;
}) {
  const precio = periodo === "anual" ? plan.precio_anual_gs : plan.precio_mensual_gs;
  const conTarjeta = periodo === "anual" ? plan.tarjeta_anual : plan.tarjeta_mensual;
  const ahorro =
    periodo === "anual" && plan.precio_mensual_gs > 0 && plan.precio_anual_gs > 0
      ? Math.round((1 - plan.precio_anual_gs / (plan.precio_mensual_gs * 12)) * 100)
      : 0;

  return (
    <article className={`card flex flex-col ${actual ? "border-cobre ring-1 ring-cobre/40" : ""}`}>
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-lg">{plan.nombre}</h3>
        {actual && <span className="rounded-sm bg-marfil px-2 py-0.5 text-xs font-medium text-cobre-hover">Tu plan</span>}
      </div>
      {plan.descripcion && <p className="mt-1 text-sm text-carbon/65">{plan.descripcion}</p>}
      <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="Incluye">
        {plan.apps.map((a) => (
          <li key={a} className="rounded-sm border border-[var(--line)] px-2 py-0.5 text-xs text-musgo">
            NODOS {APP_LABEL[a] ?? a}
          </li>
        ))}
      </ul>
      <p className="mt-4">
        {precio > 0 ? (
          <>
            <span className="font-display text-2xl font-bold text-musgo">{formatoGs(precio)}</span>
            <span className="text-sm text-carbon/60"> / {periodo === "anual" ? "año" : "mes"}</span>
          </>
        ) : (
          <span className="text-sm text-carbon/60">Sin precio {periodo} por ahora</span>
        )}
      </p>
      {ahorro > 0 && <p className="mt-0.5 text-xs text-good">Ahorrás {ahorro}% frente al plan mensual</p>}
      <div className="mt-auto flex flex-col gap-2 pt-5">
        <button type="button" className="btn btn-primary justify-center" disabled={!conTarjeta || precio <= 0 || ocupado} onClick={onTarjeta}>
          {ocupado ? <Loader2 size={15} className="animate-spin" /> : <CreditCard size={15} />} Pagar con tarjeta
        </button>
        <button type="button" className="btn btn-ghost justify-center" disabled={precio <= 0} onClick={onTransferencia}>
          <Landmark size={15} /> Transferencia o QR
        </button>
        {!conTarjeta && precio > 0 && <p className="text-center text-xs text-carbon/50">Pago con tarjeta disponible pronto.</p>}
      </div>
    </article>
  );
}

export default function PlanVista({
  estado,
  error,
  confirmacion,
  ocupado,
  onTarjeta,
  onPortal,
}: {
  estado: EstadoPlan | null;
  error: string | null;
  confirmacion: Confirmacion;
  ocupado: string | null;
  onTarjeta: (plan: string, periodo: Periodo) => void;
  onPortal: () => void;
}) {
  const [periodo, setPeriodo] = useState<Periodo>("mensual");
  const [transferencia, setTransferencia] = useState<PlanPublico | null>(null);
  const planes = estado?.planes ?? [];
  const pagando = estado?.estado === "activa" || estado?.estado === "cancelada" || estado?.estado === "gracia" || estado?.estado === "impaga";

  function verTransferencia(p: PlanPublico) {
    setTransferencia(p);
    requestAnimationFrame(() => document.getElementById("transferencia")?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-6">
        <h1>Mi plan</h1>
        <p className="mt-1 text-sm text-carbon/60">Un plan sirve para tu cuenta NODOS en Finanzas y Empresas, según lo que incluya.</p>
      </header>

      <div className="space-y-6">
        {confirmacion === "esperando" && (
          <Aviso tono="info" icon={<Loader2 size={20} className="animate-spin text-cobre" />} titulo="Estamos confirmando tu pago">
            Polar nos avisa en unos segundos. No cierres esta página.
          </Aviso>
        )}
        {confirmacion === "listo" && (
          <Aviso tono="ok" icon={<CheckCircle2 size={20} className="text-good" />} titulo="Listo: tu plan quedó activo">
            Ya podés seguir usando las herramientas. Las facturas quedan en Gestionar o cancelar.
          </Aviso>
        )}
        {confirmacion === "demora" && (
          <Aviso tono="alerta" icon={<Clock size={20} className="text-cobre-hover" />} titulo="El pago todavía se está confirmando">
            A veces tarda unos minutos. Si en un rato no ves tu plan activo, escribinos desde{" "}
            <Link href="/soporte" className="font-medium text-cobre-hover underline">
              Soporte
            </Link>
            .
          </Aviso>
        )}

        {error && (
          <Aviso tono="mal" icon={<XCircle size={20} className="text-bad" />} titulo="No pudimos cargar tu plan">
            {error}
          </Aviso>
        )}

        {!estado && !error && (
          <div className="card flex items-center gap-2 text-sm text-carbon/60">
            <Loader2 size={16} className="animate-spin" /> Cargando…
          </div>
        )}

        {estado && <EstadoActual e={estado} />}

        {estado?.proveedor === "polar" && pagando && (
          <section className="card flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="flex items-center gap-2 text-base">
                <CreditCard size={17} className="text-cobre" /> Pago con tarjeta
              </h3>
              <p className="mt-1 text-sm text-carbon/65">Cambiá la tarjeta, descargá tus facturas o cancelá la renovación en el portal seguro de Polar.</p>
            </div>
            <button type="button" className="btn btn-ghost shrink-0 justify-center" onClick={onPortal} disabled={ocupado === "portal"}>
              {ocupado === "portal" ? <Loader2 size={15} className="animate-spin" /> : <ExternalLink size={15} />} Gestionar o cancelar
            </button>
          </section>
        )}

        {estado && !estado.admin && (
          <section aria-labelledby="planes-titulo">
            <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
              <h2 id="planes-titulo" className="text-2xl">
                Planes
              </h2>
              <div className="segmented" role="group" aria-label="Período de pago">
                {(["mensual", "anual"] as Periodo[]).map((p) => (
                  <button key={p} type="button" aria-pressed={periodo === p} className={periodo === p ? "active" : ""} onClick={() => setPeriodo(p)}>
                    {p === "mensual" ? "Mensual" : "Anual"}
                  </button>
                ))}
              </div>
            </div>
            {planes.length === 0 ? (
              <div className="card text-sm text-carbon/70">
                Todavía no hay planes publicados. Si querés contratar ahora, escribinos a{" "}
                <a href={`mailto:${SOPORTE_EMAIL}`} className="font-medium text-cobre-hover underline">
                  {SOPORTE_EMAIL}
                </a>
                .
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-3">
                {planes.map((p) => (
                  <TarjetaPlan
                    key={p.id}
                    plan={p}
                    periodo={periodo}
                    actual={pagando && estado.plan_id === p.id}
                    ocupado={ocupado === `${p.id}:${periodo}`}
                    onTarjeta={() => onTarjeta(p.id, periodo)}
                    onTransferencia={() => verTransferencia(p)}
                  />
                ))}
              </div>
            )}
          </section>
        )}

        {estado && !estado.admin && (
          <section id="transferencia" className="card scroll-mt-24">
            <h3 className="flex items-center gap-2 text-base">
              <Landmark size={17} className="text-cobre" /> Pagar por transferencia o QR
            </h3>
            {transferencia && (
              <p className="mt-2 text-sm text-musgo">
                Elegiste <strong>{transferencia.nombre}</strong>, plan {periodo}:{" "}
                <strong>{formatoGs(periodo === "anual" ? transferencia.precio_anual_gs : transferencia.precio_mensual_gs)}</strong>.
              </p>
            )}
            <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-carbon/80">
              <li>
                Transferí el monto del plan a esta cuenta:
                <div className="mt-2 rounded-sm border border-dashed border-cobre/60 bg-marfil/60 px-3 py-2 font-mono text-xs text-carbon/70">
                  [DATOS BANCARIOS: banco, titular, RUC o CI, número de cuenta, alias o QR]
                </div>
              </li>
              <li>En el concepto poné tu usuario NODOS o el email de tu cuenta.</li>
              <li>
                Mandá el comprobante a{" "}
                <a href={`mailto:${SOPORTE_EMAIL}`} className="font-medium text-cobre-hover underline">
                  {SOPORTE_EMAIL}
                </a>{" "}
                o desde{" "}
                <Link href="/soporte" className="font-medium text-cobre-hover underline">
                  Soporte
                </Link>
                , con el plan que elegiste.
              </li>
              <li>Cuando confirmamos la transferencia, activamos tu plan y lo ves en esta página.</li>
            </ol>
          </section>
        )}

        <p className="text-xs leading-relaxed text-carbon/55">
          El pago con tarjeta lo procesa Polar (polar.sh), que actúa como revendedor autorizado (Merchant of Record) y puede cobrar en dólares
          estadounidenses: el monto final y los impuestos se ven antes de confirmar. NODOS no recibe ni guarda los datos de tu tarjeta. Podés
          cancelar cuando quieras y conservás el acceso hasta el fin del período pagado. Ver{" "}
          <a href={`${SITIOS.inicio.url}/terminos`} target="_blank" rel="noopener" className="underline">
            Términos
          </a>{" "}
          y{" "}
          <a href={`${SITIOS.inicio.url}/privacidad`} target="_blank" rel="noopener" className="underline">
            Privacidad
          </a>
          .
        </p>
      </div>
    </main>
  );
}
