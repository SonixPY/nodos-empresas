/**
 * Archivo final del RO, idéntico a la macro oficial de Excel:
 *   1. JSON {cantidadRegistros, data: {listaRegistros}} con saltos CRLF.
 *   2. Texto a bytes en Windows-1252 (no UTF-8).
 *   3. Base64 en líneas de 76 caracteres separadas por \n, con \r\n final.
 * output_base64.json es lo que se sube a la plataforma de la SEPRELAD.
 */
import type { Registro } from "./normalizador";

// Bytes 0x80–0x9F de Windows-1252 (el resto coincide con Latin-1). 0 = sin definir.
const C1 = [
  0x20ac, 0, 0x201a, 0x0192, 0x201e, 0x2026, 0x2020, 0x2021, 0x02c6, 0x2030, 0x0160, 0x2039, 0x0152, 0, 0x017d, 0,
  0, 0x2018, 0x2019, 0x201c, 0x201d, 0x2022, 0x2013, 0x2014, 0x02dc, 0x2122, 0x0161, 0x203a, 0x0153, 0, 0x017e, 0x0178,
];
const DESDE_UNICODE = new Map<number, number>();
C1.forEach((u, i) => u && DESDE_UNICODE.set(u, 0x80 + i));

function byteCp1252(cp: number): number | null {
  if (cp < 0x80) return cp;
  if (cp >= 0xa0 && cp <= 0xff) return cp;
  return DESDE_UNICODE.get(cp) ?? null;
}

/** ¿Se puede escribir este texto en Windows-1252? */
export function esCp1252(s: string): boolean {
  for (const ch of s) if (byteCp1252(ch.codePointAt(0)!) === null) return false;
  return true;
}

/** Adapta un texto a Windows-1252: quita tildes que no existen en la tabla y descarta lo que no se puede escribir. */
export function aTextoCp1252(s: string): string {
  let out = "";
  for (const ch of s) {
    if (byteCp1252(ch.codePointAt(0)!) !== null) {
      out += ch;
      continue;
    }
    const base = ch.normalize("NFKD").replace(/[̀-ͯ]/g, "");
    out += esCp1252(base) ? base : "";
  }
  return out;
}

export function codificarCp1252(s: string): Uint8Array {
  const bytes: number[] = [];
  for (const ch of s) {
    const b = byteCp1252(ch.codePointAt(0)!);
    if (b === null) throw new Error(`Carácter no admitido en Windows-1252: "${ch}"`);
    bytes.push(b);
  }
  return Uint8Array.from(bytes);
}

export function decodificarCp1252(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b >= 0x80 && b <= 0x9f ? C1[b - 0x80] || b : b);
  return s;
}

/** Estructura oficial, con saltos CRLF (indentación de 2, como la referencia). */
export function generarJson(registros: Registro[]): string {
  return JSON.stringify({ cantidadRegistros: registros.length, data: { listaRegistros: registros } }, null, 2).replace(/\n/g, "\r\n");
}

function aBase64(bytes: Uint8Array): string {
  let bin = "";
  const PASO = 0x8000;
  for (let i = 0; i < bytes.length; i += PASO) bin += String.fromCharCode(...bytes.subarray(i, i + PASO));
  return btoa(bin);
}

export function codificarBase64(jsonTexto: string): string {
  const b = aBase64(codificarCp1252(jsonTexto));
  const lineas: string[] = [];
  for (let i = 0; i < b.length; i += 76) lineas.push(b.slice(i, i + 76));
  return lineas.join("\n") + "\r\n";
}

/** Para verificar el archivo antes de entregarlo (ida y vuelta). */
export function decodificarBase64(texto: string): { cantidadRegistros: number; data: { listaRegistros: Registro[] } } {
  const bin = atob(texto.replace(/\s+/g, ""));
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return JSON.parse(decodificarCp1252(bytes));
}

export async function sha256Hex(texto: string): Promise<string> {
  const datos = new TextEncoder().encode(texto);
  const hash = await crypto.subtle.digest("SHA-256", datos);
  return Array.from(new Uint8Array(hash), (b) => b.toString(16).padStart(2, "0")).join("");
}

export interface ArchivoRo {
  json: string;
  base64: string;
  /** Bytes del output.json tal como se descarga (Windows-1252). */
  jsonBytes: Uint8Array;
}

/** Arma los dos archivos y verifica que el Base64 se decodifique igual. */
export function armarArchivos(registros: Registro[]): ArchivoRo {
  const json = generarJson(registros);
  const base64 = codificarBase64(json);
  const vuelta = decodificarBase64(base64);
  if (vuelta.cantidadRegistros !== registros.length || vuelta.data.listaRegistros.length !== registros.length) {
    throw new Error("La verificación del archivo falló: la cantidad de registros no coincide.");
  }
  if (JSON.stringify(vuelta.data.listaRegistros) !== JSON.stringify(registros)) {
    throw new Error("La verificación del archivo falló: el contenido decodificado no coincide.");
  }
  return { json, base64, jsonBytes: codificarCp1252(json) };
}
