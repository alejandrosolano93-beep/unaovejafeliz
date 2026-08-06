# PRD — Integración con Google Calendar (modo interno)

> Extiende `PRD.md`. Objetivo: que el **flujo de reserva interno** (`BOOKING_MODE = 'internal'`)
> lea la **disponibilidad real** desde un Google Calendar y **cree la reserva directamente**
> sobre ese calendario, sustituyendo los datos maquetados (`AVAILABLE`, `SLOT_ROWS`) de `app.js`.

---

## 1. Resumen y conclusión clave de la investigación

Tres hechos condicionan todo el diseño:

1. **La API de Google Calendar NO devuelve "huecos libres".** El endpoint `freebusy.query`
   devuelve únicamente los intervalos **ocupados** (`busy`) de un calendario. Los huecos
   disponibles se calculan en **nuestro** lado: `horario de trabajo − intervalos ocupados`.
   Esto sigue siendo cierto en 2026, incluso con "Appointment Schedules" de Google (no hay
   endpoint público que exponga los slots ya calculados).
2. **`busy` ≠ horario base (aclaración clave).** Para reproducir el aspecto de una página de
   reservas de Google (rejilla tipo "3pm–8pm entre semana, 9am–7pm findes, citas de 60 min"),
   `freebusy` **no es suficiente por sí solo**: solo dice *cuándo NO se puede*, nunca cuál es
   el **horario de apertura**. Ese horario base + los márgenes (duración, granularidad,
   antelación, buffers, ventana futura) provienen de la **configuración de la Appointment
   Schedule** de Google, que **la API no expone**. Por tanto hay que **re-declarar ese mismo
   horario y márgenes en nuestra configuración** (§6). La fórmula real es:

   ```
   slots disponibles = (horario base + duración + granularidad + márgenes)  −  ocupados(freebusy)
   ```

   - Los huecos de la agenda de Google que **aún nadie ha reservado** NO son eventos, así que
     `freebusy` no los marca ocupados → solo restamos reservas reales y bloqueos.
   - `freebusy` solo cuenta como ocupado lo marcado "Ocupado" (transparencia `opaque`); lo
     marcado "Disponible/libre" no bloquea.
   - Al colgar todo del **mismo calendario**, web y Google quedan sincronizados: lo reservado
     por una vía aparece como `busy` para la otra y no se duplica.
   - La única forma de **heredar** el horario/márgenes sin re-declararlos sería **incrustar la
     propia página de Google en un iframe** (ver §3).
3. **No hay servidor propio, pero SÍ hay lado servidor.** El despliegue es **Cloudflare
   Pages**, y sus **Functions son Workers que corren en el edge (lado servidor)**. Ahí viven
   las credenciales de Google como **secrets del Worker** — nunca en el bundle del navegador.
   No necesitamos un servidor aparte: el propio despliegue de Cloudflare Pages actúa de backend.
   > ⚠️ Las credenciales (clave de service account / refresh token OAuth) **NO pueden ir en el
   > frontend**. Cualquier variable embebida en el cliente (p. ej. `VITE_…`, `PUBLIC_…`) queda
   > **expuesta** en el navegador. Los "ficheros de entorno" del frontend **no** valen para
   > secretos; los secretos van en las **variables/secrets del proyecto de Cloudflare Pages**,
   > accesibles solo desde las Functions (§8).
4. **El cliente (customer) NO se autentica.** El visitante solo elige hueco y rellena sus
   datos. Quien está autenticado contra Google es el **negocio** (una sola cuenta), a través
   de las Cloudflare Pages Functions.

Arquitectura resultante:

```
Navegador (app.js, estático servido por Cloudflare Pages)
   │  GET  /api/availability?from=…&to=…&service=…
   │  POST /api/book   { day, time, service, name, email, phone, notes, token_antispam }
   ▼
Cloudflare Pages Functions (Worker en el edge · lado servidor)
   │  secrets de Google como variables cifradas del proyecto (nunca en el cliente)
   │  freebusy.query  → calcula slots libres (horario base − ocupados)
   │  events.insert   → crea la reserva en el calendario del negocio
   ▼
Google Calendar API (calendario de "Una oveja feliz")
```

---

## 2. Alcance

