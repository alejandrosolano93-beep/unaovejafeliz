# Guía — Obtener las credenciales para la reserva

Guía paso a paso para conectar el flujo interno con Google Calendar.
Sigue la **vía implementada** (Service Account, Opción 1 del PRD). Al final hay una
sección opcional si necesitas que **Google envíe el email de confirmación al cliente**.

## Qué vas a conseguir (resultado final)

Al terminar tendrás estos valores para cargar en Cloudflare (y en `.dev.vars` para local):

| Variable | De dónde sale | Parte |
|----------|---------------|-------|
| `BUSY_CALENDAR_IDS` | IDs de los calendarios a LEER (principal + Reservas), coma-separados | B |
| `BOOKING_CALENDAR_ID` | ID del calendario donde se ESCRIBEN las reservas ("Reservas") | B |
| `GOOGLE_SA_CLIENT_EMAIL` | Email de la service account | A |
| `GOOGLE_SA_PRIVATE_KEY` | Clave privada del JSON de la service account | A |
| `TURNSTILE_SECRET` | Cloudflare Turnstile (secret key) | C |
| *site key* de Turnstile | Cloudflare Turnstile (public) → va en `app.js` | C |

---

## Parte A — Google Cloud: proyecto, API y service account

1. Entra en **https://console.cloud.google.com** con la cuenta de Google del negocio.
2. Arriba, en el selector de proyecto → **Nuevo proyecto**. Nombre: `una-oveja-feliz`. Créalo y
   selecciónalo.
3. Menú **APIs y servicios → Biblioteca**. Busca **Google Calendar API** → **Habilitar**.
4. Menú **APIs y servicios → Credenciales → Crear credenciales → Cuenta de servicio**.
   - Nombre: `reservas-web`. Continúa y **Listo** (no hace falta asignar roles ni usuarios).
5. Entra en la service account recién creada (pestaña **Cuentas de servicio**) y **copia su email**
   (formato `reservas-web@una-oveja-feliz.iam.gserviceaccount.com`). Ese es tu
   **`GOOGLE_SA_CLIENT_EMAIL`**.
6. Pestaña **Claves → Agregar clave → Crear clave nueva → JSON → Crear**. Se descarga un `.json`.
   Guárdalo en lugar seguro (es un secreto; **no** lo subas al repo).
7. Abre el `.json`. Necesitas dos campos:
   - `client_email` → `GOOGLE_SA_CLIENT_EMAIL` (mismo del paso 5).
   - `private_key` → `GOOGLE_SA_PRIVATE_KEY` (empieza por `-----BEGIN PRIVATE KEY-----`).

> Sobre `GOOGLE_SA_PRIVATE_KEY`: en el JSON viene con saltos de línea escapados (`\n`). Puedes
> pegarla **tal cual** (el backend normaliza los `\n` automáticamente) o con saltos reales;
> ambas formas funcionan.

---

## Parte B — Compartir los calendarios y obtener sus IDs

Modelo de **dos calendarios** (privado): el **principal** aporta la disponibilidad real pero
sin exponer detalles; las reservas se escriben en un calendario **dedicado**. La service
account **no** ve ningún calendario hasta que el cliente se lo comparte.

> Esto lo hace el **cliente** desde su cuenta de Google (no necesitas su contraseña). Al final
> de esta guía tienes un mensaje listo para enviarle.

1. En **https://calendar.google.com** (cuenta del cliente), crear un calendario nuevo llamado
   **"Reservas"**: barra izquierda → **Otros calendarios → + → Crear calendario nuevo**.
2. **Calendario "Reservas"** → **⋮ → Configuración y uso compartido → Compartir con personas →
   Añadir personas**: pega el **email de la service account** con permiso
   **"Hacer cambios en los eventos"**.
3. **Calendario principal** → **⋮ → Configuración y uso compartido → Compartir con personas →
   Añadir personas**: pega el **mismo email** de la service account, pero con permiso
   **"Ver solo la disponibilidad (ocultar detalles)"**. Así sus eventos personales bloquean
   huecos sin que la app pueda ver detalles.
4. IDs (en cada calendario, **Configuración → Integrar el calendario → ID del calendario**):
   - Principal: suele ser el correo del cliente (`cliente@gmail.com`).
   - Reservas: algo como `...@group.calendar.google.com`.
   - **`BUSY_CALENDAR_IDS`** = ambos, coma-separados: `cliente@gmail.com,...@group.calendar.google.com`.
   - **`BOOKING_CALENDAR_ID`** = solo el de "Reservas": `...@group.calendar.google.com`.

---

## Parte C — Cloudflare Turnstile (anti-spam)

1. Entra en **https://dash.cloudflare.com** → menú lateral **Turnstile → Add widget**.
2. Nombre: `una-oveja-feliz`. **Hostnames**: tu dominio de producción (y `localhost` o
   `127.0.0.1` para pruebas). Modo: **Managed**. Crea el widget.
3. Copia:
   - **Site Key** (pública) → irá en `app.js` (`TURNSTILE_SITE_KEY`).
   - **Secret Key** → será `TURNSTILE_SECRET` (secreto en Cloudflare).

---

## Parte D — Cargar los secretos

### En Cloudflare Pages (producción)
Panel de Cloudflare → **Workers & Pages → tu proyecto (unaovejafeliz) → Settings →
Variables and Secrets**. Añade, **tipo "Secret"** (cifrado):

