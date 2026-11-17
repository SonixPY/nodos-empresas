"use client";

import { useParams } from "next/navigation";
import ConCarrera from "@/components/nodos/aprender/ConCarrera";
import SituacionVista from "@/components/nodos/aprender/SituacionVista";

export default function SituacionPage() {
  const { id } = useParams<{ id: string }>();
  return (
    <ConCarrera>
      <SituacionVista id={id} />
    </ConCarrera>
  );
}
