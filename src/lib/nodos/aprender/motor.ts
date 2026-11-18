/**
 * Motor de la Carrera: arma cada mes, registra decisiones y cierra el mes.
 * Es puro y determinístico: no toca la base ni el reloj; con la misma
 * semilla y las mismas decisiones da siempre el mismo resultado.
 *
 * Ciclo: nuevaCarrera → (planMes → decidir … → cerrarMes) × N.
 */
import { generador, normal, sortear } from "./azar";
import {
  ACTIVOS,
  NOMBRE_MES,
  PARAMETROS,
  calcularEtapa,
  fechaDelMes,
  herenciaInicial,
  indiceSalud,
  nivelEtapa,
  patrimonio,
} from "./economia";
import type {
  ActivoId,
  Arranque,
  Carrera,
  Contenido,
  Efectos,
  Evento,
  LeccionDesbloqueada,
  PlanMes,
  Requisitos,
  ResumenMes,
  SituacionAbierta,
} from "./tipos";
import { VERSION_ESTADO } from "./tipos";

const r0 = (n: number) => Math.round(n);
const clonar = <T>(x: T): T => JSON.parse(JSON.stringify(x)) as T;

/** Situaciones nuevas por mes (además de las que siguen abiertas). */
const NUEVAS_POR_MES = { min: 1, max: 2, tope: 3 };

// ── Crear ─────────────────────────────────────────────────────────────────

export function nuevaCarrera(opts: { semilla: number; arranque?: Arranque; puntosHerencia?: number }, contenido: Contenido): Carrera {
  const a = PARAMETROS.arranques[opts.arranque ?? "normal"];
  const c: Carrera = {
    version: VERSION_ESTADO,
    semilla: opts.semilla >>> 0,
    mes: 1,
    estado: "activa",
    etapa: "empleado",
    etapaMax: "empleado",
    efectivo: a.efectivo + herenciaInicial(opts.puntosHerencia ?? 0, a.sueldo),
    ahorro: 0,
    activos: {},
    deudaTarjeta: 0,
    limiteTarjeta: a.sueldo * PARAMETROS.limiteTarjetaSueldos,
    prestamo: null,
    sueldo: a.sueldo,
    gastosFijos: a.gastosFijos,
    nivelVida: "normal",
    negocio: null,
    reputacion: 50,
    mora: 0,
    marcas: [],
    programadas: [],
    abiertas: [],
    vistas: {},
    lecciones: [],
    indiceSalud: 0,
  };
  return iniciarMes(c, contenido);
}

// ── Requisitos ────────────────────────────────────────────────────────────

export function cumple(c: Carrera, req: Requisitos | undefined, programada: boolean): boolean {
  if (!req) return true;
  if (req.soloProgramada && !programada) return false;
  if (req.etapaMinima && nivelEtapa(c.etapaMax) < nivelEtapa(req.etapaMinima)) return false;
  if (req.marca && !c.marcas.includes(req.marca)) return false;
  if (req.sinMarca && c.marcas.includes(req.sinMarca)) return false;
  if (req.activo && !((c.activos[req.activo]?.valor ?? 0) > 0)) return false;
  if (req.conDeudaTarjeta && c.deudaTarjeta <= 0) return false;
  if (req.conNegocio && !c.negocio) return false;
  if (req.meses && !req.meses.includes(fechaDelMes(c.mes, c.semilla).mesDelAnio)) return false;
  return true;
}

// ── Inicio de mes ─────────────────────────────────────────────────────────

