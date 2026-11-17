import type { Metadata } from "next";
import CarreraProvider from "@/components/nodos/aprender/CarreraProvider";
import AprenderShell from "@/components/nodos/aprender/AprenderShell";

export const metadata: Metadata = {
  title: "NODOS Aprender",
  description: "Aprendé a manejar tu plata jugando: un simulador de carrera, gratis con tu cuenta NODOS.",
};

// NODOS Aprender (idéntico en las dos apps; se juega en finanzas…/aprender).
export default function AprenderLayout({ children }: LayoutProps<"/aprender">) {
  return (
    <CarreraProvider>
      <AprenderShell>{children}</AprenderShell>
    </CarreraProvider>
  );
}
