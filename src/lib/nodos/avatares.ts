// Avatares de la cuenta NODOS (idéntico en las dos apps): un ícono de línea
// sobre un color de la marca. Se guarda como "icono:color" en profiles.avatar.
// Sin fotos ni emojis: mismo estilo que el resto de la plataforma.

export const AVATAR_ICONOS = [
  "usuario",
  "maletin",
  "balanza",
  "banco",
  "edificio",
  "tendencia",
  "monedas",
  "billetera",
  "hoja",
  "brote",
  "montana",
  "brujula",
  "ancla",
  "pluma",
  "sol",
  "luna",
  "estrella",
  "escudo",
  "libro",
  "cafe",
  "cohete",
  "gema",
  "llave",
  "mundo",
] as const;

export const AVATAR_COLORES = ["musgo", "bosque", "cobre", "carbon", "marfil"] as const;

export type AvatarIcono = (typeof AVATAR_ICONOS)[number];
export type AvatarColor = (typeof AVATAR_COLORES)[number];

export const AVATAR_FONDO: Record<AvatarColor, { fondo: string; trazo: string; nombre: string }> = {
  musgo: { fondo: "#1e2f25", trazo: "#f2eee6", nombre: "Musgo" },
  bosque: { fondo: "#34483a", trazo: "#f2eee6", nombre: "Bosque" },
  cobre: { fondo: "#8c5934", trazo: "#f2eee6", nombre: "Cobre" },
  carbon: { fondo: "#242522", trazo: "#f2eee6", nombre: "Carbón" },
  marfil: { fondo: "#f2eee6", trazo: "#1e2f25", nombre: "Marfil" },
};

export interface Avatar {
  icono: AvatarIcono;
  color: AvatarColor;
}

/** Lee "icono:color"; cualquier otro valor (o vacío) devuelve null. */
export function leerAvatar(valor: string | null | undefined): Avatar | null {
  if (!valor) return null;
  const [icono, color] = valor.split(":");
  if (!(AVATAR_ICONOS as readonly string[]).includes(icono)) return null;
  if (!(AVATAR_COLORES as readonly string[]).includes(color)) return null;
  return { icono: icono as AvatarIcono, color: color as AvatarColor };
}

export const avatarTexto = (a: Avatar) => `${a.icono}:${a.color}`;
