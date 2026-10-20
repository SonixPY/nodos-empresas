import {
  Anchor,
  BookOpen,
  Briefcase,
  Building2,
  Coffee,
  Coins,
  Compass,
  Feather,
  Gem,
  Globe,
  KeyRound,
  Landmark,
  Leaf,
  Moon,
  Mountain,
  Rocket,
  Scale,
  Shield,
  Sprout,
  Star,
  Sun,
  TrendingUp,
  UserRound,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { AVATAR_FONDO, leerAvatar, type AvatarIcono } from "@/lib/nodos/avatares";

export const AVATAR_ICONO_COMPONENTE: Record<AvatarIcono, LucideIcon> = {
  usuario: UserRound,
  maletin: Briefcase,
  balanza: Scale,
  banco: Landmark,
  edificio: Building2,
  tendencia: TrendingUp,
  monedas: Coins,
  billetera: Wallet,
  hoja: Leaf,
  brote: Sprout,
  montana: Mountain,
  brujula: Compass,
  ancla: Anchor,
  pluma: Feather,
  sol: Sun,
  luna: Moon,
  estrella: Star,
  escudo: Shield,
  libro: BookOpen,
  cafe: Coffee,
  cohete: Rocket,
  gema: Gem,
  llave: KeyRound,
  mundo: Globe,
};

/**
 * Avatar de la cuenta (idéntico en las dos apps). Sin avatar elegido muestra
 * el ícono de persona sin fondo, como antes.
 */
export default function AvatarNodos({ valor, size = 28, className = "" }: { valor: string | null | undefined; size?: number; className?: string }) {
  const a = leerAvatar(valor);
  if (!a) return <UserRound size={Math.round(size * 0.58)} aria-hidden className={`shrink-0 ${className}`} />;
  const Icono = AVATAR_ICONO_COMPONENTE[a.icono];
  const c = AVATAR_FONDO[a.color];
  return (
    <span
      aria-hidden
      className={`inline-flex shrink-0 items-center justify-center rounded-full ${className}`}
      style={{ width: size, height: size, background: c.fondo, color: c.trazo, boxShadow: a.color === "marfil" ? "inset 0 0 0 1px rgba(30,47,37,0.18)" : undefined }}
    >
      <Icono size={Math.round(size * 0.55)} strokeWidth={1.8} />
    </span>
  );
}