### En alcance
- Backend mínimo con dos endpoints: **disponibilidad** (lectura) y **reserva** (escritura).
- Autenticación del backend contra Google (una cuenta de negocio, ver §4).
- Cálculo de slots a partir de `freebusy` + una configuración de horario/servicios.
- Creación del evento de reserva con los datos del formulario.
- Prevención básica de doble-reserva y de spam.
- Adaptar `app.js` para consumir los endpoints en lugar de los datos maquetados.

### Fuera de alcance (por ahora)
- Panel de administración, cancelación/reprogramación por parte del cliente, pagos.
- Multi-calendario / multi-empleado (se diseña para **un** calendario).
- Recordatorios propios por SMS/WhatsApp.

---

## 3. Decisión: ¿construir backend o usar Google Appointment Scheduling?

| Opción | Pros | Contras |
|--------|------|---------|
| **A. Seguir con el enlace externo** (`external`, hoy) | Cero código, cero mantenimiento, emails y anti-doble-reserva los gestiona Google | No es nuestra UI; el usuario sale del sitio |
| **B. Backend propio + API** (este PRD) | UI 100 % propia e integrada; control total | Requiere backend, credenciales, mantenimiento y anti-spam |

> Recomendación: si el único motivo es "que quede dentro de nuestra web", valorar primero si
> **incrustar** el Appointment Scheduling de Google (iframe) es suficiente. Si se quiere la
> experiencia maquetada exacta (calendario propio, pasos, animaciones), seguir con la opción B.

---

## 4. Autenticación del backend contra Google (decisión crítica)

Tres formas de que el backend actúe sobre el calendario. Hay que **elegir una**:

### Opción 1 — Service Account + calendario compartido  *(más simple)*
- Se crea una *service account* en Google Cloud y se **comparte el calendario** del negocio
  con el email de la service account, permiso **"Hacer cambios en los eventos"**.
- El backend firma un JWT con la clave de la service account y llama a la API. Sin pantalla
  de consentimiento, sin refresh tokens que caducan.
- **Limitación importante:** en calendarios de **Gmail personal**, una service account
  **puede crear eventos pero NO puede invitar asistentes ni enviar el email de invitación**
  al cliente de forma fiable. El evento existe en el calendario, pero el cliente **no**
  recibe automáticamente la invitación de Google. (Sí funciona el envío si la cuenta es de
  **Google Workspace** con *domain-wide delegation*.)

### Opción 2 — OAuth 2.0 con refresh token del dueño  *(recomendada si el cliente debe recibir email de Google)*
- Una **sola vez**, el dueño del negocio da consentimiento OAuth (scope de Calendar). Se
  guarda el **refresh token** en el backend (variable de entorno / secreto).
- El backend actúa **como** el dueño → puede crear eventos **con asistente** (el cliente) y
  `sendUpdates: 'all'` para que Google envíe la invitación/confirmación por email.
- Contras: el refresh token puede revocarse (si se cambia la contraseña, se revoca el acceso,
  o pasan >6 meses sin uso en apps en modo "testing"); hay que **publicar** la app OAuth para
  evitar la caducidad de 7 días del modo testing.

### Opción 3 — Service Account + Domain-Wide Delegation  *(solo Google Workspace)*
- Solo si el calendario está en un dominio **Google Workspace** propio. Permite impersonar al
  usuario y enviar invitaciones. Requiere configuración de admin del Workspace.

> **Recomendación:**
> - Calendario en **Gmail personal** y **se quiere que el cliente reciba email de Google** →
>   **Opción 2 (OAuth refresh token)**.
> - Se acepta enviar la confirmación por **nuestro propio** email transaccional (no Google) →
>   **Opción 1 (Service Account)**, más robusta de mantener.
> - Cuenta de **Workspace** → Opción 1 con DWD (Opción 3) es ideal.
>
> **Decisión pendiente del negocio** (ver checklist §11): ¿el calendario es Gmail personal o
> Workspace? ¿el email de confirmación lo manda Google o lo mandamos nosotros?

---

## 5. API del backend (contrato)

> Implementado como **Cloudflare Pages Functions** (carpeta `functions/api/…` en el repo, que
> Cloudflare despliega como rutas `/api/*` del mismo dominio). Al compartir dominio con el sitio
> estático, no hay problema de CORS entre navegador y API. Runtime: Workers (Web APIs / `fetch`).
> Las credenciales de Google se leen desde `env` (bindings/secrets del proyecto), nunca del bundle.

