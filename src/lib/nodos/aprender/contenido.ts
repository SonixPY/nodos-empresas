/**
 * Contenido incluido de la Carrera: situaciones, lecciones de NODO y casos
 * reales. El Panel puede agregar o reemplazar cualquiera (misma id) desde
 * `aprender_contenido`; solo lo publicado llega a los jugadores.
 *
 * Montos pensados para el arranque "normal" (sueldo Gs. 3.500.000).
 * Contenido educativo: no es asesoría de inversión ni asesoramiento legal.
 */
import type { CasoReal, Contenido, Situacion } from "./tipos";

export const AVISO_TEXTO = {
  inversion: "Contenido educativo con datos ficticios. No constituye asesoría de inversión.",
  legal: "Contenido educativo con casos ficticios. No constituye asesoramiento legal para tu caso.",
} as const;

export const CASOS: CasoReal[] = [
  {
    id: "terra-luna-2022",
    titulo: "La caída de UST y LUNA",
    fecha: "2022-05",
    resumen:
      "En mayo de 2022, UST, una stablecoin algorítmica que prometía valer siempre un dólar, perdió su paridad. LUNA, el token que la sostenía, perdió casi todo su valor en pocos días. Muchos ahorristas habían entrado atraídos por un rendimiento cercano al 20 % anual, y muchos compraron más durante la caída.",
    fuente: "SEC v. Terraform Labs (demanda presentada en febrero de 2023, Distrito Sur de Nueva York).",
    verificado: false,
  },
  {
    id: "ftx-2022",
    titulo: "La quiebra de FTX",
    fecha: "2022-11",
    resumen:
      "En noviembre de 2022, FTX, uno de los exchanges de cripto más grandes del mundo, frenó los retiros de sus clientes y se presentó en quiebra en pocos días. Quienes tenían sus cripto en la plataforma quedaron como acreedores en el proceso de quiebra.",
    fuente: "Expediente de quiebra de FTX Trading Ltd. (Capítulo 11, Tribunal de Quiebras de Delaware, noviembre de 2022).",
    verificado: false,
  },
];

