// Pruebas de src/lib/series.ts: npx tsx scripts/probar-series.ts
import assert from "node:assert/strict";
import { fechaValida, limpiarSerie, paraSitio, proximoEstreno, publicados, SERIE_NUEVA, urlValida, validarSerie } from "../src/lib/series";

let n = 0;
function prueba(nombre: string, fn: () => void) {
  fn();
  n++;
  console.log(`  ok  ${nombre}`);
}

prueba("links: solo https", () => {
  assert.equal(urlValida(""), true);
  assert.equal(urlValida("https://youtu.be/abc"), true);
  assert.equal(urlValida("http://youtu.be/abc"), false);
  assert.equal(urlValida("javascript:alert(1)"), false);
  assert.equal(urlValida("no es un link"), false);
});

prueba("serie nueva: pide título y valida links de episodios", () => {
  const s = structuredClone(SERIE_NUEVA);
  assert.ok(validarSerie(s).some((e) => e.includes("título")));
  s.titulo = "Opciones de ahorro en Paraguay";
  assert.deepEqual(validarSerie(s), []);
  s.episodios[2].url = "http://inseguro";
  assert.ok(validarSerie(s).some((e) => e.startsWith("Episodio 3")));
});

prueba("número repetido y publicar sin episodios", () => {
  const s = { ...structuredClone(SERIE_NUEVA), titulo: "Serie", episodios: [], estado: "publicado" as const };
  const e = validarSerie(s, [1]);
  assert.ok(e.some((x) => x.includes("número 1")));
  assert.ok(e.some((x) => x.includes("al menos un episodio")));
});

prueba("limpiar: recorta, descarta basura y cuenta publicados", () => {
  const s = limpiarSerie({ numero: "2", titulo: "  Serie  ", episodios: [{ titulo: "Uno", url: "https://youtu.be/1" }, null, { titulo: 5 }], estado: "otro" } as never);
  assert.equal(s.numero, 2);
  assert.equal(s.titulo, "Serie");
  assert.equal(s.estado, "borrador");
  assert.equal(s.episodios.length, 3);
  assert.equal(publicados(s), 1);
});

prueba("sitio: solo publicadas, en orden y sin links inseguros", () => {
  const filas = [
    { numero: 2, titulo: "B", estado: "publicado", episodios: [{ titulo: "x", url: "http://malo" }], url: "", id: "secreto" },
    { numero: 1, titulo: "A", estado: "publicado", episodios: [], url: "https://youtube.com/@NodosCompliance" },
    { numero: 3, titulo: "Oculta", estado: "borrador", episodios: [] },
  ];
  const r = paraSitio(filas);
  assert.deepEqual(r.map((x) => x.titulo), ["A", "B"]);
  assert.equal(r[0].numero, "01");
  assert.equal(r[1].episodios[0].url, "");
  assert.ok(!("id" in r[1]));
});

prueba("fase 1: fecha, minutos y fuentes", () => {
  assert.equal(fechaValida("2026-11-23T19:00:00-03:00"), true);
  assert.equal(fechaValida("lunes"), false);
  const s = limpiarSerie({
    numero: 1,
    titulo: "Serie",
    estado: "publicado",
    episodios: [
      { titulo: "Uno", url: "", fecha: "2026-11-23T19:00:00-03:00", minutos: "11", fuentes: [{ titulo: "BCP", url: "https://www.bcp.gov.py" }, { titulo: "x", url: "javascript:1" }] },
      { titulo: "Dos", url: "", fecha: "no", minutos: 999 },
    ],
  } as never);
  assert.equal(s.episodios[0].minutos, 11);
  assert.equal(s.episodios[1].fecha, "");
  assert.equal(s.episodios[1].minutos, 0);
  assert.ok(validarSerie(s).some((e) => e.includes("fuente 2")));
  const sitio = paraSitio([{ ...s }]);
  assert.equal(sitio[0].episodios[0].fuentes.length, 1);
});

prueba("próximo estreno: el más cercano sin publicar", () => {
  const ahora = Date.parse("2026-11-20T12:00:00-03:00");
  const eps = [
    { titulo: "", url: "https://youtu.be/a", fecha: "2026-11-16T19:00:00-03:00" },
    { titulo: "", url: "", fecha: "2026-11-30T19:00:00-03:00" },
    { titulo: "", url: "", fecha: "2026-11-23T19:00:00-03:00" },
  ];
  assert.deepEqual(proximoEstreno(eps, ahora), { indice: 2, fecha: "2026-11-23T19:00:00-03:00" });
  assert.equal(proximoEstreno([{ titulo: "", url: "" }], ahora), null);
});

console.log(`${n} pruebas OK`);