### 5.1 `GET /api/availability`
Devuelve los días y horas realmente disponibles para pintar el calendario y los slots.

Query params: `from` (ISO date), `to` (ISO date), `service` (opcional, define duración).

Respuesta (ejemplo):
```json
{
  "timezone": "Europe/Madrid",
  "service": "Zumeria",
  "durationMin": 60,
  "days": {
    "2026-07-30": ["10:00", "11:30", "13:00", "16:00", "17:30"],
    "2026-07-31": ["10:00", "13:00"]
  }
}
```

Lógica del backend:
1. Cargar la **configuración de horario** (§6) para el rango pedido.
2. Generar los slots candidatos (según horario + duración + granularidad del servicio).
3. Llamar a `freebusy.query` (calendarId del negocio, `timeMin`/`timeMax` = rango).
4. **Restar** los intervalos `busy` a los candidatos. Aplicar buffers y antelación mínima.
5. Devolver solo los slots que quedan libres.

### 5.2 `POST /api/book`
Crea la reserva. Body:
```json
{
  "date": "2026-07-30",
  "time": "11:30",
  "service": "Zumeria",
  "name": "Marta L. García",
  "email": "marta@email.com",
  "phone": "+34 600 000 000",
  "notes": "…",
  "antispamToken": "…"   // Turnstile/reCAPTCHA
}
```
Lógica:
1. **Validar** todos los campos en servidor (no confiar en el cliente); verificar `antispamToken`.
2. **Re-comprobar disponibilidad** del slot con `freebusy` (evitar doble reserva por carrera).
3. `events.insert` en el calendario del negocio con los datos de §7.
4. Responder `{ ok: true, eventId, htmlLink }` (o error tipado).

Respuestas de error tipadas: `SLOT_TAKEN`, `INVALID_INPUT`, `SPAM_REJECTED`, `SERVER_ERROR`.

---

## 6. Configuración de negocio (a definir, vive en el backend)

Esto **no** existe en Google; lo definimos nosotros y es lo que convierte "busy" en "slots":

- **Zona horaria:** `Europe/Madrid`.
- **Horario de apertura por día de la semana** (p. ej. L–V 10:00–14:00 y 16:00–19:00; S–D cerrado).
- **Granularidad / horas de inicio permitidas** (p. ej. cada 90 min: 10:00, 11:30, 13:00…).
- **Duración de la sesión por servicio** (hoy la confirmación dice "60 minutos" → confirmar por servicio).
- **Buffer** entre citas (p. ej. 0/15 min).
- **Antelación mínima** para reservar (p. ej. no permitir < 2 h de antelación).
- **Ventana máxima** hacia el futuro (p. ej. hasta 60 días).
- **Días festivos / cierres** puntuales (lista o un calendario secundario "cerrado").
- **Servicios** (`Zumeria`, `Valor`, `Otros`) → duración, y opcionalmente ubicación distinta.

---

## 7. Creación del evento (`events.insert`)

Campos propuestos del evento:
- `summary`: `"Reserva · {servicio} — {nombre}"`.
- `description`: nombre, teléfono, email, servicio, notas (para que el negocio lo vea).
- `start` / `end`: fecha+hora en `Europe/Madrid` (RFC 3339 con `timeZone`).
- `location`: `"Zumeria · Calle del mar"` (o según servicio).
- `attendees`: `[{ email: <cliente> }]` **solo** si la vía de auth lo permite (Opción 2/3).
- `reminders`: por defecto de Google o `useDefault: true`.
- `sendUpdates`: `'all'` (Opción 2/3) para que Google avise al cliente; `'none'` en Opción 1.
- Guardar `phone`/`service`/origen en `extendedProperties.private` para futuras búsquedas.

Confirmación al cliente:
- **Opción 2/3:** Google envía la invitación por email automáticamente.
- **Opción 1:** enviar nosotros un email transaccional (Resend/SendGrid/…) — requiere proveedor.
- El botón **"Añadir a Google Calendar"** del Paso 3 puede usar `htmlLink` del evento creado, o
  un enlace de plantilla / `.ics` generado en cliente (no requiere backend).

---

## 8. Seguridad y robustez

- **Secretos solo en Cloudflare** (Pages → Settings → Variables and Secrets, tipo **Secret**,
  cifrados): clave de service account o `client_id`/`client_secret`/`refresh_token`. Se leen
  desde `env` en las Functions. **Nunca** en el repo, en `wrangler.toml` en claro, ni en el
  bundle del cliente. Gestionar con la UI de Pages o `wrangler pages secret put`.
