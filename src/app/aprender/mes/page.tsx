import type { Metadata } from "next";
import ConCarrera from "@/components/nodos/aprender/ConCarrera";
import CalendarioMes from "@/components/nodos/aprender/CalendarioMes";

export const metadata: Metadata = { title: "El mes · NODOS Aprender" };

export default function MesPage() {
  return (
    <ConCarrera>
      <CalendarioMes />
    </ConCarrera>
  );
}
