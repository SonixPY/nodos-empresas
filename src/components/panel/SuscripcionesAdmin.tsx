"use client";

import { useMemo, useState } from "react";
import { Ban, Check, Gift, Landmark, Loader2, Save, Search, Settings2, X } from "lucide-react";
import {
  ESTADO_LABEL,
  FORMAS_MANUALES,
  PROVEEDOR_LABEL,
  formatoFecha,
  formatoGs,
  formatoMonto,
  type CuentaSuscripcion,
  type EstadoVisible,
  type FormaPagoManual,
  type Periodo,
  type PlanAdmin,
  type ResumenAdmin,
} from "@/lib/nodos/suscripciones";

/** Cada acción devuelve null si salió bien, o el mensaje de error. */
export interface AccionesSuscripciones {
  pagoManual: (b: {
    user_id: string;
    plan: string;
    periodo: Periodo;
    monto_gs: number;
    forma: FormaPagoManual;
    referencia: string;
    fecha: string;
    nota: string;
  }) => Promise<string | null>;
  cortesia: (b: { user_id: string; hasta: string | null; nota: string }) => Promise<string | null>;
  cancelar: (b: { user_id: string; motivo: string }) => Promise<string | null>;
  editarPlan: (id: string, cambios: Partial<PlanAdmin>) => Promise<string | null>;
}

type Filtro = "todas" | "activas" | "prueba" | "gracia" | "vencidas" | "sin_plan";
const FILTROS: { id: Filtro; label: string }[] = [
  { id: "todas", label: "Todas" },
  { id: "activas", label: "Activas" },
  { id: "prueba", label: "Prueba" },
  { id: "gracia", label: "En gracia" },
  { id: "vencidas", label: "Vencidas" },
  { id: "sin_plan", label: "Sin plan" },
];

const ESTADO_COLOR: Record<EstadoVisible, string> = {
  activa: "bg-good/10 text-good",
  cancelada: "bg-marfil text-cobre-hover",
  prueba: "bg-cobre/10 text-cobre-hover",
  gracia: "bg-cobre/15 text-cobre-hover",
  impaga: "bg-cobre/15 text-cobre-hover",
  vencida: "bg-bad/10 text-bad",
  sin_suscripcion: "bg-carbon/5 text-carbon/60",
};

function grupo(c: CuentaSuscripcion): Filtro {
  if (c.estado === "activa" || c.estado === "cancelada") return "activas";
  if (c.estado === "prueba") return "prueba";
  if (c.estado === "gracia" || c.estado === "impaga") return "gracia";
  if (c.estado === "vencida") return "vencidas";
  return "sin_plan";
}

function Estado({ c }: { c: CuentaSuscripcion }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      <span className={`rounded-sm px-2 py-0.5 text-xs font-medium ${ESTADO_COLOR[c.estado]}`}>{ESTADO_LABEL[c.estado]}</span>
      {c.cortesia_hasta && (
        <span className="inline-flex items-center gap-1 rounded-sm bg-good/10 px-2 py-0.5 text-xs text-good" title={`Cortesía hasta ${formatoFecha(c.cortesia_hasta)}`}>
          <Gift size={11} aria-hidden /> Cortesía
        </span>
      )}
      {c.is_admin && <span className="rounded-sm bg-musgo/10 px-2 py-0.5 text-xs text-musgo">Admin</span>}
    </span>
  );
}

function nombreCuenta(c: CuentaSuscripcion) {
  return c.nombre || (c.usuario ? `@${c.usuario}` : c.email) || "Sin nombre";
}

