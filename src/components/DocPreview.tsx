"use client";

import { DOC_CSS } from "@/lib/descargas";

function bloquear(e: React.SyntheticEvent) {
  e.preventDefault();
}

/**
 * Vista previa del documento con los mismos estilos que el PDF.
 *
 * Sin selección de texto, copia, arrastre ni menú contextual: es una medida
 * disuasoria para que los modelos no se reutilicen fuera de la suscripción,
 * no una protección real (el HTML sigue estando en la página). Si se
 * imprime la página entera con Ctrl+P, el documento se oculta y se pide usar
 * "Imprimir / PDF", que agrega la marca de agua.
 */
export default function DocPreview({ html }: { html: string }) {
  return (
    <div
      className="doc-preview doc-protegido overflow-x-auto rounded-sm border bg-white shadow-sm"
      style={{ borderColor: "var(--line)" }}
      onCopy={bloquear}
      onCut={bloquear}
      onContextMenu={bloquear}
      onDragStart={bloquear}
    >
      <style>{`${DOC_CSS}
.doc-protegido { -webkit-user-select: none; user-select: none; -webkit-touch-callout: none; }
.doc-preview-aviso-impresion { display: none; }
@media print {
  .doc-protegido .doc { display: none !important; }
  .doc-preview-aviso-impresion { display: block; padding: 24px; font: 11pt Arial, sans-serif; color: #555; }
}`}</style>
      <div className="doc mx-auto max-w-[720px] px-6 py-8 sm:px-10" dangerouslySetInnerHTML={{ __html: html }} />
      <p className="doc-preview-aviso-impresion">Para imprimir o guardar en PDF usá el botón “Imprimir / PDF” de NODOS Empresas.</p>
    </div>
  );
}
