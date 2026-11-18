import assert from "node:assert/strict";
import {
  CASOS,
  METAS,
  nombreValido,
  SITUACIONES,
  armarContenido,
  cerrarMes,
  decidir,
  generador,
  gastoMensual,
  mesesDeEmergencia,
  nuevaCarrera,
  patrimonio,
  planMes,
  puedeDecidir,
  validarCaso,
  validarSituacion,
  type Carrera,
  type Contenido,
  type ResumenMes,
} from "../src/lib/nodos/aprender";

let n = 0;
const ok = (t: string, f: () => void) => {
  f();
  n++;
  console.log("ok", t);
};

const contenido = armarContenido();

/** Juega N meses eligiendo al azar (con semilla) en cada situación abierta. */
function jugar(c: Carrera, meses: number, k: Contenido, politica = 1): { c: Carrera; resumenes: ResumenMes[] } {
  const resumenes: ResumenMes[] = [];
  for (let i = 0; i < meses && c.estado === "activa"; i++) {
    const r = generador(politica, c.mes, "jugador");
    for (const a of c.abiertas) {
      if (!puedeDecidir(c, a.id) || a.elegida) continue;
      const s = k.situaciones.get(a.id)!;
      if (r() < 0.2) continue; // a veces no decide
      c = decidir(c, k, a.id, s.opciones[Math.floor(r() * s.opciones.length)].id);
    }
    const x = cerrarMes(c, k);
    c = x.carrera;
    resumenes.push(x.resumen);
  }
  return { c, resumenes };
}

/** Lleva la carrera hasta que aparezca una situación (cerrando meses sin decidir). */
function hasta(c: Carrera, id: string, k: Contenido, tope = 6): Carrera {
  for (let i = 0; i < tope; i++) {
    if (c.abiertas.some((a) => a.id === id)) return c;
    c = cerrarMes(c, k).carrera;
  }
  throw new Error(`No apareció ${id}`);
}

ok("todo el contenido incluido es válido", () => {
  for (const s of SITUACIONES) assert.deepEqual(validarSituacion(s), [], s.id);
  for (const c of CASOS) assert.deepEqual(validarCaso(c), [], c.id);
  const ids = new Set(SITUACIONES.map((s) => s.id));
  assert.equal(ids.size, SITUACIONES.length, "ids repetidos");
  for (const s of SITUACIONES) {
    for (const o of s.opciones) for (const p of o.programa ?? []) assert.ok(ids.has(p.situacion), `${s.id} programa ${p.situacion}`);
    if (s.leccion.casoReal) assert.ok(CASOS.some((c) => c.id === s.leccion.casoReal), `${s.id} caso`);
  }
});

ok("la misma semilla da la misma carrera; otra semilla, otra", () => {
  const a = jugar(nuevaCarrera({ semilla: 42 }, contenido), 36, contenido).c;
  const b = jugar(nuevaCarrera({ semilla: 42 }, contenido), 36, contenido).c;
  const d = jugar(nuevaCarrera({ semilla: 43 }, contenido), 36, contenido).c;
  assert.equal(JSON.stringify(a), JSON.stringify(b));
  assert.notEqual(JSON.stringify(a), JSON.stringify(d));
});

ok("arranque normal y herencia con tope", () => {
  const c = nuevaCarrera({ semilla: 1 }, contenido);
  assert.equal(c.sueldo, 3_500_000);
  assert.equal(c.efectivo, 500_000);
  assert.equal(c.mes, 1);
  assert.ok(c.abiertas.length >= 1 && c.abiertas.length <= 3);
  assert.equal(nuevaCarrera({ semilla: 1, puntosHerencia: 3 }, contenido).efectivo, 500_000 + 750_000);
  assert.equal(nuevaCarrera({ semilla: 1, puntosHerencia: 999 }, contenido).efectivo, 500_000 + 6 * 3_500_000);
});

