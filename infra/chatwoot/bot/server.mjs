// Asistente de NODOS para Chatwoot (Agent Bot por webhook). Sin dependencias:
// Node 20+. Recibe los eventos del bot, responde con la lógica de logica.mjs y
// pasa la conversación a una persona cuando corresponde.
//
// Variables de entorno:
//   CHATWOOT_URL          p. ej. http://chatwoot-rails:3000 (red interna de Docker)
//   CHATWOOT_BOT_TOKEN    access token del Agent Bot (Configuración → Bots)
//   CHATWOOT_BOT_SECRET   secreto del webhook del bot (opcional; si está, se verifica la firma)
//   PORT                  por defecto 4000
import http from "node:http";
import crypto from "node:crypto";
import { responder } from "./logica.mjs";

const CHATWOOT_URL = (process.env.CHATWOOT_URL || "http://chatwoot-rails:3000").replace(/\/+$/, "");
const TOKEN = process.env.CHATWOOT_BOT_TOKEN || "";
const SECRET = process.env.CHATWOOT_BOT_SECRET || "";
const PORT = Number(process.env.PORT || 4000);

async function api(method, path, body) {
  const res = await fetch(`${CHATWOOT_URL}${path}`, {
    method,
    headers: { "Content-Type": "application/json", api_access_token: TOKEN },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status} ${await res.text().catch(() => "")}`.slice(0, 300));
  return res.json().catch(() => ({}));
}

function firmaValida(req, raw) {
  if (!SECRET) return true;
  const ts = req.headers["x-chatwoot-timestamp"];
  const sig = req.headers["x-chatwoot-signature"];
  if (!ts || !sig) return false;
  // Rechaza reenvíos viejos (más de 5 minutos).
  if (Math.abs(Date.now() / 1000 - Number(ts)) > 300) return false;
  const esperado = `sha256=${crypto.createHmac("sha256", SECRET).update(`${ts}.${raw}`).digest("hex")}`;
  const a = Buffer.from(String(sig));
  const b = Buffer.from(esperado);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

async function manejar(evento) {
  if (evento.event !== "message_created") return;
  if (evento.message_type !== "incoming" || evento.private) return;
  const conv = evento.conversation;
  const cuenta = evento.account?.id;
  if (!conv?.id || !cuenta) return;
  // Si una persona ya tomó la conversación, el bot no interviene.
  if (conv.status !== "pending") return;

  const base = `/api/v1/accounts/${cuenta}/conversations/${conv.id}`;
  let estado = conv.custom_attributes?.nodos_bot ?? {};
  // Conversación que vuelve a abrirse después de una atención: empieza de nuevo.
  if (estado.paso === "humano") estado = {};

  const contacto = { nombre: evento.sender?.name, email: evento.sender?.email };
  const r = responder(estado, evento.content ?? "", contacto);

  for (const m of r.mensajes) await api("POST", `${base}/messages`, { content: m, message_type: "outgoing" });
  if (r.nota) await api("POST", `${base}/messages`, { content: r.nota, message_type: "outgoing", private: true });
  if (r.etiquetas?.length) {
    const actuales = conv.labels ?? [];
    await api("POST", `${base}/labels`, { labels: [...new Set([...actuales, ...r.etiquetas])] });
  }
  await api("POST", `${base}/custom_attributes`, { custom_attributes: { nodos_bot: r.estado } });
  if (r.contacto && evento.sender?.id) {
    // Si el token del bot no puede editar contactos, el dato igual queda en la nota privada.
    await api("PUT", `/api/v1/accounts/${cuenta}/contacts/${evento.sender.id}`, r.contacto).catch((err) =>
      console.warn("[nodos-bot] no se pudo actualizar el contacto:", err.message)
    );
  }
  if (r.handoff) await api("POST", `${base}/toggle_status`, { status: "open" });
}

const server = http.createServer((req, res) => {
  if (req.method === "GET" && req.url === "/health") {
    res.writeHead(200, { "Content-Type": "text/plain" }).end("ok");
    return;
  }
  if (req.method !== "POST" || req.url !== "/webhook") {
    res.writeHead(404).end();
    return;
  }
  let raw = "";
  req.on("data", (c) => {
    raw += c;
    if (raw.length > 1_000_000) req.destroy();
  });
  req.on("end", () => {
    if (!firmaValida(req, raw)) {
      res.writeHead(401).end();
      return;
    }
    // Chatwoot no espera la respuesta: contestamos 200 enseguida y procesamos.
    res.writeHead(200).end();
    let evento;
    try {
      evento = JSON.parse(raw);
    } catch {
      return;
    }
    manejar(evento).catch((err) => console.error("[nodos-bot]", err.message));
  });
});

server.listen(PORT, () => console.log(`[nodos-bot] escuchando en :${PORT} → ${CHATWOOT_URL}`));
