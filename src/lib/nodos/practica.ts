/**
 * NODOS Práctica: contenido del simulador (tarjetas y misiones), su
 * validación y la mezcla con lo que se edita desde el Panel.
 *
 * Archivo compartido (idéntico en finanzas-app y nodos-empresas): Finanzas
 * lo usa para jugar y Empresas (Panel → Práctica) para editar. Todo es
 * ficticio: personas, empresas y montos. Las bases normativas citan solo
 * normas verificadas; cada tarjeta lleva su aviso ("no es asesoría de
 * inversión" o "no constituye asesoramiento legal para tu caso").
 */

export type Mazo = "plata" | "inversiones" | "negocio" | "calendario" | "cumplimiento";
export type TipoEmpresaJuego = "unipersonal" | "eas" | "srl" | "sa";
export type PersonajeId = "independiente" | "emprendedor" | "heredero";
export type Aviso = "inversion" | "legal" | "ninguno";
export type Ruta = "mi-plata" | "ser-empresario" | "cumplimiento";

export interface Efectos {
  /** Guaraníes ficticios. */
  cajaPersonal?: number;
  cajaEmpresa?: number;
  inversiones?: number;
  /** Puntos (0 a 100). */
  cumplimiento?: number;
  riesgo?: number;
  /** Utilidad que se reparte: sale de la caja de la empresa y entra a la personal según tu participación, menos el IDU. */
  dividendo?: number;
}

export interface Opcion {
  texto: string;
  efectos: Efectos;
  explicacion: string;
  /** Marcas que deja la decisión (por ejemplo "mezclo-cajas"). */
  marca?: string[];
  quita?: string[];
  /** Tarjetas que vuelven más adelante (en el año, a los N meses; en una misión, a continuación). */
  programa?: { tarjeta: string; enMeses: number }[];
}

export interface Condicion {
  tipos?: TipoEmpresaJuego[];
  /** Meses del año simulado (1 = enero) en que puede salir. */
  meses?: number[];
  sujetoObligado?: boolean;
  requiere?: string;
  excluye?: string;
  /** Solo aparece cuando otra decisión la programa. */
  soloProgramada?: boolean;
  /** Solo en misiones (no sale en el año libre). */
  soloMision?: boolean;
}

export interface Tarjeta {
  id: string;
  mazo: Mazo;
  titulo: string;
  situacion: string;
  opciones: Opcion[];
  /** Norma o fuente que explica la tarjeta. */
  base: string;
  aviso: Aviso;
  condicion?: Condicion;
  /** Con meses: sale siempre en esos meses (calendario), no por azar. */
  fija?: boolean;
  /** Puede volver a salir en el mismo año (situaciones que se repiten, como cobrar el sueldo). */
  repetible?: boolean;
  /** Enlace "Hacelo de verdad". */
  hacelo?: { app: "finanzas" | "empresas"; ruta: string; texto: string };
}

export interface Mision {
  id: string;
  ruta: Ruta;
  orden: number;
  titulo: string;
  descripcion: string;
  tarjetas: string[];
  gratis: boolean;
  tipo: TipoEmpresaJuego;
  personaje: PersonajeId;
  sujetoObligado: boolean;
}

export const RUTAS: Record<Ruta, { titulo: string; descripcion: string }> = {
  "mi-plata": { titulo: "Mi plata", descripcion: "Presupuesto, deudas, ahorro e inversión: lo básico para que la plata te alcance y crezca." },
  "ser-empresario": { titulo: "Ser empresario", descripcion: "Elegir el tipo de empresa, separar cajas, facturar, aportar capital, cerrar el ejercicio y repartir utilidades." },
  cumplimiento: { titulo: "Cumplimiento", descripcion: "Sujetos obligados ante la SEPRELAD, conocer al cliente, beneficiarios finales, el RO y las señales de alerta." },
};

export const PERSONAJES: Record<PersonajeId, { titulo: string; descripcion: string; ingreso: number; gastos: number; ahorro: number; participacion: number }> = {
  independiente: {
    titulo: "Profesional independiente",
    descripcion: "Trabajás por tu cuenta con RUC y querés ordenar tu negocio.",
    ingreso: 9_000_000,
    gastos: 6_500_000,
    ahorro: 10_000_000,
    participacion: 100,
  },
  emprendedor: {
    titulo: "Empleado que emprende",
    descripcion: "Tenés sueldo fijo y estás armando tu primer negocio.",
    ingreso: 7_000_000,
    gastos: 5_000_000,
    ahorro: 15_000_000,
    participacion: 100,
  },
  heredero: {
    titulo: "Heredero de la empresa familiar",
    descripcion: "Entrás a la empresa de tu familia con una parte de las acciones.",
    ingreso: 8_000_000,
    gastos: 5_500_000,
    ahorro: 20_000_000,
    participacion: 25,
  },
};

export const TIPOS_JUEGO: Record<TipoEmpresaJuego, { titulo: string; corto: string; resultadoMensual: number; caja: number }> = {
  unipersonal: { titulo: "Empresa unipersonal", corto: "Unipersonal", resultadoMensual: 3_000_000, caja: 5_000_000 },
  eas: { titulo: "Empresa por Acciones Simplificada (EAS)", corto: "EAS", resultadoMensual: 4_500_000, caja: 15_000_000 },
  srl: { titulo: "Sociedad de Responsabilidad Limitada (S.R.L.)", corto: "S.R.L.", resultadoMensual: 6_000_000, caja: 25_000_000 },
  sa: { titulo: "Sociedad Anónima (S.A.)", corto: "S.A.", resultadoMensual: 9_000_000, caja: 40_000_000 },
};

/** IDU que retiene la sociedad a residentes (Ley 6380/2019). */
export const IDU_RESIDENTE_JUEGO = 0.08;

export const AVISO_TEXTO: Record<Aviso, string> = {
  inversion: "Contenido educativo con datos ficticios: no es asesoría de inversión.",
  legal: "Contenido educativo con casos ficticios: no constituye asesoramiento legal para tu caso.",
  ninguno: "",
};

const SOCIEDADES: TipoEmpresaJuego[] = ["eas", "srl", "sa"];
const TRIMESTRE = [1, 4, 7, 10];

