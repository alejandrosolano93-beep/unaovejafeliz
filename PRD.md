# PRD — "Una oveja feliz" · Web de reservas

> Documento de requisitos de producto para implementar el diseño de Pencil (`una oveja feliz.pen`) como una web estática, estética y minimalista, con animaciones sutiles y desplazamiento suave basado en **anime.js v4**.

---

## 1. Visión y principios

**Una oveja feliz** es un pequeño estudio/negocio (zumería + taller) con una identidad artesanal, cálida y calmada ("con calma, sin prisa"). La web tiene un único objetivo: **permitir reservar una cita** de forma sencilla y agradable.

Principios de diseño rectores:

1. **Minimalismo cálido.** Mucho espacio en blanco (crema), tipografía cuidada, cero ruido visual. Un contenedor solo existe cuando aporta estructura real.
2. **Movimiento con intención.** Las animaciones son **sutiles** y refuerzan la sensación de calma: nunca llamativas, nunca bruscas. El **scroll suave y la aparición animada de los elementos** son parte central de la experiencia, no un adorno.
3. **Accesible por defecto.** Respeto de `prefers-reduced-motion`, contraste suficiente, foco visible y navegación por teclado.
4. **Rendimiento.** Sitio estático, sin frameworks pesados. Solo se anima `transform` y `opacity` (propiedades compositables).

---

## 2. Alcance

### En alcance (v1)
- Landing/hero con la marca y CTA "Reservar una cita".
- **Modo de reserva por defecto (v1): enlace externo.** El CTA "Reservar una cita" abre la página de citas de Google Calendar: `https://calendar.app.google/P8TvSUSSjdqYemP66`.
- **Switch en código** (una variable/flag) que alterna entre ese enlace externo y el **flujo de reserva interno** maquetado en el diseño (§7.1).
- Flujo de reserva interno en 3 pasos (detrás del flag): **Paso 1 — Elige un hueco** (calendario + horas), **Paso 2 — Tus datos** (formulario), **Paso 3 — Confirmado**.
- Sistema de animaciones con anime.js v4 (entradas, reveals on-scroll, micro-interacciones, transición entre pasos) + scroll suave.
- Diseño responsive (desktop y móvil).

### Fuera de alcance (v1) — pero previsto
- **Integración real con Google Calendar (API) todavía NO existe.** En v1 la reserva se resuelve **redirigiendo al enlace de Google** (arriba); no hay backend, ni disponibilidad real leída por API, ni envío de correos propio. Los datos del calendario y de los slots del flujo interno son **maquetados/estáticos**.
- Autenticación, panel de administración, pagos.

---

## 3. Fuente de la verdad (diseño Pencil)

Archivo: `/Users/p.magana/Downloads/una oveja feliz.pen`. Nodos de nivel superior:

| Nodo | ID | Rol |
|------|----|-----|
| `screen A` | `NXmHQ` | Landing / hero (marca + logo oveja + enlace "Reservar una cita") |
| `Flujo de reserva (Google) — compartido` | `AlGb7` | Contiene los dos paneles del flujo: **Paso 1** (`RX35v`) y **Paso 2** (`XYj4M`) |
| `screen B` | `YJErJ` | Confirmación (**Paso 3 · Confirmado**, `F2vNhk`) |
| `Marca — oveja` | `by2yq` | Componente reutilizable: logo de la oveja en SVG (contorno + nariz/boca) |

Assets referenciados en el .pen (deberán exportarse/colocarse en `images/`):
- `images/una_oveja_feliz_cropped.png` — logo de la oveja (versión recortada).
- `WhatsApp Image 2026-08-05 at 17.00.06.jpeg` — foto/versión alternativa del logo.
- Logo vectorial de la oveja disponible como paths SVG en el componente `by2yq` (preferible usar el **SVG** para poder animar el trazado).

---

## 4. Sistema de diseño (tokens)

Extraído directamente del .pen. Definir como variables CSS (`:root`).

### 4.1 Color

| Token | Hex | Uso |
|-------|-----|-----|
| `--bg` | `#F2EEE3` | Fondo de página (crema cálido) |
| `--bg-flow` | `#E9E2D0` | Fondo del área del flujo / superficie secundaria (resumen, chips) |
| `--surface` | `#FBF9F2` | Tarjetas (paneles de pasos) |
| `--input` | `#F2EEE3` | Relleno de campos de formulario |
| `--border` | `#D9D1BE` | Bordes, líneas, texto deshabilitado/placeholder |
| `--ink` | `#201C15` | Texto principal, botones oscuros, iconos activos |
| `--ink-soft` | `#5B5446` | Texto secundario, etiquetas, iconos |
| `--on-dark` | `#F2EEE3` | Texto sobre superficies oscuras (`--ink`) |
| Sombra | `#20201510` | Sombra de tarjetas |

