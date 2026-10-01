"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Check, ChevronDown, ChevronLeft, ChevronRight, ExternalLink, MessageCircle, Newspaper, RotateCw, Star, X } from "lucide-react";
import { useNotasNodos, useSectoresSeprelad } from "@/lib/data";
import { useNovedades, type EstadoNovedades } from "@/lib/useNovedades";
import {
  contextoEmpresa,
  DISCLAIMER_NOVEDADES,
  empresasAfectadas,
  empresasDeNota,
  notaVisible,
  temaPorId,
  temasParaEmpresas,
  tiempoRelativo,
  urlSegura,
  type EmpresaCtx,
  type Novedad,
  type NotaNodos,
} from "@/lib/novedades";
import type { Empresa } from "@/lib/types";
import type { EmpresaSiara } from "@/lib/siara";

type Filtro = "todas" | "normativa" | "rubro" | "notas";
export type VarianteNovedades = "banda" | "compacta";

export interface FuenteNovedades {
  estado: EstadoNovedades;
  items: Novedad[];
  ahora: number;
  reintentar?: () => void;
}

export type ResultadoConsulta = { ok: true; repetida?: boolean } | { ok: false; message: string };

/** Envía la consulta de una nota. Solo se llama después de la confirmación explícita. */
async function enviarConsulta(nota: NotaNodos): Promise<ResultadoConsulta> {
  try {
    const res = await fetch("/api/novedades/consulta", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ notaId: nota.id, confirmado: true }),
    });
    const body = (await res.json().catch(() => ({}))) as { message?: string; repetida?: boolean };
    if (!res.ok) return { ok: false, message: body.message ?? "No pudimos enviar la consulta. Probá de nuevo." };
    return { ok: true, repetida: body.repetida };
  } catch {
    return { ok: false, message: "Sin conexión. Probá de nuevo en un rato." };
  }
}

/**
 * "Novedades para tus empresas". Carga los sectores SEPRELAD y las notas con
 * RLS, decide los temas EN EL NAVEGADOR y le pide al servidor solo los ids de
 * esos temas.
 *
 * - `banda` (Resumen): tira de tarjetas para ir dentro de la banda musgo del
 *   saludo, igual que las noticias del Resumen de NODOS Finanzas.
 * - `compacta` (ficha de una empresa): la misma tira en su propio bloque
 *   musgo, sin filtro ni "Afecta a" porque es una sola empresa.
 */
export default function NovedadesEmpresas({
  empresas,
  loading = false,
  variant = "banda",
}: {
  empresas: Empresa[];
  loading?: boolean;
  variant?: VarianteNovedades;
}) {
  const sectores = useSectoresSeprelad();
  const notas = useNotasNodos();

  const ctxs = useMemo<EmpresaCtx[]>(() => {
    const porEmpresa = new Map(sectores.data.map((p) => [p.empresa_id, p.sectores ?? []]));
    return empresas.map((e) => contextoEmpresa(e as EmpresaSiara, porEmpresa.get(e.id) ?? []));
  }, [empresas, sectores.data]);

  const listo = !loading && !sectores.loading;
  const idsNormativa = useMemo(() => temasParaEmpresas("normativa", ctxs).map((t) => t.id), [ctxs]);
  const idsRubro = useMemo(() => temasParaEmpresas("rubro", ctxs).map((t) => t.id), [ctxs]);
  const normativa = useNovedades(idsNormativa, listo);
  const rubro = useNovedades(idsRubro, listo);

  return (
    <NovedadesVista
      empresas={ctxs}
      normativa={normativa}
      rubro={rubro}
      // Si la tabla todavía no existe (falta correr 008), las notas quedan vacías sin error.
      notas={notas.data}
      notasCargando={notas.loading}
      variant={variant}
      onConsultar={enviarConsulta}
    />
  );
}

// ── Piezas ───────────────────────────────────────────────────────────────

const ANCHO_TARJETA = "w-[78%] shrink-0 snap-start sm:w-[calc(50%-6px)] lg:w-[calc(25%-9px)]";

