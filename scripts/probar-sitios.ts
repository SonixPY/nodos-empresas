// Pruebas de los destinos seguros (?next=) de src/lib/nodos/sitios.ts.
// npx tsx scripts/probar-sitios.ts
import assert from "node:assert/strict";
import { esUrlNodos, rutaInterna } from "../src/lib/nodos/sitios";

let ok = 0;
function prueba(nombre: string, fn: () => void) {
  fn();
  ok++;
  console.log(`ok ${ok} - ${nombre}`);
}

prueba("rutas internas válidas se conservan", () => {
  assert.equal(rutaInterna("/"), "/");
  assert.equal(rutaInterna("/cuenta#plan"), "/cuenta#plan");
  assert.equal(rutaInterna("/vencimientos?empresa=1&x=2"), "/vencimientos?empresa=1&x=2");
  assert.equal(rutaInterna("/nueva-clave"), "/nueva-clave");
});

prueba("redirecciones abiertas se rechazan (antes pasaban /\\evil.com y /\\t/evil.com)", () => {
  for (const malo of [
    "//evil.com",
    "/\\evil.com",
    "/\\/evil.com",
    "/\t/evil.com",
    "/\n/evil.com",
    "\\\\evil.com",
    "https://evil.com",
    "javascript:alert(1)",
    "evil.com",
    "",
    null,
    undefined,
  ]) {
    assert.equal(rutaInterna(malo), null, JSON.stringify(malo));
  }
});

prueba("%5C codificado queda como ruta interna, no como host", () => {
  assert.equal(rutaInterna("/%5Cevil.com"), "/%5Cevil.com");
});

prueba("esUrlNodos solo acepta https de nodoscompliance.com", () => {
  assert.ok(esUrlNodos("https://nodoscompliance.com/"));
  assert.ok(esUrlNodos("https://finanzas.nodoscompliance.com/x"));
  assert.ok(!esUrlNodos("http://nodoscompliance.com/"));
  assert.ok(!esUrlNodos("https://nodoscompliance.com.evil.com/"));
  assert.ok(!esUrlNodos("https://evilnodoscompliance.com/"));
  assert.ok(!esUrlNodos("/\\evil.com"));
});

console.log(`\n${ok} pruebas OK`);