/** Elige las situaciones del mes y aplica los movimientos de precio de las abiertas. */
function iniciarMes(entrada: Carrera, contenido: Contenido): Carrera {
  const c = clonar(entrada);
  // Movimientos de precio de las situaciones con trayectoria (incluye la que aparece).
  const aplicarTrayectoria = (a: SituacionAbierta) => {
    const s = contenido.situaciones.get(a.id);
    const t = s?.trayectoria;
    if (!t) return;
    const k = c.mes - a.desde;
    const cambio = t.cambios[k];
    const pos = c.activos[t.activo];
    if (cambio === undefined || !pos) return;
    pos.valor = Math.max(0, r0(pos.valor * (1 + cambio)));
  };
  for (const a of c.abiertas) aplicarTrayectoria(a);

  const abiertasIds = new Set(c.abiertas.map((a) => a.id));
  const nuevas: string[] = [];
  // 1. Programadas por decisiones anteriores.
  for (const p of c.programadas.filter((x) => x.mes === c.mes)) {
    const s = contenido.situaciones.get(p.id);
    if (s && !abiertasIds.has(s.id) && !nuevas.includes(s.id) && cumple(c, s.requisitos, true)) nuevas.push(s.id);
  }
  c.programadas = c.programadas.filter((x) => x.mes > c.mes);
  // 2. Sorteo entre las que cumplen requisitos.
  const r = generador(c.semilla, c.mes, "situaciones");
  const cupo = Math.max(0, NUEVAS_POR_MES.tope - c.abiertas.length - nuevas.length);
  const cuantas = Math.min(cupo, NUEVAS_POR_MES.min + Math.floor(r() * (NUEVAS_POR_MES.max - NUEVAS_POR_MES.min + 1)));
  const candidatas = Array.from(contenido.situaciones.values())
    .filter((s) => !abiertasIds.has(s.id) && !nuevas.includes(s.id))
    .filter((s) => s.repetible || !c.vistas[s.id])
    .filter((s) => cumple(c, s.requisitos, false))
    .sort((x, y) => x.id.localeCompare(y.id))
    .map((s) => ({ item: s.id, peso: (s.peso ?? 1) * (s.requisitos?.meses ? 4 : 1) }));
  nuevas.push(...sortear(r, candidatas, cuantas));

  for (const id of nuevas) {
    const a: SituacionAbierta = { id, desde: c.mes };
    c.abiertas.push(a);
    c.vistas[id] = (c.vistas[id] ?? 0) + 1;
    aplicarTrayectoria(a);
  }
  return c;
}

// ── Plan del mes (para el escritorio y el calendario) ──────────────────────

export function planMes(c: Carrera, contenido: Contenido): PlanMes {
  const f = fechaDelMes(c.mes, c.semilla);
  const eventos: Evento[] = [];
  for (const fijo of PARAMETROS.fijos) eventos.push({ dia: fijo.dia, tipo: "gasto", titulo: fijo.titulo, monto: -r0(c.gastosFijos * fijo.parte) });
  eventos.push({ dia: 20, tipo: "gasto", titulo: "Gastos del mes (nivel de vida)", monto: -r0(c.sueldo * PARAMETROS.nivelVida[c.nivelVida]) });
  if (c.prestamo) eventos.push({ dia: 8, tipo: "vencimiento", titulo: "Cuota del préstamo", monto: -c.prestamo.cuota });
  if (c.deudaTarjeta > 0) eventos.push({ dia: 15, tipo: "vencimiento", titulo: "Vence la tarjeta", monto: -c.deudaTarjeta });
  if (c.sueldo > 0) eventos.push({ dia: Math.min(PARAMETROS.diaSueldo, f.dias), tipo: "ingreso", titulo: "Cobro de sueldo", monto: c.sueldo });
  if (f.mesDelAnio === 12 && c.sueldo > 0) eventos.push({ dia: 20, tipo: "ingreso", titulo: "Aguinaldo", monto: c.sueldo });
  if (c.negocio) eventos.push({ dia: 28, tipo: "ingreso", titulo: `Resultado de ${c.negocio.nombre}`, monto: c.negocio.flujoBase });

  // Días de las situaciones: las que siguen abiertas, el 1; las nuevas, al azar.
  const r = generador(c.semilla, c.mes, "dias");
  const libres = Array.from({ length: f.dias - 4 }, (_, i) => i + 2);
  for (const a of c.abiertas) {
    const s = contenido.situaciones.get(a.id);
    if (!s) continue;
    let dia = 1;
    if (a.desde === c.mes && s.dia) dia = Math.min(s.dia, f.dias);
    else if (a.desde === c.mes && libres.length) dia = libres.splice(Math.floor(r() * libres.length), 1)[0];
    eventos.push({ dia, tipo: s.tipo, titulo: s.titulo, situacion: s.id });
  }
  eventos.sort((x, y) => x.dia - y.dia || x.titulo.localeCompare(y.titulo));
  return { mes: c.mes, anio: f.anio, mesDelAnio: f.mesDelAnio, dias: f.dias, primerDia: f.primerDia, eventos, situaciones: c.abiertas.map((a) => a.id) };
}

export function nombreMes(c: Carrera): string {
  const f = fechaDelMes(c.mes, c.semilla);
  return `${NOMBRE_MES[f.mesDelAnio - 1]}, año ${f.anio}`;
}

// ── Decidir ───────────────────────────────────────────────────────────────

