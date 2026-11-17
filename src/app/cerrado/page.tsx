"use client";

import Link from "next/link";
import { Download, GraduationCap, LifeBuoy, LogOut } from "lucide-react";
import { cerrarSesion } from "@/lib/nodos/usePerfil";
import { APP_ID } from "@/lib/nodos/app";
import { SITIOS } from "@/lib/nodos/sitios";
import AuthShell from "@/components/nodos/AuthShell";

// Aviso de cierre temporal (idéntico en las dos apps). Lo muestra el proxy
// cuando la app no está en NEXT_PUBLIC_MODULOS_ACTIVOS. Nada se borra.
export default function CerradoPage() {
  const app = SITIOS[APP_ID];
  return (
    <AuthShell titulo={`${app.nombre} está cerrado por ahora`}>
      <p className="text-carbon/75">
        En esta primera etapa NODOS se concentra en <strong>Aprender</strong>: un simulador para aprender a manejar tu plata,
        gratis con tu cuenta.
      </p>
      <p className="mt-3 text-carbon/75">
        Tus datos siguen guardados y protegidos. Si querés, podés descargarlos o pedir la baja de tu cuenta desde Mi cuenta.
      </p>
      <div className="mt-6 flex flex-wrap gap-2">
        <a href={SITIOS.practica.url} className="btn btn-primary">
          <GraduationCap size={16} aria-hidden /> Ir a Aprender
        </a>
        <Link href="/cuenta" className="btn btn-ghost">
          <Download size={16} aria-hidden /> Descargar mis datos
        </Link>
        <Link href="/soporte" className="btn btn-ghost">
          <LifeBuoy size={16} aria-hidden /> Escribir a soporte
        </Link>
        <button type="button" onClick={cerrarSesion} className="btn btn-ghost">
          <LogOut size={16} aria-hidden /> Salir
        </button>
      </div>
    </AuthShell>
  );
}
