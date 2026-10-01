export type TipoSociedad = "sa" | "eas" | "srl";

export const TIPO_LABELS: Record<TipoSociedad, string> = {
  sa: "Sociedad Anónima (S.A.)",
  eas: "Empresa por Acciones Simplificada (EAS)",
  srl: "Sociedad de Responsabilidad Limitada (S.R.L.)",
};

export const TIPO_CORTO: Record<TipoSociedad, string> = {
  sa: "S.A.",
  eas: "EAS",
  srl: "S.R.L.",
};

export interface Empresa {
  id: string;
  user_id: string;
  denominacion: string;
  tipo: TipoSociedad;
  ruc: string | null;
  domicilio: string | null;
  ciudad: string | null;
  fecha_constitucion: string | null;
  cierre_mes: number;
  vencimiento_mandato: string | null;
  tiene_sindico: boolean;
  capital_integrado: number | null;
  notas: string | null;
  /** Rubro (migración 008, lista fija en src/lib/novedades.ts). */
  rubro?: string | null;
  created_at: string;
}

export type NuevaEmpresa = Omit<Empresa, "id" | "user_id" | "created_at">;

export type TipoPersona = "fisica" | "juridica";

export interface Accionista {
  id: string;
  empresa_id: string;
  nombre: string;
  documento: string | null;
  tipo_persona: TipoPersona;
  vinculo: string | null;
  acciones: number;
  votos_por_accion: number;
  cargo: string | null;
  email: string | null;
  telefono: string | null;
  activo: boolean;
  created_at: string;
}

export type NuevoAccionista = Omit<Accionista, "id" | "created_at" | "activo">;

export type TipoMovimiento = "transferencia" | "herencia" | "donacion" | "suscripcion" | "ajuste";

export const MOVIMIENTO_LABELS: Record<TipoMovimiento, string> = {
  transferencia: "Compraventa / transferencia",
  herencia: "Transmisión por herencia",
  donacion: "Donación en vida",
  suscripcion: "Suscripción de nuevas acciones",
  ajuste: "Ajuste de registro",
};

export interface MovimientoAcciones {
  id: string;
  empresa_id: string;
  fecha: string;
  tipo: TipoMovimiento;
  de_accionista_id: string | null;
  a_accionista_id: string | null;
  de_nombre: string | null;
  a_nombre: string | null;
  cantidad: number;
  precio_total: number | null;
  notas: string | null;
  created_at: string;
}

export type CategoriaObligacion = "societario" | "registros" | "tributario" | "laboral" | "interno" | "seprelad";

export const CATEGORIA_LABELS: Record<CategoriaObligacion, string> = {
  societario: "Societario",
  registros: "Registros (DGPEJBF)",
  tributario: "Tributario",
  laboral: "Laboral",
  interno: "Gestión interna",
  seprelad: "SEPRELAD (PLA/FT)",
};

export const CATEGORIA_COLOR: Record<CategoriaObligacion, string> = {
  societario: "#1e2f25",
  registros: "#b8734a",
  tributario: "#5b6f8a",
  laboral: "#7a8a65",
  interno: "#8a7d6b",
  seprelad: "#c9a227",
};

export interface Obligacion {
  id: string;
  empresa_id: string;
  titulo: string;
  descripcion: string | null;
  categoria: CategoriaObligacion;
  fecha: string;
  estado: "pendiente" | "hecho";
  completado_en: string | null;
  origen: "calendario" | "manual" | "evento";
  regla: string | null;
  anio: number | null;
  plantilla: string | null;
  created_at: string;
}

export type NuevaObligacion = Omit<Obligacion, "id" | "created_at" | "estado" | "completado_en">;

export interface Documento {
  id: string;
  empresa_id: string;
  plantilla: string;
  titulo: string;
  datos: Record<string, string | boolean>;
  contenido_html: string;
  created_at: string;
}