### 4.2 Tipografía (Google Fonts)

| Familia | Uso | Tamaños |
|---------|-----|---------|
| **Dancing Script** | Wordmark / marca | 40 (hero), 16 (cabecera de tarjeta) |
| **Fraunces** (600) | Títulos | 28 (confirmación), 21 (título de paso) |
| **Inter** | UI y cuerpo | 15 (botones, 600), 14 (cuerpo/valores), 13 (etiquetas, 600), 12 (días de la semana, 600), 11 (pies, normal) |

### 4.3 Forma, elevación y espacio

- **Radios:** tarjetas `12`; resumen `10`; inputs / slots / botones `8`.
- **Sombra de tarjeta:** `blur 32, offset y 12, spread -8, color #20201510` (outer). En CSS: `box-shadow: 0 12px 32px -8px #20201510`.
- **Borde:** `1px solid var(--border)`.
- **Padding de tarjeta:** `28`. **Gap interno de tarjeta:** `22`.
- **Grid unit:** múltiplos de 4 (gaps observados: 3, 4, 6, 7, 8, 9, 11, 13, 14, 15, 22, 36, 60).

---

## 5. Especificación de pantallas

### 5.1 Landing / Hero (`screen A`)
- Fondo `--bg`.
- Wordmark **"Una oveja feliz"** (Dancing Script 40) arriba a la izquierda.
- CTA **"Reservar una cita"** (Inter 14, `--ink-soft`) arriba a la derecha. Su acción depende del **switch** `BOOKING_MODE` (§7.1):
  - `"external"` (por defecto en v1): abre `https://calendar.app.google/P8TvSUSSjdqYemP66`.
  - `"internal"`: **una sola pantalla** — el logo se desplaza suavemente a la izquierda y el panel de reserva (Paso 1) aparece a la derecha con un fade-in (transición FLIP con anime.js). Cerrar (✕) revierte: el panel se desvanece y el logo vuelve al centro.
- Logo de la oveja **centrado** (usar SVG del componente `by2yq`).
- Es la puerta de entrada.

### 5.2 Paso 1 — "Elige un hueco" (`RX35v`)
Tarjeta (`--surface`, radio 12, sombra, borde). Estructura vertical (gap 22):
1. **Cabecera:** lockup (wordmark "Una oveja feliz" 16 + título "Elige un hueco" en Fraunces 21) + icono **cerrar** (`lucide:x`).
2. **Navegación de mes:** `‹` + "Julio 2026" (Inter 15/600) + `›` (`lucide:chevron-left/right`).
3. **Calendario:** fila de días de semana `L M X J V S D` (Inter 12/600, `--ink-soft`) + 5 filas de 7 celdas. Celdas:
   - Vacías (huecos de inicio de mes).
   - Día no disponible: número en `--border`.
   - Día disponible: número en `--ink`, hover → fondo `--bg-flow`.
   - Día seleccionado: fondo `--ink`, número `--on-dark`, radio 8.
4. **"Horas disponibles · jue 30 jul"** (Inter 13/600, `--ink-soft`).
5. **Slots de hora** en filas de 3 (gap 8). Slot normal: fondo `--surface`/`#FBF9F2`, borde `--border`, radio 8, alto 38. Slot **seleccionado**: fondo `--ink`, texto `--on-dark` (600). Ej.: 10:00, **11:30 (activo)**, 13:00, 16:00, 17:30.
6. **Botón "Continuar"** (fondo `--ink`, texto `--on-dark` 15/600, alto 48) → va al Paso 2.
7. **Pie:** `lucide:calendar-check` + "Sincronizado con Google Calendar" (Inter 11).

### 5.3 Paso 2 — "Tus datos" (`XYj4M`)
Tarjeta igual que Paso 1. Estructura:
1. **Cabecera:** icono **volver** (`lucide:chevron-left`) → Paso 1 + lockup (wordmark 16 + "Tus datos" Fraunces 21).
2. **Resumen del slot (chip):** fondo `--bg-flow`, radio 8. Icono `lucide:calendar` + "Jueves 30 jul · 11:30" (14/600) + enlace **"Cambiar"** (13, `--ink-soft`) → vuelve al Paso 1.
3. **Formulario** (gap 15), cada campo = etiqueta (Inter 13/600, `--ink-soft`) + input (fondo `--input`, borde `--border`, radio 8, alto 46, padding horizontal 15):
   - **Nombre y apellidos** — texto. (Placeholder ejemplo: "Marta L. García".)
   - **Correo electrónico** — email.
   - **Teléfono** — tel (placeholder "+34 600 000 000" en color `--border`).
   - **¿Qué te gustaría hacer?** — desplegable con icono `lucide:chevron-down`. **Opciones: `Zumeria`, `Valor`, `Otros`.** (Ver §7.3 — el diseño muestra "Taller de tejido" como ejemplo; se sustituye por estas tres opciones.)
   - **Notas (opcional)** — textarea (alto 70, padding 12/15).