function Gestion({
  cuenta,
  planes,
  hoy,
  acciones,
  onCerrar,
  onHecho,
}: {
  cuenta: CuentaSuscripcion;
  planes: PlanAdmin[];
  hoy: string;
  acciones: AccionesSuscripciones;
  onCerrar: () => void;
  onHecho: (msg: string) => void;
}) {
  const [tab, setTab] = useState<"pago" | "cortesia" | "cancelar">("pago");
  const [plan, setPlan] = useState(cuenta.plan_id ?? planes[0]?.id ?? "");
  const [periodo, setPeriodo] = useState<Periodo>(cuenta.periodo ?? "mensual");
  const precioDe = (id: string, p: Periodo) => {
    const pl = planes.find((x) => x.id === id);
    return pl ? (p === "anual" ? pl.precio_anual_gs : pl.precio_mensual_gs) : 0;
  };
  const [monto, setMonto] = useState(String(precioDe(plan, periodo) || ""));
  const [forma, setForma] = useState<FormaPagoManual>("transferencia");
  const [referencia, setReferencia] = useState("");
  const [fecha, setFecha] = useState(hoy);
  const [nota, setNota] = useState("");
  const [hasta, setHasta] = useState(cuenta.cortesia_hasta ?? "");
  const [motivo, setMotivo] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const esPolar = cuenta.proveedor === "polar" && ["activa", "cancelada", "gracia", "impaga"].includes(cuenta.estado);

  async function correr(f: () => Promise<string | null>, ok: string) {
    setEnviando(true);
    setError(null);
    const err = await f();
    setEnviando(false);
    if (err) setError(err);
    else onHecho(ok);
  }

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-carbon/40 p-0 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-labelledby="gestion-titulo">
      <div className="max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-lg bg-white p-5 shadow-xl sm:rounded-lg">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="t-caption text-carbon/55">Gestionar suscripción</p>
            <h3 id="gestion-titulo" className="truncate text-lg">
              {nombreCuenta(cuenta)}
            </h3>
            <p className="truncate text-xs text-carbon/55">{cuenta.email}</p>
          </div>
          <button type="button" className="btn btn-ghost px-2" onClick={onCerrar} aria-label="Cerrar">
            <X size={16} />
          </button>
        </div>
        <div className="mb-3 text-sm text-carbon/70">
          <Estado c={cuenta} /> {cuenta.acceso_hasta && <span className="ml-1">Acceso hasta {formatoFecha(cuenta.acceso_hasta)}</span>}
        </div>
        <div className="segmented mb-4" role="tablist">
          {(
            [
              ["pago", "Pago manual"],
              ["cortesia", "Cortesía"],
              ["cancelar", "Cancelar"],
            ] as const
          ).map(([id, label]) => (
            <button key={id} type="button" role="tab" aria-selected={tab === id} className={tab === id ? "active" : ""} onClick={() => setTab(id)}>
              {label}
            </button>
          ))}
        </div>

        {tab === "pago" && (
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              correr(
                () => acciones.pagoManual({ user_id: cuenta.user_id, plan, periodo, monto_gs: Number(monto), forma, referencia, fecha, nota }),
                "Pago registrado: el plan quedó extendido."
              );
            }}
          >
            {esPolar && (
              <p className="rounded-sm bg-cobre/10 px-3 py-2 text-xs text-cobre-hover">
                Esta cuenta paga con tarjeta (Polar). Para pasarla a pago manual, cancelá primero la suscripción en Polar.
              </p>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="field-label" htmlFor="m-plan">
                  Plan
                </label>
                <select
                  id="m-plan"
                  className="input"
                  value={plan}
                  onChange={(e) => {
                    setPlan(e.target.value);
                    setMonto(String(precioDe(e.target.value, periodo) || ""));
                  }}
                >
                  {planes.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nombre}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="field-label" htmlFor="m-periodo">
                  Período
                </label>
                <select
                  id="m-periodo"
                  className="input"
                  value={periodo}
                  onChange={(e) => {
                    const p = e.target.value as Periodo;
                    setPeriodo(p);
                    setMonto(String(precioDe(plan, p) || ""));
                  }}
                >
                  <option value="mensual">Mensual</option>
                  <option value="anual">Anual</option>
                </select>
              </div>
              <div>
                <label className="field-label" htmlFor="m-monto">
                  Monto (Gs.)<span className="required-mark">*</span>
                </label>
                <input id="m-monto" className="input" inputMode="numeric" required value={monto} onChange={(e) => setMonto(e.target.value.replace(/\D/g, ""))} />
              </div>
              <div>
                <label className="field-label" htmlFor="m-forma">
                  Forma
                </label>
                <select id="m-forma" className="input" value={forma} onChange={(e) => setForma(e.target.value as FormaPagoManual)}>
                  {FORMAS_MANUALES.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="field-label" htmlFor="m-ref">
                  Referencia<span className="required-mark">*</span>
                </label>
                <input id="m-ref" className="input" required minLength={3} maxLength={120} value={referencia} onChange={(e) => setReferencia(e.target.value)} placeholder="N.º de comprobante" />
              </div>
              <div>
                <label className="field-label" htmlFor="m-fecha">
                  Fecha del pago
                </label>
                <input id="m-fecha" type="date" className="input" required max={hoy} value={fecha} onChange={(e) => setFecha(e.target.value)} />
              </div>
            </div>
            <div>
              <label className="field-label" htmlFor="m-nota">
                Nota (opcional)
              </label>
              <input id="m-nota" className="input" maxLength={500} value={nota} onChange={(e) => setNota(e.target.value)} />
            </div>
            <p className="text-xs text-carbon/55">Se suma 1 mes o 1 año desde el último día ya cubierto (o desde la fecha del pago). Queda registrado con tu usuario.</p>
            {error && <p className="text-sm text-bad">{error}</p>}
            <button type="submit" className="btn btn-primary w-full justify-center" disabled={enviando || esPolar || !plan}>
              {enviando ? <Loader2 size={15} className="animate-spin" /> : <Landmark size={15} />} Registrar pago
            </button>
          </form>
        )}

        {tab === "cortesia" && (
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              correr(() => acciones.cortesia({ user_id: cuenta.user_id, hasta: hasta || null, nota }), hasta ? "Cortesía guardada." : "Cortesía quitada.");
            }}
          >
            <p className="text-sm text-carbon/70">Acceso sin pagar a Finanzas y Empresas hasta la fecha que elijas (inclusive).</p>
            <div>
              <label className="field-label" htmlFor="c-hasta">
                Hasta
              </label>
              <input id="c-hasta" type="date" className="input" min={hoy} value={hasta} onChange={(e) => setHasta(e.target.value)} />
            </div>
            <div>
              <label className="field-label" htmlFor="c-nota">
                Motivo (opcional)
              </label>
              <input id="c-nota" className="input" maxLength={500} value={nota} onChange={(e) => setNota(e.target.value)} />
            </div>
            {error && <p className="text-sm text-bad">{error}</p>}
            <div className="flex flex-col gap-2 sm:flex-row">
              <button type="submit" className="btn btn-primary flex-1 justify-center" disabled={enviando || !hasta}>
                {enviando ? <Loader2 size={15} className="animate-spin" /> : <Gift size={15} />} Guardar cortesía
              </button>
              {cuenta.cortesia_hasta && (
                <button
                  type="button"
                  className="btn btn-ghost justify-center"
                  disabled={enviando}
                  onClick={() => correr(() => acciones.cortesia({ user_id: cuenta.user_id, hasta: null, nota }), "Cortesía quitada.")}
                >
                  Quitar cortesía
                </button>
              )}
            </div>
          </form>
        )}

        {tab === "cancelar" && (
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              correr(() => acciones.cancelar({ user_id: cuenta.user_id, motivo }), "Suscripción cancelada.");
            }}
          >
            {esPolar ? (
              <p className="rounded-sm bg-cobre/10 px-3 py-2 text-sm text-cobre-hover">
                Es una suscripción con tarjeta: cancelala o revocala en el panel de Polar. El cambio llega solo por webhook.
              </p>
            ) : (
              <p className="text-sm text-carbon/70">La prueba o el plan manual queda vencido desde ya y la cuenta pierde el acceso (si el cobro está activo). No borra datos ni pagos.</p>
            )}
            <div>
              <label className="field-label" htmlFor="x-motivo">
                Motivo
              </label>
              <input id="x-motivo" className="input" maxLength={500} value={motivo} onChange={(e) => setMotivo(e.target.value)} />
            </div>
            {error && <p className="text-sm text-bad">{error}</p>}
            <button type="submit" className="btn btn-ghost w-full justify-center text-bad" disabled={enviando || esPolar || !cuenta.estado_fila || cuenta.estado === "vencida"}>
              {enviando ? <Loader2 size={15} className="animate-spin" /> : <Ban size={15} />} Cancelar suscripción
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