ok("cerrar un mes sin decidir: sueldo, gastos y opción por defecto", () => {
  const c0 = nuevaCarrera({ semilla: 7 }, contenido);
  const { carrera, resumen } = cerrarMes(c0, contenido);
  assert.equal(carrera.mes, 2);
  assert.ok(resumen.ingresos.some((x) => x.concepto === "Sueldo" && x.monto === 3_500_000));
  assert.ok(resumen.gastos.some((x) => x.concepto === "Gastos fijos" && x.monto === -2_600_000));
  // Las situaciones de un mes (sin trayectoria) se cierran con su lección.
  assert.equal(resumen.lecciones.length, c0.abiertas.length);
  assert.ok(carrera.indiceSalud >= 0 && carrera.indiceSalud <= 100);
});

ok("ahorrar el 10 % mueve la plata a la caja de ahorro", () => {
  let c = nuevaCarrera({ semilla: 3 }, contenido);
  c = { ...c, abiertas: [{ id: "sueldo-ahorro", desde: c.mes }] };
  c = decidir(c, contenido, "sueldo-ahorro", "diez");
  const r = cerrarMes(c, contenido);
  assert.equal(r.carrera.ahorro, 350_000);
  assert.equal(r.resumen.lecciones[0].leccion, "pagate-primero");
});

ok("cambiar de opción antes de cerrar; no después", () => {
  let c = nuevaCarrera({ semilla: 3 }, contenido);
  c = { ...c, abiertas: [{ id: "sueldo-ahorro", desde: c.mes }] };
  c = decidir(c, contenido, "sueldo-ahorro", "diez");
  c = decidir(c, contenido, "sueldo-ahorro", "veinte");
  assert.equal(cerrarMes(c, contenido).carrera.ahorro, 700_000);
  assert.throws(() => decidir(c, contenido, "sueldo-ahorro", "inexistente"));
});

function carreraAlfa(opcionCaida: string | null) {
  let c = nuevaCarrera({ semilla: 11 }, contenido);
  c = { ...c, etapaMax: "ahorrista", ahorro: 12_000_000, abiertas: [{ id: "alfa-oferta", desde: c.mes }] };
  c = decidir(c, contenido, "alfa-oferta", "dos");
  c = cerrarMes(c, contenido).carrera;
  const invertido = c.activos.alfa!.valor;
  assert.equal(invertido, 2_000_000);
  c = hasta(c, "alfa-cae", contenido);
  const desde = c.abiertas.find((a) => a.id === "alfa-cae")!.desde;
  assert.equal(desde, 3, "aparece 2 meses después");
  const alAparecer = c.activos.alfa!.valor;
  if (opcionCaida) c = decidir(c, contenido, "alfa-cae", opcionCaida);
  const r1 = cerrarMes(c, contenido);
  assert.ok(!r1.resumen.lecciones.some((l) => l.situacion === "alfa-cae"), "la lección llega un mes después");
  const r2 = cerrarMes(r1.carrera, contenido);
  const leccion = r2.resumen.lecciones.find((l) => l.situacion === "alfa-cae");
  return { alAparecer, antes: c, despues: r2.carrera, leccion };
}

ok("caso ALFA: cae 38 % al aparecer y la lección llega un mes después", () => {
  const { alAparecer, leccion, despues } = carreraAlfa("vender");
  // 2.000.000 con el 1,45 % mensual de un mes, y la caída del 38 %.
  assert.equal(alAparecer, Math.round(Math.round(2_000_000 * 1.0145) * 0.62));
  assert.equal(leccion?.opcion, "vender");
  assert.equal(leccion?.leccion, "cuando-algo-cae");
  assert.equal(despues.activos.alfa, undefined, "vendió todo");
  assert.ok(despues.lecciones.includes("cuando-algo-cae"));
});

ok("caso ALFA: mantener pierde el 95 % de lo que quedaba", () => {
  const { alAparecer, despues, leccion } = carreraAlfa("mantener");
  assert.equal(despues.activos.alfa!.valor, Math.round(alAparecer * 0.05));
  assert.equal(leccion?.opcion, "mantener");
});

ok("caso ALFA: comprar más pierde también lo agregado", () => {
  const { alAparecer, despues } = carreraAlfa("comprar");
  assert.equal(despues.activos.alfa!.valor, Math.round((alAparecer + 1_000_000) * 0.05));
  assert.equal(despues.activos.alfa!.invertido, 3_000_000);
});

