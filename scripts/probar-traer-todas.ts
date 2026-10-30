// Pruebas de src/lib/traerTodas.ts: npx tsx scripts/probar-traer-todas.ts
import assert from "node:assert/strict";
import { traerTodas } from "../src/lib/traerTodas";

let ok = 0;
async function prueba(nombre: string, fn: () => Promise<void>) {
  await fn();
  ok++;
  console.log(`ok ${ok} - ${nombre}`);
}

/** Simula la API de Supabase: corta en `max` filas como "Max rows". */
function tabla(n: number, max = 1000) {
  const filas = Array.from({ length: n }, (_, i) => ({ id: i }));
  const pedidos: [number, number][] = [];
  const pagina = async (desde: number, hasta: number) => {
    pedidos.push([desde, hasta]);
    const fin = Math.min(hasta + 1, desde + max);
    return { data: filas.slice(desde, fin), error: null };
  };
  return { pagina, pedidos };
}

(async () => {
  await prueba("trae 2.500 filas en 3 pedidos (antes quedaba en 1.000)", async () => {
    const t = tabla(2500);
    const r = await traerTodas(t.pagina);
    assert.equal(r.error, null);
    assert.equal(r.data.length, 2500);
    assert.equal(new Set(r.data.map((f) => f.id)).size, 2500);
    assert.deepEqual(t.pedidos, [[0, 999], [1000, 1999], [2000, 2999]]);
  });

  await prueba("exactamente 1.000 filas: pide una página más y corta", async () => {
    const t = tabla(1000);
    const r = await traerTodas(t.pagina);
    assert.equal(r.data.length, 1000);
    assert.equal(t.pedidos.length, 2);
  });

  await prueba("tabla vacía y data null", async () => {
    assert.deepEqual((await traerTodas(tabla(0).pagina)).data, []);
    const r = await traerTodas(async () => ({ data: null, error: null }));
    assert.deepEqual(r, { data: [], error: null });
  });

  await prueba("un error corta y devuelve el error con lo ya leído", async () => {
    let vez = 0;
    const r = await traerTodas(async (desde: number) => {
      vez++;
      if (vez === 2) return { data: null, error: { message: "fallo", code: "500" } };
      return { data: Array.from({ length: 1000 }, (_, i) => ({ id: desde + i })), error: null };
    });
    assert.equal(r.error?.message, "fallo");
    assert.equal(r.data.length, 1000);
  });

  await prueba("tamaño de página propio", async () => {
    const t = tabla(25, 10);
    const r = await traerTodas(t.pagina, 10);
    assert.equal(r.data.length, 25);
    assert.equal(t.pedidos.length, 3);
  });

  console.log(`\n${ok} pruebas OK`);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