4. **Botón "Reservar cita"** (fondo `--ink`, texto `--on-dark` 15/600, alto 48). **En v1 no ejecuta ninguna acción** (§7.4).
5. **Pie:** `lucide:lock` + "Gestionado con Google · tus datos están seguros" (Inter 11).

### 5.4 Paso 3 — Confirmación (`screen B` / `F2vNhk`)
Tarjeta (`--surface`). Estructura centrada:
1. Logo de la oveja (arriba, centrado).
2. **"¡Cita reservada!"** (Fraunces 28/600, `--ink`).
3. Subtítulo "Te esperamos en el estudio. Con calma, sin prisa." (Inter 14, `--ink-soft`, centrado, lineHeight 1.5, ancho ~300).
4. **Resumen** (`--bg-flow`, radio 10, padding 20, gap 13) — filas icono + texto:
   - `lucide:calendar` "Jueves 30 de julio, 2026"
   - `lucide:timer` "11:30 · 60 minutos"
   - `lucide:scissors` (servicio elegido, p. ej. "un zumo con solano")
   - `lucide:map-pin` "Zumeria · Calle del mar"
5. **Botón "Añadir a Google Calendar"** (contorno `--ink`, texto `--ink` 14/600, icono `lucide:calendar-plus`, alto 46, radio 8). En v1 puede quedar inerte o generar un enlace `.ics`/Google Calendar template (opcional, ver §7.4).
6. **Pie:** `lucide:mail` + "Confirmación enviada a …" (Inter 11).

> Iconografía: **Lucide** (coincide con el .pen). Usar `lucide` (SVG) para mantener nitidez y poder animarlos.

---

## 6. anime.js v4 — arquitectura de animación

anime.js v4 es **modular y tree-shakeable**: se importa solo lo necesario.

```js
import {
  animate,
  createTimeline,
  stagger,
  onScroll,     // Scroll Observer: liga/dispara animaciones con el scroll
  createScope,  // aísla animaciones y facilita su limpieza (SPA/pasos)
  createSpring, // easing tipo muelle para micro-interacciones
  svg,          // svg.createDrawable() para animar el trazado del logo
  utils,        // utils.$, set, remove, random…
} from 'animejs';
```

> Nota de implementación: verificar los nombres exactos contra la doc oficial de v4 (`animejs.com/documentation`) al integrar, ya que la API evoluciona. Los patrones de abajo reflejan v4.

### 6.1 Desplazamiento suave (smooth scroll)
`onScroll` **liga** animaciones al scroll pero **no** aporta inercia al scroll de la página. Para el "desplazamiento suave" pedido:
- **Recomendado:** añadir **Lenis** (smooth-scroll de inercia, ligerísimo) para el momentum del scroll, y usar **anime.js `onScroll`** para los reveals sincronizados. Lenis expone un `scroll` que se puede conectar a anime.js.
- **Alternativa sin dependencias:** `scroll-behavior: smooth` en CSS para los saltos por ancla, + `onScroll` de anime.js para las apariciones. Menos "premium" pero cero peso extra.

### 6.2 Entradas al cargar (hero)
Timeline de bienvenida, escalonada y suave:

```js
const tl = createTimeline({ defaults: { ease: 'out(3)', duration: 800 } });
tl.add('.wordmark', { opacity: [0, 1], y: [16, 0] })
  .add('.hero-logo', { opacity: [0, 1], scale: [0.92, 1] }, '-=500')
  .add('.hero-cta',  { opacity: [0, 1], y: [12, 0] }, '-=400');
```

### 6.3 Trazado del logo de la oveja (firma de marca)
Animar el **contorno** del SVG como si se dibujara a mano (encaja con la identidad artesanal):

```js
const [outline] = svg.createDrawable('.sheep-outline');
animate(outline, { draw: ['0 0', '0 1'], duration: 1400, ease: 'inOut(2)' });
// después, rellenar nariz/boca con un fade:
animate('.sheep-fill', { opacity: [0, 1], delay: 1200, duration: 500 });
```

