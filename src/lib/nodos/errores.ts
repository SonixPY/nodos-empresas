// Traductor único de errores de Postgres, Supabase (base, Storage y Auth) y
// de red a mensajes en español para mostrar en pantalla. Este archivo es
// idéntico en finanzas-app y nodos-empresas: si lo cambiás, cambialo en los dos.

interface ErrorLike {
  message?: unknown;
  code?: unknown;
  status?: unknown;
  statusCode?: unknown;
  error?: unknown;
}

const GENERICO = "No se pudo completar la operación. Probá de nuevo.";
const RED = "No pudimos conectarnos. Revisá tu conexión y probá de nuevo.";

/** ¿El texto ya está en español? (para dejar pasar los mensajes propios de la base, p. ej. `raise exception`). */
function pareceEspanol(texto: string): boolean {
  if (/[áéíóúñ¿¡]/i.test(texto)) return true;
  const palabras = texto.toLowerCase().match(/[a-z]+/g) ?? [];
  const es = new Set(["el", "la", "los", "las", "de", "del", "que", "no", "un", "una", "se", "para", "con", "tu", "por", "ya", "hay", "esta", "este", "puede", "falta"]);
  return palabras.filter((p) => es.has(p)).length >= 2;
}

function partes(error: unknown): { message: string; code: string; status: number | null } {
  if (error == null) return { message: "", code: "", status: null };
  if (typeof error === "string") return { message: error, code: "", status: null };
  if (typeof error !== "object") return { message: String(error), code: "", status: null };
  const e = error as ErrorLike;
  const message = typeof e.message === "string" ? e.message : typeof e.error === "string" ? e.error : "";
  const code = typeof e.code === "string" ? e.code : "";
  const s = Number(e.status ?? e.statusCode);
  return { message, code, status: Number.isFinite(s) && s > 0 ? s : null };
}

/**
 * Mensaje en español para un error de Supabase/Postgres/Storage/red. Acepta
 * el objeto de error, su `message` o cualquier valor. `respaldo` se usa
 * cuando no hay nada que mostrar.
 */
export function mensajeError(error: unknown, respaldo: string = GENERICO): string {
  const { message, code, status } = partes(error);
  const m = message.toLowerCase();
  if (!message && !code) return respaldo;

  // Red
  if (/failed to fetch|networkerror|network request failed|load failed|fetch failed|err_network|timeout|timed out/.test(m)) return RED;

  // Postgres (códigos SQLSTATE)
  switch (code) {
    case "23514":
      return "Hay un valor que no está permitido. Revisá los datos e intentá de nuevo.";
    case "23505":
      return "Ya existe un registro con esos datos.";
    case "23503":
      return "Ese registro está vinculado a otro que no existe o que todavía lo usa.";
    case "23502":
      return "Falta completar un campo obligatorio.";
    case "22001":
      return "Uno de los textos es demasiado largo.";
    case "22003":
      return "Uno de los números está fuera del rango permitido.";
    case "22007":
    case "22008":
      return "Hay una fecha inválida. Revisala e intentá de nuevo.";
    case "22P02":
      return "Hay un dato con un formato inválido.";
    case "42501":
      return "No tenés permiso para hacer este cambio.";
    case "PGRST116":
      return "No se encontró el registro.";
    case "PGRST301":
      return "Tu sesión venció. Volvé a ingresar.";
    case "P0001":
      return pareceEspanol(message) ? message : "La base rechazó el cambio. Revisá los datos.";
  }
  if (/row-level security|permission denied|not authorized|unauthorized/.test(m)) return "No tenés permiso para hacer este cambio.";
  if (/jwt expired|invalid jwt|session.*(missing|expired|not found)|auth session missing/.test(m)) return "Tu sesión venció. Volvé a ingresar.";
  if (/violates check constraint/.test(m)) return "Hay un valor que no está permitido. Revisá los datos e intentá de nuevo.";
  if (/duplicate key|already exists|resource already exists/.test(m)) {
    return /resource|object|file/.test(m) || status === 409 ? "Ya existe un archivo con ese nombre." : "Ya existe un registro con esos datos.";
  }
  if (/invalid input syntax for type date|date\/time field value out of range/.test(m)) return "Hay una fecha inválida. Revisala e intentá de nuevo.";
  if (/null value in column/.test(m)) return "Falta completar un campo obligatorio.";

  // Storage
  if (/payload too large|exceeded the maximum allowed size|entity too large|file size/.test(m) || status === 413) {
    return "El archivo supera el tamaño máximo permitido.";
  }
  if (/mime type|invalid_mime_type|not supported/.test(m)) return "Ese tipo de archivo no está permitido.";
  if (/bucket not found/.test(m)) return "El almacenamiento de archivos no está configurado todavía.";
  if (/object not found|not found/.test(m) || status === 404) return "No se encontró el archivo o el registro.";

  // Límite de pedidos
  if (/rate limit|too many requests/.test(m) || status === 429) return "Demasiados intentos. Esperá unos minutos y probá de nuevo.";

  if (pareceEspanol(message)) return message;
  return respaldo;
}

/** Mensajes de Supabase Auth (registro, ingreso, contraseña) en español. */
export function mensajeErrorAuth(error: unknown, respaldo = "No pudimos completar el pedido. Probá de nuevo."): string {
  const { message, code, status } = partes(error);
  const m = message.toLowerCase();
  if (code === "over_email_send_rate_limit" || code === "over_request_rate_limit" || code === "over_sms_send_rate_limit" || status === 429 || /rate limit/.test(m)) {
    return "Demasiados intentos. Esperá unos minutos y probá de nuevo.";
  }
  if (code === "weak_password" || /password should|weak password|password is too/.test(m)) {
    return "Esa contraseña es muy débil. Usá al menos 8 caracteres combinando letras y números.";
  }
  if (code === "same_password" || /different from the old password/.test(m)) return "La contraseña nueva tiene que ser distinta de la anterior.";
  if (code === "user_already_exists" || code === "email_exists" || /already registered|already exists/.test(m)) {
    return "Ya existe una cuenta con ese email. Ingresá o recuperá tu contraseña.";
  }
  if (code === "email_address_invalid" || code === "email_address_not_authorized" || /invalid email|email address .* is invalid|unable to validate email/.test(m)) {
    return "Ese email no parece válido.";
  }
  if (code === "user_banned" || /banned/.test(m)) return "Tu cuenta está suspendida. Escribinos a soporte.";
  if (code === "email_not_confirmed" || /not confirmed/.test(m)) return "Todavía no confirmaste tu email. Revisá tu bandeja de entrada.";
  if (code === "signup_disabled" || /signups not allowed/.test(m)) return "El registro de cuentas nuevas está pausado. Escribinos a soporte.";
  if (code === "invalid_credentials" || /invalid login credentials/.test(m)) return "Usuario, email o contraseña incorrectos.";
  if (code === "session_not_found" || code === "session_expired" || /session/.test(m)) return "Tu sesión venció. Volvé a ingresar.";
  return mensajeError(error, respaldo);
}
