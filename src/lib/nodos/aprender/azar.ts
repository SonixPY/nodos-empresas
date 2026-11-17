/**
 * Azar determinístico: la misma semilla da siempre la misma carrera.
 * Cada sorteo se deriva de (semilla, mes, canal), así un cambio en un
 * canal (por ejemplo, agregar una situación) no altera los precios.
 */

function hash(...partes: (number | string)[]): number {
  let h = 2166136261 >>> 0;
  for (const p of partes) {
    const s = String(p);
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619) >>> 0;
    }
    h ^= 0x9e3779b9;
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

/** Generador mulberry32: rápido, chico y suficiente para un juego. */
export function generador(semilla: number, ...canal: (number | string)[]): () => number {
  let a = hash(semilla, ...canal);
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Normal estándar (Box-Muller). */
export function normal(r: () => number): number {
  const u = Math.max(r(), 1e-12);
  const v = r();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/** Elige sin repetir, con pesos. */
export function sortear<T>(r: () => number, items: { item: T; peso: number }[], cuantos: number): T[] {
  const bolsa = items.filter((x) => x.peso > 0).slice();
  const salida: T[] = [];
  while (salida.length < cuantos && bolsa.length) {
    const total = bolsa.reduce((s, x) => s + x.peso, 0);
    let p = r() * total;
    let i = 0;
    for (; i < bolsa.length - 1; i++) {
      p -= bolsa[i].peso;
      if (p <= 0) break;
    }
    salida.push(bolsa[i].item);
    bolsa.splice(i, 1);
  }
  return salida;
}

export function nuevaSemilla(): number {
  return Math.floor(Math.random() * 2 ** 31);
}
