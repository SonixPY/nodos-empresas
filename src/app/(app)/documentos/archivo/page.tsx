import { redirect } from "next/navigation";

// Archivo y Guardados se unificaron en /documentos/guardados (sección Archivo).
export default async function ArchivoPage({ searchParams }: PageProps<"/documentos/archivo">) {
  const { empresa } = await searchParams;
  redirect(typeof empresa === "string" && /^[0-9a-f-]{36}$/i.test(empresa) ? `/documentos/guardados?empresa=${empresa}` : "/documentos/guardados");
}
