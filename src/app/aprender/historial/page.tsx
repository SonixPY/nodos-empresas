import type { Metadata } from "next";
import Historial from "@/components/nodos/aprender/Historial";

export const metadata: Metadata = { title: "Historial · NODOS Aprender" };

export default function HistorialPage() {
  return <Historial />;
}
