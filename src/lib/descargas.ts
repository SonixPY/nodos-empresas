import { formatFecha, todayIso } from "@/lib/dates";

/**
 * Estilos de los documentos generados. Se usan igual en la vista previa
 * (dentro de .doc-preview) y en la impresión / PDF, para que lo que se ve
 * sea lo que se imprime.
 *
 * No hay descarga editable (Word): las plantillas son el know-how del
 * servicio y quedan dentro de la suscripción. Lo que sigue (marca de agua al
 * imprimir, bloqueo de selección y copia) es DISUASIÓN, no DRM: quien
 * quiera puede transcribir el texto, sacar una captura o leer el HTML. El
 * objetivo es que reutilizar los modelos fuera de la app no sea cómodo y que
 * cada copia impresa diga de dónde salió.
 */
export const DOC_CSS = `
.doc { font-family: "Inter", Arial, sans-serif; font-size: 12pt; line-height: 1.55; color: #242522; }
.doc h1 { font-size: 15pt; margin: 0 0 14pt; color: #1e2f25; }
.doc p { margin: 0 0 10pt; text-align: justify; }
.doc .meta { font-family: "Inter", Arial, sans-serif; font-size: 8pt; letter-spacing: .06em; text-transform: uppercase; color: #b8734a; margin-bottom: 4pt; }
.doc .center { text-align: center; }
.doc .right { text-align: right; }
.doc ol, .doc ul { margin: 0 0 10pt 18pt; padding: 0; }
.doc ol { list-style: decimal; }
.doc ul { list-style: disc; }
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
.doc .nota { margin-top: 18pt; font-family: "Inter", Arial, sans-serif; font-size: 9pt; color: #555; background: #f2eee6; padding: 6pt 8pt; border-left: 3px solid #b8734a; }
.doc .aviso { font-family: "Inter", Arial, sans-serif; font-size: 8.5pt; color: #666; border-top: 1px solid #ccc; padding-top: 8pt; margin-top: 28pt; }
`;

function escTexto(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Texto de la marca de agua que va al pie de cada hoja impresa. */
export function textoMarcaAgua(denominacion: string | null | undefined, fecha: string = todayIso()): string {
  const para = denominacion?.trim() ? ` para ${denominacion.trim()}` : "";
  return `Generado con NODOS Empresas${para} · ${formatFecha(fecha)} · Uso exclusivo del suscriptor`;
}

/**
 * HTML de la ventana de impresión. El pie con la marca de agua es un
 * elemento `position: fixed`, que los navegadores repiten en cada hoja al
 * imprimir; el <tfoot> vacío de la tabla también se repite en cada hoja y
 * reserva ese espacio para que el texto del documento no quede debajo.
 */
export function documentoImprimible(titulo: string, html: string, marca: string): string {
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${escTexto(titulo)}</title>
<style>
@page { size: A4; margin: 2cm 2cm 1.4cm; }
html, body { margin: 0; }
body { -webkit-user-select: none; user-select: none; }
${DOC_CSS}
table.hoja { width: 100%; border-collapse: collapse; }
table.hoja > tbody > tr > td, table.hoja > tfoot > tr > td { padding: 0; }
.pie-espacio { height: 1.1cm; }
.marca { position: fixed; left: 0; right: 0; bottom: 0; text-align: center; font-family: "Inter", Arial, sans-serif; font-size: 7.5pt; letter-spacing: .02em; color: #8a8a85; border-top: 0.5pt solid #d8d4cc; padding-top: 4pt; background: #fff; }
@media screen {
  body { margin: 24px auto; max-width: 760px; padding: 0 16px; }
  .marca { position: static; margin-top: 24px; }
  .pie-espacio { display: none; }
}
@media print {
  .doc .nota { display: none; }
  .doc .ph { background: none; color: inherit; }
}
</style></head><body>
<table class="hoja"><tbody><tr><td><div class="doc">${html}</div></td></tr></tbody><tfoot><tr><td><div class="pie-espacio"></div></td></tr></tfoot></table>
<div class="marca">${escTexto(marca)}</div>
</body></html>`;
}

/**
 * Abre el documento en una ventana y lanza el diálogo de impresión
 * (Guardar como PDF). Cada hoja lleva al pie la marca "Generado con NODOS
 * Empresas para <empresa> · <fecha> · Uso exclusivo del suscriptor".
 */
export function imprimir(titulo: string, html: string, opts: { denominacion?: string | null } = {}): boolean {
  const w = window.open("", "_blank");
  if (!w) return false;
  w.document.open();
  w.document.write(documentoImprimible(titulo, html, textoMarcaAgua(opts.denominacion)));
  w.document.close();
  // Disuasión: sin copiar, cortar, arrastrar ni menú contextual en la ventana.
  for (const ev of ["copy", "cut", "contextmenu", "dragstart", "selectstart"]) {
    w.document.addEventListener(ev, (e) => e.preventDefault());
  }
  w.focus();
  setTimeout(() => w.print(), 350);
  return true;
}