- ⚠️ **Prohibido usar variables públicas de frontend para secretos.** Prefijos tipo `VITE_`,
  `PUBLIC_`, `NEXT_PUBLIC_` o cualquier `import.meta.env` embebido acaban en el JS del
  navegador y son **públicos**. Solo la *site key* del anti-spam (pública por diseño) puede ir
  en el cliente; la *secret key* va como secret del Worker.
- **CORS:** al servir API y sitio desde el **mismo dominio** de Cloudflare Pages, no hace falta
  CORS. Si algún día se separa el dominio, restringir `Access-Control-Allow-Origin` al origen
  de producción (allowlist), nunca `*`.
- **Anti-spam obligatorio** (escribe en un calendario real): Cloudflare Turnstile o reCAPTCHA v3.
- **Rate limiting** por IP en `/api/book`.
- **Validación server-side** de todos los campos; sanitizar lo que va a `description`.
- **Doble reserva:** re-check con `freebusy` justo antes de `events.insert`. Google no tiene
  bloqueo transaccional; asumir una ventana de carrera mínima y, si `SLOT_TAKEN`, pedir reelegir.
- **Reintentos** ante `403 rateLimitExceeded` con backoff. Refresh de token OAuth cada ~3600 s.
- **RGPD (España):** se recogen nombre, email y teléfono → añadir **aviso de privacidad y
  consentimiento** en el formulario y definir base legal, retención y responsable del tratamiento.

---

> **Runtime Workers — nota técnica.** No hay Node.js completo. Firmar el JWT de la service
> account (RS256) o intercambiar el refresh token se hace con la **Web Crypto API**
> (`crypto.subtle`) disponible en Workers, o con una librería compatible con edge. No usar SDKs
> de Google que dependan de módulos de Node (`fs`, `crypto` de Node, etc.).

## 9. Cambios en el frontend (`app.js`)

- Sustituir `AVAILABLE` / `SLOT_ROWS` estáticos por una llamada a `GET /api/availability`
  al abrir el flujo y al cambiar de mes/servicio. Pintar el calendario y los slots con la respuesta.
- Estados de UI nuevos: **cargando**, **sin huecos**, **error de red**.
- `onReserve(payload)` (hoy TODO) → `POST /api/book`; mostrar Paso 3 solo si `ok: true`;
  si `SLOT_TAKEN`, volver al Paso 1 con aviso.
- Mantener `BOOKING_MODE`: `external` sigue igual; toda esta lógica vive bajo `internal`.
- Añadir el widget anti-spam (Turnstile/reCAPTCHA) al Paso 2.
- Añadir `endpoint base URL` como constante de configuración (dev vs prod).

---

## 10. Plan por fases (sin estimaciones)

1. **Fase 0 — Prerrequisitos** (§11): cuentas, credenciales y decisiones de negocio.
2. **Fase 1 — Backend de solo lectura:** `/api/availability` con `freebusy` + config de horario.
   Frontend consume disponibilidad real (aún sin escribir).
3. **Fase 2 — Reserva:** `/api/book` con `events.insert`, anti-spam, validación y doble-reserva.
4. **Fase 3 — Confirmación y correos:** email al cliente (Google o propio) + "Añadir a Calendar".
5. **Fase 4 — Endurecimiento:** rate limiting, logs, manejo de errores, RGPD, pruebas.

---

## 11. Checklist de prerrequisitos (obtener ANTES de implementar)

### Decisiones de negocio
- [ ] ¿El calendario de reservas es **Gmail personal** o **Google Workspace**? (define la vía de auth, §4)
- [ ] ¿El email de confirmación al cliente lo envía **Google** o lo enviamos **nosotros**? (§7)
- [ ] **Horario de apertura** por día de la semana (§6).
- [ ] **Duración** de cada servicio (`Zumeria`, `Valor`, `Otros`) y horas de inicio permitidas.
- [ ] **Buffer**, **antelación mínima** y **ventana máxima** de reserva.
- [ ] **Ubicación** por servicio (¿todas "Zumeria · Calle del mar"?).
- [ ] Texto de **aviso de privacidad / consentimiento RGPD** y responsable del tratamiento.

