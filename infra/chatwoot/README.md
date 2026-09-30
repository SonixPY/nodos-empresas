# NODOS Inbox: Chatwoot gratis + asistente de NODOS

Una sola bandeja para los mensajes de NODOS, con un asistente que da la bienvenida, registra consultas como leads y pasa a una persona cuando hace falta.

- **Chatwoot Community Edition** (licencia MIT, gratis). Se usa la imagen `-ce`, que no incluye el código "enterprise" de pago (Captain, SLA, etc.).
- **Asistente de NODOS** (`bot/`): un Agent Bot propio, sin IA paga. Tiene menú, captura de leads, etiquetas, nota privada para el equipo y traspaso a una persona. Nunca da señales ni recomendaciones de inversión y siempre lleva disclaimer.
- **Servidor**: VM Always Free de Oracle Cloud (ARM, 2 OCPU / 12 GB desde junio de 2026), HTTPS automático con Caddy.

Costo: USD 0. Oracle pide una tarjeta solo para verificar identidad; en Always Free no cobra.

## Qué canales se pueden conectar gratis

| Canal | ¿Se puede? | Qué hace falta |
|---|---|---|
| Chat en nodoscompliance.com | Sí | Nada: se pega un código en el sitio |
| WhatsApp Business (número propio, chats 1 a 1) | Sí | App en Meta for Developers + WhatsApp Cloud API. Las conversaciones que inicia el cliente no se cobran; las plantillas de marketing sí (tarifa de Meta) |
| Instagram (mensajes directos) | Sí, en principio | App propia de Meta. Para tus propias cuentas alcanza el acceso estándar (VERIFICAR al configurar) |
| Facebook Messenger | Sí | La misma app de Meta |
| Telegram | Sí | Un bot de @BotFather |
| Email (Zoho) | Solo con plan pago de Zoho | Chatwoot lee el correo por IMAP, y el plan gratis de Zoho no tiene IMAP. Mail Lite (el más barato) sí |
| TikTok (mensajes) | No, por ahora | Chatwoot lo soporta, pero exige una app aprobada por TikTok for Business |
| Canal de WhatsApp (difusión) | No | Meta no ofrece API para Canales: se sigue publicando desde el teléfono |
| Comentarios de YouTube | No | Chatwoot no tiene ese canal |

## Paso a paso

### 1. Crear el servidor gratis (lo hacés vos)
1. Creá una cuenta en https://www.oracle.com/cloud/free/ y elegí la región **São Paulo** (la más cercana).
2. Compute → Instances → **Create instance**:
   - Image: **Ubuntu 24.04**.
   - Shape: **VM.Standard.A1.Flex** con 2 OCPU y 12 GB.
   - Descargá la clave SSH que te ofrece.
3. En la subnet de la instancia → Security List → **Add Ingress Rules**: TCP 80 y 443 desde `0.0.0.0/0`.
4. Anotá la **IP pública**.

Si aparece *Out of capacity*, reintentá más tarde u otro día: pasa seguido con el plan gratis.

### 2. Subdominio (Namecheap, lo hacés vos)
Advanced DNS → Add New Record → **A Record**, Host `chat`, Value = la IP pública, TTL automático.

### 3. Instalar (5 minutos)
```bash
ssh -i tu-clave.key ubuntu@IP_PUBLICA
git clone https://github.com/SonixPY/nodos-empresas.git
cd nodos-empresas/infra/chatwoot
bash install.sh
```
El script:
- instala Docker;
- abre 80/443 en la VM;
- genera todos los secretos en `.env`;
- prepara la base y levanta todo.

**Guardá una copia de `.env` en un lugar seguro**: tiene las claves de cifrado.

### 4. Cuenta de administrador
Abrí https://chat.nodoscompliance.com y creá la cuenta (nombre de la cuenta: **NODOS**). Después, en Configuración → Cuenta → idioma: **Español**.

### 5. Activar el asistente
1. Chatwoot → Configuración → **Bots** → Agregar bot:
   - Nombre: *Asistente NODOS*.
   - URL del webhook: `http://nodos-bot:4000/webhook`.
2. Copiá el **access token** del bot y el **secreto** del webhook.
3. En la VM:
   ```bash
   nano .env        # completá CHATWOOT_BOT_TOKEN y CHATWOOT_BOT_SECRET
   sudo docker compose up -d nodos-bot
   ```
4. En cada bandeja (Configuración → Bandejas → la bandeja → **Bot**), elegí *Asistente NODOS*.

Probá desde el chat del sitio: tiene que aparecer el menú.

### 6. Conectar canales
- **Chat del sitio**: Bandejas → Nueva → Sitio web. Copiá el código y pasámelo: lo agrego a nodoscompliance.com.
- **Telegram**: creá un bot con @BotFather, copiá el token y en Bandejas → Nueva → Telegram pegalo.
- **WhatsApp**: en https://developers.facebook.com creá una app tipo *Business* y agregá **WhatsApp**. Después, en Bandejas → Nueva → WhatsApp → *WhatsApp Cloud*, cargá:
  - el Phone number ID;
  - el Business Account ID;
  - un token permanente de usuario del sistema.
  
  Chatwoot te muestra la URL de webhook y el token de verificación para pegar en Meta. Usá un número que **no** esté en la app de WhatsApp del teléfono.
- **Instagram / Messenger**: en la misma app de Meta, agregá *Instagram* y *Messenger*. Copiá App ID y App Secret a `FB_APP_ID` / `FB_APP_SECRET` en `.env`, ejecutá `sudo docker compose up -d` y conectá desde Bandejas → Nueva → Instagram.

### 7. Actualizar y respaldar
```bash
sudo docker compose pull && sudo docker compose up -d                          # actualizar
sudo docker compose exec postgres pg_dump -U postgres chatwoot | gzip > backup-$(date +%F).sql.gz   # backup
```
Guardá los backups **fuera** de la VM (por ejemplo, en tu Google Drive). Un solo servidor gratis no tiene redundancia.

## El asistente

El recorrido es:

1. **Bienvenida**: se presenta y aclara que nunca se pide dinero ni claves por chat.
2. **Menú**:
   - **1 · Contenido**: links, más disclaimer.
   - **2 · Consulta**: pregunta tema (a: cripto/compliance, b: empresa familiar, c: otro), nombre, email y detalle.
   - **3 · Soporte de las apps**: link a soporte y traspaso a IT.
   - **4 · Persona**: traspaso directo.
3. **Traspaso**: la conversación pasa a *Abierta*, con una nota privada que resume el lead. A partir de ahí el bot no interviene.

Además:
- Si alguien pide "qué cripto compro", señales o rendimientos, responde que NODOS no asesora, con disclaimer, y lo etiqueta `pidio-senal`.
- Etiquetas que usa: `lead`, `lead-completo`, `cripto-compliance`, `empresa-familiar`, `otro`, `soporte-apps`, `pidio-persona`, `contenido`.
- Prueba local sin Chatwoot: `cd bot && node prueba.mjs`.

**Privacidad**: los mensajes quedan en tu servidor. Avisá en la política de privacidad del sitio que hay un asistente automático y que las conversaciones se guardan para responder consultas (Ley 7593/2025).
