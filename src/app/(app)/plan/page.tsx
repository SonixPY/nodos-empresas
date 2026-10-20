import { redirect } from "next/navigation";

// El plan de cada cuenta vive dentro de Mi cuenta (idéntico en las dos apps).
// Esta ruta queda para los enlaces viejos y para la vuelta del pago de Polar.
export default async function PlanPage({ searchParams }: PageProps<"/plan">) {
  const { pago } = await searchParams;
  redirect(pago === "ok" ? "/cuenta?pago=ok#plan" : "/cuenta#plan");
}
