/**
 * Estilos de los documentos generados. Se usan igual en la vista previa
 * (dentro de .doc-preview), en la impresión / PDF y en el .doc para Word,
 * para que lo que se ve sea lo que se descarga.
 */
export const DOC_CSS = `
.doc { font-family: "Source Serif 4", Georgia, "Times New Roman", serif; font-size: 12pt; line-height: 1.55; color: #242522; }
.doc h1 { font-size: 15pt; margin: 0 0 14pt; color: #1e2f25; }
.doc p { margin: 0 0 10pt; text-align: justify; }
.doc .meta { font-family: "IBM Plex Sans", Arial, sans-serif; font-size: 8pt; letter-spacing: .06em; text-transform: uppercase; color: #b8734a; margin-bottom: 4pt; }
.doc .center { text-align: center; }
.doc .right { text-align: right; }
.doc ol, .doc ul { margin: 0 0 10pt 18pt; padding: 0; }
.doc li { margin-bottom: 4pt; }
.doc .ph { background: #fbe9dc; color: #8a4a26; padding: 0 2px; border-radius: 2px; }
.doc .tabla { width: 100%; border-collapse: collapse; margin: 6pt 0 12pt; font-size: 10pt; }
.doc .tabla th, .doc .tabla td { border: 1px solid #999; padding: 4pt 5pt; text-align: left; }
.doc .tabla th { background: #f2eee6; }
.doc .tabla .num { text-align: right; }
.doc .firmas { display: flex; flex-wrap: wrap; gap: 28pt 40pt; margin-top: 36pt; }
.doc .firma { width: 200px; text-align: center; font-size: 11pt; }
.doc .firma .linea { border-top: 1px solid #242522; margin-bottom: 4pt; height: 1px; }
.doc .firma .cargo { font-size: 9.5pt; color: #555; }
.doc .edicto { border: 1px solid #999; padding: 12pt 14pt; margin-bottom: 12pt; }
.doc .nota { margin-top: 18pt; font-family: "IBM Plex Sans", Arial, sans-serif; font-size: 9pt; color: #555; background: #f2eee6; padding: 6pt 8pt; border-left: 3px solid #b8734a; }
.doc .aviso { font-family: "IBM Plex Sans", Arial, sans-serif; font-size: 8.5pt; color: #666; border-top: 1px solid #ccc; padding-top: 8pt; margin-top: 28pt; }
`;

function documentoCompleto(titulo: string, html: string, { paraImprimir }: { paraImprimir: boolean }) {
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${titulo.replace(/</g, "")}</title>
<style>
@page { size: A4; margin: 2.2cm 2cm; }
body { margin: ${paraImprimir ? "0" : "24px"}; }
${DOC_CSS}
${paraImprimir ? "@media print { .doc .nota { display: none; } .doc .ph { background: none; color: inherit; } }" : ""}
</style></head><body><div class="doc">${html}</div></body></html>`;
}

function nombreArchivo(titulo: string, ext: string) {
  const base = titulo
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
  return `${base || "documento"}.${ext}`;
}

/**
 * Descarga como .doc (HTML que Word abre y permite editar). Los marcadores
 * [ASÍ] quedan resaltados para completarlos en Word.
 */
export function descargarWord(titulo: string, html: string) {
  const contenido = documentoCompleto(titulo, html, { paraImprimir: false });
  const blob = new Blob(["﻿", contenido], { type: "application/msword" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nombreArchivo(titulo, "doc");
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Abre el documento en una ventana y lanza el diálogo de impresión (Guardar como PDF). */
export function imprimir(titulo: string, html: string): boolean {
  const w = window.open("", "_blank");
  if (!w) return false;
  w.document.open();
  w.document.write(documentoCompleto(titulo, html, { paraImprimir: true }));
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 350);
  return true;
}
