/**
 * Pruebas del generador del RO (ESPECIFICACION §10). Uso:
 *   npx tsx scripts/probar-ro.ts [esperado.json]
 * esperado.json: salida de la referencia en Python del kit para los mismos
 * datos (opcional). Sin él, corren solo las pruebas propias.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dvRuc, normalizarTelefono, Normalizador, parsearFecha, parsearMonto, rangoTrimestre, type FilaCruda } from "../src/lib/ro/normalizador";
import { armarArchivos, codificarBase64, decodificarBase64, generarJson } from "../src/lib/ro/salida";
import { extraer, separarCompuesto } from "../src/lib/ro/extraer";
import { leerCsv, decodificarTexto } from "../src/lib/ro/csv";
import { leerXlsx } from "../src/lib/ro/xlsx";

let n = 0;
const ok = (nombre: string, fn: () => void) => {
  fn();
  n++;
  console.log(`ok ${n} - ${nombre}`);
};

// 1. Autotest de la referencia
ok("dígito verificador de RUC", () => {
  assert.equal(dvRuc("3752045"), 8);
  assert.equal(dvRuc("80034461"), 8);
  assert.equal(dvRuc("80026184"), 4);
});
ok("teléfonos", () => {
  assert.equal(normalizarTelefono("(0982)750496"), "0982750496");
  assert.equal(normalizarTelefono("+595 983 841045"), "0983841045");
  assert.equal(normalizarTelefono(981231921), "0981231921");
  assert.equal(normalizarTelefono("000000000"), "99999999");
  assert.equal(normalizarTelefono(""), "99999999");
  assert.equal(normalizarTelefono("21415559"), "021415559");
  assert.equal(normalizarTelefono("34692344256"), "34692344256");
  assert.equal(normalizarTelefono("0981 111 222 / 0982 333 444"), "0981111222");
  assert.equal(normalizarTelefono("", "999999999"), "999999999");
});
ok("montos", () => {
  assert.equal(parsearMonto("1.500.000 ₲s"), 1500000);
  assert.equal(parsearMonto("3958,96"), 3958.96);
  assert.equal(parsearMonto("3.958,96"), 3958.96);
  assert.equal(parsearMonto("-"), null);
  assert.equal(parsearMonto("30 CUOTAS"), 30);
  assert.equal(parsearMonto("#VALUE!"), null);
});
ok("fechas", () => {
  assert.equal(parsearFecha("1/7/2026"), "2026-07-01");
  assert.equal(parsearFecha("15-08-2026"), "2026-08-15");
  assert.equal(parsearFecha("2026-08-15"), "2026-08-15");
  assert.equal(parsearFecha(45900), "2025-08-31");
  assert.equal(parsearFecha("31/02/2026"), null);
  assert.deepEqual(rangoTrimestre("2026-T3"), { desde: "2026-07-01", hasta: "2026-09-30" });
  assert.deepEqual(rangoTrimestre("2024-T1"), { desde: "2024-01-01", hasta: "2024-03-31" });
});

// 2. Igual a la referencia en Python, byte a byte
const archivo = process.argv[2];
if (archivo) {
  const esp = JSON.parse(readFileSync(archivo, "utf8"));
  ok("inmobiliarias: mismos registros, JSON y Base64 que la referencia", () => {
    const r = new Normalizador("inmobiliarias", { periodo: { desde: "2026-07-01", hasta: "2026-09-30" } }).procesar(esp.entrada.inmo);
    assert.deepEqual(r.registros, esp.salida.inmo.registros);
    assert.equal(generarJson(r.registros), esp.salida.inmo.json);
    assert.equal(codificarBase64(generarJson(r.registros)), esp.salida.inmo.b64);
  });
  ok("caudales: mismos registros que la referencia", () => {
    const r = new Normalizador("caudales").procesar(esp.entrada.caud);
    assert.deepEqual(r.registros, esp.salida.caud.registros);
    assert.equal(codificarBase64(generarJson(r.registros)), esp.salida.caud.b64);
  });
}

// 3. Casos mínimos de la especificación (§10)
const base: FilaCruda = {
  fechaOperacion: "10/08/2026", tipoInmueble: "URBANO", clasificacion: "LOTE O TERRENO", ctaCteCatastral: "1", modalidadOperacion: "CONTADO",
  formaPago: "EFECTIVO", tipoOperacion: "VENTA", montoEntrega: "100.000.000", compradorTipoPersona: "FISICA", compradorTipoDocumento: "CI",
  compradorNumeroDocumento: "1.234.567", compradorDenominacion: "Ana Ejemplo", compradorNacionalidadCodigo: "PRY", compradorResidenciaCodigo: "PRY",
  compradorCiudadCodigo: "LUQUE", ciudadCodigo: 119652, monedaOperacionCodigo: "PYG",
};
ok("ciudades: nombre, exterior e inexistente", () => {
  const r = new Normalizador("inmobiliarias").procesar([base, { ...base, compradorCiudadCodigo: "NO EXISTE", ciudadCodigo: "" }, { ...base, compradorCiudadCodigo: "BELLA VISTA" }]);
  assert.equal(r.registros[0].compradorCiudadCodigo, 180);
  assert.equal(r.registros[0].ciudadCodigo, 119652);
  assert.equal(r.registros[1].compradorCiudadCodigo, 1);
  assert.equal(r.registros[1].ciudadCodigo, 1);
  assert.equal(r.registros[2].compradorCiudadCodigo, 96);
  assert.ok(r.observaciones.some((o) => o.item === 3 && o.tipo === "VERIFICAR" && o.campo === "compradorCiudadCodigo"));
});
ok("contado con montos vacíos: financiado, cuotas y compensación en 0", () => {
  const r = new Normalizador("inmobiliarias").procesar([{ ...base, montoFinanciado: "", cantidadCuotas: null, montoCompensacion: "-" }]);
  assert.equal(r.registros[0].montoFinanciado, 0);
  assert.equal(r.registros[0].cantidadCuotas, 0);
  assert.equal(r.registros[0].montoCompensacion, 0);
});
ok("actividades: SERVICIOS PERSONALES y ABOGADA", () => {
  const r = new Normalizador("inmobiliarias").procesar([{ ...base, compradorActividad: "SERVICIOS PERSONALES" }, { ...base, compradorActividad: "Abogada" }]);
  assert.equal(r.registros[0].compradorActividad, "PRESTACIÓN DE SERVICIOS A LA COMUNIDAD EN GENERAL");
  assert.equal(r.registros[1].compradorActividad, "ACTIVIDADES JURÍDICAS");
});
ok("RUC: sin dígito, dígito equivocado con sugerencia, CI con puntos y dos documentos", () => {
  const r = new Normalizador("inmobiliarias").procesar([
    { ...base, compradorTipoDocumento: "RUC", compradorNumeroDocumento: "3752045", compradorDenominacion: "Nimio Perez" },
    { ...base, compradorTipoDocumento: "RUC", compradorNumeroDocumento: "3752045-1", compradorDenominacion: "Nimio Perez" },
    { ...base, compradorNumeroDocumento: "4846003 / 5266898" },
  ]);
  assert.equal(r.registros[0].compradorNumeroDocumento, "3752045-8");
  assert.ok(r.observaciones.some((o) => o.item === 2 && o.mensaje.includes("3752045-8") && o.mensaje.includes("En otra fila")));
  assert.equal(r.registros[2].compradorNumeroDocumento, "4846003");
  assert.ok(r.observaciones.some((o) => o.item === 3 && o.tipo === "VERIFICAR" && o.mensaje.includes("más de un documento")));
});
ok("columnas duplicadas: se usa el par que cuadra con el total", () => {
  const r = new Normalizador("inmobiliarias").procesar([
    { ...base, modalidadOperacion: "CRÉDITO", montoEntrega: "1.500.000", montoFinanciado: ["195.000.000", "193.500.000"], cantidadCuotas: [130, 129], _montoTotal: "195.000.000" },
  ]);
  assert.equal(r.registros[0].montoFinanciado, 193500000);
  assert.equal(r.registros[0].cantidadCuotas, 129);
});
ok("caudales en USD sin tasa: toma la del mismo día", () => {
  const c = { fechaOperacion: "01/07/2026", codigoTipoDocumento: "RUC", numeroDocumento: "80034461-8", denominacion: "X SA", codigoPaisNacionalidad: "PRY", codigoMoneda: "USD", codigoCiudadOrigen: 1, codigoCiudadDestino: 1 };
  const r = new Normalizador("caudales").procesar([
    { ...c, monto: "700", montoGuaranies: "5.250.000" },
    { ...c, monto: "100", montoGuaranies: "" },
    { ...c, fechaOperacion: "02/07/2026", monto: "100", montoGuaranies: "" },
  ]);
  assert.equal(r.registros[1].montoGuaranies, 750000);
  assert.ok(r.observaciones.some((o) => o.item === 2 && o.tipo === "AJUSTE" && o.campo === "montoGuaranies"));
  assert.ok(r.observaciones.some((o) => o.item === 3 && o.tipo === "COMPLETAR" && o.campo === "montoGuaranies"));
});
ok("reglas de la empresa: ciudad fija y teléfono por defecto", () => {
  const r = new Normalizador("inmobiliarias", { reglas: { ciudadFija: 1, telefonoPorDefecto: "999999999" } }).procesar([base]);
  assert.equal(r.registros[0].compradorCiudadCodigo, 1);
  assert.equal(r.registros[0].ciudadCodigo, 1);
  assert.equal(r.registros[0].compradorNumeroTelefono, "999999999");
});
ok("sin null en ningún campo y Base64 de ida y vuelta", () => {
  const r = new Normalizador("inmobiliarias").procesar([base, { ...base, tipoOperacion: "COMPRA", vendedorDenominacion: "Juan" }]);
  for (const reg of r.registros) for (const v of Object.values(reg)) assert.notEqual(v, null);
  const a = armarArchivos(r.registros);
  assert.equal(decodificarBase64(a.base64).cantidadRegistros, 2);
  assert.ok(a.base64.endsWith("\r\n"));
  assert.ok(a.base64.split("\n").slice(0, -1).every((l) => l.replace("\r", "").length <= 76));
  assert.ok(a.json.includes("\r\n"));
});

// 4. Extracción de los formatos
ok("formato F: documento y nombre juntos", () => {
  assert.deepEqual(separarCompuesto("RUC 3752045-8 - PEREZ MACIEL, NIMIO DAVID"), { tipo: "RUC", numero: "3752045-8", nombre: "PEREZ MACIEL, NIMIO DAVID" });
});
ok("formato A: encabezados oficiales (con espacios y mayúsculas)", () => {
  const hoja = [
    ["Fecha Operacion", "Tipo Inmueble", "Clasificacion", "Tipo Operacion", "Monto Entrega", "Compradorciudad Codigo", "Comprador Numero Documento", "Comprador Denominacion"],
    ["10/08/2026", "urbano", "lote o terreno", "venta", "1.000.000", "Luque", "1234567", "Ana"],
    [null, null, null, null, "1.000.000", null, null, null],
  ];
  const e = extraer(hoja, "inmobiliarias")!;
  assert.equal(e.formato, "tabla");
  assert.equal(e.filas.length, 1);
  assert.equal(e.filas[0].compradorCiudadCodigo, "Luque");
  assert.ok(e.avisos.some((a) => a.includes("omitieron")));
});
ok("formato D: encabezados en la fila 4, ciudad por nombre, columnas duplicadas", () => {
  const hoja = [["INFORME"], [], ["Período 2026"], ["fechaOperacion", "tipoOperacion", "montoEntrega", "cantidadCuotas", "montoFinanciado", "cantidadCuotas", "montoFinanciado", "compradorCiudad_nombre", "compradorDenominacion", "Monto total Gs."], ["10/08/2026", "VENTA", "1500000", 130, "195000000", 129, "193500000", "LUQUE", "Ana", "195000000"]];
  const e = extraer(hoja, "inmobiliarias")!;
  assert.equal(e.filaEncabezado, 3);
  assert.deepEqual(e.filas[0].montoFinanciado, ["195000000", "193500000"]);
  assert.equal(e.filas[0].compradorCiudadCodigo, "LUQUE");
  assert.equal(e.filas[0]._montoTotal, "195000000");
});
ok("formato B: bloques verticales", () => {
  const hoja = [
    ["OPERACIÓN NUMERO 1"], ["Tipo inmueble", "Urbano"], ["Fecha de operación", "10/08/2026"], ["Tipo de operación", "VENTA"], ["Monto de entrega en Gs.", "5.000.000"],
    ["Datos del Comprador"], ["Tipo de persona", "Física"], ["Numero de documento ", "1234567", "ANA EJEMPLO"], ["Ciudad", "Luque"],
    ["OPERACIÓN NUMERO 2"], ["Tipo inmueble", "Rural"], ["Fecha de operación", 45900], ["Tipo de operación", "COMPRA"],
    ["Datos del Vendedor"], ["Numero de documento", "7654321"], ["Ciudad", "Asuncion"],
  ];
  const e = extraer(hoja, "inmobiliarias")!;
  assert.equal(e.formato, "bloques");
  assert.equal(e.filas.length, 2);
  assert.equal(e.filas[0].compradorDenominacion, "ANA EJEMPLO");
  assert.equal(e.filas[0].compradorCiudadCodigo, "Luque");
  assert.equal(e.filas[1].vendedorNumeroDocumento, "7654321");
  assert.equal(e.filas[1].tipoInmueble, "Rural");
});
ok("formato C: una operación por columna con fila ORDEN", () => {
  const hoja = [
    ["ORDEN", 1, 2], [null, "ANA", "LUIS"], ["Tipo inmueble", "Urbano", "Urbano"], ["Fecha de operación", "10/08/2026", "11/08/2026"], ["Tipo de operación", "VENTA", "VENTA"],
    ["Monto de entrega en Gs.", "1", "2"], ["Datos del Comprador"], ["Tipo de documento", "CI", "CI"], ["Numero de documento", "111", "222"],
  ];
  const e = extraer(hoja, "inmobiliarias")!;
  assert.equal(e.formato, "columnas");
  assert.equal(e.filas.length, 2);
  assert.equal(e.filas[1].compradorDenominacion, "LUIS");
  assert.equal(e.filas[0].compradorNumeroDocumento, "111");
});
ok("formato E: CSV de caudales en Windows-1252 con dos denominaciones", () => {
  const texto = "fechaOperacion;codigoTipoDocumento;numeroDocumento;denominacion;denominacion;monto;TIPO MONEDA\r\n01/07/2026;RUC;80034461-8;EMP;EMPRESA EJEMPLO S.A.;1.000.000;PYG\r\n";
  const bytes = Uint8Array.from(Array.from(texto, (c) => c.charCodeAt(0)));
  const filas = leerCsv(decodificarTexto(bytes));
  const e = extraer(filas, "caudales")!;
  assert.deepEqual(e.filas[0].denominacion, ["EMP", "EMPRESA EJEMPLO S.A."]);
  const r = new Normalizador("caudales").procesar(e.filas);
  assert.equal(r.registros[0].denominacion, "EMPRESA EJEMPLO S.A.");
  assert.equal(r.registros[0].codigoMoneda, "PYG");
  assert.equal(r.registros[0].montoGuaranies, 1000000);
});
ok("Windows-1252: tildes y ñ se decodifican", () => {
  const bytes = Uint8Array.from([0x41, 0xf1, 0x6f, 0x3b, 0xc9]); // "Año;É"
  assert.equal(decodificarTexto(bytes), "Año;É");
});

const xlsx = process.argv[3];
if (xlsx) {
  ok("Excel: solo hojas visibles, textos compartidos y números", () => {
    const hojas = leerXlsx(new Uint8Array(readFileSync(xlsx)));
    assert.deepEqual(hojas.map((h) => [h.nombre, h.visible]), [["T3 2026", true], ["Viejo", false]]);
    const e = extraer(hojas[0].filas, "inmobiliarias")!;
    assert.equal(e.filas.length, 2);
    assert.equal(e.filas[0].compradorDenominacion, "José Ñandú & Cía");
    assert.equal(typeof e.filas[0].fechaOperacion, "number");
    assert.equal(e.filas[1].montoEntrega, 2500000);
  });
}

console.log(`\n${n} pruebas OK`);