### 6.4 Reveal on-scroll de secciones/elementos
Aparición sutil (sube 24px + fade) al entrar en viewport, con `stagger` para grupos (días del calendario, slots, campos, filas de resumen):

```js
animate('.reveal', {
  opacity: [0, 1],
  y: [24, 0],
  duration: 700,
  ease: 'out(2)',
  delay: stagger(60),
  autoplay: onScroll({ enter: 'bottom-=120 top', once: true }),
});
```

### 6.5 Transición entre pasos (1 → 2 → 3)
Al ser un flujo, la transición debe ser una **fundido + deslizamiento** corto, no un corte:

```js
function goToStep(outEl, inEl) {
  const tl = createTimeline();
  tl.add(outEl, { opacity: [1, 0], y: [0, -12], duration: 260, ease: 'in(2)' })
    .set(outEl, { display: 'none' })
    .set(inEl,  { display: 'flex' })
    .add(inEl,  { opacity: [0, 1], y: [16, 0], duration: 360, ease: 'out(3)' });
}
```

### 6.6 Micro-interacciones
- **Hover** en día/slot/botón: `scale: 1.02` + cambio de fondo, `duration: 180, ease: createSpring({ stiffness: 220 })`.
- **Selección** de día/slot: transición de color de fondo/texto (200 ms) + pequeño "pop" de escala.
- **Pulsación** de botón: `scale: 0.97` en `pointerdown`, vuelta a `1` en `pointerup`.
- **Focus** de input: borde a `--ink` + leve elevación de sombra (200 ms).

### 6.7 Reduce motion (obligatorio)
```js
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
```
Si `reduce` es `true`: desactivar traslados/escala/trazado; usar solo `opacity` con duraciones ≤ 200 ms (o mostrar todo sin animar). El .pen ya contempla este principio (variante de animación reducida en el splash existente).

---

## 7. Comportamiento y lógica (v1)

### 7.1 Switch de modo de reserva (`BOOKING_MODE`)
Un único punto de configuración en código controla qué hace el CTA "Reservar una cita":

```js
// motion/booking config
const BOOKING_MODE = 'external'; // 'external' | 'internal'
const GOOGLE_BOOKING_URL = 'https://calendar.app.google/P8TvSUSSjdqYemP66';

function onBookClick(e) {
  if (BOOKING_MODE === 'external') {
    // v1: abre la página de citas de Google
    window.open(GOOGLE_BOOKING_URL, '_blank', 'noopener,noreferrer');
    return;
  }
  // 'internal': una sola pantalla — logo a la izquierda + panel con fade-in
  openStage();
}
```

- **`external` (por defecto v1):** el CTA abre `GOOGLE_BOOKING_URL` (nueva pestaña, `noopener`). El flujo interno queda oculto pero implementado.
- **`internal`:** el CTA ejecuta `openStage()`: desplaza el logo a la izquierda y hace aparecer el panel de reserva con fade-in (misma pantalla, sin overlay). `closeStage()` revierte la transición.
- La constante debe estar **centralizada y bien señalizada** para poder alternar sin tocar la UI.

### 7.2 Navegación del flujo interno (cuando `BOOKING_MODE === 'internal'`)
- Hero "Reservar una cita" → `openStage()`: el logo se desliza a la izquierda y el **Paso 1** aparece a la derecha con fade-in.
- Cerrar (✕) en el Paso 1 → `closeStage()`: el panel se desvanece y el logo vuelve al centro.
- Paso 1 "Continuar" (habilitado solo con un slot seleccionado) → **Paso 2**.
- Paso 2 "Cambiar" / `‹` → **Paso 1** (conservando la selección).
- Paso 2 "Reservar cita" → **Paso 3** maquetado con los datos introducidos, **sin** persistir nada ni llamar a ninguna API (§7.5).

### 7.3 Estado del calendario y slots (flujo interno)
- Mes, días disponibles y horas son **datos estáticos maquetados**. Estructurarlos en un objeto JS para poder sustituirlos por datos reales de Google Calendar en el futuro sin rehacer la UI.
- Selección de día y de slot es puramente de cliente (clase `is-selected`).

### 7.4 Campo "¿Qué te gustaría hacer?"
- Desplegable con exactamente estas opciones: **`Zumeria`**, **`Valor`**, **`Otros`**.
- Valor por defecto: sin selección (placeholder) o la primera opción, según se prefiera. El icono es `chevron-down`.

