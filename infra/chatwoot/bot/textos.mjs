// Textos del asistente de NODOS. Sin nombre propio ni credenciales (regla de
// marca), con disclaimer en todo lo que toca finanzas, cripto o legal.

export const DISCLAIMER =
  "_Contenido educativo. No constituye asesoría de inversión ni asesoría legal personalizada._";

export const ANTIFRAUDE =
  "Nunca te vamos a pedir dinero, claves ni códigos por chat. Si alguien lo hace en nombre de NODOS, es un fraude.";

export const MENU = `Elegí una opción respondiendo con el número:

1️⃣ Contenido y comunidad (podcast, shorts, Canal de WhatsApp)
2️⃣ Consulta o asesoría (cripto-activos y compliance, empresas familiares)
3️⃣ Soporte de NODOS Finanzas o NODOS Empresas
4️⃣ Hablar con una persona

Escribí *menú* en cualquier momento para volver acá.`;

export const BIENVENIDA = (nombre) =>
  `¡Hola${nombre ? ` ${nombre}` : ""}! Soy el asistente de NODOS, el punto de encuentro entre finanzas, proyectos y ley — con foco en cripto.

${MENU}

${ANTIFRAUDE}`;

export const CONTENIDO = `Todo el contenido de NODOS es gratuito:

🎙️ *Zona Gris*: un episodio al mes, en YouTube.
🔓 *Decodificado* y 🔍 *Bajo Lupa*: shorts en YouTube, TikTok e Instagram.
📲 Canal de WhatsApp: https://whatsapp.com/channel/0029VbESNO2F1YlJx6nKWy20
🌐 https://nodoscompliance.com

${DISCLAIMER}

¿Algo más? Escribí *menú*.`;

export const TEMAS = `¿Sobre qué es tu consulta?

a) Cripto-activos y compliance (PLA/FT, SEPRELAD, GAFI)
b) Empresa familiar (actas, accionistas, vencimientos, SEPRELAD de la empresa)
c) Otro tema`;

export const TEMA_LABEL = { a: "cripto-compliance", b: "empresa-familiar", c: "otro" };
export const TEMA_TEXTO = {
  a: "Cripto-activos y compliance",
  b: "Empresa familiar",
  c: "Otro tema",
};

export const PEDIR_NOMBRE = "¿Cómo te llamás?";
export const PEDIR_EMAIL = "¿A qué email te escribimos? (si preferís seguir por acá, escribí *no*)";
export const PEDIR_DETALLE =
  "Contanos en pocas líneas qué necesitás. No incluyas contraseñas, números de cuenta ni datos de terceros.";

export const CIERRE_LEAD = `¡Gracias! Ya quedó registrada tu consulta. Una persona del equipo te responde por acá en días hábiles.

${DISCLAIMER}`;

export const SOPORTE = `Para problemas con NODOS Finanzas o NODOS Empresas:

🛠️ https://empresas.nodoscompliance.com/soporte

Si ya estás acá, contame qué pasa y lo paso al equipo de IT.`;

export const HANDOFF = "Listo, te paso con una persona del equipo. Te responden por acá en días hábiles.";

export const NO_ASESORAMOS = `No damos recomendaciones de compra o venta, señales ni promesas de rendimiento. Lo que sí hacemos es explicar cómo funciona y qué dice la normativa.

${DISCLAIMER}

Si querés una consulta formal, escribí *2*.`;

export const NO_ENTENDI = "No te entendí 🙂. Respondé con un número del menú o escribí *persona* para hablar con alguien.";

// Pedidos de "qué compro", señales o rendimientos: se responde sin asesorar.
export const PIDE_ASESORIA_INVERSION =
  /\b(qu[eé] (cripto|moneda|token|acci[oó]n) (compro|comprar)|me conviene (comprar|invertir)|se[nñ]al(es)?|va a subir|precio objetivo|cu[aá]nto (rinde|gano)|recomend[aá]s? (invertir|comprar))\b/i;

export const PIDE_PERSONA = /\b(persona|humano|asesor|agente|hablar con (alguien|una persona))\b/i;
export const PIDE_MENU = /^\s*(men[uú]|inicio|volver|hola|buenas|buen d[ií]a|buenas tardes|buenas noches)\s*[.!]*\s*$/i;
