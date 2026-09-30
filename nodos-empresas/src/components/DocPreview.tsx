import { DOC_CSS } from "@/lib/descargas";

/** Vista previa del documento con los mismos estilos que el .doc y el PDF. */
export default function DocPreview({ html }: { html: string }) {
  return (
    <div className="doc-preview overflow-x-auto rounded-sm border bg-white shadow-sm" style={{ borderColor: "var(--line)" }}>
      <style>{DOC_CSS}</style>
      <div className="doc mx-auto max-w-[720px] px-6 py-8 sm:px-10" dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
}