// ── Tarjetas incluidas ─────────────────────────────────────────────────────
export const TARJETAS: Tarjeta[] = [
  // Mi plata
  {
    id: "presupuesto-sueldo",
    repetible: true,
    mazo: "plata",
    titulo: "Llegó el sueldo",
    situacion: "Cobraste tu ingreso del mes. Antes de pagar nada, decidís qué hacer con el ahorro.",
    base: "Educación financiera general.",
    aviso: "inversion",
    opciones: [
      {
        texto: "Separo el 10 % para ahorro apenas cobro",
        efectos: { cajaPersonal: -700_000, inversiones: 700_000, riesgo: -2 },
        explicacion: "Ahorrar primero hace que el ahorro no dependa de lo que sobre. Es la forma más simple de que pase todos los meses.",
      },
      {
        texto: "Pago todo y ahorro lo que sobre a fin de mes",
        efectos: {},
        marca: ["sin-ahorro"],
        programa: [{ tarjeta: "gasto-hormiga", enMeses: 1 }],
        explicacion: "Lo que sobra a fin de mes suele ser poco o nada: los gastos chicos se comen el margen.",
      },
      {
        texto: "Me doy un gusto: el mes fue duro",
        efectos: { cajaPersonal: -1_500_000 },
        explicacion: "Darse un gusto está bien si está en el presupuesto. Si no, se paga con el ahorro del mes que viene.",
      },
    ],
    hacelo: { app: "finanzas", ruta: "/movimientos", texto: "Cargá tus gastos en Movimientos" },
  },
  {
    id: "gasto-hormiga",
    mazo: "plata",
    titulo: "No quedó nada",
    situacion: "Llegaste a fin de mes y no quedó nada para ahorrar. Hay suscripciones y compras chicas que no recordabas.",
    base: "Educación financiera general.",
    aviso: "inversion",
    condicion: { soloProgramada: true },
    opciones: [
      {
        texto: "Reviso los gastos que se repiten y corto los que no uso",
        efectos: { cajaPersonal: 400_000, riesgo: -2 },
        quita: ["sin-ahorro"],
        explicacion: "Los gastos recurrentes son el gasto invisible. Revisarlos una vez por trimestre suele liberar plata todos los meses.",
      },
      {
        texto: "Sigo igual: ya me voy a ordenar",
        efectos: { riesgo: 3 },
        explicacion: "Sin un cambio, el mes que viene pasa lo mismo y no se arma un colchón para imprevistos.",
      },
    ],
    hacelo: { app: "finanzas", ruta: "/movimientos", texto: "Mirá tus gastos recurrentes en Movimientos" },
  },
  {
    id: "fondo-emergencia",
    repetible: true,
    mazo: "plata",
    titulo: "Un imprevisto",
    situacion: "Se rompió el auto y la reparación cuesta Gs. 2.500.000.",
    base: "Educación financiera general.",
    aviso: "inversion",
    opciones: [
      {
        texto: "Lo pago con mis ahorros",
        efectos: { inversiones: -2_500_000 },
        explicacion: "Para esto está el fondo de emergencia: tener a mano unos meses de gastos evita endeudarse caro.",
      },
      {
        texto: "Lo pago con la tarjeta y lo financio",
        efectos: {},
        marca: ["deuda-tarjeta"],
        programa: [{ tarjeta: "interes-tarjeta", enMeses: 1 }],
        explicacion: "Financiar en la tarjeta es de lo más caro que hay: el saldo genera intereses mes a mes.",
      },
      {
        texto: "Saco la plata de la caja del negocio",
        efectos: { cajaEmpresa: -2_500_000, riesgo: 8 },
        marca: ["mezclo-cajas"],
        programa: [{ tarjeta: "mezcla-cajas-contador", enMeses: 2 }],
        explicacion: "Usar la caja del negocio para gastos personales mezcla las cuentas: después nadie sabe cuánto gana el negocio.",
      },
    ],
  },
  {
    id: "interes-tarjeta",
    mazo: "plata",
    titulo: "Llegó el resumen de la tarjeta",
    situacion: "El resumen trae lo que financiaste, más intereses. El pago mínimo es mucho menor que el total.",
    base: "Educación financiera general.",
    aviso: "inversion",
    condicion: { soloProgramada: true },
    opciones: [
      {
        texto: "Pago el total",
        efectos: { cajaPersonal: -2_700_000 },
        quita: ["deuda-tarjeta"],
        explicacion: "Pagar el total corta los intereses. Duele un mes, pero sale mucho más barato.",
      },
      {
        texto: "Pago el mínimo",
        efectos: { cajaPersonal: -400_000, riesgo: 3 },
        programa: [{ tarjeta: "interes-tarjeta-2", enMeses: 1 }],
        explicacion: "Con el mínimo, el saldo sigue generando intereses: la deuda baja muy despacio o hasta crece.",
      },
    ],
    hacelo: { app: "finanzas", ruta: "/movimientos", texto: "Seguí tu tarjeta en Movimientos" },
  },
  {
    id: "interes-tarjeta-2",
    mazo: "plata",
    titulo: "La deuda sigue ahí",
    situacion: "Volviste a pagar el mínimo y la deuda casi no bajó.",
    base: "Educación financiera general.",
    aviso: "inversion",
    condicion: { soloProgramada: true },
    opciones: [
      {
        texto: "Cambio la deuda por un préstamo con cuota fija y tasa más baja",
        efectos: { cajaPersonal: -300_000, riesgo: -2 },
        quita: ["deuda-tarjeta"],
        explicacion: "Pasar una deuda cara a una más barata, con fecha de fin, ordena los pagos. Compará el costo total antes de firmar.",
      },
      {
        texto: "La pago entera con mis ahorros",
        efectos: { inversiones: -2_900_000 },
        quita: ["deuda-tarjeta"],
        explicacion: "Usar ahorro para cancelar una deuda cara suele convenir: ningún ahorro común rinde lo que cobra una tarjeta.",
      },
    ],
  },
  {
    id: "prestamo-amigo",
    repetible: true,
    mazo: "plata",
    titulo: "Un amigo te pide plata",
    situacion: "Un amigo te pide prestados Gs. 3.000.000. Dice que te los devuelve en tres meses.",
    base: "Educación financiera general.",
    aviso: "ninguno",
    opciones: [
      {
        texto: "Le presto con un papel firmado y fecha de devolución",
        efectos: { cajaPersonal: -3_000_000 },
        programa: [{ tarjeta: "devolucion-amigo", enMeses: 3 }],
        explicacion: "Un papel simple con monto, fecha y firma cuida la amistad: los dos saben qué se acordó.",
      },
      {
        texto: "Le presto de palabra",
        efectos: { cajaPersonal: -3_000_000 },
        programa: [{ tarjeta: "amigo-no-devuelve", enMeses: 3 }],
        explicacion: "Sin nada escrito, si hay un problema es tu palabra contra la de él.",
      },
      {
        texto: "Le digo que ahora no puedo",
        efectos: {},
        explicacion: "Decir que no también es una decisión financiera: prestá solo lo que podrías perder.",
      },
    ],
  },
  {
    id: "devolucion-amigo",
    mazo: "plata",
    titulo: "Te devolvieron",
    situacion: "Tu amigo te devolvió los Gs. 3.000.000 en la fecha acordada.",
    base: "Educación financiera general.",
    aviso: "ninguno",
    condicion: { soloProgramada: true },
    opciones: [{ texto: "Bien", efectos: { cajaPersonal: 3_000_000 }, explicacion: "Con el acuerdo por escrito, la devolución fue simple." }],
  },
  {
    id: "amigo-no-devuelve",
    mazo: "plata",
    titulo: "No te devuelven",
    situacion: "Pasaron los tres meses y tu amigo no te devuelve. No hay nada escrito.",
    base: "Educación financiera general.",
    aviso: "ninguno",
    condicion: { soloProgramada: true },
    opciones: [
      {
        texto: "Le reclamo y acordamos que me pague una parte",
        efectos: { cajaPersonal: 1_000_000 },
        explicacion: "Sin un documento, lo que consigas depende de la buena voluntad. La próxima, por escrito.",
      },
      { texto: "Lo dejo pasar", efectos: {}, explicacion: "A veces se prefiere la amistad a la plata: está bien si es una decisión, no un descuido." },
    ],
  },
  {
    id: "patrimonio-neto",
    mazo: "plata",
    titulo: "¿Cuánto tenés de verdad?",
    situacion: "Te preguntan cuánto vale tu patrimonio. Tenés ahorros, una parte en una empresa y una deuda.",
    base: "Educación financiera general.",
    aviso: "inversion",
    opciones: [
      {
        texto: "Sumo lo que tengo y resto lo que debo",
        efectos: { riesgo: -3 },
        explicacion: "Patrimonio neto = lo que tenés menos lo que debés. Mirarlo una vez por mes muestra si avanzás de verdad.",
      },
      {
        texto: "Miro solo el saldo de la cuenta",
        efectos: { riesgo: 2 },
        explicacion: "El saldo de la cuenta no muestra las deudas ni lo invertido: puede dar una idea equivocada.",
      },
    ],
    hacelo: { app: "finanzas", ruta: "/", texto: "Mirá tu Resumen en NODOS Finanzas" },
  },

  // Inversiones
  {
    id: "oferta-demasiado-buena",
    repetible: true,
    mazo: "inversiones",
    titulo: "Rendimiento garantizado",
    situacion: "Te ofrecen invertir en una plataforma cripto que \"garantiza\" un 10 % por mes.",
    base: "Educación financiera general.",
    aviso: "inversion",
    opciones: [
      {
        texto: "Pongo Gs. 5.000.000 para probar",
        efectos: { inversiones: -5_000_000, riesgo: 10 },
        programa: [{ tarjeta: "estafa-cae", enMeses: 2 }],
        explicacion: "Un rendimiento alto y garantizado es la señal de alerta más clara: nadie puede garantizar eso.",
      },
      {
        texto: "Pregunto quién la regula y de dónde sale el rendimiento",
        efectos: { riesgo: -3 },
        explicacion: "Preguntar quién supervisa y cómo se gana la plata separa una inversión de una promesa.",
      },
      { texto: "Paso", efectos: {}, explicacion: "No invertir en lo que no entendés también es una buena decisión." },
    ],
  },
  {
    id: "estafa-cae",
    mazo: "inversiones",
    titulo: "La plataforma dejó de pagar",
    situacion: "La plataforma que garantizaba el 10 % mensual dejó de responder.",
    base: "Educación financiera general.",
    aviso: "inversion",
    condicion: { soloProgramada: true },
    opciones: [
      {
        texto: "Aprendí la lección",
        efectos: { riesgo: -2 },
        explicacion: "Los esquemas que pagan con la plata de los nuevos se caen cuando dejan de entrar. La plata casi nunca vuelve.",
      },
    ],
  },
  {
    id: "primera-inversion",
    mazo: "inversiones",
    titulo: "Tu primera inversión",
    situacion: "Tenés Gs. 5.000.000 que no vas a necesitar en un año.",
    base: "Educación financiera general.",
    aviso: "inversion",
    opciones: [
      {
        texto: "Un certificado de depósito a plazo",
        efectos: { cajaPersonal: -5_000_000, inversiones: 5_000_000 },
        programa: [{ tarjeta: "cda-vence", enMeses: 6 }],
        explicacion: "Un CDA paga un interés pactado a un plazo fijo: rinde poco pero sabés cuánto vas a cobrar.",
      },
      {
        texto: "Todo en una sola cripto",
        efectos: { cajaPersonal: -5_000_000, inversiones: 5_000_000, riesgo: 8 },
        programa: [{ tarjeta: "cripto-baja", enMeses: 2 }],
        explicacion: "Concentrar todo en un activo muy volátil puede salir bien o muy mal. El riesgo es todo tuyo.",
      },
      {
        texto: "Divido: una parte a plazo y otra en un fondo",
        efectos: { cajaPersonal: -5_000_000, inversiones: 5_000_000, riesgo: -2 },
        programa: [{ tarjeta: "diversificado", enMeses: 4 }],
        explicacion: "Repartir entre instrumentos distintos baja el golpe si a uno le va mal.",
      },
    ],
    hacelo: { app: "finanzas", ruta: "/portafolio", texto: "Registrá tus inversiones en NODOS Finanzas" },
  },
  {
    id: "cda-vence",
    mazo: "inversiones",
    titulo: "Venció tu CDA",
    situacion: "Venció el certificado: cobrás el capital más los intereses pactados.",
    base: "Educación financiera general.",
    aviso: "inversion",
    condicion: { soloProgramada: true },
    opciones: [{ texto: "Cobrar", efectos: { inversiones: 250_000 }, explicacion: "Rendimiento chico pero previsible: para eso sirve un plazo fijo." }],
  },
  {
    id: "cripto-baja",
    mazo: "inversiones",
    titulo: "La cripto bajó 40 %",
    situacion: "La cripto en la que pusiste todo bajó fuerte en dos meses.",
    base: "Educación financiera general.",
    aviso: "inversion",
    condicion: { soloProgramada: true },
    opciones: [
      {
        texto: "Vendo para no perder más",
        efectos: { inversiones: -2_000_000 },
        explicacion: "Vender en la baja hace real la pérdida. A veces es lo correcto, si el motivo de la inversión cambió.",
      },
      {
        texto: "Mantengo: sabía que podía pasar",
        efectos: { inversiones: -2_000_000 },
        programa: [{ tarjeta: "cripto-rebota", enMeses: 3 }],
        explicacion: "Mantener solo tiene sentido si es plata que podés no tocar por mucho tiempo.",
      },
      {
        texto: "Compro más con la plata del mes",
        efectos: { cajaPersonal: -2_000_000, inversiones: 2_000_000, riesgo: 5 },
        explicacion: "Poner más plata para \"promediar\" aumenta lo que está en juego: hacelo solo con un plan.",
      },
    ],
  },
  {
    id: "cripto-rebota",
    mazo: "inversiones",
    titulo: "Se recuperó una parte",
    situacion: "El precio recuperó una parte de la caída.",
    base: "Educación financiera general.",
    aviso: "inversion",
    condicion: { soloProgramada: true },
    opciones: [{ texto: "Seguir", efectos: { inversiones: 1_000_000 }, explicacion: "Nadie sabe si sigue subiendo o vuelve a bajar: el riesgo sigue ahí." }],
  },
  {
    id: "diversificado",
    mazo: "inversiones",
    titulo: "Un mes movido",
    situacion: "El fondo bajó un poco y el plazo fijo siguió rindiendo. El total casi no se movió.",
    base: "Educación financiera general.",
    aviso: "inversion",
    condicion: { soloProgramada: true },
    opciones: [{ texto: "Seguir", efectos: { inversiones: 150_000 }, explicacion: "Así funciona repartir: lo que baja en un lado se compensa en otro." }],
  },
  {
    id: "dolar-sube",
    repetible: true,
    mazo: "inversiones",
    titulo: "Subió el dólar",
    situacion: "El dólar subió fuerte este mes y todos hablan de eso.",
    base: "Educación financiera general.",
    aviso: "inversion",
    opciones: [
      {
        texto: "Compro dólares ahora, por las dudas",
        efectos: { cajaPersonal: -2_000_000, inversiones: 1_900_000, riesgo: 2 },
        explicacion: "Comprar en el pico por miedo suele salir caro: pagás la diferencia entre compra y venta, y quizás el precio vuelve.",
      },
      { texto: "Sigo con mi plan", efectos: { riesgo: -1 }, explicacion: "Un plan pensado con calma vale más que una decisión apurada." },
      {
        texto: "Reviso si tengo deudas en dólares",
        efectos: { riesgo: -2 },
        explicacion: "Lo que más duele de una suba es deber en dólares y cobrar en guaraníes: conviene saberlo antes.",
      },
    ],
  },

  // Negocio
  {
    id: "elegir-tipo",
    mazo: "negocio",
    condicion: { soloMision: true },
    titulo: "¿Qué tipo de empresa?",
    situacion: "Querés formalizar el negocio y sumar a un socio.",
    base: "Ley 6480/2020 (EAS), arts. 1 y 5; Código Civil, art. 1160 (S.R.L.).",
    aviso: "legal",
    opciones: [
      {
        texto: "Sigo como unipersonal, a mi nombre",
        efectos: { riesgo: 5 },
        explicacion: "Como unipersonal, el titular es la persona: no hay una sociedad que separe tu patrimonio del negocio, y el socio no figura.",
      },
      {
        texto: "Una EAS",
        efectos: { cumplimiento: 5 },
        explicacion: "La EAS puede tener uno o más socios y se constituye solo por el SUACE (Ley 6480/2020, arts. 1 y 5). El estatuto es flexible.",
      },
      {
        texto: "Una S.R.L.",
        efectos: { cumplimiento: 5 },
        explicacion: "La S.R.L. tiene hasta 25 socios y el capital se divide en cuotas (Código Civil, art. 1160).",
      },
    ],
    hacelo: { app: "empresas", ruta: "/empresas", texto: "Cargá tu entidad en NODOS Empresas" },
  },
  {
    id: "separar-cajas",
    repetible: true,
    mazo: "negocio",
    titulo: "La luz de tu casa",
    situacion: "Pagaste la luz de tu casa con la cuenta del negocio.",
    base: "Educación financiera y contable general.",
    aviso: "ninguno",
    opciones: [
      {
        texto: "Lo registro como retiro del dueño",
        efectos: { cumplimiento: 3, riesgo: -3 },
        quita: ["mezclo-cajas"],
        explicacion: "Si pasa, registralo: un retiro del dueño deja claro qué fue del negocio y qué tuyo.",
      },
      {
        texto: "No lo anoto: total, todo es mío",
        efectos: { riesgo: 8 },
        marca: ["mezclo-cajas"],
        programa: [{ tarjeta: "mezcla-cajas-contador", enMeses: 2 }],
        explicacion: "Mezclar las cajas hace imposible saber si el negocio gana plata y complica las declaraciones.",
      },
    ],
    hacelo: { app: "finanzas", ruta: "/movimientos", texto: "Separá la plata de tu negocio en Movimientos" },
  },
  {
    id: "mezcla-cajas-contador",
    mazo: "negocio",
    titulo: "El contador no puede cerrar",
    situacion: "Tu contador no puede cerrar el mes: hay gastos personales mezclados con los del negocio.",
    base: "Educación contable general.",
    aviso: "ninguno",
    condicion: { soloProgramada: true },
    opciones: [
      {
        texto: "Separo todo y le paso el detalle",
        efectos: { cumplimiento: 5, riesgo: -4 },
        quita: ["mezclo-cajas"],
        explicacion: "Ordenarlo una vez y llevar dos cajas desde ahí ahorra horas (y honorarios) todos los meses.",
      },
      {
        texto: "Que lo arregle él",
        efectos: { cajaEmpresa: -500_000, cumplimiento: -10 },
        explicacion: "Si el contador tiene que adivinar, cobra más y el riesgo de errores en las declaraciones sube.",
      },
    ],
  },
  {
    id: "retiro-dueno",
    repetible: true,
    mazo: "negocio",
    titulo: "Necesitás plata para tu casa",
    situacion: "El negocio va bien y necesitás Gs. 2.000.000 para gastos de tu casa.",
    base: "Educación contable general.",
    aviso: "ninguno",
    condicion: { tipos: ["unipersonal"] },
    opciones: [
      {
        texto: "Hago un retiro del dueño y lo registro en las dos cajas",
        efectos: { cajaEmpresa: -2_000_000, cajaPersonal: 2_000_000, cumplimiento: 2 },
        explicacion: "Un retiro registrado es una transferencia entre tus dos cajas: queda claro y no se confunde con un gasto del negocio.",
      },
      {
        texto: "Uso la tarjeta del negocio en el súper",
        efectos: { cajaEmpresa: -2_000_000, riesgo: 6 },
        marca: ["mezclo-cajas"],
        explicacion: "Así el gasto queda como si fuera del negocio y la caja personal no lo refleja.",
      },
    ],
    hacelo: { app: "finanzas", ruta: "/movimientos", texto: "Registrá retiros en Movimientos" },
  },
  {
    id: "facturar",
    repetible: true,
    mazo: "negocio",
    titulo: "\"No me hagas factura\"",
    situacion: "Un cliente te pide no hacerle factura para pagar menos.",
    base: "Ley 6380/2019: obligación de emitir comprobante por cada venta o servicio.",
    aviso: "legal",
    opciones: [
      {
        texto: "Siempre facturo",
        efectos: { cumplimiento: 5 },
        explicacion: "Emitir el comprobante es obligatorio y además te protege: es la prueba de la venta y del cobro.",
      },
      {
        texto: "Le hago el favor esta vez",
        efectos: { cumplimiento: -10, riesgo: 10 },
        marca: ["sin-factura"],
        programa: [{ tarjeta: "fiscalizacion", enMeses: 4 }],
        explicacion: "Vender sin comprobante es un incumplimiento tributario y deja una diferencia difícil de explicar después.",
      },
    ],
  },
  {
    id: "fiscalizacion",
    mazo: "negocio",
    titulo: "Te piden explicaciones",
    situacion: "La administración tributaria te pide explicar ventas que no tienen comprobante.",
    base: "Ley 6380/2019.",
    aviso: "legal",
    condicion: { soloProgramada: true },
    opciones: [
      {
        texto: "Regularizo con el contador",
        efectos: { cajaEmpresa: -2_000_000, cumplimiento: 5 },
        quita: ["sin-factura"],
        explicacion: "Regularizar pronto, con asesoramiento, suele costar menos que esperar.",
      },
      {
        texto: "Digo que no hubo ventas",
        efectos: { cajaEmpresa: -4_000_000, cumplimiento: -15, riesgo: 10 },
        explicacion: "Negar lo que se puede probar agrava la situación. (Montos ficticios.)",
      },
    ],
  },
  {
    id: "cliente-grande",
    repetible: true,
    mazo: "negocio",
    titulo: "Un cliente grande",
    situacion: "Un cliente grande te ofrece un contrato importante, pero paga a 90 días.",
    base: "Educación financiera general.",
    aviso: "ninguno",
    opciones: [
      {
        texto: "Acepto y pido un anticipo del 30 %",
        efectos: { cajaEmpresa: 3_000_000 },
        programa: [{ tarjeta: "cobro-cliente-grande", enMeses: 3 }],
        explicacion: "El anticipo cubre los costos mientras esperás el cobro: crecer sin caja es un riesgo.",
      },
      {
        texto: "Acepto sin anticipo",
        efectos: { cajaEmpresa: -2_000_000 },
        programa: [{ tarjeta: "cobro-atrasado", enMeses: 3 }],
        explicacion: "Vas a pagar los costos antes de cobrar: tu caja financia al cliente.",
      },
      { texto: "No lo tomo", efectos: {}, explicacion: "A veces un cliente grande no conviene si tu caja no lo aguanta." },
    ],
  },
  {
    id: "cobro-cliente-grande",
    mazo: "negocio",
    titulo: "Cobraste el saldo",
    situacion: "El cliente grande pagó el saldo del contrato.",
    base: "Educación financiera general.",
    aviso: "ninguno",
    condicion: { soloProgramada: true },
    opciones: [{ texto: "Cobrar", efectos: { cajaEmpresa: 7_000_000 }, explicacion: "Con el anticipo, el contrato no te dejó sin caja en el medio." }],
  },
  {
    id: "cobro-atrasado",
    mazo: "negocio",
    titulo: "No te pagan",
    situacion: "Pasaron los 90 días y el cliente grande no te paga.",
    base: "Educación financiera general.",
    aviso: "ninguno",
    condicion: { soloProgramada: true },
    opciones: [
      {
        texto: "Reclamo formalmente, con el contrato y la factura",
        efectos: { cajaEmpresa: 6_000_000 },
        explicacion: "Con contrato y comprobantes, el reclamo tiene fuerza. Cobraste, aunque tarde.",
      },
      { texto: "Espero un poco más", efectos: { riesgo: 5 }, explicacion: "Esperar sin reclamar alarga el problema y tu caja sigue financiando al cliente." },
    ],
  },
  {
    id: "familiar-trabajo",
    mazo: "negocio",
    titulo: "Tu sobrino quiere trabajar",
    situacion: "Tu sobrino quiere trabajar en la empresa.",
    base: "Código del Trabajo, art. 46 (contenido del contrato de trabajo).",
    aviso: "legal",
    opciones: [
      {
        texto: "Contrato por escrito, con sueldo y horario, como cualquier empleado",
        efectos: { cumplimiento: 5 },
        explicacion: "Formalizar la relación como la de cualquier empleado evita conflictos en la familia y con la ley.",
      },
      {
        texto: "Que venga cuando pueda y le pago algo",
        efectos: { riesgo: 6 },
        programa: [{ tarjeta: "reclamo-laboral", enMeses: 5 }],
        explicacion: "Si en la práctica cumple horario y recibe órdenes, la ley puede considerar que hay relación laboral aunque no esté escrita.",
      },
    ],
    hacelo: { app: "empresas", ruta: "/documentos", texto: "Usá las plantillas para familiares en NODOS Empresas" },
  },
  {
    id: "reclamo-laboral",
    mazo: "negocio",
    titulo: "Un reclamo en la familia",
    situacion: "Tu sobrino dejó de ir y reclama derechos laborales por el tiempo trabajado.",
    base: "Código del Trabajo.",
    aviso: "legal",
    condicion: { soloProgramada: true },
    opciones: [
      { texto: "Llego a un acuerdo", efectos: { cajaEmpresa: -3_000_000 }, explicacion: "Un acuerdo cuesta, pero cierra el conflicto. (Montos ficticios.)" },
      { texto: "Que lo decida un juez", efectos: { cajaEmpresa: -5_000_000, riesgo: 5 }, explicacion: "Un juicio lleva tiempo y plata, y el resultado es incierto." },
    ],
  },
  {
    id: "socio-sale",
    mazo: "negocio",
    titulo: "Un socio quiere vender",
    situacion: "Un socio quiere vender su parte a una persona de afuera.",
    base: "Estatuto o contrato social; Ley 6480/2020, art. 31 (libro de registro de acciones de la EAS).",
    aviso: "legal",
    condicion: { tipos: SOCIEDADES },
    opciones: [
      {
        texto: "Reviso el estatuto y la preferencia de los socios antes de aceptar",
        efectos: { cumplimiento: 5 },
        programa: [{ tarjeta: "bf-cambio", enMeses: 1 }],
        explicacion: "El estatuto suele dar preferencia a los socios para comprar. Después, la venta se anota en el libro de socios o accionistas.",
      },
      {
        texto: "Que la venda a quien quiera",
        efectos: { riesgo: 5 },
        programa: [{ tarjeta: "bf-cambio", enMeses: 1 }],
        explicacion: "Sin revisar el estatuto, la venta puede ser cuestionada y entra alguien que no elegiste.",
      },
    ],
    hacelo: { app: "empresas", ruta: "/empresas", texto: "Llevá el libro de accionistas en NODOS Empresas" },
  },
  {
    id: "bf-cambio",
    mazo: "cumplimiento",
    titulo: "Cambió un beneficiario final",
    situacion: "Con la venta, otra persona pasó a tener más del 10 % del capital.",
    base: "Ley 6446/2019, art. 7; Decreto 3241/2020, art. 10.",
    aviso: "legal",
    condicion: { tipos: SOCIEDADES, soloProgramada: true },
    opciones: [
      {
        texto: "Lo comunico en el SIARA dentro de los 15 días hábiles",
        efectos: { cumplimiento: 5 },
        explicacion: "Los cambios de beneficiarios finales se comunican dentro de los 15 días hábiles (Ley 6446/2019, art. 7; Decreto 3241/2020, art. 10).",
      },
      {
        texto: "Lo dejo para la actualización de junio",
        efectos: { cumplimiento: -10, riesgo: 5 },
        explicacion: "La actualización anual no reemplaza el aviso de cada cambio: el plazo corre desde que pasa.",
      },
    ],
    hacelo: { app: "empresas", ruta: "/empresas", texto: "Prepará el SIARA en NODOS Empresas" },
  },
  {
    id: "aporte-capital",
    mazo: "negocio",
    titulo: "La empresa necesita plata",
    situacion: "La empresa necesita Gs. 10.000.000 para comprar una máquina.",
    base: "Educación contable y societaria general.",
    aviso: "legal",
    condicion: { tipos: SOCIEDADES },
    opciones: [
      {
        texto: "Hago un aporte de capital y lo anoto en el libro de accionistas",
        efectos: { cajaPersonal: -10_000_000, cajaEmpresa: 10_000_000, cumplimiento: 3 },
        explicacion: "Un aporte formal aumenta tu participación o tu capital, y queda registrado.",
      },
      {
        texto: "Le presto a la empresa con un contrato de préstamo",
        efectos: { cajaPersonal: -10_000_000, cajaEmpresa: 10_000_000 },
        programa: [{ tarjeta: "devolucion-prestamo-socio", enMeses: 6 }],
        explicacion: "Un préstamo del socio es una deuda de la empresa: se devuelve, y no cambia la participación.",
      },
      {
        texto: "Pongo la plata sin papeles",
        efectos: { cajaPersonal: -10_000_000, cajaEmpresa: 10_000_000, riesgo: 6 },
        marca: ["mezclo-cajas"],
        explicacion: "Sin papeles nadie sabe si fue aporte, préstamo o regalo: es fuente de conflictos entre socios.",
      },
    ],
    hacelo: { app: "empresas", ruta: "/empresas", texto: "Registrá aportes en NODOS Empresas" },
  },
  {
    id: "devolucion-prestamo-socio",
    mazo: "negocio",
    titulo: "La empresa te devuelve el préstamo",
    situacion: "Llegó la fecha y la empresa te devuelve lo que le prestaste.",
    base: "Educación contable general.",
    aviso: "ninguno",
    condicion: { soloProgramada: true },
    opciones: [{ texto: "Cobrar", efectos: { cajaEmpresa: -10_000_000, cajaPersonal: 10_000_000 }, explicacion: "Con el contrato, la devolución fue clara para todos." }],
  },
  {
    id: "integracion-eas",
    mazo: "calendario",
    titulo: "Capital sin integrar",
    situacion: "Suscribiste acciones de la EAS y todavía no pagaste (integraste) una parte.",
    base: "Ley 6480/2020, art. 10.",
    aviso: "legal",
    condicion: { tipos: ["eas"], meses: [3] },
    fija: true,
    opciones: [
      {
        texto: "Integro el saldo ahora",
        efectos: { cajaPersonal: -5_000_000, cajaEmpresa: 5_000_000, cumplimiento: 5 },
        explicacion: "En la EAS, el plazo para integrar lo suscripto no puede pasar de 2 años (Ley 6480/2020, art. 10).",
      },
      {
        texto: "Lo agendo para más adelante",
        efectos: { riesgo: 2 },
        programa: [{ tarjeta: "integracion-eas-recordatorio", enMeses: 6 }],
        explicacion: "Se puede, dentro del plazo: lo importante es tenerlo agendado.",
      },
    ],
    hacelo: { app: "finanzas", ruta: "/vencimientos", texto: "Agendalo en Vencimientos" },
  },
  {
    id: "integracion-eas-recordatorio",
    mazo: "calendario",
    titulo: "Recordatorio de integración",
    situacion: "Te acordás del saldo de capital que falta integrar.",
    base: "Ley 6480/2020, art. 10.",
    aviso: "legal",
    condicion: { tipos: ["eas"], soloProgramada: true },
    opciones: [
      {
        texto: "Integro el saldo",
        efectos: { cajaPersonal: -5_000_000, cajaEmpresa: 5_000_000, cumplimiento: 5 },
        explicacion: "Integrado a tiempo, dentro de los 2 años que marca la ley.",
      },
      { texto: "Todavía no", efectos: { cumplimiento: -5, riesgo: 3 }, explicacion: "Cuanto más se acerca el plazo, menos margen queda." },
    ],
  },

  // Calendario societario (ejercicio que cierra en diciembre)
  {
    id: "cierre-ejercicio",
    mazo: "calendario",
    titulo: "Cerró el ejercicio",
    situacion: "Cerró el año. El contador necesita los papeles para armar el balance.",
    base: "Código Civil, art. 1079 (asamblea ordinaria dentro de los 4 meses del cierre).",
    aviso: "legal",
    condicion: { tipos: SOCIEDADES, meses: [1] },
    fija: true,
    opciones: [
      {
        texto: "Le paso todo ordenado en enero",
        efectos: { cumplimiento: 5 },
        explicacion: "Con el balance a tiempo, la asamblea se hace dentro de los 4 meses del cierre (Código Civil, art. 1079).",
      },
      {
        texto: "En marzo lo vemos",
        efectos: { cumplimiento: -5 },
        programa: [{ tarjeta: "balance-apurado", enMeses: 2 }],
        explicacion: "Si el balance llega tarde, toda la cadena de la asamblea se aprieta.",
      },
    ],
    hacelo: { app: "empresas", ruta: "/vencimientos", texto: "Generá el calendario de tu empresa en NODOS Empresas" },
  },
  {
    id: "balance-apurado",
    mazo: "calendario",
    titulo: "El balance no llega",
    situacion: "Falta poco para la asamblea y el balance no está.",
    base: "Código Civil, art. 1079; Ley 1034/83 (documentación a disposición antes de la asamblea).",
    aviso: "legal",
    condicion: { tipos: SOCIEDADES, soloProgramada: true },
    opciones: [
      { texto: "Le pago urgencia al contador", efectos: { cajaEmpresa: -1_500_000 }, explicacion: "Apurar cuesta: la próxima, los papeles en enero." },
      {
        texto: "Hago la asamblea sin balance",
        efectos: { cumplimiento: -15, riesgo: 5 },
        explicacion: "La asamblea ordinaria aprueba justamente el balance: sin él, no cumple su función.",
      },
    ],
  },
  {
    id: "convocatoria-sa",
    mazo: "calendario",
    titulo: "Convocar la asamblea",
    situacion: "Hay que convocar la asamblea ordinaria antes de fin de abril.",
    base: "Código Civil, arts. 1082 y 1084.",
    aviso: "legal",
    condicion: { tipos: ["sa"], meses: [3] },
    fija: true,
    opciones: [
      {
        texto: "Publico el edicto 5 días, con 10 a 30 días de anticipación",
        efectos: { cajaEmpresa: -800_000, cumplimiento: 5 },
        explicacion: "Así se convoca en la S.A. (Código Civil, art. 1082). Los accionistas avisan su asistencia 3 días hábiles antes (art. 1084).",
      },
      {
        texto: "Aviso a los socios por WhatsApp y listo",
        efectos: { cumplimiento: -10, riesgo: 5 },
        marca: ["asamblea-irregular"],
        explicacion: "Una convocatoria que no sigue la forma legal deja la asamblea expuesta a ser cuestionada.",
      },
    ],
    hacelo: { app: "empresas", ruta: "/documentos", texto: "Generá el edicto y el acta en NODOS Empresas" },
  },
  {
    id: "asamblea-ordinaria",
    mazo: "calendario",
    titulo: "La asamblea y las utilidades",
    situacion: "En la asamblea se aprueba el balance: hubo Gs. 20.000.000 de utilidad. ¿Qué se hace con ella?",
    base: "Código Civil, arts. 1079 y 1096; Ley 6380/2019 (IDU: 8 % residentes, 15 % no residentes).",
    aviso: "legal",
    condicion: { tipos: SOCIEDADES, meses: [4] },
    fija: true,
    opciones: [
      {
        texto: "Repartir todo como dividendo",
        efectos: { dividendo: 20_000_000, cumplimiento: 3 },
        explicacion: "Al pagar dividendos, la sociedad retiene el IDU (8 % a residentes) y te llega tu parte neta. El acta se firma dentro de los 5 días (art. 1096).",
      },
      {
        texto: "Mitad dividendo, mitad reinvertir",
        efectos: { dividendo: 10_000_000, cumplimiento: 3 },
        explicacion: "Repartir una parte y dejar otra en la empresa equilibra lo que cobran los socios con lo que necesita el negocio.",
      },
      {
        texto: "Reinvertir todo en la empresa",
        efectos: { cumplimiento: 3 },
        explicacion: "La utilidad queda en la empresa y crece su caja. No hay IDU porque no se distribuye.",
      },
    ],
    hacelo: { app: "empresas", ruta: "/empresas", texto: "Distribuí utilidades a tus socios desde NODOS Empresas" },
  },
  {
    id: "siara-junio",
    mazo: "calendario",
    titulo: "Hasta el 30 de junio",
    situacion: "Vence la actualización anual de los datos de la empresa y sus beneficiarios finales.",
    base: "Ley 6446/2019; Decreto 3241/2020, art. 10 (actualización anual hasta el 30 de junio).",
    aviso: "legal",
    condicion: { tipos: SOCIEDADES, meses: [6] },
    fija: true,
    opciones: [
      {
        texto: "Reviso el libro de accionistas y actualizo",
        efectos: { cumplimiento: 8 },
        explicacion: "La actualización es anual aunque no haya cambios. Los umbrales son 10 % del capital o más del 25 % de los votos.",
      },
      {
        texto: "No cambió nada, no hago nada",
        efectos: { cumplimiento: -10, riesgo: 5 },
        explicacion: "La actualización anual se hace igual: no depende de que haya cambios.",
      },
    ],
    hacelo: { app: "empresas", ruta: "/empresas", texto: "Prepará el SIARA en NODOS Empresas" },
  },
  {
    id: "regimen-crece",
    mazo: "negocio",
    titulo: "Vendiste mucho más",
    situacion: "Tu negocio facturó bastante más que el año pasado.",
    base: "Ley 6380/2019 (IRE RESIMPLE, IRE Simple e IRE General, según los ingresos).",
    aviso: "legal",
    condicion: { tipos: ["unipersonal"] },
    opciones: [
      {
        texto: "Le consulto al contador si cambia mi régimen de IRE",
        efectos: { cumplimiento: 5 },
        explicacion: "El régimen de IRE depende de los ingresos: al crecer, puede corresponder otro. Conviene revisarlo a tiempo.",
      },
      { texto: "Sigo igual", efectos: { riesgo: 5 }, explicacion: "Quedarse en un régimen que ya no corresponde trae diferencias a pagar después." },
    ],
  },

  {
    id: "insumos-suben",
    mazo: "negocio",
    repetible: true,
    titulo: "Subieron los insumos",
    situacion: "Tus proveedores subieron los precios un 15 % este mes.",
    base: "Educación financiera general.",
    aviso: "ninguno",
    opciones: [
      {
        texto: "Ajusto mis precios y se lo explico a mis clientes",
        efectos: { cajaEmpresa: 500_000 },
        explicacion: "Trasladar un aumento de costos, explicado a tiempo, cuida el margen sin sorprender a nadie.",
      },
      {
        texto: "Absorbo el aumento",
        efectos: { cajaEmpresa: -1_200_000 },
        explicacion: "Absorber un mes puede servir, pero sostenerlo en el tiempo se come la ganancia.",
      },
      {
        texto: "Bajo la calidad para mantener el precio",
        efectos: { cajaEmpresa: 300_000, riesgo: 4 },
        explicacion: "Ahorrar en calidad sin avisar arriesga a los clientes que ya tenés.",
      },
    ],
  },
  {
    id: "proveedor-sin-factura",
    mazo: "negocio",
    titulo: "Más barato sin factura",
    situacion: "Un proveedor te ofrece un 10 % menos si le comprás sin factura.",
    base: "Ley 6380/2019 (comprobantes de venta).",
    aviso: "legal",
    opciones: [
      {
        texto: "Le pido la factura igual",
        efectos: { cumplimiento: 4 },
        explicacion: "La factura respalda tu gasto ante la administración tributaria y te protege si hay un problema con la compra.",
      },
      {
        texto: "Acepto el descuento",
        efectos: { cajaEmpresa: 300_000, cumplimiento: -6, riesgo: 6 },
        explicacion: "Un gasto sin comprobante no se puede respaldar y te deja expuesto.",
      },
    ],
  },
  {
    id: "cuenta-negocio",
    mazo: "negocio",
    titulo: "Una cuenta solo para el negocio",
    situacion: "El banco te ofrece abrir una cuenta solo para el negocio.",
    base: "Educación financiera y contable general.",
    aviso: "ninguno",
    condicion: { tipos: ["unipersonal"] },
    opciones: [
      {
        texto: "La abro y paso ahí todo lo del negocio",
        efectos: { cajaEmpresa: -50_000, riesgo: -5 },
        quita: ["mezclo-cajas"],
        explicacion: "Una cuenta propia del negocio es la forma más simple de no mezclar las cajas.",
      },
      { texto: "Sigo con mi cuenta personal", efectos: { riesgo: 3 }, explicacion: "Con una sola cuenta, separar lo personal de lo del negocio depende solo de tu orden." },
    ],
    hacelo: { app: "finanzas", ruta: "/movimientos", texto: "Creá el espacio de tu negocio en Movimientos" },
  },
  {
    id: "seguro",
    mazo: "plata",
    repetible: true,
    titulo: "Un seguro",
    situacion: "Te ofrecen un seguro para tu casa y el local por Gs. 300.000 por mes.",
    base: "Educación financiera general.",
    aviso: "inversion",
    opciones: [
      {
        texto: "Comparo coberturas y contrato el que me cubre lo importante",
        efectos: { cajaPersonal: -300_000, riesgo: -4 },
        explicacion: "Un seguro convierte una pérdida grande e incierta en un costo chico y fijo. Leé qué cubre y qué no.",
      },
      { texto: "No por ahora", efectos: { riesgo: 2 }, explicacion: "Sin seguro, un imprevisto grande sale todo de tu bolsillo." },
    ],
  },
  {
    id: "capacitacion",
    mazo: "negocio",
    titulo: "Un curso de gestión",
    situacion: "Hay un curso de gestión para pequeños negocios por Gs. 1.500.000.",
    base: "Educación financiera general.",
    aviso: "ninguno",
    opciones: [
      {
        texto: "Lo hago",
        efectos: { cajaEmpresa: -1_500_000, cumplimiento: 4, riesgo: -2 },
        explicacion: "Aprender a leer tus números y tus obligaciones se paga solo si lo aplicás.",
      },
      { texto: "Ahora no", efectos: {}, explicacion: "También se puede aprender con práctica: como esta." },
    ],
  },

  // Cumplimiento (sujetos obligados)
  {
    id: "soy-sujeto-obligado",
    mazo: "cumplimiento",
    titulo: "¿Soy sujeto obligado?",
    situacion: "Tu empresa empezó a comprar y vender inmuebles de forma habitual, aunque no es su actividad principal.",
    base: "Ley 1015/97, art. 13; Res. SEPRELAD 201/2020, art. 1.",
    aviso: "legal",
    condicion: { sujetoObligado: true },
    opciones: [
      {
        texto: "Me inscribo y designo un oficial de cumplimiento",
        efectos: { cumplimiento: 10, riesgo: -5 },
        explicacion: "La compra-venta habitual de inmuebles hace sujeto obligado aunque sea actividad secundaria y sin importar el monto (Res. 201/2020, art. 1).",
      },
      {
        texto: "Es secundario: no me aplica",
        efectos: { cumplimiento: -15, riesgo: 10 },
        explicacion: "Que sea secundario no te excluye: lo que cuenta es la habitualidad.",
      },
    ],
    hacelo: { app: "empresas", ruta: "/cumplimiento", texto: "Revisá tu perfil SEPRELAD en NODOS Empresas" },
  },
  {
    id: "cliente-pep",
    repetible: true,
    mazo: "cumplimiento",
    titulo: "Un comprador es funcionario",
    situacion: "Un comprador es un funcionario público de alto rango.",
    base: "Res. SEPRELAD 201/2020, art. 24 (régimen ampliado de debida diligencia).",
    aviso: "legal",
    condicion: { sujetoObligado: true },
    opciones: [
      {
        texto: "Aplico debida diligencia ampliada y más controles",
        efectos: { cumplimiento: 8, riesgo: -5 },
        explicacion: "A las personas expuestas políticamente (PEP) se les aplica siempre el régimen ampliado (Res. 201/2020, art. 24).",
      },
      {
        texto: "Lo trato como a cualquier cliente",
        efectos: { cumplimiento: -8, riesgo: 12 },
        explicacion: "Con un PEP, el régimen general no alcanza: la norma exige el ampliado.",
      },
    ],
  },
  {
    id: "cliente-no-residente",
    repetible: true,
    mazo: "cumplimiento",
    titulo: "Un comprador que vive afuera",
    situacion: "Un comprador vive en el exterior y opera a distancia.",
    base: "Res. SEPRELAD 201/2020, art. 24, inc. 1.",
    aviso: "legal",
    condicion: { sujetoObligado: true },
    opciones: [
      {
        texto: "Aplico el régimen ampliado",
        efectos: { cumplimiento: 5, riesgo: -3 },
        explicacion: "Los clientes no residentes van siempre por el régimen ampliado de debida diligencia (art. 24, inc. 1).",
      },
      { texto: "Lo atiendo como a cualquiera", efectos: { riesgo: 8 }, explicacion: "No aplicar el régimen que corresponde es un incumplimiento." },
    ],
  },
  {
    id: "beneficiario-final-cliente",
    repetible: true,
    mazo: "cumplimiento",
    titulo: "¿Quiénes son los dueños?",
    situacion: "Una empresa quiere comprarte un terreno y no quiere decir quiénes son sus dueños.",
    base: "Res. SEPRELAD 202/2020 (constancia de beneficiarios finales del cliente).",
    aviso: "legal",
    condicion: { sujetoObligado: true },
    opciones: [
      {
        texto: "Pido la constancia de sus beneficiarios finales",
        efectos: { cumplimiento: 5, riesgo: -3 },
        explicacion: "Conocer al beneficiario final del cliente es parte de la debida diligencia (Res. 202/2020).",
      },
      { texto: "No pregunto: el que paga es la empresa", efectos: { riesgo: 8 }, explicacion: "Sin saber quién está detrás, no sabés con quién operás." },
    ],
  },
  {
    id: "efectivo-alto",
    repetible: true,
    mazo: "cumplimiento",
    titulo: "Pago en efectivo",
    situacion: "Un cliente quiere pagar un terreno con mucho efectivo y no explica de dónde sale.",
    base: "Res. SEPRELAD 201/2020, arts. 29 (monitoreo) y 33.",
    aviso: "legal",
    condicion: { sujetoObligado: true },
    opciones: [
      {
        texto: "Pido documentos del origen y analizo la operación como inusual",
        efectos: { cumplimiento: 5, riesgo: -5 },
        programa: [{ tarjeta: "inusual-analisis", enMeses: 1 }],
        explicacion: "Una operación que no tiene explicación se analiza: pedir el origen de los fondos es parte de ese análisis.",
      },
      {
        texto: "Acepto: la plata es plata",
        efectos: { riesgo: 15 },
        programa: [{ tarjeta: "seprelad-inspeccion", enMeses: 4 }],
        explicacion: "Aceptar sin preguntar te expone a ser usado para lavar dinero.",
      },
    ],
  },
  {
    id: "inusual-analisis",
    mazo: "cumplimiento",
    titulo: "No justifica el origen",
    situacion: "El cliente no pudo justificar el origen del efectivo.",
    base: "Res. SEPRELAD 201/2020, arts. 33 y 36.",
    aviso: "legal",
    condicion: { sujetoObligado: true, soloProgramada: true },
    opciones: [
      {
        texto: "La califico como sospechosa y envío el ROS dentro de las 24 horas",
        efectos: { cumplimiento: 10, riesgo: -5 },
        explicacion: "Si el análisis no encuentra justificación, la operación se reporta a la SEPRELAD dentro de las 24 horas de calificarla (art. 33).",
      },
      {
        texto: "Le aviso al cliente que lo voy a reportar",
        efectos: { cumplimiento: -20, riesgo: 15 },
        explicacion: "Está prohibido revelar que se envió o se va a enviar un ROS (art. 36, confidencialidad).",
      },
    ],
  },
  {
    id: "seprelad-inspeccion",
    mazo: "cumplimiento",
    titulo: "Revisan tus legajos",
    situacion: "La SEPRELAD revisa cómo conocés a tus clientes y encuentra una operación grande en efectivo sin análisis.",
    base: "Ley 1015/97; Res. SEPRELAD 201/2020.",
    aviso: "legal",
    condicion: { sujetoObligado: true, soloProgramada: true },
    opciones: [
      {
        texto: "Corrijo los procedimientos",
        efectos: { cumplimiento: -10, riesgo: 5 },
        explicacion: "Corregir es obligatorio, pero lo que ya pasó queda. Lo que no se analizó a tiempo no se arregla después. (Caso ficticio.)",
      },
    ],
  },
  {
    id: "ro-trimestral",
    mazo: "cumplimiento",
    titulo: "Toca el Reporte de Operaciones",
    situacion: "Cerró el trimestre y hay que preparar el Reporte de Operaciones (RO).",
    base: "Res. SEPRELAD 201/2020, art. 31 (registro de todas las operaciones).",
    aviso: "legal",
    condicion: { sujetoObligado: true, meses: TRIMESTRE },
    fija: true,
    opciones: [
      {
        texto: "Cargo todas las operaciones, sin importar el monto",
        efectos: { cumplimiento: 8 },
        explicacion: "El registro abarca todas las operaciones, independientemente del monto y sin excepción (art. 31).",
      },
      {
        texto: "Solo cargo las grandes",
        efectos: { cumplimiento: -10, riesgo: 8 },
        explicacion: "Dejar afuera las chicas es un incumplimiento: la norma no pone un mínimo.",
      },
    ],
    hacelo: { app: "empresas", ruta: "/cumplimiento/ro", texto: "Generá el RO en NODOS Empresas" },
  },
  {
    id: "reporte-negativo",
    mazo: "cumplimiento",
    titulo: "Sin operaciones sospechosas",
    situacion: "En los tres meses del trimestre no reportaste ninguna operación sospechosa.",
    base: "Res. SEPRELAD 201/2020, art. 37 (reporte negativo).",
    aviso: "legal",
    condicion: { sujetoObligado: true, meses: TRIMESTRE },
    fija: true,
    opciones: [
      {
        texto: "Envío el reporte negativo dentro de los 10 días hábiles",
        efectos: { cumplimiento: 5 },
        explicacion: "Si en 3 meses consecutivos no hubo ROS, se informa dentro de los 10 días hábiles de terminado el trimestre (art. 37).",
      },
      {
        texto: "Si no hubo nada, no envío nada",
        efectos: { cumplimiento: -10 },
        explicacion: "No haber detectado operaciones sospechosas también se reporta.",
      },
    ],
  },
  {
    id: "conservar-legajos",
    mazo: "cumplimiento",
    titulo: "Papeles viejos",
    situacion: "Querés tirar los legajos de clientes con los que terminaste hace 3 años.",
    base: "Res. SEPRELAD 201/2020, art. 32 (conservación por 5 años).",
    aviso: "legal",
    condicion: { sujetoObligado: true },
    opciones: [
      {
        texto: "Los conservo: son 5 años",
        efectos: { cumplimiento: 5 },
        explicacion: "La información de los clientes se conserva 5 años desde que termina la relación comercial (art. 32).",
      },
      { texto: "Los tiro: ya no son clientes", efectos: { cumplimiento: -10, riesgo: 5 }, explicacion: "Tirarlos antes de los 5 años es un incumplimiento." },
    ],
    hacelo: { app: "empresas", ruta: "/empresas", texto: "Guardá tus documentos en el Archivo de NODOS Empresas" },
  },
  {
    id: "lista-onu",
    mazo: "cumplimiento",
    titulo: "Un nombre en una lista",
    situacion: "Al revisar a un cliente, aparece en una lista del Consejo de Seguridad de las Naciones Unidas.",
    base: "Res. SEPRELAD 201/2020, art. 38 (inmovilización de fondos y activos).",
    aviso: "legal",
    condicion: { sujetoObligado: true },
    opciones: [
      {
        texto: "Inmovilizo los fondos y lo comunico de inmediato",
        efectos: { cumplimiento: 10, riesgo: -5 },
        explicacion: "Ante personas incluidas en esas listas, se comunica e inmoviliza inmediatamente y sin demora (art. 38).",
      },
      {
        texto: "Sigo con la operación y lo reviso después",
        efectos: { cumplimiento: -20, riesgo: 20 },
        explicacion: "Acá no hay margen: la norma pide actuar de inmediato.",
      },
    ],
  },
];

