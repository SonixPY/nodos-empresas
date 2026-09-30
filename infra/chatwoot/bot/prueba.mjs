// Prueba de punta a punta sin Chatwoot: levanta un Chatwoot falso, arranca el
// bot y simula una conversación completa. Uso: node prueba.mjs
import http from "node:http";
import crypto from "node:crypto";
import { spawn } from "node:child_process";
import assert from "node:assert/strict";

const llamadas = [];
const falso = http.createServer((req, res) => {
  let b = "";
  req.on("data", (c) => (b += c));
  req.on("end", () => {
    llamadas.push({ method: req.method, url: req.url, token: req.headers.api_access_token, body: b ? JSON.parse(b) : null });
    res.writeHead(200, { "Content-Type": "application/json" }).end("{}");
  });
}).listen(4901);

const SECRET = "secreto-de-prueba";
const bot = spawn(process.execPath, ["server.mjs"], {
  cwd: new URL(".", import.meta.url).pathname,
  env: { ...process.env, PORT: "4902", CHATWOOT_URL: "http://127.0.0.1:4901", CHATWOOT_BOT_TOKEN: "tok", CHATWOOT_BOT_SECRET: SECRET },
  stdio: "inherit",
});
await new Promise((r) => setTimeout(r, 400));

let estado = {};
async function enviar(texto, status = "pending") {
  const cuerpo = JSON.stringify({
    event: "message_created",
    message_type: "incoming",
    content: texto,
    account: { id: 1 },
    sender: { id: 7, name: "+595981000000" },
    conversation: { id: 42, status, labels: [], custom_attributes: { nodos_bot: estado } },
  });
  const ts = String(Math.floor(Date.now() / 1000));
  const sig = "sha256=" + crypto.createHmac("sha256", SECRET).update(`${ts}.${cuerpo}`).digest("hex");
  const antes = llamadas.length;
  const r = await fetch("http://127.0.0.1:4902/webhook", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Chatwoot-Timestamp": ts, "X-Chatwoot-Signature": sig },
    body: cuerpo,
  });
  assert.equal(r.status, 200);
  await new Promise((r2) => setTimeout(r2, 150));
  const nuevas = llamadas.slice(antes);
  const attrs = nuevas.find((l) => l.url.endsWith("/custom_attributes"));
  if (attrs) estado = attrs.body.custom_attributes.nodos_bot;
  return nuevas;
}

try {
  let n = await enviar("hola");
  assert.match(n[0].body.content, /asistente de NODOS/);
  assert.equal(n[0].token, "tok");

  n = await enviar("2");
  assert.match(n[0].body.content, /Sobre qué es tu consulta/);
  n = await enviar("b");
  assert.ok(n.some((l) => l.url.endsWith("/labels") && l.body.labels.includes("empresa-familiar")));
  n = await enviar("Ana Pérez");
  n = await enviar("ana@ejemplo.com");
  assert.ok(n.some((l) => l.method === "PUT" && l.url === "/api/v1/accounts/1/contacts/7" && l.body.email === "ana@ejemplo.com"));
  n = await enviar("Necesitamos ordenar las actas de la S.A. familiar");
  assert.ok(n.some((l) => l.body?.private && /Nuevo lead/.test(l.body.content) && /Ana Pérez/.test(l.body.content)));
  assert.ok(n.some((l) => l.url.endsWith("/toggle_status") && l.body.status === "open"));

  // Con la conversación en manos de una persona, el bot se calla.
  n = await enviar("¿hola?", "open");
  assert.equal(n.length, 0);

  // Pedido de señal de inversión: no asesora y deja disclaimer.
  estado = { paso: "menu" };
  n = await enviar("¿qué cripto compro ahora?");
  assert.match(n[0].body.content, /No damos recomendaciones/);
  assert.match(n[0].body.content, /No constituye asesoría/);

  // Firma inválida: 401.
  const r = await fetch("http://127.0.0.1:4902/webhook", { method: "POST", body: "{}", headers: { "X-Chatwoot-Timestamp": "1", "X-Chatwoot-Signature": "sha256=x" } });
  assert.equal(r.status, 401);

  console.log("✓ prueba completa: bienvenida, lead con etiquetas y nota, traspaso a persona, sin asesoría de inversión, firma");
} finally {
  bot.kill();
  falso.close();
}
