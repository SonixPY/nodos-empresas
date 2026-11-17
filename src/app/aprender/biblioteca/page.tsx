import type { Metadata } from "next";
import Biblioteca from "@/components/nodos/aprender/Biblioteca";

export const metadata: Metadata = { title: "Biblioteca · NODOS Aprender" };

export default function BibliotecaPage() {
  return <Biblioteca />;
}