export const SITUACIONES: Situacion[] = [
  // ── Etapa 1: empleado ─────────────────────────────────────────────────
  {
    id: "sueldo-ahorro",
    dia: 30,
    tipo: "situacion",
    titulo: "Llegó el sueldo",
    postit: "Cobré. ¿Separo algo para ahorrar?",
    texto: "Cobraste el sueldo del mes. Antes de gastar, decidís si separás una parte para la caja de ahorro.",
    repetible: true,
    peso: 2,
    porDefecto: "nada",
    aviso: "inversion",
    opciones: [
      {
        id: "diez",
        titulo: "Separo el 10 %",
        texto: "Pasás Gs. 350.000 a la caja de ahorro apenas cobrás.",
        efectos: { ahorro: 350_000 },
        resultado: "Separaste Gs. 350.000 antes de gastar.",
        nodo: "Ahorrar primero hace que el ahorro no dependa de lo que sobre. Es la forma más simple de que pase todos los meses.",
      },
      {
        id: "veinte",
        titulo: "Separo el 20 %",
        texto: "Pasás Gs. 700.000 a la caja de ahorro. Te queda más justo el mes.",
        efectos: { ahorro: 700_000 },
        resultado: "Separaste Gs. 700.000. El mes queda ajustado, pero tu colchón crece rápido.",
        nodo: "Un 20 % acelera el fondo de emergencia. Si después tenés que sacar del ahorro para llegar a fin de mes, bajá el porcentaje: lo importante es que se sostenga.",
      },
      {
        id: "nada",
        titulo: "Ahorro lo que sobre",
        texto: "Pagás todo y ves a fin de mes.",
        efectos: {},
        marca: ["sin-ahorro"],
        programa: [{ situacion: "gasto-hormiga", enMeses: 1 }],
        resultado: "A fin de mes no sobró nada para ahorrar.",
        nodo: "Lo que sobra a fin de mes suele ser poco o nada: los gastos chicos se comen el margen. Por eso conviene separar al cobrar.",
      },
    ],
    leccion: {
      id: "pagate-primero",
      titulo: "Pagate primero",
      reglas: [
        "Separá el ahorro el día que cobrás, no a fin de mes.",
        "Empezá con un porcentaje que puedas sostener, aunque sea chico.",
        "El primer objetivo es un fondo de emergencia de 3 meses de gastos.",
      ],
    },
  },
  {
    id: "gasto-hormiga",
    tipo: "situacion",
    titulo: "No quedó nada",
    postit: "Fin de mes y no sobró nada. ¿En qué se fue?",
    texto: "Revisás el extracto: suscripciones que no usás, delivery casi todos los días y compras chicas que no recordabas.",
    requisitos: { soloProgramada: true },
    porDefecto: "igual",
    aviso: "inversion",
    opciones: [
      {
        id: "recorto",
        titulo: "Corto lo que no uso",
        texto: "Cancelás dos suscripciones y ponés un tope al delivery.",
        efectos: { gastosFijos: -180_000 },
        quita: ["sin-ahorro"],
        resultado: "Tus gastos fijos bajaron Gs. 180.000 por mes.",
        nodo: "Los gastos que se repiten son los más caros: los pagás todos los meses sin decidirlo. Revisarlos una vez por trimestre libera plata sin esfuerzo.",
      },
      {
        id: "igual",
        titulo: "Sigo igual",
        texto: "Ya me voy a ordenar el mes que viene.",
        efectos: {},
        resultado: "El mes siguiente pasó lo mismo.",
        nodo: "Sin un cambio concreto, el mes que viene se repite. No hace falta un plan perfecto: alcanza con cortar uno o dos gastos que no usás.",
      },
    ],
    leccion: {
      id: "gastos-hormiga",
      titulo: "Los gastos que no ves",
      reglas: [
        "Mirá tus gastos que se repiten todos los meses: ahí está el margen.",
        "Un gasto chico por día es un gasto grande por año.",
        "Ponete topes simples (por ejemplo, delivery dos veces por semana).",
      ],
    },
  },
  {
    id: "imprevisto-celular",
    tipo: "situacion",
    titulo: "Se rompió el celular",
    postit: "Se me rompió el celular: Gs. 380.000 el arreglo.",
    texto: "El arreglo cuesta Gs. 380.000 y lo necesitás para trabajar.",
    repetible: true,
    porDefecto: "tarjeta",
    aviso: "inversion",
    opciones: [
      {
        id: "contado",
        titulo: "Lo pago con mi plata",
        texto: "Sale del efectivo y, si no alcanza, del ahorro.",
        efectos: { efectivo: -380_000 },
        resultado: "Pagaste Gs. 380.000 sin deber nada.",
        nodo: "Para esto sirve el fondo de emergencia: un imprevisto no se convierte en deuda. Después, reponé lo que sacaste.",
      },
      {
        id: "tarjeta",
        titulo: "Con la tarjeta",
        texto: "Lo pagás con la tarjeta y lo ves cuando venga el resumen.",
        efectos: { deudaTarjeta: 380_000 },
        resultado: "Debés Gs. 380.000 en la tarjeta.",
        nodo: "La tarjeta no es plata extra: es plata que vas a pagar después, y con intereses si no pagás el total. Sirve para emergencias si podés pagarla al mes siguiente.",
      },
    ],
    leccion: {
      id: "fondo-de-emergencia",
      titulo: "El fondo de emergencia",
      reglas: [
        "Los imprevistos no son raros: pasan varias veces por año.",
        "Con 3 meses de gastos ahorrados, un imprevisto no te endeuda.",
        "Si usás el fondo, reponelo antes de invertir.",
      ],
    },
  },
  {
    id: "tarjeta-cuota",
    dia: 15,
    tipo: "vencimiento",
    titulo: "Vence la tarjeta",
    postit: "Vence la tarjeta el 15. ¿Total o mínimo?",
    texto: "Llegó el resumen. Podés pagar el total o solo el mínimo; lo que no pagues genera intereses el mes que viene.",
    requisitos: { conDeudaTarjeta: true },
    repetible: true,
    porDefecto: "total",
    aviso: "inversion",
    opciones: [
      {
        id: "total",
        titulo: "Pago el total",
        texto: "Si te alcanza el efectivo, la tarjeta queda en cero.",
        efectos: {},
        quita: ["tarjeta-minimo"],
        resultado: "Pagaste lo que te alcanzó del total.",
        nodo: "Pagar el total es la única forma de usar la tarjeta sin pagar intereses.",
      },
      {
        id: "minimo",
        titulo: "Pago el mínimo",
        texto: "Pagás el 10 % y el resto queda para el mes que viene.",
        efectos: {},
        marca: ["tarjeta-minimo"],
        resultado: "Pagaste el mínimo. El resto sigue generando intereses.",
        nodo: "El pago mínimo te mantiene al día, pero el saldo crece con intereses todos los meses. Es la deuda más cara que vas a tener.",
      },
    ],
    leccion: {
      id: "tarjeta-de-credito",
      titulo: "La tarjeta y el pago mínimo",
      reglas: [
        "Usá la tarjeta solo por lo que podés pagar completo al mes siguiente.",
        "El pago mínimo evita la mora, no los intereses.",
        "Si tenés deuda de tarjeta, pagarla rinde más que cualquier inversión.",
      ],
    },
  },
  {
    id: "prestamo-facil",
    tipo: "oportunidad",
    titulo: "Un préstamo “aprobado en 5 minutos”",
    postit: "Me ofrecen Gs. 5.000.000 al toque, en 12 cuotas.",
    texto: "Te ofrecen Gs. 5.000.000 en 12 cuotas de Gs. 625.000, sin papeles. Justo pensabas en un viaje.",
    porDefecto: "no",
    aviso: "inversion",
    opciones: [
      {
        id: "viaje",
        titulo: "Lo tomo y me voy de viaje",
        texto: "Recibís 5.000.000 y los gastás en el viaje.",
        efectos: { prestamo: { monto: 5_000_000, cuota: 625_000, meses: 12 }, efectivo: -5_000_000 },
        resultado: "Durante 12 meses pagás Gs. 625.000: devolvés Gs. 7.500.000 por un préstamo de 5.000.000.",
        nodo: "Sumá todas las cuotas antes de firmar: 12 × 625.000 son 7.500.000. Pagaste 2.500.000 por adelantar un gusto que se podía ahorrar en unos meses.",
      },
      {
        id: "no",
        titulo: "No, gracias",
        texto: "Si quiero el viaje, lo ahorro.",
        efectos: {},
        resultado: "No tomaste el préstamo.",
        nodo: "Endeudarse para consumir casi siempre sale caro. Ahorrar unos meses para lo mismo te cuesta cero intereses.",
      },
    ],
    leccion: {
      id: "costo-de-un-prestamo",
      titulo: "Cuánto cuesta un préstamo de verdad",
      reglas: [
        "Mirá el total que vas a devolver, no solo la cuota.",
        "La facilidad para darte el préstamo no dice nada de lo que cuesta.",
        "Endeudate para algo que genere ingresos o te ahorre plata, no para gastos.",
      ],
    },
  },
  {
    id: "curso-capacitacion",
    tipo: "oportunidad",
    titulo: "Curso pagado a medias",
    postit: "Curso de capacitación: la empresa paga la mitad.",
    texto: "Tu empresa ofrece un curso: vos ponés Gs. 450.000 y menos tiempo libre durante unos meses. Al terminarlo podés pedir un aumento.",
    porDefecto: "no",
    aviso: "inversion",
    opciones: [
      {
        id: "si",
        titulo: "Lo hago",
        texto: "Pagás Gs. 450.000.",
        efectos: { efectivo: -450_000 },
        programa: [{ situacion: "pedir-aumento", enMeses: 3 }],
        resultado: "Terminaste el curso. En unos meses podés pedir un aumento.",
        nodo: "Invertir en lo que sabés suele ser la inversión con mejor retorno al principio de la carrera: sube tu ingreso, que es la base de todo lo demás.",
      },
      {
        id: "no",
        titulo: "Ahora no",
        texto: "Prefiero no gastar ni sumar horas.",
        efectos: {},
        resultado: "Seguís con el mismo sueldo.",
        nodo: "Está bien priorizar tu tiempo. Solo tené en cuenta que, al empezar, tu mayor activo es tu capacidad de generar ingresos.",
      },
    ],
    leccion: {
      id: "invertir-en-vos",
      titulo: "Invertir en vos",
      reglas: [
        "Al principio, subir tu ingreso pesa más que el rendimiento de tus ahorros.",
        "Medí una capacitación por lo que puede sumar a tu sueldo.",
        "Que la empresa pague una parte baja tu riesgo.",
      ],
    },
  },
  {
    id: "pedir-aumento",
    tipo: "oportunidad",
    titulo: "Momento de pedir un aumento",
    postit: "Terminé el curso. ¿Pido el aumento?",
    texto: "Terminaste el curso y tu jefe está conforme con tu trabajo.",
    requisitos: { soloProgramada: true },
    porDefecto: "no",
    aviso: "inversion",
    opciones: [
      {
        id: "pido",
        titulo: "Lo pido con argumentos",
        texto: "Llevás lo que aprendiste y lo que mejoró tu trabajo.",
        efectos: { sueldo: 450_000, reputacion: 5 },
        resultado: "Te subieron el sueldo Gs. 450.000 por mes.",
        nodo: "Un aumento se sostiene con argumentos concretos: qué hacés hoy que antes no hacías. Y ojo: si subís tus gastos al mismo ritmo, el aumento no se nota en tu ahorro.",
      },
      {
        id: "no",
        titulo: "Espero a que me lo ofrezcan",
        texto: "No quiero incomodar.",
        efectos: {},
        resultado: "No hubo aumento.",
        nodo: "Muchas veces el aumento no llega solo. Pedirlo con argumentos no es incomodar: es parte de manejar tu carrera.",
      },
    ],
    leccion: {
      id: "aumento-y-gastos",
      titulo: "Cuando sube el sueldo",
      reglas: [
        "Pedí un aumento con hechos concretos.",
        "Cuando te suben el sueldo, subí también el ahorro.",
        "Si los gastos crecen igual que el sueldo, nada cambia.",
      ],
    },
  },
  {
    id: "nivel-de-vida",
    tipo: "situacion",
    titulo: "Tus amigos suben de nivel",
    postit: "Todos se mudan, cambian el auto… ¿y yo?",
    texto: "Tus amigos se mudan a departamentos más caros y te invitan a planes más caros. Decidís tu nivel de gastos de los próximos meses.",
    peso: 0.6,
    porDefecto: "normal",
    aviso: "inversion",
    opciones: [
      {
        id: "austero",
        titulo: "Bajo un cambio",
        texto: "Salgo menos y elijo planes más baratos.",
        efectos: { nivelVida: "austero" },
        resultado: "Tu gasto variable bajó.",
        nodo: "Gastar menos que tu entorno no es quedarse atrás: es comprar libertad para más adelante.",
      },
      {
        id: "normal",
        titulo: "Sigo como estoy",
        texto: "Mantengo mi nivel de gastos.",
        efectos: { nivelVida: "normal" },
        resultado: "Tu gasto variable no cambió.",
        nodo: "Mantener tu nivel cuando el entorno sube ya es una buena decisión.",
      },
      {
        id: "alto",
        titulo: "Me pongo a la par",
        texto: "Si ellos pueden, yo también.",
        efectos: { nivelVida: "alto" },
        resultado: "Tu gasto variable se duplicó.",
        nodo: "Lo que ves de los demás es su gasto, no su ahorro ni sus deudas. Compararte con eso te hace gastar plata que no tenés.",
      },
    ],
    leccion: {
      id: "nivel-de-vida",
      titulo: "El nivel de vida",
      reglas: [
        "Tu gasto se decide, no se hereda del entorno.",
        "Lo que ves de otros es lo que gastan, no lo que tienen.",
        "Cada vez que suba tu ingreso, decidí cuánto va a gastos y cuánto a ahorro.",
      ],
    },
  },
  // ── Etapa 2: ahorrista ────────────────────────────────────────────────
  {
    id: "alfa-oferta",
    tipo: "oportunidad",
    titulo: "Una moneda “estable” que paga 19 %",
    postit: "ALFA: cripto “estable” que paga 19 % anual.",
    texto: "En redes todos hablan de ALFA: una cripto que siempre vale un dólar y paga 19 % anual por dejarla depositada. Un compañero ya tiene la suya.",
    requisitos: { etapaMinima: "ahorrista", sinMarca: "compro-alfa" },
    porDefecto: "no",
    aviso: "inversion",
    opciones: [
      {
        id: "dos",
        titulo: "Pongo Gs. 2.000.000",
        texto: "Es estable: lo peor que puede pasar es que no rinda.",
        efectos: { invertir: { activo: "alfa", monto: 2_000_000 } },
        marca: ["compro-alfa"],
        programa: [{ situacion: "alfa-cae", enMeses: 2 }],
        resultado: "Tenés Gs. 2.000.000 en ALFA.",
        nodo: "Un rendimiento muy por encima del resto siempre trae un riesgo, aunque no lo veas. Preguntate de dónde sale ese 19 %.",
      },
      {
        id: "medio",
        titulo: "Pruebo con Gs. 500.000",
        texto: "Algo chico, para ver cómo funciona.",
        efectos: { invertir: { activo: "alfa", monto: 500_000 } },
        marca: ["compro-alfa"],
        programa: [{ situacion: "alfa-cae", enMeses: 2 }],
        resultado: "Tenés Gs. 500.000 en ALFA.",
        nodo: "Probar con poco es una buena práctica cuando no entendés del todo algo. Igual, la pregunta clave sigue siendo de dónde sale el rendimiento.",
      },
      {
        id: "no",
        titulo: "No entiendo de dónde sale el 19 %",
        texto: "Prefiero no meter plata en algo que no entiendo.",
        efectos: {},
        resultado: "No invertiste en ALFA.",
        nodo: "No invertir en lo que no entendés es una regla que te va a salvar más de una vez.",
      },
    ],
    leccion: {
      id: "rendimiento-y-riesgo",
      titulo: "Rendimiento y riesgo",
      reglas: [
        "Si algo rinde mucho más que el resto, preguntá de dónde sale ese rendimiento.",
        "“Estable” y “garantizado” son promesas, no hechos.",
        "No inviertas en lo que no podés explicar con tus palabras.",
      ],
    },
  },
  {
    id: "alfa-cae",
    tipo: "situacion",
    titulo: "Tu cripto ALFA cayó 38 % en 5 días",
    postit: "Mi cripto ALFA cayó 38 % en 5 días. ¿Qué hago?",
    texto: "ALFA se despegó de su precio de referencia. En redes unos dicen que es una oportunidad y otros que se viene abajo. Podés salir, mantener o comprar más.",
    requisitos: { soloProgramada: true, activo: "alfa" },
    trayectoria: { activo: "alfa", cambios: [-0.38, -0.95] },
    porDefecto: "mantener",
    aviso: "inversion",
    opciones: [
      {
        id: "vender",
        titulo: "Vender todo",
        texto: "Asumís la pérdida y recuperás lo que queda.",
        efectos: { vender: { activo: "alfa", parte: 1 } },
        resultado: "ALFA cayó otro 95 % el mes siguiente. Vendiste a tiempo y conservaste lo que quedaba.",
        nodo: "Aceptar una pérdida es difícil, pero acá protegió tu plata. Vender no fue “acertar el precio”: fue reconocer que la razón por la que compraste (que era estable) ya no existía.",
      },
      {
        id: "mantener",
        titulo: "Mantener y esperar",
        texto: "No hacés nada. Si se recupera, no perdiste.",
        efectos: {},
        resultado: "ALFA cayó otro 95 % el mes siguiente. Perdiste casi todo lo invertido.",
        nodo: "Esperar sirve cuando el activo sigue funcionando y la caída es del mercado. Acá se rompió el mecanismo que lo hacía “estable”: ese era el dato para decidir, no el precio.",
      },
      {
        id: "comprar",
        titulo: "Comprar más (promediar)",
        texto: "Ponés Gs. 1.000.000 más para bajar el precio promedio.",
        efectos: { invertir: { activo: "alfa", monto: 1_000_000 } },
        resultado: "ALFA cayó otro 95 % el mes siguiente. Perdiste lo que tenías y lo que agregaste.",
        nodo: "Promediar a la baja solo tiene sentido con algo en lo que seguís confiando y con plata que no necesitás. Acá usaste ahorro para sostener algo que había dejado de funcionar.",
      },
    ],
    leccion: {
      id: "cuando-algo-cae",
      titulo: "Cuando una inversión cae",
      reglas: [
        "La pregunta no es “¿cuánto bajó?”, sino “¿sigue en pie la razón por la que lo compré?”.",
        "Antes de invertir, decidí cuánto estás dispuesto a perder y en qué caso salís.",
        "Lo que necesitás para emergencias no se invierte en activos volátiles.",
      ],
      casoReal: "terra-luna-2022",
    },
  },
  {
    id: "primo-negocio",
    tipo: "oportunidad",
    titulo: "Un negocio que “paga 10 % por mes”",
    postit: "Mi primo: negocio que paga 10 % por mes.",
    texto: "Tu primo dice que ya cobró dos meses seguidos. Pide un mínimo de Gs. 3.000.000 y hay cupo hasta el viernes. Si traés a otros, cobrás comisión.",
    requisitos: { etapaMinima: "ahorrista", sinMarca: "entro-piramide" },
    porDefecto: "no",
    aviso: "legal",
    opciones: [
      {
        id: "entro",
        titulo: "Entro con Gs. 3.000.000",
        texto: "Si mi primo cobró, por algo será.",
        efectos: { efectivo: -3_000_000 },
        marca: ["entro-piramide"],
        programa: [{ situacion: "primo-cae", enMeses: 2 }],
        resultado: "El primer mes cobraste Gs. 300.000.",
        nodo: "Que los primeros cobren no prueba que el negocio exista: en estos esquemas, a los primeros se les paga con la plata de los que entran después.",
      },
      {
        id: "pregunto",
        titulo: "Pregunto qué hace el negocio",
        texto: "Pido saber en qué se invierte y quién lo regula.",
        efectos: { reputacion: 3 },
        resultado: "Nadie supo explicarte en qué se invierte. No entraste.",
        nodo: "Preguntar de dónde sale la ganancia y si la entidad está registrada ante el regulador es la mejor defensa. Si no hay respuesta clara, no hay negocio.",
      },
      {
        id: "no",
        titulo: "No entro",
        texto: "Un 10 % por mes es demasiado.",
        efectos: {},
        resultado: "No pusiste plata.",
        nodo: "Un 10 % mensual es más de 200 % por año. Ninguna inversión seria promete algo así.",
      },
    ],
    leccion: {
      id: "senales-de-estafa",
      titulo: "Las señales de un esquema piramidal",
      reglas: [
        "Rendimientos altos, fijos y “garantizados” son la primera alarma.",
        "Si ganás por traer a otros, el negocio son los nuevos que entran.",
        "Apuro, cupos y presión social: nadie serio te apura para invertir.",
      ],
    },
  },
  {
    id: "primo-cae",
    tipo: "situacion",
    titulo: "Tu primo ya no contesta",
    postit: "Mi primo ya no contesta. ¿Y mi plata?",
    texto: "Hace dos semanas que no pagan. El grupo de WhatsApp se cerró y tu primo dice que él también perdió todo.",
    requisitos: { soloProgramada: true, marca: "entro-piramide" },
    porDefecto: "espero",
    aviso: "legal",
    opciones: [
      {
        id: "denuncio",
        titulo: "Hago la denuncia",
        texto: "Junto los comprobantes y denuncio.",
        efectos: { efectivo: 300_000, reputacion: 5 },
        resultado: "Cobraste un mes (Gs. 300.000) y perdiste Gs. 3.000.000. La denuncia sigue su curso.",
        nodo: "Denunciar con comprobantes ayuda a que otros no caigan y es la única vía para intentar recuperar algo. Guardá siempre los comprobantes de lo que pagás.",
      },
      {
        id: "espero",
        titulo: "Espero a que vuelvan a pagar",
        texto: "Capaz es un problema de unos días.",
        efectos: { efectivo: 300_000 },
        resultado: "No volvieron a pagar. Perdiste Gs. 2.700.000 en total.",
        nodo: "Cuando un esquema así deja de pagar, casi nunca vuelve. Esperar solo hace que pierdas tiempo para reclamar.",
      },
    ],
    leccion: {
      id: "senales-de-estafa",
      titulo: "Las señales de un esquema piramidal",
      reglas: [
        "Rendimientos altos, fijos y “garantizados” son la primera alarma.",
        "Si ganás por traer a otros, el negocio son los nuevos que entran.",
        "Apuro, cupos y presión social: nadie serio te apura para invertir.",
      ],
    },
  },
  {
    id: "plazo-fijo",
    tipo: "oportunidad",
    titulo: "Tu banco te ofrece un plazo fijo",
    postit: "El banco me ofrece un plazo fijo.",
    texto: "Tenés plata parada en la caja de ahorro. El banco te ofrece un plazo fijo en guaraníes que rinde más, pero no podés sacarla antes del vencimiento sin perder intereses.",
    requisitos: { etapaMinima: "ahorrista" },
    porDefecto: "no",
    aviso: "inversion",
    opciones: [
      {
        id: "parte",
        titulo: "Pongo Gs. 2.000.000",
        texto: "Dejo el resto del ahorro disponible para emergencias.",
        efectos: { invertir: { activo: "plazo-fijo", monto: 2_000_000 } },
        resultado: "Tenés Gs. 2.000.000 en un plazo fijo.",
        nodo: "Separar lo que es para emergencias (disponible) de lo que podés dejar quieto (plazo fijo) es la base de cualquier plan de inversión.",
      },
      {
        id: "no",
        titulo: "Prefiero tenerla a mano",
        texto: "No quiero inmovilizar nada.",
        efectos: {},
        resultado: "Todo tu ahorro sigue en la caja de ahorro.",
        nodo: "Tener todo disponible da tranquilidad, pero lo que no vas a usar en meses podría rendir más.",
      },
    ],
    leccion: {
      id: "liquidez",
      titulo: "Plata disponible y plata quieta",
      reglas: [
        "El fondo de emergencia tiene que estar disponible al instante.",
        "Lo que no vas a usar en meses puede ir a algo que rinda más.",
        "A mayor plazo o riesgo, mayor rendimiento esperado.",
      ],
    },
  },
  {
    id: "btc-primera",
    tipo: "oportunidad",
    titulo: "Bitcoin está en todas las noticias",
    postit: "Todos hablan de Bitcoin. ¿Entro?",
    texto: "Bitcoin subió mucho en los últimos meses y todos hablan de eso. Tenés ahorro y te preguntás si es momento de entrar.",
    requisitos: { etapaMinima: "ahorrista", sinMarca: "probo-btc" },
    porDefecto: "no",
    aviso: "inversion",
    opciones: [
      {
        id: "poco",
        titulo: "Pongo Gs. 500.000",
        texto: "Una parte chica de mis ahorros, que puedo perder.",
        efectos: { invertir: { activo: "btc", monto: 500_000 } },
        marca: ["probo-btc"],
        resultado: "Tenés Gs. 500.000 en Bitcoin.",
        nodo: "Entrar con una parte chica que podés perder te deja aprender sin poner en riesgo tu fondo de emergencia.",
      },
      {
        id: "mucho",
        titulo: "Pongo Gs. 4.000.000",
        texto: "Si sube como antes, me cambia el año.",
        efectos: { invertir: { activo: "btc", monto: 4_000_000 } },
        marca: ["probo-btc"],
        resultado: "Tenés Gs. 4.000.000 en Bitcoin.",
        nodo: "Entrar fuerte porque “subió mucho” es comprar por lo que ya pasó. Bitcoin puede caer más de la mitad en meses: preguntate si podrías aguantarlo.",
      },
      {
        id: "no",
        titulo: "Todavía no",
        texto: "Primero quiero entender cómo funciona.",
        efectos: {},
        resultado: "No invertiste.",
        nodo: "Entender antes de invertir nunca es perder una oportunidad: siempre va a haber otra.",
      },
    ],
    leccion: {
      id: "tamano-de-la-posicion",
      titulo: "Cuánto poner",
      reglas: [
        "En activos muy volátiles, poné solo lo que podrías perder sin cambiar tu vida.",
        "Comprar porque “subió mucho” es mirar hacia atrás.",
        "Entrar de a poco (por ejemplo, todos los meses) reduce el riesgo de entrar en el peor momento.",
      ],
    },
  },
  {
    id: "exchange-rumores",
    tipo: "situacion",
    titulo: "Rumores sobre tu exchange",
    postit: "Dicen que mi exchange tiene problemas.",
    texto: "Circulan rumores de que el exchange donde tenés tus cripto usa la plata de los clientes. Pasarlas a una billetera propia cuesta una comisión y algo de trabajo.",
    requisitos: { activo: "btc" },
    peso: 0.7,
    porDefecto: "dejo",
    aviso: "inversion",
    opciones: [
      {
        id: "retiro",
        titulo: "Las paso a una billetera propia",
        texto: "Pagás una comisión de Gs. 50.000.",
        efectos: { efectivo: -50_000 },
        marca: ["autocustodia"],
        resultado: "Tus cripto quedaron en una billetera que controlás vos.",
        nodo: "Si el exchange guarda tus cripto, en la práctica le prestás tu plata. Tener tu propia billetera te protege de su quiebra (y te obliga a cuidar tus claves).",
      },
      {
        id: "dejo",
        titulo: "Las dejo: es un exchange grande",
        texto: "Seguro son rumores.",
        efectos: {},
        programa: [{ situacion: "exchange-quiebra", enMeses: 1 }],
        resultado: "Tus cripto siguen en el exchange.",
        nodo: "El tamaño de una empresa no garantiza que tenga la plata de sus clientes.",
      },
    ],
    leccion: {
      id: "custodia",
      titulo: "Quién tiene tus cripto",
      reglas: [
        "Si no tenés las claves, las cripto no están bajo tu control.",
        "No dejes en una plataforma más de lo que podrías perder si quiebra.",
        "Una billetera propia te protege de la plataforma, pero exige cuidar tus claves.",
      ],
    },
  },
  {
    id: "exchange-quiebra",
    tipo: "situacion",
    titulo: "Tu exchange frenó los retiros",
    postit: "Mi exchange frenó los retiros.",
    texto: "El exchange frenó los retiros y días después se presentó en quiebra. Lo que tenías ahí queda atrapado en el proceso.",
    requisitos: { soloProgramada: true, activo: "btc" },
    porDefecto: "reclamo",
    aviso: "inversion",
    opciones: [
      {
        id: "reclamo",
        titulo: "Me anoto como acreedor",
        texto: "Presentás tu reclamo en el proceso de quiebra.",
        efectos: { perder: { activo: "btc", parte: 0.8 } },
        resultado: "Por ahora perdiste el 80 % de lo que tenías en el exchange.",
        nodo: "En una quiebra, los clientes pasan a ser acreedores y cobran (si cobran) años después. La prevención vale más que el reclamo.",
      },
    ],
    leccion: {
      id: "custodia",
      titulo: "Quién tiene tus cripto",
      reglas: [
        "Si no tenés las claves, las cripto no están bajo tu control.",
        "No dejes en una plataforma más de lo que podrías perder si quiebra.",
        "Una billetera propia te protege de la plataforma, pero exige cuidar tus claves.",
      ],
      casoReal: "ftx-2022",
    },
  },
  {
    id: "aguinaldo",
    dia: 20,
    tipo: "situacion",
    titulo: "Cobraste el aguinaldo",
    postit: "Aguinaldo. ¿Ahorro, regalos o las dos?",
    texto: "En diciembre cobrás el aguinaldo, además del sueldo. Fiestas, regalos y vacaciones compiten por esa plata.",
    requisitos: { meses: [12] },
    repetible: true,
    peso: 3,
    porDefecto: "gasto",
    aviso: "inversion",
    opciones: [
      {
        id: "todo",
        titulo: "Lo ahorro todo",
        texto: "Pasás Gs. 3.500.000 a la caja de ahorro.",
        efectos: { ahorro: 3_500_000 },
        resultado: "Ahorraste todo el aguinaldo.",
        nodo: "Un ingreso extra es la oportunidad más fácil para ahorrar: no estaba en tu presupuesto, así que no lo vas a extrañar.",
      },
      {
        id: "mitad",
        titulo: "Mitad y mitad",
        texto: "Ahorrás Gs. 1.750.000 y disfrutás el resto.",
        efectos: { ahorro: 1_750_000, efectivo: -1_200_000 },
        resultado: "Ahorraste la mitad y disfrutaste el resto.",
        nodo: "Dividir un ingreso extra entre ahorro y disfrute es una regla que se sostiene en el tiempo.",
      },
      {
        id: "gasto",
        titulo: "Es para las fiestas",
        texto: "Regalos, cenas y algún gusto.",
        efectos: { efectivo: -2_800_000 },
        resultado: "El aguinaldo se fue en las fiestas.",
        nodo: "Disfrutar está bien. Solo fijate si el año que viene querés que una parte quede.",
      },
    ],
    leccion: {
      id: "ingresos-extra",
      titulo: "Los ingresos extra",
      reglas: [
        "Decidí qué vas a hacer con un ingreso extra antes de cobrarlo.",
        "Una regla simple: una parte a ahorro, otra a disfrutar.",
        "Si tenés deuda cara, el ingreso extra rinde más pagándola.",
      ],
    },
  },
  // ── Etapa 4: emprendedor ──────────────────────────────────────────────
  {
    id: "abrir-negocio",
    tipo: "oportunidad",
    titulo: "Se alquila un local en tu barrio",
    postit: "Local libre en el barrio. ¿Abro algo?",
    texto: "Un local chico se alquila en tu barrio y tenés una idea que te entusiasma. Podés largarte del todo, probar los fines de semana o esperar.",
    requisitos: { etapaMinima: "ahorrista", sinMarca: "penso-negocio" },
    peso: 0.7,
    porDefecto: "no",
    aviso: "inversion",
    opciones: [
      {
        id: "todo",
        titulo: "Dejo el trabajo y lo abro",
        texto: "Aporte de Gs. 8.000.000. Sin sueldo desde ahora.",
        efectos: { negocio: { nombre: "tu local", flujoBase: 2_800_000, volatilidad: 0.6, aporte: 8_000_000, meses: 0 }, dejarTrabajo: true },
        marca: ["penso-negocio"],
        programa: [{ situacion: "negocio-ruc", enMeses: 1 }],
        resultado: "Abriste tu local. Ya no tenés sueldo: vivís de lo que deje el negocio.",
        nodo: "Dejar el sueldo hace que cada mes malo del negocio sea un mes malo tuyo. Antes de largarte, conviene tener ahorrados varios meses de gastos.",
      },
      {
        id: "finde",
        titulo: "Lo pruebo los fines de semana",
        texto: "Aporte de Gs. 4.000.000 y conservo el trabajo.",
        efectos: { negocio: { nombre: "tu local", flujoBase: 900_000, volatilidad: 0.6, aporte: 4_000_000, meses: 0 } },
        marca: ["penso-negocio"],
        programa: [{ situacion: "negocio-ruc", enMeses: 1 }],
        resultado: "Abriste tu local los fines de semana, sin dejar el trabajo.",
        nodo: "Probar un negocio sin soltar el ingreso fijo te deja aprender con menos riesgo. Si funciona, crecés; si no, perdiste el aporte y no tu estabilidad.",
      },
      {
        id: "no",
        titulo: "Todavía no",
        texto: "Quiero tener más ahorro antes.",
        efectos: {},
        resultado: "Seguís con tu trabajo.",
        nodo: "Esperar a tener colchón es una buena razón. Usá ese tiempo para probar la idea en chico.",
      },
    ],
    leccion: {
      id: "emprender-con-red",
      titulo: "Emprender con red",
      reglas: [
        "Antes de dejar el sueldo, tené ahorrados varios meses de gastos.",
        "Probá la idea en chico antes de poner todo.",
        "Separá la plata del negocio de la tuya desde el primer día.",
      ],
    },
  },
  {
    id: "negocio-ruc",
    tipo: "vencimiento",
    titulo: "Formalizar el negocio",
    postit: "Para facturar necesito RUC. ¿Me formalizo?",
    texto: "Un cliente grande te pide factura. Para facturar necesitás inscribirte en el RUC ante la DNIT y tener timbrado. Un contador te cobra por mes por llevarte los números.",
    requisitos: { soloProgramada: true, conNegocio: true },
    porDefecto: "informal",
    aviso: "legal",
    opciones: [
      {
        id: "formal",
        titulo: "Me inscribo y contrato un contador",
        texto: "Gs. 200.000 por mes de contador.",
        efectos: { gastosFijos: 200_000, reputacion: 5 },
        quita: ["informal"],
        resultado: "Tu negocio está formalizado y podés facturar.",
        nodo: "Formalizarte tiene un costo, pero te abre clientes que piden factura y te evita multas. Pensalo como un gasto del negocio, no como un castigo.",
      },
      {
        id: "informal",
        titulo: "Sigo sin RUC",
        texto: "Por ahora no lo necesito.",
        efectos: { reputacion: -5 },
        marca: ["informal"],
        programa: [{ situacion: "negocio-multa", enMeses: 4 }],
        resultado: "Perdiste al cliente que pedía factura.",
        nodo: "Seguir informal parece más barato hasta que perdés un cliente o llega una fiscalización.",
      },
    ],
    leccion: {
      id: "formalizar",
      titulo: "Formalizar tu negocio",
      reglas: [
        "Si vendés de forma habitual, tenés que estar inscripto en el RUC.",
        "Un contador es un costo fijo del negocio: incluilo en tus números.",
        "La formalidad te abre clientes y te protege; la informalidad acumula riesgo.",
      ],
    },
  },
  {
    id: "negocio-multa",
    tipo: "vencimiento",
    titulo: "Llegó una fiscalización",
    postit: "Fiscalización en el local. Multa.",
    texto: "Una fiscalización encontró que vendés sin factura. En el juego, la multa es de Gs. 1.500.000 (monto ficticio).",
    requisitos: { soloProgramada: true, marca: "informal" },
    porDefecto: "pago",
    aviso: "legal",
    opciones: [
      {
        id: "pago",
        titulo: "Pago y me formalizo",
        texto: "Pagás la multa y te inscribís.",
        efectos: { efectivo: -1_500_000, gastosFijos: 200_000 },
        quita: ["informal"],
        resultado: "Pagaste la multa y ahora estás formalizado.",
        nodo: "Formalizarte después de una multa te cuesta lo mismo que antes, más la multa. La formalidad temprana es más barata.",
      },
    ],
    leccion: {
      id: "formalizar",
      titulo: "Formalizar tu negocio",
      reglas: [
        "Si vendés de forma habitual, tenés que estar inscripto en el RUC.",
        "Un contador es un costo fijo del negocio: incluilo en tus números.",
        "La formalidad te abre clientes y te protege; la informalidad acumula riesgo.",
      ],
    },
  },
];