// ── Misiones incluidas ─────────────────────────────────────────────────────
export const MISIONES: Mision[] = [
  { id: "m-presupuesto", ruta: "mi-plata", orden: 1, titulo: "Presupuesto del mes", descripcion: "Qué hacer primero cuando cobrás.", tarjetas: ["presupuesto-sueldo", "prestamo-amigo"], gratis: true, tipo: "unipersonal", personaje: "emprendedor", sujetoObligado: false },
  { id: "m-emergencia", ruta: "mi-plata", orden: 2, titulo: "Fondo de emergencia", descripcion: "Un imprevisto y de dónde sale la plata.", tarjetas: ["fondo-emergencia", "dolar-sube"], gratis: true, tipo: "unipersonal", personaje: "emprendedor", sujetoObligado: false },
  { id: "m-deudas", ruta: "mi-plata", orden: 3, titulo: "Deudas y tarjeta", descripcion: "El pago mínimo y cómo salir de una deuda cara.", tarjetas: ["interes-tarjeta"], gratis: true, tipo: "unipersonal", personaje: "emprendedor", sujetoObligado: false },
  { id: "m-inversion", ruta: "mi-plata", orden: 4, titulo: "Primera inversión y riesgo", descripcion: "Plazo fijo, diversificación y promesas demasiado buenas.", tarjetas: ["primera-inversion", "oferta-demasiado-buena"], gratis: false, tipo: "unipersonal", personaje: "emprendedor", sujetoObligado: false },
  { id: "m-patrimonio", ruta: "mi-plata", orden: 5, titulo: "Patrimonio neto", descripcion: "Cuánto tenés de verdad.", tarjetas: ["patrimonio-neto", "dolar-sube"], gratis: false, tipo: "unipersonal", personaje: "heredero", sujetoObligado: false },
  { id: "m-tipo", ruta: "ser-empresario", orden: 1, titulo: "Elegir el tipo de empresa", descripcion: "Unipersonal, EAS o S.R.L.", tarjetas: ["elegir-tipo"], gratis: true, tipo: "unipersonal", personaje: "independiente", sujetoObligado: false },
  { id: "m-cajas", ruta: "ser-empresario", orden: 2, titulo: "Separar cajas", descripcion: "Lo del negocio y lo tuyo, por separado.", tarjetas: ["separar-cajas", "retiro-dueno"], gratis: true, tipo: "unipersonal", personaje: "independiente", sujetoObligado: false },
  { id: "m-facturar", ruta: "ser-empresario", orden: 3, titulo: "Facturar y cobrar", descripcion: "Comprobantes, anticipos y clientes que no pagan.", tarjetas: ["facturar", "cliente-grande"], gratis: true, tipo: "unipersonal", personaje: "independiente", sujetoObligado: false },
  { id: "m-aporte", ruta: "ser-empresario", orden: 4, titulo: "Aporte y capital", descripcion: "Aportar, prestar o poner sin papeles.", tarjetas: ["aporte-capital", "integracion-eas"], gratis: false, tipo: "eas", personaje: "emprendedor", sujetoObligado: false },
  { id: "m-cierre", ruta: "ser-empresario", orden: 5, titulo: "Cierre del ejercicio y asamblea", descripcion: "Balance, convocatoria y beneficiarios finales.", tarjetas: ["cierre-ejercicio", "convocatoria-sa", "siara-junio"], gratis: false, tipo: "sa", personaje: "heredero", sujetoObligado: false },
  { id: "m-utilidades", ruta: "ser-empresario", orden: 6, titulo: "Repartir utilidades con IDU", descripcion: "Dividendos, reinversión y un socio que se va.", tarjetas: ["asamblea-ordinaria", "socio-sale"], gratis: false, tipo: "sa", personaje: "heredero", sujetoObligado: false },
  { id: "m-sujeto", ruta: "cumplimiento", orden: 1, titulo: "¿Soy sujeto obligado?", descripcion: "Cuándo te alcanza la SEPRELAD.", tarjetas: ["soy-sujeto-obligado"], gratis: true, tipo: "srl", personaje: "emprendedor", sujetoObligado: true },
  { id: "m-cliente", ruta: "cumplimiento", orden: 2, titulo: "Conocer al cliente", descripcion: "PEP, no residentes y beneficiarios finales del cliente.", tarjetas: ["cliente-pep", "beneficiario-final-cliente"], gratis: true, tipo: "srl", personaje: "emprendedor", sujetoObligado: true },
  { id: "m-bf", ruta: "cumplimiento", orden: 3, titulo: "Beneficiarios finales y SIARA", descripcion: "La actualización de junio y los cambios en el año.", tarjetas: ["siara-junio", "bf-cambio"], gratis: false, tipo: "sa", personaje: "heredero", sujetoObligado: true },
  { id: "m-ro", ruta: "cumplimiento", orden: 4, titulo: "Registro de operaciones y RO", descripcion: "El RO, el reporte negativo y los legajos.", tarjetas: ["ro-trimestral", "reporte-negativo", "conservar-legajos"], gratis: false, tipo: "srl", personaje: "emprendedor", sujetoObligado: true },
  { id: "m-alertas", ruta: "cumplimiento", orden: 5, titulo: "Señales de alerta", descripcion: "Efectivo sin explicación, listas internacionales y clientes de afuera.", tarjetas: ["efectivo-alto", "lista-onu", "cliente-no-residente"], gratis: false, tipo: "srl", personaje: "emprendedor", sujetoObligado: true },
];