ok("caso ALFA: sin decidir, se aplica “mantener” al terminar", () => {
  const { leccion } = carreraAlfa(null);
  assert.equal(leccion?.opcion, "mantener");
});

ok("el caso real solo se muestra si está verificado", () => {
  assert.equal(carreraAlfa("vender").leccion?.casoReal, undefined);
  const k = armarContenido([{ id: "terra-luna-2022", tipo: "caso", estado: "publicado", datos: { ...CASOS[0], verificado: true } }]);
  let c = nuevaCarrera({ semilla: 11 }, k);
  c = { ...c, etapaMax: "ahorrista", ahorro: 12_000_000, abiertas: [{ id: "alfa-oferta", desde: c.mes }] };
  c = cerrarMes(decidir(c, k, "alfa-oferta", "dos"), k).carrera;
  c = hasta(c, "alfa-cae", k);
  c = cerrarMes(decidir(c, k, "alfa-cae", "vender"), k).carrera;
  const l = cerrarMes(c, k).resumen.lecciones.find((x) => x.situacion === "alfa-cae");
  assert.equal(l?.casoReal?.id, "terra-luna-2022");
});

ok("el Panel reemplaza contenido válido e ignora el inválido", () => {
  const base = SITUACIONES.find((s) => s.id === "sueldo-ahorro")!;
  const k = armarContenido([
    { id: "sueldo-ahorro", tipo: "situacion", estado: "publicado", datos: { ...base, titulo: "Cobraste" } },
    { id: "rota", tipo: "situacion", estado: "publicado", datos: { titulo: "x" } },
    { id: "borrador-1", tipo: "situacion", estado: "borrador", datos: { ...base, id: "borrador-1" } },
  ]);
  assert.equal(k.situaciones.get("sueldo-ahorro")!.titulo, "Cobraste");
  assert.ok(!k.situaciones.has("rota"));
  assert.ok(!k.situaciones.has("borrador-1"));
});

ok("tarjeta: el pago mínimo deja saldo con intereses", () => {
  let c = nuevaCarrera({ semilla: 5 }, contenido);
  c = { ...c, deudaTarjeta: 1_000_000, marcas: ["tarjeta-minimo"], abiertas: [] };
  const r = cerrarMes(c, contenido);
  // 1.000.000 + 3,5 % = 1.035.000; paga el 10 % (103.500) → 931.500
  assert.equal(r.carrera.deudaTarjeta, 931_500);
  assert.equal(r.carrera.mora, 0);
  c = { ...c, marcas: [], efectivo: 2_000_000 };
  assert.equal(cerrarMes(c, contenido).carrera.deudaTarjeta, 0, "pago total si alcanza");
});

ok("tres meses sin poder pagar terminan la carrera", () => {
  let c = nuevaCarrera({ semilla: 9 }, contenido);
  c = { ...c, sueldo: 0, efectivo: 0, limiteTarjeta: 0, abiertas: [] };
  for (let i = 0; i < 3; i++) c = cerrarMes({ ...c, abiertas: [] }, contenido).carrera;
  assert.equal(c.estado, "quebrada");
  assert.throws(() => cerrarMes(c, contenido));
});

ok("con 3 meses de gastos ahorrados pasás a ahorrista", () => {
  let c = nuevaCarrera({ semilla: 2 }, contenido);
  c = { ...c, ahorro: gastoMensual(c) * 3, abiertas: [] };
  const r = cerrarMes(c, contenido);
  assert.ok(mesesDeEmergencia(r.carrera) >= 3);
  assert.equal(r.carrera.etapaMax, "ahorrista");
  assert.ok(r.resumen.avisos.some((a) => a.startsWith("Nueva etapa")));
});

