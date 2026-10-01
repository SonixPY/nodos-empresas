// Tipos y catálogos del NODOS Panel (centro de comandos, solo administradores).

export type Etapa = "nuevo" | "contactado" | "calificado" | "propuesta" | "cliente" | "descartado";
export type Tema = "cripto-compliance" | "empresa-familiar" | "finanzas" | "apps" | "otro";
export type Origen = "sitio" | "whatsapp" | "instagram" | "tiktok" | "youtube" | "email" | "referido" | "evento" | "otro" | "app";
export type TipoActividad = "nota" | "llamada" | "email" | "whatsapp" | "reunion" | "etapa" | "sistema";
export type Pilar = "zona-gris" | "decodificado" | "bajo-lupa" | "otro";
export type EstadoContenido = "idea" | "guion" | "grabado" | "editado" | "programado" | "publicado";

export interface Lead {
  id: string;
  created_at: string;
  updated_at: string;
  nombre: string;
  email: string | null;
  telefono: string | null;
  empresa: string | null;
  tema: Tema;
  mensaje: string | null;
  origen: Origen;
  etapa: Etapa;
  prioridad: 1 | 2 | 3;
  proximo_seguimiento: string | null;
  valor_estimado: number | null;
  consentimiento: boolean;
}

export interface Actividad {
  id: string;
  lead_id: string;
  created_at: string;
  tipo: TipoActividad;
  texto: string;
}

export interface Contenido {
  id: string;
  created_at: string;
  titulo: string;
  pilar: Pilar;
  episodio_id: string | null;
  estado: EstadoContenido;
  fecha: string | null;
  redes: string[];
  links: Record<string, string>;
  notas: string | null;
}

export const ETAPAS: { id: Etapa; label: string; color: string }[] = [
  { id: "nuevo", label: "Nuevo", color: "#b8734a" },
  { id: "contactado", label: "Contactado", color: "#8c5934" },
  { id: "calificado", label: "Calificado", color: "#7a8a65" },
  { id: "propuesta", label: "Propuesta", color: "#34483a" },
  { id: "cliente", label: "Cliente", color: "#1e2f25" },
  { id: "descartado", label: "Descartado", color: "#8a8378" },
];
export const ETAPA_LABEL = Object.fromEntries(ETAPAS.map((e) => [e.id, e.label])) as Record<Etapa, string>;
export const ETAPA_COLOR = Object.fromEntries(ETAPAS.map((e) => [e.id, e.color])) as Record<Etapa, string>;

export const TEMA_LABEL: Record<Tema, string> = {
  "cripto-compliance": "Cripto y compliance",
  "empresa-familiar": "Empresa familiar",
  finanzas: "Finanzas personales",
  apps: "Soporte de apps",
  otro: "Otro",
};

export const ORIGEN_LABEL: Record<Origen, string> = {
  sitio: "Sitio web",
  whatsapp: "WhatsApp",
  instagram: "Instagram",
  tiktok: "TikTok",
  youtube: "YouTube",
  email: "Email",
  referido: "Referido",
  evento: "Evento",
  otro: "Otro",
  app: "App NODOS Empresas",
};

export const ACTIVIDAD_LABEL: Record<TipoActividad, string> = {
  nota: "Nota",
  llamada: "Llamada",
  email: "Email",
  whatsapp: "WhatsApp",
  reunion: "Reunión",
  etapa: "Cambio de etapa",
  sistema: "Sistema",
};

export const PILARES: { id: Pilar; label: string; color: string; descripcion: string }[] = [
  { id: "zona-gris", label: "Zona Gris", color: "#1e2f25", descripcion: "Episodio mensual del podcast (30–45 min)" },
  { id: "decodificado", label: "Decodificado", color: "#b8734a", descripcion: "Short educativo: traduce jerga" },
  { id: "bajo-lupa", label: "Bajo Lupa", color: "#7a8a65", descripcion: "Short de análisis de un caso" },
  { id: "otro", label: "Otro", color: "#8a8378", descripcion: "Post, historia o pieza suelta" },
];
export const PILAR_LABEL = Object.fromEntries(PILARES.map((p) => [p.id, p.label])) as Record<Pilar, string>;
export const PILAR_COLOR = Object.fromEntries(PILARES.map((p) => [p.id, p.color])) as Record<Pilar, string>;

export const ESTADOS_CONTENIDO: { id: EstadoContenido; label: string }[] = [
  { id: "idea", label: "Idea" },
  { id: "guion", label: "Guion" },
  { id: "grabado", label: "Grabado" },
  { id: "editado", label: "Editado" },
  { id: "programado", label: "Programado" },
  { id: "publicado", label: "Publicado" },
];
export const ESTADO_LABEL = Object.fromEntries(ESTADOS_CONTENIDO.map((e) => [e.id, e.label])) as Record<EstadoContenido, string>;

export const REDES = [
  { id: "youtube", label: "YouTube" },
  { id: "spotify", label: "Spotify" },
  { id: "tiktok", label: "TikTok" },
  { id: "instagram", label: "Instagram" },
  { id: "threads", label: "Threads" },
  { id: "x", label: "X" },
  { id: "whatsapp", label: "Canal WhatsApp" },
] as const;

/** Link de WhatsApp para escribirle a un lead (formato internacional, sin símbolos). */
export function waLink(telefono: string | null): string | null {
  if (!telefono) return null;
  let d = telefono.replace(/\D/g, "");
  if (d.startsWith("0")) d = `595${d.slice(1)}`; // 0981… → 595981…
  return d.length >= 8 ? `https://wa.me/${d}` : null;
}

export function migracionPendiente(error: string | null | undefined): boolean {
  return !!error && /relation|does not exist|schema cache|leads|contenido/i.test(error);
}
