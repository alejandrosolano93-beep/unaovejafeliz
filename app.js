/* ============================================================
   Una oveja feliz — lógica de la web
   ============================================================ */

/* --- Configuración de reserva ---------------------------------
   BOOKING_MODE controla qué hace el CTA "Reservar una cita":
     'external' -> abre la página de citas de Google (por defecto v1)
     'internal' -> muestra el flujo de reserva maquetado (Paso 1→2→3)
   Cambiar solo esta constante para alternar el comportamiento.        */
const BOOKING_MODE = 'external'; // 'external' | 'internal'
const GOOGLE_BOOKING_URL = 'https://calendar.app.google/P8TvSUSSjdqYemP66';

/* --- Integración backend (Cloudflare Pages Functions) ---------
   API_BASE vacío = mismo dominio (rutas /api/*).
   TURNSTILE_SITE_KEY es la clave PÚBLICA de Turnstile (segura en cliente).  */
const API_BASE = '';
const TURNSTILE_SITE_KEY = ''; // rellenar con la site key de Cloudflare Turnstile

const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

/* --- Iconos ---------------------------------------------------- */
if (window.lucide) window.lucide.createIcons();

/* --- Estado de la reserva -------------------------------------- */
const state = {
  service: 'Zumeria',
  time: null,          // 'HH:MM' seleccionada
};

/* Disponibilidad real cargada desde /api/availability */
let availability = { days: {}, durationMin: 60, error: false };
let selectedDate = null;         // 'YYYY-MM-DD'
let lastBookingLink = '';        // htmlLink del evento creado (paso 3)

/* Vista del calendario (mes mostrado) */
const today = new Date();
let viewYear = today.getFullYear();
let viewMonth = today.getMonth(); // 0-based

const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const WEEKDAYS_LONG = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo']; // lunes primero

function pad2(n) { return String(n).padStart(2, '0'); }
function ymdKey(y, m0, d) { return `${y}-${pad2(m0 + 1)}-${pad2(d)}`; }
function parseKey(key) { const [y, m, d] = key.split('-').map(Number); return { y, m, d }; }
function weekdayLongOf(key) {
  const { y, m, d } = parseKey(key);
  const dow = new Date(y, m - 1, d).getDay(); // 0=Dom
  return WEEKDAYS_LONG[(dow + 6) % 7];
}
function dateLabelShort(key) {
  const { m, d } = parseKey(key);
  return `${cap(weekdayLongOf(key))} ${d} ${MONTHS[m - 1].slice(0, 3)}`;
}
function dateLabelLong(key) {
  const { y, m, d } = parseKey(key);
  return `${cap(weekdayLongOf(key))} ${d} de ${MONTHS[m - 1]}, ${y}`;
}
function monthRange(y, m0) {
  const last = new Date(y, m0 + 1, 0).getDate();
  return { from: ymdKey(y, m0, 1), to: ymdKey(y, m0, last) };
}

/* --- Referencias ----------------------------------------------- */
const booking = document.getElementById('booking');
const cards = Array.from(document.querySelectorAll('.card'));

/* ============================================================
   Calendario (dinámico, disponibilidad real de Google Calendar)
   ============================================================ */
const WEEKDAYS_SHORT = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
const WEEKDAYS_ABBR = ['lun', 'mar', 'mié', 'jue', 'vie', 'sáb', 'dom'];

/* Carga la disponibilidad del mes visible desde el backend. */
async function loadAvailability() {
  const { from, to } = monthRange(viewYear, viewMonth);
  setSlotsStatus('Cargando disponibilidad…');
  try {
    const url = `${API_BASE}/api/availability?from=${from}&to=${to}&service=${encodeURIComponent(state.service)}`;
    const res = await fetch(url);
    const data = await res.json();
    if (!res.ok || data.error) throw new Error(data.error || res.status);
    availability = { days: data.days || {}, durationMin: data.durationMin || 60, error: false };
  } catch (e) {
    availability = { days: {}, durationMin: 60, error: true };
  }

  const keys = Object.keys(availability.days).sort();
  if (!selectedDate || !availability.days[selectedDate]) selectedDate = keys[0] || null;
  const times = selectedDate ? availability.days[selectedDate] : [];
  state.time = times && times.length ? times[0] : null;

  buildCalendar();
  buildSlots();
  updateSlotsLabel();
  updateContinue();
}

