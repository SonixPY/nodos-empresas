/** CSV y texto pegado para el RO (formatos E y F del kit). */
import type { Celda } from "./xlsx";

/** Texto del archivo: UTF-8 si es válido; si no, Windows-1252 (lo habitual en los CSV de Excel). */
export function decodificarTexto(bytes: Uint8Array): string {
  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) return new TextDecoder("utf-8").decode(bytes.subarray(3));
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder("windows-1252").decode(bytes);
  }
}

function separador(texto: string): string {
  const muestra = texto.split(/\r?\n/).slice(0, 10).join("\n");
  const cuenta = (c: string) => {
    let n = 0;
    let comillas = false;
    for (const ch of muestra) {
      if (ch === '"') comillas = !comillas;
      else if (ch === c && !comillas) n++;
    }
    return n;
  };
  const opciones = ["\t", ";", ","].map((c) => [c, cuenta(c)] as const).sort((a, b) => b[1] - a[1]);
  return opciones[0][1] > 0 ? opciones[0][0] : ";";
}

/** Filas de un CSV (comillas dobles al estilo Excel) o de un texto con tabulaciones. */
export function leerCsv(texto: string, max = 20000): Celda[][] {
  const sep = separador(texto);
  const filas: Celda[][] = [];
  let fila: Celda[] = [];
  let campo = "";
  let comillas = false;
  for (let i = 0; i < texto.length; i++) {
    const ch = texto[i];
    if (comillas) {
      if (ch === '"') {
        if (texto[i + 1] === '"') {
          campo += '"';
          i++;
        } else comillas = false;
      } else campo += ch;
      continue;
    }
    if (ch === '"' && campo === "") comillas = true;
    else if (ch === sep) {
      fila.push(campo);
      campo = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && texto[i + 1] === "\n") i++;
      fila.push(campo);
      filas.push(fila);
      if (filas.length >= max) return filas;
      fila = [];
      campo = "";
    } else campo += ch;
  }
  if (campo !== "" || fila.length > 0) {
    fila.push(campo);
    filas.push(fila);
  }
  return filas.map((f) => f.map((c) => (typeof c === "string" && c.trim() === "" ? null : c)));
}