// ── Validación (también la usa el Panel antes de guardar) ─────────────────
const MAZOS: Mazo[] = ["plata", "inversiones", "negocio", "calendario", "cumplimiento"];
const TIPOS: TipoEmpresaJuego[] = ["unipersonal", "eas", "srl", "sa"];
const AVISOS: Aviso[] = ["inversion", "legal", "ninguno"];
const RUTAS_IDS: Ruta[] = ["mi-plata", "ser-empresario", "cumplimiento"];
const PERSONAJES_IDS: PersonajeId[] = ["independiente", "emprendedor", "heredero"];
export const ID_CONTENIDO = /^[a-z0-9-]{3,60}$/;
const CLAVES_EFECTO: (keyof Efectos)[] = ["cajaPersonal", "cajaEmpresa", "inversiones", "cumplimiento", "riesgo", "dividendo"];
const MARCA = /^[a-z0-9-]{2,40}$/;

function texto(v: unknown, min: number, max: number): v is string {
  return typeof v === "string" && v.trim().length >= min && v.trim().length <= max;
}

/** Devuelve la lista de problemas (vacía si la tarjeta es válida). */
export function validarTarjeta(t: unknown): string[] {
  const e: string[] = [];
  const x = t as Partial<Tarjeta> | null;
  if (!x || typeof x !== "object") return ["La tarjeta no tiene el formato esperado."];
  if (!x.id || !ID_CONTENIDO.test(x.id)) e.push("El id tiene que tener entre 3 y 60 caracteres: minúsculas, números y guiones.");
  if (!x.mazo || !MAZOS.includes(x.mazo)) e.push("Elegí un mazo válido.");
  if (!texto(x.titulo, 3, 80)) e.push("El título tiene que tener entre 3 y 80 caracteres.");
  if (!texto(x.situacion, 10, 400)) e.push("La situación tiene que tener entre 10 y 400 caracteres.");
  if (!texto(x.base, 3, 200)) e.push("La base normativa o fuente es obligatoria (hasta 200 caracteres).");
  if (!x.aviso || !AVISOS.includes(x.aviso)) e.push("Elegí el aviso que corresponde.");
  if (!Array.isArray(x.opciones) || x.opciones.length < 1 || x.opciones.length > 3) e.push("La tarjeta necesita de 1 a 3 opciones.");
  else
    x.opciones.forEach((o, i) => {
      const n = i + 1;
      if (!texto(o?.texto, 2, 120)) e.push(`Opción ${n}: el texto tiene que tener entre 2 y 120 caracteres.`);
      if (!texto(o?.explicacion, 10, 400)) e.push(`Opción ${n}: la explicación tiene que tener entre 10 y 400 caracteres.`);
      const ef = o?.efectos;
      if (!ef || typeof ef !== "object") e.push(`Opción ${n}: faltan los efectos.`);
      else
        for (const [k, v] of Object.entries(ef)) {
          if (!CLAVES_EFECTO.includes(k as keyof Efectos)) e.push(`Opción ${n}: efecto desconocido "${k}".`);
          else if (typeof v !== "number" || !Number.isFinite(v) || Math.abs(v) > 1e10) e.push(`Opción ${n}: el efecto "${k}" tiene que ser un número.`);
          else if ((k === "cumplimiento" || k === "riesgo") && Math.abs(v) > 50) e.push(`Opción ${n}: "${k}" va de −50 a 50 puntos.`);
          else if (k === "dividendo" && v < 0) e.push(`Opción ${n}: el dividendo no puede ser negativo.`);
        }
      for (const m of [...(o?.marca ?? []), ...(o?.quita ?? [])]) if (!MARCA.test(m)) e.push(`Opción ${n}: marca inválida "${m}".`);
      for (const p of o?.programa ?? []) {
        if (!p || !ID_CONTENIDO.test(p.tarjeta)) e.push(`Opción ${n}: la tarjeta programada tiene un id inválido.`);
        if (!Number.isInteger(p?.enMeses) || p.enMeses < 1 || p.enMeses > 11) e.push(`Opción ${n}: "enMeses" va de 1 a 11.`);
      }
    });
  const c = x.condicion;
  if (c) {
    if (c.tipos && (!Array.isArray(c.tipos) || c.tipos.some((t2) => !TIPOS.includes(t2)))) e.push("Condición: tipos de empresa inválidos.");
    if (c.meses && (!Array.isArray(c.meses) || c.meses.some((m) => !Number.isInteger(m) || m < 1 || m > 12))) e.push("Condición: los meses van de 1 a 12.");
    if (c.requiere !== undefined && !MARCA.test(c.requiere)) e.push("Condición: marca requerida inválida.");
    if (c.excluye !== undefined && !MARCA.test(c.excluye)) e.push("Condición: marca excluida inválida.");
    if (c.soloProgramada !== undefined && typeof c.soloProgramada !== "boolean") e.push("Condición: soloProgramada es sí o no.");
    if (c.soloMision !== undefined && typeof c.soloMision !== "boolean") e.push("Condición: soloMision es sí o no.");
  }
  if (x.repetible !== undefined && typeof x.repetible !== "boolean") e.push("\"Repetible\" es sí o no.");
  if (x.fija && !c?.meses?.length) e.push("Una tarjeta fija necesita al menos un mes.");
  if (x.hacelo) {
    if (x.hacelo.app !== "finanzas" && x.hacelo.app !== "empresas") e.push("\"Hacelo de verdad\": la app tiene que ser finanzas o empresas.");
    if (typeof x.hacelo.ruta !== "string" || !/^\/[a-z0-9/_-]*$/.test(x.hacelo.ruta)) e.push("\"Hacelo de verdad\": la ruta tiene que empezar con / (sin dominio).");
    if (!texto(x.hacelo.texto, 3, 80)) e.push("\"Hacelo de verdad\": el texto tiene que tener entre 3 y 80 caracteres.");
  }
  return e;
}