const chipClass = (activo: boolean) =>
  `shrink-0 rounded-full border px-3 py-1 text-xs font-medium transition ${
    activo ? "border-cobre bg-cobre text-marfil" : "border-marfil/20 text-marfil/75 hover:border-marfil/40 hover:text-marfil"
  }`;

/** "Afecta a: …" en una sola línea. Con una sola empresa no se muestra. */
function textoAfecta(afectadas: EmpresaCtx[], total: number): string | null {
  if (total <= 1 || afectadas.length === 0) return null;
  if (afectadas.length === total) return "Afecta a: Todas tus empresas";
  return `Afecta a: ${afectadas.map((e) => e.nombre).join(", ")}`;
}

function kickerNovedad(n: Novedad): string {
  const tema = temaPorId(n.tema);
  if (!tema) return "Novedad";
  return tema.tipo === "rubro" ? `Rubro · ${tema.label}` : tema.label;
}

function kickerNota(nota: NotaNodos): string {
  const organismo = nota.organismo ? temaPorId(nota.organismo) : undefined;
  return organismo ? `Nota NODOS · ${organismo.label}` : "Nota NODOS";
}

function TarjetaNovedad({ n, ahora, afecta }: { n: Novedad; ahora: number; afecta: string | null }) {
  const url = urlSegura(n.url);
  const rel = tiempoRelativo(n.fecha, ahora);
  const cuerpo = (
    <>
      <span className="truncate text-[11px] font-semibold uppercase tracking-wider text-cobre">{kickerNovedad(n)}</span>
      <span className="mt-1.5 line-clamp-3 text-sm font-medium leading-snug text-marfil [overflow-wrap:anywhere]">{n.titulo}</span>
      <span className="mt-auto block pt-3">
        <span className="flex items-center gap-1.5 text-xs text-marfil/55">
          <span className="truncate">
            {n.fuente || "Google News"}
            {rel ? ` · ${rel}` : ""}
          </span>
          {url && <ExternalLink size={12} className="ml-auto shrink-0 opacity-60 transition group-hover:opacity-100" aria-hidden="true" />}
        </span>
        {afecta && (
          <span className="mt-1 block truncate text-[11px] text-marfil/45" title={afecta}>
            {afecta}
          </span>
        )}
      </span>
    </>
  );
  const clase = `group flex ${ANCHO_TARJETA} flex-col rounded-lg bg-marfil/10 p-4 transition`;
  return url ? (
    <a href={url} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer" className={`${clase} hover:bg-marfil/15`}>
      {cuerpo}
      <span className="sr-only"> (se abre en otra pestaña)</span>
    </a>
  ) : (
    <div className={clase}>{cuerpo}</div>
  );
}

type EstadoConsulta = { paso: "confirmando" } | { paso: "enviando" } | { paso: "enviada"; repetida?: boolean } | { paso: "error"; message: string };

