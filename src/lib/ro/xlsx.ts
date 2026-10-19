/**
 * Lector mínimo de Excel (.xlsx / .xlsm) para el RO, en el navegador.
 * Un .xlsx es un ZIP con XML: se descomprime con fflate y se leen solo el
 * libro, las hojas y los textos compartidos. Devuelve valores crudos (texto
 * o número); las fórmulas aportan su último valor calculado.
 */
import { unzipSync, strFromU8 } from "fflate";

export type Celda = string | number | null;

export interface Hoja {
  nombre: string;
  visible: boolean;
  filas: Celda[][];
}

const MAX_DESCOMPRIMIDO = 60 * 1024 * 1024; // freno ante archivos ZIP "bomba"
const MAX_FILAS = 20000;
const MAX_COLUMNAS = 200;

function entidades(s: string): string {
  return s
    .replace(/_x([0-9A-Fa-f]{4})_/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

function atributos(tag: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of tag.matchAll(/([\w:]+)\s*=\s*"([^"]*)"/g)) out[m[1]] = entidades(m[2]);
  return out;
}

/** Texto de un <si> o <is>: concatena los <t>, sin la guía fonética (<rPh>). */
function textoRico(xml: string): string {
  const sinFonetica = xml.replace(/<rPh\b[\s\S]*?<\/rPh>/g, "");
  let s = "";
  for (const m of sinFonetica.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)) s += entidades(m[1]);
  return s;
}

function columna(ref: string): number {
  const letras = ref.match(/^[A-Z]+/)?.[0] ?? "A";
  let n = 0;
  for (const ch of letras) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

function leerHoja(xml: string, compartidos: string[]): Celda[][] {
  const filas: Celda[][] = [];
  let siguiente = 0;
  // Primero la fila vacía (<row …/>): si no, la otra alternativa se tragaría las siguientes.
  for (const fila of xml.matchAll(/<row\b([^>]*?)\/>|<row\b([^>]*)>([\s\S]*?)<\/row>/g)) {
    const attrs = atributos(fila[1] ?? fila[2] ?? "");
    const idx = attrs.r ? Number(attrs.r) - 1 : siguiente;
    siguiente = idx + 1;
    if (idx >= MAX_FILAS) break;
    const valores: Celda[] = [];
    let col = 0;
    for (const c of (fila[3] ?? "").matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const a = atributos(c[1]);
      const j = a.r ? columna(a.r) : col;
      col = j + 1;
      if (j >= MAX_COLUMNAS) continue;
      const cuerpo = c[2] ?? "";
      const v = cuerpo.match(/<v>([\s\S]*?)<\/v>/)?.[1];
      let valor: Celda = null;
      switch (a.t) {
        case "s":
          valor = v !== undefined ? (compartidos[Number(v)] ?? "") : null;
          break;
        case "inlineStr":
          valor = textoRico(cuerpo.match(/<is>([\s\S]*?)<\/is>/)?.[1] ?? "");
          break;
        case "str":
        case "e":
        case "d":
          valor = v !== undefined ? entidades(v) : null;
          break;
        case "b":
          valor = v === "1" ? "VERDADERO" : "FALSO";
          break;
        default:
          valor = v !== undefined && v !== "" ? Number(v) : null;
          if (typeof valor === "number" && !Number.isFinite(valor)) valor = entidades(v ?? "");
      }
      valores[j] = valor;
    }
    for (let k = 0; k < valores.length; k++) if (valores[k] === undefined) valores[k] = null;
    filas[idx] = valores;
  }
  for (let k = 0; k < filas.length; k++) if (!filas[k]) filas[k] = [];
  return filas;
}

export class ExcelNoSoportado extends Error {}

export function leerXlsx(datos: Uint8Array): Hoja[] {
  // .xls (formato binario viejo) empieza con D0 CF 11 E0.
  if (datos[0] === 0xd0 && datos[1] === 0xcf) throw new ExcelNoSoportado("Es un .xls del formato viejo: abrilo en Excel y guardalo como .xlsx.");
  if (datos[0] !== 0x50 || datos[1] !== 0x4b) throw new ExcelNoSoportado("El archivo no es un Excel .xlsx válido.");
  let total = 0;
  const archivos = unzipSync(datos, {
    filter: (f) => {
      const util = f.name === "xl/workbook.xml" || f.name === "xl/_rels/workbook.xml.rels" || f.name === "xl/sharedStrings.xml" || /^xl\/worksheets\/[^/]+\.xml$/.test(f.name);
      if (!util) return false;
      total += f.originalSize;
      if (total > MAX_DESCOMPRIMIDO) throw new ExcelNoSoportado("El Excel es demasiado grande para procesarlo en el navegador.");
      return true;
    },
  });
  const texto = (n: string) => (archivos[n] ? strFromU8(archivos[n]) : "");
  const libro = texto("xl/workbook.xml");
  if (!libro) throw new ExcelNoSoportado("No se encontró el libro dentro del archivo.");
  const rels = new Map<string, string>();
  for (const m of texto("xl/_rels/workbook.xml.rels").matchAll(/<Relationship\b([^>]*)\/?>/g)) {
    const a = atributos(m[1]);
    if (a.Id && a.Target) rels.set(a.Id, a.Target.replace(/^\/?xl\//, "").replace(/^\//, ""));
  }
  const compartidos: string[] = [];
  for (const m of texto("xl/sharedStrings.xml").matchAll(/<si>([\s\S]*?)<\/si>/g)) compartidos.push(textoRico(m[1]));

  const hojas: Hoja[] = [];
  for (const m of libro.matchAll(/<sheet\b([^>]*)\/?>/g)) {
    const a = atributos(m[1]);
    const destino = rels.get(a["r:id"] ?? "") ?? "";
    const ruta = destino ? `xl/${destino}` : "";
    const xml = ruta ? texto(ruta) : "";
    hojas.push({ nombre: a.name ?? "Hoja", visible: !a.state || a.state === "visible", filas: xml ? leerHoja(xml, compartidos) : [] });
  }
  return hojas;
}