export function validarMision(m: unknown, idsTarjetas: Set<string>): string[] {
  const e: string[] = [];
  const x = m as Partial<Mision> | null;
  if (!x || typeof x !== "object") return ["La misión no tiene el formato esperado."];
  if (!x.id || !ID_CONTENIDO.test(x.id)) e.push("El id tiene que tener entre 3 y 60 caracteres: minúsculas, números y guiones.");
  if (!x.ruta || !RUTAS_IDS.includes(x.ruta)) e.push("Elegí una ruta válida.");
  if (!Number.isInteger(x.orden) || (x.orden as number) < 1 || (x.orden as number) > 99) e.push("El orden va de 1 a 99.");
  if (!texto(x.titulo, 3, 80)) e.push("El título tiene que tener entre 3 y 80 caracteres.");
  if (!texto(x.descripcion, 3, 200)) e.push("La descripción tiene que tener entre 3 y 200 caracteres.");
  if (!Array.isArray(x.tarjetas) || x.tarjetas.length < 1 || x.tarjetas.length > 8) e.push("La misión necesita de 1 a 8 tarjetas.");
  else for (const t of x.tarjetas) if (!idsTarjetas.has(t)) e.push(`La tarjeta "${t}" no existe.`);
  if (typeof x.gratis !== "boolean") e.push("Indicá si la misión es gratis.");
  if (!x.tipo || !TIPOS.includes(x.tipo)) e.push("Elegí el tipo de empresa de la misión.");
  if (!x.personaje || !PERSONAJES_IDS.includes(x.personaje)) e.push("Elegí el personaje de la misión.");
  if (typeof x.sujetoObligado !== "boolean") e.push("Indicá si la empresa de la misión es sujeto obligado.");
  return e;
}