function PlanEditor({ plan, acciones, onHecho }: { plan: PlanAdmin; acciones: AccionesSuscripciones; onHecho: (msg: string) => void }) {
  const [p, setP] = useState(plan);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cambio = JSON.stringify(p) !== JSON.stringify(plan);
  const campo = (k: keyof PlanAdmin, v: string | number | boolean | null) => setP((x) => ({ ...x, [k]: v }));

  async function guardar() {
    setGuardando(true);
    setError(null);
    const err = await acciones.editarPlan(plan.id, {
      nombre: p.nombre,
      descripcion: p.descripcion,
      precio_mensual_gs: p.precio_mensual_gs,
      precio_anual_gs: p.precio_anual_gs,
      polar_producto_mensual: p.polar_producto_mensual,
      polar_producto_anual: p.polar_producto_anual,
      activo: p.activo,
      ...(p.beneficios !== undefined ? { beneficios: p.beneficios } : {}),
    });
    setGuardando(false);
    if (err) setError(err);
    else onHecho(`Plan ${p.nombre} guardado.`);
  }

  return (
    <div className="card space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="font-mono text-xs text-carbon/50">{plan.id} · {plan.apps.join(" + ")}</p>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={p.activo} onChange={(e) => campo("activo", e.target.checked)} className="accent-[var(--color-cobre)]" /> Activo
        </label>
      </div>
      <input className="input" aria-label="Nombre" value={p.nombre} maxLength={60} onChange={(e) => campo("nombre", e.target.value)} />
      <input className="input" aria-label="Descripción" placeholder="Descripción" value={p.descripcion ?? ""} maxLength={200} onChange={(e) => campo("descripcion", e.target.value)} />
      <label className="block text-xs text-carbon/60">
        Beneficios (uno por línea, se ven en nodoscompliance.com)
        <textarea
          className="input mt-1 min-h-[7rem] text-sm"
          value={(p.beneficios ?? []).join("\n")}
          onChange={(e) => setP((x) => ({ ...x, beneficios: e.target.value.split("\n").slice(0, 10) }))}
          placeholder={"Todo lo de NODOS Finanzas\nSocios conectados en solo lectura"}
        />
      </label>
      <div className="grid grid-cols-2 gap-2">
        <label className="text-xs text-carbon/60">
          Mensual (Gs.)
          <input className="input mt-1" inputMode="numeric" value={p.precio_mensual_gs || ""} onChange={(e) => campo("precio_mensual_gs", Number(e.target.value.replace(/\D/g, "")) || 0)} />
        </label>
        <label className="text-xs text-carbon/60">
          Anual (Gs.)
          <input className="input mt-1" inputMode="numeric" value={p.precio_anual_gs || ""} onChange={(e) => campo("precio_anual_gs", Number(e.target.value.replace(/\D/g, "")) || 0)} />
        </label>
        <label className="text-xs text-carbon/60">
          Producto Polar mensual
          <input className="input mt-1 font-mono text-xs" value={p.polar_producto_mensual ?? ""} onChange={(e) => campo("polar_producto_mensual", e.target.value.trim() || null)} placeholder="id del producto" />
        </label>
        <label className="text-xs text-carbon/60">
          Producto Polar anual
          <input className="input mt-1 font-mono text-xs" value={p.polar_producto_anual ?? ""} onChange={(e) => campo("polar_producto_anual", e.target.value.trim() || null)} placeholder="id del producto" />
        </label>
      </div>
      {error && <p className="text-sm text-bad">{error}</p>}
      <button type="button" className="btn btn-primary w-full justify-center" disabled={!cambio || guardando} onClick={guardar}>
        {guardando ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} Guardar
      </button>
    </div>
  );
}