```
BUSY_CALENDAR_IDS        = <principal>,<reservas>   (de la Parte B)
BOOKING_CALENDAR_ID      = <reservas>               (de la Parte B)
GOOGLE_SA_CLIENT_EMAIL   = <de la Parte A>
GOOGLE_SA_PRIVATE_KEY    = <de la Parte A>
TURNSTILE_SECRET         = <de la Parte C>
```

O por línea de comandos:
```
npx wrangler pages secret put BUSY_CALENDAR_IDS
npx wrangler pages secret put BOOKING_CALENDAR_ID
npx wrangler pages secret put GOOGLE_SA_CLIENT_EMAIL
npx wrangler pages secret put GOOGLE_SA_PRIVATE_KEY
npx wrangler pages secret put TURNSTILE_SECRET
```

### En local (pruebas)
Copia `.dev.vars.example` a **`.dev.vars`** (ya está en `.gitignore`, nunca se sube) y rellena
los mismos valores. La `private_key` en una sola línea con `\n` escapados es lo más cómodo aquí.

---

## Parte E — Poner la site key en el frontend

En `app.js`, arriba, rellena la constante (es pública, no es secreto):
```js
const TURNSTILE_SITE_KEY = '0x4AAAAAA...'; // Site Key de la Parte C
```

---

## Parte F — Confirmar el horario y los servicios

Edita `functions/_lib/config.js` (ahora tiene **valores de ejemplo**) y ajusta a tu realidad:
- `WEEKLY_HOURS` — tramos de apertura por día de la semana.
- `SERVICES` — duración y ubicación por servicio (`Zumeria`, `Valor`, `Otros`).
- `SLOT_INTERVAL_MIN`, `BUFFER_MIN`, `MIN_NOTICE_MIN`, `MAX_ADVANCE_DAYS`.

---

## Parte G — Probar y desplegar

1. **Local:** con `.dev.vars` relleno:
   ```
   npx wrangler pages dev .
   ```
   Abre la URL local, cambia `BOOKING_MODE = 'internal'` en `app.js`, y comprueba que el
   calendario muestra huecos reales y que una reserva de prueba aparece en Google Calendar.
2. **Producción:** haz push; Cloudflare Pages despliega solo. Verifica que los secretos están
   cargados (Parte D) y que el dominio está en los hostnames de Turnstile (Parte C).
3. Cuando esté validado, deja `BOOKING_MODE = 'internal'` para activar el flujo interno.

---

## Mensaje para el cliente (copia y pega)

> Para conectar la web de reservas con tu Google Calendar necesito dos cosas (no necesito tu
> contraseña ni acceso a tu cuenta; puedes revocarlo cuando quieras dejando de compartir):
>
> 1. Crea un calendario nuevo llamado **"Reservas"** (en Google Calendar: *Otros calendarios →
>    + → Crear calendario nuevo*).
> 2. Comparte **"Reservas"** con este correo `PEGA_EL_EMAIL_DE_LA_SERVICE_ACCOUNT` con permiso
>    **"Hacer cambios en los eventos"**.
> 3. Comparte tu calendario **principal** con el **mismo correo**, pero con permiso
>    **"Ver solo la disponibilidad (ocultar detalles)"** — así tus citas personales bloquean
>    horas en la web sin que se vean sus detalles.
> 4. Mándame el **"ID del calendario"** de ambos (en cada uno: *Configuración → Integrar el
>    calendario → ID del calendario*).

---

## Opcional — Que Google envíe el email de confirmación al cliente

Con **Service Account + Gmail personal**, Google **no** manda invitación al cliente
(`SEND_UPDATES = 'none'` en `config.js`, y no se añade `attendee`). Si quieres ese email, elige:

- **A. Cuenta Google Workspace** con *domain-wide delegation*: activa la delegación en la consola
  de admin de Workspace y pon `SEND_UPDATES = 'all'`. La service account podrá invitar y notificar.
- **B. OAuth con refresh token del dueño** (funciona con Gmail personal): en vez de la service
  account, el dueño da consentimiento una vez y se guarda un `refresh_token`. Requiere crear un
  **OAuth client ID** (tipo *Web*) y **publicar** la app OAuth. Hay que sustituir `getAccessToken()`
  en `functions/_lib/google.js` por el intercambio de refresh token (avísame y lo implemento).
- **C. Email propio** (Resend/SendGrid/Postmark): mantenemos la service account y enviamos
  nosotros la confirmación desde `functions/api/book.js`. Requiere una API key y dominio verificado.

---

## Solución de problemas (errores → causa)

| Síntoma | Causa probable |
|---------|----------------|
| `SERVER_ERROR` con "Faltan credenciales" | `GOOGLE_SA_CLIENT_EMAIL` / `GOOGLE_SA_PRIVATE_KEY` no cargados |
| `SERVER_ERROR` con "Calendario no encontrado en freeBusy" / 404 | Algún ID de `BUSY_CALENDAR_IDS` es incorrecto o ese calendario no está compartido con la service account |
| `SERVER_ERROR` con "Token error 400 invalid_grant" | `private_key` mal pegada (saltos de línea) o hora del sistema desfasada |
| Calendario siempre vacío | Falta compartir algún calendario, o `WEEKLY_HOURS`/ventana no dan huecos |
| La reserva no aparece / falla al escribir | `BOOKING_CALENDAR_ID` ("Reservas") no compartido con permiso **"Hacer cambios en los eventos"** |
| `SPAM_REJECTED` siempre | Site key y secret no corresponden, o dominio no está en los hostnames de Turnstile |
| Reserva OK pero el cliente no recibe email | Comportamiento esperado con Service Account + Gmail personal (ver sección opcional) |