// ── Validación (para lo que se carga desde el Panel) ──────────────────────

export const ID_APRENDER = /^[a-z0-9-]{3,60}$/;
const TIPOS = ["situacion", "oportunidad", "vencimiento"];
const ACTIVOS_IDS = ["plazo-fijo", "dolar", "fondo", "acciones", "btc", "alt", "alfa"];
const ETAPAS = ["empleado", "ahorrista", "inversor", "emprendedor", "libre"];
const MARCA = /^[a-z0-9-]{2,40}$/;
const CLAVES_EFECTO = ["efectivo", "ahorro", "deudaTarjeta", "sueldo", "gastosFijos", "reputacion", "nivelVida", "invertir", "vender", "perder", "negocio", "dejarTrabajo", "prestamo"];

const txt = (v: unknown, min: number, max: number): v is string => typeof v === "string" && v.trim().length >= min && v.trim().length <= max;
const num = (v: unknown, max = 1e10) => typeof v === "number" && Number.isFinite(v) && Math.abs(v) <= max;

export function validarSituacion(x0: unknown): string[] {
  const e: string[] = [];
  const x = x0 as Partial<Situacion> | null;
  if (!x || typeof x !== "object") return ["La situación no tiene el formato esperado."];
  if (!x.id || !ID_APRENDER.test(x.id)) e.push("El id tiene que tener entre 3 y 60 caracteres: minúsculas, números y guiones.");
  if (!x.tipo || !TIPOS.includes(x.tipo)) e.push("Elegí un tipo: situación, oportunidad o vencimiento.");
  if (!txt(x.titulo, 3, 80)) e.push("El título tiene que tener entre 3 y 80 caracteres.");
  if (!txt(x.postit, 3, 70)) e.push("El texto del post-it tiene que tener entre 3 y 70 caracteres.");
  if (!txt(x.texto, 10, 500)) e.push("El texto tiene que tener entre 10 y 500 caracteres.");
  if (x.aviso !== "inversion" && x.aviso !== "legal") e.push("Elegí el aviso que corresponde.");
  if (x.peso !== undefined && !(num(x.peso, 10) && x.peso >= 0)) e.push("El peso va de 0 a 10.");
  if (x.dia !== undefined && !(Number.isInteger(x.dia) && x.dia >= 1 && x.dia <= 31)) e.push("El día va de 1 a 31.");
  const ops = Array.isArray(x.opciones) ? x.opciones : [];
  if (ops.length < 1 || ops.length > 4) e.push("La situación necesita de 1 a 4 opciones.");
  const ids = new Set<string>();
  ops.forEach((o, i) => {
    const n = i + 1;
    if (!o || typeof o !== "object") return void e.push(`Opción ${n}: formato inválido.`);
    if (!o.id || !/^[a-z0-9-]{1,30}$/.test(o.id) || ids.has(o.id)) e.push(`Opción ${n}: id inválido o repetido.`);
    ids.add(o.id);
    if (!txt(o.titulo, 2, 80)) e.push(`Opción ${n}: el título tiene que tener entre 2 y 80 caracteres.`);
    if (!txt(o.texto, 2, 200)) e.push(`Opción ${n}: el texto tiene que tener entre 2 y 200 caracteres.`);
    if (!txt(o.resultado, 5, 300)) e.push(`Opción ${n}: el resultado tiene que tener entre 5 y 300 caracteres.`);
    if (!txt(o.nodo, 10, 500)) e.push(`Opción ${n}: lo que dice NODO tiene que tener entre 10 y 500 caracteres.`);
    const ef = o.efectos as Record<string, unknown> | undefined;
    if (!ef || typeof ef !== "object") e.push(`Opción ${n}: faltan los efectos.`);
    else
      for (const [k, v] of Object.entries(ef)) {
        if (!CLAVES_EFECTO.includes(k)) e.push(`Opción ${n}: efecto desconocido "${k}".`);
        else if (["efectivo", "ahorro", "deudaTarjeta", "sueldo", "gastosFijos"].includes(k) && !num(v)) e.push(`Opción ${n}: "${k}" tiene que ser un número.`);
        else if (k === "reputacion" && !num(v, 50)) e.push(`Opción ${n}: la reputación va de −50 a 50.`);
        else if (k === "nivelVida" && !["austero", "normal", "alto"].includes(v as string)) e.push(`Opción ${n}: nivel de vida inválido.`);
        else if (k === "dejarTrabajo" && typeof v !== "boolean") e.push(`Opción ${n}: "dejarTrabajo" es sí o no.`);
        else if (k === "invertir") {
          const w = v as { activo?: string; monto?: number };
          if (!ACTIVOS_IDS.includes(w?.activo ?? "") || !num(w?.monto) || (w.monto ?? 0) <= 0) e.push(`Opción ${n}: inversión inválida.`);
        } else if (k === "vender" || k === "perder") {
          const w = v as { activo?: string; parte?: number };
          if (!ACTIVOS_IDS.includes(w?.activo ?? "") || !num(w?.parte, 1) || (w.parte ?? 0) <= 0) e.push(`Opción ${n}: "${k}" necesita un activo y una parte entre 0 y 1.`);
        } else if (k === "prestamo") {
          const w = v as { monto?: number; cuota?: number; meses?: number };
          if (!num(w?.monto) || !num(w?.cuota) || !Number.isInteger(w?.meses) || (w.meses ?? 0) < 1 || (w.meses ?? 0) > 120) e.push(`Opción ${n}: préstamo inválido.`);
        } else if (k === "negocio") {
          const w = v as { nombre?: string; flujoBase?: number; volatilidad?: number; aporte?: number };
          if (!txt(w?.nombre, 2, 40) || !num(w?.flujoBase) || !num(w?.volatilidad, 3) || !num(w?.aporte) || (w.aporte ?? 0) < 0) e.push(`Opción ${n}: negocio inválido.`);
        }
      }
    for (const m of [...(o.marca ?? []), ...(o.quita ?? [])]) if (!MARCA.test(m)) e.push(`Opción ${n}: marca inválida "${m}".`);
    for (const p of o.programa ?? []) {
      if (!p || !ID_APRENDER.test(p.situacion)) e.push(`Opción ${n}: la situación programada tiene un id inválido.`);
      if (!Number.isInteger(p?.enMeses) || p.enMeses < 1 || p.enMeses > 24) e.push(`Opción ${n}: "enMeses" va de 1 a 24.`);
    }
  });
  if (!x.porDefecto || !ids.has(x.porDefecto)) e.push("La opción por defecto tiene que ser una de las opciones.");
  const r = x.requisitos;
  if (r) {
    if (r.etapaMinima && !ETAPAS.includes(r.etapaMinima)) e.push("Requisitos: etapa inválida.");
    if (r.activo && !ACTIVOS_IDS.includes(r.activo)) e.push("Requisitos: activo inválido.");
    if (r.marca !== undefined && !MARCA.test(r.marca)) e.push("Requisitos: marca inválida.");
    if (r.sinMarca !== undefined && !MARCA.test(r.sinMarca)) e.push("Requisitos: marca excluida inválida.");
    if (r.meses && (!Array.isArray(r.meses) || r.meses.some((m) => !Number.isInteger(m) || m < 1 || m > 12))) e.push("Requisitos: los meses van de 1 a 12.");
  }
  const t = x.trayectoria;
  if (t) {
    if (!ACTIVOS_IDS.includes(t.activo)) e.push("Trayectoria: activo inválido.");
    if (!Array.isArray(t.cambios) || t.cambios.length < 1 || t.cambios.length > 6 || t.cambios.some((c) => !num(c, 5) || c < -1)) e.push("Trayectoria: de 1 a 6 cambios, cada uno entre −1 y 5.");
  }
  const l = x.leccion;
  if (!l || !l.id || !ID_APRENDER.test(l.id)) e.push("La lección necesita un id válido.");
  else {
    if (!txt(l.titulo, 3, 80)) e.push("La lección necesita un título de 3 a 80 caracteres.");
    if (!Array.isArray(l.reglas) || l.reglas.length < 1 || l.reglas.length > 4 || l.reglas.some((s) => !txt(s, 5, 200))) e.push("La lección necesita de 1 a 4 reglas (de 5 a 200 caracteres).");
    if (l.casoReal !== undefined && !ID_APRENDER.test(l.casoReal)) e.push("La lección: id de caso real inválido.");
  }
  return e;
}