function buildCalendar() {
  const cal = document.getElementById('calendar');
  cal.innerHTML = '';

  const head = document.createElement('div');
  head.className = 'cal-row';
  for (const wd of WEEKDAYS_SHORT) {
    const c = document.createElement('div');
    c.className = 'cal-wd';
    c.textContent = wd;
    head.appendChild(c);
  }
  cal.appendChild(head);

  const firstDow = new Date(viewYear, viewMonth, 1).getDay(); // 0=Dom
  const leading = (firstDow + 6) % 7;                          // lunes primero
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

  const cells = [];
  for (let i = 0; i < leading; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  for (let r = 0; r < cells.length / 7; r++) {
    const row = document.createElement('div');
    row.className = 'cal-row';
    for (let c = 0; c < 7; c++) {
      const day = cells[r * 7 + c];
      const cell = document.createElement('div');
      cell.className = 'cal-day';
      if (day === null) {
        cell.classList.add('is-empty');
      } else {
        cell.textContent = day;
        const key = ymdKey(viewYear, viewMonth, day);
        if (!availability.days[key]) {
          cell.classList.add('is-disabled');
        } else {
          if (key === selectedDate) cell.classList.add('is-selected');
          cell.addEventListener('click', () => selectDay(key, cell));
        }
      }
      row.appendChild(cell);
    }
    cal.appendChild(row);
  }

  const label = document.querySelector('.month-nav .month');
  if (label) label.textContent = `${cap(MONTHS[viewMonth])} ${viewYear}`;
}

function selectDay(key, cell) {
  selectedDate = key;
  document.querySelectorAll('.cal-day.is-selected').forEach((el) => el.classList.remove('is-selected'));
  cell.classList.add('is-selected');
  const times = availability.days[key] || [];
  state.time = times.includes(state.time) ? state.time : (times[0] || null);
  buildSlots();
  updateSlotsLabel();
  updateContinue();
  pop(cell);
}

function updateSlotsLabel() {
  const el = document.getElementById('slotsLabel');
  if (!el) return;
  if (availability.error) { el.textContent = 'No se pudo cargar la disponibilidad'; return; }
  if (!selectedDate) { el.textContent = 'No hay huecos disponibles este mes'; return; }
  const { m, d } = parseKey(selectedDate);
  const dow = new Date(parseKey(selectedDate).y, m - 1, d).getDay();
  el.textContent = `Horas disponibles · ${WEEKDAYS_ABBR[(dow + 6) % 7]} ${d} ${MONTHS[m - 1].slice(0, 3)}`;
}

function setSlotsStatus(msg) {
  const label = document.getElementById('slotsLabel');
  if (label) label.textContent = msg;
  const wrap = document.getElementById('slots');
  if (wrap) wrap.innerHTML = '';
}

function updateContinue() {
  const btn = document.getElementById('continueBtn');
  if (btn) btn.disabled = !(selectedDate && state.time);
}

function changeMonth(delta) {
  const d = new Date(viewYear, viewMonth + delta, 1);
  const cur = new Date(today.getFullYear(), today.getMonth(), 1);
  if (d < cur) return; // no navegar a meses pasados
  viewYear = d.getFullYear();
  viewMonth = d.getMonth();
  selectedDate = null;
  loadAvailability();
}

/* ============================================================
   Slots de hora (del día seleccionado)
   ============================================================ */
function buildSlots() {
  const wrap = document.getElementById('slots');
  wrap.innerHTML = '';
  const times = selectedDate ? (availability.days[selectedDate] || []) : [];
  for (let i = 0; i < times.length; i += 3) {
    const r = document.createElement('div');
    r.className = 'slot-row';
    for (let j = 0; j < 3; j++) {
      const t = times[i + j];
      const s = document.createElement('div');
      if (t === undefined) {
        s.style.visibility = 'hidden';
      } else {
        s.className = 'slot';
        s.textContent = t;
        if (t === state.time) s.classList.add('is-selected');
        s.addEventListener('click', () => selectSlot(t, s));
      }
      r.appendChild(s);
    }
    wrap.appendChild(r);
  }
}

function selectSlot(t, el) {
  state.time = t;
  document.querySelectorAll('.slot.is-selected').forEach((s) => s.classList.remove('is-selected'));
  el.classList.add('is-selected');
  updateContinue();
  pop(el);
}

/* ============================================================
   Navegación entre pasos
   ============================================================ */
function activateOnly(id) {
  cards.forEach((c) => {
    c.classList.toggle('is-active', c.id === id);
    if (c.id !== id) { c.style.opacity = ''; c.style.transform = ''; }
  });
}

function goToStep(toId) {
  const current = document.querySelector('.card.is-active');
  const target = document.getElementById(toId);
  if (reduceMotion || !anime || !current || current === target) {
    activateOnly(toId);
    return;
  }
  anime.animate(current, {
    opacity: [1, 0], translateY: [0, -12], duration: 240, ease: 'in(2)',
    onComplete: () => {
      activateOnly(toId);
      anime.animate(target, { opacity: [0, 1], translateY: [16, 0], duration: 360, ease: 'out(3)' });
    },
  });
}

/* --- Apertura/cierre del panel (una sola pantalla, transición FLIP) --- */
const STAGE_MS = 1500;          // desplazamiento del logo
const APPEAR_MS = 500;          // aparición del formulario (fade-in)
const STAGE_EASE = 'inOut(2)';  // easing suave, con aceleración central contenida
// conjunto de la transición ≈ STAGE_MS + APPEAR_MS = 2s
let stageOpen = false;
const heroLogo = document.querySelector('.hero-logo');

function openStage() {
  if (stageOpen) return;
  stageOpen = true;
  activateOnly('step1');
  loadAvailability(); // trae la disponibilidad real (no bloquea la animación)

  const hero = heroLogo.parentElement;
  // FLIP: medir el logo antes y después de mostrar el panel + reposicionar (móvil)
  const first = heroLogo.getBoundingClientRect();
  booking.hidden = false;
  hero.classList.add('is-staged');
  const last = heroLogo.getBoundingClientRect();
  const dx = first.left - last.left;
  const dy = first.top - last.top;
  const sx = first.width / last.width; // en móvil el logo se reduce; en escritorio ≈ 1

  if (reduceMotion || !anime) return;

  // el formulario permanece oculto hasta que el logo termine
  booking.style.opacity = '0';

  // el logo se desliza (y en móvil se reduce) suavemente a su nueva posición
  heroLogo.style.transformOrigin = 'top left';
  anime.animate(heroLogo, { translateX: [dx, 0], translateY: [dy, 0], scale: [sx, 1], duration: STAGE_MS, ease: STAGE_EASE });

  // el formulario entra solapando el tramo final del logo (0.5s antes) para evitar la pausa
  anime.animate(booking, { opacity: [0, 1], translateY: [16, 0], duration: APPEAR_MS, delay: STAGE_MS - 500, ease: 'out(3)' });
}

function closeStage() {
  if (!stageOpen) return;
  const hero = heroLogo.parentElement;
  const finish = () => {
    booking.hidden = true;
    booking.style.opacity = '';
    booking.style.transform = '';
    booking.style.filter = '';
    hero.classList.remove('is-staged');
    activateOnly('step1');
    stageOpen = false;
  };
  if (reduceMotion || !anime) { finish(); heroLogo.style.transform = ''; heroLogo.style.transformOrigin = ''; return; }

  const first = heroLogo.getBoundingClientRect();
  // el formulario se desvanece con fade-out + leve desplazamiento (0.5s)
  anime.animate(booking, {
    opacity: [1, 0], translateY: [0, 16], duration: APPEAR_MS, ease: 'in(2)',
    onComplete: () => {
      booking.hidden = true;
      hero.classList.remove('is-staged');
      const last = heroLogo.getBoundingClientRect();
      const dx = first.left - last.left;
      const dy = first.top - last.top;
      const sx = first.width / last.width;
      // y el logo regresa suavemente al centro (y a su tamaño original en móvil)
      heroLogo.style.transformOrigin = 'top left';
      anime.animate(heroLogo, {
        translateX: [dx, 0], translateY: [dy, 0], scale: [sx, 1], duration: STAGE_MS, ease: STAGE_EASE,
        onComplete: () => { heroLogo.style.transformOrigin = ''; },
      });
      booking.style.opacity = '';
      booking.style.transform = '';
      activateOnly('step1');
      stageOpen = false;
    },
  });
}

/* ============================================================
   Wiring de eventos
   ============================================================ */
document.getElementById('reserveCta').addEventListener('click', () => {
  if (BOOKING_MODE === 'external') {
    window.open(GOOGLE_BOOKING_URL, '_blank', 'noopener,noreferrer');
    return;
  }
  openStage();
});

document.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', closeStage));
document.querySelectorAll('[data-back]').forEach((b) => b.addEventListener('click', () => goToStep('step1')));

const monthBtns = document.querySelectorAll('.month-nav .icon-btn');
if (monthBtns[0]) monthBtns[0].addEventListener('click', () => changeMonth(-1));
if (monthBtns[1]) monthBtns[1].addEventListener('click', () => changeMonth(1));

document.getElementById('continueBtn').addEventListener('click', () => {
  if (!(selectedDate && state.time)) return;
  document.getElementById('summaryChip').textContent = `${dateLabelShort(selectedDate)} · ${state.time}`;
  goToStep('step2');
});

document.getElementById('f-service').addEventListener('change', (e) => {
  state.service = e.target.value;
  document.getElementById('serviceValue').textContent = e.target.value;
});

/* Turnstile (anti-spam). Se renderiza solo si hay site key configurada. */
function initTurnstile() {
  if (!TURNSTILE_SITE_KEY) return;
  const mount = () => {
    if (window.turnstile && document.getElementById('turnstile')) {
      window.turnstile.render('#turnstile', { sitekey: TURNSTILE_SITE_KEY });
    }
  };
  if (window.turnstile) mount();
  else window.addEventListener('load', mount);
}

const REQUIRED_FIELDS = ['f-name', 'f-phone'];

REQUIRED_FIELDS.forEach((id) => {
  document.getElementById(id).addEventListener('input', (e) => {
    e.target.closest('.field').classList.remove('is-invalid');
  });
});

function validateForm() {
  let ok = true;
  const invalid = [];
  REQUIRED_FIELDS.forEach((id) => {
    const input = document.getElementById(id);
    const field = input.closest('.field');
    if (!input.value.trim()) {
      field.classList.add('is-invalid');
      invalid.push(field);
      ok = false;
    } else {
      field.classList.remove('is-invalid');
    }
  });
  if (!ok) {
    invalid[0].querySelector('input').focus();
    if (!reduceMotion && anime) {
      anime.animate(invalid, { translateX: [0, -6, 6, -4, 4, 0], duration: 380, ease: 'inOut(2)' });
    }
  }
  return ok;
}

document.getElementById('reserveBtn').addEventListener('click', async () => {
  if (!validateForm()) return;
  if (!(selectedDate && state.time)) { goToStep('step1'); return; }

  const btn = document.getElementById('reserveBtn');
  btn.disabled = true;
  setBookError('');
  try {
    const res = await fetch(`${API_BASE}/api/book`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(collectForm()),
    });
    const data = await res.json().catch(() => ({}));

    if (!res.ok || !data.ok) {
      if (data.error === 'SLOT_TAKEN') {
        setBookError('Ese hueco acaba de ocuparse. Elige otro, por favor.');
        await loadAvailability();
        goToStep('step1');
      } else if (data.error === 'SPAM_REJECTED') {
        setBookError('No hemos podido verificar que no eres un robot. Inténtalo de nuevo.');
        resetTurnstile();
      } else {
        setBookError('No se pudo completar la reserva. Inténtalo más tarde.');
      }
      return;
    }

    lastBookingLink = data.htmlLink || '';
    document.getElementById('sumDate').textContent = dateLabelLong(selectedDate);
    document.getElementById('sumTime').textContent = `${state.time} · ${availability.durationMin || 60} minutos`;
    document.getElementById('sumService').textContent = state.service;
    const email = document.getElementById('f-email').value.trim();
    document.getElementById('confirmMail').textContent = email
      ? `Confirmación enviada a ${email}`
      : 'Confirmación enviada a tu correo';
    goToStep('step3');
  } catch (e) {
    setBookError('Error de red. Inténtalo de nuevo.');
  } finally {
    btn.disabled = false;
  }
});