### 7.5 Botón "Reservar cita" y Google Calendar (futuro)
- En `BOOKING_MODE === 'external'` el usuario ni siquiera llega a este botón (reserva vía enlace de Google).
- En `BOOKING_MODE === 'internal'`, el botón **"Reservar cita"** avanza al **Paso 3 maquetado** con los datos introducidos, **sin** persistir nada ni llamar a ninguna API.
- **La integración real con la API de Google Calendar todavía no está configurada.** Dejar el punto de integración **aislado y señalizado** (p. ej. `function onReserve(payload) { /* TODO: Google Calendar API */ }`) para conectarlo en el futuro.
- "Añadir a Google Calendar" (Paso 3): opcionalmente puede generar un enlace de plantilla de Google Calendar / archivo `.ics` en cliente (no requiere backend), pero **no es obligatorio** en v1.

---

## 8. Responsive
- **Desktop:** tarjetas de flujo centradas, ancho ~520–560px. Hero a pantalla completa.
- **Móvil:** tarjeta a ancho completo con márgenes; calendario y slots mantienen la retícula (7 columnas / 3 columnas). Tipos y paddings reducidos proporcionalmente. Áreas táctiles ≥ 44px.
- Sin scroll horizontal. Todo el contenido visible/accesible en el viewport.

## 9. Accesibilidad
- Contraste: `--ink` sobre `--surface`/`--bg` cumple AA. Evitar texto importante en `--border` salvo estados deshabilitados.
- Navegación por teclado en calendario (flechas), slots y formulario; foco visible.
- `aria` en desplegable, en el estado seleccionado de días/slots y en los botones de navegación (`Anterior`/`Siguiente` mes).
- Respetar `prefers-reduced-motion` (§6.7).
- Etiquetas `<label>` asociadas a cada input.

## 10. Estructura técnica sugerida
- Sitio **estático** (encaja con el repo actual: un `index.html`). Opciones:
  - Mantener HTML/CSS/JS plano + anime.js (y Lenis opcional) vía ESM/CDN.
  - O un bundler ligero (Vite) si se quiere tree-shaking real de anime.js.
- Fuentes: Google Fonts (Dancing Script, Fraunces, Inter) con `preconnect` y `display=swap`.
- Iconos: Lucide (SVG inline o `lucide` web).
- Solo animar `transform`/`opacity`; usar `will-change` con moderación.
- Organización JS: un módulo `booking.js` (estado + navegación de pasos) y `motion.js` (todas las animaciones anime.js), con `createScope` para poder limpiar.

## 11. Criterios de aceptación
1. Las cuatro vistas (Hero, Paso 1, Paso 2, Paso 3) reproducen fielmente el .pen: colores, tipografías, radios, sombra y espaciados de §4–§5.
2. El logo de la oveja se dibuja con animación de trazado al cargar (o aparece sin animar si `reduce`).
3. Los elementos aparecen con reveal on-scroll escalonado y el scroll es suave.
4. La navegación entre pasos usa transición fundido+deslizamiento; la selección de slot/día tiene micro-interacción.
5. El desplegable "¿Qué te gustaría hacer?" ofrece exactamente `Zumeria`, `Valor`, `Otros`.
6. Existe la variable `BOOKING_MODE`: con `"external"` (por defecto v1) el CTA "Reservar una cita" abre `https://calendar.app.google/P8TvSUSSjdqYemP66` en nueva pestaña; con `"internal"` muestra el flujo maquetado. Cambiar el modo no requiere tocar la UI.
7. El botón "Reservar cita" del flujo interno **no** realiza reserva real (API); el punto de integración con Google Calendar queda aislado y comentado.
8. `prefers-reduced-motion` desactiva movimientos no esenciales.
9. Funciona en desktop y móvil sin scroll horizontal ni contenido cortado.

## 12. Riesgos / decisiones abiertas
- **Modo de reserva:** v1 arranca en `external` (enlace de Google). El flujo interno se implementa pero permanece oculto hasta activar `internal`; mantener ambos caminos probados.
- **Origen de los datos de disponibilidad** (flujo interno): hoy maquetados; definir el modelo cuando se conecte la API de Google Calendar.
- **Smooth scroll:** decidir Lenis (más pulido, +~2KB) vs. `scroll-behavior: smooth` (cero dependencias).
- **"Añadir a Google Calendar":** decidir si en v1 genera `.ics`/enlace o queda inerte.
- **Copia de ejemplo** del .pen (nombres, correos, "un zumo con solano") es placeholder; sustituir por textos definitivos.

---

### Fuentes (anime.js)
- [Anime.js — JavaScript Animation Engine](https://animejs.com/)
- [Timeline | Documentation](https://animejs.com/documentation/timeline/)
- [stagger() | Utilities](https://animejs.com/documentation/utilities/stagger/)
- [Stagger from | parameters](https://animejs.com/documentation/utilities/stagger/stagger-parameters/stagger-from/)