export default function SuscripcionesAdmin({
  datos,
  error,
  acciones,
  onHecho,
}: {
  datos: ResumenAdmin | null;
  error: string | null;
  acciones: AccionesSuscripciones;
  onHecho: (msg: string) => void;
}) {
  const [filtro, setFiltro] = useState<Filtro>("todas");
  const [q, setQ] = useState("");
  const [gestion, setGestion] = useState<CuentaSuscripcion | null>(null);

  const conteo = useMemo(() => {
    const c: Record<Filtro, number> = { todas: 0, activas: 0, prueba: 0, gracia: 0, vencidas: 0, sin_plan: 0 };
    for (const x of datos?.cuentas ?? []) {
      c.todas += 1;
      c[grupo(x)] += 1;
    }
    return c;
  }, [datos]);

  const lista = useMemo(() => {
    const t = q.trim().toLowerCase();
    return (datos?.cuentas ?? []).filter(
      (c) => (filtro === "todas" || grupo(c) === filtro) && (!t || [c.nombre, c.usuario, c.email].some((x) => x?.toLowerCase().includes(t)))
    );
  }, [datos, filtro, q]);

  const nombrePlan = (id: string | null) => datos?.planes.find((p) => p.id === id)?.nombre ?? id ?? "—";

  if (error) return <div className="card text-sm text-bad">{error}</div>;
  if (!datos)
    return (
      <div className="card flex items-center gap-2 text-sm text-carbon/60">
        <Loader2 size={16} className="animate-spin" /> Cargando…
      </div>
    );

  return (
    <div className="space-y-8">
      <section className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <div className="stat-tile col-span-2 md:col-span-1">
          <p className="stat-label">Cobrado este mes</p>
          {datos.totales_mes.length === 0 ? (
            <p className="stat-value">—</p>
          ) : (
            datos.totales_mes.map((t) => (
              <p key={t.moneda} className="stat-value text-lg">
                {formatoMonto(t.monto, t.moneda)}
                <span className="ml-1 text-xs font-normal text-carbon/50">({t.pagos})</span>
              </p>
            ))
          )}
        </div>
        {(["activas", "prueba", "gracia", "vencidas"] as Filtro[]).map((f) => (
          <button key={f} type="button" className="stat-tile text-left transition hover:border-cobre" onClick={() => setFiltro(f)}>
            <p className="stat-label">{FILTROS.find((x) => x.id === f)?.label}</p>
            <p className="stat-value">{conteo[f]}</p>
          </button>
        ))}
      </section>

      <section aria-labelledby="cuentas-titulo">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 id="cuentas-titulo" className="text-2xl">
            Cuentas
          </h2>
          <div className="relative w-full sm:w-64">
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-carbon/45" />
            <input className="input pl-8" placeholder="Buscar nombre, usuario o email" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar cuenta" />
          </div>
        </div>
        <div className="segmented mb-4 max-w-full" role="group" aria-label="Filtrar por estado">
          {FILTROS.map((f) => (
            <button key={f.id} type="button" aria-pressed={filtro === f.id} className={filtro === f.id ? "active" : ""} onClick={() => setFiltro(f.id)}>
              {f.label} <span className="text-carbon/45">{conteo[f.id]}</span>
            </button>
          ))}
        </div>

        {lista.length === 0 ? (
          <div className="card text-sm text-carbon/60">No hay cuentas con ese filtro.</div>
        ) : (
          <>
            <ul className="space-y-2 md:hidden">
              {lista.map((c) => (
                <li key={c.user_id} className="card flex items-start justify-between gap-3 p-4">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-musgo">{nombreCuenta(c)}</p>
                    <p className="truncate text-xs text-carbon/55">{c.email}</p>
                    <div className="mt-2">
                      <Estado c={c} />
                    </div>
                    <p className="mt-1 text-xs text-carbon/60">
                      {c.plan_id ? nombrePlan(c.plan_id) : "Sin plan"}
                      {c.periodo ? ` · ${c.periodo}` : ""}
                      {c.acceso_hasta ? ` · hasta ${formatoFecha(c.acceso_hasta)}` : ""}
                    </p>
                  </div>
                  <button type="button" className="btn btn-ghost shrink-0 px-2.5" onClick={() => setGestion(c)} aria-label={`Gestionar ${nombreCuenta(c)}`}>
                    <Settings2 size={15} />
                  </button>
                </li>
              ))}
            </ul>
            <div className="table-shell hidden md:block">
              <table>
                <thead>
                  <tr>
                    <th>Cuenta</th>
                    <th>Plan</th>
                    <th>Estado</th>
                    <th>Acceso hasta</th>
                    <th>Medio</th>
                    <th className="text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {lista.map((c) => (
                    <tr key={c.user_id}>
                      <td className="max-w-[16rem]">
                        <p className="truncate font-medium text-musgo">{nombreCuenta(c)}</p>
                        <p className="truncate text-xs text-carbon/55">{c.email}</p>
                      </td>
                      <td>
                        {nombrePlan(c.plan_id)}
                        {c.periodo && <span className="block text-xs text-carbon/55">{c.periodo}</span>}
                      </td>
                      <td>
                        <Estado c={c} />
                      </td>
                      <td>{formatoFecha(c.acceso_hasta)}</td>
                      <td className="text-xs text-carbon/70">{c.proveedor ? PROVEEDOR_LABEL[c.proveedor] : "—"}</td>
                      <td className="text-right">
                        <button type="button" className="btn btn-ghost px-2.5 py-1 text-xs" onClick={() => setGestion(c)}>
                          <Settings2 size={14} /> Gestionar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>

      <section aria-labelledby="planes-titulo">
        <h2 id="planes-titulo" className="mb-1 text-2xl">
          Planes
        </h2>
        <p className="mb-3 text-sm text-carbon/60">
          Precios en guaraníes (se muestran en Mi plan y se usan para pagos manuales). El cobro con tarjeta usa el precio del producto en Polar: pegá acá el id de
          cada producto.
        </p>
        <div className="grid gap-4 md:grid-cols-3">
          {datos.planes.map((p) => (
            <PlanEditor key={`${p.id}-${JSON.stringify(p)}`} plan={p} acciones={acciones} onHecho={onHecho} />
          ))}
        </div>
        {datos.planes.some((p) => p.activo && p.precio_mensual_gs > 0) && (
          <p className="mt-3 flex items-center gap-1.5 text-xs text-carbon/55">
            <Check size={13} className="text-good" /> Planes activos visibles en Mi plan:{" "}
            {datos.planes
              .filter((p) => p.activo)
              .map((p) => `${p.nombre} (${formatoGs(p.precio_mensual_gs)}/mes)`)
              .join(", ")}
          </p>
        )}
      </section>

      {gestion && (
        <Gestion
          cuenta={gestion}
          planes={datos.planes}
          hoy={datos.hoy}
          acciones={acciones}
          onCerrar={() => setGestion(null)}
          onHecho={(msg) => {
            setGestion(null);
            onHecho(msg);
          }}
        />
      )}
    </div>
  );
}
