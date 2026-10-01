"use client";

import Link from "next/link";
import { cerrarSesion } from "@/lib/nodos/usePerfil";
import { APP_ID } from "@/lib/nodos/app";
import { SITIOS } from "@/lib/nodos/sitios";
import AuthShell from "@/components/nodos/AuthShell";

export default function SinAccesoPage() {
  const otra = SITIOS[APP_ID === "finanzas" ? "empresas" : "finanzas"];

  const salir = cerrarSesion;

  return (
    <AuthShell titulo={`Tu cuenta no tiene acceso a ${SITIOS[APP_ID].nombre}`}>
      <p className="text-carbon/75">
        Puede que el acceso a esta app no esté habilitado para tu cuenta, o que la cuenta esté suspendida. Si creés que
        es un error, escribinos.
      </p>
      <div className="mt-6 flex flex-wrap gap-2">
        <Link href="/soporte" className="btn btn-primary">
          Escribir a soporte
        </Link>
        <a href={otra.url} className="btn btn-ghost">
          Ir a {otra.nombre}
        </a>
        <button type="button" onClick={salir} className="btn btn-ghost">
          Salir
        </button>
      </div>
    </AuthShell>
  );
}