document.getElementById('gcalBtn').addEventListener('click', () => {
  window.open(lastBookingLink || GOOGLE_BOOKING_URL, '_blank', 'noopener,noreferrer');
});

function collectForm() {
  const tokenEl = document.querySelector('[name="cf-turnstile-response"]');
  return {
    date: selectedDate,
    time: state.time,
    service: state.service,
    name: document.getElementById('f-name').value.trim(),
    email: document.getElementById('f-email').value.trim(),
    phone: document.getElementById('f-phone').value.trim(),
    notes: document.getElementById('f-notes').value.trim(),
    antispamToken: tokenEl ? tokenEl.value : '',
  };
}

function setBookError(msg) {
  const el = document.getElementById('bookError');
  if (!el) return;
  el.textContent = msg || '';
  el.hidden = !msg;
}

function resetTurnstile() {
  if (window.turnstile && typeof window.turnstile.reset === 'function') window.turnstile.reset();
}

function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

/* ============================================================
   Animaciones (anime.js v4)
   ============================================================ */
let anime = null;

function revealAll() {
  document.querySelectorAll('.reveal').forEach((el) => { el.style.opacity = '1'; });
}

// micro-interacción de "pop" reutilizable
function pop(el) {
  if (reduceMotion || !anime) return;
  anime.animate(el, { scale: [0.94, 1], duration: 260, ease: 'out(3)' });
}