### Cuentas e infraestructura
- [ ] **Proyecto en Google Cloud** creado.
- [ ] **Google Calendar API habilitada** en ese proyecto.
- [ ] Credenciales según la vía elegida:
  - Opción 1: **service account** + descarga de su **clave JSON** + **compartir el calendario**
    con el email de la service account (permiso "Hacer cambios en los eventos").
  - Opción 2: **OAuth client ID/secret** (tipo *Web*), completar consentimiento una vez y
    obtener/guardar el **refresh token**; **publicar** la app OAuth (no dejarla en "testing").
  - Opción 3: además, activar **domain-wide delegation** en la consola de admin de Workspace.
- [ ] **Calendar ID** del calendario de reservas (Configuración del calendario → "ID del calendario").
- [x] **Hosting decidido:** **Cloudflare Pages** (sitio estático) + **Pages Functions**
      (Workers en el edge) como backend, mismo dominio → sin CORS, sin servidor aparte.
- [ ] **Proyecto de Cloudflare Pages** creado y conectado al repo (build del sitio estático).
- [ ] Estructura `functions/api/availability.js` y `functions/api/book.js` en el repo.
- [ ] **`wrangler`** instalado para pruebas locales (`wrangler pages dev`) y gestión de secrets.
- [ ] **Dominio de producción** configurado en Cloudflare (URL base del API = mismo dominio, `/api/*`).
- [ ] **Anti-spam**: cuenta de **Cloudflare Turnstile** (integrado en Cloudflare) → *site key*
      (pública, va en el cliente) + *secret key* (secret del Worker).
- [ ] Si el email lo enviamos nosotros (Opción 1): cuenta de **email transaccional**
      (Resend/SendGrid/Postmark) + dominio verificado (SPF/DKIM). *(Cloudflare no envía email por sí solo.)*
- [ ] Cargar **secrets en Cloudflare Pages** (Settings → Variables and Secrets, tipo *Secret*,
      o `wrangler pages secret put <NOMBRE>`): credenciales de Google, claves anti-spam, email.
      **Nunca** en el repo ni como variable pública de frontend.

### Variables de entorno previstas (Cloudflare Pages — referencia)
> Todas como **Secret** salvo las marcadas *(pública)*. Se leen desde `env` en las Functions.
```
CALENDAR_ID=...
TIMEZONE=Europe/Madrid
# Opción 1 (service account) — la private key en formato PEM, cuidado con los \n
GOOGLE_SA_CLIENT_EMAIL=...
GOOGLE_SA_PRIVATE_KEY=...
# Opción 2 (OAuth refresh token)
GOOGLE_OAUTH_CLIENT_ID=...
GOOGLE_OAUTH_CLIENT_SECRET=...
GOOGLE_OAUTH_REFRESH_TOKEN=...
# Anti-spam (Turnstile)
TURNSTILE_SECRET=...
TURNSTILE_SITE_KEY=...        # (pública) puede exponerse en el cliente
# Email propio (si aplica)
EMAIL_API_KEY=...
```

---

## 12. Decisiones abiertas / riesgos
- **Vía de auth** (§4) es la decisión que más condiciona el resto; resolverla primero.
- Envío de email de confirmación en Gmail personal con service account **no** es fiable → o
  Workspace/OAuth, o email propio.
- La API no da slots libres: la calidad de la disponibilidad depende de **nuestra** config de
  horario (§6); hay que definirla con cuidado.
- Doble reserva por carrera: mitigable pero no 100 % eliminable sin bloqueo externo.
- Coste/mantenimiento de un backend + cumplimiento RGPD frente a la sencillez del enlace externo.

---

### Fuentes
- [Freebusy: query — Google Calendar API](https://developers.google.com/workspace/calendar/api/v3/reference/freebusy/query)
- [Google Calendar API — Reference](https://developers.google.com/workspace/calendar/api/v3/reference)
- [Google Calendar API returns busy times, not slots — Slotflow](https://www.slotflow.dev/blog/google-calendar-api-busy-times-not-slots)
- [Create Google Calendar events using service accounts (Node.js) — DEV](https://dev.to/pedrohase/create-google-calender-events-using-the-google-api-and-service-accounts-in-nodejs-22m8)
- [Google Calendar API Free/Busy Query — Nylas](https://cli.nylas.com/guides/google-calendar-api-free-busy)