ok("el calendario del mes es coherente", () => {
  for (let s = 0; s < 20; s++) {
    let c = nuevaCarrera({ semilla: s }, contenido);
    for (let m = 0; m < 14; m++) {
      const p = planMes(c, contenido);
      assert.ok(p.primerDia >= 0 && p.primerDia <= 6);
      assert.ok(p.eventos.every((e) => e.dia >= 1 && e.dia <= p.dias));
      const dias = p.eventos.filter((e) => e.situacion && c.abiertas.find((a) => a.id === e.situacion)?.desde === c.mes).map((e) => e.dia);
      assert.equal(new Set(dias).size, dias.length, "una situación nueva por día");
      assert.equal(p.situaciones.length, c.abiertas.length);
      if (p.mesDelAnio === 12) assert.ok(p.eventos.some((e) => e.titulo === "Aguinaldo"));
      c = cerrarMes(c, contenido).carrera;
      if (c.estado !== "activa") break;
    }
  }
});

ok("200 carreras de 10 años: sin números inválidos ni saldos imposibles", () => {
  let quebradas = 0;
  let lecciones = 0;
  for (let s = 0; s < 200; s++) {
    const { c, resumenes } = jugar(nuevaCarrera({ semilla: s * 7919 }, contenido), 120, contenido, s);
    for (const v of [c.efectivo, c.ahorro, c.deudaTarjeta, patrimonio(c), c.indiceSalud, ...Object.values(c.activos).map((p) => p!.valor)])
      assert.ok(Number.isFinite(v) && Number.isInteger(v), `número inválido en semilla ${s}`);
    assert.ok(c.ahorro >= 0 && c.deudaTarjeta >= 0);
    assert.ok(Object.values(c.activos).every((p) => p!.valor >= 0));
    assert.ok(c.indiceSalud >= 0 && c.indiceSalud <= 100);
    assert.ok(c.abiertas.length <= 3 + 2, "no se acumulan situaciones");
    for (const r of resumenes) assert.ok(Number.isFinite(r.patrimonioDespues));
    if (c.estado === "quebrada") quebradas++;
    lecciones += new Set(c.lecciones).size;
  }
  console.log(`   (jugador al azar: ${quebradas}/200 quebradas, ${(lecciones / 200).toFixed(1)} lecciones por carrera)`);
});

ok("las situaciones con día fijo caen ese día (el sueldo, el día de cobro)", () => {
  let c = nuevaCarrera({ semilla: 4 }, contenido);
  c = { ...c, abiertas: [{ id: "sueldo-ahorro", desde: c.mes }, { id: "imprevisto-celular", desde: c.mes }] };
  const p = planMes(c, contenido);
  assert.equal(p.eventos.find((e) => e.situacion === "sueldo-ahorro")?.dia, 30);
  const feb = { ...c, mes: 2, abiertas: [{ id: "sueldo-ahorro", desde: 2 }] };
  assert.equal(planMes(feb, contenido).eventos.find((e) => e.situacion === "sueldo-ahorro")?.dia, 28, "febrero: último día");
});

ok("personaje: el oficio define el arranque y la meta mide el avance", () => {
  const c = nuevaCarrera({ semilla: 8, perfil: { nombre: "  Sofi  ", avatar: "laptop", oficio: "analista", meta: "emergencia" } }, contenido);
  assert.equal(c.perfil?.nombre, "Sofi");
  assert.equal(c.sueldo, 5_000_000, "analista = holgado");
  assert.equal(nuevaCarrera({ semilla: 8, perfil: { nombre: "Ana", avatar: "persona", oficio: "cajero", meta: "auto" } }, contenido).sueldo, 2_900_000);
  for (const m of Object.values(METAS)) {
    const v = m.avance(c);
    assert.ok(v >= 0 && v <= 1, m.nombre);
    assert.ok(m.detalle(c).length > 0);
  }
  const lleno = { ...c, ahorro: gastoMensual(c) * 3 };
  assert.equal(METAS.emergencia.avance(lleno), 1);
  assert.ok(nombreValido("María José") && nombreValido("Ñandutí 2"));
  assert.ok(!nombreValido("a") && !nombreValido("x".repeat(25)) && !nombreValido("<script>"));
  assert.equal(nuevaCarrera({ semilla: 8 }, contenido).perfil, undefined, "carreras viejas sin perfil siguen andando");
});

console.log(`\n${n} pruebas OK`);