export interface FilaContenido {
  id: string;
  tipo: "tarjeta" | "mision";
  datos: unknown;
  estado: "borrador" | "revisado" | "publicado";
}

/**
 * Contenido final: lo incluido en el código más lo publicado desde el Panel
 * (una fila con el mismo id reemplaza la tarjeta o misión incluida). Lo que
 * no pasa la validación se ignora, para que un error de carga no rompa el juego.
 */
export function mezclarContenido(filas: FilaContenido[]): { tarjetas: Map<string, Tarjeta>; misiones: Mision[] } {
  const tarjetas = new Map(TARJETAS.map((t) => [t.id, t]));
  for (const f of filas) {
    if (f.tipo !== "tarjeta" || f.estado !== "publicado") continue;
    const t = { ...(f.datos as Tarjeta), id: f.id };
    if (validarTarjeta(t).length === 0) tarjetas.set(f.id, t);
  }
  const ids = new Set(tarjetas.keys());
  const misiones = new Map(MISIONES.map((m) => [m.id, m]));
  for (const f of filas) {
    if (f.tipo !== "mision" || f.estado !== "publicado") continue;
    const m = { ...(f.datos as Mision), id: f.id };
    if (validarMision(m, ids).length === 0) misiones.set(f.id, m);
  }
  return { tarjetas, misiones: Array.from(misiones.values()).sort((a, b) => a.ruta.localeCompare(b.ruta) || a.orden - b.orden) };
}