export function validarCaso(x0: unknown): string[] {
  const e: string[] = [];
  const x = x0 as Partial<CasoReal> | null;
  if (!x || typeof x !== "object") return ["El caso no tiene el formato esperado."];
  if (!x.id || !ID_APRENDER.test(x.id)) e.push("El id tiene que tener entre 3 y 60 caracteres: minúsculas, números y guiones.");
  if (!txt(x.titulo, 3, 80)) e.push("El título tiene que tener entre 3 y 80 caracteres.");
  if (typeof x.fecha !== "string" || !/^\d{4}-(0[1-9]|1[0-2])$/.test(x.fecha)) e.push("La fecha va como AAAA-MM.");
  if (!txt(x.resumen, 20, 800)) e.push("El resumen tiene que tener entre 20 y 800 caracteres.");
  if (!txt(x.fuente, 5, 300)) e.push("La fuente es obligatoria (hasta 300 caracteres).");
  if (typeof x.verificado !== "boolean") e.push("Indicá si la fuente está verificada.");
  return e;
}

export interface FilaAprender {
  id: string;
  tipo: "situacion" | "caso";
  datos: unknown;
  estado: "borrador" | "revisado" | "publicado";
}

/**
 * Contenido final: lo incluido en el código más lo publicado desde el Panel
 * (una fila con el mismo id reemplaza a la incluida). Lo que no pasa la
 * validación se ignora, para que un error de carga no rompa el juego.
 */
export function armarContenido(filas: FilaAprender[] = []): Contenido {
  const situaciones = new Map(SITUACIONES.map((s) => [s.id, s]));
  const casos = new Map(CASOS.map((c) => [c.id, c]));
  for (const f of filas) {
    if (f.estado !== "publicado") continue;
    if (f.tipo === "situacion") {
      const s = { ...(f.datos as Situacion), id: f.id };
      if (validarSituacion(s).length === 0) situaciones.set(f.id, s);
    } else if (f.tipo === "caso") {
      const c = { ...(f.datos as CasoReal), id: f.id };
      if (validarCaso(c).length === 0) casos.set(f.id, c);
    }
  }
  return { situaciones, casos };
}