function TarjetaNota({
  nota,
  ahora,
  afecta,
  consulta,
  abierta,
  onAbrir,
  onConsultar,
  ancho = ANCHO_TARJETA,
}: {
  nota: NotaNodos;
  ahora: number;
  afecta: string | null;
  consulta: EstadoConsulta | undefined;
  abierta: boolean;
  onAbrir: () => void;
  onConsultar: () => void;
  ancho?: string;
}) {
  const fecha = nota.publicada_el && ahora ? tiempoRelativo(nota.publicada_el, ahora) : "";
  return (
    <article
      className={`flex ${ancho} flex-col rounded-lg bg-marfil/10 p-4 ring-1 ring-inset transition ${
        abierta ? "bg-marfil/15 ring-cobre" : nota.destacada ? "ring-cobre/70" : "ring-cobre/30"
      }`}
    >
      <span className="flex min-w-0 items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-cobre">
        {nota.destacada && <Star size={11} className="shrink-0 fill-current" aria-label="Destacada" />}
        <span className="truncate">{kickerNota(nota)}</span>
      </span>
      <button
        type="button"
        onClick={onAbrir}
        aria-expanded={abierta}
        className="mt-1.5 line-clamp-2 text-left text-sm font-medium leading-snug text-marfil [overflow-wrap:anywhere] hover:underline"
      >
        {nota.titulo}
      </button>
      <p className="mt-1 line-clamp-2 text-xs leading-snug text-marfil/65 [overflow-wrap:anywhere]">{nota.resumen}</p>
      <span className="mt-auto block pt-3">
        <span className="flex items-center gap-2 text-xs text-marfil/55">
          <span className="truncate">NODOS{fecha ? ` · ${fecha}` : ""}</span>
          {consulta?.paso === "enviada" ? (
            <span className="ml-auto inline-flex shrink-0 items-center gap-1 font-medium text-marfil/75">
              <Check size={12} className="text-cobre" /> Enviada
            </span>
          ) : (
            <button type="button" onClick={onConsultar} className="ml-auto inline-flex shrink-0 items-center gap-1 font-medium text-cobre transition hover:text-marfil">
              <MessageCircle size={12} /> Consultar
            </button>
          )}
        </span>
        {afecta && (
          <span className="mt-1 block truncate text-[11px] text-marfil/45" title={afecta}>
            {afecta}
          </span>
        )}
      </span>
    </article>
  );
}

/** Panel de la nota abierta, debajo de la tira: texto completo y la
 * confirmación explícita antes de enviar una consulta. */