/** ¿Se puede todavía elegir o cambiar la opción? (hasta que cierra el mes en que decidiste) */
export function puedeDecidir(c: Carrera, situacion: string): boolean {
  const a = c.abiertas.find((x) => x.id === situacion);
  return !!a && (a.decididaEn === undefined || a.decididaEn === c.mes);
}

export function decidir(c: Carrera, contenido: Contenido, situacion: string, opcion: string): Carrera {
  if (c.estado !== "activa") throw new Error("La carrera terminó.");
  const s = contenido.situaciones.get(situacion);
  if (!s || !s.opciones.some((o) => o.id === opcion)) throw new Error("Esa opción no existe.");
  if (!puedeDecidir(c, situacion)) throw new Error("Esa situación ya se decidió.");
  const n = clonar(c);
  const a = n.abiertas.find((x) => x.id === situacion)!;
  a.elegida = opcion;
  a.decididaEn = n.mes;
  return n;
}

// ── Efectos ───────────────────────────────────────────────────────────────

/** Paga con efectivo; si no alcanza, con ahorro; si tampoco, con tarjeta (el resto queda en negativo). */
function pagar(c: Carrera, monto: number) {
  let resto = Math.max(0, r0(monto));
  const delEfectivo = Math.min(resto, Math.max(0, c.efectivo));
  c.efectivo -= delEfectivo;
  resto -= delEfectivo;
  const delAhorro = Math.min(resto, c.ahorro);
  c.ahorro -= delAhorro;
  resto -= delAhorro;
  const deTarjeta = Math.min(resto, Math.max(0, c.limiteTarjeta - c.deudaTarjeta));
  c.deudaTarjeta += deTarjeta;
  resto -= deTarjeta;
  c.efectivo -= resto;
}

/** Plata disponible para invertir sin endeudarse. */
const disponible = (c: Carrera) => Math.max(0, c.efectivo) + c.ahorro;

function aplicarEfectos(c: Carrera, ef: Efectos, avisos: string[]) {
  if (ef.efectivo) {
    if (ef.efectivo >= 0) c.efectivo += ef.efectivo;
    else pagar(c, -ef.efectivo);
  }
  if (ef.ahorro) {
    if (ef.ahorro > 0) {
      const m = Math.min(ef.ahorro, Math.max(0, c.efectivo));
      c.efectivo -= m;
      c.ahorro += m;
      if (m < ef.ahorro) avisos.push("No alcanzó el efectivo para ahorrar todo lo que elegiste.");
    } else {
      const m = Math.min(-ef.ahorro, c.ahorro);
      c.ahorro -= m;
      c.efectivo += m;
    }
  }
  if (ef.deudaTarjeta) c.deudaTarjeta = Math.max(0, c.deudaTarjeta + ef.deudaTarjeta);
  if (ef.sueldo) c.sueldo = Math.max(0, c.sueldo + ef.sueldo);
  if (ef.gastosFijos) c.gastosFijos = Math.max(0, c.gastosFijos + ef.gastosFijos);
  if (ef.reputacion) c.reputacion = Math.max(0, Math.min(100, c.reputacion + ef.reputacion));
  if (ef.nivelVida) c.nivelVida = ef.nivelVida;
  if (ef.invertir) {
    const m = Math.min(ef.invertir.monto, disponible(c));
    if (m > 0) {
      pagar(c, m);
      const p = c.activos[ef.invertir.activo] ?? { valor: 0, invertido: 0 };
      p.valor += m;
      p.invertido += m;
      c.activos[ef.invertir.activo] = p;
    }
    if (m < ef.invertir.monto) avisos.push(`Invertiste ${m.toLocaleString("es-PY")} en ${ACTIVOS[ef.invertir.activo].nombre}: no tenías más disponible.`);
  }
  if (ef.vender) {
    const p = c.activos[ef.vender.activo];
    if (p) {
      const parte = Math.max(0, Math.min(1, ef.vender.parte));
      const v = r0(p.valor * parte);
      c.efectivo += v;
      p.valor -= v;
      p.invertido = r0(p.invertido * (1 - parte));
      if (p.valor <= 0) delete c.activos[ef.vender.activo];
    }
  }
  if (ef.perder) {
    const p = c.activos[ef.perder.activo];
    if (p) {
      p.valor = r0(p.valor * (1 - Math.max(0, Math.min(1, ef.perder.parte))));
      if (p.valor <= 0) delete c.activos[ef.perder.activo];
    }
  }
  if (ef.negocio) {
    if (c.negocio) avisos.push("Ya tenés un negocio: no se abrió otro.");
    else if (disponible(c) < ef.negocio.aporte) avisos.push("No tenías el aporte para abrir el negocio.");
    else {
      pagar(c, ef.negocio.aporte);
      c.negocio = { ...ef.negocio, meses: 0 };
    }
  }
  if (ef.dejarTrabajo) c.sueldo = 0;
  if (ef.prestamo) {
    c.efectivo += ef.prestamo.monto;
    c.prestamo = { saldo: (c.prestamo?.saldo ?? 0) + ef.prestamo.cuota * ef.prestamo.meses, cuota: (c.prestamo?.cuota ?? 0) + ef.prestamo.cuota };
  }
}

