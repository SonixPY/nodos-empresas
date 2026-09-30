// Máquina de estados del asistente. Pura: recibe el estado y el texto, y
// devuelve qué responder y qué hacer. Así se puede probar sin Chatwoot.
import * as T from "./textos.mjs";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * @param {{paso?: string, tema?: string, nombre?: string, email?: string}} estado
 * @param {string} texto  mensaje entrante del contacto
 * @param {{nombre?: string, email?: string}} contacto  datos que ya tiene Chatwoot
 * @returns {{mensajes: string[], estado: object, etiquetas?: string[], handoff?: boolean, nota?: string, contacto?: object}}
 */
export function responder(estado, texto, contacto = {}) {
  const t = (texto ?? "").trim();
  const e = { ...estado };
  // En WhatsApp e Instagram el "nombre" suele ser el teléfono o el usuario: no cuenta como nombre.
  contacto = { ...contacto, nombre: primerNombre(contacto.nombre) ? contacto.nombre : undefined };

  if (T.PIDE_PERSONA.test(t)) {
    return { mensajes: [T.HANDOFF], estado: { paso: "humano" }, etiquetas: ["pidio-persona"], handoff: true };
  }
  if (!e.paso || T.PIDE_MENU.test(t)) {
    return { mensajes: [e.paso ? T.MENU : T.BIENVENIDA(primerNombre(contacto.nombre))], estado: { paso: "menu" } };
  }
  if (T.PIDE_ASESORIA_INVERSION.test(t)) {
    return { mensajes: [T.NO_ASESORAMOS], estado: { paso: "menu" }, etiquetas: ["pidio-senal"] };
  }

  switch (e.paso) {
    case "menu": {
      const op = t.match(/^[1-4]/)?.[0];
      if (op === "1") return { mensajes: [T.CONTENIDO], estado: { paso: "menu" }, etiquetas: ["contenido"] };
      if (op === "2") return { mensajes: [T.TEMAS], estado: { paso: "tema" } };
      if (op === "3") return { mensajes: [T.SOPORTE], estado: { paso: "soporte" }, etiquetas: ["soporte-apps"] };
      if (op === "4") return { mensajes: [T.HANDOFF], estado: { paso: "humano" }, handoff: true };
      return { mensajes: [T.NO_ENTENDI], estado: e };
    }
    case "tema": {
      const k = t.toLowerCase().match(/^[abc]/)?.[0];
      if (!k) return { mensajes: ["Respondé con *a*, *b* o *c*."], estado: e };
      const siguiente = contacto.nombre ? (contacto.email ? "detalle" : "email") : "nombre";
      const pregunta = { nombre: T.PEDIR_NOMBRE, email: T.PEDIR_EMAIL, detalle: T.PEDIR_DETALLE }[siguiente];
      return {
        mensajes: [pregunta],
        estado: { paso: siguiente, tema: k, nombre: contacto.nombre, email: contacto.email },
        etiquetas: ["lead", T.TEMA_LABEL[k]],
      };
    }
    case "nombre": {
      if (t.length < 2) return { mensajes: [T.PEDIR_NOMBRE], estado: e };
      const nombre = t.slice(0, 80);
      const siguiente = e.email ? "detalle" : "email";
      return {
        mensajes: [siguiente === "email" ? T.PEDIR_EMAIL : T.PEDIR_DETALLE],
        estado: { ...e, nombre, paso: siguiente },
        contacto: { name: nombre },
      };
    }
    case "email": {
      if (/^no$/i.test(t)) return { mensajes: [T.PEDIR_DETALLE], estado: { ...e, paso: "detalle" } };
      if (!EMAIL.test(t)) return { mensajes: ["Ese email no parece válido. Probá de nuevo o escribí *no*."], estado: e };
      const email = t.toLowerCase();
      return { mensajes: [T.PEDIR_DETALLE], estado: { ...e, email, paso: "detalle" }, contacto: { email } };
    }
    case "detalle": {
      if (t.length < 5) return { mensajes: [T.PEDIR_DETALLE], estado: e };
      const nota = [
        "📋 *Nuevo lead desde el asistente*",
        `Tema: ${T.TEMA_TEXTO[e.tema] ?? "—"}`,
        `Nombre: ${e.nombre ?? "—"}`,
        `Email: ${e.email ?? "—"}`,
        `Consulta: ${t.slice(0, 1000)}`,
      ].join("\n");
      return {
        mensajes: [T.CIERRE_LEAD],
        estado: { ...e, paso: "humano" },
        etiquetas: ["lead-completo"],
        handoff: true,
        nota,
      };
    }
    case "soporte":
      return {
        mensajes: [T.HANDOFF],
        estado: { paso: "humano" },
        handoff: true,
        nota: `🛠️ Soporte apps: ${t.slice(0, 1000)}`,
      };
    default:
      return { mensajes: [], estado: e };
  }
}

function primerNombre(n) {
  if (!n || /@|^\+?\d/.test(n)) return "";
  return n.split(/\s+/)[0];
}