// pulsación de botones
function bindPress() {
  document.querySelectorAll('.btn-primary, .btn-outline').forEach((btn) => {
    btn.addEventListener('pointerdown', () => { if (anime) anime.animate(btn, { scale: 0.97, duration: 120, ease: 'out(2)' }); });
    btn.addEventListener('pointerup', () => { if (anime) anime.animate(btn, { scale: 1, duration: 160, ease: 'out(3)' }); });
    btn.addEventListener('pointerleave', () => { if (anime) anime.animate(btn, { scale: 1, duration: 160, ease: 'out(3)' }); });
  });
}

async function initMotion() {
  if (reduceMotion) { revealAll(); return; }
  try {
    anime = await import('https://cdn.jsdelivr.net/npm/animejs@4/+esm');
  } catch (e) {
    revealAll();
    return;
  }

  const { createTimeline } = anime;

  // Entrada del hero
  const tl = createTimeline({ defaults: { ease: 'out(3)', duration: 800 } });
  tl.add('.cta', { opacity: [0, 1], translateY: [12, 0] }, 0)
    .add('.hero-logo', { opacity: [0, 1], scale: [0.92, 1], translateY: [12, 0], duration: 1000 }, 120);

  bindPress();
}

/* ============================================================
   Init
   ============================================================ */
buildCalendar();
buildSlots();
updateSlotsLabel();
updateContinue();
initTurnstile();
initMotion();