// ── Cierre de mes ─────────────────────────────────────────────────────────

export function cerrarMes(entrada: Carrera, contenido: Contenido): { carrera: Carrera; resumen: ResumenMes } {
  if (entrada.estado !== "activa") throw new Error("La carrera terminó.");
  const c = clonar(entrada);
  const f = fechaDelMes(c.mes, c.semilla);
  const antes = patrimonio(c);
  const ingresos: ResumenMes["ingresos"] = [];
  const gastos: ResumenMes["gastos"] = [];
  const movimientos: ResumenMes["movimientos"] = [];
  const avisos: string[] = [];
  const lecciones: LeccionDesbloqueada[] = [];

  // 1. Rendimientos del mes (las situaciones con trayectoria mueven su activo aparte).
  const conTrayectoria = new Set(
    c.abiertas.map((a) => contenido.situaciones.get(a.id)?.trayectoria?.activo).filter((x): x is ActivoId => !!x),
  );
  const interes = r0(c.ahorro * PARAMETROS.interesAhorro);
  if (interes) {
    c.ahorro += interes;
    movimientos.push({ concepto: "Interés de la caja de ahorro", monto: interes });
  }
  for (const id of Object.keys(c.activos).sort() as ActivoId[]) {
    const p = c.activos[id]!;
    if (conTrayectoria.has(id)) continue;
    const a = ACTIVOS[id];
    const rr = generador(c.semilla, c.mes, "precio", id);
    const ret = Math.max(-0.9, a.mu + a.sigma * normal(rr));
    const d = r0(p.valor * ret);
    if (d) {
      p.valor = Math.max(0, p.valor + d);
      movimientos.push({ concepto: a.nombre, monto: d });
    }
  }

  // 2. Ingresos.
  if (c.sueldo > 0) {
    c.efectivo += c.sueldo;
    ingresos.push({ concepto: "Sueldo", monto: c.sueldo });
    if (f.mesDelAnio === 12) {
      c.efectivo += c.sueldo;
      ingresos.push({ concepto: "Aguinaldo", monto: c.sueldo });
    }
  }
  if (c.negocio) {
    const rr = generador(c.semilla, c.mes, "negocio");
    const flujo = r0(c.negocio.flujoBase * (1 + c.negocio.volatilidad * normal(rr)));
    c.negocio.meses += 1;
    if (flujo >= 0) {
      c.efectivo += flujo;
      ingresos.push({ concepto: `Resultado de ${c.negocio.nombre}`, monto: flujo });
    } else {
      pagar(c, -flujo);
      gastos.push({ concepto: `Pérdida de ${c.negocio.nombre}`, monto: flujo });
    }
  }
  const ingresoDelMes = ingresos.reduce((s, x) => s + x.monto, 0);

  // 3. Decisiones: se aplican las del mes y, al terminar su plazo, la opción por defecto.
  const siguen: SituacionAbierta[] = [];
  for (const a of c.abiertas) {
    const s = contenido.situaciones.get(a.id);
    if (!s) continue; // contenido retirado: se descarta sin efectos
    const largo = s.trayectoria?.cambios.length ?? 1;
    const ultimo = c.mes >= a.desde + largo - 1;
    let elegida = a.elegida;
    const yaAplicada = a.decididaEn !== undefined && a.decididaEn < c.mes;
    if (!elegida && ultimo) elegida = s.porDefecto;
    if (elegida && !yaAplicada) {
      const o = s.opciones.find((x) => x.id === elegida) ?? s.opciones.find((x) => x.id === s.porDefecto)!;
      aplicarEfectos(c, o.efectos, avisos);
      for (const m of o.marca ?? []) if (!c.marcas.includes(m)) c.marcas.push(m);
      c.marcas = c.marcas.filter((m) => !(o.quita ?? []).includes(m));
      for (const p of o.programa ?? []) c.programadas.push({ id: p.situacion, mes: c.mes + p.enMeses });
      a.elegida = o.id;
      a.decididaEn = a.decididaEn ?? c.mes;
    }
    if (elegida && ultimo) {
      const o = s.opciones.find((x) => x.id === a.elegida)!;
      const caso = s.leccion.casoReal ? contenido.casos.get(s.leccion.casoReal) : undefined;
      lecciones.push({
        situacion: s.id,
        opcion: o.id,
        leccion: s.leccion.id,
        titulo: s.leccion.titulo,
        resultado: o.resultado,
        nodo: o.nodo,
        reglas: s.leccion.reglas,
        casoReal: caso?.verificado ? caso : undefined,
      });
      if (!c.lecciones.includes(s.leccion.id)) c.lecciones.push(s.leccion.id);
    } else siguen.push(a);
  }
  c.abiertas = siguen;

  // 4. Gastos del mes.
  const fijos = c.gastosFijos;
  const vida = r0(c.sueldo * PARAMETROS.nivelVida[c.nivelVida]);
  pagar(c, fijos);
  gastos.push({ concepto: "Gastos fijos", monto: -fijos });
  if (vida) {
    pagar(c, vida);
    gastos.push({ concepto: "Gastos del mes (nivel de vida)", monto: -vida });
  }
  if (c.prestamo) {
    const cuota = Math.min(c.prestamo.cuota, c.prestamo.saldo);
    pagar(c, cuota);
    c.prestamo.saldo -= cuota;
    gastos.push({ concepto: "Cuota del préstamo", monto: -cuota });
    if (c.prestamo.saldo <= 0) c.prestamo = null;
  }

  // 5. Tarjeta: interés sobre lo que se arrastra y pago (total si se puede; mínimo si elegiste pagar el mínimo).
  let enMora = false;
  if (c.deudaTarjeta > 0) {
    const intereses = r0(entrada.deudaTarjeta * PARAMETROS.interesTarjeta);
    if (intereses) {
      c.deudaTarjeta += intereses;
      gastos.push({ concepto: "Intereses de la tarjeta", monto: -intereses });
    }
    const minimo = r0(c.deudaTarjeta * PARAMETROS.pagoMinimo);
    const quiereTotal = !c.marcas.includes("tarjeta-minimo");
    const caja = Math.max(0, c.efectivo);
    const pago = quiereTotal ? Math.min(c.deudaTarjeta, caja) : Math.min(minimo, caja);
    c.efectivo -= pago;
    c.deudaTarjeta -= pago;
    if (pago) gastos.push({ concepto: "Pago de la tarjeta", monto: -pago });
    if (pago < Math.min(minimo, c.deudaTarjeta + pago)) enMora = true;
  }

  // 6. Si el efectivo quedó negativo: ahorro y, si no alcanza, mora.
  if (c.efectivo < 0) {
    const m = Math.min(-c.efectivo, c.ahorro);
    c.ahorro -= m;
    c.efectivo += m;
    if (c.efectivo < 0) {
      enMora = true;
      avisos.push("No te alcanzó para cubrir lo del mes: quedó una deuda impaga.");
    }
  }
  c.mora = enMora ? c.mora + 1 : 0;

  // 7. Etapa, índice y fin de carrera.
  c.etapa = calcularEtapa(c);
  if (nivelEtapa(c.etapa) > nivelEtapa(c.etapaMax)) {
    c.etapaMax = c.etapa;
    avisos.push(`Nueva etapa: ${c.etapa}. Se desbloquearon nuevas situaciones.`);
  }
  const gastoTotal = gastos.reduce((s, x) => s + x.monto, 0);
  c.indiceSalud = indiceSalud(c, ingresoDelMes + gastoTotal, ingresoDelMes);
  if (c.mora >= PARAMETROS.moraQuiebra) {
    c.estado = "quebrada";
    avisos.push("Tres meses sin poder pagar: la carrera terminó. Las lecciones que aprendiste quedan como herencia.");
  }

  const resumen: ResumenMes = {
    mes: c.mes,
    ingresos,
    gastos,
    movimientos,
    patrimonioAntes: antes,
    patrimonioDespues: patrimonio(c),
    indiceSalud: c.indiceSalud,
    lecciones,
    avisos,
  };
  if (c.estado !== "activa") return { carrera: c, resumen };
  c.mes += 1;
  return { carrera: iniciarMes(c, contenido), resumen };
}

/** Puntos de herencia para la próxima carrera (una por lección distinta, sumando carreras anteriores). */
export function puntosHerencia(leccionesHistoricas: string[]): number {
  return new Set(leccionesHistoricas).size;
}

