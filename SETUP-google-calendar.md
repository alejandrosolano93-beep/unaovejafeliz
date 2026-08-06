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

> **Esto va en TU cuenta de Google, NO en la del cliente.** La service account es una identidad
> de aplicación tuya; el cliente solo compartirá sus calendarios con su email (Parte B), sin
> tocar Google Cloud. Crear el proyecto y usar la Calendar API es **gratuito** (no requiere
> tarjeta). Si gestionas varios negocios, puedes reutilizar el mismo proyecto/service account.

1. Entra en **https://console.cloud.google.com** con **tu** cuenta de Google.
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

### En Cloudflare (producción)
Panel de Cloudflare → **Workers & Pages → tu Worker (unaovejafeliz) → Settings →
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
npx wrangler secret put BUSY_CALENDAR_IDS
npx wrangler secret put BOOKING_CALENDAR_ID
npx wrangler secret put GOOGLE_SA_CLIENT_EMAIL
npx wrangler secret put GOOGLE_SA_PRIVATE_KEY
npx wrangler secret put TURNSTILE_SECRET
```

### En local (pruebas)
Copia `.dev.vars.example` a **`.dev.vars`** (ya está en `.gitignore`, nunca se sube) y rellena
los mismos valores. La `private_key` en una sola línea con `\n` escapados es lo más cómodo aquí.

---

## Parte E — Poner la site key en el frontend

En `public/index.html`, en el widget de Turnstile, pon la Site Key (es pública, no es secreto):
```html
<div class="cf-turnstile" data-sitekey="0x4AAAAAA..." data-action="turnstile-spin-v2"></div>
```

---

## Parte F — Confirmar el horario y los servicios

Edita `src/lib/config.js` (ahora tiene **valores de ejemplo**) y ajusta a tu realidad:
- `WEEKLY_HOURS` — tramos de apertura por día de la semana.
- `SERVICES` — duración y ubicación por servicio (`Zumeria`, `Valor`, `Otros`).
- `SLOT_INTERVAL_MIN`, `BUFFER_MIN`, `MIN_NOTICE_MIN`, `MAX_ADVANCE_DAYS`.

---

## Parte G — Probar y desplegar

1. **Local:** con `.dev.vars` relleno:
   ```
   npx wrangler dev
   ```
   Abre la URL local (http://127.0.0.1:8788), con `BOOKING_MODE = 'internal'` en `public/app.js`,
   y comprueba que el calendario muestra huecos reales y que una reserva de prueba aparece en
   Google Calendar.
2. **Producción:** haz push; Cloudflare construye y despliega el Worker (`npx wrangler deploy`).
   Verifica que los secretos están cargados (Parte D) y que el dominio está en los hostnames de
   Turnstile (Parte C).
3. Cuando esté validado, deja `BOOKING_MODE = 'internal'` para activar el flujo interno.

---

## Mensaje para el cliente (copia y pega)

> **Importante:** hazlo desde un **ordenador** (la app del móvil no permite crear calendarios ni
> cambiar quién puede verlos). No necesito tu contraseña; puedes deshacerlo cuando quieras.
>
> **1) Abre tu calendario**
> Entra en **calendar.google.com** e inicia sesión con tu cuenta.
>
> **2) Crea un calendario nuevo llamado "Reservas"**
> En la columna de la izquierda, busca **"Otros calendarios"** y pulsa el signo **+** → **"Crear
> calendario nuevo"**. En "Nombre" escribe **Reservas** y pulsa **"Crear calendario"**. Espera
> unos segundos y vuelve atrás con la flecha del navegador.
>
> **3) Comparte el calendario "Reservas" conmigo**
> En la izquierda, pasa el ratón sobre **"Reservas"**, pulsa los **tres puntitos (⋮)** →
> **"Configuración y uso compartido"**. Baja hasta **"Compartir con determinadas personas o
> grupos"** → **"Añadir personas y grupos"**. Pega este correo:
> **`PEGA_EL_EMAIL_DE_LA_SERVICE_ACCOUNT`**
> y en "Permisos" elige **"Hacer cambios en los eventos"**. Pulsa **"Enviar"**.
>
> **4) Comparte tu calendario principal (solo la disponibilidad)**
> En la izquierda, en **"Mis calendarios"**, pasa el ratón sobre el calendario que lleva tu
> nombre, pulsa los **tres puntitos (⋮)** → **"Configuración y uso compartido"** → **"Añadir
> personas y grupos"**. Pega el **mismo correo** de antes, pero esta vez elige el permiso
> **"Ver solo la disponibilidad (ocultar detalles)"**. Pulsa **"Enviar"**.
> *(Esto hace que tus citas personales ocupen la hora en la web, pero nadie verá de qué son.)*
>
> **5) Mándame un dato**
> Sigues en **"Configuración y uso compartido"** del calendario **"Reservas"**: baja del todo
> hasta **"Integrar el calendario"** y cópiame el texto que aparece en **"ID de calendario"**
> (algo que termina en `@group.calendar.google.com`). Pégamelo en un mensaje junto con **la
> dirección de correo de tu cuenta de Google**. ¡Y ya está!

---

## Opcional — Que Google envíe el email de confirmación al cliente

Con **Service Account + Gmail personal**, Google **no** manda invitación al cliente
(`SEND_UPDATES = 'none'` en `config.js`, y no se añade `attendee`). Si quieres ese email, elige:

- **A. Cuenta Google Workspace** con *domain-wide delegation*: activa la delegación en la consola
  de admin de Workspace y pon `SEND_UPDATES = 'all'`. La service account podrá invitar y notificar.
- **B. OAuth con refresh token del dueño** (funciona con Gmail personal): en vez de la service
  account, el dueño da consentimiento una vez y se guarda un `refresh_token`. Requiere crear un
  **OAuth client ID** (tipo *Web*) y **publicar** la app OAuth. Hay que sustituir `getAccessToken()`
  en `src/lib/google.js` por el intercambio de refresh token (avísame y lo implemento).
- **C. Email propio** (Resend/SendGrid/Postmark): mantenemos la service account y enviamos
  nosotros la confirmación desde `src/api/book.js`. Requiere una API key y dominio verificado.

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
