/** Montos en guaraníes: "Gs. 150.000.000". */
export function formatPyg(n: number): string {
  return `Gs. ${Math.round(n).toLocaleString("es-PY")}`;
}
