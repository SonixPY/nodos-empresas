// Pruebas de src/lib/series.ts: npx tsx scripts/probar-series.ts
import assert from "node:assert/strict";
import { limpiarSerie, paraSitio, publicados, SERIE_NUEVA, urlValida, validarSerie } from "../src/lib/series";

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

console.log(`${n} pruebas OK`);