function DetalleNota({
  nota,
  afecta,
  consulta,
  onConsulta,
  onEnviar,
  onCerrar,
}: {
  nota: NotaNodos;
  afecta: string | null;
  consulta: EstadoConsulta | undefined;
  onConsulta: (estado: EstadoConsulta | undefined) => void;
  onEnviar: () => void;
  onCerrar?: () => void;
}) {
  const link = urlSegura(nota.link);
  return (
    <div role="region" aria-label="Nota NODOS" className="animate-fade-in mt-3 rounded-lg bg-marfil/10 p-4 ring-1 ring-inset ring-cobre/40 sm:p-5">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="flex min-w-0 items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-cobre">
            {nota.destacada && <Star size={11} className="shrink-0 fill-current" aria-label="Destacada" />}
            <span className="truncate">{kickerNota(nota)}</span>
          </p>
          <h3 className="mt-1 font-display text-base font-semibold leading-snug !text-marfil [overflow-wrap:anywhere]">{nota.titulo}</h3>
        </div>
        {onCerrar && (
          <button type="button" onClick={onCerrar} aria-label="Cerrar nota" className="-m-1 shrink-0 rounded-full p-1.5 text-marfil/60 transition hover:bg-marfil/10 hover:text-marfil">
            <X size={16} />
          </button>
        )}
      </div>
      <p className="mt-1.5 max-w-3xl whitespace-pre-line text-sm leading-relaxed text-marfil/80 [overflow-wrap:anywhere]">{nota.resumen}</p>
      {nota.cuerpo && <p className="mt-2 max-w-3xl whitespace-pre-line text-sm leading-relaxed text-marfil/70 [overflow-wrap:anywhere]">{nota.cuerpo}</p>}
      {(link || afecta) && (
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
          {link && (
            <a href={link} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer" className="inline-flex items-center gap-1 font-medium text-cobre hover:text-marfil">
              Ver fuente <ExternalLink size={11} aria-hidden="true" />
            </a>
          )}
          {afecta && <span className="min-w-0 truncate text-marfil/50">{afecta}</span>}
        </div>
      )}

      <div className="mt-4 border-t border-marfil/15 pt-4">
        {consulta?.paso === "enviada" ? (
          <p className="inline-flex items-center gap-1.5 text-sm font-medium text-marfil" role="status">
            <Check size={15} className="text-cobre" /> {consulta.repetida ? "Ya habíamos recibido tu consulta sobre esta nota." : "Listo. Te respondemos a tu email."}
          </p>
        ) : consulta && consulta.paso !== "error" ? (
          <div role="region" aria-label="Confirmar consulta" className="animate-fade-in text-sm">
            <p className="font-medium text-marfil">¿Enviamos tu consulta?</p>
            <p className="mt-1 text-marfil/75">Vamos a enviar tu nombre y email a NODOS para responderte. No enviamos datos de tus empresas.</p>
            <p className="mt-1 text-xs text-marfil/55 [overflow-wrap:anywhere]">Mensaje: “Consulta sobre la nota: {nota.titulo}”</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" className="btn bg-cobre-hover text-marfil hover:bg-cobre" onClick={onEnviar} disabled={consulta.paso === "enviando"}>
                {consulta.paso === "enviando" ? "Enviando..." : "Sí, enviar consulta"}
              </button>
              <button
                type="button"
                className="btn border border-marfil/25 text-marfil/85 hover:border-marfil/50 hover:text-marfil"
                onClick={() => onConsulta(undefined)}
                disabled={consulta.paso === "enviando"}
              >
                Cancelar
              </button>
            </div>
          </div>
        ) : (
          <>
            <button type="button" className="btn bg-cobre-hover !py-1.5 text-sm text-marfil hover:bg-cobre" onClick={() => onConsulta({ paso: "confirmando" })}>
              <MessageCircle size={14} /> Consultar sobre esto
            </button>
            {consulta?.paso === "error" && (
              <p className="mt-2 text-xs font-medium text-[#f2b8ad]" role="alert">
                {consulta.message}
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/** Vista previa de una nota para el Panel (sin envío de consultas). */
export function NotaPreview({ nota }: { nota: NotaNodos }) {
  const [consulta, setConsulta] = useState<EstadoConsulta | undefined>(undefined);
  return (
    <div className="rounded-2xl bg-musgo p-4 text-marfil">
      <div className="flex">
        <TarjetaNota nota={nota} ahora={0} afecta={null} consulta={undefined} abierta={false} onAbrir={() => {}} onConsultar={() => setConsulta({ paso: "confirmando" })} ancho="w-full max-w-xs" />
      </div>
      <DetalleNota nota={nota} afecta={null} consulta={consulta} onConsulta={setConsulta} onEnviar={() => setConsulta(undefined)} />
    </div>
  );
}

function Cargando() {
  return (
    <div className="no-scrollbar flex gap-3 overflow-hidden" aria-busy="true" aria-label="Cargando novedades">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="w-[78%] shrink-0 rounded-lg bg-marfil/10 p-4 sm:w-[calc(50%-6px)] lg:w-[calc(25%-9px)]">
          <div className="h-2.5 w-12 animate-pulse rounded bg-marfil/15" />
          <div className="mt-3 h-3 w-full animate-pulse rounded bg-marfil/15" />
          <div className="mt-2 h-3 w-4/5 animate-pulse rounded bg-marfil/15" />
          <div className="mt-4 h-2.5 w-24 animate-pulse rounded bg-marfil/10" />
        </div>
      ))}
    </div>
  );
}

function Aviso({ children }: { children: React.ReactNode }) {
  return <div className="rounded-lg bg-marfil/10 p-4 text-sm text-marfil/70">{children}</div>;
}

// ── Vista ────────────────────────────────────────────────────────────────

const MAX_VISIBLES = 10;

type ItemNovedad = { tipo: "novedad"; key: string; n: Novedad; afectadas: EmpresaCtx[]; ahora: number };
type ItemNota = { tipo: "nota"; key: string; n: NotaNodos; afectadas: EmpresaCtx[] };
type Item = ItemNovedad | ItemNota;

/** Vista sin carga de datos (la usa el bloque y el banco de pruebas). */
export function NovedadesVista({
  empresas,
  normativa,
  rubro,
  notas,
  notasCargando = false,
  variant = "banda",
  onConsultar,
}: {
  empresas: EmpresaCtx[];
  normativa: FuenteNovedades;
  rubro: FuenteNovedades;
  notas: NotaNodos[];
  notasCargando?: boolean;
  variant?: VarianteNovedades;
  onConsultar: (nota: NotaNodos) => Promise<ResultadoConsulta>;
}) {
  const compacta = variant === "compacta";
  const [filtro, setFiltro] = useState<Filtro>("todas");
  const [empresaFiltro, setEmpresaFiltro] = useState<string>("");
  const [abierta, setAbierta] = useState<string | null>(null);
  const [consultas, setConsultas] = useState<Record<string, EstadoConsulta | undefined>>({});
  const scroller = useRef<HTMLDivElement>(null);

  const total = empresas.length;
  const empresaVigente = !compacta && empresaFiltro && empresas.some((e) => e.id === empresaFiltro) ? empresaFiltro : null;
  const enFiltro = (afectadas: EmpresaCtx[]) => !empresaVigente || afectadas.some((e) => e.id === empresaVigente);
  const ahora = normativa.ahora || rubro.ahora;

  // Con empresas cargadas, solo titulares de temas que le aplican a alguna.
  const deFuente = (f: FuenteNovedades): ItemNovedad[] =>
    f.items
      .map((n) => ({ tipo: "novedad" as const, key: `n:${n.url}`, n, afectadas: empresasAfectadas(n.tema, empresas), ahora: f.ahora }))
      .filter((x) => (total === 0 || x.afectadas.length > 0) && enFiltro(x.afectadas));
  const itemsNormativa = deFuente(normativa);
  const itemsRubro = deFuente(rubro);
  const itemsNotas: ItemNota[] = notas
    .filter((n) => n.publicada && notaVisible(n, empresas))
    .map((n) => ({ tipo: "nota" as const, key: `nota:${n.id}`, n, afectadas: empresasDeNota(n, empresas) }))
    .filter((x) => enFiltro(x.afectadas))
    .sort((a, b) => Number(b.n.destacada) - Number(a.n.destacada) || (b.n.publicada_el ?? "").localeCompare(a.n.publicada_el ?? ""));

  const sinRubro = total > 0 && empresas.every((e) => e.rubro === null);
  const primeraSinRubro = empresas.find((e) => e.rubro === null || e.rubroEstimado);

  // "Todas": notas destacadas primero, después los titulares (más nuevos
  // arriba, sin repetidos) y al final el resto de las notas.
  const titulares = (() => {
    const vistos = new Set<string>();
    return [...itemsNormativa, ...itemsRubro]
      .filter((x) => (vistos.has(x.key) ? false : (vistos.add(x.key), true)))
      .sort((a, b) => (b.n.fecha || "").localeCompare(a.n.fecha || ""));
  })();
  const itemsTodas: Item[] = [
    ...itemsNotas.filter((x) => x.n.destacada),
    ...titulares,
    ...itemsNotas.filter((x) => !x.n.destacada),
  ];

  let estado: EstadoNovedades;
  let lista: Item[];
  let reintentar: (() => void) | undefined;
  let vacio: React.ReactNode;
  if (filtro === "normativa") {
    ({ estado, reintentar } = normativa);
    lista = itemsNormativa;
    vacio = "No hay titulares recientes de los organismos que siguen tus empresas. Volvé a mirar más tarde.";
  } else if (filtro === "rubro") {
    ({ estado, reintentar } = rubro);
    lista = itemsRubro;
    vacio = "No hay titulares recientes de tu rubro. Volvé a mirar más tarde.";
  } else if (filtro === "notas") {
    estado = notasCargando ? "cargando" : "ok";
    lista = itemsNotas;
    vacio = "Todavía no hay notas del equipo NODOS para tus empresas.";
  } else {
    lista = itemsTodas;
    const fuentes = sinRubro ? [normativa] : [normativa, rubro];
    estado =
      lista.length > 0
        ? "ok"
        : fuentes.some((f) => f.estado === "cargando") || notasCargando
          ? "cargando"
          : fuentes.every((f) => f.estado === "error")
            ? "error"
            : "ok";
    reintentar = () => fuentes.forEach((f) => f.estado === "error" && f.reintentar?.());
    vacio = "No hay novedades recientes para tus empresas. Volvé a mirar más tarde.";
  }
  const visibles = lista.slice(0, MAX_VISIBLES);
  const algunaConError = filtro === "todas" && estado === "ok" && [normativa, ...(sinRubro ? [] : [rubro])].some((f) => f.estado === "error");

  const notaAbierta = abierta ? itemsNotas.find((x) => x.n.id === abierta) : undefined;

  function mover(dir: 1 | -1) {
    const el = scroller.current;
    if (el) el.scrollBy({ left: dir * el.clientWidth * 0.9, behavior: "smooth" });
  }

  function elegir(f: Filtro) {
    setFiltro(f);
    scroller.current?.scrollTo({ left: 0 });
  }

  async function enviar(nota: NotaNodos) {
    setConsultas((c) => ({ ...c, [nota.id]: { paso: "enviando" } }));
    const r = await onConsultar(nota);
    setConsultas((c) => ({ ...c, [nota.id]: r.ok ? { paso: "enviada", repetida: r.repetida } : { paso: "error", message: r.message } }));
  }

  const filtros: { id: Filtro; label: string }[] = [
    { id: "todas", label: "Todas" },
    { id: "normativa", label: "Normativa" },
    { id: "rubro", label: "Tu rubro" },
    { id: "notas", label: "Notas NODOS" },
  ];

  const tira = (
    <>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <p className="t-caption flex items-center gap-1.5 uppercase tracking-[0.1em] text-marfil/60 sm:tracking-[0.14em]">
          <Newspaper size={13} className="text-cobre" aria-hidden="true" /> {compacta ? "Novedades para esta empresa" : "Novedades para tus empresas"}
        </p>
        <div className="flex items-center gap-2">
          {!compacta && total > 1 && (
            <label className="relative inline-flex min-w-0 items-center">
              <span className="sr-only">Filtrar por empresa</span>
              <select
                value={empresaVigente ?? ""}
                onChange={(e) => {
                  setEmpresaFiltro(e.target.value);
                  scroller.current?.scrollTo({ left: 0 });
                }}
                className={`max-w-[13rem] cursor-pointer appearance-none truncate rounded-full border py-1 pl-3 pr-7 text-xs font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-cobre ${
                  empresaVigente ? "border-cobre bg-cobre text-marfil" : "border-marfil/20 bg-transparent text-marfil/75 hover:border-marfil/40 hover:text-marfil"
                }`}
              >
                <option value="" className="bg-white text-carbon">
                  Todas las empresas
                </option>
                {empresas.map((e) => (
                  <option key={e.id} value={e.id} className="bg-white text-carbon">
                    {e.nombre}
                  </option>
                ))}
              </select>
              <ChevronDown size={13} className="pointer-events-none absolute right-2.5 text-marfil/70" aria-hidden="true" />
            </label>
          )}
          {estado === "ok" && visibles.length > 1 && (
            <div className="hidden gap-1 sm:flex">
              <button type="button" aria-label="Anteriores" onClick={() => mover(-1)} className="rounded-full p-1.5 text-marfil/70 transition hover:bg-marfil/10 hover:text-marfil">
                <ChevronLeft size={16} />
              </button>
              <button type="button" aria-label="Siguientes" onClick={() => mover(1)} className="rounded-full p-1.5 text-marfil/70 transition hover:bg-marfil/10 hover:text-marfil">
                <ChevronRight size={16} />
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="no-scrollbar -mx-1 mt-3 flex gap-2 overflow-x-auto px-1 pb-1" role="group" aria-label="Tipo de novedad">
        {filtros.map((f) => (
          <button key={f.id} type="button" className={chipClass(filtro === f.id)} aria-pressed={filtro === f.id} onClick={() => elegir(f.id)}>
            {f.label}
          </button>
        ))}
      </div>

      <div className="mt-3">
        {filtro === "rubro" && sinRubro ? (
          <Aviso>
            Elegí el rubro de tu empresa para ver noticias de tu sector.{" "}
            {primeraSinRubro && (
              <Link href={`/empresas/${primeraSinRubro.id}?tab=datos`} className="font-medium text-marfil underline-offset-2 hover:underline">
                Completar rubro
              </Link>
            )}
          </Aviso>
        ) : estado === "cargando" ? (
          <Cargando />
        ) : estado === "error" ? (
          <div className="flex flex-wrap items-center gap-3 rounded-lg bg-marfil/10 p-4 text-sm text-marfil/75">
            No pudimos traer las novedades en este momento.
            {reintentar && (
              <button type="button" onClick={reintentar} className="inline-flex items-center gap-1 font-medium text-marfil underline-offset-2 hover:underline">
                <RotateCw size={13} /> Reintentar
              </button>
            )}
          </div>
        ) : visibles.length === 0 ? (
          <Aviso>{vacio}</Aviso>
        ) : (
          <div ref={scroller} className="no-scrollbar relative -mx-1 flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-smooth px-1 pb-1">
            {visibles.map((x) =>
              x.tipo === "novedad" ? (
                <TarjetaNovedad key={x.key} n={x.n} ahora={x.ahora} afecta={compacta ? null : textoAfecta(x.afectadas, total)} />
              ) : (
                <TarjetaNota
                  key={x.key}
                  nota={x.n}
                  ahora={ahora}
                  afecta={compacta ? null : textoAfecta(x.afectadas, total)}
                  consulta={consultas[x.n.id]}
                  abierta={abierta === x.n.id}
                  onAbrir={() => setAbierta(abierta === x.n.id ? null : x.n.id)}
                  onConsultar={() => {
                    setAbierta(x.n.id);
                    setConsultas((c) => ({ ...c, [x.n.id]: { paso: "confirmando" } }));
                  }}
                />
              )
            )}
          </div>
        )}
      </div>

      {filtro === "rubro" && !sinRubro && primeraSinRubro && rubro.estado === "ok" && (
        <p className="mt-2 text-[11px] text-marfil/55">
          {primeraSinRubro.rubroEstimado
            ? `Estimamos el rubro de ${primeraSinRubro.nombre} por su actividad o su nombre.`
            : `${primeraSinRubro.nombre} no tiene rubro cargado.`}{" "}
          <Link href={`/empresas/${primeraSinRubro.id}?tab=datos`} className="font-medium text-marfil underline-offset-2 hover:underline">
            Elegilo vos
          </Link>
        </p>
      )}
      {algunaConError && (
        <p className="mt-2 flex flex-wrap items-center gap-x-2 text-[11px] text-marfil/55">
          Algunas novedades no se pudieron cargar.
          <button type="button" onClick={reintentar} className="inline-flex items-center gap-1 font-medium text-marfil underline-offset-2 hover:underline">
            <RotateCw size={11} /> Reintentar
          </button>
        </p>
      )}

      {notaAbierta && (
        <DetalleNota
          nota={notaAbierta.n}
          afecta={compacta ? null : textoAfecta(notaAbierta.afectadas, total)}
          consulta={consultas[notaAbierta.n.id]}
          onConsulta={(e) => setConsultas((c) => ({ ...c, [notaAbierta.n.id]: e }))}
          onEnviar={() => enviar(notaAbierta.n)}
          onCerrar={() => setAbierta(null)}
        />
      )}

      <p className="mt-3 text-[11px] leading-snug text-marfil/45">{DISCLAIMER_NOVEDADES}</p>
    </>
  );

  if (compacta) {
    return (
      <section className="mt-6 rounded-2xl bg-musgo px-5 py-6 text-marfil sm:px-8" aria-label="Novedades para esta empresa">
        {tira}
      </section>
    );
  }
  return (
    <div className="mt-6 border-t border-marfil/15 pt-5" aria-label="Novedades para tus empresas" role="region">
      {tira}
    </div>
  );
}
